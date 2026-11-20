import type { NextConfig } from "next";
import { getSentryConfig } from "./app/lib/observability/config";
import { ANALYTICS_APP_ORIGIN, getAnalyticsConfig } from "./app/lib/analytics/config";
import { isOperatorQaEnabled } from "./app/lib/analytics/operatorQa";
import {
  buildContentSecurityPolicy,
  getReviewImagePublicBaseUrl,
} from "./app/lib/security/contentSecurityPolicy";

const operatorQaEnabled = isOperatorQaEnabled({ nodeEnv: process.env.NODE_ENV,
  deploymentEnv: process.env.VERCEL_ENV, flag: process.env.POSTHOG_OPERATOR_QA_ENABLED });
const reviewImageBaseUrl = getReviewImagePublicBaseUrl(
  process.env.REVIEW_IMAGE_PUBLIC_BASE_URL,
);
const contentSecurityPolicy = buildContentSecurityPolicy({
  sentryConfig: getSentryConfig({ flag: process.env.NEXT_PUBLIC_SENTRY_ENABLED, nodeEnv: process.env.NODE_ENV,
    deploymentEnv: process.env.VERCEL_ENV, dsn: process.env.NEXT_PUBLIC_SENTRY_DSN }),
  operatorQaEnabled,
  analyticsConfig: getAnalyticsConfig({
    appOrigin: ANALYTICS_APP_ORIGIN,
    deploymentEnv: process.env.VERCEL_ENV,
    nodeEnv: process.env.NODE_ENV,
    projectToken: process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    analyticsFlag: process.env.NEXT_PUBLIC_POSTHOG_ANALYTICS_ENABLED,
    replayFlag: process.env.NEXT_PUBLIC_POSTHOG_REPLAY_ENABLED,
  }),
  nodeEnv: process.env.NODE_ENV,
  reviewImagePublicBaseUrl: process.env.REVIEW_IMAGE_PUBLIC_BASE_URL,
  r2AccountId: process.env.R2_ACCOUNT_ID,
  r2Endpoint: process.env.R2_ENDPOINT,
});

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SENTRY_DEPLOYMENT_ENV: process.env.VERCEL_ENV ?? "",
    NEXT_PUBLIC_SENTRY_RELEASE: /^[a-f0-9]{40}$/.test(process.env.VERCEL_GIT_COMMIT_SHA ?? "") ? process.env.VERCEL_GIT_COMMIT_SHA! : "",
  },
  ...(operatorQaEnabled ? { distDir: ".next-operator-qa" } : {}),
  poweredByHeader: false,
  images: reviewImageBaseUrl
    ? {
        remotePatterns: [
          {
            protocol: "https",
            hostname: reviewImageBaseUrl.hostname,
            port: reviewImageBaseUrl.port,
            pathname: "/**",
          },
        ],
      }
    : undefined,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
