export const GOOGLE_REVOKE_STATUSES = [
  "success",
  "failed",
  "timeout",
  "not_attempted",
] as const;

export type GoogleRevokeStatus = (typeof GOOGLE_REVOKE_STATUSES)[number];

export function isGoogleRevokeStatus(
  value: unknown,
): value is GoogleRevokeStatus {
  return GOOGLE_REVOKE_STATUSES.some((status) => status === value);
}
