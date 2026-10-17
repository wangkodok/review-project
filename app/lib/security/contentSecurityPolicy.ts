import { ANALYTICS_API_ORIGIN, ANALYTICS_APP_ORIGIN, getAnalyticsConfig, type AnalyticsConfig } from "../analytics/config";

type ContentSecurityPolicyEnvironment = {
  analyticsConfig?: AnalyticsConfig | null;
  operatorQaEnabled?: boolean;
  nodeEnv?: string;
  reviewImagePublicBaseUrl?: string;
  r2AccountId?: string;
  r2Endpoint?: string;
};

type R2OriginEnvironment = Pick<
  ContentSecurityPolicyEnvironment,
  "r2AccountId" | "r2Endpoint"
>;

const CLOUDFLARE_ACCOUNT_ID_PATTERN = /^[a-f0-9]{32}$/;

function getHttpsOrigin(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);

    if (
      url.protocol !== "https:" ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    ) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

export function getR2UploadOrigin({
  r2AccountId,
  r2Endpoint,
}: R2OriginEnvironment) {
  const accountId = r2AccountId?.trim().toLowerCase();
  const endpoint = getHttpsOrigin(r2Endpoint);

  if (
    !accountId ||
    !CLOUDFLARE_ACCOUNT_ID_PATTERN.test(accountId) ||
    !endpoint ||
    endpoint.port ||
    endpoint.hostname !== `${accountId}.r2.cloudflarestorage.com`
  ) {
    return null;
  }

  return endpoint.origin;
}

export function getReviewImagePublicBaseUrl(value: string | undefined) {
  return getHttpsOrigin(value);
}

export function buildContentSecurityPolicy(
  environment: ContentSecurityPolicyEnvironment,
) {
  const isDevelopment = environment.nodeEnv !== "production";
  const reviewImageBaseUrl = getReviewImagePublicBaseUrl(
    environment.reviewImagePublicBaseUrl,
  );
  const r2UploadOrigin = getR2UploadOrigin(environment);
  const analytics = environment.analyticsConfig;
  const analyticsOrigin = (environment.nodeEnv === "development" && environment.operatorQaEnabled ? ANALYTICS_API_ORIGIN : null) || (analytics && getAnalyticsConfig({
    nodeEnv: environment.nodeEnv, deploymentEnv: "production", appOrigin: ANALYTICS_APP_ORIGIN,
    analyticsFlag: analytics.analytics === true ? "true" : "false", replayFlag: analytics.replay ? "true" : "false",
    projectToken: analytics.projectToken, host: analytics.apiHost,
  })?.apiHost);

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${reviewImageBaseUrl ? ` ${reviewImageBaseUrl.origin}` : ""}`,
    "font-src 'self' data:",
    `connect-src 'self'${isDevelopment ? " ws: wss:" : ""}${r2UploadOrigin ? ` ${r2UploadOrigin}` : ""}${analyticsOrigin ? ` ${analyticsOrigin}` : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "media-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}
