import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  deleteRows: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({ from: mocks.from }),
}));

import { withdrawUser } from "./withdrawalService";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("withdrawUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ delete: mocks.deleteRows });
    mocks.deleteRows.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ maybeSingle: mocks.maybeSingle });
  });

  it("deletes only the server-selected user and reports success", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { id: USER_ID },
      error: null,
    });

    await expect(withdrawUser(USER_ID)).resolves.toBe("deleted");
    expect(mocks.from).toHaveBeenCalledWith("users");
    expect(mocks.eq).toHaveBeenCalledWith("id", USER_ID);
    expect(mocks.select).toHaveBeenCalledWith("id");
  });

  it("reports a user that was already absent without pretending to delete it", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(withdrawUser(USER_ID)).resolves.toBe("not_found");
  });

  it("does not expose private database error details", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: null,
      error: { code: "08006", message: "private database detail" },
    });

    await expect(withdrawUser(USER_ID)).rejects.toMatchObject({
      message: "WITHDRAWAL_DELETE_FAILED",
    });
  });
});
