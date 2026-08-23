"use client";

import Image from "next/image";
import Link from "next/link";
import { LoaderCircle, RotateCcw } from "lucide-react";
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

  return (
    <div className={className}>
      {availableProviders === null ? (
        <div
          aria-label="로그인 방법을 불러오는 중"
          className="space-y-2"
          role="status"
        >
          <div className="flex aspect-[20/3] w-full items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50">
            <LoaderCircle
              aria-hidden="true"
              className="animate-spin text-neutral-400"
              size={20}
              strokeWidth={1.8}
            />
          </div>
          <div className="aspect-[20/3] w-full rounded-xl bg-neutral-100" />
        </div>
      ) : null}

      {availableProviders && availableProviders.length > 0 ? (
        <div className="space-y-2">
          {availableProviders.includes("google") ? (
            <button
              aria-label="Google로 로그인"
              className="relative flex aspect-[20/3] w-full items-center justify-center rounded-xl border border-[#747775] bg-white px-12 text-sm font-semibold text-[#1f1f1f] active:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={activeProvider !== null}
              onClick={() => void handleSignIn("google")}
              type="button"
            >
              <Image
                alt=""
                className="absolute left-3 h-5 w-5"
                height={20}
                src="/auth/google-g-logo.png"
                width={20}
              />
              <span>
                {activeProvider === "google" ? "로그인 중" : "Google로 로그인"}
              </span>
            </button>
          ) : null}

          {availableProviders.includes("kakao") ? (
            <button
              aria-label="카카오 로그인"
              className="relative aspect-[20/3] w-full overflow-hidden rounded-xl active:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={activeProvider !== null}
              onClick={() => void handleSignIn("kakao")}
              type="button"
            >
              <Image
                alt=""
                className="object-cover"
                fill
                priority
                sizes="(max-width: 430px) calc(100vw - 40px), 335px"
                src="/auth/kakao-login-large-wide.png"
              />
              <span className="sr-only">
                {activeProvider === "kakao" ? "로그인 중" : "카카오 로그인"}
              </span>
            </button>
          ) : null}
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
    </div>
  );
}
