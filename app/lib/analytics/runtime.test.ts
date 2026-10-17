import { describe, expect, it, vi } from "vitest";
import { createAnalyticsRuntime } from "./runtime";
vi.mock("./posthogAdapter", () => ({ loadAnalyticsDriver: vi.fn() }));
const config = { analytics: true, replay: false, projectToken: "phc_synthetic", apiHost: "https://us.i.posthog.com" } as const;
const event = { event: "search_submitted", properties: { screen: "/community/search" } } as const;
const driver = () => ({ capture: vi.fn(), resetIdentity: vi.fn(), stop: vi.fn() });
describe("analytics runtime", () => {
  it("never_loads_when_off", async () => {
    const load = vi.fn(); const runtime = createAnalyticsRuntime(null, load);
    runtime.updateLocation("/community"); await runtime.start(); runtime.track(event);
    expect(load).not.toHaveBeenCalled();
  });
  it("loads_once_discards_old_clicks_and_deduplicates_current_pageviews", async () => {
    const sdk = driver(); const load = vi.fn(async () => sdk);
    const runtime = createAnalyticsRuntime(config, load);
    runtime.updateLocation("/community"); runtime.track(event);
    await Promise.all([runtime.start(), runtime.start()]);
    runtime.updateLocation("/community"); runtime.updateLocation("/my"); runtime.updateLocation("/community");
    expect(load).toHaveBeenCalledTimes(1);
    expect(sdk.capture.mock.calls.map(([e]) => e.event)).toEqual(["$pageview", "$pageview", "$pageview"]);
  });
  it("stops_pending_import_and_never_restarts", async () => {
    const sdk = driver(); let resolve!: (value: typeof sdk) => void;
    const runtime = createAnalyticsRuntime(config, () => new Promise((r) => { resolve = r; }));
    const pending = runtime.start(); runtime.stop(); resolve(sdk); await pending; await runtime.start();
    runtime.track(event); expect(sdk.capture).not.toHaveBeenCalled(); expect(sdk.stop).toHaveBeenCalledTimes(1);
  });
  it("resets_identity_and_rejects_previous_epoch_including_loading_results", async () => {
    const sdk = driver(); const runtime = createAnalyticsRuntime(config, async () => sdk);
    const old = runtime.epoch(); const pending = runtime.start(); runtime.resetIdentity(); await pending;
    runtime.track(event, old); expect(sdk.capture).not.toHaveBeenCalled();
    runtime.track(event); expect(sdk.capture).toHaveBeenCalledTimes(1); expect(sdk.resetIdentity).toHaveBeenCalledTimes(1);
  });
  it("isolates_loader_and_driver_failures", async () => {
    const runtime = createAnalyticsRuntime(config, async () => { throw new Error("blocked"); });
    await expect(runtime.start()).resolves.toBeUndefined(); expect(() => runtime.track(event)).not.toThrow();
    const sdk = driver(); sdk.capture.mockImplementation(() => { throw new Error("blocked"); });
    const active = createAnalyticsRuntime(config, async () => sdk); await active.start();
    expect(() => active.track(event)).not.toThrow();
  });
  it("configures_once_stops_on_changes_and_rejects_preconfiguration_epochs", async () => {
    vi.resetModules();
    const { loadAnalyticsDriver } = await import("./posthogAdapter");
    const sdk = driver(); vi.mocked(loadAnalyticsDriver).mockResolvedValue(sdk);
    const { analytics } = await import("./runtime");
    const old = analytics.epoch(); analytics.configure(config); await analytics.start();
    analytics.track(event, old); expect(sdk.capture).not.toHaveBeenCalled();
    analytics.configure({ ...config }); await analytics.start();
    expect(loadAnalyticsDriver).toHaveBeenCalledTimes(1);
    analytics.track(event); expect(sdk.capture).toHaveBeenCalledTimes(1);
    analytics.configure(null); await analytics.start(); analytics.configure(config); await analytics.start();
    analytics.track(event); expect(sdk.capture).toHaveBeenCalledTimes(1); expect(sdk.stop).toHaveBeenCalledTimes(1);
  });
  it("counts_distinct_detail_navigation_but_not_query_changes", async () => {
    const sdk = driver(); const runtime = createAnalyticsRuntime(config, async () => sdk);
    await runtime.start();
    runtime.updateLocation("/community/first?code=private");
    runtime.updateLocation("/community/first?code=other");
    runtime.updateLocation("/community/second");
    expect(sdk.capture).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(sdk.capture.mock.calls)).not.toMatch(/first|second|private|code/);
    runtime.stop(); runtime.updateLocation("/my"); await runtime.start();
    expect(sdk.capture).toHaveBeenCalledTimes(2);
  });
  it("uses_the_explicit_QA_driver_without_loading_the_normal_driver", async () => {
    vi.resetModules();
    const { analytics } = await import("./runtime");
    const { loadAnalyticsDriver } = await import("./posthogAdapter");
    vi.mocked(loadAnalyticsDriver).mockClear();
    const sdk = driver();
    analytics.configure(config, async () => sdk);
    analytics.updateLocation("/community");
    await analytics.start();
    expect(sdk.capture).toHaveBeenCalledExactlyOnceWith({ event: "$pageview", properties: { screen: "/community" } });
    expect(loadAnalyticsDriver).not.toHaveBeenCalled();
    analytics.stop(); analytics.track(event);
    expect(sdk.capture).toHaveBeenCalledTimes(1);
  });
});
