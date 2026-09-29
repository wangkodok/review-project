import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("passes the existing Google client ID to the GIS withdrawal screen", async () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "public-google-client-id");
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

    const result = (await MyWithdrawPage()) as ReactElement<{
      authProvider: string;
      googleClientId?: string;
      googleLoginHint: string;
    }>;

    expect(result.type).toBe(WithdrawalConsentScreen);
    expect(result.props).toMatchObject({
      authProvider: "google",
      googleClientId: "public-google-client-id",
      googleLoginHint: "private@example.com",
    });
  });
});
