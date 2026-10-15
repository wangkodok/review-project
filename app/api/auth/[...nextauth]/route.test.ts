import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  const handler = vi.fn();

  return {
    handler,
    nextAuth: vi.fn(() => handler),
    getToken: vi.fn(),
    enforceRateLimit: vi.fn(),
    getRequestIp: vi.fn(),
  };
});

vi.mock("next-auth", () => ({ default: mocks.nextAuth }));
vi.mock("next-auth/jwt", () => ({ getToken: mocks.getToken }));
vi.mock("@/app/lib/auth/options", () => ({
  authOptions: { shared: true },
}));
vi.mock("@/app/lib/security/rateLimit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  getRequestIp: mocks.getRequestIp,
}));

import { GET, POST } from "./route";

const context = {
  params: Promise.resolve({ nextauth: ["callback", "google"] }),
};

describe("NextAuth route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.handler.mockResolvedValue(new Response(null, { status: 204 }));
    mocks.getToken.mockResolvedValue({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      authProvider: "google",
    });
    mocks.enforceRateLimit.mockResolvedValue(null);
    mocks.getRequestIp.mockReturnValue("request-ip");
  });

  it("blocks an in-flight legacy withdrawal callback without replacing the current session", async () => {
    const request = new NextRequest(
      "http://localhost/api/auth/callback/google",
      {
        headers: {
          cookie: "food-review-withdrawal-reauth-flow=legacy-flow-id",
        },
      },
    );

    const response = await GET(request, context);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/my");
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("food-review-withdrawal-reauth-flow=");
    expect(setCookie).toContain("__Secure-food-review-withdrawal-reauth-flow=");
    expect(setCookie).toContain("food-review-withdrawal-reauth-csrf=");
    expect(setCookie).toContain("__Secure-food-review-withdrawal-reauth-csrf=");
    expect(setCookie.match(/Max-Age=0/g)).toHaveLength(4);
    expect(mocks.handler).not.toHaveBeenCalled();
    expect(mocks.getToken).not.toHaveBeenCalled();
    expect(mocks.nextAuth).not.toHaveBeenCalled();
  });

  it("uses the ordinary auth callback when no legacy withdrawal cookie remains", async () => {
    const request = new NextRequest(
      "http://localhost/api/auth/callback/google",
    );

    const response = await GET(request, context);

    expect(response.status).toBe(204);
    expect(mocks.handler).toHaveBeenCalledWith(request, context);
  });

  it("keeps sign-in rate limiting before the ordinary auth handler", async () => {
    const request = new NextRequest("http://localhost/api/auth/signin/google", {
      method: "POST",
    });

    const response = await POST(request, context);

    expect(response.status).toBe(204);
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      identifier: "request-ip",
      policy: "auth",
    });
    expect(mocks.handler).toHaveBeenCalledWith(request, context);
  });

  it("returns a sign-in rate limit response without calling NextAuth", async () => {
    const rateLimited = Response.json(
      { success: false, code: "RATE_LIMIT_EXCEEDED" },
      { status: 429 },
    );
    mocks.enforceRateLimit.mockResolvedValue(rateLimited);
    const request = new NextRequest("http://localhost/api/auth/signin/google", {
      method: "POST",
    });

    const response = await POST(request, context);

    expect(response).toBe(rateLimited);
    expect(mocks.handler).not.toHaveBeenCalled();
  });

  it("refuses an expiry-only logout when a newer valid login is present", async () => {
    mocks.getToken.mockResolvedValue({ userId: "synthetic-user", authProvider: "kakao", authenticatedAt: Date.now() });
    const request = new NextRequest("http://localhost/api/auth/signout", { method: "POST",
      body: new URLSearchParams({ expireOnly: "true", csrfToken: "synthetic-csrf", json: "true" }) });
    const response = await POST(request, context);
    expect(response.status).toBe(409);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mocks.handler).not.toHaveBeenCalled();
  });

  it.each([{ authenticatedAt: Date.now() - 43_200_001 }, { authSessionExpired: true }, null])(
    "delegates an expired or already absent session to existing NextAuth CSRF validation: %s", async (token) => {
      mocks.getToken.mockResolvedValue(token);
      const request = new NextRequest("http://localhost/api/auth/signout", { method: "POST",
        body: new URLSearchParams({ expireOnly: "true", csrfToken: "synthetic-csrf", json: "true" }) });
      const response = await POST(request, context);
      expect(response.status).toBe(204);
      expect(mocks.handler).toHaveBeenCalledWith(request, context);
      expect(mocks.getToken).toHaveBeenCalledTimes(1);
    },
  );

  it("keeps an ordinary user-requested logout unchanged", async () => {
    mocks.handler.mockResolvedValue(new Response(null, { status: 204, headers: { "set-cookie": "next-auth.session-token=; Max-Age=0; Path=/" } }));
    const request = new NextRequest("http://localhost/api/auth/signout", { method: "POST",
      body: new URLSearchParams({ csrfToken: "synthetic-csrf", json: "true" }) });
    const response = await POST(request, context);
    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(mocks.getToken).not.toHaveBeenCalled();
  });

  it("makes lifecycle session reads unable to overwrite a newer OAuth cookie", async () => {
    let finish!: (response: Response) => void;
    mocks.handler.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const request = new NextRequest("http://localhost/api/auth/session?readOnly=true");
    const pending = GET(request, context);
    let cookieJar = "synthetic-new-oauth-login";
    finish(new Response(JSON.stringify({ sessionExpired: true }), {
      headers: { "set-cookie": "next-auth.session-token=synthetic-expired; Path=/", "content-type": "application/json" },
    }));
    const response = await pending;
    if (response.headers.get("set-cookie")) cookieJar = "synthetic-expired";
    expect(cookieJar).toBe("synthetic-new-oauth-login");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toEqual({ sessionExpired: true });
  });

  it("keeps ordinary NextAuth session-cookie renewal unchanged", async () => {
    mocks.handler.mockResolvedValue(new Response("{}", { headers: { "set-cookie": "next-auth.session-token=synthetic-active; Path=/" } }));
    const response = await GET(new NextRequest("http://localhost/api/auth/session"), context);
    expect(response.headers.get("set-cookie")).toContain("synthetic-active");
  });

  it("prevents a delayed expiry logout response from deleting a newer OAuth cookie", async () => {
    mocks.getToken.mockResolvedValue({ authSessionExpired: true });
    mocks.handler.mockResolvedValue(new Response(JSON.stringify({ url: "http://localhost/my" }), {
      headers: { "set-cookie": "next-auth.session-token=; Max-Age=0; Path=/" },
    }));
    const request = new NextRequest("http://localhost/api/auth/signout", { method: "POST",
      body: new URLSearchParams({ expireOnly: "true", csrfToken: "synthetic-csrf", json: "true" }) });
    const response = await POST(request, context);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
