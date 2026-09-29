import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  expireCurrentAuthSessionCookies: vi.fn(),
  getWithdrawalExternalAuthAccount: vi.fn(),
  withdrawUser: vi.fn(),
  enforceRateLimit: vi.fn(),
  getRequestIp: vi.fn(),
  recordSecurityEvent: vi.fn(),
  unlinkKakaoAccountWithAdminKey: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/app/lib/auth/options", () => ({ authOptions: {} }));
vi.mock("@/app/lib/auth/sessionSecurity", () => ({
  expireCurrentAuthSessionCookies: mocks.expireCurrentAuthSessionCookies,
  getWithdrawalExternalAuthAccount: mocks.getWithdrawalExternalAuthAccount,
}));
vi.mock("@/app/lib/auth/kakaoAdminUnlink", () => ({
  unlinkKakaoAccountWithAdminKey: mocks.unlinkKakaoAccountWithAdminKey,
}));
vi.mock("@/app/lib/profile/withdrawalService", () => ({
  withdrawUser: mocks.withdrawUser,
}));
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
  providerAccountId: "123456789",
  providerEmail: null,
};

function request({
  origin = "http://localhost",
  contentType = "application/json",
  body = JSON.stringify({ consent: true }),
}: {
  origin?: string | null;
  contentType?: string | null;
  body?: string;
} = {}) {
  const headers = new Headers();

  if (origin !== null) {
    headers.set("Origin", origin);
  }
  if (contentType !== null) {
    headers.set("Content-Type", contentType);
  }

  return new NextRequest("http://localhost/api/withdraw", {
    method: "DELETE",
    headers,
    body,
  });
}

async function responseBody(response: Response) {
  return (await response.json()) as {
    success: boolean;
    data: unknown;
    message: string;
    code?: string;
  };
}

describe("DELETE /api/withdraw", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: { id: USER_ID, authProvider: "kakao" },
    });
    mocks.getWithdrawalExternalAuthAccount.mockResolvedValue(account);
    mocks.enforceRateLimit.mockResolvedValue(null);
    mocks.getRequestIp.mockReturnValue("request-ip");
    mocks.withdrawUser.mockResolvedValue("deleted");
    mocks.unlinkKakaoAccountWithAdminKey.mockResolvedValue("unlinked");
  });

  it("rejects an unauthenticated request without expiring cookies", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const response = await DELETE(request());

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await responseBody(response)).code).toBe("UNAUTHORIZED");
    expect(mocks.getWithdrawalExternalAuthAccount).not.toHaveBeenCalled();
    expect(mocks.expireCurrentAuthSessionCookies).not.toHaveBeenCalled();
  });

  it("rejects a session with an unsupported provider", async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: USER_ID, authProvider: "github" },
    });

    const response = await DELETE(request());

    expect(response.status).toBe(401);
    expect((await responseBody(response)).code).toBe("UNAUTHORIZED");
    expect(mocks.getWithdrawalExternalAuthAccount).not.toHaveBeenCalled();
    expect(mocks.expireCurrentAuthSessionCookies).not.toHaveBeenCalled();
  });

  it.each([
    ["a missing Origin", null],
    ["a cross Origin", "https://example.com"],
  ])("rejects %s before rate limiting", async (_name, origin) => {
    const response = await DELETE(request({ origin }));

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await responseBody(response)).code).toBe("INVALID_ORIGIN");
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.expireCurrentAuthSessionCookies).not.toHaveBeenCalled();
  });

  it("rejects a non-JSON request", async () => {
    const response = await DELETE(
      request({ contentType: "text/plain", body: "consent=true" }),
    );

    expect(response.status).toBe(400);
    expect((await responseBody(response)).code).toBe("INVALID_REQUEST");
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.withdrawUser).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON before rate limiting", async () => {
    const response = await DELETE(request({ body: "{" }));

    expect(response.status).toBe(400);
    expect((await responseBody(response)).code).toBe("INVALID_REQUEST");
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.withdrawUser).not.toHaveBeenCalled();
  });

  it("returns the shared rate limit response before validating consent", async () => {
    mocks.enforceRateLimit.mockResolvedValue(
      Response.json(
        {
          success: false,
          data: null,
          message: "요청이 너무 많습니다.",
          code: "RATE_LIMIT_EXCEEDED",
        },
        { status: 429, headers: { "Cache-Control": "no-store" } },
      ),
    );

    const response = await DELETE(
      request({ body: JSON.stringify({ consent: false }) }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      identifier: `user:${USER_ID}:ip:request-ip`,
      policy: "withdrawal",
    });
    expect(mocks.getWithdrawalExternalAuthAccount).not.toHaveBeenCalled();
  });

  it.each([
    ["missing consent", {}],
    ["declined consent", { consent: false }],
  ])("requires explicit consent for %s", async (_name, body) => {
    const response = await DELETE(request({ body: JSON.stringify(body) }));

    expect(response.status).toBe(400);
    expect((await responseBody(response)).code).toBe(
      "WITHDRAWAL_CONSENT_REQUIRED",
    );
    expect(mocks.getWithdrawalExternalAuthAccount).not.toHaveBeenCalled();
    expect(mocks.expireCurrentAuthSessionCookies).not.toHaveBeenCalled();
  });

  it("rejects client-selected ownership fields", async () => {
    const response = await DELETE(
      request({
        body: JSON.stringify({ consent: true, userId: "attacker-user" }),
      }),
    );

    expect(response.status).toBe(400);
    expect((await responseBody(response)).code).toBe("INVALID_REQUEST");
    expect(mocks.getWithdrawalExternalAuthAccount).not.toHaveBeenCalled();
  });

  it("rejects a stale session account without expiring cookies", async () => {
    mocks.getWithdrawalExternalAuthAccount.mockResolvedValue(null);

    const response = await DELETE(request());

    expect(response.status).toBe(401);
    expect((await responseBody(response)).code).toBe("UNAUTHORIZED");
    expect(mocks.withdrawUser).not.toHaveBeenCalled();
    expect(mocks.expireCurrentAuthSessionCookies).not.toHaveBeenCalled();
  });

  it("deletes only the current session user and expires cookies on success", async () => {
    const response = await DELETE(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await responseBody(response)).toEqual({
      success: true,
      data: null,
      message: "회원 탈퇴가 완료되었습니다.",
    });
    expect(mocks.getServerSession).toHaveBeenCalledWith({});
    expect(mocks.getWithdrawalExternalAuthAccount).toHaveBeenCalledWith({
      userId: USER_ID,
      provider: "kakao",
    });
    expect(mocks.withdrawUser).toHaveBeenCalledWith(USER_ID);
    expect(mocks.unlinkKakaoAccountWithAdminKey).toHaveBeenCalledWith({
      adminKey: process.env.AUTH_KAKAO_ADMIN_KEY,
      providerAccountId: "123456789",
    });
    expect(mocks.expireCurrentAuthSessionCookies).toHaveBeenCalledWith(
      expect.any(NextRequest),
      response,
    );
  });

  it("keeps withdrawal successful when Kakao unlink fails", async () => {
    mocks.unlinkKakaoAccountWithAdminKey.mockResolvedValue("timed_out");

    const response = await DELETE(request());

    expect(response.status).toBe(200);
    expect((await responseBody(response)).data).toBeNull();
    expect(mocks.recordSecurityEvent).toHaveBeenCalledWith({
      eventCode: "withdrawal_provider_unlink_failed",
      provider: "kakao",
      resultCode: "timed_out",
    });
    expect(mocks.expireCurrentAuthSessionCookies).toHaveBeenCalled();
  });

  it("deletes only the service data for a Google account", async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: USER_ID, authProvider: "google" },
    });
    mocks.getWithdrawalExternalAuthAccount.mockResolvedValue({
      userId: USER_ID,
      provider: "google",
      providerAccountId: "google-account-id",
      providerEmail: "private@example.com",
    });

    const response = await DELETE(request());

    expect(response.status).toBe(200);
    expect((await responseBody(response)).data).toBeNull();
    expect(mocks.recordSecurityEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({
        eventCode: "withdrawal_google_revoke_result",
      }),
    );
    expect(mocks.withdrawUser).toHaveBeenCalledWith(USER_ID);
    expect(mocks.unlinkKakaoAccountWithAdminKey).not.toHaveBeenCalled();
  });

  it("rejects a Google revoke result on a Kakao withdrawal", async () => {
    const response = await DELETE(
      request({
        body: JSON.stringify({
          consent: true,
          googleRevokeStatus: "success",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect((await responseBody(response)).code).toBe("INVALID_REQUEST");
    expect(mocks.recordSecurityEvent).not.toHaveBeenCalled();
    expect(mocks.withdrawUser).not.toHaveBeenCalled();
  });

  it("does not pretend success when deletion loses a concurrent race", async () => {
    mocks.withdrawUser.mockResolvedValue("not_found");

    const response = await DELETE(request());

    expect(response.status).toBe(401);
    expect((await responseBody(response)).code).toBe("UNAUTHORIZED");
    expect(mocks.expireCurrentAuthSessionCookies).not.toHaveBeenCalled();
  });

  it("returns a safe error and keeps cookies when deletion fails", async () => {
    mocks.withdrawUser.mockRejectedValue(new Error("private database detail"));

    const response = await DELETE(request());
    const body = await responseBody(response);

    expect(response.status).toBe(500);
    expect(body.code).toBe("WITHDRAWAL_DELETE_FAILED");
    expect(JSON.stringify(body)).not.toContain("private database detail");
    expect(mocks.recordSecurityEvent).toHaveBeenCalledWith({
      eventCode: "withdrawal_database_delete_failed",
      provider: "kakao",
    });
    expect(mocks.expireCurrentAuthSessionCookies).not.toHaveBeenCalled();
  });

  it("normalizes an active-account lookup failure", async () => {
    mocks.getWithdrawalExternalAuthAccount.mockRejectedValue(
      new Error("private database detail"),
    );

    const response = await DELETE(request());
    const body = await responseBody(response);

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_SERVER_ERROR");
    expect(JSON.stringify(body)).not.toContain("private database detail");
    expect(mocks.recordSecurityEvent).toHaveBeenCalledWith({
      eventCode: "withdrawal_unexpected_failure",
      provider: "kakao",
    });
    expect(mocks.expireCurrentAuthSessionCookies).not.toHaveBeenCalled();
  });
});
