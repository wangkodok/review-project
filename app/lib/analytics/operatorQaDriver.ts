import type { AnalyticsConfig } from "./config";
import { sanitizeAnalyticsEvent } from "./events";
import { buildOperatorQaOptions, getOperatorQaConfig } from "./operatorQa";
import type { AnalyticsDriver } from "./posthogAdapter";

export async function loadOperatorQaDriver(config: AnalyticsConfig, isActive: () => boolean,
  onEvent: (name: string) => void, onError: () => void): Promise<AnalyticsDriver> {
  const validated = getOperatorQaConfig({ nodeEnv: process.env.NODE_ENV, flag: "true",
    appOrigin: window.location.origin, projectToken: config.projectToken, confirmed: true });
  if (!validated || !isActive()) throw new Error("operator_qa_disabled");
  const { PostHog } = await import("posthog-js");
  if (!isActive()) throw new Error("operator_qa_disabled");
  let stopped = false;
  const active = () => !stopped && isActive();
  const client = new PostHog();
  client.init(validated.projectToken, buildOperatorQaOptions(validated, active, onEvent, onError));
  return {
    capture(event) {
      if (!active()) return;
      const clean = sanitizeAnalyticsEvent(event, validated);
      if (clean) client.capture(clean.event, clean.properties);
    },
    resetIdentity() { if (active()) client.reset(true); },
    stop() {
      if (stopped) return;
      stopped = true;
      void client.shutdown().catch(() => {});
    },
  };
}
