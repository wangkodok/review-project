import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  class WithdrawalReauthStoreUnavailableError extends Error {}

  return {
    getToken: vi.fn(),
    unlinkExternalProviderAccount: vi.fn(),
    expireCurrentAuthSessionCookies: vi.fn(),
    getActiveExternalAuthAccount: vi.fn(),
    beginWithdrawalFinalization: vi.fn(),
    deleteWithdrawalReauthState: vi.fn(),
    markWithdrawalProviderRevoked: vi.fn(),
    releaseWithdrawalFinalization: vi.fn(),
    WithdrawalReauthStoreUnavailableError,
    expireWithdrawalReauthCookies: vi.fn(),
    getWithdrawalReauthCsrfCookie: vi.fn(),
    getWithdrawalReauthFlowCookie: vi.fn(),
    withdrawUser: vi.fn(),
    enforceRateLimit: vi.fn(),
    getRequestIp: vi.fn(),
    recordSecurityEvent: vi.fn(),
  };
});

vi.mock("next-auth/jwt", () => ({ getToken: mocks.getToken }));
vi.mock("@/app/lib/auth/options", () => ({ authSecret: "test-secret" }));
vi.mock("@/app/lib/auth/providerOAuth", () => ({
  unlinkExternalProviderAccount: mocks.unlinkExternalProviderAccount,
}));
vi.mock("@/app/lib/auth/sessionSecurity", () => ({
  expireCurrentAuthSessionCookies: mocks.expireCurrentAuthSessionCookies,
  getActiveExternalAuthAccount: mocks.getActiveExternalAuthAccount,
}));
vi.mock("@/app/lib/auth/withdrawalReauth", () => ({
  beginWithdrawalFinalization: mocks.beginWithdrawalFinalization,
  deleteWithdrawalReauthState: mocks.deleteWithdrawalReauthState,
  markWithdrawalProviderRevoked: mocks.markWithdrawalProviderRevoked,
  releaseWithdrawalFinalization: mocks.releaseWithdrawalFinalization,
  WithdrawalReauthStoreUnavailableError:
    mocks.WithdrawalReauthStoreUnavailableError,
}));
vi.mock("@/app/lib/auth/withdrawalReauthCookies", () => ({
  expireWithdrawalReauthCookies: mocks.expireWithdrawalReauthCookies,
  getWithdrawalReauthCsrfCookie: mocks.getWithdrawalReauthCsrfCookie,
  getWithdrawalReauthFlowCookie: mocks.getWithdrawalReauthFlowCookie,
}));
vi.mock("@/app/lib/profile/service", () => ({ withdrawUser: mocks.withdrawUser }));
vi.mock("@/app/lib/security/rateLimit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  getRequestIp: mocks.getRequestIp,
}));
vi.mock("@/app/lib/security/securityEvent", () => ({
  recordSecurityEvent: mocks.recordSecurityEvent,
}));

import { DELETE } from "./route";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const account = {
  userId: USER_ID,
  provider: "kakao" as const,
  providerAccountId: "provider-account-id",
};

function request({
  origin = "http://localhost",
  consent = true,
}: { origin?: string; consent?: boolean } = {}) {
  return new NextRequest("http://localhost/api/withdraw", {
    method: "DELETE",
    headers: {
      origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ consent }),
  });
}

describe("DELETE /api/withdraw", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getToken.mockResolvedValue({
      userId: USER_ID,
      authProvider: "kakao",
      withdrawalFlowId: "flow-id",
      withdrawalReauthenticatedAt: 1_789_162_200_000,
      providerAccessToken: "provider-access-token",
      providerAccessTokenExpiresAt: Date.now() + 60_000,
    });
    mocks.getActiveExternalAuthAccount.mockResolvedValue(account);
    mocks.getWithdrawalReauthFlowCookie.mockReturnValue("flow-id");
    mocks.getWithdrawalReauthCsrfCookie.mockReturnValue("csrf-nonce");
    mocks.enforceRateLimit.mockResolvedValue(null);
    mocks.getRequestIp.mockReturnValue("request-ip");
    mocks.beginWithdrawalFinalization.mockResolvedValue("processing_started");
    mocks.unlinkExternalProviderAccount.mockResolvedValue("unlinked");
    mocks.markWithdrawalProviderRevoked.mockResolvedValue("marked");
    mocks.withdrawUser.mockResolvedValue(undefined);
    mocks.deleteWithdrawalReauthState.mockResolvedValue(undefined);
    mocks.releaseWithdrawalFinalization.mockResolvedValue("released");
  });

  it("rejects an unauthenticated request before account access", async () => {
    mocks.getToken.mockResolvedValue(null);

    const response = await DELETE(request());

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await response.json()).code).toBe("UNAUTHORIZED");
    expect(mocks.getActiveExternalAuthAccount).not.toHaveBeenCalled();
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.expireCurrentAuthSessionCookies).toHaveBeenCalled();
  });

  it("rejects a cross-origin request before rate limiting", async () => {
    const response = await DELETE(request({ origin: "https://example.com" }));

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("INVALID_ORIGIN");
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
  });

  it("returns the shared rate limit response before reading consent", async () => {
    mocks.enforceRateLimit.mockResolvedValue(
      Response.json({ success: false, code: "RATE_LIMIT_EXCEEDED" }, { status: 429 }),
    );

    const response = await DELETE(request());

    expect(response.status).toBe(429);
    expect(mocks.beginWithdrawalFinalization).not.toHaveBeenCalled();
  });

  it("requires explicit final consent", async () => {
    const response = await DELETE(request({ consent: false }));

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("WITHDRAWAL_CONSENT_REQUIRED");
    expect(mocks.beginWithdrawalFinalization).not.toHaveBeenCalled();
  });

  it("requires a matching verified flow before finalization", async () => {
    mocks.getWithdrawalReauthFlowCookie.mockReturnValue(null);

    const response = await DELETE(request());

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("WITHDRAWAL_REAUTH_REQUIRED");
    expect(mocks.beginWithdrawalFinalization).not.toHaveBeenCalled();
    expect(mocks.expireWithdrawalReauthCookies).toHaveBeenCalled();
  });

  it("unlinks the provider and deletes only the authenticated account", async () => {
    const response = await DELETE(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      success: true,
      data: null,
    });
    expect(mocks.beginWithdrawalFinalization).toHaveBeenCalledWith({
      flowId: "flow-id",
      userId: USER_ID,
      provider: "kakao",
      providerAccountId: "provider-account-id",
      csrfNonce: "csrf-nonce",
      verifiedAt: 1_789_162_200_000,
    });
    expect(mocks.unlinkExternalProviderAccount).toHaveBeenCalledWith({
      provider: "kakao",
      accessToken: "provider-access-token",
      providerAccountId: "provider-account-id",
    });
    expect(mocks.markWithdrawalProviderRevoked).toHaveBeenCalled();
    expect(mocks.withdrawUser).toHaveBeenCalledWith(USER_ID);
    expect(mocks.deleteWithdrawalReauthState).toHaveBeenCalledWith("flow-id");
    expect(mocks.expireCurrentAuthSessionCookies).toHaveBeenCalled();
    expect(mocks.expireWithdrawalReauthCookies).toHaveBeenCalled();
  });

  it("releases finalization when provider unlink fails", async () => {
    mocks.unlinkExternalProviderAccount.mockResolvedValue("failed");

    const response = await DELETE(request());

    expect(response.status).toBe(502);
    expect((await response.json()).code).toBe("PROVIDER_UNLINK_FAILED");
    expect(mocks.releaseWithdrawalFinalization).toHaveBeenCalledWith({
      flowId: "flow-id",
      userId: USER_ID,
      provider: "kakao",
      providerAccountId: "provider-account-id",
    });
    expect(mocks.withdrawUser).not.toHaveBeenCalled();
  });

  it("records a safe event when database deletion fails", async () => {
    mocks.withdrawUser.mockRejectedValue(new Error("private database detail"));

    const response = await DELETE(request());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("WITHDRAWAL_DELETE_FAILED");
    expect(JSON.stringify(body)).not.toContain("private database detail");
    expect(mocks.recordSecurityEvent).toHaveBeenCalledWith({
      eventCode: "withdrawal_database_delete_failed",
      provider: "kakao",
    });
    expect(mocks.deleteWithdrawalReauthState).not.toHaveBeenCalled();
  });
});
