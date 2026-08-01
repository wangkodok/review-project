import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Redis } from "@upstash/redis";
import type { AuthProvider } from "./externalIdentity";

export const WITHDRAWAL_REAUTH_TTL_SECONDS = 10 * 60;

const FLOW_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const MAX_IDENTIFIER_LENGTH = 512;
const STATE_VERSION = 1;
const MAX_FLOW_ID_ATTEMPTS = 3;

type WithdrawalReauthStatus =
  | "pending"
  | "verified"
  | "processing"
  | "provider_revoked";

type StoredWithdrawalReauthState = {
  version: typeof STATE_VERSION;
  userFingerprint: string;
  provider: AuthProvider;
  providerAccountFingerprint: string;
  csrfNonceHash: string;
  status: WithdrawalReauthStatus;
  requestedAt: number;
  verifiedAt: number | null;
  expiresAt: number;
};

export type WithdrawalReauthStateSummary = Pick<
  StoredWithdrawalReauthState,
  "status" | "requestedAt" | "verifiedAt" | "expiresAt"
>;

export type VerifyWithdrawalReauthTargetResult =
  | "verified"
  | "missing"
  | "expired"
  | "account_mismatch"
  | "invalid_status"
  | "invalid_state";

export type WithdrawalReauthStateForTargetResult =
  | {
      status: "found";
      state: WithdrawalReauthStateSummary;
    }
  | {
      status: "missing" | "expired" | "account_mismatch";
    };

export type BeginWithdrawalFinalizationResult =
  | "processing_started"
  | "provider_revoked"
  | "missing"
  | "expired"
  | "account_mismatch"
  | "csrf_mismatch"
  | "already_processing"
  | "invalid_status"
  | "invalid_state";

export type MarkWithdrawalProviderRevokedResult =
  | "marked"
  | "already_marked"
  | "missing"
  | "expired"
  | "account_mismatch"
  | "invalid_status"
  | "invalid_state";

export type ReleaseWithdrawalFinalizationResult =
  | "released"
  | "already_released"
  | "missing"
  | "expired"
  | "account_mismatch"
  | "invalid_status"
  | "invalid_state";

export class WithdrawalReauthStoreUnavailableError extends Error {
  constructor() {
    super("Withdrawal reauthentication store is unavailable");
    this.name = "WithdrawalReauthStoreUnavailableError";
  }
}

let redisClient: Redis | null | undefined;

function getRequiredSecret() {
  const secret = process.env.AUTH_SECRET?.trim();

  if (!secret) {
    throw new WithdrawalReauthStoreUnavailableError();
  }

  return secret;
}

function getRedisClient() {
  if (redisClient !== undefined) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token || !url.startsWith("https://")) {
    redisClient = null;
    return redisClient;
  }

  try {
    redisClient = new Redis({
      url,
      token,
      automaticDeserialization: false,
    });
  } catch {
    redisClient = null;
  }

  return redisClient;
}

function requireRedisClient() {
  const redis = getRedisClient();

  if (!redis) {
    throw new WithdrawalReauthStoreUnavailableError();
  }

  return redis;
}

function normalizeIdentifier(value: string) {
  const normalized = value.trim();

  if (!normalized || normalized.length > MAX_IDENTIFIER_LENGTH) {
    throw new Error("Invalid withdrawal reauthentication identifier");
  }

  return normalized;
}

function normalizeFlowId(flowId: string) {
  const normalized = flowId.trim();

  if (!FLOW_ID_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
}

function createFingerprint(label: string, value: string) {
  return createHmac("sha256", getRequiredSecret())
    .update(label)
    .update("\0")
    .update(normalizeIdentifier(value))
    .digest("base64url");
}

function safeFingerprintEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function getEnvironmentPrefix() {
  const environment =
    process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";

  return environment.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 32);
}

function getStateKey(flowId: string) {
  return `food-review:${getEnvironmentPrefix()}:withdrawal-reauth:${flowId}`;
}

function isWithdrawalReauthStatus(
  value: unknown,
): value is WithdrawalReauthStatus {
  return (
    value === "pending" ||
    value === "verified" ||
    value === "processing" ||
    value === "provider_revoked"
  );
}

function parseStoredState(value: string): StoredWithdrawalReauthState | null {
  try {
    const state = JSON.parse(value) as Partial<StoredWithdrawalReauthState>;

    if (
      state.version !== STATE_VERSION ||
      typeof state.userFingerprint !== "string" ||
      (state.provider !== "google" && state.provider !== "kakao") ||
      typeof state.providerAccountFingerprint !== "string" ||
      typeof state.csrfNonceHash !== "string" ||
      !isWithdrawalReauthStatus(state.status) ||
      typeof state.requestedAt !== "number" ||
      (state.verifiedAt !== null && typeof state.verifiedAt !== "number") ||
      typeof state.expiresAt !== "number"
    ) {
      return null;
    }

    return state as StoredWithdrawalReauthState;
  } catch {
    return null;
  }
}

async function readStoredState(flowId: string) {
  const normalizedFlowId = normalizeFlowId(flowId);

  if (!normalizedFlowId) {
    return null;
  }

  try {
    const value = await requireRedisClient().get<string>(
      getStateKey(normalizedFlowId),
    );

    if (typeof value !== "string") {
      return null;
    }

    return parseStoredState(value);
  } catch (error) {
    if (error instanceof WithdrawalReauthStoreUnavailableError) {
      throw error;
    }

    throw new WithdrawalReauthStoreUnavailableError();
  }
}

export async function createWithdrawalReauthState({
  userId,
  provider,
  providerAccountId,
}: {
  userId: string;
  provider: AuthProvider;
  providerAccountId: string;
}) {
  const userFingerprint = createFingerprint("withdrawal-user", userId);
  const providerAccountFingerprint = createFingerprint(
    `withdrawal-provider-account:${provider}`,
    providerAccountId,
  );
  const csrfNonce = randomBytes(32).toString("base64url");
  const csrfNonceHash = createFingerprint("withdrawal-csrf", csrfNonce);
  const requestedAt = Date.now();
  const expiresAt = requestedAt + WITHDRAWAL_REAUTH_TTL_SECONDS * 1_000;
  const redis = requireRedisClient();

  for (let attempt = 0; attempt < MAX_FLOW_ID_ATTEMPTS; attempt += 1) {
    const flowId = randomBytes(32).toString("base64url");
    const state: StoredWithdrawalReauthState = {
      version: STATE_VERSION,
      userFingerprint,
      provider,
      providerAccountFingerprint,
      csrfNonceHash,
      status: "pending",
      requestedAt,
      verifiedAt: null,
      expiresAt,
    };

    try {
      const result = await redis.set(
        getStateKey(flowId),
        JSON.stringify(state),
        {
          ex: WITHDRAWAL_REAUTH_TTL_SECONDS,
          nx: true,
        },
      );

      if (result === "OK") {
        return {
          flowId,
          csrfNonce,
          expiresAt,
        };
      }
    } catch {
      throw new WithdrawalReauthStoreUnavailableError();
    }
  }

  throw new WithdrawalReauthStoreUnavailableError();
}

export async function getWithdrawalReauthStateSummary(
  flowId: string,
): Promise<WithdrawalReauthStateSummary | null> {
  const state = await readStoredState(flowId);

  if (!state) {
    return null;
  }

  if (state.expiresAt <= Date.now()) {
    await deleteWithdrawalReauthState(flowId);
    return null;
  }

  return {
    status: state.status,
    requestedAt: state.requestedAt,
    verifiedAt: state.verifiedAt,
    expiresAt: state.expiresAt,
  };
}

export async function getWithdrawalReauthStateForTarget({
  flowId,
  userId,
  provider,
  providerAccountId,
}: {
  flowId: string;
  userId: string;
  provider: AuthProvider;
  providerAccountId: string;
}): Promise<WithdrawalReauthStateForTargetResult> {
  const state = await readStoredState(flowId);

  if (!state) {
    return { status: "missing" };
  }

  if (state.expiresAt <= Date.now()) {
    await deleteWithdrawalReauthState(flowId);
    return { status: "expired" };
  }

  const userFingerprint = createFingerprint("withdrawal-user", userId);
  const providerAccountFingerprint = createFingerprint(
    `withdrawal-provider-account:${provider}`,
    providerAccountId,
  );
  const matchesTarget =
    state.provider === provider &&
    safeFingerprintEqual(state.userFingerprint, userFingerprint) &&
    safeFingerprintEqual(
      state.providerAccountFingerprint,
      providerAccountFingerprint,
    );

  if (!matchesTarget) {
    return { status: "account_mismatch" };
  }

  return {
    status: "found",
    state: {
      status: state.status,
      requestedAt: state.requestedAt,
      verifiedAt: state.verifiedAt,
      expiresAt: state.expiresAt,
    },
  };
}

export async function withdrawalReauthCsrfMatches({
  flowId,
  csrfNonce,
}: {
  flowId: string;
  csrfNonce: string;
}) {
  const state = await readStoredState(flowId);

  if (!state || state.expiresAt <= Date.now()) {
    return false;
  }

  const csrfNonceHash = createFingerprint("withdrawal-csrf", csrfNonce);

  return safeFingerprintEqual(state.csrfNonceHash, csrfNonceHash);
}

export async function verifyWithdrawalReauthTarget({
  flowId,
  userId,
  provider,
  providerAccountId,
  verifiedAt = Date.now(),
}: {
  flowId: string;
  userId: string;
  provider: AuthProvider;
  providerAccountId: string;
  verifiedAt?: number;
}): Promise<VerifyWithdrawalReauthTargetResult> {
  const normalizedFlowId = normalizeFlowId(flowId);

  if (!normalizedFlowId || !Number.isFinite(verifiedAt)) {
    return "invalid_state";
  }

  const userFingerprint = createFingerprint("withdrawal-user", userId);
  const providerAccountFingerprint = createFingerprint(
    `withdrawal-provider-account:${provider}`,
    providerAccountId,
  );
  const script = `
    local raw = redis.call("GET", KEYS[1])
    if not raw then
      return "missing"
    end

    local decoded, state = pcall(cjson.decode, raw)
    if not decoded or state.version ~= tonumber(ARGV[1]) then
      return "invalid_state"
    end

    if tonumber(state.expiresAt) <= tonumber(ARGV[6]) then
      redis.call("DEL", KEYS[1])
      return "expired"
    end

    if state.status ~= "pending" then
      return "invalid_status"
    end

    if state.userFingerprint ~= ARGV[2]
      or state.provider ~= ARGV[3]
      or state.providerAccountFingerprint ~= ARGV[4] then
      return "account_mismatch"
    end

    state.status = "verified"
    state.verifiedAt = tonumber(ARGV[5])
    redis.call("SET", KEYS[1], cjson.encode(state), "KEEPTTL")
    return "verified"
  `;

  try {
    return await requireRedisClient().eval<
      string[],
      VerifyWithdrawalReauthTargetResult
    >(script, [getStateKey(normalizedFlowId)], [
      String(STATE_VERSION),
      userFingerprint,
      provider,
      providerAccountFingerprint,
      String(verifiedAt),
      String(Date.now()),
    ]);
  } catch (error) {
    if (error instanceof WithdrawalReauthStoreUnavailableError) {
      throw error;
    }

    throw new WithdrawalReauthStoreUnavailableError();
  }
}

export async function beginWithdrawalFinalization({
  flowId,
  userId,
  provider,
  providerAccountId,
  csrfNonce,
  verifiedAt,
}: {
  flowId: string;
  userId: string;
  provider: AuthProvider;
  providerAccountId: string;
  csrfNonce: string;
  verifiedAt: number;
}): Promise<BeginWithdrawalFinalizationResult> {
  const normalizedFlowId = normalizeFlowId(flowId);

  if (!normalizedFlowId || !Number.isFinite(verifiedAt)) {
    return "invalid_state";
  }

  const userFingerprint = createFingerprint("withdrawal-user", userId);
  const providerAccountFingerprint = createFingerprint(
    `withdrawal-provider-account:${provider}`,
    providerAccountId,
  );
  const csrfNonceHash = createFingerprint("withdrawal-csrf", csrfNonce);
  const script = `
    local raw = redis.call("GET", KEYS[1])
    if not raw then
      return "missing"
    end

    local decoded, state = pcall(cjson.decode, raw)
    if not decoded or state.version ~= tonumber(ARGV[1]) then
      return "invalid_state"
    end

    if type(state.expiresAt) ~= "number"
      or state.expiresAt <= tonumber(ARGV[7]) then
      redis.call("DEL", KEYS[1])
      return "expired"
    end

    if state.userFingerprint ~= ARGV[2]
      or state.provider ~= ARGV[3]
      or state.providerAccountFingerprint ~= ARGV[4] then
      return "account_mismatch"
    end

    if state.csrfNonceHash ~= ARGV[5] then
      return "csrf_mismatch"
    end

    if type(state.requestedAt) ~= "number"
      or type(state.verifiedAt) ~= "number"
      or state.verifiedAt ~= tonumber(ARGV[6])
      or state.verifiedAt < state.requestedAt
      or state.verifiedAt > tonumber(ARGV[7]) then
      return "invalid_state"
    end

    if state.status == "provider_revoked" then
      return "provider_revoked"
    end

    if state.status == "processing" then
      return "already_processing"
    end

    if state.status ~= "verified" then
      return "invalid_status"
    end

    state.status = "processing"
    redis.call("SET", KEYS[1], cjson.encode(state), "KEEPTTL")
    return "processing_started"
  `;

  try {
    return await requireRedisClient().eval<
      string[],
      BeginWithdrawalFinalizationResult
    >(script, [getStateKey(normalizedFlowId)], [
      String(STATE_VERSION),
      userFingerprint,
      provider,
      providerAccountFingerprint,
      csrfNonceHash,
      String(verifiedAt),
      String(Date.now()),
    ]);
  } catch (error) {
    if (error instanceof WithdrawalReauthStoreUnavailableError) {
      throw error;
    }

    throw new WithdrawalReauthStoreUnavailableError();
  }
}

export async function markWithdrawalProviderRevoked({
  flowId,
  userId,
  provider,
  providerAccountId,
}: {
  flowId: string;
  userId: string;
  provider: AuthProvider;
  providerAccountId: string;
}): Promise<MarkWithdrawalProviderRevokedResult> {
  const normalizedFlowId = normalizeFlowId(flowId);

  if (!normalizedFlowId) {
    return "invalid_state";
  }

  const userFingerprint = createFingerprint("withdrawal-user", userId);
  const providerAccountFingerprint = createFingerprint(
    `withdrawal-provider-account:${provider}`,
    providerAccountId,
  );
  const script = `
    local raw = redis.call("GET", KEYS[1])
    if not raw then
      return "missing"
    end

    local decoded, state = pcall(cjson.decode, raw)
    if not decoded or state.version ~= tonumber(ARGV[1]) then
      return "invalid_state"
    end

    if type(state.expiresAt) ~= "number"
      or state.expiresAt <= tonumber(ARGV[5]) then
      redis.call("DEL", KEYS[1])
      return "expired"
    end

    if state.userFingerprint ~= ARGV[2]
      or state.provider ~= ARGV[3]
      or state.providerAccountFingerprint ~= ARGV[4] then
      return "account_mismatch"
    end

    if state.status == "provider_revoked" then
      return "already_marked"
    end

    if state.status ~= "processing" then
      return "invalid_status"
    end

    state.status = "provider_revoked"
    redis.call("SET", KEYS[1], cjson.encode(state), "KEEPTTL")
    return "marked"
  `;

  try {
    return await requireRedisClient().eval<
      string[],
      MarkWithdrawalProviderRevokedResult
    >(script, [getStateKey(normalizedFlowId)], [
      String(STATE_VERSION),
      userFingerprint,
      provider,
      providerAccountFingerprint,
      String(Date.now()),
    ]);
  } catch (error) {
    if (error instanceof WithdrawalReauthStoreUnavailableError) {
      throw error;
    }

    throw new WithdrawalReauthStoreUnavailableError();
  }
}

export async function releaseWithdrawalFinalization({
  flowId,
  userId,
  provider,
  providerAccountId,
}: {
  flowId: string;
  userId: string;
  provider: AuthProvider;
  providerAccountId: string;
}): Promise<ReleaseWithdrawalFinalizationResult> {
  const normalizedFlowId = normalizeFlowId(flowId);

  if (!normalizedFlowId) {
    return "invalid_state";
  }

  const userFingerprint = createFingerprint("withdrawal-user", userId);
  const providerAccountFingerprint = createFingerprint(
    `withdrawal-provider-account:${provider}`,
    providerAccountId,
  );
  const script = `
    local raw = redis.call("GET", KEYS[1])
    if not raw then
      return "missing"
    end

    local decoded, state = pcall(cjson.decode, raw)
    if not decoded or state.version ~= tonumber(ARGV[1]) then
      return "invalid_state"
    end

    if type(state.expiresAt) ~= "number"
      or state.expiresAt <= tonumber(ARGV[5]) then
      redis.call("DEL", KEYS[1])
      return "expired"
    end

    if state.userFingerprint ~= ARGV[2]
      or state.provider ~= ARGV[3]
      or state.providerAccountFingerprint ~= ARGV[4] then
      return "account_mismatch"
    end

    if state.status == "verified" then
      return "already_released"
    end

    if state.status ~= "processing" then
      return "invalid_status"
    end

    state.status = "verified"
    redis.call("SET", KEYS[1], cjson.encode(state), "KEEPTTL")
    return "released"
  `;

  try {
    return await requireRedisClient().eval<
      string[],
      ReleaseWithdrawalFinalizationResult
    >(script, [getStateKey(normalizedFlowId)], [
      String(STATE_VERSION),
      userFingerprint,
      provider,
      providerAccountFingerprint,
      String(Date.now()),
    ]);
  } catch (error) {
    if (error instanceof WithdrawalReauthStoreUnavailableError) {
      throw error;
    }

    throw new WithdrawalReauthStoreUnavailableError();
  }
}

export async function deleteWithdrawalReauthState(flowId: string) {
  const normalizedFlowId = normalizeFlowId(flowId);

  if (!normalizedFlowId) {
    return;
  }

  try {
    await requireRedisClient().del(getStateKey(normalizedFlowId));
  } catch (error) {
    if (error instanceof WithdrawalReauthStoreUnavailableError) {
      throw error;
    }

    throw new WithdrawalReauthStoreUnavailableError();
  }
}
