import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  togglePostLike: vi.fn(),
  enforceRateLimit: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/app/lib/auth/options", () => ({ authOptions: {} }));
vi.mock("@/app/lib/posts/likes", () => ({ togglePostLike: mocks.togglePostLike }));
vi.mock("@/app/lib/security/rateLimit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));

import { POST } from "./route";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const POST_ID = "33333333-3333-4333-8333-333333333333";
const context = { params: Promise.resolve({ postId: POST_ID }) };

describe("POST /api/posts/[postId]/like", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.enforceRateLimit.mockResolvedValue(null);
    mocks.togglePostLike.mockResolvedValue({ liked: true, likeCount: 2 });
  });

  it("rejects an unauthenticated request before rate limiting and storage", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const response = await POST(
      new Request(`http://localhost/api/posts/${POST_ID}/like`, { method: "POST" }),
      context,
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).code).toBe("UNAUTHORIZED");
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.togglePostLike).not.toHaveBeenCalled();
  });

  it("returns the shared rate limit response before storage", async () => {
    mocks.enforceRateLimit.mockResolvedValue(
      Response.json(
        { success: false, code: "RATE_LIMIT_EXCEEDED" },
        { status: 429, headers: { "Cache-Control": "no-store" } },
      ),
    );

    const response = await POST(
      new Request(`http://localhost/api/posts/${POST_ID}/like`, { method: "POST" }),
      context,
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.togglePostLike).not.toHaveBeenCalled();
  });

  it("maps a missing review to 404", async () => {
    mocks.togglePostLike.mockResolvedValue(null);

    const response = await POST(
      new Request(`http://localhost/api/posts/${POST_ID}/like`, { method: "POST" }),
      context,
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).code).toBe("POST_NOT_FOUND");
  });

  it("returns the atomic like result", async () => {
    const response = await POST(
      new Request(`http://localhost/api/posts/${POST_ID}/like`, { method: "POST" }),
      context,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      success: true,
      data: { liked: true, likeCount: 2 },
    });
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      identifier: `user:${USER_ID}`,
      policy: "like",
    });
    expect(mocks.togglePostLike).toHaveBeenCalledWith({
      postId: POST_ID,
      userId: USER_ID,
    });
  });

  it("does not expose an internal storage error", async () => {
    mocks.togglePostLike.mockRejectedValue(new Error("private database detail"));

    const response = await POST(
      new Request(`http://localhost/api/posts/${POST_ID}/like`, { method: "POST" }),
      context,
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.code).toBe("INTERNAL_SERVER_ERROR");
    expect(JSON.stringify(body)).not.toContain("private database detail");
  });
});
