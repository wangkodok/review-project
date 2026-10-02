import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveOrCreateUserByExternalIdentity: vi.fn(),
  hasActiveExternalAuthAccount: vi.fn(),
  invalidateAuthToken: vi.fn(),
  googleProvider: vi.fn((options) => ({ id: "google", options })),
  kakaoProvider: vi.fn((options) => ({ id: "kakao", options })),
}));

vi.mock("next-auth/providers/google", () => ({
  default: mocks.googleProvider,
}));
vi.mock("next-auth/providers/kakao", () => ({
  default: mocks.kakaoProvider,
}));
vi.mock("./externalIdentity", () => ({
  resolveOrCreateUserByExternalIdentity:
    mocks.resolveOrCreateUserByExternalIdentity,
}));
vi.mock("./sessionSecurity", () => ({
  hasActiveExternalAuthAccount: mocks.hasActiveExternalAuthAccount,
  invalidateAuthToken: mocks.invalidateAuthToken,
}));

let createAuthOptions: typeof import("./options").createAuthOptions;

const appUser = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  nickname: "테스트 사용자",
  anonymousId: "익명1234",
  authProvider: "google" as const,
  authenticatedAt: 1_700_000_000_000,
};

beforeAll(async () => {
  vi.stubEnv("AUTH_SECRET", "test-auth-secret");
  vi.stubEnv("AUTH_URL", "http://localhost:3000");
  vi.stubEnv("AUTH_GOOGLE_ID", "test-google-id");
  vi.stubEnv("AUTH_GOOGLE_SECRET", "test-google-secret");
  vi.stubEnv("AUTH_KAKAO_ENABLED", "true");
  vi.stubEnv("AUTH_KAKAO_ID", "test-kakao-id");
  vi.stubEnv("AUTH_KAKAO_SECRET", "test-kakao-secret");

  ({ createAuthOptions } = await import("./options"));
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("createAuthOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveOrCreateUserByExternalIdentity.mockResolvedValue(appUser);
    mocks.hasActiveExternalAuthAccount.mockResolvedValue(true);
  });

  it("creates a normal Google session without retaining the provider access token", async () => {
    const jwt = createAuthOptions().callbacks?.jwt;
    expect(jwt).toBeTypeOf("function");

    const token = await jwt!({
      token: {},
      account: {
        provider: "google",
        providerAccountId: "google-account-id",
        type: "oauth",
        access_token: "must-not-be-retained",
      },
      user: { id: "provider-user", email: "user@example.com" },
      profile: {
        sub: "google-account-id",
        email: "user@example.com",
        email_verified: true,
      } as never,
      trigger: "signIn",
      session: undefined,
      isNewUser: false,
    });

    expect(mocks.resolveOrCreateUserByExternalIdentity).toHaveBeenCalledWith({
      provider: "google",
      providerAccountId: "google-account-id",
      email: "user@example.com",
      emailVerified: true,
    });
    expect(token).toMatchObject({
      userId: appUser.id,
      nickname: appUser.nickname,
      anonymousId: appUser.anonymousId,
      authProvider: "google",
      authenticatedAt: appUser.authenticatedAt,
    });
    expect(JSON.stringify(token)).not.toContain("must-not-be-retained");
  });

  it("creates a normal Kakao session while keeping an absent email nullable", async () => {
    mocks.resolveOrCreateUserByExternalIdentity.mockResolvedValue({
      ...appUser,
      authProvider: "kakao",
    });
    const jwt = createAuthOptions().callbacks?.jwt;

    const token = await jwt!({
      token: {},
      account: {
        provider: "kakao",
        providerAccountId: "123456789",
        type: "oauth",
        access_token: "must-not-be-retained",
      },
      user: { id: "provider-user" },
      profile: { id: 123456789, kakao_account: {} } as never,
      trigger: "signIn",
      session: undefined,
      isNewUser: false,
    });

    expect(mocks.resolveOrCreateUserByExternalIdentity).toHaveBeenCalledWith({
      provider: "kakao",
      providerAccountId: "123456789",
      email: null,
      emailVerified: null,
    });
    expect(token.authProvider).toBe("kakao");
    expect(JSON.stringify(token)).not.toContain("must-not-be-retained");
  });

  it("keeps an existing active session without recreating its account", async () => {
    const jwt = createAuthOptions().callbacks?.jwt;
    const existingToken = {
      userId: appUser.id,
      nickname: appUser.nickname,
      anonymousId: appUser.anonymousId,
      authProvider: "google" as const,
      authenticatedAt: appUser.authenticatedAt,
    };

    const token = await jwt!({
      token: existingToken,
      account: null,
      user: {} as never,
      profile: undefined,
      trigger: undefined,
      session: undefined,
      isNewUser: false,
    });

    expect(mocks.hasActiveExternalAuthAccount).toHaveBeenCalledWith({
      userId: appUser.id,
      provider: "google",
    });
    expect(mocks.resolveOrCreateUserByExternalIdentity).not.toHaveBeenCalled();
    expect(token).toMatchObject(existingToken);
  });

  it("scrubs legacy withdrawal secrets from an existing active session", async () => {
    const jwt = createAuthOptions().callbacks?.jwt;
    const token = await jwt!({
      token: {
        userId: appUser.id,
        nickname: appUser.nickname,
        anonymousId: appUser.anonymousId,
        authProvider: "google",
        authenticatedAt: appUser.authenticatedAt,
        providerAccessToken: "legacy-provider-access-token",
        providerAccessTokenExpiresAt: Date.now() + 60_000,
        withdrawalFlowId: "legacy-flow-id",
        withdrawalReauthenticatedAt: Date.now(),
      },
      account: null,
      user: {} as never,
      profile: undefined,
      trigger: undefined,
      session: undefined,
      isNewUser: false,
    });

    expect(mocks.hasActiveExternalAuthAccount).toHaveBeenCalledWith({
      userId: appUser.id,
      provider: "google",
    });
    expect(token).not.toHaveProperty("providerAccessToken");
    expect(token).not.toHaveProperty("providerAccessTokenExpiresAt");
    expect(token).not.toHaveProperty("withdrawalFlowId");
    expect(token).not.toHaveProperty("withdrawalReauthenticatedAt");
  });

  it("treats an invalidated token as an unauthenticated session without throwing", async () => {
    const session = createAuthOptions().callbacks?.session;
    expect(session).toBeTypeOf("function");

    const result = await session!({
      session: {
        user: {
          id: appUser.id,
          nickname: appUser.nickname,
          anonymousId: appUser.anonymousId,
          authProvider: "google",
        },
        expires: "2099-01-01T00:00:00.000Z",
      },
      token: {
        authSessionInvalidated: true,
      },
    } as never);

    expect(result.user).toBeUndefined();
  });
});
