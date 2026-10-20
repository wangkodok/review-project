import type { PostHogConfig } from "posthog-js";
import { ANALYTICS_API_ORIGIN, type AnalyticsConfig } from "./config";
import { buildPostHogOptions } from "./posthogAdapter";

type QaEnvironment = { nodeEnv?: string; deploymentEnv?: string; flag?: string };

export function isOperatorQaEnabled(input: QaEnvironment) {
  return input.nodeEnv === "development" && !input.deploymentEnv && input.flag === "true";
}

export function getOperatorQaConfig(input: QaEnvironment & {
  appOrigin: string; projectToken: string; confirmed: boolean;
}): AnalyticsConfig | null {
  if (!isOperatorQaEnabled(input) || !input.confirmed || !/^phc_[A-Za-z0-9_-]+$/.test(input.projectToken)) return null;
  try {
    const url = new URL(input.appOrigin);
    if (url.origin !== input.appOrigin || url.protocol !== "http:" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return null;
    return { analytics: true, replay: false, environment: "test", projectToken: input.projectToken, apiHost: ANALYTICS_API_ORIGIN };
  } catch { return null; }
}

export function buildOperatorQaOptions(config: AnalyticsConfig, isActive: () => boolean,
  onEvent: (name: string) => void = () => {}, onError: () => void = () => {}): Partial<PostHogConfig> {
  const options = buildPostHogOptions(config, isActive);
  const sanitize = options.before_send!;
  return {
    ...options,
    request_batching: false,
    on_request_error: onError,
    before_send(input) {
      if (config.environment !== "test" || typeof sanitize !== "function") return null;
      const clean = sanitize(input);
      if (!clean) return null;
      onEvent(clean.event);
      return clean;
    },
  };
}
