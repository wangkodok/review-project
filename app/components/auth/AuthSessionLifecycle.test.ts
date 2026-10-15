import { afterEach, describe, expect, it, vi } from "vitest";
import { clearExpiredAuthSession, loadClientAuthSession } from "./AuthSessionLifecycle";

afterEach(() => vi.unstubAllGlobals());

describe("client auth session request", () => {
  it("requests the existing same-origin endpoint without caching session state", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ sessionExpired: true })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(loadClientAuthSession()).resolves.toEqual({ sessionExpired: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/session?readOnly=true", { cache: "no-store", credentials: "same-origin" });
  });

  it("rejects server/network failures rather than treating them as logout", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(loadClientAuthSession()).rejects.toThrow("AUTH_SESSION_UNAVAILABLE");
    await expect(loadClientAuthSession()).rejects.toThrow("offline");
  });

  it("uses existing NextAuth CSRF verification and the expiry-only guard", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ csrfToken: "synthetic-csrf" }))
      .mockResolvedValueOnce(Response.json({ url: "http://localhost:3000/my" }))
      .mockResolvedValueOnce(Response.json({ sessionExpired: true }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(clearExpiredAuthSession()).resolves.toBe(true);
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/auth/signout");
    expect(options.method).toBe("POST");
    expect(options.body.get("csrfToken")).toBe("synthetic-csrf");
    expect(options.body.get("expireOnly")).toBe("true");
  });

  it("keeps a fresh login when the server rejects old-tab expiry logout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ csrfToken: "synthetic-csrf" }))
      .mockResolvedValueOnce(Response.json({ code: "AUTH_SESSION_CHANGED" }, { status: 409 })));
    await expect(clearExpiredAuthSession()).resolves.toBe(false);
  });

  it.each([
    Response.json({ error: "unavailable" }, { status: 503 }),
    Response.json({ url: "http://localhost:3000/api/auth/signout?csrf=true" }),
    Response.json({}),
  ])("rejects failed signout or CSRF responses: %s", async (response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ csrfToken: "synthetic-csrf" }))
      .mockResolvedValueOnce(response));
    await expect(clearExpiredAuthSession()).rejects.toThrow("AUTH_LOGOUT_UNAVAILABLE");
  });

  it("does not post a logout without a valid CSRF response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({}));
    vi.stubGlobal("fetch", fetchMock);
    await expect(clearExpiredAuthSession()).rejects.toThrow("AUTH_LOGOUT_UNAVAILABLE");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("preserves a new login completed while the expiry POST was in flight", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ csrfToken: "synthetic-csrf" }))
      .mockResolvedValueOnce(Response.json({ url: "http://localhost:3000/my" }))
      .mockResolvedValueOnce(Response.json({ user: { id: "new-login", authProvider: "kakao" }, expires: "2099-01-01T00:00:00.000Z" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(clearExpiredAuthSession()).resolves.toBe(false);
  });
});
