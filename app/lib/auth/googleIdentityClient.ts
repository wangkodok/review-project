const GOOGLE_REVOKE_TIMEOUT_MS = 3_000;

export type GoogleRevokeResult =
  | "revoked"
  | "failed"
  | "unavailable"
  | "timed_out";

type GoogleRevocationResponse = {
  successful: boolean;
  error?: string;
};

export type GoogleIdentityApi = {
  accounts: {
    id: {
      revoke: (
        loginHint: string,
        callback: (response: GoogleRevocationResponse) => void,
      ) => void;
    };
  };
};

function getBrowserGoogleIdentity() {
  const value = (globalThis as { google?: unknown }).google;

  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<GoogleIdentityApi>;

  return typeof candidate.accounts?.id?.revoke === "function"
    ? (candidate as GoogleIdentityApi)
    : undefined;
}

export function revokeGoogleIdentityGrant({
  loginHint,
  googleIdentity = getBrowserGoogleIdentity(),
}: {
  loginHint: string;
  googleIdentity?: GoogleIdentityApi;
}): Promise<GoogleRevokeResult> {
  const normalizedLoginHint = loginHint.trim();

  if (!normalizedLoginHint || !googleIdentity) {
    return Promise.resolve("unavailable");
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: GoogleRevokeResult) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };
    const timeout = setTimeout(
      () => finish("timed_out"),
      GOOGLE_REVOKE_TIMEOUT_MS,
    );

    try {
      googleIdentity.accounts.id.revoke(normalizedLoginHint, (response) => {
        finish(response.successful ? "revoked" : "failed");
      });
    } catch {
      finish("failed");
    }
  });
}
