export type WithdrawalRequestParseResult =
  | { ok: true; value: { consent: true } }
  | {
      ok: false;
      code: "INVALID_REQUEST" | "WITHDRAWAL_CONSENT_REQUIRED";
    };

export function parseWithdrawalRequest(
  value: unknown,
): WithdrawalRequestParseResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, code: "INVALID_REQUEST" };
  }

  const input = value as Record<string, unknown>;
  const keys = Object.keys(input);

  if (keys.some((key) => key !== "consent") || keys.length > 1) {
    return { ok: false, code: "INVALID_REQUEST" };
  }

  if (!Object.hasOwn(input, "consent") || input.consent === false) {
    return { ok: false, code: "WITHDRAWAL_CONSENT_REQUIRED" };
  }

  if (input.consent !== true) {
    return { ok: false, code: "INVALID_REQUEST" };
  }

  return { ok: true, value: { consent: true } };
}
