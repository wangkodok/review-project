import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import GoogleProvider, { type GoogleProfile } from "next-auth/providers/google";
import { resolveOrCreateUserByExternalIdentity } from "./externalIdentity";
import {
  hasActiveExternalAuthAccount,
  invalidateAuthToken,
} from "./sessionSecurity";
import {
  WITHDRAWAL_REAUTH_TTL_SECONDS,
  verifyWithdrawalReauthTarget,
  WithdrawalReauthStoreUnavailableError,
} from "./withdrawalReauth";

type WithdrawalReauthAuthContext = {
  flowId: string;
  originalToken: JWT | null;
};

type AuthRequestContext = {
  withdrawalReauth?: WithdrawalReauthAuthContext;
};

type WithdrawalSessionUpdate = {
  clearWithdrawalReauth?: boolean;
};

const WITHDRAWAL_REAUTH_TTL_MS = WITHDRAWAL_REAUTH_TTL_SECONDS * 1_000;

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

export const authSecret = requireEnv("AUTH_SECRET");
const authUrl = requireEnv("AUTH_URL");

process.env.NEXTAUTH_SECRET ??= authSecret;
process.env.NEXTAUTH_URL ??= authUrl;

function withdrawalErrorUrl(code: string) {
  const url = new URL("/my/withdraw", authUrl);
  url.searchParams.set("error", code);

  return url.toString();
}

function clearWithdrawalAuthToken(token: JWT) {
  delete token.providerAccessToken;
  delete token.providerAccessTokenExpiresAt;
  delete token.withdrawalFlowId;
  delete token.withdrawalReauthenticatedAt;
}

function hasCurrentWithdrawalAuthToken(token: JWT) {
  const now = Date.now();

  return (
    typeof token.withdrawalFlowId === "string" &&
    token.withdrawalFlowId.length > 0 &&
    typeof token.withdrawalReauthenticatedAt === "number" &&
    Number.isFinite(token.withdrawalReauthenticatedAt) &&
    token.withdrawalReauthenticatedAt <= now &&
    now - token.withdrawalReauthenticatedAt <= WITHDRAWAL_REAUTH_TTL_MS &&
    typeof token.providerAccessToken === "string" &&
    token.providerAccessToken.trim().length > 0 &&
    typeof token.providerAccessTokenExpiresAt === "number" &&
    token.providerAccessTokenExpiresAt > now
  );
}

function clearStaleWithdrawalAuthToken(token: JWT) {
  const hasWithdrawalAuthState = Boolean(
    token.withdrawalFlowId ||
      token.withdrawalReauthenticatedAt ||
      token.providerAccessToken ||
      token.providerAccessTokenExpiresAt,
  );

  if (hasWithdrawalAuthState && !hasCurrentWithdrawalAuthToken(token)) {
    clearWithdrawalAuthToken(token);
  }
}

function preserveWithdrawalSessionToken({
  originalToken,
  account,
  flowId,
  verifiedAt,
}: {
  originalToken: JWT;
  account: {
    access_token?: string;
    expires_at?: number;
  };
  flowId: string;
  verifiedAt: number;
}) {
  const token = { ...originalToken };
  const accessToken =
    typeof account.access_token === "string" && account.access_token.trim()
      ? account.access_token
      : null;

  token.withdrawalFlowId = flowId;
  token.withdrawalReauthenticatedAt = verifiedAt;

  if (accessToken) {
    token.providerAccessToken = accessToken;
  } else {
    delete token.providerAccessToken;
  }

  if (typeof account.expires_at === "number") {
    token.providerAccessTokenExpiresAt = account.expires_at * 1000;
  } else {
    delete token.providerAccessTokenExpiresAt;
  }

  delete token.authValidationUnavailable;
  delete token.authSessionInvalidated;

  return token;
}

export function createAuthOptions(
  requestContext: AuthRequestContext = {},
): NextAuthOptions {
  let withdrawalVerifiedAt: number | null = null;

  return {
    secret: authSecret,
    session: {
      strategy: "jwt",
    },
    providers: [
      GoogleProvider({
        clientId: requireEnv("AUTH_GOOGLE_ID"),
        clientSecret: requireEnv("AUTH_GOOGLE_SECRET"),
      }),
    ],
    callbacks: {
      async signIn({ account }) {
        const withdrawalReauth = requestContext.withdrawalReauth;

        if (!withdrawalReauth) {
          return true;
        }

        const originalToken = withdrawalReauth.originalToken;

        if (
          !originalToken?.userId ||
          originalToken.authProvider !== "google" ||
          originalToken.authValidationUnavailable
        ) {
          return withdrawalErrorUrl("session_invalid");
        }

        if (
          account?.provider !== "google" ||
          !account.providerAccountId
        ) {
          return withdrawalErrorUrl("provider_invalid");
        }

        const verifiedAt = Date.now();

        try {
          const verification = await verifyWithdrawalReauthTarget({
            flowId: withdrawalReauth.flowId,
            userId: originalToken.userId,
            provider: "google",
            providerAccountId: account.providerAccountId,
            verifiedAt,
          });

          if (verification === "verified") {
            withdrawalVerifiedAt = verifiedAt;
            return true;
          }

          if (verification === "account_mismatch") {
            return withdrawalErrorUrl("account_mismatch");
          }

          if (verification === "expired" || verification === "missing") {
            return withdrawalErrorUrl("flow_expired");
          }

          return withdrawalErrorUrl("flow_invalid");
        } catch (error) {
          if (error instanceof WithdrawalReauthStoreUnavailableError) {
            return withdrawalErrorUrl("state_unavailable");
          }

          return withdrawalErrorUrl("verification_failed");
        }
      },
      async jwt({ token, account, user, profile, trigger, session }) {
        const withdrawalReauth = requestContext.withdrawalReauth;

        if (withdrawalReauth) {
          if (
            withdrawalVerifiedAt === null ||
            !withdrawalReauth.originalToken?.userId ||
            account?.provider !== "google" ||
            !account.providerAccountId
          ) {
            invalidateAuthToken(token);
            return token;
          }

          return preserveWithdrawalSessionToken({
            originalToken: withdrawalReauth.originalToken,
            account,
            flowId: withdrawalReauth.flowId,
            verifiedAt: withdrawalVerifiedAt,
          });
        }

        const sessionUpdate = session as WithdrawalSessionUpdate | undefined;

        if (
          trigger === "update" &&
          sessionUpdate?.clearWithdrawalReauth === true
        ) {
          clearWithdrawalAuthToken(token);
        } else {
          clearStaleWithdrawalAuthToken(token);
        }

        if (account?.provider === "google" && account.providerAccountId) {
          const googleProfile = profile as Partial<GoogleProfile> | undefined;
          const providerEmail =
            typeof googleProfile?.email === "string"
              ? googleProfile.email
              : (user.email ?? null);
          const emailVerified =
            typeof googleProfile?.email_verified === "boolean"
              ? googleProfile.email_verified
              : null;
          const appUser = await resolveOrCreateUserByExternalIdentity({
            provider: "google",
            providerAccountId: account.providerAccountId,
            email: providerEmail,
            emailVerified,
          });

          token.userId = appUser.id;
          token.nickname = appUser.nickname;
          token.anonymousId = appUser.anonymousId;
          token.authProvider = appUser.authProvider;
          token.authenticatedAt = appUser.authenticatedAt;
          clearWithdrawalAuthToken(token);
          delete token.authValidationUnavailable;
          delete token.authSessionInvalidated;
        } else if (token.userId && token.authProvider) {
          try {
            const isActive = await hasActiveExternalAuthAccount({
              userId: token.userId,
              provider: token.authProvider,
            });

            if (isActive) {
              delete token.authValidationUnavailable;
              delete token.authSessionInvalidated;
            } else {
              invalidateAuthToken(token);
            }
          } catch {
            token.authValidationUnavailable = true;
          }
        } else {
          invalidateAuthToken(token);
        }

        return token;
      },
      async session({ session, token }) {
        if (token.authSessionInvalidated) {
          throw new Error("AUTH_SESSION_INVALIDATED");
        }

        if (!token.userId || token.authValidationUnavailable) {
          delete session.user;
        } else if (session.user) {
          session.user.id = token.userId;
          session.user.nickname = token.nickname;
          session.user.anonymousId = token.anonymousId;
          session.user.authProvider = token.authProvider;
        }

        return session;
      },
    },
    pages: {
      signIn: "/my",
    },
  };
}

export const authOptions = createAuthOptions();
