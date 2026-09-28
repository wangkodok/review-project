import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth/options";
import { unlinkKakaoAccountWithAdminKey } from "@/app/lib/auth/kakaoAdminUnlink";
import {
  expireCurrentAuthSessionCookies,
  getWithdrawalExternalAuthAccount,
} from "@/app/lib/auth/sessionSecurity";
import { parseWithdrawalRequest } from "@/app/lib/profile/withdrawalRequest";
import { withdrawUser } from "@/app/lib/profile/withdrawalService";
import {
  enforceRateLimit,
  getRequestIp,
} from "@/app/lib/security/rateLimit";
import { recordSecurityEvent } from "@/app/lib/security/securityEvent";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

type AuthProvider = "google" | "kakao";

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

function hasJsonContentType(request: NextRequest) {
  return (
    request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ===
    "application/json"
  );
}

function errorResponse({
  message,
  code,
  status,
}: {
  message: string;
  code: string;
  status: number;
}) {
  return jsonResponse(
    {
      success: false,
      data: null,
      message,
      code,
    },
    status,
  );
}

function unauthorizedResponse() {
  return errorResponse({
    message: "로그인이 필요합니다.",
    code: "UNAUTHORIZED",
    status: 401,
  });
}

function invalidRequestResponse() {
  return errorResponse({
    message: "요청 형식을 확인해 주세요.",
    code: "INVALID_REQUEST",
    status: 400,
  });
}

export async function DELETE(request: NextRequest) {
  let provider: AuthProvider | undefined;

  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const sessionProvider = session?.user?.authProvider;

    if (
      !userId ||
      (sessionProvider !== "google" && sessionProvider !== "kakao")
    ) {
      return unauthorizedResponse();
    }

    provider = sessionProvider;

    if (!isSameOrigin(request)) {
      return errorResponse({
        message: "유효하지 않은 요청입니다.",
        code: "INVALID_ORIGIN",
        status: 403,
      });
    }

    if (!hasJsonContentType(request)) {
      return invalidRequestResponse();
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return invalidRequestResponse();
    }

    const rateLimitResponse = await enforceRateLimit({
      identifier: `user:${userId}:ip:${getRequestIp(request)}`,
      policy: "withdrawal",
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const parsedRequest = parseWithdrawalRequest(body);

    if (!parsedRequest.ok) {
      if (parsedRequest.code === "WITHDRAWAL_CONSENT_REQUIRED") {
        return errorResponse({
          message: "회원 탈퇴 동의가 필요합니다.",
          code: parsedRequest.code,
          status: 400,
        });
      }

      return invalidRequestResponse();
    }

    const account = await getWithdrawalExternalAuthAccount({
      userId,
      provider,
    });

    if (!account) {
      return unauthorizedResponse();
    }

    let deletionResult: "deleted" | "not_found";

    try {
      deletionResult = await withdrawUser(userId);
    } catch {
      recordSecurityEvent({
        eventCode: "withdrawal_database_delete_failed",
        provider,
      });

      return errorResponse({
        message:
          "계정 데이터 삭제를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        code: "WITHDRAWAL_DELETE_FAILED",
        status: 500,
      });
    }

    if (deletionResult !== "deleted") {
      return unauthorizedResponse();
    }

    if (provider === "kakao") {
      let unlinkResult:
        | "unlinked"
        | "configuration_missing"
        | "account_mismatch"
        | "request_failed"
        | "timed_out" = "request_failed";

      try {
        unlinkResult = await unlinkKakaoAccountWithAdminKey({
          adminKey: process.env.AUTH_KAKAO_ADMIN_KEY,
          providerAccountId: account.providerAccountId,
        });
      } catch {
        unlinkResult = "request_failed";
      }

      if (unlinkResult !== "unlinked") {
        recordSecurityEvent({
          eventCode: "withdrawal_provider_unlink_failed",
          provider,
          resultCode: unlinkResult,
        });
      }
    }

    const response = jsonResponse({
      success: true,
      data: null,
      message: "회원 탈퇴가 완료되었습니다.",
    });
    expireCurrentAuthSessionCookies(request, response);

    return response;
  } catch {
    recordSecurityEvent({
      eventCode: "withdrawal_unexpected_failure",
      ...(provider ? { provider } : {}),
    });

    return errorResponse({
      message: "회원 탈퇴에 실패했습니다.",
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
    });
  }
}
