import "server-only";

import {
  createRemoteJWKSet,
  decodeProtectedHeader,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";

export const KAKAO_ACCOUNT_EVENT_ISSUER = "https://kauth.kakao.com";
export const KAKAO_USER_UNLINKED_EVENT_SCHEMA =
  "https://schemas.openid.net/secevent/oauth/event-type/user-unlinked";

const KAKAO_JWKS_URL = new URL(
  "https://kauth.kakao.com/.well-known/jwks.json",
);
const KAKAO_SET_TYPE = "secevent+jwt";
const KAKAO_SET_ALGORITHM = "RS256";
const MAX_SET_BYTES = 16 * 1024;
const MAX_PROVIDER_ACCOUNT_ID_LENGTH = 255;
const MAX_EVENT_ID_LENGTH = 512;
const MAX_TRANSACTION_ID_LENGTH = 512;
const MAX_KEY_ID_LENGTH = 255;
const CLOCK_SKEW_SECONDS = 5 * 60;

const KAKAO_UNLINK_REASONS = [
  "ACCOUNT_DELETE",
  "FORCED_ACCOUNT_DELETE",
  "INCOMPLETE_SIGN_UP",
  "UNLINK_FROM_ADMIN",
  "UNLINK_FROM_APPS",
  "REVOKE_ACCOUNT_SERVICE_TERMS",
  "UNLINK_FROM_SERVICE",
] as const;

const kakaoRemoteJwkSet = createRemoteJWKSet(KAKAO_JWKS_URL, {
  cacheMaxAge: 10 * 60 * 1000,
  cooldownDuration: 30 * 1000,
  timeoutDuration: 1500,
});

export type KakaoUnlinkReason = (typeof KAKAO_UNLINK_REASONS)[number];

export type VerifiedKakaoAccountEvent = {
  provider: "kakao";
  providerAccountId: string;
  eventId: string;
  transactionId: string;
  reasonCode: KakaoUnlinkReason;
  occurredAt: string;
};

export type KakaoAccountEventSetErrorCode =
  | "invalid_request"
  | "invalid_key"
  | "invalid_issuer"
  | "invalid_audience"
  | "temporarily_unavailable";

type VerifyKakaoAccountEventSetOptions = {
  audience: string;
  currentTimeSeconds?: number;
  keySet?: JWTVerifyGetKey;
};

export class KakaoAccountEventSetError extends Error {
  constructor(public readonly code: KakaoAccountEventSetErrorCode) {
    super(code);
    this.name = "KakaoAccountEventSetError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength &&
    value === value.trim()
  );
}

function isKakaoUnlinkReason(value: unknown): value is KakaoUnlinkReason {
  return KAKAO_UNLINK_REASONS.some((reason) => reason === value);
}

function mapJoseError(error: unknown): KakaoAccountEventSetError {
  if (error instanceof KakaoAccountEventSetError) {
    return error;
  }

  if (!error || typeof error !== "object") {
    return new KakaoAccountEventSetError("temporarily_unavailable");
  }

  const joseError = error as {
    code?: unknown;
    claim?: unknown;
  };

  if (joseError.code === "ERR_JWT_CLAIM_VALIDATION_FAILED") {
    if (joseError.claim === "iss") {
      return new KakaoAccountEventSetError("invalid_issuer");
    }

    if (joseError.claim === "aud") {
      return new KakaoAccountEventSetError("invalid_audience");
    }

    return new KakaoAccountEventSetError("invalid_request");
  }

  if (
    joseError.code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" ||
    joseError.code === "ERR_JWKS_NO_MATCHING_KEY" ||
    joseError.code === "ERR_JWKS_MULTIPLE_MATCHING_KEYS"
  ) {
    return new KakaoAccountEventSetError("invalid_key");
  }

  if (joseError.code === "ERR_JWKS_TIMEOUT") {
    return new KakaoAccountEventSetError("temporarily_unavailable");
  }

  if (
    joseError.code === "ERR_JOSE_GENERIC" ||
    joseError.code === "ERR_JWKS_INVALID" ||
    joseError.code === "ERR_JWK_INVALID"
  ) {
    return new KakaoAccountEventSetError("temporarily_unavailable");
  }

  if (
    typeof joseError.code === "string" &&
    joseError.code.startsWith("ERR_")
  ) {
    return new KakaoAccountEventSetError("invalid_request");
  }

  return new KakaoAccountEventSetError("temporarily_unavailable");
}

function decodeKakaoProtectedHeader(token: string) {
  try {
    return decodeProtectedHeader(token);
  } catch {
    throw new KakaoAccountEventSetError("invalid_request");
  }
}

export async function verifyKakaoAccountEventSet(
  rawSet: string,
  options: VerifyKakaoAccountEventSetOptions,
): Promise<VerifiedKakaoAccountEvent> {
  try {
    const token = typeof rawSet === "string" ? rawSet.trim() : "";
    const audience = options.audience.trim();

    if (
      token.length === 0 ||
      Buffer.byteLength(token, "utf8") > MAX_SET_BYTES ||
      audience.length === 0
    ) {
      throw new KakaoAccountEventSetError("invalid_request");
    }

    const unverifiedHeader = decodeKakaoProtectedHeader(token);

    if (
      unverifiedHeader.alg !== KAKAO_SET_ALGORITHM ||
      unverifiedHeader.typ !== KAKAO_SET_TYPE ||
      !isBoundedString(unverifiedHeader.kid, MAX_KEY_ID_LENGTH)
    ) {
      throw new KakaoAccountEventSetError("invalid_request");
    }

    const { payload, protectedHeader } = await jwtVerify(
      token,
      options.keySet ?? kakaoRemoteJwkSet,
      {
        algorithms: [KAKAO_SET_ALGORITHM],
        audience,
        issuer: KAKAO_ACCOUNT_EVENT_ISSUER,
        requiredClaims: ["iss", "aud", "sub", "iat", "jti"],
        typ: KAKAO_SET_TYPE,
      },
    );

    if (
      protectedHeader.alg !== KAKAO_SET_ALGORITHM ||
      protectedHeader.typ !== KAKAO_SET_TYPE ||
      !isBoundedString(protectedHeader.kid, MAX_KEY_ID_LENGTH) ||
      payload.aud !== audience ||
      !isBoundedString(payload.sub, MAX_PROVIDER_ACCOUNT_ID_LENGTH) ||
      !isBoundedString(payload.jti, MAX_EVENT_ID_LENGTH)
    ) {
      throw new KakaoAccountEventSetError("invalid_request");
    }

    const transactionId = payload.txm;
    const occurredAtSeconds = payload.toe;
    const issuedAtSeconds = payload.iat;
    const events = payload.events;

    if (
      !isBoundedString(transactionId, MAX_TRANSACTION_ID_LENGTH) ||
      !Number.isSafeInteger(occurredAtSeconds) ||
      !Number.isSafeInteger(issuedAtSeconds) ||
      (occurredAtSeconds as number) <= 0 ||
      (issuedAtSeconds as number) <= 0 ||
      !isRecord(events) ||
      Object.keys(events).length !== 1
    ) {
      throw new KakaoAccountEventSetError("invalid_request");
    }

    const currentTimeSeconds =
      options.currentTimeSeconds ?? Math.floor(Date.now() / 1000);

    if (
      !Number.isSafeInteger(currentTimeSeconds) ||
      (issuedAtSeconds as number) > currentTimeSeconds + CLOCK_SKEW_SECONDS ||
      (occurredAtSeconds as number) > currentTimeSeconds + CLOCK_SKEW_SECONDS ||
      (occurredAtSeconds as number) >
        (issuedAtSeconds as number) + CLOCK_SKEW_SECONDS
    ) {
      throw new KakaoAccountEventSetError("invalid_request");
    }

    const event = events[KAKAO_USER_UNLINKED_EVENT_SCHEMA];

    if (!isRecord(event) || !isKakaoUnlinkReason(event.reason)) {
      throw new KakaoAccountEventSetError("invalid_request");
    }

    const subject = event.subject;

    if (
      !isRecord(subject) ||
      subject.subject_type !== "iss-sub" ||
      subject.iss !== KAKAO_ACCOUNT_EVENT_ISSUER ||
      subject.sub !== payload.sub
    ) {
      throw new KakaoAccountEventSetError("invalid_request");
    }

    const occurredAt = new Date((occurredAtSeconds as number) * 1000);

    if (Number.isNaN(occurredAt.getTime())) {
      throw new KakaoAccountEventSetError("invalid_request");
    }

    return {
      provider: "kakao",
      providerAccountId: payload.sub,
      eventId: payload.jti,
      transactionId,
      reasonCode: event.reason,
      occurredAt: occurredAt.toISOString(),
    };
  } catch (error) {
    throw mapJoseError(error);
  }
}
