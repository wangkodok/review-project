import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  errors,
  SignJWT,
  type JWTVerifyGetKey,
  type KeyLike,
} from "jose";
import {
  KAKAO_ACCOUNT_EVENT_ISSUER,
  KAKAO_USER_UNLINKED_EVENT_SCHEMA,
  verifyKakaoAccountEventSet,
} from "./kakaoAccountEventSet";

const AUDIENCE = "test-kakao-rest-api-key";
const KEY_ID = "test-kakao-key";
const CURRENT_TIME_SECONDS = 1_800_000_000;

let privateKey: KeyLike;
let localKeySet: JWTVerifyGetKey;

function createPayload() {
  return {
    iss: KAKAO_ACCOUNT_EVENT_ISSUER,
    aud: AUDIENCE,
    sub: "123456789",
    iat: CURRENT_TIME_SECONDS - 60,
    jti: "event-123",
    txm: "transaction-123",
    toe: CURRENT_TIME_SECONDS - 120,
    events: {
      [KAKAO_USER_UNLINKED_EVENT_SCHEMA]: {
        subject: {
          subject_type: "iss-sub",
          iss: KAKAO_ACCOUNT_EVENT_ISSUER,
          sub: "123456789",
        },
        reason: "UNLINK_FROM_APPS",
      },
    },
  };
}

async function signPayload(
  payload: Record<string, unknown>,
  options: {
    key?: KeyLike;
    algorithm?: string;
    type?: string;
    keyId?: string;
  } = {},
) {
  return new SignJWT(payload)
    .setProtectedHeader({
      alg: options.algorithm ?? "RS256",
      typ: options.type ?? "secevent+jwt",
      kid: options.keyId ?? KEY_ID,
    })
    .sign(options.key ?? privateKey);
}

function verify(rawSet: string, audience = AUDIENCE) {
  return verifyKakaoAccountEventSet(rawSet, {
    audience,
    currentTimeSeconds: CURRENT_TIME_SECONDS,
    keySet: localKeySet,
  });
}

describe("verifyKakaoAccountEventSet", () => {
  beforeAll(async () => {
    const keyPair = await generateKeyPair("RS256");
    privateKey = keyPair.privateKey;

    const publicJwk = await exportJWK(keyPair.publicKey);
    localKeySet = createLocalJWKSet({
      keys: [
        {
          ...publicJwk,
          alg: "RS256",
          kid: KEY_ID,
          use: "sig",
        },
      ],
    });
  });

  it("verifies a valid Kakao user-unlinked SET", async () => {
    const rawSet = await signPayload(createPayload());

    await expect(verify(rawSet)).resolves.toEqual({
      provider: "kakao",
      providerAccountId: "123456789",
      eventId: "event-123",
      transactionId: "transaction-123",
      reasonCode: "UNLINK_FROM_APPS",
      occurredAt: new Date((CURRENT_TIME_SECONDS - 120) * 1000).toISOString(),
    });
  });

  it("accepts a correctly signed old event so the database can classify staleness", async () => {
    const payload = createPayload();
    payload.iat = CURRENT_TIME_SECONDS - 90 * 24 * 60 * 60;
    payload.toe = payload.iat - 60;

    await expect(verify(await signPayload(payload))).resolves.toMatchObject({
      eventId: "event-123",
      providerAccountId: "123456789",
    });
  });

  it("maps an invalid issuer to Kakao's invalid_issuer response code", async () => {
    const payload = createPayload();
    payload.iss = "https://attacker.example";

    await expect(verify(await signPayload(payload))).rejects.toMatchObject({
      code: "invalid_issuer",
    });
  });

  it("maps an invalid audience to Kakao's invalid_audience response code", async () => {
    const rawSet = await signPayload(createPayload());

    await expect(verify(rawSet, "different-audience")).rejects.toMatchObject({
      code: "invalid_audience",
    });
  });

  it("rejects a signature that does not match the configured JWKS", async () => {
    const otherKeyPair = await generateKeyPair("RS256");
    const rawSet = await signPayload(createPayload(), {
      key: otherKeyPair.privateKey,
    });

    await expect(verify(rawSet)).rejects.toMatchObject({
      code: "invalid_key",
    });
  });

  it("treats a Kakao JWKS HTTP or parsing failure as retryable", async () => {
    const rawSet = await signPayload(createPayload());

    await expect(
      verifyKakaoAccountEventSet(rawSet, {
        audience: AUDIENCE,
        currentTimeSeconds: CURRENT_TIME_SECONDS,
        keySet: async () => {
          throw new errors.JOSEError("Kakao JWKS is temporarily unavailable");
        },
      }),
    ).rejects.toMatchObject({
      code: "temporarily_unavailable",
    });
  });

  it.each([
    ["wrong type", { type: "JWT" }],
    ["wrong algorithm", { algorithm: "PS256" }],
    ["blank key id", { keyId: "" }],
  ])("rejects a %s protected header", async (_name, headerOptions) => {
    let signingKey = privateKey;

    if (
      "algorithm" in headerOptions &&
      headerOptions.algorithm === "PS256"
    ) {
      signingKey = (await generateKeyPair("PS256")).privateKey;
    }

    const rawSet = await signPayload(createPayload(), {
      ...headerOptions,
      key: signingKey,
    });

    await expect(verify(rawSet)).rejects.toMatchObject({
      code: "invalid_request",
    });
  });

  it.each([
    ["a mismatched subject", (payload: ReturnType<typeof createPayload>) => {
      payload.events[KAKAO_USER_UNLINKED_EVENT_SCHEMA].subject.sub = "different";
    }],
    ["an unsupported reason", (payload: ReturnType<typeof createPayload>) => {
      payload.events[KAKAO_USER_UNLINKED_EVENT_SCHEMA].reason = "UNKNOWN_REASON";
    }],
    ["more than one event", (payload: ReturnType<typeof createPayload>) => {
      (payload.events as Record<string, unknown>)[
        "https://example.com/another-event"
      ] = {};
    }],
    ["a future issue time", (payload: ReturnType<typeof createPayload>) => {
      payload.iat = CURRENT_TIME_SECONDS + 10 * 60;
    }],
  ])("rejects a payload with %s", async (_name, mutatePayload) => {
    const payload = createPayload();
    mutatePayload(payload);

    await expect(verify(await signPayload(payload))).rejects.toMatchObject({
      code: "invalid_request",
    });
  });

  it("rejects a body larger than the webhook boundary", async () => {
    await expect(verify("a".repeat(16 * 1024 + 1))).rejects.toMatchObject({
      code: "invalid_request",
    });
  });

  it("rejects a malformed compact token as an invalid request", async () => {
    await expect(verify("not-a-valid-set")).rejects.toMatchObject({
      code: "invalid_request",
    });
  });
});
