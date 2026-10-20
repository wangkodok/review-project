import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createContext, runInContext } from "node:vm";
import { buildPostHogOptions, loadAnalyticsDriver } from "./posthogAdapter";

const sdk = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn(), reset: vi.fn(), shutdown: vi.fn(), identify: vi.fn() }));
vi.mock("posthog-js", () => ({ PostHog: class { constructor() { return sdk; } } }));
const config = { analytics: true, replay: false, environment: "production", projectToken: "phc_synthetic_qa_only", apiHost: "https://us.i.posthog.com" } as const;
const uuid = "019a0000-0000-7000-8000-000000000001";
const sentinel = "$posthog_cookieless";
const sdkEvent = () => ({ uuid, event: "$pageview", properties: {
  screen: "/community/private-post?code=private", distinct_id: sentinel, $cookieless_mode: true,
} });
beforeEach(() => {
  vi.clearAllMocks(); sdk.init.mockReturnValue(sdk); sdk.shutdown.mockResolvedValue(undefined);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("cookieless_PostHog_boundary", () => {
  it("blocks_off_or_invalid_configuration_before_loading_the_SDK", async () => {
    await expect(loadAnalyticsDriver(config, () => false)).rejects.toThrow();
    await expect(loadAnalyticsDriver({ ...config, analytics: false } as unknown as typeof config, () => true)).rejects.toThrow();
    await expect(loadAnalyticsDriver({ ...config, apiHost: "https://evil.test" }, () => true)).rejects.toThrow();
    await expect(loadAnalyticsDriver({ ...config, environment: "private" } as unknown as typeof config, () => true)).rejects.toThrow();
    expect(sdk.init).not.toHaveBeenCalled();
    expect(sdk.capture).not.toHaveBeenCalled();
  });
  it("uses_always_mode_without_automatic_products_or_browser_persistence", () => {
    expect(buildPostHogOptions(config, () => true)).toMatchObject({
      cookieless_mode: "always", person_profiles: "never", persistence: "memory", disable_persistence: true,
      autocapture: false, capture_pageview: false, capture_pageleave: false, disable_session_recording: true,
      disable_surveys: true, disable_conversations: true, disable_product_tours: true, save_referrer: false,
      save_campaign_params: false, capture_performance: false, capture_exceptions: false,
      disable_external_dependency_loading: true, advanced_disable_flags: true, bootstrap: {},
    });
  });
  it.each([{ doNotTrack: "1" }, { doNotTrack: "yes" }, { doNotTrack: "true" }, { doNotTrack: true },
    { msDoNotTrack: "1" }, { globalPrivacyControl: true }])(
    "blocks_browser_privacy_signal_%j_before_init", async (navigator) => {
      vi.stubGlobal("navigator", navigator);
      await expect(loadAnalyticsDriver(config, () => true)).rejects.toThrow("analytics_disabled");
      expect(sdk.init).not.toHaveBeenCalled();
      const filter = buildPostHogOptions(config, () => true).before_send as (input: unknown) => unknown;
      expect(filter(sdkEvent())).toBeNull();
    },
  );
  it.each([{ doNotTrack: "0" }, { globalPrivacyControl: false }])("does_not_block_a_disabled_privacy_signal_%j", async (navigator) => {
    vi.stubGlobal("navigator", navigator);
    const driver = await loadAnalyticsDriver(config, () => true);
    expect(sdk.init).toHaveBeenCalledTimes(1);
    driver.stop();
  });
  it("blocks_window_DNT_and_new_privacy_signals_after_init", async () => {
    vi.stubGlobal("window", { doNotTrack: "1" });
    await expect(loadAnalyticsDriver(config, () => true)).rejects.toThrow("analytics_disabled");
    vi.unstubAllGlobals();
    const driver = await loadAnalyticsDriver(config, () => true);
    vi.stubGlobal("navigator", { globalPrivacyControl: true });
    driver.capture({ event: "$pageview", properties: { screen: "/community" } });
    expect(sdk.capture).not.toHaveBeenCalled();
    driver.stop();
  });
  it.each(["production", "test"] as const)("emits_only_exact_cookieless_markers_and_allowed_properties_for_%s", (environment) => {
    const beforeSend = buildPostHogOptions({ ...config, environment }, () => true).before_send as (input: unknown) => unknown;
    const clean = beforeSend({ ...sdkEvent(), timestamp: new Date("2026-10-20T00:00:00Z"), raw: "private", properties: {
      ...sdkEvent().properties, environment: "forged", $session_id: uuid, $window_id: uuid,
      email: "private", userId: "private", memberId: "private", nickname: "private", review: "private", photo: "private",
      $set: { email: "private" }, $set_once: { userId: "private" }, $current_url: "private", $host: "private",
      $user_agent: "private", $device_id: "private", $ip: "192.0.2.1", $geoip_city_name: "private", nested: { private: true },
    } });
    expect(clean).toEqual({ uuid, event: "$pageview", timestamp: new Date("2026-10-20T00:00:00Z"), properties: {
      screen: "/community/[postId]", environment, token: config.projectToken, distinct_id: sentinel,
      $cookieless_mode: true, $process_person_profile: false, $geoip_disable: true,
    } });
    expect(JSON.stringify(clean)).not.toMatch(/private|forged|192\.0\.2|\$set|\$host|\$device_id|\$session_id|\$window_id/);
  });
  it("rejects_forged_or_missing_protocol_markers_and_non_funnel_events", () => {
    const beforeSend = buildPostHogOptions(config, () => true).before_send as (input: unknown) => unknown;
    for (const distinct_id of [uuid, "private-account", null, undefined, sentinel + "-other"]) {
      expect(beforeSend({ ...sdkEvent(), properties: { ...sdkEvent().properties, distinct_id } })).toBeNull();
    }
    for (const flag of [false, "true", 1, undefined]) {
      expect(beforeSend({ ...sdkEvent(), properties: { ...sdkEvent().properties, $cookieless_mode: flag } })).toBeNull();
    }
    for (const event of ["$identify", "$snapshot", "$autocapture", "ui_action", "filter_changed"]) {
      expect(beforeSend({ ...sdkEvent(), event })).toBeNull();
    }
  });
  it("stops_pending_and_new_capture_without_calling_identify", async () => {
    let active = true;
    const pending = loadAnalyticsDriver(config, () => active);
    active = false;
    await expect(pending).rejects.toThrow();
    expect(sdk.init).not.toHaveBeenCalled();
    active = true;
    const driver = await loadAnalyticsDriver(config, () => active);
    driver.capture({ event: "$pageview", properties: { screen: "/community" } });
    expect(sdk.capture).toHaveBeenCalledExactlyOnceWith("$pageview", { screen: "/community", environment: "production" });
    driver.resetIdentity();
    expect(sdk.reset).toHaveBeenCalledWith(true);
    driver.stop(); driver.stop();
    driver.capture({ event: "$pageview", properties: { screen: "/community" } });
    expect(sdk.capture).toHaveBeenCalledTimes(1);
    expect(sdk.identify).not.toHaveBeenCalled();
    expect(sdk.shutdown).toHaveBeenCalledTimes(1);
    expect((buildPostHogOptions(config, () => false).before_send as (input: unknown) => unknown)(sdkEvent())).toBeNull();
  });
  it("has_no_identify_calls_anywhere_in_application_source", () => {
    const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const file = join(dir, entry.name);
      return entry.isDirectory() ? walk(file) : /\.[cm]?[jt]sx?$/.test(file) ? [file] : [];
    });
    const identifyCall = new RegExp("(?:\\.\\s*|\\[\\s*['\"])(?:identify)(?:['\"]\\s*\\])?\\s*\\(");
    expect(walk("app").filter((file) => identifyCall.test(readFileSync(file, "utf8")))).toEqual([]);
  });
  it("serializes_the_real_SDK_sentinel_without_persistent_storage_or_network", async () => {
    const { PostHog } = await vi.importActual<typeof import("posthog-js")>("posthog-js/lib/src/posthog-core.js");
    const storage = await vi.importActual<typeof import("posthog-js/lib/src/storage.js")>("posthog-js/lib/src/storage.js");
    const cookieWrite = vi.spyOn(storage.cookieStore, "_set");
    const localWrite = vi.spyOn(storage.localStore, "_set");
    const sessionWrite = vi.spyOn(storage.sessionStore, "_set");
    const client = new PostHog();
    const identify = vi.spyOn(client, "identify");
    const send = vi.spyOn(client, "_send_retriable_request").mockImplementation(() => {});
    client.init(config.projectToken, { ...buildPostHogOptions(config, () => true), request_batching: false, opt_out_useragent_filter: true });
    try {
      expect(client.get_distinct_id()).toBe(sentinel);
      const sequence = ["$pageview", "review_write_opened", "review_save_started", "review_save_succeeded", "review_save_failed"];
      for (const event of sequence) {
        client.capture(event, { screen: "/community/write?email=private", mode: "create", hasImage: false,
          error: "network", email: "private", memberId: "private", review: "private", photo: "private" });
      }
      expect(send.mock.calls.map(([request]) => (request.data as { event: string }).event)).toEqual(sequence);
      for (const [request] of send.mock.calls) {
        expect(request.data).toMatchObject({ properties: { distinct_id: sentinel, $cookieless_mode: true, environment: "production" } });
        expect(JSON.stringify(request.data)).not.toMatch(/private|email|memberId|photo|review":|current_url|referrer|\$set/);
      }
      client.reset(true);
      expect(client.get_distinct_id()).toBe(sentinel);
      expect(identify).not.toHaveBeenCalled();
      expect(cookieWrite).not.toHaveBeenCalled();
      expect(localWrite).not.toHaveBeenCalled();
      expect(sessionWrite).not.toHaveBeenCalled();
    } finally { await client.shutdown(); }
  });
  it("leaves_browser_cookie_localStorage_and_sessionStorage_unchanged_in_the_browser_bundle", async () => {
    const write = vi.fn();
    const cookieWrite = vi.fn();
    const storage = () => {
      const values = new Map([["unrelated", "synthetic-existing-value"]]);
      return { get length() { return values.size; }, key: (index: number) => [...values.keys()][index] ?? null,
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { write(key, value); values.set(key, value); },
        removeItem: (key: string) => { write(key); values.delete(key); }, clear: () => { write(); values.clear(); } };
    };
    const location = new URL("https://www.sseullae.com/community?private=not-an-event-property");
    const document = Object.assign(new EventTarget(), { location, readyState: "complete", referrer: "", cookie: "",
      documentElement: {}, body: {}, querySelectorAll: () => [], getElementsByTagName: () => [],
      createElement: () => { throw new Error("unexpected_external_dependency"); } });
    Object.defineProperty(document, "cookie", { get: () => "unrelated=synthetic-existing-value", set: cookieWrite });
    const network = vi.fn(async () => new Response("{}", { status: 200 }));
    const sandbox = Object.assign(new EventTarget(), { document, location, localStorage: storage(), sessionStorage: storage(),
      navigator: { userAgent: "Mozilla/5.0 Chrome/140.0.0.0", onLine: true, doNotTrack: null, sendBeacon: network },
      screen: { width: 1280, height: 720 }, innerWidth: 1280, innerHeight: 720,
      setTimeout: vi.fn(() => 1), clearTimeout: vi.fn(), setInterval: vi.fn(() => 1), clearInterval: vi.fn(),
      fetch: network, console: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
      URL, Date, FormData, Headers, AbortController, URLSearchParams, Blob, TextEncoder,
      performance: globalThis.performance, crypto: globalThis.crypto });
    const context = createContext(sandbox);
    runInContext("window = self = globalThis", context);
    // Exercise the installed browser distribution offline, not just its Node storage adapter.
    runInContext(readFileSync("node_modules/posthog-js/dist/array.js", "utf8"), context);
    const client = (context as { posthog: import("posthog-js").PostHog }).posthog;
    const identify = vi.spyOn(client, "identify");
    client.init(config.projectToken, { ...buildPostHogOptions(config, () => true), request_batching: false, disable_compression: true });
    try {
      expect(client.capture("$pageview", { screen: "/community" })).toMatchObject({
        event: "$pageview", properties: { environment: "production", $cookieless_mode: true },
      });
      expect(client.capture("review_save_succeeded", { screen: "/community/write", mode: "create", hasImage: false })).toMatchObject({
        event: "review_save_succeeded", properties: { environment: "production", $cookieless_mode: true },
      });
      client.reset(true);
      expect(client.get_distinct_id()).toBe(sentinel);
      expect(identify).not.toHaveBeenCalled();
      expect(network).toHaveBeenCalledTimes(2);
      expect(cookieWrite).not.toHaveBeenCalled();
      // The browser distribution probes storage support, then removes the probes.
      expect(write.mock.calls.filter((args) => args.length === 2)).toEqual([
        ["__mplssupport__", '"xyz"'], ["test", "test"],
      ]);
      expect(document.cookie).toBe("unrelated=synthetic-existing-value");
      for (const store of [sandbox.localStorage, sandbox.sessionStorage]) {
        expect(store.length).toBe(1);
        expect(store.key(0)).toBe("unrelated");
        expect(store.getItem("unrelated")).toBe("synthetic-existing-value");
      }
    } finally { await client.shutdown(); }
    expect(cookieWrite).not.toHaveBeenCalled();
    expect(write.mock.calls.filter((args) => args.length === 2)).toEqual([
      ["__mplssupport__", '"xyz"'], ["test", "test"],
    ]);
  });
});
