import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV !== "production";
const reviewImageBaseUrl = (() => {
  const value = process.env.REVIEW_IMAGE_PUBLIC_BASE_URL?.trim();

  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
})();
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${reviewImageBaseUrl ? ` ${reviewImageBaseUrl.origin}` : ""}`,
  "font-src 'self' data:",
  `connect-src 'self'${isDevelopment ? " ws: wss:" : ""}`,
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
