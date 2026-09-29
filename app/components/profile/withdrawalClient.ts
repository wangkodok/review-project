import type { GoogleRevokeStatus } from "@/app/lib/auth/googleRevokeStatus";

export type WithdrawalProvider = "google" | "kakao";

export type WithdrawalRequestResult =
  | {
      ok: true;
      status: number;
    }
  | {
      ok: false;
      status: number;
      code?: string;
    };

export type WithdrawalSubmissionLock = {
  current: boolean;
};

export type WithdrawalSubmissionResult =
  | {
      status: "success";
    }
  | {
      status: "blocked" | "error";
      message: string;
      preserveConsent: true;
    };

type WithdrawalResponseBody = {
  success?: unknown;
  code?: unknown;
};

export function createWithdrawalSubmissionLock(): WithdrawalSubmissionLock {
  return { current: false };
}

function getWithdrawalErrorMessage(result: WithdrawalRequestResult) {
  if (result.ok) {
    return "";
  }

  if (result.status === 401 || result.code === "UNAUTHORIZED") {
    return "로그인이 만료되었습니다. 다시 로그인해 주세요.";
  }

  if (
    result.status === 400 ||
    result.code === "INVALID_REQUEST" ||
    result.code === "WITHDRAWAL_CONSENT_REQUIRED"
  ) {
    return "회원 탈퇴 요청을 확인해 주세요.";
  }

  if (result.status === 429 || result.code === "RATE_LIMIT_EXCEEDED") {
    return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
  }

  return "회원 탈퇴를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

export async function requestWithdrawal({
  googleRevokeStatus,
}: {
  googleRevokeStatus?: GoogleRevokeStatus;
} = {}): Promise<WithdrawalRequestResult> {
  let response: Response;

  try {
    response = await fetch("/api/withdraw", {
      method: "DELETE",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        consent: true,
        ...(googleRevokeStatus ? { googleRevokeStatus } : {}),
      }),
    });
  } catch {
    return {
      ok: false,
      status: 0,
      code: "NETWORK_ERROR",
    };
  }

  let body: WithdrawalResponseBody = {};

  try {
    body = (await response.json()) as WithdrawalResponseBody;
  } catch {
    body = {};
  }

  if (response.ok && body.success === true) {
    return {
      ok: true,
      status: response.status,
    };
  }

  return {
    ok: false,
    status: response.status,
    ...(typeof body.code === "string" ? { code: body.code } : {}),
  };
}

export async function submitWithdrawal({
  consent,
  provider,
  lock,
  requestWithdrawal: executeWithdrawalRequest,
  runGoogleRevoke,
  navigateToComplete,
}: {
  consent: boolean;
  provider: WithdrawalProvider;
  lock: WithdrawalSubmissionLock;
  requestWithdrawal: (input?: {
    googleRevokeStatus?: GoogleRevokeStatus;
  }) => Promise<WithdrawalRequestResult>;
  runGoogleRevoke?: () => Promise<GoogleRevokeStatus>;
  navigateToComplete: (googleRevokeStatus?: GoogleRevokeStatus) => void;
}): Promise<WithdrawalSubmissionResult> {
  if (!consent) {
    return {
      status: "blocked",
      message: "회원 탈퇴 동의가 필요합니다.",
      preserveConsent: true,
    };
  }

  if (lock.current) {
    return {
      status: "blocked",
      message: "회원 탈퇴를 처리하고 있습니다.",
      preserveConsent: true,
    };
  }

  lock.current = true;

  try {
    let googleRevokeStatus: GoogleRevokeStatus | undefined;

    if (provider === "google") {
      if (!runGoogleRevoke) {
        googleRevokeStatus = "not_attempted";
      } else {
        try {
          googleRevokeStatus = await runGoogleRevoke();
        } catch {
          googleRevokeStatus = "failed";
        }
      }
    }

    const result = await executeWithdrawalRequest(
      googleRevokeStatus ? { googleRevokeStatus } : undefined,
    );

    if (!result.ok) {
      lock.current = false;

      return {
        status: "error",
        message: getWithdrawalErrorMessage(result),
        preserveConsent: true,
      };
    }

    navigateToComplete(googleRevokeStatus);

    return { status: "success" };
  } catch {
    lock.current = false;

    return {
      status: "error",
      message: "회원 탈퇴를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      preserveConsent: true,
    };
  }
}
