"use client";

import { useQueryClient } from "@tanstack/react-query";
import { signIn } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AuthSessionDialog from "./AuthSessionDialog";
import { createAuthSessionLifecycle, registerAuthSessionWake, type ClientAuthSession } from "./sessionLifecycle";

export async function loadClientAuthSession(): Promise<ClientAuthSession | null> {
  const response = await fetch("/api/auth/session?readOnly=true", { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) throw new Error("AUTH_SESSION_UNAVAILABLE");
  return response.json();
}

export async function clearExpiredAuthSession(): Promise<boolean> {
  const csrfResponse = await fetch("/api/auth/csrf", { cache: "no-store", credentials: "same-origin" });
  if (!csrfResponse.ok) throw new Error("AUTH_LOGOUT_UNAVAILABLE");
  const csrf = await csrfResponse.json();
  if (typeof csrf?.csrfToken !== "string" || !csrf.csrfToken) throw new Error("AUTH_LOGOUT_UNAVAILABLE");
  const response = await fetch("/api/auth/signout", {
    method: "POST",
    credentials: "same-origin",
    body: new URLSearchParams({ csrfToken: csrf.csrfToken, callbackUrl: "/my", json: "true", expireOnly: "true" }),
  });
  if (response.status === 409) return false;
  if (!response.ok) throw new Error("AUTH_LOGOUT_UNAVAILABLE");
  const result = await response.json();
  if (typeof result?.url !== "string") throw new Error("AUTH_LOGOUT_UNAVAILABLE");
  const callback = new URL(result.url, "http://localhost");
  if (callback.pathname !== "/my" || callback.search || callback.hash) throw new Error("AUTH_LOGOUT_UNAVAILABLE");
  const latest = await loadClientAuthSession();
  if (latest?.authValidationUnavailable) throw new Error("AUTH_LOGOUT_UNAVAILABLE");
  return !latest?.user;
}

export default function AuthSessionLifecycle({ onIdentityChange }: { onIdentityChange: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const lifecycleRef = useRef<ReturnType<typeof createAuthSessionLifecycle> | null>(null);
  const consentPendingRef = useRef(false);
  const [session, setSession] = useState<ClientAuthSession | null>(null);
  const [expiredNotice, setExpiredNotice] = useState(false);
  const [dismissedConsentKey, setDismissedConsentKey] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let previousLoginKey: string | null | undefined;
    let refreshedForGuest = false;
    const refreshAuthUI = () => {
      queryClient.clear();
      onIdentityChange();
      router.refresh();
    };
    const lifecycle = createAuthSessionLifecycle({
      loadSession: loadClientAuthSession,
      clearSession: clearExpiredAuthSession,
      onSession(nextSession) {
        const nextKey = nextSession?.user
          ? `${nextSession.user.id}:${nextSession.user.authProvider}:${nextSession.expires}`
          : null;
        if (previousLoginKey !== undefined && previousLoginKey !== nextKey) {
          refreshAuthUI();
          refreshedForGuest = nextKey === null;
        }
        previousLoginKey = nextKey;
        setSession(nextSession);
        if (nextKey) {
          refreshedForGuest = false;
          setExpiredNotice(false);
        }
      },
      onExpired() {
        if (!refreshedForGuest) refreshAuthUI();
        refreshedForGuest = true;
        setExpiredNotice(true);
      },
    });
    lifecycleRef.current = lifecycle;
    const cleanupWake = registerAuthSessionWake(window, document, () => {
      consentPendingRef.current = false;
      setIsPending(false);
      void lifecycle.refresh();
    });
    void lifecycle.refresh();
    return () => {
      lifecycle.stop();
      cleanupWake();
      lifecycleRef.current = null;
    };
  }, [queryClient, router, onIdentityChange]);

  useEffect(() => { void lifecycleRef.current?.refresh(); }, [pathname]);

  const consentKey = session?.user?.authProvider === "kakao" && session.user.kakaoEmailConsentRequired
    ? `${session.user.id}:${session.expires}`
    : null;
  const kind = expiredNotice ? "expired" : consentKey && consentKey !== dismissedConsentKey ? "kakao-email" : null;

  function closeNotice() {
    if (kind === "kakao-email") setDismissedConsentKey(consentKey);
    setExpiredNotice(false);
    setErrorMessage("");
  }

  async function confirmNotice() {
    if (kind === "expired") {
      closeNotice();
      router.push("/my");
      return;
    }
    if (kind !== "kakao-email" || consentPendingRef.current) return;
    consentPendingRef.current = true;
    setIsPending(true);
    setErrorMessage("");
    try {
      const callbackUrl = `${window.location.pathname}${window.location.search}`;
      await signIn("kakao", { callbackUrl });
    } catch {
      consentPendingRef.current = false;
      setIsPending(false);
      setErrorMessage("동의를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }

  return <AuthSessionDialog kind={kind} isPending={isPending} errorMessage={errorMessage}
    onClose={closeNotice} onConfirm={() => void confirmNotice()} />;
}
