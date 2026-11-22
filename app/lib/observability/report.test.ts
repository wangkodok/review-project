import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({
  getClient: vi.fn(), captureException: vi.fn<(error: Error) => void>(),
  withIsolationScope: vi.fn(), startSpan: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => sdk);
import { observeServerOperation, reportServerError } from "./report";

function enable() {
  vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("SENTRY_ENABLED", "true");
  vi.stubEnv("SENTRY_DSN", `https://${"a".repeat(32)}@o123.ingest.us.sentry.io/456`);
}

describe("server observation failure isolation", () => {
  beforeEach(() => {
    vi.resetAllMocks(); vi.stubEnv("SENTRY_ENABLED", "false");
    sdk.getClient.mockReturnValue({});
    sdk.withIsolationScope.mockImplementation((run) => run({ setTags: vi.fn() }));
    sdk.startSpan.mockImplementation((_options, run) => run());
  });
  afterEach(() => vi.unstubAllEnvs());

  it("does not touch the SDK while OFF and runs the business operation once", async () => {
    const run = vi.fn().mockResolvedValue({ saved: true });
    await expect(observeServerOperation("review_create", run)).resolves.toEqual({ saved: true });
    await reportServerError("review_create");
    expect(run).toHaveBeenCalledTimes(1);
    expect(sdk.getClient).not.toHaveBeenCalled();
    expect(sdk.captureException).not.toHaveBeenCalled();
  });

  it("reports only a fixed operation and never receives a raw request or exception", async () => {
    enable();
    await reportServerError("posts_list");
    expect(sdk.captureException).toHaveBeenCalledTimes(1);
    expect(sdk.captureException.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(sdk.captureException.mock.calls[0][0].message).toBe("posts_list failed");
  });

  it("does not fail the API if SDK reporting fails", async () => {
    enable(); sdk.captureException.mockImplementation(() => { throw new Error("SDK unavailable"); });
    await expect(reportServerError("search_posts")).resolves.toBeUndefined();
  });

  it("runs once when tracing throws before executing the callback", async () => {
    enable(); sdk.startSpan.mockImplementation(() => { throw new Error("SDK unavailable"); });
    const run = vi.fn().mockResolvedValue("ok");
    await expect(observeServerOperation("review_create", run)).resolves.toBe("ok");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("does not repeat a write if tracing throws after executing the callback", async () => {
    enable(); sdk.startSpan.mockImplementation((_options, run) => { run(); throw new Error("SDK unavailable"); });
    const run = vi.fn().mockResolvedValue("saved");
    await expect(observeServerOperation("review_create", run)).resolves.toBe("saved");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("preserves the exact business error without retrying", async () => {
    enable();
    const error = new Error("synthetic private database failure");
    const run = vi.fn().mockRejectedValue(error);
    await expect(observeServerOperation("posts_list", run)).rejects.toBe(error);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("keeps operation metadata separate across concurrent requests", async () => {
    enable();
    await Promise.all([reportServerError("posts_list"), reportServerError("search_posts")]);
    expect(sdk.getClient).toHaveBeenCalledTimes(2);
    expect(sdk.withIsolationScope).toHaveBeenCalledTimes(2);
    expect(sdk.captureException.mock.calls.map(([error]) => error.message).sort()).toEqual(["posts_list failed", "search_posts failed"]);
  });
});
