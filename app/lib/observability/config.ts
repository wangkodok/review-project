export const SENTRY_APP_ORIGIN = "https://www.sseullae.com";

export const SERVER_OPERATIONS = {
  posts_list: { route: "/api/posts", method: "GET" },
  review_create: { route: "/api/posts", method: "POST" },
  search_posts: { route: "/api/search/posts", method: "GET" },
} as const;

export type ServerOperation = keyof typeof SERVER_OPERATIONS;
export type SentryConfig = {
  dsn: string;
  ingestOrigin: string;
  environment: "production";
  release?: string;
};

export function getSentryConfig(input: {
  flag?: string; nodeEnv?: string; deploymentEnv?: string; dsn?: string; release?: string;
}): SentryConfig | null {
  if (input.flag !== "true" || input.nodeEnv !== "production" || input.deploymentEnv !== "production") return null;
  try {
    const url = new URL(input.dsn ?? "");
    if (url.protocol !== "https:" || !/^[a-f0-9]{32}$/.test(url.username) || url.password || url.port ||
      !/^o[0-9]+\.ingest\.us\.sentry\.io$/.test(url.hostname) || !/^\/[1-9][0-9]{0,19}$/.test(url.pathname) ||
      url.search || url.hash || url.href !== input.dsn) return null;
    return { dsn: input.dsn!, ingestOrigin: url.origin, environment: "production",
      ...(/^[a-f0-9]{40}$/.test(input.release ?? "") ? { release: input.release } : {}) };
  } catch {
    return null;
  }
}

export function getServerSentryConfig() {
  return getSentryConfig({ flag: process.env.SENTRY_ENABLED, nodeEnv: process.env.NODE_ENV,
    deploymentEnv: process.env.VERCEL_ENV, dsn: process.env.SENTRY_DSN, release: process.env.VERCEL_GIT_COMMIT_SHA });
}
