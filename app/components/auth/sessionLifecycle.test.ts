import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthSessionLifecycle, registerAuthSessionWake, type ClientAuthSession } from "./sessionLifecycle";

const NOW = 1_700_000_000_000;
function activeSession(deadline = NOW + 1000): ClientAuthSession {
  return { user: { id: "user-a", authProvider: "kakao" }, expires: new Date(deadline).toISOString() };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => vi.useRealTimers());

describe("auth session lifecycle", () => {
  it("logs out once at the server deadline without waiting for another page request", async () => {
    const loadSession = vi.fn(async () => Date.now() < NOW + 1000 ? activeSession() : { sessionExpired: true });
    const clearSession = vi.fn(async () => undefined);
    const onSession = vi.fn();
    const onExpired = vi.fn();
    const lifecycle = createAuthSessionLifecycle({ loadSession, clearSession, onSession, onExpired });
    await lifecycle.refresh();
    expect(onSession).toHaveBeenCalledWith(activeSession());
    await vi.advanceTimersByTimeAsync(999);
    expect(clearSession).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(onSession).toHaveBeenLastCalledWith(null);
    await lifecycle.refresh();
    expect(clearSession).toHaveBeenCalledTimes(1);
    lifecycle.stop();
  });

  it("does not extend the same deadline when refreshing the session", async () => {
    const loadSession = vi.fn(async () => Date.now() < NOW + 1000 ? activeSession() : { sessionExpired: true });
    const clearSession = vi.fn(async () => undefined);
    const lifecycle = createAuthSessionLifecycle({ loadSession, clearSession, onSession: vi.fn(), onExpired: vi.fn() });
    await lifecycle.refresh();
    await vi.advanceTimersByTimeAsync(800);
    await lifecycle.refresh();
    await vi.advanceTimersByTimeAsync(200);
    expect(clearSession).toHaveBeenCalledTimes(1);
    lifecycle.stop();
  });

  it("preserves a newer login in another tab when the previous deadline fires", async () => {
    const newer = activeSession(NOW + 10_000);
    const loadSession = vi.fn(async () => Date.now() < NOW + 1000 ? activeSession() : newer);
    const clearSession = vi.fn(async () => undefined);
    const onSession = vi.fn();
    const onExpired = vi.fn();
    const lifecycle = createAuthSessionLifecycle({ loadSession, clearSession, onSession, onExpired });
    await lifecycle.refresh();
    await vi.advanceTimersByTimeAsync(1000);
    expect(onSession).toHaveBeenLastCalledWith(newer);
    expect(clearSession).not.toHaveBeenCalled();
    expect(onExpired).not.toHaveBeenCalled();
    lifecycle.stop();
  });

  it("rechecks a changed login before clearing an expired shared cookie", async () => {
    const newer = activeSession(NOW + 10_000);
    const loadSession = vi.fn().mockResolvedValueOnce({ sessionExpired: true }).mockResolvedValue(newer);
    const clearSession = vi.fn(async () => undefined);
    const onSession = vi.fn();
    const lifecycle = createAuthSessionLifecycle({ loadSession, clearSession, onSession, onExpired: vi.fn() });
    await lifecycle.refresh();
    expect(onSession).toHaveBeenLastCalledWith(newer);
    expect(clearSession).not.toHaveBeenCalled();
    lifecycle.stop();
  });

  it("preserves the last state when network or account validation is unavailable", async () => {
    const loadSession = vi.fn().mockResolvedValueOnce(activeSession()).mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ authValidationUnavailable: true });
    const clearSession = vi.fn(async () => undefined);
    const onSession = vi.fn();
    const onExpired = vi.fn();
    const lifecycle = createAuthSessionLifecycle({ loadSession, clearSession, onSession, onExpired });
    await lifecycle.refresh();
    await lifecycle.refresh();
    await lifecycle.refresh();
    expect(onSession).toHaveBeenCalledTimes(1);
    expect(clearSession).not.toHaveBeenCalled();
    expect(onExpired).not.toHaveBeenCalled();
    lifecycle.stop();
  });

  it("coalesces pending checks and ignores responses after cleanup", async () => {
    let resolve!: (session: ClientAuthSession) => void;
    const loadSession = vi.fn(() => new Promise<ClientAuthSession>((done) => { resolve = done; }));
    const onSession = vi.fn();
    const lifecycle = createAuthSessionLifecycle({ loadSession, clearSession: vi.fn(), onSession, onExpired: vi.fn() });
    const first = lifecycle.refresh();
    const second = lifecycle.refresh();
    expect(loadSession).toHaveBeenCalledTimes(1);
    lifecycle.stop();
    resolve(activeSession());
    await Promise.all([first, second]);
    expect(onSession).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rechecks after browser back, focus, foreground restoration and network recovery", () => {
    const windowTarget = new EventTarget();
    const documentTarget = Object.assign(new EventTarget(), { visibilityState: "hidden" });
    const refresh = vi.fn();
    const cleanup = registerAuthSessionWake(windowTarget, documentTarget, refresh);
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).not.toHaveBeenCalled();
    windowTarget.dispatchEvent(new Event("pageshow"));
    windowTarget.dispatchEvent(new Event("focus"));
    windowTarget.dispatchEvent(new Event("online"));
    documentTarget.visibilityState = "visible";
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).toHaveBeenCalledTimes(4);
    cleanup();
    windowTarget.dispatchEvent(new Event("pageshow"));
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).toHaveBeenCalledTimes(4);
  });

  it("does not show an expiry notice for a normal manual logout", async () => {
    const loadSession = vi.fn().mockResolvedValueOnce(activeSession()).mockResolvedValue({});
    const clearSession = vi.fn();
    const onExpired = vi.fn();
    const onSession = vi.fn();
    const lifecycle = createAuthSessionLifecycle({ loadSession, clearSession, onSession, onExpired });
    await lifecycle.refresh();
    await lifecycle.refresh();
    expect(onSession).toHaveBeenLastCalledWith(null);
    expect(clearSession).not.toHaveBeenCalled();
    expect(onExpired).not.toHaveBeenCalled();
    lifecycle.stop();
  });

  it("does not expire a server-valid login when the device clock is fast", async () => {
    const loadSession = vi.fn().mockResolvedValue({ ...activeSession(NOW - 1000), serverTime: NOW - 10_000 });
    const clearSession = vi.fn();
    const onExpired = vi.fn();
    const onSession = vi.fn();
    const lifecycle = createAuthSessionLifecycle({ loadSession, clearSession, onSession, onExpired });
    await lifecycle.refresh();
    expect(onSession).toHaveBeenCalledWith(expect.objectContaining({ user: { id: "user-a", authProvider: "kakao" } }));
    expect(clearSession).not.toHaveBeenCalled();
    expect(onExpired).not.toHaveBeenCalled();
    lifecycle.stop();
  });

  it("preserves a login that changed while the logout request was being prepared", async () => {
    const loadSession = vi.fn().mockResolvedValueOnce({ sessionExpired: true })
      .mockResolvedValueOnce({ sessionExpired: true }).mockResolvedValue(activeSession(NOW + 10_000));
    const clearSession = vi.fn(async () => false);
    const onExpired = vi.fn();
    const onSession = vi.fn();
    const lifecycle = createAuthSessionLifecycle({ loadSession, clearSession, onSession, onExpired });
    await lifecycle.refresh();
    expect(onSession).toHaveBeenLastCalledWith(activeSession(NOW + 10_000));
    expect(onExpired).not.toHaveBeenCalled();
    lifecycle.stop();
  });

  it("retries a failed logout instead of marking it as completed", async () => {
    const clearSession = vi.fn().mockRejectedValueOnce(new Error("503")).mockResolvedValue(true);
    const onExpired = vi.fn();
    const lifecycle = createAuthSessionLifecycle({ loadSession: vi.fn().mockResolvedValue({ sessionExpired: true }),
      clearSession, onSession: vi.fn(), onExpired });
    await lifecycle.refresh();
    expect(onExpired).not.toHaveBeenCalled();
    await lifecycle.refresh();
    expect(clearSession).toHaveBeenCalledTimes(2);
    expect(onExpired).toHaveBeenCalledTimes(1);
    lifecycle.stop();
  });
});
