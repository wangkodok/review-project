import { createHmac } from "node:crypto";

const MIN_SECRET_LENGTH = 32;

export function isValidRateLimitIdentifierSecret(
  value: string | undefined,
) {
  return typeof value === "string" && value.trim().length >= MIN_SECRET_LENGTH;
}

export function createRateLimitIdentifier(
  identifier: string,
  secret: string,
) {
  if (!isValidRateLimitIdentifierSecret(secret)) {
    throw new Error("RATE_LIMIT_IDENTIFIER_SECRET is invalid");
  }

  return createHmac("sha256", secret.trim())
    .update(identifier, "utf8")
    .digest("base64url");
}
