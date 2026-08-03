import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { authSecret } from "@/app/lib/auth/options";
import {
  expireCurrentAuthSessionCookies,
  getActiveExternalAuthAccount,
} from "@/app/lib/auth/sessionSecurity";
import {
  createWithdrawalReauthState,
  deleteWithdrawalReauthState,
  getWithdrawalReauthStateForTarget,
  WithdrawalReauthStoreUnavailableError,
  withdrawalReauthCsrfMatches,
} from "@/app/lib/auth/withdrawalReauth";
import {
  expireWithdrawalReauthCookies,
  getWithdrawalReauthCsrfCookie,
  getWithdrawalReauthFlowCookie,
  setWithdrawalReauthCookies,
} from "@/app/lib/auth/withdrawalReauthCookies";
import {
  enforceRateLimit,
  getRequestIp,
} from "@/app/lib/security/rateLimit";

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

function unauthorizedResponse(request: NextRequest) {
  const response = jsonResponse(
    {
      success: false,
      data: null,
      message: "로그인이 필요합니다.",
      code: "UNAUTHORIZED",
    },
    401,
  );
  expireCurrentAuthSessionCookies(request, response);
  expireWithdrawalReauthCookies(response);

  return response;
}

function invalidSessionResponse(request: NextRequest) {
  const response = jsonResponse(
    {
      success: false,
      data: null,
      message: "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.",
      code: "SESSION_INVALID",
    },
    401,
  );
  expireCurrentAuthSessionCookies(request, response);
  expireWithdrawalReauthCookies(response);

  return response;
}

function storeUnavailableResponse() {
  return jsonResponse(
    {
      success: false,
      data: null,
      message: "본인 확인 요청을 일시적으로 처리할 수 없습니다.",
      code: "WITHDRAWAL_STATE_UNAVAILABLE",
    },
    503,
  );
}

async function getWithdrawalAccount(request: NextRequest) {
  const token = await getToken({ req: request, secret: authSecret });

  if (!token?.userId) {
    return {
      response: unauthorizedResponse(request),
      account: null,
    };
  }

  if (
    token.authProvider !== "google" &&
    token.authProvider !== "kakao"
  ) {
    return {
      response: invalidSessionResponse(request),
      account: null,
    };
  }

  const account = await getActiveExternalAuthAccount({
    userId: token.userId,
    provider: token.authProvider,
  });

  if (!account) {
    return {
      response: invalidSessionResponse(request),
      account: null,
    };
  }

  return {
    response: null,
    account,
  };
}

async function applyRateLimit(request: NextRequest) {
  return enforceRateLimit({
    identifier: `${request.method}:${getRequestIp(request)}`,
    policy: "withdrawal",
  });
}

export async function POST(request: NextRequest) {
  try {
    const authentication = await getWithdrawalAccount(request);

    if (authentication.response || !authentication.account) {
      return authentication.response;
    }

    if (!isSameOrigin(request)) {
      return jsonResponse(
        {
          success: false,
          data: null,
          message: "유효하지 않은 요청입니다.",
          code: "INVALID_ORIGIN",
        },
        403,
      );
    }

    const rateLimitResponse = await applyRateLimit(request);

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const previousFlowId = getWithdrawalReauthFlowCookie(request);

    if (previousFlowId) {
      const previousState = await getWithdrawalReauthStateForTarget({
        flowId: previousFlowId,
        ...authentication.account,
      });

      if (previousState.status === "account_mismatch") {
        const response = jsonResponse(
          {
            success: false,
            data: null,
            message: "현재 계정과 본인 확인 요청의 계정이 일치하지 않습니다.",
            code: "WITHDRAWAL_ACCOUNT_MISMATCH",
          },
          403,
        );
        expireWithdrawalReauthCookies(response);

        return response;
      }

      if (
        previousState.status === "found" &&
        previousState.state.status === "processing"
      ) {
        return jsonResponse(
          {
            success: false,
            data: null,
            message: "회원 탈퇴 요청을 처리하고 있습니다.",
            code: "WITHDRAWAL_ALREADY_PROCESSING",
          },
          409,
        );
      }

      if (
        previousState.status === "found" &&
        previousState.state.status === "provider_revoked"
      ) {
        return jsonResponse(
          {
            success: false,
            data: null,
            message: "회원 탈퇴 데이터 삭제를 완료해 주세요.",
            code: "WITHDRAWAL_COMPLETION_REQUIRED",
          },
          409,
        );
      }

      await deleteWithdrawalReauthState(previousFlowId);
    }

    const state = await createWithdrawalReauthState(authentication.account);
    const response = jsonResponse({
      success: true,
      data: {
        status: "pending",
        expiresAt: state.expiresAt,
      },
      message: "본인 확인 요청을 시작했습니다.",
    });
    setWithdrawalReauthCookies({
      response,
      flowId: state.flowId,
      csrfNonce: state.csrfNonce,
    });

    return response;
  } catch (error) {
    if (error instanceof WithdrawalReauthStoreUnavailableError) {
      return storeUnavailableResponse();
    }

    return jsonResponse(
      {
        success: false,
        data: null,
        message: "본인 확인 요청을 시작하지 못했습니다.",
        code: "INTERNAL_SERVER_ERROR",
      },
      500,
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authentication = await getWithdrawalAccount(request);

    if (authentication.response || !authentication.account) {
      return authentication.response;
    }

    const rateLimitResponse = await applyRateLimit(request);

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const flowId = getWithdrawalReauthFlowCookie(request);

    if (!flowId) {
      return jsonResponse({
        success: true,
        data: {
          status: "idle",
          expiresAt: null,
        },
        message: "진행 중인 본인 확인 요청이 없습니다.",
      });
    }

    const result = await getWithdrawalReauthStateForTarget({
      flowId,
      ...authentication.account,
    });

    if (result.status === "account_mismatch") {
      const response = jsonResponse(
        {
          success: false,
          data: null,
          message: "현재 계정과 본인 확인 요청의 계정이 일치하지 않습니다.",
          code: "WITHDRAWAL_ACCOUNT_MISMATCH",
        },
        403,
      );
      expireWithdrawalReauthCookies(response);

      return response;
    }

    if (result.status !== "found") {
      const response = jsonResponse(
        {
          success: false,
          data: null,
          message: "본인 확인 요청이 만료되었거나 유효하지 않습니다.",
          code: "WITHDRAWAL_FLOW_EXPIRED",
        },
        410,
      );
      expireWithdrawalReauthCookies(response);

      return response;
    }

    const publicStatus =
      result.state.status === "provider_revoked"
        ? "verified"
        : result.state.status;

    return jsonResponse({
      success: true,
      data: {
        status: publicStatus,
        expiresAt: result.state.expiresAt,
      },
      message: "본인 확인 요청 상태를 조회했습니다.",
    });
  } catch (error) {
    if (error instanceof WithdrawalReauthStoreUnavailableError) {
      return storeUnavailableResponse();
    }

    return jsonResponse(
      {
        success: false,
        data: null,
        message: "본인 확인 요청 상태를 조회하지 못했습니다.",
        code: "INTERNAL_SERVER_ERROR",
      },
      500,
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authentication = await getWithdrawalAccount(request);

    if (authentication.response || !authentication.account) {
      return authentication.response;
    }

    if (!isSameOrigin(request)) {
      return jsonResponse(
        {
          success: false,
          data: null,
          message: "유효하지 않은 요청입니다.",
          code: "INVALID_ORIGIN",
        },
        403,
      );
    }

    const rateLimitResponse = await applyRateLimit(request);

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const flowId = getWithdrawalReauthFlowCookie(request);

    if (!flowId) {
      const response = jsonResponse({
        success: true,
        data: {
          status: "idle",
          expiresAt: null,
        },
        message: "진행 중인 본인 확인 요청이 없습니다.",
      });
      expireWithdrawalReauthCookies(response);

      return response;
    }

    const csrfNonce = getWithdrawalReauthCsrfCookie(request);

    if (
      !csrfNonce ||
      !(await withdrawalReauthCsrfMatches({ flowId, csrfNonce }))
    ) {
      const response = jsonResponse(
        {
          success: false,
          data: null,
          message: "유효하지 않은 본인 확인 요청입니다.",
          code: "WITHDRAWAL_FLOW_INVALID",
        },
        403,
      );
      expireWithdrawalReauthCookies(response);

      return response;
    }

    const result = await getWithdrawalReauthStateForTarget({
      flowId,
      ...authentication.account,
    });

    if (result.status === "account_mismatch") {
      const response = jsonResponse(
        {
          success: false,
          data: null,
          message: "현재 계정과 본인 확인 요청의 계정이 일치하지 않습니다.",
          code: "WITHDRAWAL_ACCOUNT_MISMATCH",
        },
        403,
      );
      expireWithdrawalReauthCookies(response);

      return response;
    }

    if (result.status !== "found") {
      const response = jsonResponse(
        {
          success: false,
          data: null,
          message: "본인 확인 요청이 만료되었거나 유효하지 않습니다.",
          code: "WITHDRAWAL_FLOW_EXPIRED",
        },
        410,
      );
      expireWithdrawalReauthCookies(response);

      return response;
    }

    if (result.state.status === "processing") {
      return jsonResponse(
        {
          success: false,
          data: null,
          message: "회원 탈퇴 요청을 처리하고 있습니다.",
          code: "WITHDRAWAL_ALREADY_PROCESSING",
        },
        409,
      );
    }

    if (result.state.status === "provider_revoked") {
      return jsonResponse(
        {
          success: false,
          data: null,
          message: "회원 탈퇴 데이터 삭제를 완료해 주세요.",
          code: "WITHDRAWAL_COMPLETION_REQUIRED",
        },
        409,
      );
    }

    await deleteWithdrawalReauthState(flowId);

    const response = jsonResponse({
      success: true,
      data: {
        status: "cancelled",
        expiresAt: null,
      },
      message: "본인 확인 요청을 취소했습니다.",
    });
    expireWithdrawalReauthCookies(response);

    return response;
  } catch (error) {
    if (error instanceof WithdrawalReauthStoreUnavailableError) {
      return storeUnavailableResponse();
    }

    return jsonResponse(
      {
        success: false,
        data: null,
        message: "본인 확인 요청을 취소하지 못했습니다.",
        code: "INTERNAL_SERVER_ERROR",
      },
      500,
    );
  }
}
