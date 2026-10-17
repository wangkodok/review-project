import { describe, expect, it } from "vitest";
import { normalizeAnalyticsLocation, sanitizeAnalyticsEvent } from "./events";

const on = { analytics: true, replay: false };
describe("analytics location privacy", () => {
  it("normalizes_ids_and_removes_query_hash", () => {
    for (const suffix of ["", "/edit", "/report"]) {
      expect(normalizeAnalyticsLocation(`/community/synthetic-post${suffix}?email=synthetic#secret`))
        .toBe(`/community/[postId]${suffix}`);
    }
    for (const path of ["/community", "/community/write", "/community/search", "/my", "/my/posts",
      "/my/profile", "/my/withdraw", "/my/withdraw/complete", "/terms", "/privacy"]) {
      expect(normalizeAnalyticsLocation(`https://www.sseullae.com${path}?code=synthetic#fragment`)).toBe(path);
    }
  });
  it("rejects_api_external_unknown_and_encoded_paths", () => {
    for (const url of ["/api/auth/callback/google?code=synthetic", "https://evil.test/community", "//evil.test/community",
      "/not-a-screen", "/community/a/b", "/community/a%2Fb", "/community/a%3Fsecret", "not a url"]) {
      expect(normalizeAnalyticsLocation(url)).toBeNull();
    }
  });
});

describe("analytics event allowlist", () => {
  it("does_not_revive_analytics_in_replay_only_mode", () => {
    expect(sanitizeAnalyticsEvent({ event: "$pageview", properties: { screen: "/community" } },
      { analytics: false, replay: true })).toBeNull();
  });
  it("removes_unapproved_properties_and_raw_identifiers", () => {
    const clean = sanitizeAnalyticsEvent({ event: "ui_action", userId: "synthetic", properties: {
      screen: "/community/synthetic?secret=private", action: "like_click", email: "synthetic@example.test",
      $set: { email: "synthetic" }, $current_url: "private", $initial_referrer: "private",
      postId: "synthetic", nested: { raw: "private" }, text: "private",
    } }, on);
    expect(clean).toEqual({ event: "ui_action", properties: { screen: "/community/[postId]", action: "like_click" } });
    expect(JSON.stringify(clean)).not.toMatch(/synthetic|private|email|postId":/);
  });
  it("accepts_only_known_actions_and_events", () => {
    for (const action of ["review_write", "search_open", "region_open", "category_open", "photo_filter_toggle",
      "sort_change", "post_open", "like_click", "image_pick", "my_open", "profile_open", "my_posts_open", "share"]) {
      expect(sanitizeAnalyticsEvent({ event: "ui_action", properties: { screen: "/community", action } }, on)?.properties.action).toBe(action);
    }
    for (const input of [null, {}, { event: "$snapshot", properties: { screen: "/community" } },
      { event: "ui_action", properties: { screen: "/community", action: "private" } },
      { event: "$pageview", properties: { screen: "/api/auth" } }]) {
      expect(sanitizeAnalyticsEvent(input, on)).toBeNull();
    }
  });
  it("validates_result_shapes_without_coercion", () => {
    const screen = "/community/write";
    for (const event of ["$pageview", "review_write_opened", "search_submitted"]) {
      expect(sanitizeAnalyticsEvent({ event, properties: { screen } }, on)).toEqual({ event, properties: { screen } });
    }
    for (const event of ["review_save_started", "review_save_succeeded", "review_save_failed"]) {
      const properties = { screen, mode: "create", hasImage: false, ...(event.endsWith("failed") ? { error: "network" } : {}) };
      expect(sanitizeAnalyticsEvent({ event, properties }, on)).toEqual({ event, properties });
      expect(sanitizeAnalyticsEvent({ event, properties: { ...properties, hasImage: "false" } }, on)).toBeNull();
    }
    for (const error of ["auth", "network", "validation", "image", "conflict", "rate_limit", "server", "unknown"]) {
      expect(sanitizeAnalyticsEvent({ event: "review_image_result", properties: { screen, stage: "uploading", result: "failed", error } }, on)?.properties.error).toBe(error);
    }
    for (const result of ["login_required", "added", "removed", "failed"]) {
      expect(sanitizeAnalyticsEvent({ event: "like_result", properties: { screen, result } }, on)?.properties.result).toBe(result);
    }
    for (const filter of ["region", "category", "photo", "sort"]) {
      expect(sanitizeAnalyticsEvent({ event: "filter_changed", properties: { screen, filter, enabled: true } }, on)?.properties.filter).toBe(filter);
    }
    expect(sanitizeAnalyticsEvent({ event: "review_image_result", properties: { screen, stage: "raw", result: "failed" } }, on)).toBeNull();
    expect(sanitizeAnalyticsEvent({ event: "review_save_failed", properties: { screen, mode: "edit", hasImage: true, error: "raw response" } }, on)).toBeNull();
  });
  it("fails_closed_when_accessors_throw", () => {
    expect(sanitizeAnalyticsEvent({ get event() { throw new Error("synthetic"); } }, on)).toBeNull();
  });
  it("validates_and_returns_the_same_snapshot_of_each_field", () => {
    const cases = [
      { event: "ui_action", values: { action: "like_click" }, field: "action" },
      { event: "review_save_failed", values: { mode: "edit", hasImage: false, error: "auth" }, field: "mode" },
      { event: "review_save_started", values: { mode: "create", hasImage: true }, field: "hasImage" },
      { event: "review_save_failed", values: { mode: "create", hasImage: false, error: "server" }, field: "error" },
      { event: "review_image_result", values: { stage: "uploading", result: "success" }, field: "stage" },
      { event: "like_result", values: { result: "added" }, field: "result" },
      { event: "filter_changed", values: { filter: "photo", enabled: true }, field: "filter" },
      { event: "filter_changed", values: { filter: "photo", enabled: true }, field: "enabled" },
      { event: "$pageview", values: { screen: "/community" }, field: "screen" },
    ];
    for (const { event, values, field } of cases) {
      const expected: Record<string, unknown> = { screen: "/community", ...values };
      let reads = 0;
      const properties = { ...expected, get [field]() { return ++reads === 1 ? expected[field] : { email: "synthetic-private" }; } };
      expect(sanitizeAnalyticsEvent({ event, properties }, on)).toEqual({ event, properties: expected });
      expect(reads).toBe(1);
    }
    let eventReads = 0;
    let propertyReads = 0;
    const input = {
      get event() { return ++eventReads === 1 ? "$pageview" : "synthetic-private"; },
      get properties() { return ++propertyReads === 1 ? { screen: "/community" } : { screen: "/api/private" }; },
    };
    expect(sanitizeAnalyticsEvent(input, on)).toEqual({ event: "$pageview", properties: { screen: "/community" } });
    expect(eventReads).toBe(1);
    expect(propertyReads).toBe(1);
  });
});
