"use client";

import { signIn, signOut } from "next-auth/react";
import { useEffect, useState } from "react";

type WithdrawalReauthResponse = {
  success: boolean;
  data: {
    status?: "idle" | "pending" | "verified" | "processing";
    expiresAt?: number | null;
  } | null;
  message: string;
  code?: string;
};

type WithdrawalResponse = {
  success: boolean;
  data: null;
  message: string;
  code?: string;
};

type WithdrawalAuthProvider = "google" | "kakao";

function getProviderName(authProvider: WithdrawalAuthProvider) {
  return authProvider === "google" ? "Google" : "Kakao";
}

function getProviderAuthorizationParams(
  authProvider: WithdrawalAuthProvider,
) {
  return authProvider === "google"
    ? { prompt: "select_account" }
    : { prompt: "login" };
}

function getInitialErrorMessage(
  authProvider: WithdrawalAuthProvider,
  errorCode?: string,
) {
  if (!errorCode) {
    return "";
  }

  const providerName = getProviderName(authProvider);
  const errorMessages: Record<string, string> = {
    account_mismatch:
      `처음 탈퇴를 요청한 ${providerName} 계정과 같은 계정으로 본인 확인해 주세요.`,
    flow_expired: "본인 확인 요청이 만료되었습니다. 다시 시작해 주세요.",
    flow_invalid: "유효하지 않은 본인 확인 요청입니다. 다시 시작해 주세요.",
    provider_invalid: `${providerName} 계정으로 본인 확인해 주세요.`,
    session_invalid: "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.",
    state_unavailable:
      "본인 확인 요청을 일시적으로 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    verification_failed: "본인 확인에 실패했습니다. 다시 시도해 주세요.",
  };

  return errorMessages[errorCode] ??
    "본인 확인을 완료하지 못했습니다. 다시 시도해 주세요.";
}

export default function WithdrawalReauthButton({
  authProvider,
  initialErrorCode,
}: {
  authProvider: WithdrawalAuthProvider;
  initialErrorCode?: string;
}) {
  const providerName = getProviderName(authProvider);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [hasFinalConsent, setHasFinalConsent] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState(() =>
    getInitialErrorMessage(authProvider, initialErrorCode),
  );

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        const response = await fetch("/api/withdraw/reauth", {
          cache: "no-store",
        });
        const result = (await response.json()) as WithdrawalReauthResponse;

        if (cancelled || !response.ok || !result.success || !result.data) {
          return;
        }

        if (result.data.status === "verified") {
          setIsProcessing(false);
          setIsVerified(true);
          setStatusMessage(`${providerName} 계정 본인 확인이 완료되었습니다.`);
          setErrorMessage("");
        } else if (result.data.status === "processing") {
          setIsProcessing(true);
          setStatusMessage("회원 탈퇴 요청을 처리하고 있습니다.");
          setErrorMessage("");
        } else if (
          result.data.status === "pending" &&
          !initialErrorCode
        ) {
          setStatusMessage(`${providerName} 계정 본인 확인이 진행 중입니다.`);
        }
      } catch {
        // The user can retry from the button when status lookup is unavailable.
      }
    }

    void loadStatus();

    return () => {
      cancelled = true;
    };
  }, [initialErrorCode, providerName]);

  async function startReauthentication() {
    if (isSubmitting || isProcessing) {
      return;
    }

    setIsSubmitting(true);
    setHasFinalConsent(false);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/withdraw/reauth", {
        method: "POST",
      });
      const result = (await response.json()) as WithdrawalReauthResponse;

      if (!response.ok || !result.success) {
        setErrorMessage(
          result.message || "본인 확인 요청을 시작하지 못했습니다.",
        );
        return;
      }

      await signIn(
        authProvider,
        { callbackUrl: "/my/withdraw" },
        getProviderAuthorizationParams(authProvider),
      );
    } catch {
      setErrorMessage("본인 확인 요청을 시작하지 못했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function completeWithdrawal() {
    if (isWithdrawing || !isVerified || !hasFinalConsent) {
      return;
    }

    setIsWithdrawing(true);
    setStatusMessage("회원 탈퇴 요청을 처리하고 있습니다.");
    setErrorMessage("");

    try {
      const response = await fetch("/api/withdraw", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          consent: true,
        }),
      });
      const result = (await response.json()) as WithdrawalResponse;

      if (!response.ok || !result.success) {
        if (
          result.code === "WITHDRAWAL_REAUTH_REQUIRED" ||
          result.code === "WITHDRAWAL_FLOW_EXPIRED" ||
          result.code === "WITHDRAWAL_FLOW_INVALID" ||
          result.code === "WITHDRAWAL_ACCOUNT_MISMATCH"
        ) {
          setIsVerified(false);
          setHasFinalConsent(false);
        }

        setStatusMessage("");
        setErrorMessage(result.message || "회원 탈퇴에 실패했습니다.");
        return;
      }

      await signOut({ redirect: false }).catch(() => undefined);
      window.location.replace("/community");
    } catch {
      setStatusMessage("");
      setErrorMessage("회원 탈퇴에 실패했습니다.");
    } finally {
      setIsWithdrawing(false);
    }
  }

  return (
    <div className="space-y-3">
      {statusMessage ? (
        <p className="bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-950">
          {statusMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </p>
      ) : null}
      <button
        className="h-14 w-full bg-neutral-950 text-base font-semibold text-white disabled:bg-neutral-300"
        disabled={isSubmitting || isVerified || isProcessing}
        onClick={startReauthentication}
        type="button"
      >
        {isVerified
          ? "본인 확인 완료"
          : isProcessing
            ? "처리 중..."
          : isSubmitting
            ? "이동 중..."
            : `${providerName} 계정으로 본인 확인`}
      </button>
      {isVerified ? (
        <div className="space-y-3 pt-3">
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-neutral-700">
            <input
              checked={hasFinalConsent}
              className="mt-1 h-4 w-4 accent-neutral-950"
              disabled={isWithdrawing}
              onChange={(event) => setHasFinalConsent(event.target.checked)}
              type="checkbox"
            />
            <span>
              회원 탈퇴 시 개인정보와 이용 기록이 삭제되며 복구할 수 없음을
              확인했습니다.
            </span>
          </label>
          <button
            className="h-14 w-full bg-red-500 text-base font-semibold text-white active:bg-red-600 disabled:bg-red-50 disabled:text-red-300"
            disabled={!hasFinalConsent || isWithdrawing}
            onClick={completeWithdrawal}
            type="button"
          >
            {isWithdrawing ? "처리 중..." : "회원 탈퇴"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
