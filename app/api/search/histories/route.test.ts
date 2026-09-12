import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  clearSearchHistories: vi.fn(),
  getSearchHistories: vi.fn(),
  recordSearchHistory: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/app/lib/auth/options", () => ({ authOptions: {} }));
vi.mock("@/app/lib/search/histories", () => ({
  clearSearchHistories: mocks.clearSearchHistories,
  getSearchHistories: mocks.getSearchHistories,
  recordSearchHistory: mocks.recordSearchHistory,
}));

import { DELETE, GET, POST } from "./route";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function postRequest(body: unknown) {
  return new Request("http://localhost/api/search/histories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("/api/search/histories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.getSearchHistories.mockResolvedValue([
      { id: "history-id", keyword: "라면" },
    ]);
    mocks.recordSearchHistory.mockResolvedValue({ status: "ok" });
    mocks.clearSearchHistories.mockResolvedValue(undefined);
  });

  it.each([
    ["GET", () => GET()],
    ["POST", () => POST(postRequest({ keyword: "라면" }))],
    ["DELETE", () => DELETE()],
  ])("rejects unauthenticated %s before storage access", async (_method, call) => {
    mocks.getServerSession.mockResolvedValue(null);

    const response = await call();

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await response.json()).code).toBe("UNAUTHORIZED");
    expect(mocks.getSearchHistories).not.toHaveBeenCalled();
    expect(mocks.recordSearchHistory).not.toHaveBeenCalled();
    expect(mocks.clearSearchHistories).not.toHaveBeenCalled();
  });

  it("returns histories scoped to the session user", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({
      success: true,
      data: { histories: [{ id: "history-id", keyword: "라면" }] },
    });
    expect(mocks.getSearchHistories).toHaveBeenCalledWith(USER_ID);
  });

  it("maps an invalid keyword to 400", async () => {
    mocks.recordSearchHistory.mockResolvedValue({ status: "invalid_keyword" });

    const response = await POST(postRequest({ keyword: "" }));

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await response.json()).code).toBe("INVALID_SEARCH_KEYWORD");
  });

  it("stores a recent keyword for the session user", async () => {
    const response = await POST(postRequest({ keyword: " 라면 " }));

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.recordSearchHistory).toHaveBeenCalledWith(USER_ID, " 라면 ");
  });

  it("clears only the session user's histories", async () => {
    const response = await DELETE();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.clearSearchHistories).toHaveBeenCalledWith(USER_ID);
  });

  it("does not expose an internal history error", async () => {
    mocks.getSearchHistories.mockRejectedValue(new Error("private database detail"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(body.code).toBe("INTERNAL_SERVER_ERROR");
    expect(JSON.stringify(body)).not.toContain("private database detail");
  });
});
