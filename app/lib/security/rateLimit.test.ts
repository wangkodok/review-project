import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  recordSecurityEvent: vi.fn(),
  slidingWindow: vi.fn((requests: number, window: string) => ({ requests, window })),
  limiterOptions: [] as Array<{
    prefix: string;
    limiter: { requests: number; window: string };
  }>,
}));

vi.mock("server-only", () => ({}));
vi.mock("@upstash/redis", () => ({
  Redis: class Redis {},
}));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class Ratelimit {
    static slidingWindow(requests: number, window: string) {
      return mocks.slidingWindow(requests, window);
    }

    constructor(options: {
      prefix: string;
      limiter: { requests: number; window: string };
    }) {
      mocks.limiterOptions.push(options);
    }

    limit = mocks.limit;
  },
}));
vi.mock("./securityEvent", () => ({
  recordSecurityEvent: mocks.recordSecurityEvent,
}));

describe("enforceRateLimit security events", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    vi.stubEnv(
      "RATE_LIMIT_IDENTIFIER_SECRET",
      "test-rate-limit-identifier-secret-that-is-long-enough",
    );
    mocks.limit.mockReset();
    mocks.recordSecurityEvent.mockReset();
    mocks.slidingWindow.mockClear();
    mocks.limiterOptions.length = 0;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed and records an Upstash timeout", async () => {
    mocks.limit.mockResolvedValue({ reason: "timeout" });
    const { enforceRateLimit } = await import("./rateLimit");

    const response = await enforceRateLimit({
      identifier: "private-request-identifier",
      policy: "posts",
    });

    expect(response?.status).toBe(503);
    expect(mocks.recordSecurityEvent).toHaveBeenCalledWith({
      eventCode: "rate_limit_store_unavailable",
      policy: "posts",
      resultCode: "timeout",
    });
  });

  it("fails closed and records an Upstash request failure", async () => {
    mocks.limit.mockRejectedValue(new Error("private Upstash detail"));
    const { enforceRateLimit } = await import("./rateLimit");

    const response = await enforceRateLimit({
      identifier: "private-request-identifier",
      policy: "withdrawal",
    });

    expect(response?.status).toBe(503);
    expect(mocks.recordSecurityEvent).toHaveBeenCalledWith({
      eventCode: "rate_limit_store_unavailable",
      policy: "withdrawal",
      resultCode: "request_failed",
    });
  });

  it("configures review reports at five requests per ten minutes", async () => {
    await import("./rateLimit");

    expect(
      mocks.limiterOptions.find(
        ({ prefix }) => prefix === "food-review:production:report",
      )?.limiter,
    ).toEqual({ requests: 5, window: "10 m" });
  });

  it("configures review image uploads at five requests per ten minutes", async () => {
    await import("./rateLimit");

    expect(
      mocks.limiterOptions.find(
        ({ prefix }) => prefix === "food-review:production:reviewImageUpload",
      )?.limiter,
    ).toEqual({ requests: 5, window: "10 m" });
  });
});
