import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getPostDetail: vi.fn(),
  updatePost: vi.fn(),
  deletePost: vi.fn(),
  enforceRateLimit: vi.fn(),
  getRequestIp: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/app/lib/auth/options", () => ({ authOptions: {} }));
vi.mock("@/app/lib/posts/service", () => ({
  getPostDetail: mocks.getPostDetail,
  updatePost: mocks.updatePost,
  deletePost: mocks.deletePost,
}));
vi.mock("@/app/lib/security/rateLimit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  getRequestIp: mocks.getRequestIp,
}));

import { DELETE, GET, PATCH } from "./route";

const POST_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REGION_ID = "11111111-1111-4111-8111-111111111111";
const CATEGORY_ID = "22222222-2222-4222-8222-222222222222";
const UPDATED_AT = "2026-09-07T12:00:00.000Z";
const context = { params: Promise.resolve({ postId: POST_ID }) };

function reviewBody() {
  return {
    storeName: "냉면과고기집",
    menuName: "물냉면",
    regionId: REGION_ID,
    categoryId: CATEGORY_ID,
    goodPoints: ["tasty"],
    badPoints: ["long_wait_time"],
    overallReview: null,
    updatedAt: UPDATED_AT,
  };
}

describe("GET /api/posts/[postId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRequestIp.mockReturnValue("request-ip");
    mocks.enforceRateLimit.mockResolvedValue(null);
    mocks.getServerSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.getPostDetail.mockResolvedValue({ id: POST_ID });
  });

  it("returns the shared rate limit response before storage access", async () => {
    mocks.enforceRateLimit.mockResolvedValue(
      Response.json({ success: false, code: "RATE_LIMIT_EXCEEDED" }, { status: 429 }),
    );

    const response = await GET(
      new Request(`http://localhost/api/posts/${POST_ID}`),
      context,
    );

    expect(response.status).toBe(429);
    expect(mocks.getPostDetail).not.toHaveBeenCalled();
  });

  it("rejects an invalid review id before session and storage access", async () => {
    const response = await GET(new Request("http://localhost/api/posts/invalid"), {
      params: Promise.resolve({ postId: "invalid" }),
    });

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("INVALID_POST_ID");
    expect(mocks.getServerSession).not.toHaveBeenCalled();
    expect(mocks.getPostDetail).not.toHaveBeenCalled();
  });

  it("passes the authenticated user to the detail service", async () => {
    const response = await GET(
      new Request(`http://localhost/api/posts/${POST_ID}`),
      context,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      data: { post: { id: POST_ID } },
    });
    expect(mocks.getPostDetail).toHaveBeenCalledWith(POST_ID, USER_ID);
  });

  it("maps a missing review to the public 404 contract", async () => {
    mocks.getPostDetail.mockResolvedValue(null);

    const response = await GET(
      new Request(`http://localhost/api/posts/${POST_ID}`),
      context,
    );

    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("POST_NOT_FOUND");
  });
});

describe("PATCH /api/posts/[postId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.enforceRateLimit.mockResolvedValue(null);
    mocks.updatePost.mockResolvedValue({
      status: "ok",
      post: { id: POST_ID, updatedAt: "2026-09-07T12:01:00.000Z" },
    });
  });

  it("returns a non-cacheable response for an unauthenticated request", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const response = await PATCH(
      new Request(`http://localhost/api/posts/${POST_ID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewBody()),
      }),
      context,
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await response.json()).code).toBe("UNAUTHORIZED");
    expect(mocks.updatePost).not.toHaveBeenCalled();
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
  });

  it("returns 409 when another edit won the optimistic lock", async () => {
    mocks.updatePost.mockResolvedValue({ status: "conflict" });
    const response = await PATCH(
      new Request(`http://localhost/api/posts/${POST_ID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewBody()),
      }),
      context,
    );

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("REVIEW_CONFLICT");
  });

  it("returns a non-cacheable response when a user does not own the review", async () => {
    mocks.updatePost.mockResolvedValue({ status: "forbidden" });
    const response = await PATCH(
      new Request(`http://localhost/api/posts/${POST_ID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewBody()),
      }),
      context,
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await response.json()).code).toBe("FORBIDDEN");
  });

  it("updates a valid owned review with the expected timestamp", async () => {
    const response = await PATCH(
      new Request(`http://localhost/api/posts/${POST_ID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewBody()),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(mocks.updatePost).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: POST_ID,
        userId: USER_ID,
        expectedUpdatedAt: UPDATED_AT,
      }),
    );
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      identifier: USER_ID,
      policy: "reviewManage",
    });
  });
});

describe("DELETE /api/posts/[postId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.enforceRateLimit.mockResolvedValue(null);
    mocks.deletePost.mockResolvedValue({ status: "ok" });
  });

  it("rejects a user who does not own the review", async () => {
    mocks.deletePost.mockResolvedValue({ status: "forbidden" });
    const response = await DELETE(
      new Request(`http://localhost/api/posts/${POST_ID}`, { method: "DELETE" }),
      context,
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      code: "FORBIDDEN",
      message: "해당 리뷰는 삭제할 수 없습니다.",
    });
  });

  it("rejects an unauthenticated request before the service call", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const response = await DELETE(
      new Request(`http://localhost/api/posts/${POST_ID}`, { method: "DELETE" }),
      context,
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.deletePost).not.toHaveBeenCalled();
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
  });
});
