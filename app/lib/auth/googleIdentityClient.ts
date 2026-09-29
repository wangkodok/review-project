import type { GoogleRevokeStatus } from "./googleRevokeStatus";

const GOOGLE_REVOKE_TIMEOUT_MS = 3_000;
const GOOGLE_IDENTITY_POLL_INTERVAL_MS = 25;

export type GoogleIdentityScriptStatus = "loading" | "ready" | "failed";

type GoogleRevocationResponse = {
  successful: boolean;
  error?: string;
};

export type GoogleIdentityApi = {
  accounts: {
    id: {
      initialize: (configuration: { client_id: string }) => void;
      revoke: (
        loginHint: string,
        callback: (response: GoogleRevocationResponse) => void,
      ) => void;
    };
  };
};

const initializedGoogleIdentityClients = new WeakMap<
  GoogleIdentityApi,
  string
>();

function getBrowserGoogleIdentity() {
  const value = (globalThis as { google?: unknown }).google;

  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<GoogleIdentityApi>;

  return typeof candidate.accounts?.id?.initialize === "function" &&
    typeof candidate.accounts.id.revoke === "function"
    ? (candidate as GoogleIdentityApi)
    : undefined;
}

export function revokeGoogleIdentityGrant({
  clientId,
  loginHint,
  getGoogleIdentity = getBrowserGoogleIdentity,
  getScriptStatus = () => "loading",
}: {
  clientId: string;
  loginHint: string;
  getGoogleIdentity?: () => GoogleIdentityApi | undefined;
  getScriptStatus?: () => GoogleIdentityScriptStatus;
}): Promise<GoogleRevokeStatus> {
  const normalizedClientId = clientId.trim();
  const normalizedLoginHint = loginHint.trim();

  if (!normalizedClientId || !normalizedLoginHint) {
    return Promise.resolve("not_attempted");
  }

  return new Promise((resolve) => {
    let settled = false;
    let revokeStarted = false;

    const finish = (result: GoogleRevokeStatus) => {
      if (settled) {
        return;
      }

      settled = true;
      clearInterval(poll);
      clearTimeout(timeout);
      resolve(result);
    };

    const attemptRevoke = () => {
      if (revokeStarted || settled) {
        return;
      }

      try {
        const googleIdentity = getGoogleIdentity();

        if (!googleIdentity) {
          if (getScriptStatus() === "failed") {
            finish("not_attempted");
          }
          return;
        }

        revokeStarted = true;
        clearInterval(poll);
        if (
          initializedGoogleIdentityClients.get(googleIdentity) !==
          normalizedClientId
        ) {
          googleIdentity.accounts.id.initialize({
            client_id: normalizedClientId,
          });
          initializedGoogleIdentityClients.set(
            googleIdentity,
            normalizedClientId,
          );
        }
        googleIdentity.accounts.id.revoke(normalizedLoginHint, (response) => {
          finish(response.successful ? "success" : "failed");
        });
      } catch {
        finish("failed");
      }
    };

    const timeout = setTimeout(
      () => finish("timeout"),
      GOOGLE_REVOKE_TIMEOUT_MS,
    );
    const poll = setInterval(attemptRevoke, GOOGLE_IDENTITY_POLL_INTERVAL_MS);
    attemptRevoke();
  });
}
