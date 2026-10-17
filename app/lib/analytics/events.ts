import { ANALYTICS_APP_ORIGIN, type AnalyticsMode } from "./config";

export const ANALYTICS_ACTIONS = ["review_write", "search_open", "region_open", "category_open",
  "photo_filter_toggle", "sort_change", "post_open", "like_click", "image_pick", "my_open",
  "profile_open", "my_posts_open", "share"] as const;
export type AnalyticsAction = typeof ANALYTICS_ACTIONS[number];
const errors = ["auth", "network", "validation", "image", "conflict", "rate_limit", "server", "unknown"] as const;
export type AnalyticsErrorKind = typeof errors[number];
type AnalyticsContext = { screen: string };
type SaveContext = AnalyticsContext & { mode: "create" | "edit"; hasImage: boolean };
export type AnalyticsEnvelope = { event: string; properties: Record<string, unknown> };
export type AnalyticsEvent =
  | { event: "$pageview" | "review_write_opened" | "search_submitted"; properties: AnalyticsContext }
  | { event: "ui_action"; properties: AnalyticsContext & { action: AnalyticsAction } }
  | { event: "review_save_started" | "review_save_succeeded"; properties: SaveContext }
  | { event: "review_save_failed"; properties: SaveContext & { error: AnalyticsErrorKind } }
  | { event: "review_image_result"; properties: AnalyticsContext & {
      stage: "optimizing" | "uploading"; result: "success" | "failed"; error?: AnalyticsErrorKind;
    } }
  | { event: "like_result"; properties: AnalyticsContext & { result: "login_required" | "added" | "removed" | "failed" } }
  | { event: "filter_changed"; properties: AnalyticsContext & { filter: "region" | "category" | "photo" | "sort"; enabled: boolean } };

const screens = new Set(["/community", "/community/write", "/community/search", "/my", "/my/posts",
  "/my/profile", "/my/withdraw", "/my/withdraw/complete", "/terms", "/privacy"]);

export function normalizeAnalyticsLocation(value: string): string | null {
  try {
    if (!value.startsWith("/") && !value.startsWith(`${ANALYTICS_APP_ORIGIN}/`)) return null;
    const url = new URL(value, ANALYTICS_APP_ORIGIN);
    if (url.origin !== ANALYTICS_APP_ORIGIN || url.username || url.password) return null;
    const path = url.pathname;
    if (screens.has(path)) return path;
    if (/^\/community\/(?:[A-Za-z0-9_-]+|\[postId\])(?:\/(?:edit|report))?$/.test(path)) {
      const segments = path.split("/");
      return `/community/[postId]${segments[3] ? `/${segments[3]}` : ""}`;
    }
    return null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function member<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

export function sanitizeAnalyticsEvent(input: unknown, mode: AnalyticsMode): AnalyticsEnvelope | null {
  try {
    if (!mode.analytics || !isRecord(input)) return null;
    const event = input.event;
    const p = input.properties;
    if (!isRecord(p)) return null;
    const location = p.screen;
    const screen = typeof location === "string" ? normalizeAnalyticsLocation(location) : null;
    if (!screen) return null;
    const properties: Record<string, unknown> = { screen };
    switch (event) {
      case "$pageview": case "review_write_opened": case "search_submitted": break;
      case "ui_action": {
        const action = p.action;
        if (!member(action, ANALYTICS_ACTIONS)) return null;
        properties.action = action;
        break;
      }
      case "review_save_started": case "review_save_succeeded": case "review_save_failed": {
        const saveMode = p.mode;
        const hasImage = p.hasImage;
        if (!member(saveMode, ["create", "edit"]) || typeof hasImage !== "boolean") return null;
        properties.mode = saveMode;
        properties.hasImage = hasImage;
        if (event === "review_save_failed") {
          const error = p.error;
          if (!member(error, errors)) return null;
          properties.error = error;
        }
        break;
      }
      case "review_image_result": {
        const stage = p.stage;
        const result = p.result;
        const error = p.error;
        if (!member(stage, ["optimizing", "uploading"]) || !member(result, ["success", "failed"])) return null;
        properties.stage = stage;
        properties.result = result;
        if (error !== undefined) {
          if (!member(error, errors)) return null;
          properties.error = error;
        }
        break;
      }
      case "like_result": {
        const result = p.result;
        if (!member(result, ["login_required", "added", "removed", "failed"])) return null;
        properties.result = result;
        break;
      }
      case "filter_changed": {
        const filter = p.filter;
        const enabled = p.enabled;
        if (!member(filter, ["region", "category", "photo", "sort"]) || typeof enabled !== "boolean") return null;
        properties.filter = filter;
        properties.enabled = enabled;
        break;
      }
      default: return null;
    }
    return { event, properties };
  } catch {
    return null;
  }
}
