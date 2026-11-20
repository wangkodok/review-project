import { getServerSentryConfig } from "./app/lib/observability/config";
import { createPrivacyTransport, getSentryOptions } from "./app/lib/observability/privacy";

export async function initializeServerSentry(): Promise<void> {
  const config = getServerSentryConfig();
  if (!config) return;
  try {
    const sdk = await import("@sentry/nextjs");
    sdk.init({ ...getSentryOptions(config, () => null), integrations: [],
      enableOpenTelemetrySetup: false, enableRuntimeChannelInjection: false,
      transport: createPrivacyTransport(config, sdk.makeNodeTransport, () => null) });
  } catch { /* A monitoring failure must not prevent Next.js from starting. */ }
}
