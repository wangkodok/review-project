export type ClientAuthSession = {
  user?: { id: string; authProvider: "google" | "kakao"; kakaoEmailConsentRequired?: boolean };
  expires?: string;
  sessionExpired?: boolean;
  authValidationUnavailable?: boolean;
  serverTime?: number;
};

type LifecycleOptions = {
  loadSession: () => Promise<ClientAuthSession | null>;
  clearSession: () => Promise<unknown>;
  onSession: (session: ClientAuthSession | null) => void;
  onExpired: () => void;
};

export function registerAuthSessionWake(
  windowTarget: EventTarget,
  documentTarget: EventTarget & { visibilityState: string },
  refresh: () => void,
) {
  const onVisibility = () => { if (documentTarget.visibilityState === "visible") refresh(); };
  windowTarget.addEventListener("pageshow", refresh);
  windowTarget.addEventListener("focus", refresh);
  windowTarget.addEventListener("online", refresh);
  documentTarget.addEventListener("visibilitychange", onVisibility);
  return () => {
    windowTarget.removeEventListener("pageshow", refresh);
    windowTarget.removeEventListener("focus", refresh);
    windowTarget.removeEventListener("online", refresh);
    documentTarget.removeEventListener("visibilitychange", onVisibility);
  };
}

export function createAuthSessionLifecycle(options: LifecycleOptions) {
  let stopped = false;
  let pendingRefresh: Promise<void> | null = null;
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  let lastDeadline: number | null = null;
  let expiredNotified = false;

  function clearDeadlineTimer() {
    clearTimeout(deadlineTimer);
    deadlineTimer = undefined;
  }

  function getDeadline(session: ClientAuthSession | null) {
    const deadline = session?.expires ? Date.parse(session.expires) : NaN;
    if (!session?.user || !Number.isFinite(deadline)) return null;
    return typeof session.serverTime === "number" && Number.isFinite(session.serverTime)
      ? Date.now() + deadline - session.serverTime
      : deadline;
  }

  function acceptActiveSession(session: ClientAuthSession | null) {
    const deadline = getDeadline(session);
    if (deadline === null || session?.sessionExpired) {
      return false;
    }

    clearDeadlineTimer();
    lastDeadline = deadline;
    expiredNotified = false;
    options.onSession(session);
    const remaining = deadline - Date.now();
    deadlineTimer = setTimeout(() => void refresh(), remaining > 0 ? remaining : 1000);
    return true;
  }

  async function checkSession() {
    try {
      const session = await options.loadSession();
      if (stopped || session?.authValidationUnavailable) return;
      if (acceptActiveSession(session)) return;

      const deadline = getDeadline(session) ?? lastDeadline;
      const expired = session?.sessionExpired || (deadline !== null && deadline <= Date.now());
      if (expired && !expiredNotified) {
        // Cookies are shared across tabs: recheck before clearing an older login.
        const latest = await options.loadSession();
        if (stopped || latest?.authValidationUnavailable) return;
        if (acceptActiveSession(latest)) return;
        const cleared = await options.clearSession();
        if (stopped) return;
        if (cleared === false) {
          const changed = await options.loadSession();
          if (!stopped && !changed?.authValidationUnavailable) acceptActiveSession(changed);
          return;
        }
        expiredNotified = true;
        clearDeadlineTimer();
        lastDeadline = null;
        options.onSession(null);
        options.onExpired();
      } else if (!expired) {
        clearDeadlineTimer();
        lastDeadline = null;
        options.onSession(null);
      }
    } catch {
      // An unavailable session endpoint is not proof of logout. A wake/poll retries.
    }
  }

  function refresh(): Promise<void> {
    if (stopped) return Promise.resolve();
    if (!pendingRefresh) {
      pendingRefresh = checkSession().finally(() => { pendingRefresh = null; });
    }
    return pendingRefresh;
  }

  const pollTimer = setInterval(() => void refresh(), 60_000);
  return {
    refresh,
    stop() {
      stopped = true;
      clearDeadlineTimer();
      clearInterval(pollTimer);
    },
  };
}
