import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  class WithdrawalReauthStoreUnavailableError extends Error {}

  return {
    getToken: vi.fn(),
    expireCurrentAuthSessionCookies: vi.fn(),
    getActiveExternalAuthAccount: vi.fn(),
    createWithdrawalReauthState: vi.fn(),
    deleteWithdrawalReauthState: vi.fn(),
    getWithdrawalReauthStateForTarget: vi.fn(),
    withdrawalReauthCsrfMatches: vi.fn(),
    WithdrawalReauthStoreUnavailableError,
    expireWithdrawalReauthCookies: vi.fn(),
    getWithdrawalReauthCsrfCookie: vi.fn(),
    getWithdrawalReauthFlowCookie: vi.fn(),
    setWithdrawalReauthCookies: vi.fn(),
    enforceRateLimit: vi.fn(),
    getRequestIp: vi.fn(),
  };
});

vi.mock("next-auth/jwt", () => ({ getToken: mocks.getToken }));
vi.mock("@/app/lib/auth/options", () => ({ authSecret: "test-secret" }));
vi.mock("@/app/lib/auth/sessionSecurity", () => ({
  expireCurrentAuthSessionCookies: mocks.expireCurrentAuthSessionCookies,
  getActiveExternalAuthAccount: mocks.getActiveExternalAuthAccount,
}));
vi.mock("@/app/lib/auth/withdrawalReauth", () => ({
  createWithdrawalReauthState: mocks.createWithdrawalReauthState,
  deleteWithdrawalReauthState: mocks.deleteWithdrawalReauthState,
  getWithdrawalReauthStateForTarget: mocks.getWithdrawalReauthStateForTarget,
  withdrawalReauthCsrfMatches: mocks.withdrawalReauthCsrfMatches,
  WithdrawalReauthStoreUnavailableError:
    mocks.WithdrawalReauthStoreUnavailableError,
}));
vi.mock("@/app/lib/auth/withdrawalReauthCookies", () => ({
  expireWithdrawalReauthCookies: mocks.expireWithdrawalReauthCookies,
  getWithdrawalReauthCsrfCookie: mocks.getWithdrawalReauthCsrfCookie,
  getWithdrawalReauthFlowCookie: mocks.getWithdrawalReauthFlowCookie,
  setWithdrawalReauthCookies: mocks.setWithdrawalReauthCookies,
}));
vi.mock("@/app/lib/security/rateLimit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  getRequestIp: mocks.getRequestIp,
}));

import { DELETE, GET, POST } from "./route";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const account = {
  userId: USER_ID,
  provider: "kakao" as const,
  providerAccountId: "provider-account-id",
};

function request(method: "GET" | "POST" | "DELETE", origin = "http://localhost") {
  return new NextRequest("http://localhost/api/withdraw/reauth", {
    method,
    headers: { origin },
  });
}

describe("/api/withdraw/reauth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getToken.mockResolvedValue({ userId: USER_ID, authProvider: "kakao" });
    mocks.getActiveExternalAuthAccount.mockResolvedValue(account);
    mocks.enforceRateLimit.mockResolvedValue(null);
    mocks.getRequestIp.mockReturnValue("request-ip");
    mocks.getWithdrawalReauthFlowCookie.mockReturnValue(null);
    mocks.getWithdrawalReauthCsrfCookie.mockReturnValue("csrf-nonce");
    mocks.withdrawalReauthCsrfMatches.mockResolvedValue(true);
    mocks.createWithdrawalReauthState.mockResolvedValue({
      flowId: "flow-id",
      csrfNonce: "csrf-nonce",
      expiresAt: "2026-09-12T01:00:00.000Z",
    });
    mocks.getWithdrawalReauthStateForTarget.mockResolvedValue({
      status: "found",
      state: { status: "pending", expiresAt: "2026-09-12T01:00:00.000Z" },
    });
  });

  it("rejects an unauthenticated start before account and rate limit access", async () => {
    mocks.getToken.mockResolvedValue(null);

    const response = await POST(request("POST"));

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await response.json()).code).toBe("UNAUTHORIZED");
    expect(mocks.getActiveExternalAuthAccount).not.toHaveBeenCalled();
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin start before rate limiting", async () => {
    const response = await POST(request("POST", "https://example.com"));

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("INVALID_ORIGIN");
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
  });

  it("starts a fresh reauthentication flow and sets opaque cookies", async () => {
    const response = await POST(request("POST"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      success: true,
      data: { status: "pending", expiresAt: "2026-09-12T01:00:00.000Z" },
    });
    expect(mocks.createWithdrawalReauthState).toHaveBeenCalledWith(account);
    expect(mocks.setWithdrawalReauthCookies).toHaveBeenCalledWith(
      expect.objectContaining({ flowId: "flow-id", csrfNonce: "csrf-nonce" }),
    );
  });

  it("returns an idle status when no flow cookie exists", async () => {
    const response = await GET(request("GET"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { status: "idle", expiresAt: null },
    });
    expect(mocks.getWithdrawalReauthStateForTarget).not.toHaveBeenCalled();
  });

  it("cancels a verified pending flow for the same account", async () => {
    mocks.getWithdrawalReauthFlowCookie.mockReturnValue("flow-id");

    const response = await DELETE(request("DELETE"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { status: "cancelled" } });
    expect(mocks.withdrawalReauthCsrfMatches).toHaveBeenCalledWith({
      flowId: "flow-id",
      csrfNonce: "csrf-nonce",
    });
    expect(mocks.deleteWithdrawalReauthState).toHaveBeenCalledWith("flow-id");
    expect(mocks.expireWithdrawalReauthCookies).toHaveBeenCalled();
  });

  it("maps a state-store outage to the public 503 contract", async () => {
    mocks.createWithdrawalReauthState.mockRejectedValue(
      new mocks.WithdrawalReauthStoreUnavailableError(),
    );

    const response = await POST(request("POST"));

    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("WITHDRAWAL_STATE_UNAVAILABLE");
  });
});
