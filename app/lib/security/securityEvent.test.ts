import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  recordSecurityEvent,
  type SecurityEventInput,
} from "./securityEvent";

describe("recordSecurityEvent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-26T01:02:03.000Z"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("writes a fixed, privacy-minimized error payload", () => {
    const unsafeInput = {
      eventCode: "withdrawal_database_delete_failed",
      provider: "kakao",
      email: "private@example.com",
      accessToken: "secret-token",
      userId: "private-user-id",
    } as unknown as SecurityEventInput;

    recordSecurityEvent(unsafeInput);

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.warn).not.toHaveBeenCalled();

    const payload = JSON.parse(
      vi.mocked(console.error).mock.calls[0][0] as string,
    );

    expect(payload).toEqual({
      schemaVersion: 1,
      timestamp: "2026-08-26T01:02:03.000Z",
      eventCode: "withdrawal_database_delete_failed",
      severity: "error",
      environment: "test",
      route: "/api/withdraw",
      httpStatus: 500,
      provider: "kakao",
    });
    expect(payload).not.toHaveProperty("email");
    expect(payload).not.toHaveProperty("accessToken");
    expect(payload).not.toHaveProperty("userId");
  });

  it("uses warn for a non-fatal cleanup failure", () => {
    recordSecurityEvent({
      eventCode: "withdrawal_state_cleanup_failed",
      provider: "google",
    });

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("does not invent a provider when the failure occurs before account lookup", () => {
    recordSecurityEvent({
      eventCode: "withdrawal_state_store_unavailable",
    });

    const payload = JSON.parse(
      vi.mocked(console.error).mock.calls[0][0] as string,
    );

    expect(payload.eventCode).toBe("withdrawal_state_store_unavailable");
    expect(payload).not.toHaveProperty("provider");
  });

  it("records only the allowed rate-limit context", () => {
    const unsafeInput = {
      eventCode: "rate_limit_store_unavailable",
      policy: "posts",
      resultCode: "timeout",
      provider: "google",
      identifier: "private-request-identifier",
    } as unknown as SecurityEventInput;

    recordSecurityEvent(unsafeInput);

    const payload = JSON.parse(
      vi.mocked(console.error).mock.calls[0][0] as string,
    );

    expect(payload).toMatchObject({
      eventCode: "rate_limit_store_unavailable",
      severity: "error",
      httpStatus: 503,
      policy: "posts",
      resultCode: "timeout",
    });
    expect(payload).not.toHaveProperty("route");
    expect(payload).not.toHaveProperty("provider");
    expect(payload).not.toHaveProperty("identifier");
  });
});
