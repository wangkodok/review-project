import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getActiveCategoryBySlug: vi.fn(),
  getActiveRegionBySlug: vi.fn(),
  normalizeSearchKeyword: vi.fn(),
  searchPosts: vi.fn(),
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
vi.mock("@/app/lib/search/service", () => ({
  normalizeSearchKeyword: mocks.normalizeSearchKeyword,
  searchPosts: mocks.searchPosts,
}));
vi.mock("@/app/lib/security/rateLimit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  getRequestIp: mocks.getRequestIp,
}));

import { GET } from "./route";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CATEGORY_ID = "22222222-2222-4222-8222-222222222222";
const REGION_ID = "11111111-1111-4111-8111-111111111111";

describe("GET /api/search/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRequestIp.mockReturnValue("request-ip");
    mocks.enforceRateLimit.mockResolvedValue(null);
    mocks.normalizeSearchKeyword.mockReturnValue("라면");
    mocks.getActiveCategoryBySlug.mockResolvedValue({ id: CATEGORY_ID });
    mocks.getActiveRegionBySlug.mockResolvedValue({ id: REGION_ID });
    mocks.getServerSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.searchPosts.mockResolvedValue({
      posts: [],
      page: 1,
      limit: 10,
      totalCount: 0,
      hasMore: false,
    });
  });

  it("returns the shared rate limit response before input validation", async () => {
    mocks.enforceRateLimit.mockResolvedValue(
      Response.json({ success: false, code: "RATE_LIMIT_EXCEEDED" }, { status: 429 }),
    );

    const response = await GET(new Request("http://localhost/api/search/posts"));

    expect(response.status).toBe(429);
    expect(mocks.normalizeSearchKeyword).not.toHaveBeenCalled();
    expect(mocks.searchPosts).not.toHaveBeenCalled();
  });

  it("rejects an invalid search keyword", async () => {
    mocks.normalizeSearchKeyword.mockReturnValue(null);

    const response = await GET(new Request("http://localhost/api/search/posts?q="));

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("INVALID_SEARCH_KEYWORD");
    expect(mocks.searchPosts).not.toHaveBeenCalled();
  });

  it.each([
    ["page=0", "INVALID_PAGINATION"],
    ["limit=21", "INVALID_PAGINATION"],
    ["sort=random", "INVALID_SORT"],
  ])("rejects invalid query %s", async (query, code) => {
    const response = await GET(
      new Request(`http://localhost/api/search/posts?q=라면&${query}`),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe(code);
    expect(mocks.searchPosts).not.toHaveBeenCalled();
  });

  it("rejects an inactive category", async () => {
    mocks.getActiveCategoryBySlug.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/search/posts?q=라면&category=inactive"),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("INVALID_CATEGORY");
    expect(mocks.searchPosts).not.toHaveBeenCalled();
  });

  it("forwards normalized filters and the optional session user", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/search/posts?q=라면&page=2&limit=5&sort=views&category=korean&region=seoul",
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      identifier: "request-ip",
      policy: "search",
    });
    expect(mocks.searchPosts).toHaveBeenCalledWith({
      keyword: "라면",
      page: 2,
      limit: 5,
      currentUserId: USER_ID,
      sort: "views",
      categoryId: CATEGORY_ID,
      regionId: REGION_ID,
    });
  });

  it("does not expose an internal search error", async () => {
    mocks.searchPosts.mockRejectedValue(new Error("private database detail"));

    const response = await GET(
      new Request("http://localhost/api/search/posts?q=라면"),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_SERVER_ERROR");
    expect(JSON.stringify(body)).not.toContain("private database detail");
  });
});
