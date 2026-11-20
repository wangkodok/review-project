import { describe, expect, it, vi } from "vitest";
import { getSentryConfig } from "./config";
import { createPrivacyTransport, getSentryOptions, type Envelope } from "./privacy";

describe("installed Sentry SDK with a mock transport", () => {
  it("sends only sanitized errors and spans, without any real network request", async () => {
    const sdk = await import("@sentry/nextjs");
    const config = getSentryConfig({ flag: "true", nodeEnv: "production", deploymentEnv: "production",
      dsn: `https://${"a".repeat(32)}@o123.ingest.us.sentry.io/456` })!;
    const sent: Envelope[] = [];
    const send = vi.fn(async (envelope: Envelope) => { sent.push(envelope); return { statusCode: 200 }; });
    const base = () => ({ send, flush: async () => true });
    sdk.init({ ...getSentryOptions(config, () => null), integrations: [],
      enableOpenTelemetrySetup: false, enableRuntimeChannelInjection: false,
      tracesSampler: () => 1, transport: createPrivacyTransport(config, base, () => null) });
    try {
      const secret = "synthetic-private-sdk-sentinel@example.invalid";
      sdk.captureException(new Error(secret), { tags: { route: "/api/posts", operation: "posts_list" },
        user: { email: secret }, extra: { body: secret } });
      await sdk.startSpan({ name: "posts_list", op: "function" }, async () => "synthetic result");
      await sdk.startSpan({ name: "GET www.sseullae.com", op: "http.client",
        attributes: { "http.request.method": "GET", "url.full": `https://www.sseullae.com/api/posts?q=${secret}` } }, async () => "mock fetch result");
      await sdk.flush(2000);
      expect(sent.length).toBeGreaterThan(0);
      expect(JSON.stringify(sent)).not.toContain(secret);
      const types = sent.flatMap((envelope) => envelope[1].map(([header]) => header.type));
      expect(types).toContain("event");
      expect(types).toContain("span");
      for (const envelope of sent) for (const [header, payload] of envelope[1]) {
        if (header.type === "event") expect(payload).toHaveProperty("sdk.settings.infer_ip", "never");
      }
      expect(JSON.stringify(sent)).toContain('"name":"GET /api/posts"');
      expect(types.every((type) => type === "event" || type === "span")).toBe(true);
    } finally {
      await sdk.close(2000);
    }
  });
});
