import { getSentryConfig, SENTRY_APP_ORIGIN } from "./app/lib/observability/config";
import { createPrivacyTransport, getSentryOptions, normalizeObservedRoute } from "./app/lib/observability/privacy";

let initialization: Promise<typeof import("@sentry/nextjs") | null> | undefined;

function browserConfig() {
  if (typeof window === "undefined" || window.location.origin !== SENTRY_APP_ORIGIN) return null;
  return getSentryConfig({ flag: process.env.NEXT_PUBLIC_SENTRY_ENABLED, nodeEnv: process.env.NODE_ENV,
    deploymentEnv: process.env.NEXT_PUBLIC_SENTRY_DEPLOYMENT_ENV, dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE });
}

export async function initializeBrowserSentry(): Promise<void> {
  const config = browserConfig();
  if (!config) return;
  initialization ??= (async () => {
    try {
      const sdk = await import("@sentry/nextjs");
      const location = () => window.location.pathname;
      sdk.init({ ...getSentryOptions(config, location),
        transport: createPrivacyTransport(config, sdk.makeFetchTransport, location),
        transportOptions: { fetchOptions: { credentials: "omit", referrerPolicy: "no-referrer" } },
        integrations: [sdk.globalHandlersIntegration(), sdk.browserTracingCoreIntegration({
          instrumentNavigation: false,
          beforeStartSpan: (options) => ({ ...options, name: normalizeObservedRoute(
            options.op === "pageload" && options.name === "Pageload" ? location() : options.name,
          ) ?? "excluded" }),
        }), sdk.webVitalsIntegration(), sdk.fetchTracingIntegration({
          shouldCreateSpanForRequest: (url) => normalizeObservedRoute(location()) !== null &&
            (normalizeObservedRoute(url)?.startsWith("/api/") ?? false),
        })] });
      return sdk;
    } catch { return null; }
  })();
  await initialization;
}

export function onRouterTransitionStart(url: string) {
  if (!browserConfig()) return;
  const route = normalizeObservedRoute(url);
  void initialization?.then((sdk) => {
    try {
      const client = sdk?.getClient();
      // Next starts transitions before location changes; never use the source URL.
      if (sdk && client) sdk.startBrowserTracingNavigationSpan(client, { name: route ?? "excluded" },
        { url: SENTRY_APP_ORIGIN + (route ?? "/") });
    } catch { /* Navigation must work even when monitoring fails. */ }
  }).catch(() => undefined);
}

void initializeBrowserSentry();
