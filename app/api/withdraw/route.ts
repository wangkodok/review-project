import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { authSecret } from "@/app/lib/auth/options";
import { unlinkExternalProviderAccount } from "@/app/lib/auth/providerOAuth";
import {
  expireCurrentAuthSessionCookies,
  getActiveExternalAuthAccount,
} from "@/app/lib/auth/sessionSecurity";
import {
  beginWithdrawalFinalization,
  deleteWithdrawalReauthState,
  markWithdrawalProviderRevoked,
  releaseWithdrawalFinalization,
  WithdrawalReauthStoreUnavailableError,
} from "@/app/lib/auth/withdrawalReauth";
import {
  expireWithdrawalReauthCookies,
  getWithdrawalReauthCsrfCookie,
  getWithdrawalReauthFlowCookie,
} from "@/app/lib/auth/withdrawalReauthCookies";
import { withdrawUser } from "@/app/lib/profile/service";
import {
  enforceRateLimit,
  getRequestIp,
} from "@/app/lib/security/rateLimit";
import { recordSecurityEvent } from "@/app/lib/security/securityEvent";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

function jsonResponse(
  body: {
    success: boolean;
    data: unknown;
    message: string;
    code?: string;
  },
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return false;
  }

  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

async function hasExplicitWithdrawalConsent(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;

    return (
      typeof body === "object" &&
      body !== null &&
      "consent" in body &&
      body.consent === true
    );
  } catch {
    return false;
  }
}

function expireWithdrawalState(
  response: NextResponse,
  request?: NextRequest,
) {
  expireWithdrawalReauthCookies(response);

  if (request) {
    expireCurrentAuthSessionCookies(request, response);
  }

  return response;
}

function unauthorizedResponse(request: NextRequest) {
  return expireWithdrawalState(
    jsonResponse(
      {
        success: false,
        data: null,
        message: "로그인이 필요합니다.",
        code: "UNAUTHORIZED",
      },
      401,
    ),
    request,
  );
}

function invalidSessionResponse(request: NextRequest) {
  return expireWithdrawalState(
    jsonResponse(
      {
        success: false,
        data: null,
        message: "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.",
        code: "SESSION_INVALID",
      },
      401,
    ),
    request,
  );
}

function withdrawalFlowErrorResponse({
  message,
  code,
  status,
  expireCookies = false,
}: {
  message: string;
  code: string;
  status: number;
  expireCookies?: boolean;
}) {
  const response = jsonResponse(
    {
      success: false,
      data: null,
      message,
      code,
    },
    status,
  );

  if (expireCookies) {
    expireWithdrawalReauthCookies(response);
  }

  return response;
}

function storeUnavailableResponse() {
  return jsonResponse(
    {
      success: false,
      data: null,
      message: "회원 탈퇴 요청을 일시적으로 처리할 수 없습니다.",
      code: "WITHDRAWAL_STATE_UNAVAILABLE",
    },
    503,
  );
}

function getProviderName(provider: "google" | "kakao") {
  return provider === "google" ? "Google" : "Kakao";
}

export async function DELETE(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: authSecret });

    if (!token?.userId) {
      return unauthorizedResponse(request);
    }

    if (
      token.authProvider !== "google" &&
      token.authProvider !== "kakao"
    ) {
      return invalidSessionResponse(request);
    }

    const account = await getActiveExternalAuthAccount({
      userId: token.userId,
      provider: token.authProvider,
    });

    if (!account) {
      return invalidSessionResponse(request);
    }

    if (!isSameOrigin(request)) {
      return withdrawalFlowErrorResponse({
        message: "유효하지 않은 요청입니다.",
        code: "INVALID_ORIGIN",
        status: 403,
      });
    }

    const rateLimitResponse = await enforceRateLimit({
      identifier: `final:${getRequestIp(request)}`,
      policy: "withdrawal",
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    if (!(await hasExplicitWithdrawalConsent(request))) {
      return withdrawalFlowErrorResponse({
        message: "회원 탈퇴에 대한 최종 확인이 필요합니다.",
        code: "WITHDRAWAL_CONSENT_REQUIRED",
        status: 400,
      });
    }

    const flowId = getWithdrawalReauthFlowCookie(request);
    const csrfNonce = getWithdrawalReauthCsrfCookie(request);
    const withdrawalVerifiedAt = token.withdrawalReauthenticatedAt;
    const providerName = getProviderName(account.provider);
    if (
      typeof flowId !== "string" ||
      flowId.length === 0 ||
      typeof csrfNonce !== "string" ||
      csrfNonce.length === 0 ||
      token.withdrawalFlowId !== flowId ||
      typeof withdrawalVerifiedAt !== "number" ||
      !Number.isFinite(withdrawalVerifiedAt)
    ) {
      return withdrawalFlowErrorResponse({
        message: `${providerName} 계정으로 본인 확인을 다시 진행해 주세요.`,
        code: "WITHDRAWAL_REAUTH_REQUIRED",
        status: 403,
        expireCookies: true,
      });
    }

    const finalization = await beginWithdrawalFinalization({
      flowId,
      userId: account.userId,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      csrfNonce,
      verifiedAt: withdrawalVerifiedAt,
    });

    if (finalization === "already_processing") {
      return withdrawalFlowErrorResponse({
        message: "회원 탈퇴 요청을 처리하고 있습니다.",
        code: "WITHDRAWAL_ALREADY_PROCESSING",
        status: 409,
      });
    }

    if (
      finalization === "missing" ||
      finalization === "expired" ||
      finalization === "invalid_status"
    ) {
      return withdrawalFlowErrorResponse({
        message: "본인 확인 요청이 만료되었습니다. 다시 진행해 주세요.",
        code: "WITHDRAWAL_FLOW_EXPIRED",
        status: 410,
        expireCookies: true,
      });
    }

    if (finalization === "account_mismatch") {
      return withdrawalFlowErrorResponse({
        message: "현재 계정과 본인 확인 계정이 일치하지 않습니다.",
        code: "WITHDRAWAL_ACCOUNT_MISMATCH",
        status: 403,
        expireCookies: true,
      });
    }

    if (
      finalization === "csrf_mismatch" ||
      finalization === "invalid_state"
    ) {
      return withdrawalFlowErrorResponse({
        message: "유효하지 않은 본인 확인 요청입니다.",
        code: "WITHDRAWAL_FLOW_INVALID",
        status: 403,
        expireCookies: true,
      });
    }

    if (finalization === "processing_started") {
      const providerAccessToken = token.providerAccessToken;
      const providerAccessTokenExpiresAt =
        token.providerAccessTokenExpiresAt;
      const hasValidProviderAccessToken =
        typeof providerAccessToken === "string" &&
        providerAccessToken.trim().length > 0 &&
        typeof providerAccessTokenExpiresAt === "number" &&
        providerAccessTokenExpiresAt > Date.now();

      if (!hasValidProviderAccessToken) {
        const releaseResult = await releaseWithdrawalFinalization({
          flowId,
          userId: account.userId,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        });

        if (
          releaseResult !== "released" &&
          releaseResult !== "already_released"
        ) {
          recordSecurityEvent({
            eventCode: "withdrawal_processing_release_failed",
            provider: account.provider,
          });
          return storeUnavailableResponse();
        }

        return withdrawalFlowErrorResponse({
          message: `${providerName} 계정으로 본인 확인을 다시 진행해 주세요.`,
          code: "WITHDRAWAL_REAUTH_REQUIRED",
          status: 403,
        });
      }

      const unlinkResult = await unlinkExternalProviderAccount({
        provider: account.provider,
        accessToken: providerAccessToken,
        providerAccountId: account.providerAccountId,
      });

      if (unlinkResult !== "unlinked") {
        const releaseResult = await releaseWithdrawalFinalization({
          flowId,
          userId: account.userId,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        });

        if (
          releaseResult !== "released" &&
          releaseResult !== "already_released"
        ) {
          recordSecurityEvent({
            eventCode: "withdrawal_processing_release_failed",
            provider: account.provider,
          });
          return storeUnavailableResponse();
        }

        if (unlinkResult === "account_mismatch") {
          recordSecurityEvent({
            eventCode: "withdrawal_provider_unlink_account_mismatch",
            provider: account.provider,
          });
        }

        return withdrawalFlowErrorResponse({
          message: `${providerName} 계정 연결을 해제하지 못했습니다. 잠시 후 다시 시도해 주세요.`,
          code: "PROVIDER_UNLINK_FAILED",
          status: 502,
        });
      }

      const providerRevoked = await markWithdrawalProviderRevoked({
        flowId,
        userId: account.userId,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      });

      if (
        providerRevoked !== "marked" &&
        providerRevoked !== "already_marked"
      ) {
        recordSecurityEvent({
          eventCode: "withdrawal_provider_revoked_state_persist_failed",
          provider: account.provider,
        });

        return storeUnavailableResponse();
      }
    }

    try {
      await withdrawUser(account.userId);
    } catch {
      recordSecurityEvent({
        eventCode: "withdrawal_database_delete_failed",
        provider: account.provider,
      });

      return withdrawalFlowErrorResponse({
        message:
          "계정 데이터 삭제를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        code: "WITHDRAWAL_DELETE_FAILED",
        status: 500,
      });
    }

    try {
      await deleteWithdrawalReauthState(flowId);
    } catch {
      recordSecurityEvent({
        eventCode: "withdrawal_state_cleanup_failed",
        provider: account.provider,
      });
    }

    const response = jsonResponse({
      success: true,
      data: null,
      message: "회원 탈퇴가 완료되었습니다.",
    });
    expireCurrentAuthSessionCookies(request, response);
    expireWithdrawalReauthCookies(response);

    return response;
  } catch (error) {
    if (error instanceof WithdrawalReauthStoreUnavailableError) {
      recordSecurityEvent({
        eventCode: "withdrawal_state_store_unavailable",
      });
      return storeUnavailableResponse();
    }

    recordSecurityEvent({
      eventCode: "withdrawal_unexpected_failure",
    });

    return jsonResponse(
      {
        success: false,
        data: null,
        message: "회원 탈퇴에 실패했습니다.",
        code: "INTERNAL_SERVER_ERROR",
      },
      500,
    );
  }
}
