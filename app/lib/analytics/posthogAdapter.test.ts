import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildPostHogOptions, loadAnalyticsDriver } from "./posthogAdapter";

const sdk = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn(), reset: vi.fn(), shutdown: vi.fn(), get_distinct_id: vi.fn() }));
vi.mock("posthog-js", () => ({ PostHog: class { constructor() { return sdk; } } }));
const config = { analytics: true, replay: false, projectToken: "phc_synthetic_qa_only", apiHost: "https://us.i.posthog.com" } as const;
const uuid = "019a0000-0000-7000-8000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  sdk.init.mockReturnValue(sdk);
  sdk.shutdown.mockResolvedValue(undefined);
  sdk.get_distinct_id.mockReturnValue(uuid);
});
afterEach(() => vi.unstubAllGlobals());

describe("PostHog boundary", () => {
  it("blocks_inactive_and_invalid_initialization", async () => {
    await expect(loadAnalyticsDriver(config, () => false)).rejects.toThrow();
    await expect(loadAnalyticsDriver({ ...config, apiHost: "https://evil.test" }, () => true)).rejects.toThrow();
    expect(sdk.init).not.toHaveBeenCalled();
  });
  it("disables_recording_automatic_products_and_long_lived_storage", () => {
    const options = buildPostHogOptions(config, () => true);
    expect(options).toMatchObject({ autocapture: false, capture_pageview: false, capture_pageleave: false,
      disable_session_recording: true, disable_surveys: true, disable_conversations: true,
      disable_product_tours: true, person_profiles: "never", save_referrer: false,
      save_campaign_params: false, capture_performance: false, persistence: "memory", disable_persistence: true,
      disable_external_dependency_loading: true, advanced_disable_flags: true });
  });
  it("constructs_a_clean_payload_and_rejects_other_events", () => {
    const options = buildPostHogOptions(config, () => true);
    const beforeSend = options.before_send as (input: unknown) => unknown;
    const clean = beforeSend({ event: "ui_action", uuid, timestamp: new Date("2026-10-15T00:00:00Z"),
      properties: { distinct_id: uuid, $session_id: uuid, $window_id: uuid, screen: "/community/synthetic?code=private",
        action: "like_click", $set: { email: "synthetic-private" }, $current_url: "private", $initial_referrer: "private",
        text: "private", $device_id: "service-user", nested: { value: "private" } }, raw: "private" });
    expect(JSON.stringify(clean)).not.toMatch(/private|service-user|\$set|current_url|referrer|raw/);
    expect(clean).toMatchObject({ event: "ui_action", properties: { screen: "/community/[postId]", action: "like_click", distinct_id: uuid } });
    expect(beforeSend({ event: "$snapshot", properties: { distinct_id: uuid } })).toBeNull();
    expect(beforeSend({ event: "$pageview", properties: { screen: "/community", distinct_id: "synthetic@example.test" } })).toBeNull();
  });
  it("stops_new_capture_and_resets_without_account_data", async () => {
    const driver = await loadAnalyticsDriver(config, () => true);
    driver.capture({ event: "$pageview", properties: { screen: "/community" } });
    expect(sdk.capture).toHaveBeenCalledTimes(1);
    driver.resetIdentity();
    expect(sdk.reset).toHaveBeenCalledWith(true);
    driver.stop();
    driver.capture({ event: "$pageview", properties: { screen: "/community" } });
    expect(sdk.capture).toHaveBeenCalledTimes(1);
    expect(sdk.shutdown).toHaveBeenCalledTimes(1);
  });
  it("checks_activity_again_after_the_import", async () => {
    let active = true;
    const pending = loadAnalyticsDriver(config, () => active);
    active = false;
    await expect(pending).rejects.toThrow();
    expect(sdk.init).not.toHaveBeenCalled();
  });
  it("never_reuses_an_identity_across_OAuth_document_boundaries", () => {
    const storage = new Map<string, string>();
    storage.set("sseullae.analytics.id.v1", uuid);
    vi.stubGlobal("window", { sessionStorage: { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value) } });
    const first = buildPostHogOptions(config, () => true);
    expect(first.persistence).toBe("memory");
    expect(first.bootstrap).toEqual({});
    expect(buildPostHogOptions(config, () => true).bootstrap).toEqual({});
    vi.stubGlobal("window", { get sessionStorage() { throw new Error("blocked"); } });
    expect(buildPostHogOptions(config, () => true)).toMatchObject({ persistence: "memory", disable_persistence: true, bootstrap: {} });
  });
  it("checks_real_sdk_serialized_capture_without_sending_network_requests", async () => {
    // The published entry minifies private names; this offline fixture uses the same version's source build.
    const { PostHog } = await vi.importActual<typeof import("posthog-js")>("posthog-js/lib/src/posthog-core.js");
    const client = new PostHog();
    const send = vi.spyOn(client, "_send_retriable_request").mockImplementation(() => {});
    const options = buildPostHogOptions(config, () => true);
    const boundary = vi.fn(options.before_send as (input: import("posthog-js").CaptureResult) => import("posthog-js").CaptureResult | null);
    client.init(config.projectToken, { ...options, before_send: boundary, request_batching: false, opt_out_useragent_filter: true });
    try {
      const previousId = client.get_distinct_id();
      const nextDocument = new PostHog();
      vi.spyOn(nextDocument, "_send_retriable_request").mockImplementation(() => {});
      nextDocument.init(config.projectToken, { ...buildPostHogOptions(config, () => true), opt_out_useragent_filter: true });
      expect(nextDocument.get_distinct_id()).not.toBe(previousId);
      await nextDocument.shutdown();
      client.capture("ui_action", { screen: "/community/synthetic?email=private", action: "like_click", email: "private", $set: { nickname: "private" } });
      expect(boundary).toHaveBeenCalledTimes(1);
      expect(boundary.mock.results[0].value).not.toBeNull();
      expect(send).toHaveBeenCalledTimes(1);
      const payload = send.mock.calls[0][0].data;
      expect(payload).toMatchObject({ event: "ui_action", properties: { token: config.projectToken, distinct_id: previousId } });
      expect(JSON.stringify(payload)).not.toMatch(/private|nickname|email|\$set|current_url|referrer/);
      client.reset(true);
      expect(client.get_distinct_id()).not.toBe(previousId);
      client.capture("ui_action", { screen: "/community", action: "like_click" });
      expect(send.mock.calls[0][0].data).toMatchObject({ properties: { distinct_id: previousId } });
      expect(send.mock.calls[1][0].data).toMatchObject({ properties: { distinct_id: client.get_distinct_id() } });
      client.capture("$snapshot", { screen: "/community" });
      expect(send).toHaveBeenCalledTimes(2);
    } finally {
      await client.shutdown();
    }
  });
});
