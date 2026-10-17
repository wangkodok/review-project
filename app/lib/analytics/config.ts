export type AnalyticsMode = { analytics: boolean; replay: boolean };
export type AnalyticsConfigInput = {
  deploymentEnv?: string;
  nodeEnv?: string;
  appOrigin?: string;
  projectToken?: string;
  host?: string;
  analyticsFlag?: string;
  replayFlag?: string;
};
export type AnalyticsConfig = { analytics: true; replay: false; projectToken: string; apiHost: string };

export const ANALYTICS_APP_ORIGIN = "https://www.sseullae.com";
export const ANALYTICS_API_ORIGIN = "https://us.i.posthog.com";

export function getAnalyticsConfig(input: AnalyticsConfigInput): AnalyticsConfig | null {
  const analytics = input.analyticsFlag === "true";
  const replay = input.replayFlag === "true";
  if (!analytics || replay || input.deploymentEnv !== "production" || input.nodeEnv !== "production" ||
    input.appOrigin !== ANALYTICS_APP_ORIGIN || !input.projectToken ||
    !/^phc_[A-Za-z0-9_-]+$/.test(input.projectToken)) return null;

  try {
    const host = new URL(input.host ?? "");
    if (host.origin !== ANALYTICS_API_ORIGIN || host.username || host.password ||
      host.pathname !== "/" || host.search || host.hash ||
      (input.host !== ANALYTICS_API_ORIGIN && input.host !== `${ANALYTICS_API_ORIGIN}/`)) return null;
    return { analytics, replay, projectToken: input.projectToken, apiHost: host.origin };
  } catch {
    return null;
  }
}
