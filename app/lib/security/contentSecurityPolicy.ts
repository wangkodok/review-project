type ContentSecurityPolicyEnvironment = {
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

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${reviewImageBaseUrl ? ` ${reviewImageBaseUrl.origin}` : ""}`,
    "font-src 'self' data:",
    `connect-src 'self'${isDevelopment ? " ws: wss:" : ""}${r2UploadOrigin ? ` ${r2UploadOrigin}` : ""}`,
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
