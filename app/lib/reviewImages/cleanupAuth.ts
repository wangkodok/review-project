import "server-only";

import { timingSafeEqual } from "node:crypto";

export type ReviewImageCleanupAuthStatus =
  | "authorized"
  | "misconfigured"
  | "unauthorized";

function isValidCronSecret(secret: string | undefined) {
  return Boolean(
    secret &&
      secret.length >= 32 &&
      secret.length <= 256 &&
      !/[\r\n]/.test(secret),
  );
}

export function getReviewImageCleanupAuthStatus(
  authorizationHeader: string | null,
): ReviewImageCleanupAuthStatus {
  const secret = process.env.CRON_SECRET;

  if (!isValidCronSecret(secret)) {
    return "misconfigured";
  }

  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authorizationHeader ?? "");

  if (actual.length !== expected.length) {
    return "unauthorized";
  }

  return timingSafeEqual(actual, expected) ? "authorized" : "unauthorized";
}
