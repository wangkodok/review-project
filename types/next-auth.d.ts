export {};

declare module "next-auth" {
  interface Session {
    sessionExpired?: boolean;
    authValidationUnavailable?: boolean;
    serverTime?: number;
    user?: {
      id: string;
      nickname?: string;
      anonymousId?: string;
      authProvider: "google" | "kakao";
      kakaoEmailConsentRequired?: boolean;
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
    authValidationUnavailable?: boolean;
    authSessionInvalidated?: boolean;
    kakaoEmailConsentRequired?: boolean;
    authSessionExpired?: boolean;
  }
}
