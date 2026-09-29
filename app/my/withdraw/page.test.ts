import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/app/lib/auth/options", () => ({
  authOptions: {},
}));

vi.mock("@/app/lib/auth/sessionSecurity", () => ({
  getWithdrawalExternalAuthAccount: vi.fn(),
}));

import { getServerSession } from "next-auth";
import WithdrawalConsentScreen from "@/app/components/profile/WithdrawalConsentScreen";
import { getWithdrawalExternalAuthAccount } from "@/app/lib/auth/sessionSecurity";
import MyWithdrawPage from "./page";

describe("MyWithdrawPage", () => {
  it("does not expose Google provider data to the withdrawal screen", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: {
        id: "user-id",
        authProvider: "google",
      },
      expires: "2099-01-01T00:00:00.000Z",
    });
    vi.mocked(getWithdrawalExternalAuthAccount).mockResolvedValue({
      userId: "user-id",
      provider: "google",
      providerAccountId: "provider-account-id",
      providerEmail: "private@example.com",
    });

    const result = (await MyWithdrawPage()) as ReactElement<Record<string, never>>;

    expect(result.type).toBe(WithdrawalConsentScreen);
    expect(result.props).toEqual({});
    expect(getWithdrawalExternalAuthAccount).not.toHaveBeenCalled();
  });
});
