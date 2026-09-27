import type { NextConfig } from "next";
import {
  buildContentSecurityPolicy,
  getReviewImagePublicBaseUrl,
} from "./app/lib/security/contentSecurityPolicy";

const reviewImageBaseUrl = getReviewImagePublicBaseUrl(
  process.env.REVIEW_IMAGE_PUBLIC_BASE_URL,
);
const contentSecurityPolicy = buildContentSecurityPolicy({
  nodeEnv: process.env.NODE_ENV,
  reviewImagePublicBaseUrl: process.env.REVIEW_IMAGE_PUBLIC_BASE_URL,
  r2AccountId: process.env.R2_ACCOUNT_ID,
  r2Endpoint: process.env.R2_ENDPOINT,
});

const nextConfig: NextConfig = {
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
