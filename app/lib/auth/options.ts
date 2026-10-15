import type { NextAuthOptions } from "next-auth";
import GoogleProvider, { type GoogleProfile } from "next-auth/providers/google";
import KakaoProvider, { type KakaoProfile } from "next-auth/providers/kakao";
import { resolveOrCreateUserByExternalIdentity } from "./externalIdentity";
import { AUTH_SESSION_MAX_AGE_SECONDS, getAuthSessionDeadline, isAuthSessionExpired } from "./sessionPolicy";
import { decodeAuthSessionToken } from "./sessionToken";
import {
  hasActiveExternalAuthAccount,
  getKakaoEmailConsentRequired,
  invalidateAuthToken,
} from "./sessionSecurity";

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function isFeatureEnabled(name: string) {
  const value = process.env[name];

  if (!value || value === "false") {
    return false;
  }

  if (value === "true") {
    return true;
  }

  throw new Error(`${name} must be true or false`);
}

export const authSecret = requireEnv("AUTH_SECRET");
const authUrl = requireEnv("AUTH_URL");
const isKakaoAuthEnabled = isFeatureEnabled("AUTH_KAKAO_ENABLED");

process.env.NEXTAUTH_SECRET ??= authSecret;
process.env.NEXTAUTH_URL ??= authUrl;

function clearDefaultProfileClaims(token: {
  name?: string | null;
  email?: string | null;
  picture?: string | null;
}) {
  delete token.name;
  delete token.email;
  delete token.picture;
}

function clearLegacyWithdrawalClaims(token: Record<string, unknown>) {
  delete token.providerAccessToken;
  delete token.providerAccessTokenExpiresAt;
  delete token.withdrawalFlowId;
  delete token.withdrawalReauthenticatedAt;
}

export function createAuthOptions(): NextAuthOptions {
  const providers: NextAuthOptions["providers"] = [
    GoogleProvider({
      clientId: requireEnv("AUTH_GOOGLE_ID"),
      clientSecret: requireEnv("AUTH_GOOGLE_SECRET"),
    }),
  ];

  if (isKakaoAuthEnabled) {
    providers.push(
      KakaoProvider({
        clientId: requireEnv("AUTH_KAKAO_ID"),
        clientSecret: requireEnv("AUTH_KAKAO_SECRET"),
        authorization: { params: { scope: "account_email" } },
      }),
    );
  }

  return {
    secret: authSecret,
    session: {
      strategy: "jwt",
      maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
    },
    jwt: {
      maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
      decode: decodeAuthSessionToken,
    },
    providers,
    callbacks: {
      async jwt({ token, account, user, profile }) {
        if (
          account?.providerAccountId &&
          (account.provider === "google" || account.provider === "kakao")
        ) {
          let providerEmail: string | null = null;
          let emailVerified: boolean | null = null;

          if (account.provider === "google") {
            const googleProfile = profile as Partial<GoogleProfile> | undefined;
            providerEmail =
              typeof googleProfile?.email === "string"
                ? googleProfile.email
                : (user.email ?? null);
            emailVerified =
              typeof googleProfile?.email_verified === "boolean"
                ? googleProfile.email_verified
                : null;
          } else {
            const kakaoProfile = profile as Partial<KakaoProfile> | undefined;
            const kakaoAccount = kakaoProfile?.kakao_account;

            providerEmail =
              typeof kakaoAccount?.email === "string"
                ? kakaoAccount.email
                : null;
            emailVerified =
              typeof kakaoAccount?.is_email_verified === "boolean"
                ? kakaoAccount.is_email_verified
                : null;
          }

          const appUser = await resolveOrCreateUserByExternalIdentity({
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            email: providerEmail,
            emailVerified,
          });

          token.userId = appUser.id;
          token.nickname = appUser.nickname;
          token.anonymousId = appUser.anonymousId;
          token.authProvider = appUser.authProvider;
          token.authenticatedAt = appUser.authenticatedAt;
          token.kakaoEmailConsentRequired =
            account.provider === "kakao" && !providerEmail;
          delete token.authValidationUnavailable;
          delete token.authSessionInvalidated;
          delete token.authSessionExpired;
        } else if (token.userId && token.authProvider && isAuthSessionExpired(token.authenticatedAt)) {
          token.authSessionExpired = true;
          invalidateAuthToken(token);
        } else if (token.userId && token.authProvider) {
          try {
            const isActive = await hasActiveExternalAuthAccount({
              userId: token.userId,
              provider: token.authProvider,
            });

            if (isActive) {
              if (token.authProvider === "kakao" && token.kakaoEmailConsentRequired !== false) {
                token.kakaoEmailConsentRequired = await getKakaoEmailConsentRequired(token.userId);
              }
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

        clearDefaultProfileClaims(token);
        clearLegacyWithdrawalClaims(token);
        return token;
      },
      async session({ session, token }) {
        session.serverTime = Date.now();
        session.sessionExpired = token.authSessionExpired === true;
        session.authValidationUnavailable = token.authValidationUnavailable === true;
        if (token.authSessionInvalidated || (token.userId && isAuthSessionExpired(token.authenticatedAt))) {
          session.sessionExpired = token.authSessionExpired === true || Boolean(token.userId);
          delete session.user;
          return session;
        }

        if (
          !token.userId ||
          !token.authProvider ||
          token.authValidationUnavailable
        ) {
          delete session.user;
        } else {
          session.expires = new Date(getAuthSessionDeadline(token.authenticatedAt)!).toISOString();
          session.user = {
            id: token.userId,
            nickname: token.nickname,
            anonymousId: token.anonymousId,
            authProvider: token.authProvider,
            kakaoEmailConsentRequired: token.kakaoEmailConsentRequired === true,
          };
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
