import type { Envelope } from "./privacy";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({
  init: vi.fn<(options: import("@sentry/nextjs").BrowserOptions) => void>(), getClient: vi.fn(), makeFetchTransport: vi.fn(), makeNodeTransport: vi.fn(),
  globalHandlersIntegration: vi.fn(() => ({ name: "GlobalHandlers" })),
  browserTracingCoreIntegration: vi.fn<(options: NonNullable<Parameters<typeof import("@sentry/nextjs").browserTracingCoreIntegration>[0]>) => { name: string }>(() => ({ name: "BrowserTracing" })),
  fetchTracingIntegration: vi.fn(() => ({ name: "FetchTracing" })),
  webVitalsIntegration: vi.fn(() => ({ name: "WebVitals" })),
  startBrowserTracingNavigationSpan: vi.fn(), send: vi.fn(), flush: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => sdk);
const dsn = `https://${"a".repeat(32)}@o123.ingest.us.sentry.io/456`;

describe("Sentry startup and transport", () => {
  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks();
    vi.stubEnv("SENTRY_ENABLED", "false"); vi.stubEnv("NEXT_PUBLIC_SENTRY_ENABLED", "false");
    sdk.send.mockResolvedValue({ statusCode: 200 }); sdk.flush.mockResolvedValue(true);
    sdk.makeFetchTransport.mockReturnValue({ send: sdk.send, flush: sdk.flush });
    sdk.makeNodeTransport.mockReturnValue({ send: sdk.send, flush: sdk.flush });
    sdk.getClient.mockReturnValue({});
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("does not initialize or create transport with flags OFF", async () => {
    const browser = await import("../../../instrumentation-client");
    const server = await import("../../../sentry.server.config");
    const instrumentation = await import("../../../instrumentation");
    await browser.initializeBrowserSentry(); await server.initializeServerSentry(); await instrumentation.register();
    browser.onRouterTransitionStart("/community");
    expect(sdk.init).not.toHaveBeenCalled(); expect(sdk.makeFetchTransport).not.toHaveBeenCalled();
    expect(sdk.makeNodeTransport).not.toHaveBeenCalled();
  });

  it("configures browser collection explicitly and sanitizes actual transport envelopes", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("NEXT_PUBLIC_SENTRY_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DEPLOYMENT_ENV", "production"); vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", dsn);
    vi.stubGlobal("window", { location: new URL("https://www.sseullae.com/community?private=excluded") });
    const browser = await import("../../../instrumentation-client");
    await browser.initializeBrowserSentry();
    expect(sdk.init).toHaveBeenCalledTimes(1);
    const options = sdk.init.mock.calls[0][0];
    expect(options.defaultIntegrations).toBe(false);
    expect(options.maxBreadcrumbs).toBe(0);
    expect(options.sendClientReports).toBe(false);
    expect(options.tracePropagationTargets).toEqual([]);
    expect(sdk.webVitalsIntegration).toHaveBeenCalledTimes(1);
    expect((options.integrations as Array<{ name: string }>).map((item) => item.name)).toContain("WebVitals");
    expect(options.dataCollection).toMatchObject({ userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false, frameContextLines: 0 });
    const transport = options.transport!({ url: "https://o123.ingest.us.sentry.io/api/456/envelope/", recordDroppedEvent: vi.fn() });
    await transport.send([{ private: "not-sent" }, [[{ type: "event" }, { message: "not-sent", user: { email: "not-sent" } }]]] as unknown as Envelope);
    expect(sdk.send).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(sdk.send.mock.calls[0][0])).not.toContain("not-sent");
    await transport.send([{}, [[{ type: "attachment", filename: "not-sent" }, "not-sent"]]] as unknown as Envelope);
    expect(sdk.send).toHaveBeenCalledTimes(1);
  });

  it("does not initialize on preview origins, even with production-looking flags", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("NEXT_PUBLIC_SENTRY_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DEPLOYMENT_ENV", "production"); vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", dsn);
    vi.stubGlobal("window", { location: new URL("https://preview.vercel.app/community") });
    await (await import("../../../instrumentation-client")).initializeBrowserSentry();
    expect(sdk.init).not.toHaveBeenCalled();
  });

  it.each([
    { source: "/community", target: "/community/search?q=private#private", name: "/community/search", path: "/community/search" },
    { source: "/community", target: "/community/private-review-id?token=private", name: "/community/[postId]", path: "/community/[postId]" },
    { source: "/community", target: "/my?private=excluded", name: "excluded", path: "/" },
    { source: "/community", target: "https://external.invalid/community?private=excluded", name: "excluded", path: "/" },
    { source: "/my", target: "/community?private=excluded", name: "/community", path: "/community" },
  ])("passes the sanitized destination while the address bar still contains $source -> $target", async ({ source, target, name, path }) => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("NEXT_PUBLIC_SENTRY_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DEPLOYMENT_ENV", "production"); vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", dsn);
    const location = new URL(`https://www.sseullae.com${source}`);
    vi.stubGlobal("window", { location });
    const browser = await import("../../../instrumentation-client");
    await browser.initializeBrowserSentry();
    browser.onRouterTransitionStart(target);
    await Promise.resolve();
    expect(window.location).toBe(location);
    expect(sdk.startBrowserTracingNavigationSpan).toHaveBeenCalledExactlyOnceWith(
      sdk.getClient.mock.results[0].value, { name }, { url: `https://www.sseullae.com${path}` },
    );
    expect(JSON.stringify(sdk.startBrowserTracingNavigationSpan.mock.calls)).not.toContain("private");
  });

  it.each(["true", "http://127.0.0.1:8969/stream"])("explicitly disables Spotlight in browser and server options despite a synthetic %s environment value", async (spotlight) => {
    vi.stubEnv("SENTRY_SPOTLIGHT", spotlight);
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("SENTRY_ENABLED", "true"); vi.stubEnv("SENTRY_DSN", dsn);
    vi.stubEnv("NEXT_PUBLIC_SENTRY_ENABLED", "true"); vi.stubEnv("NEXT_PUBLIC_SENTRY_DEPLOYMENT_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", dsn);
    vi.stubGlobal("window", { location: new URL("https://www.sseullae.com/community") });
    await (await import("../../../instrumentation-client")).initializeBrowserSentry();
    await (await import("../../../sentry.server.config")).initializeServerSentry();
    expect(sdk.init).toHaveBeenCalledTimes(2);
    for (const [options] of sdk.init.mock.calls) expect(options.spotlight).toBe(false);
  });

  it.each([
    { label: "initial community load", path: "/community?private=excluded", name: "Pageload", op: "pageload", expected: "/community" },
    { label: "initial review detail load", path: "/community/synthetic-review-id", name: "Pageload", op: "pageload", expected: "/community/[postId]" },
    { label: "excluded initial load", path: "/my", name: "Pageload", op: "pageload", expected: "excluded" },
    { label: "excluded navigation target", path: "/community", name: "excluded", op: "navigation", expected: "excluded" },
    { label: "allowed navigation target", path: "/community", name: "/community/write", op: "navigation", expected: "/community/write" },
    { label: "unresolved navigation label", path: "/community", name: "Navigation", op: "navigation", expected: "excluded" },
    { label: "unknown initial label", path: "/community", name: "Unknown", op: "pageload", expected: "excluded" },
    { label: "already named initial load", path: "/community", name: "/community/search?q=excluded", op: "pageload", expected: "/community/search" },
  ])("keeps the approved route boundary for $label", async ({ path, name, op, expected }) => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("NEXT_PUBLIC_SENTRY_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DEPLOYMENT_ENV", "production"); vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", dsn);
    vi.stubGlobal("window", { location: new URL(`https://www.sseullae.com${path}`) });
    await (await import("../../../instrumentation-client")).initializeBrowserSentry();
    const beforeStartSpan = sdk.browserTracingCoreIntegration.mock.calls[0][0].beforeStartSpan!;
    const input = { name, op, attributes: { "sentry.origin": "synthetic-regression" } };
    expect(beforeStartSpan(input)).toEqual({ ...input, name: expected });
  });

  it("does not let initialization failures break the application", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("SENTRY_ENABLED", "true"); vi.stubEnv("SENTRY_DSN", dsn);
    sdk.init.mockImplementationOnce(() => { throw new Error("synthetic SDK failure"); });
    await expect((await import("../../../sentry.server.config")).initializeServerSentry()).resolves.toBeUndefined();
  });
});
