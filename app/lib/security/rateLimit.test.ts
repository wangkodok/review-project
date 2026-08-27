import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  recordSecurityEvent: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@upstash/redis", () => ({
  Redis: class Redis {},
}));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class Ratelimit {
    static slidingWindow() {
      return {};
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
});
