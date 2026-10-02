import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  userSelect: vi.fn(),
  userEq: vi.fn(),
  userSingle: vi.fn(),
  activitySelect: vi.fn(),
  activityEq: vi.fn(),
  activityReturns: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../supabase/server", () => ({
  createSupabaseServerClient: () => ({ from: mocks.from }),
}));

import { getProfileSummary } from "./service";

describe("getProfileSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const userQuery = {
      select: mocks.userSelect,
      eq: mocks.userEq,
      single: mocks.userSingle,
    };
    const activityQuery = {
      select: mocks.activitySelect,
      eq: mocks.activityEq,
      returns: mocks.activityReturns,
    };

    mocks.from.mockImplementation((table: string) =>
      table === "users" ? userQuery : activityQuery,
    );
    mocks.userSelect.mockReturnValue(userQuery);
    mocks.userEq.mockReturnValue(userQuery);
    mocks.userSingle.mockResolvedValue({
      data: { anonymous_id: "익명F19dF1", nickname: "리뷰어" },
      error: null,
    });
    mocks.activitySelect.mockReturnValue(activityQuery);
    mocks.activityEq.mockReturnValue(activityQuery);
    mocks.activityReturns.mockResolvedValue({
      data: [{ like_count: 12, view_count: 34 }],
      error: null,
      count: 1,
    });
  });

  it("reads only the identity fields needed by the community menu", async () => {
    await expect(getProfileSummary("user-id")).resolves.toEqual({
      anonymousId: "익명F19dF1",
      nickname: "리뷰어",
      activitySummary: { totalLikes: 12, totalViews: 34, postCount: 1 },
    });

    expect(mocks.userSelect).toHaveBeenCalledWith("anonymous_id,nickname");
  });
});
