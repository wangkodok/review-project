export {};

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      nickname?: string;
      anonymousId?: string;
      authProvider: "google" | "kakao";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    nickname?: string;
    anonymousId?: string;
    authenticatedAt?: number;
    authProvider?: "google" | "kakao";
    providerAccessToken?: string;
    providerAccessTokenExpiresAt?: number;
    authValidationUnavailable?: boolean;
    authSessionInvalidated?: boolean;
    withdrawalFlowId?: string;
    withdrawalReauthenticatedAt?: number;
  }
}
