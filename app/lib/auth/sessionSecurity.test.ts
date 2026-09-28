import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eqUser: vi.fn(),
  eqProvider: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({ from: mocks.from }),
}));

import {
  getActiveExternalAuthAccount,
  getWithdrawalExternalAuthAccount,
} from "./sessionSecurity";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("getActiveExternalAuthAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ eq: mocks.eqUser });
    mocks.eqUser.mockReturnValue({ eq: mocks.eqProvider });
    mocks.eqProvider.mockReturnValue({ maybeSingle: mocks.maybeSingle });
  });

  it("keeps routine session validation limited to non-email fields", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        user_id: USER_ID,
        provider_account_id: "provider-account-id",
      },
      error: null,
    });

    await expect(
      getActiveExternalAuthAccount({ userId: USER_ID, provider: "google" }),
    ).resolves.toEqual({
      userId: USER_ID,
      provider: "google",
      providerAccountId: "provider-account-id",
    });
    expect(mocks.select).toHaveBeenCalledWith(
      "user_id,provider_account_id",
    );
  });

  it("returns the additional email only for withdrawal processing", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        user_id: USER_ID,
        provider_account_id: "provider-account-id",
        provider_email: "private@example.com",
      },
      error: null,
    });

    await expect(
      getWithdrawalExternalAuthAccount({
        userId: USER_ID,
        provider: "google",
      }),
    ).resolves.toEqual({
      userId: USER_ID,
      provider: "google",
      providerAccountId: "provider-account-id",
      providerEmail: "private@example.com",
    });
    expect(mocks.from).toHaveBeenCalledWith("auth_accounts");
    expect(mocks.select).toHaveBeenCalledWith(
      "user_id,provider_account_id,provider_email",
    );
    expect(mocks.eqUser).toHaveBeenCalledWith("user_id", USER_ID);
    expect(mocks.eqProvider).toHaveBeenCalledWith("provider", "google");
  });

  it("does not select an email for Kakao withdrawal processing", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        user_id: USER_ID,
        provider_account_id: "provider-account-id",
      },
      error: null,
    });

    await expect(
      getWithdrawalExternalAuthAccount({
        userId: USER_ID,
        provider: "kakao",
      }),
    ).resolves.toEqual({
      userId: USER_ID,
      provider: "kakao",
      providerAccountId: "provider-account-id",
      providerEmail: null,
    });
    expect(mocks.select).toHaveBeenCalledWith(
      "user_id,provider_account_id",
    );
  });

  it("returns null when the session account is no longer active", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(
      getActiveExternalAuthAccount({ userId: USER_ID, provider: "kakao" }),
    ).resolves.toBeNull();
  });

  it("does not expose private storage errors", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: null,
      error: { code: "08006", message: "private database detail" },
    });

    await expect(
      getWithdrawalExternalAuthAccount({ userId: USER_ID, provider: "google" }),
    ).rejects.toMatchObject({ message: "AUTH_ACCOUNT_LOOKUP_FAILED" });
  });
});
