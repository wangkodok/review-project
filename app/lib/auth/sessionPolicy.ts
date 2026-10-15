export const AUTH_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;
const AUTH_SESSION_MAX_AGE_MS = AUTH_SESSION_MAX_AGE_SECONDS * 1000;
const AUTH_CLOCK_TOLERANCE_MS = 60_000;

export function getAuthSessionDeadline(authenticatedAt: unknown): number | null {
  if (typeof authenticatedAt !== "number" || !Number.isSafeInteger(authenticatedAt) || authenticatedAt <= 0) {
    return null;
  }

  return authenticatedAt + AUTH_SESSION_MAX_AGE_MS;
}

export function isAuthSessionExpired(authenticatedAt: unknown, now = Date.now()) {
  const deadline = getAuthSessionDeadline(authenticatedAt);
  return deadline === null || (authenticatedAt as number) > now + AUTH_CLOCK_TOLERANCE_MS || now >= deadline;
}
