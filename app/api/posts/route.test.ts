import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getActiveCategoryBySlug: vi.fn(),
  getActiveRegionBySlug: vi.fn(),
  createPost: vi.fn(),
  getPosts: vi.fn(),
  enforceRateLimit: vi.fn(),
  getRequestIp: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/app/lib/auth/options", () => ({ authOptions: {} }));
vi.mock("@/app/lib/categories/service", () => ({
  getActiveCategoryBySlug: mocks.getActiveCategoryBySlug,
}));
vi.mock("@/app/lib/regions/service", () => ({
  getActiveRegionBySlug: mocks.getActiveRegionBySlug,
}));
vi.mock("@/app/lib/posts/service", () => ({
  createPost: mocks.createPost,
  getPosts: mocks.getPosts,
}));
vi.mock("@/app/lib/security/rateLimit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  getRequestIp: mocks.getRequestIp,
}));

import { GET, POST } from "./route";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REGION_ID = "11111111-1111-4111-8111-111111111111";
const CATEGORY_ID = "22222222-2222-4222-8222-222222222222";

function reviewBody(overrides: Record<string, unknown> = {}) {
  return {
    storeName: "냉면과고기집",
    menuName: "물냉면",
    regionId: REGION_ID,
    categoryId: CATEGORY_ID,
    goodPoints: ["tasty"],
    badPoints: ["long_wait_time"],
    overallReview: null,
    ...overrides,
  };
}

function postRequest(body: BodyInit) {
  return new Request("http://localhost/api/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("POST /api/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.enforceRateLimit.mockResolvedValue(null);
    mocks.createPost.mockResolvedValue({ status: "ok", post: { id: "post-id" } });
  });

  it("rejects an unauthenticated request before reading its body", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const response = await POST(postRequest(JSON.stringify(reviewBody())));

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await response.json()).code).toBe("UNAUTHORIZED");
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.createPost).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await POST(postRequest("{"));

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await response.json()).code).toBe("INVALID_REQUEST");
    expect(mocks.createPost).not.toHaveBeenCalled();
  });

  it("returns a non-cacheable 400 response for invalid review input", async () => {
    const response = await POST(postRequest(JSON.stringify({})));

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await response.json()).code).toBe("INVALID_STORE_NAME");
    expect(mocks.createPost).not.toHaveBeenCalled();
  });

  it("rejects a deprecated review option", async () => {
    const response = await POST(
      postRequest(JSON.stringify(reviewBody({ badPoints: ["slow_cooking_time"] }))),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await response.json()).code).toBe("INVALID_BAD_POINTS");
    expect(mocks.createPost).not.toHaveBeenCalled();
  });

  it("derives compatibility fields and creates a valid review", async () => {
    const response = await POST(postRequest(JSON.stringify(reviewBody())));

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      success: true,
      data: { post: { id: "post-id" } },
      message: "리뷰가 저장되었습니다.",
    });
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      identifier: USER_ID,
      policy: "reviewCreate",
    });
    expect(mocks.createPost).toHaveBeenCalledWith({
      userId: USER_ID,
      storeName: "냉면과고기집",
      regionId: REGION_ID,
      title: "물냉면",
      content: "좋았던 점: 맛있어요\n아쉬웠던 점: 대기 시간",
      categoryId: CATEGORY_ID,
      menuName: "물냉면",
      goodPoints: ["tasty"],
      badPoints: ["long_wait_time"],
      overallReview: null,
    });
  });
});

describe("GET /api/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRequestIp.mockReturnValue("request-ip");
    mocks.enforceRateLimit.mockResolvedValue(null);
    mocks.getServerSession.mockResolvedValue(null);
    mocks.getActiveCategoryBySlug.mockResolvedValue({ id: CATEGORY_ID });
    mocks.getActiveRegionBySlug.mockResolvedValue({ id: REGION_ID });
    mocks.getPosts.mockResolvedValue({ posts: [], page: 1, limit: 10, totalCount: 0, hasMore: false });
  });

  it("passes region, category, and sort filters to the service", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/posts?page=1&limit=10&region=seoul&category=korean&sort=likes",
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.getPosts).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      search: "",
      sort: "likes",
      currentUserId: undefined,
      categoryId: CATEGORY_ID,
      regionId: REGION_ID,
    });
  });

  it("rejects an unknown sort value", async () => {
    const response = await GET(new Request("http://localhost/api/posts?sort=random"));

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("INVALID_SORT");
    expect(mocks.getPosts).not.toHaveBeenCalled();
  });
});
