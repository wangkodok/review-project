"use client";

import Image from "next/image";
import Link from "next/link";
import { LoaderCircle, MessageCircle, RotateCcw } from "lucide-react";
import { getProviders, signIn } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

const LOGIN_PROVIDER_ORDER = ["google", "kakao"] as const;
const PROVIDER_LOAD_ERROR_MESSAGE =
  "로그인 방법을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
const SIGN_IN_ERROR_MESSAGE =
  "로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.";

type LoginProviderId = (typeof LOGIN_PROVIDER_ORDER)[number];

type LoginOptionsProps = {
  callbackUrl?: string;
  className?: string;
  variant?: "default" | "my-guest" | "review-write-dialog";
};

function getSafeCallbackUrl(callbackUrl: string) {
  if (!callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) {
    return "/my";
  }

  return callbackUrl;
}

export default function LoginOptions({
  callbackUrl = "/my",
  className = "",
  variant = "default",
}: LoginOptionsProps) {
  const [availableProviders, setAvailableProviders] = useState<
    LoginProviderId[] | null
  >(null);
  const [activeProvider, setActiveProvider] = useState<LoginProviderId | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);
  const safeCallbackUrl = useMemo(
    () => getSafeCallbackUrl(callbackUrl),
    [callbackUrl],
  );
  const isMyGuestVariant = variant === "my-guest";
  const isReviewWriteDialogVariant = variant === "review-write-dialog";
  const isKoreanVariant = isMyGuestVariant || isReviewWriteDialogVariant;

  useEffect(() => {
    let isCancelled = false;

    async function loadProviders() {
      try {
        const providers = await getProviders();
        const enabledProviders = LOGIN_PROVIDER_ORDER.filter(
          (providerId) => providers?.[providerId],
        );

        if (enabledProviders.length === 0) {
          throw new Error("No supported login provider is available.");
        }

        if (!isCancelled) {
          setAvailableProviders(enabledProviders);
          setErrorMessage("");
        }
      } catch {
        if (!isCancelled) {
          setAvailableProviders([]);
          setErrorMessage(PROVIDER_LOAD_ERROR_MESSAGE);
        }
      }
    }

    void loadProviders();

    return () => {
      isCancelled = true;
    };
  }, [requestVersion]);

  async function handleSignIn(providerId: LoginProviderId) {
    if (activeProvider) {
      return;
    }

    setActiveProvider(providerId);
    setErrorMessage("");

    try {
      await signIn(providerId, { callbackUrl: safeCallbackUrl });
    } catch {
      setActiveProvider(null);
      setErrorMessage(SIGN_IN_ERROR_MESSAGE);
    }
  }

  function retryProviderLoad() {
    setAvailableProviders(null);
    setErrorMessage("");
    setRequestVersion((currentVersion) => currentVersion + 1);
  }

  const googleLoginButton = availableProviders?.includes("google") ? (
    <button
      aria-label={isKoreanVariant ? "구글 로그인" : "Google로 로그인"}
      className={
        isKoreanVariant
          ? `relative flex w-full items-center justify-center border border-[#dbdbdb] bg-white px-12 text-base font-medium leading-6 text-[#121212] active:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 ${
              isReviewWriteDialogVariant
                ? "h-14 rounded-[8px]"
                : "h-[52px] rounded-[4px]"
            }`
          : "relative flex aspect-[20/3] w-full items-center justify-center rounded-xl border border-[#747775] bg-white px-12 text-sm font-semibold text-[#1f1f1f] active:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
      }
      disabled={activeProvider !== null}
      onClick={() => void handleSignIn("google")}
      type="button"
    >
      <Image
        alt=""
        className={`absolute ${
          isReviewWriteDialogVariant
            ? "left-4 h-[18px] w-[18px]"
            : `h-5 w-5 ${isKoreanVariant ? "left-4" : "left-3"}`
        }`}
        height={20}
        src="/auth/google-g-logo.png"
        width={20}
      />
      <span>
        {activeProvider === "google"
          ? "로그인 중"
          : isKoreanVariant
            ? "구글 로그인"
            : "Google로 로그인"}
      </span>
    </button>
  ) : null;

  const kakaoLoginButton = availableProviders?.includes("kakao") ? (
    <button
      aria-label="카카오 로그인"
      className={
        isReviewWriteDialogVariant
          ? "relative flex h-14 w-full items-center justify-center rounded-[8px] bg-[#fee500] px-12 text-base font-medium leading-6 text-[#121212] active:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          : isKoreanVariant
            ? "relative h-[52px] w-full overflow-hidden rounded-[4px] active:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          : "relative aspect-[20/3] w-full overflow-hidden rounded-xl active:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
      }
      disabled={activeProvider !== null}
      onClick={() => void handleSignIn("kakao")}
      type="button"
    >
      {isReviewWriteDialogVariant ? (
        <>
          <MessageCircle
            aria-hidden="true"
            className="absolute left-4 h-[21px] w-[21px] fill-current"
            strokeWidth={2}
          />
          <span>
            {activeProvider === "kakao" ? "로그인 중" : "카카오 로그인"}
          </span>
        </>
      ) : (
        <>
          <Image
            alt=""
            className="object-cover"
            fill
            priority
            sizes={
              isKoreanVariant
                ? "(max-width: 480px) calc(100vw - 32px), 448px"
                : "(max-width: 430px) calc(100vw - 40px), 335px"
            }
            src="/auth/kakao-login-large-wide.png"
          />
          <span className="sr-only">
            {activeProvider === "kakao" ? "로그인 중" : "카카오 로그인"}
          </span>
        </>
      )}
    </button>
  ) : null;

  return (
    <div className={className}>
      {availableProviders === null ? (
        <div
          aria-label="로그인 방법을 불러오는 중"
          className="space-y-2"
          role="status"
        >
          <div
            className={`flex w-full items-center justify-center border border-neutral-200 bg-neutral-50 ${
              isReviewWriteDialogVariant
                ? "h-14 rounded-[8px]"
                : isMyGuestVariant
                  ? "h-[52px] rounded-[4px]"
                  : "aspect-[20/3] rounded-xl"
            }`}
          >
            <LoaderCircle
              aria-hidden="true"
              className="animate-spin text-neutral-400"
              size={20}
              strokeWidth={1.8}
            />
          </div>
          <div
            className={`w-full bg-neutral-100 ${
              isReviewWriteDialogVariant
                ? "h-14 rounded-[8px]"
                : isMyGuestVariant
                  ? "h-[52px] rounded-[4px]"
                  : "aspect-[20/3] rounded-xl"
            }`}
          />
        </div>
      ) : null}

      {availableProviders && availableProviders.length > 0 ? (
        <div className="flex flex-col gap-2">
          {isKoreanVariant ? kakaoLoginButton : googleLoginButton}
          {isKoreanVariant ? googleLoginButton : kakaoLoginButton}
        </div>
      ) : null}

      {errorMessage ? (
        <div
          aria-live="polite"
          className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-center"
          role="alert"
        >
          <p className="text-sm leading-6 text-red-700">{errorMessage}</p>
          {availableProviders?.length === 0 ? (
            <button
              className="mt-2 inline-flex h-9 items-center justify-center gap-2 px-3 text-sm font-semibold text-red-700 active:text-red-900"
              onClick={retryProviderLoad}
              type="button"
            >
              <RotateCcw aria-hidden="true" size={16} strokeWidth={1.8} />
              다시 시도
            </button>
          ) : null}
        </div>
      ) : null}

      {!isKoreanVariant ? (
        <p className="mt-4 text-center text-xs leading-5 text-neutral-500">
          로그인 전에{" "}
          <Link
            className="font-semibold text-neutral-700 underline decoration-neutral-300 underline-offset-4 active:text-neutral-950"
            href="/privacy"
          >
            개인정보처리방침
          </Link>
          을 확인해 주세요.
        </p>
      ) : null}
    </div>
  );
}
