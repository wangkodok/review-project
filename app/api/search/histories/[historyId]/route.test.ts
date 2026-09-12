import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  deleteSearchHistory: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/app/lib/auth/options", () => ({ authOptions: {} }));
vi.mock("@/app/lib/search/histories", () => ({
  deleteSearchHistory: mocks.deleteSearchHistory,
}));

import { DELETE } from "./route";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const HISTORY_ID = "history-id";
const context = { params: Promise.resolve({ historyId: HISTORY_ID }) };

describe("DELETE /api/search/histories/[historyId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.deleteSearchHistory.mockResolvedValue({ status: "ok" });
  });

  it("rejects an unauthenticated request before resolving storage", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost/api/search/histories/history-id", {
        method: "DELETE",
      }),
      context,
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await response.json()).code).toBe("UNAUTHORIZED");
    expect(mocks.deleteSearchHistory).not.toHaveBeenCalled();
  });

  it("scopes deletion to both the session user and history id", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/search/histories/history-id", {
        method: "DELETE",
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.deleteSearchHistory).toHaveBeenCalledWith(USER_ID, HISTORY_ID);
  });

  it("maps a missing or non-owned history to 404", async () => {
    mocks.deleteSearchHistory.mockResolvedValue({ status: "not_found" });

    const response = await DELETE(
      new Request("http://localhost/api/search/histories/history-id", {
        method: "DELETE",
      }),
      context,
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await response.json()).code).toBe("SEARCH_HISTORY_NOT_FOUND");
  });

  it("does not expose an internal deletion error", async () => {
    mocks.deleteSearchHistory.mockRejectedValue(new Error("private database detail"));

    const response = await DELETE(
      new Request("http://localhost/api/search/histories/history-id", {
        method: "DELETE",
      }),
      context,
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(body.code).toBe("INTERNAL_SERVER_ERROR");
    expect(JSON.stringify(body)).not.toContain("private database detail");
  });
});
