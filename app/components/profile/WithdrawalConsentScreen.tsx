"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { FormEvent, useRef, useState } from "react";
import {
  revokeGoogleIdentityGrant,
  type GoogleIdentityScriptStatus,
} from "@/app/lib/auth/googleIdentityClient";
import WithdrawalPageHeader from "./WithdrawalPageHeader";
import {
  createWithdrawalSubmissionLock,
  requestWithdrawal,
  submitWithdrawal,
  type WithdrawalProvider,
} from "./withdrawalClient";

export default function WithdrawalConsentScreen({
  authProvider,
  googleLoginHint = "",
}: {
  authProvider: WithdrawalProvider;
  googleLoginHint?: string;
}) {
  const router = useRouter();
  const submissionLock = useRef(createWithdrawalSubmissionLock());
  const googleScriptStatus = useRef<GoogleIdentityScriptStatus>("loading");
  const [consent, setConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!consent || submissionLock.current.current) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const result = await submitWithdrawal({
      consent,
      provider: authProvider,
      lock: submissionLock.current,
      requestWithdrawal,
      runGoogleRevoke:
        authProvider === "google"
          ? () =>
              revokeGoogleIdentityGrant({
                loginHint: googleLoginHint,
                getScriptStatus: () => googleScriptStatus.current,
              })
          : undefined,
      navigateToComplete: (googleRevokeStatus) => {
        const query = googleRevokeStatus
          ? `?googleRevokeStatus=${googleRevokeStatus}`
          : "";
        router.replace(`/my/withdraw/complete${query}`);
      },
    });

    if (result.status !== "success") {
      setErrorMessage(result.message);
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {authProvider === "google" ? (
        <Script
          id="google-identity-services"
          onError={() => {
            googleScriptStatus.current = "failed";
          }}
          onReady={() => {
            googleScriptStatus.current = "ready";
          }}
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
        />
      ) : null}
      <section className="-mx-5 -mb-24 -mt-5 flex min-h-dvh flex-col bg-white">
      <WithdrawalPageHeader
        backHref="/my"
        disabled={isSubmitting}
        title="회원 탈퇴"
      />

      <div className="border-b border-[#dbdbdb] px-4 pb-7 pt-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#121212] text-white">
          <Check aria-hidden="true" size={39} strokeWidth={2.1} />
        </div>
        <p className="mt-4 text-[17px] font-medium leading-7 text-[#303030]">
          모든 데이터가 삭제됩니다.
        </p>
      </div>

      <form className="flex flex-1 flex-col" onSubmit={handleSubmit}>
        <div className="px-4 pb-7 pt-4">
          <h2 className="text-base font-semibold leading-6 text-[#303030]">
            회원 탈퇴 전에 꼭 확인해 주세요.
          </h2>
          <ul className="mt-2 list-disc space-y-0.5 pl-6 text-[15px] font-normal leading-[23px] text-[#777777]">
            <li>게시 글 및 좋아요, 조회수 복구할 수 없습니다.</li>
            <li>
              회원 탈퇴 완료 후에는 동일한 계정으로
              <br />
              재가입해도 기존 데이터는 복구할 수 없습니다.
            </li>
            <li>회원 탈퇴가 완료되면 취소할 수 없습니다.</li>
          </ul>
        </div>

        <label className="flex min-h-14 cursor-pointer items-center gap-3 border-b border-t border-[#dbdbdb] px-5 text-base font-medium text-[#303030] has-[:disabled]:cursor-default">
          <input
            checked={consent}
            className="sr-only"
            disabled={isSubmitting}
            onChange={(event) => {
              setConsent(event.target.checked);
              setErrorMessage("");
            }}
            type="checkbox"
          />
          <span
            aria-hidden="true"
            className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border ${
              consent
                ? "border-[#121212] bg-[#121212] text-white"
                : "border-[#d7d7d7] bg-white"
            }`}
          >
            {consent ? <Check size={12} strokeWidth={2.5} /> : null}
          </span>
          동의합니다.
        </label>

        <div className="px-4 pb-8 pt-4">
          {errorMessage ? (
            <p
              className="mb-3 bg-red-50 px-3 py-2.5 text-sm font-medium leading-5 text-red-700"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}
          <button
            className="h-[52px] w-full bg-[#f04452] text-base font-semibold text-white active:brightness-95 disabled:bg-[#fac1c6] disabled:text-white"
            disabled={!consent || isSubmitting}
            type="submit"
          >
            {isSubmitting ? "처리 중..." : "회원 탈퇴"}
          </button>
        </div>
      </form>
      </section>
    </>
  );
}
