import type { Instrumentation } from "next";
import { getServerSentryConfig } from "./app/lib/observability/config";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !getServerSentryConfig()) return;
  try { await (await import("./sentry.server.config")).initializeServerSentry(); }
  catch { /* Keep diagnostics independent from application availability. */ }
}

export const onRequestError: Instrumentation.onRequestError = async (_error, request, context) => {
  if (!getServerSentryConfig() || context.routeType !== "route") return;
  const operation = request.method === "GET" && context.routePath === "/api/posts" ? "posts_list" :
    request.method === "POST" && context.routePath === "/api/posts" ? "review_create" :
    request.method === "GET" && context.routePath === "/api/search/posts" ? "search_posts" : null;
  if (!operation) return;
  try { await (await import("./app/lib/observability/report")).reportServerError(operation); }
  catch { /* Do not forward the raw Next.js request or exception. */ }
};
