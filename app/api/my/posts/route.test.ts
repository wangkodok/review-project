import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getMyPosts: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/app/lib/auth/options", () => ({ authOptions: {} }));
vi.mock("@/app/lib/posts/service", () => ({ getMyPosts: mocks.getMyPosts }));

import { GET } from "./route";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("GET /api/my/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.getMyPosts.mockResolvedValue({
      posts: [],
      page: 1,
      limit: 10,
      totalCount: 0,
      hasMore: false,
    });
  });

  it("rejects an unauthenticated request before storage access", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/my/posts"));

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await response.json()).code).toBe("UNAUTHORIZED");
    expect(mocks.getMyPosts).not.toHaveBeenCalled();
  });

  it("rejects pagination outside the documented bounds", async () => {
    const response = await GET(
      new Request("http://localhost/api/my/posts?page=0&limit=51"),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await response.json()).code).toBe("INVALID_PAGINATION");
    expect(mocks.getMyPosts).not.toHaveBeenCalled();
  });

  it("uses defaults and scopes the query to the session user", async () => {
    const response = await GET(new Request("http://localhost/api/my/posts"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.getMyPosts).toHaveBeenCalledWith({
      userId: USER_ID,
      page: 1,
      limit: 10,
    });
  });

  it("returns a generic error without exposing a storage detail", async () => {
    mocks.getMyPosts.mockRejectedValue(new Error("private database detail"));

    const response = await GET(new Request("http://localhost/api/my/posts"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(body.code).toBe("INTERNAL_SERVER_ERROR");
    expect(JSON.stringify(body)).not.toContain("private database detail");
  });
});
