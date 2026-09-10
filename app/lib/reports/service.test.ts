import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({ from: mocks.from }),
}));

import { createReviewReport } from "./service";

const POST_ID = "33333333-3333-4333-8333-333333333333";
const REPORTER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AUTHOR_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("createReviewReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.maybeSingle.mockResolvedValue({
      data: { id: POST_ID, user_id: AUTHOR_ID },
      error: null,
    });
    mocks.insert.mockResolvedValue({ data: null, error: null });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockImplementation((table: string) => {
      if (table === "posts") {
        return { select: mocks.select };
      }

      if (table === "review_reports") {
        return { insert: mocks.insert };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("inserts a report without selecting or returning the stored row", async () => {
    const result = await createReviewReport({
      postId: POST_ID,
      reporterUserId: REPORTER_ID,
      reason: "other",
      detail: "구체적인 신고 내용",
    });

    expect(result).toEqual({ status: "ok" });
    expect(mocks.select).toHaveBeenCalledWith("id,user_id");
    expect(mocks.eq).toHaveBeenCalledWith("id", POST_ID);
    expect(mocks.insert).toHaveBeenCalledWith({
      post_id: POST_ID,
      reporter_user_id: REPORTER_ID,
      reason: "other",
      detail: "구체적인 신고 내용",
    });
  });

  it("rejects a report for a missing review", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(
      createReviewReport({
        postId: POST_ID,
        reporterUserId: REPORTER_ID,
        reason: "off_topic",
        detail: null,
      }),
    ).resolves.toEqual({ status: "not_found" });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects a self report before inserting", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { id: POST_ID, user_id: REPORTER_ID },
      error: null,
    });

    await expect(
      createReviewReport({
        postId: POST_ID,
        reporterUserId: REPORTER_ID,
        reason: "off_topic",
        detail: null,
      }),
    ).resolves.toEqual({ status: "self_report" });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("maps a unique violation to duplicate", async () => {
    mocks.insert.mockResolvedValue({ data: null, error: { code: "23505" } });

    await expect(
      createReviewReport({
        postId: POST_ID,
        reporterUserId: REPORTER_ID,
        reason: "off_topic",
        detail: null,
      }),
    ).resolves.toEqual({ status: "duplicate" });
  });

  it("maps a foreign key race to a missing review", async () => {
    mocks.insert.mockResolvedValue({ data: null, error: { code: "23503" } });

    await expect(
      createReviewReport({
        postId: POST_ID,
        reporterUserId: REPORTER_ID,
        reason: "off_topic",
        detail: null,
      }),
    ).resolves.toEqual({ status: "not_found" });
  });

  it("does not expose private database errors", async () => {
    mocks.insert.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "private database detail" },
    });

    await expect(
      createReviewReport({
        postId: POST_ID,
        reporterUserId: REPORTER_ID,
        reason: "off_topic",
        detail: null,
      }),
    ).rejects.toThrow("REPORT_STORAGE_FAILED");
  });
});
