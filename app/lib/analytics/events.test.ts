import { describe, expect, it } from "vitest";
import { normalizeAnalyticsLocation, sanitizeAnalyticsEvent } from "./events";

const on = { analytics: true, replay: false, environment: "production" as const };
const names = ["$pageview", "review_write_opened", "review_save_started", "review_save_succeeded", "review_save_failed"];
const save = { screen: "/community/write", mode: "create", hasImage: false };

describe("analytics location privacy", () => {
  it("normalizes_ids_and_removes_query_hash", () => {
    for (const suffix of ["", "/edit", "/report"]) {
      expect(normalizeAnalyticsLocation("/community/synthetic-post" + suffix + "?email=synthetic#secret"))
        .toBe("/community/[postId]" + suffix);
    }
    for (const path of ["/community", "/community/write", "/community/search", "/my", "/my/posts",
      "/my/profile", "/my/withdraw", "/my/withdraw/complete", "/terms", "/privacy"]) {
      expect(normalizeAnalyticsLocation("https://www.sseullae.com" + path + "?code=synthetic#fragment")).toBe(path);
    }
  });
  it("rejects_api_external_unknown_and_encoded_paths", () => {
    for (const url of ["/api/auth/callback/google?code=synthetic", "https://evil.test/community", "//evil.test/community",
      "/not-a-screen", "/community/a/b", "/community/a%2Fb", "/community/a%3Fsecret", "not a url"]) {
      expect(normalizeAnalyticsLocation(url)).toBeNull();
    }
  });
});

describe("five_event_allowlist", () => {
  it.each(names)("sanitizes_%s_without_identifiers_or_unapproved_properties", (event) => {
    const properties = { ...save, screen: "/community/private-post?email=private#private", error: "network",
      environment: "test", email: "private@example.test", userId: "private-member", nickname: "private-name",
      review: "private-review", text: "private-text", image: "private-image", photo: "private-photo",
      postId: "private-post", $set: { email: "private" }, $current_url: "private", nested: { value: "private" } };
    const clean = sanitizeAnalyticsEvent({ event, userId: "private", properties }, on);
    const expected = { screen: "/community/[postId]", environment: "production",
      ...(event.startsWith("review_save_") ? { mode: "create", hasImage: false } : {}),
      ...(event === "review_save_failed" ? { error: "network" } : {}) };
    expect(clean).toEqual({ event, properties: expected });
    expect(JSON.stringify(clean)).not.toMatch(/private|userId|nickname|review":|photo|image":|\$set|current_url/);
  });
  it.each(["production", "test"])("derives_environment_%s_from_configuration_only", (environment) => {
    expect(sanitizeAnalyticsEvent({ event: "$pageview", properties: { screen: "/community", environment: "forged" } },
      { ...on, environment })).toEqual({ event: "$pageview", properties: { screen: "/community", environment } });
  });
  it("rejects_missing_or_unknown_environment_and_disabled_modes", () => {
    const event = { event: "$pageview", properties: { screen: "/community" } };
    for (const environment of [undefined, null, "", "preview", "Production", " test "]) {
      expect(sanitizeAnalyticsEvent(event, { ...on, environment } as typeof on)).toBeNull();
    }
    expect(sanitizeAnalyticsEvent(event, { ...on, analytics: false })).toBeNull();
    expect(sanitizeAnalyticsEvent(event, { ...on, replay: true })).toBeNull();
  });
  it("drops_all_legacy_or_automatic_events_in_both_environments", () => {
    for (const environment of ["production", "test"]) {
      for (const event of ["ui_action", "search_submitted", "filter_changed", "like_result", "review_image_result",
        "$identify", "$snapshot", "$autocapture", "qa_pageview", "qa_ui_action", "unknown"]) {
        expect(sanitizeAnalyticsEvent({ event, properties: { ...save, action: "review_write", filter: "photo", enabled: true } },
          { ...on, environment })).toBeNull();
      }
    }
  });
  it("validates_save_fields_without_coercion_and_only_fixed_error_types", () => {
    for (const event of names.filter((name) => name.startsWith("review_save_"))) {
      const properties = { ...save, error: "network" };
      expect(sanitizeAnalyticsEvent({ event, properties: { ...properties, hasImage: "false" } }, on)).toBeNull();
      expect(sanitizeAnalyticsEvent({ event, properties: { ...properties, mode: "private" } }, on)).toBeNull();
    }
    for (const error of ["auth", "network", "validation", "image", "conflict", "rate_limit", "server", "unknown"]) {
      expect(sanitizeAnalyticsEvent({ event: "review_save_failed", properties: { ...save, error } }, on)?.properties.error).toBe(error);
    }
    expect(sanitizeAnalyticsEvent({ event: "review_save_failed", properties: { ...save, error: "private response" } }, on)).toBeNull();
    expect(sanitizeAnalyticsEvent({ event: "review_save_failed", properties: save }, on)).toBeNull();
  });
  it("rejects_malformed_events_and_throwing_accessors", () => {
    for (const input of [null, {}, [], { event: "$pageview", properties: [] },
      { event: "$pageview", properties: { screen: "/api/auth" } }, { get event() { throw new Error("private"); } }]) {
      expect(sanitizeAnalyticsEvent(input, on)).toBeNull();
    }
  });
  it("validates_and_returns_the_same_snapshot_of_each_allowed_field", () => {
    for (const field of ["screen", "mode", "hasImage", "error"]) {
      const expected: Record<string, unknown> = { ...save, error: "auth" };
      let reads = 0;
      const properties = { ...expected, get [field]() { return ++reads === 1 ? expected[field] : { email: "private" }; } };
      expect(sanitizeAnalyticsEvent({ event: "review_save_failed", properties }, on)).toEqual({
        event: "review_save_failed", properties: { ...expected, environment: "production" },
      });
      expect(reads).toBe(1);
    }
  });
});
