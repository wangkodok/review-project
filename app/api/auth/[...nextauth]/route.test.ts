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
});
