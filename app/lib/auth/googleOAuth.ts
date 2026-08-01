import "server-only";

const GOOGLE_TOKEN_REVOCATION_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_TOKEN_REVOCATION_TIMEOUT_MS = 5_000;

export async function revokeGoogleOAuthGrant(accessToken: string) {
  const normalizedAccessToken = accessToken.trim();

  if (!normalizedAccessToken) {
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    GOOGLE_TOKEN_REVOCATION_TIMEOUT_MS,
  );

  try {
    const response = await fetch(GOOGLE_TOKEN_REVOCATION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        token: normalizedAccessToken,
      }),
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
