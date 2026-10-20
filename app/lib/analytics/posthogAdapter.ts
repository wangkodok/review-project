import type { CaptureResult, PostHogConfig } from "posthog-js";
import { ANALYTICS_API_ORIGIN, ANALYTICS_APP_ORIGIN, isAnalyticsPrivacyBlocked, type AnalyticsConfig } from "./config";
import { ANALYTICS_ENVIRONMENTS, sanitizeAnalyticsEvent, type AnalyticsEnvelope } from "./events";

export type AnalyticsDriver = {
  capture(event: AnalyticsEnvelope): void;
  resetIdentity(): void;
  stop(): void;
};

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function buildPostHogOptions(config: AnalyticsConfig, isActive: () => boolean): Partial<PostHogConfig> {
  return {
    api_host: config.apiHost,
    cookieless_mode: "always",
    persistence: "memory",
    disable_persistence: true,
    bootstrap: {},
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    disable_external_dependency_loading: true,
    advanced_disable_flags: true,
    advanced_disable_feature_flags: true,
    advanced_disable_feature_flags_on_first_load: true,
    advanced_disable_toolbar_metrics: true,
    disable_surveys: true,
    disable_surveys_automatic_display: true,
    disable_conversations: true,
    disable_product_tours: true,
    disable_web_experiments: true,
    opt_in_site_apps: false,
    capture_performance: false,
    capture_exceptions: false,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    capture_webmcp: false,
    enable_recording_console_log: false,
    logs: { captureConsoleLogs: false },
    metrics: { network: false },
    person_profiles: "never",
    save_referrer: false,
    save_campaign_params: false,
    disableDeviceModel: true,
    disable_scroll_properties: true,
    disable_capture_url_hashes: true,
    cross_subdomain_cookie: false,
    debug: false,
    respect_dnt: true,
    on_request_error: () => {},
    get_current_url: () => "https://www.sseullae.com",
    before_send: (input) => {
      try {
        if (!isActive() || isAnalyticsPrivacyBlocked()) return null;
        const clean = sanitizeAnalyticsEvent(input, config);
        const id: unknown = input.properties.distinct_id;
        if (!clean || id !== "$posthog_cookieless" || input.properties.$cookieless_mode !== true) return null;
        // Cookieless hashing needs browser metadata, never event-supplied copies.
        const userAgent: unknown = globalThis.navigator?.userAgent;
        const origin: unknown = globalThis.location?.origin;
        if (typeof userAgent !== "string" || !userAgent.trim() || typeof origin !== "string" ||
          Array.from(userAgent).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return null;
        const location = new URL(origin);
        if (location.origin !== origin || (config.environment === "production"
          ? origin !== ANALYTICS_APP_ORIGIN
          : config.environment !== "test" || location.protocol !== "http:" ||
            !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname))) return null;
        const properties: Record<string, unknown> = {
          ...clean.properties, token: config.projectToken, distinct_id: id, $process_person_profile: false,
          $cookieless_mode: true,
          $raw_user_agent: userAgent.length > 1000 ? userAgent.substring(0, 997) + "..." : userAgent,
          $host: location.host,
          // GeoIP enrichment happens on the server, after client-side redaction.
          $geoip_disable: true,
        };
        const uuid = input.uuid;
        if (typeof uuid !== "string" || !UUID.test(uuid)) return null;
        const event: CaptureResult = { uuid, event: clean.event, properties };
        if (input.timestamp instanceof Date && Number.isFinite(input.timestamp.getTime())) event.timestamp = input.timestamp;
        return event;
      } catch {
        return null;
      }
    },
  };
}

export async function loadAnalyticsDriver(config: AnalyticsConfig, isActive: () => boolean): Promise<AnalyticsDriver> {
  if (!isActive() || isAnalyticsPrivacyBlocked() || config.analytics !== true || config.replay !== false || config.apiHost !== ANALYTICS_API_ORIGIN ||
    !ANALYTICS_ENVIRONMENTS.includes(config.environment) ||
    !/^phc_[A-Za-z0-9_-]+$/.test(config.projectToken)) throw new Error("analytics_disabled");
  const { PostHog } = await import("posthog-js");
  if (!isActive() || isAnalyticsPrivacyBlocked()) throw new Error("analytics_disabled");
  let stopped = false;
  const active = () => !stopped && isActive() && !isAnalyticsPrivacyBlocked();
  const client = new PostHog();
  client.init(config.projectToken, buildPostHogOptions(config, active));
  return {
    capture(event) {
      if (!active()) return;
      const clean = sanitizeAnalyticsEvent(event, config);
      if (clean) client.capture(clean.event, clean.properties);
    },
    resetIdentity() {
      if (!active()) return;
      client.reset(true);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      void client.shutdown().catch(() => {});
    },
  };
}
