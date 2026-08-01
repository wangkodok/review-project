import "server-only";

import { createSupabaseServerClient } from "../supabase/server";

const AUTH_PROVIDERS = ["google", "kakao"] as const;
const MAX_PROVIDER_ACCOUNT_ID_LENGTH = 255;
const MAX_EMAIL_LENGTH = 320;

export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export type ExternalIdentity = {
  provider: AuthProvider;
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean | null;
};

export type ResolvedExternalUser = {
  id: string;
  nickname: string;
  anonymousId: string;
  authProvider: AuthProvider;
  providerEmail: string | null;
  emailVerified: boolean | null;
  authenticatedAt: number;
  accountCreated: boolean;
};

export type ExternalIdentityErrorCode =
  | "UNSUPPORTED_AUTH_PROVIDER"
  | "INVALID_EXTERNAL_IDENTITY"
  | "EXTERNAL_ACCOUNT_CONFLICT"
  | "ACCOUNT_CREATION_FAILED"
  | "INTERNAL_SERVER_ERROR";

type ExternalIdentityRpcRow = {
  user_id: string;
  nickname: string;
  anonymous_id: string;
  provider: string;
  provider_email: string | null;
  email_verified: boolean | null;
  authenticated_at: string;
  account_created: boolean;
};

type NormalizedExternalIdentity = {
  provider: AuthProvider;
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean | null;
};

export class ExternalIdentityServiceError extends Error {
  constructor(public readonly code: ExternalIdentityErrorCode) {
    super(code);
    this.name = "ExternalIdentityServiceError";
  }
}

function isAuthProvider(value: string): value is AuthProvider {
  return AUTH_PROVIDERS.some((provider) => provider === value);
}

function normalizeExternalIdentity(identity: ExternalIdentity): NormalizedExternalIdentity {
  const provider =
    typeof identity.provider === "string" ? identity.provider.trim().toLowerCase() : "";

  if (!isAuthProvider(provider)) {
    throw new ExternalIdentityServiceError("UNSUPPORTED_AUTH_PROVIDER");
  }

  const providerAccountId =
    typeof identity.providerAccountId === "string" ? identity.providerAccountId.trim() : "";

  if (
    providerAccountId.length === 0 ||
    providerAccountId.length > MAX_PROVIDER_ACCOUNT_ID_LENGTH
  ) {
    throw new ExternalIdentityServiceError("INVALID_EXTERNAL_IDENTITY");
  }

  let email: string | null = null;

  if (identity.email !== null) {
    if (typeof identity.email !== "string") {
      throw new ExternalIdentityServiceError("INVALID_EXTERNAL_IDENTITY");
    }

    email = identity.email.trim() || null;

    if (email && email.length > MAX_EMAIL_LENGTH) {
      throw new ExternalIdentityServiceError("INVALID_EXTERNAL_IDENTITY");
    }
  }

  if (identity.emailVerified !== null && typeof identity.emailVerified !== "boolean") {
    throw new ExternalIdentityServiceError("INVALID_EXTERNAL_IDENTITY");
  }

  return {
    provider,
    providerAccountId,
    email,
    emailVerified: identity.emailVerified,
  };
}

function isExternalIdentityRpcRow(value: unknown): value is ExternalIdentityRpcRow {
  if (!value || typeof value !== "object") {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    typeof row.user_id === "string" &&
    row.user_id.length > 0 &&
    typeof row.nickname === "string" &&
    typeof row.anonymous_id === "string" &&
    typeof row.provider === "string" &&
    (row.provider_email === null || typeof row.provider_email === "string") &&
    (row.email_verified === null || typeof row.email_verified === "boolean") &&
    typeof row.authenticated_at === "string" &&
    !Number.isNaN(Date.parse(row.authenticated_at)) &&
    typeof row.account_created === "boolean"
  );
}

function mapRpcError(code: string | undefined): ExternalIdentityServiceError {
  if (code === "23505") {
    return new ExternalIdentityServiceError("EXTERNAL_ACCOUNT_CONFLICT");
  }

  if (code === "22023") {
    return new ExternalIdentityServiceError("INVALID_EXTERNAL_IDENTITY");
  }

  return new ExternalIdentityServiceError("ACCOUNT_CREATION_FAILED");
}

export async function resolveOrCreateUserByExternalIdentity(
  identity: ExternalIdentity,
): Promise<ResolvedExternalUser> {
  const normalizedIdentity = normalizeExternalIdentity(identity);
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("resolve_or_create_external_user_atomic", {
    p_provider: normalizedIdentity.provider,
    p_provider_account_id: normalizedIdentity.providerAccountId,
    p_provider_email: normalizedIdentity.email,
    p_email_verified: normalizedIdentity.emailVerified,
  });

  if (error) {
    throw mapRpcError(error.code);
  }

  if (!Array.isArray(data) || data.length !== 1 || !isExternalIdentityRpcRow(data[0])) {
    throw new ExternalIdentityServiceError("INTERNAL_SERVER_ERROR");
  }

  const row = data[0];

  if (!isAuthProvider(row.provider) || row.provider !== normalizedIdentity.provider) {
    throw new ExternalIdentityServiceError("INTERNAL_SERVER_ERROR");
  }

  return {
    id: row.user_id,
    nickname: row.nickname,
    anonymousId: row.anonymous_id,
    authProvider: row.provider,
    providerEmail: row.provider_email,
    emailVerified: row.email_verified,
    authenticatedAt: Date.parse(row.authenticated_at),
    accountCreated: row.account_created,
  };
}
