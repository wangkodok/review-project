import "server-only";

import type { JWT } from "next-auth/jwt";
import type { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "../supabase/server";
import type { AuthProvider } from "./externalIdentity";

const NEXT_AUTH_SESSION_COOKIE_PATTERN =
  /^(?:__Secure-)?next-auth\.session-token(?:\.\d+)?$/;
const NEXT_AUTH_SESSION_COOKIE_NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
] as const;

type AuthAccountRow = {
  user_id: string;
  provider_account_id: string;
};

export async function getActiveExternalAuthAccount({
  userId,
  provider,
}: {
  userId: string;
  provider: AuthProvider;
}) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("auth_accounts")
    .select("user_id,provider_account_id")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle<AuthAccountRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    userId: data.user_id,
    provider,
    providerAccountId: data.provider_account_id,
  };
}

export async function hasActiveExternalAuthAccount({
  userId,
  provider,
}: {
  userId: string;
  provider: AuthProvider;
}) {
  const account = await getActiveExternalAuthAccount({ userId, provider });

  return Boolean(account);
}

export function invalidateAuthToken(token: JWT) {
  delete token.userId;
  delete token.nickname;
  delete token.anonymousId;
  delete token.authenticatedAt;
  delete token.authProvider;
  delete token.providerAccessToken;
  delete token.providerAccessTokenExpiresAt;
  delete token.name;
  delete token.email;
  delete token.picture;
  delete token.sub;
  delete token.authValidationUnavailable;
  delete token.withdrawalFlowId;
  delete token.withdrawalReauthenticatedAt;
  token.authSessionInvalidated = true;
}

export function expireCurrentAuthSessionCookies(
  request: NextRequest,
  response: NextResponse,
) {
  const cookieNames = new Set<string>(NEXT_AUTH_SESSION_COOKIE_NAMES);

  for (const cookie of request.cookies.getAll()) {
    if (NEXT_AUTH_SESSION_COOKIE_PATTERN.test(cookie.name)) {
      cookieNames.add(cookie.name);
    }
  }

  for (const name of cookieNames) {
    response.cookies.set({
      name,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: name.startsWith("__Secure-"),
      path: "/",
      expires: new Date(0),
      maxAge: 0,
    });
  }
}
