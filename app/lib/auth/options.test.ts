import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { encode } from "next-auth/jwt";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  resolveOrCreateUserByExternalIdentity: vi.fn(),
  hasActiveExternalAuthAccount: vi.fn(),
  getKakaoEmailConsentRequired: vi.fn(),
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
  getKakaoEmailConsentRequired: mocks.getKakaoEmailConsentRequired,
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

afterEach(() => vi.useRealTimers());

describe("createAuthOptions", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(appUser.authenticatedAt + 60_000);
    vi.clearAllMocks();
    mocks.resolveOrCreateUserByExternalIdentity.mockResolvedValue(appUser);
    mocks.hasActiveExternalAuthAccount.mockResolvedValue(true);
    mocks.getKakaoEmailConsentRequired.mockResolvedValue(true);
  });

  it("limits both session and JWT lifetime to twelve hours", () => {
    const options = createAuthOptions();
    expect(options.session?.maxAge).toBe(43_200);
    expect(options.jwt?.maxAge).toBe(43_200);
  });

  it.each(["google", "kakao"] as const)("expires %s at exactly twelve hours without looking up the account", async (provider) => {
    const options = createAuthOptions();
    const token = await options.callbacks!.jwt!({
      token: { userId: appUser.id, authProvider: provider, authenticatedAt: Date.now() - 43_200_000 },
      account: null, user: {} as never, profile: undefined,
      trigger: "update", session: { authenticatedAt: Date.now() }, isNewUser: false,
    });
    const session = await options.callbacks!.session!({
      token, session: { user: { id: appUser.id }, expires: "2099-01-01T00:00:00.000Z" },
    } as never);

    expect(mocks.hasActiveExternalAuthAccount).not.toHaveBeenCalled();
    expect(token.authSessionExpired).toBe(true);
    expect(session.user).toBeUndefined();
    expect(session).toMatchObject({ sessionExpired: true });
    expect(mocks.resolveOrCreateUserByExternalIdentity).not.toHaveBeenCalled();
  });

  it("keeps the original authentication time and deadline during session renewal", async () => {
    const authenticatedAt = Date.now() - 43_199_999;
    const options = createAuthOptions();
    const token = await options.callbacks!.jwt!({
      token: { userId: appUser.id, authProvider: "google", authenticatedAt },
      account: null, user: {} as never, profile: undefined,
      trigger: "update", session: { authenticatedAt: Date.now() }, isNewUser: false,
    });
    const session = await options.callbacks!.session!({
      token, session: { expires: "2099-01-01T00:00:00.000Z" },
    } as never);

    expect(token.authenticatedAt).toBe(authenticatedAt);
    expect(session).toMatchObject({ user: { id: appUser.id } });
    expect(session.expires).toBe(new Date(authenticatedAt + 43_200_000).toISOString());
  });

  it.each([undefined, NaN, Infinity, -1, 1_800_000_000_000])("rejects an invalid or future authentication timestamp: %s", async (authenticatedAt) => {
    const options = createAuthOptions();
    const token = await options.callbacks!.jwt!({
      token: { userId: appUser.id, authProvider: "google", authenticatedAt },
      account: null, user: {} as never, profile: undefined,
      trigger: undefined, session: undefined, isNewUser: false,
    });
    const session = await options.callbacks!.session!({
      token, session: { expires: "2099-01-01T00:00:00.000Z" },
    } as never);

    expect(session.user).toBeUndefined();
    expect(mocks.hasActiveExternalAuthAccount).not.toHaveBeenCalled();
  });

  it("turns a genuine expired encrypted JWT into a non-authenticated tombstone", async () => {
    const encoded = await encode({ token: { userId: appUser.id }, secret: "synthetic-test-secret", maxAge: 1 });
    vi.setSystemTime(Date.now() + 30_000);
    const decoder = createAuthOptions().jwt?.decode;
    expect(decoder).toBeTypeOf("function");
    const decoded = await decoder!({ token: encoded, secret: "synthetic-test-secret" });

    expect(decoded).toEqual({ authSessionExpired: true, authSessionInvalidated: true });
    expect(decoded).not.toHaveProperty("userId");
  });

  it("does not treat a wrong encryption key as normal expiration", async () => {
    const encoded = await encode({ token: { userId: appUser.id }, secret: "synthetic-test-secret", maxAge: 60 });
    const decoder = createAuthOptions().jwt?.decode;
    expect(decoder).toBeTypeOf("function");
    await expect(decoder!({ token: encoded, secret: "different-test-secret" })).rejects.toThrow();
  });

  it("rejects a wrong-key encrypted token even after its claimed expiry", async () => {
    const encoded = await encode({ token: { userId: appUser.id }, secret: "synthetic-test-secret", maxAge: 1 });
    vi.setSystemTime(Date.now() + 30_000);
    await expect(createAuthOptions().jwt!.decode!({ token: encoded, secret: "different-test-secret" })).rejects.toThrow();
  });

  it("keeps a genuine active encrypted token and rejects malformed ciphertext", async () => {
    const decoder = createAuthOptions().jwt!.decode!;
    const encoded = await encode({ token: { userId: appUser.id }, secret: "synthetic-test-secret", maxAge: 60 });
    expect(await decoder({ token: encoded, secret: "synthetic-test-secret" })).toMatchObject({ userId: appUser.id });
    await expect(decoder({ token: "not-an-encrypted-jwt", secret: "synthetic-test-secret" })).rejects.toThrow();
  });

  it("requests the missing Kakao email scope without forcing account signup", () => {
    createAuthOptions();

    expect(mocks.kakaoProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        authorization: { params: { scope: "account_email" } },
      }),
    );
    expect(mocks.googleProvider.mock.calls[0][0]).not.toHaveProperty("authorization");
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
    expect(token.kakaoEmailConsentRequired).toBe(true);
    expect(JSON.stringify(token)).not.toContain("must-not-be-retained");
  });

  it("uses the existing Kakao identity and hides its provided email from the session", async () => {
    mocks.resolveOrCreateUserByExternalIdentity.mockResolvedValue({
      ...appUser,
      authProvider: "kakao",
    });
    const callbacks = createAuthOptions().callbacks!;
    const token = await callbacks.jwt!({
      token: {},
      account: { provider: "kakao", providerAccountId: "123456789", type: "oauth" },
      user: { id: "provider-user" },
      profile: {
        id: 123456789,
        kakao_account: { email: "private@example.com", is_email_verified: true },
      } as never,
      trigger: "signIn",
      session: undefined,
      isNewUser: false,
    });
    const session = await callbacks.session!({
      session: { expires: "2099-01-01T00:00:00.000Z" },
      token,
    } as never);

    expect(mocks.resolveOrCreateUserByExternalIdentity).toHaveBeenCalledWith({
      provider: "kakao", providerAccountId: "123456789",
      email: "private@example.com", emailVerified: true,
    });
    expect(token.userId).toBe(appUser.id);
    expect(token.anonymousId).toBe(appUser.anonymousId);
    expect(session).toMatchObject({ user: { kakaoEmailConsentRequired: false } });
    expect(JSON.stringify({ token, session })).not.toContain("private@example.com");
  });

  it("checks the email notice for a legacy Kakao session without recreating the account", async () => {
    const jwt = createAuthOptions().callbacks?.jwt;
    const token = await jwt!({
      token: { userId: appUser.id, authProvider: "kakao", authenticatedAt: appUser.authenticatedAt },
      account: null, user: {} as never, profile: undefined,
      trigger: undefined, session: undefined, isNewUser: false,
    });

    expect(mocks.getKakaoEmailConsentRequired).toHaveBeenCalledWith(appUser.id);
    expect(token.kakaoEmailConsentRequired).toBe(true);
    expect(mocks.resolveOrCreateUserByExternalIdentity).not.toHaveBeenCalled();
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
    expect(mocks.getKakaoEmailConsentRequired).not.toHaveBeenCalled();
  });

  it("clears a pending email notice after consent was completed through another login", async () => {
    mocks.getKakaoEmailConsentRequired.mockResolvedValue(false);
    const callbacks = createAuthOptions().callbacks!;
    const token = await callbacks.jwt!({
      token: { userId: appUser.id, authProvider: "kakao", authenticatedAt: appUser.authenticatedAt, kakaoEmailConsentRequired: true },
      account: null, user: {} as never, profile: undefined, trigger: undefined, session: undefined, isNewUser: false,
    });
    expect(token.kakaoEmailConsentRequired).toBe(false);
    expect(mocks.resolveOrCreateUserByExternalIdentity).not.toHaveBeenCalled();
  });

  it("fails closed without an exception when account validation is unavailable", async () => {
    mocks.hasActiveExternalAuthAccount.mockRejectedValue(new Error("private connection detail"));
    const callbacks = createAuthOptions().callbacks!;
    const token = await callbacks.jwt!({
      token: { userId: appUser.id, authProvider: "google", authenticatedAt: appUser.authenticatedAt },
      account: null, user: {} as never, profile: undefined, trigger: undefined, session: undefined, isNewUser: false,
    });
    const session = await callbacks.session!({ token, session: { expires: "2099-01-01T00:00:00.000Z" } } as never);
    expect(session.user).toBeUndefined();
    expect(session).toMatchObject({ authValidationUnavailable: true });
    expect(JSON.stringify(session)).not.toContain("private connection detail");
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

  it("serializes a deleted-account JWT through real invalidation without restoring identity", async () => {
    const realSecurity = await vi.importActual<typeof import("./sessionSecurity")>("./sessionSecurity");
    mocks.hasActiveExternalAuthAccount.mockResolvedValue(false);
    mocks.invalidateAuthToken.mockImplementationOnce(realSecurity.invalidateAuthToken);
    const callbacks = createAuthOptions().callbacks!;
    const token = await callbacks.jwt!({
      token: { userId: appUser.id, authProvider: "kakao", authenticatedAt: appUser.authenticatedAt,
        kakaoEmailConsentRequired: true, email: "private@example.com" },
      account: null, user: {} as never, profile: undefined, trigger: undefined, session: undefined, isNewUser: false,
    });
    expect(token).toEqual({ authSessionInvalidated: true });
    const session = await callbacks.session!({ token, session: { expires: "2099-01-01T00:00:00.000Z" } } as never);
    expect(session.user).toBeUndefined();
    expect(JSON.stringify(session)).not.toContain("private@example.com");
  });
});
