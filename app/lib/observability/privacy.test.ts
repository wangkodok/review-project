import { describe, expect, it } from "vitest";
import { getSentryConfig } from "./config";
import { getSentryOptions, normalizeObservedRoute, sanitizeEnvelope, sanitizeErrorEvent, sanitizeStreamedSpan, type Envelope } from "./privacy";

const config = getSentryConfig({ flag: "true", nodeEnv: "production", deploymentEnv: "production",
  dsn: `https://${"a".repeat(32)}@o123.ingest.us.sentry.io/456` })!;
const secret = "private-sentinel@example.invalid";

describe("Sentry privacy boundary", () => {
  it.each([
    ["/community?search=private#fragment", "/community"],
    ["/community/private-post-id", "/community/[postId]"],
    ["/community/write", "/community/write"],
    ["/community/search?q=private", "/community/search"],
    ["/search", null],
    ["/api/posts/private-post-id", "/api/posts/[postId]"],
    ["/api/search/posts?q=private", "/api/search/posts"],
    ["/my", null], ["/api/auth/session", null], ["/api/review-images", null],
    ["/community/private-id/edit", null], ["https://evil.test/community", null],
    ["//evil.test/community", null], ["/community%2fprivate", null],
  ])("normalizes %s without member or resource identity", (value, expected) => {
    expect(normalizeObservedRoute(value)).toBe(expected);
  });

  it("rebuilds error events instead of trusting arbitrary SDK context", () => {
    const event = sanitizeErrorEvent({
      event_id: "a".repeat(32), timestamp: 123, environment: secret,
      user: { email: secret }, request: { url: `/community?token=${secret}`, headers: { Cookie: secret }, data: secret },
      extra: { body: secret }, breadcrumbs: [{ message: secret }], server_name: secret,
      tags: { route: "/community", operation: "posts_list", member: secret },
      exception: { values: [{ type: "TypeError", value: secret, stacktrace: { frames: [
        { filename: "app/api/posts/route.ts", lineno: 42, function: secret, vars: { token: secret }, context_line: secret },
        { filename: `https://evil.test/${secret}`, lineno: 1 },
      ] } }] },
    }, config, "/community");
    expect(JSON.stringify(event)).not.toContain(secret);
    expect(event).toMatchObject({ environment: "production", tags: { route: "/community" },
      exception: { values: [{ type: "TypeError", value: "Unexpected application error",
        stacktrace: { frames: [{ filename: "app/api/posts/route.ts", lineno: 42 }] } }] } });
    expect(event).not.toHaveProperty("user");
    expect(event).not.toHaveProperty("request");
    expect(event).not.toHaveProperty("breadcrumbs");
    expect(event).toHaveProperty("sdk.settings.infer_ip", "never");
  });

  it("drops events on excluded or unknown routes", () => {
    expect(sanitizeErrorEvent({}, config, "/my")).toBeNull();
    expect(sanitizeErrorEvent({}, config, null)).toBeNull();
  });

  it("filters final envelope headers, item headers, spans, and unsupported products", () => {
    const envelope = [{ event_id: "a".repeat(32), arbitrary: secret,
      trace: { trace_id: "b".repeat(32), transaction: secret, user_segment: secret } }, [
      [{ type: "event", arbitrary: secret }, { message: secret, tags: { route: "/community" } }],
      [{ type: "span", item_count: 1, arbitrary: secret }, { version: 2, items: [{
        trace_id: "b".repeat(32), span_id: "c".repeat(16), name: `GET /api/posts?q=${secret}`,
        start_timestamp: 1, end_timestamp: 2, status: "ok", is_segment: true,
        links: [{ attributes: { body: secret } }],
        attributes: { "sentry.op": { type: "string", value: "http.client" },
          "http.request.method": { type: "string", value: "GET" },
          "http.response.status_code": { type: "integer", value: 200 },
          "http.request.header.cookie": { type: "string", value: secret } },
      }] }],
      [{ type: "attachment", filename: secret }, secret],
      [{ type: "replay_event" }, { data: secret }],
      [{ type: "log" }, { data: secret }],
      [{ type: "session" }, { data: secret }],
      [{ type: "client_report" }, { data: secret }],
    ]] as unknown as Envelope;
    const safe = sanitizeEnvelope(envelope, config, "/community");
    expect(JSON.stringify(safe)).not.toContain(secret);
    expect(safe?.[1].map(([header]) => header.type)).toEqual(["event", "span"]);
    expect(safe?.[1][1][1]).toMatchObject({ ingest_settings: { infer_ip: "never", infer_user_agent: "never" },
      items: [{ name: "GET /api/posts" }] });
    expect(envelope[0]).toHaveProperty("arbitrary", secret);
  });

  it("drops excluded spans and empty envelopes", () => {
    expect(sanitizeEnvelope([{}, [[{ type: "session" }, {}]]] as unknown as Envelope, config, "/community")).toBeNull();
    const envelope = [{}, [[{ type: "span" }, { items: [{ name: "GET /api/auth/session" }] }]]] as unknown as Envelope;
    expect(sanitizeEnvelope(envelope, config, "/community")).toBeNull();
  });

  it("uses streamed fetch URL attributes, not SDK 11 domain-only span names", () => {
    const attributes = { "sentry.op": { type: "string", value: "http.client" },
      "http.request.method": { type: "string", value: "GET" },
      "url.full": { type: "string", value: `https://www.sseullae.com/api/posts?q=${secret}` } };
    const span = { trace_id: "b".repeat(32), span_id: "c".repeat(16), name: "GET www.sseullae.com",
      start_timestamp: 1, end_timestamp: 2, status: "ok", is_segment: true, attributes };
    const envelope = (value: unknown) => [{}, [[{ type: "span" }, { items: [value] }]]] as unknown as Envelope;
    const safe = sanitizeEnvelope(envelope(span), config, "/community");
    expect(safe?.[1][0][1]).toMatchObject({ items: [{ name: "GET /api/posts" }] });
    expect(JSON.stringify(safe)).not.toContain(secret);
    expect(sanitizeEnvelope(envelope({ ...span, attributes: { ...attributes,
      "http.request.method": { type: "string", value: "PATCH" } } }), config, "/community")).toBeNull();
    const options = getSentryOptions(config, () => "/community");
    expect(options.tracesSampler({ name: span.name,
      attributes: { "url.full": "https://www.sseullae.com/api/posts?private=excluded", "http.request.method": "GET" },
      inheritOrSampleWith: (value) => value })).toBe(0.1);
  });

  it.each(["pageload", "navigation"])("does not revive excluded or conflicting %s destinations from URL attributes", (op) => {
    const cases = [
      { name: "excluded", url: "/community", expected: null },
      { name: "/my", url: "/community", expected: null },
      { name: "/community/search", url: "/community", expected: null },
      { name: "/community", url: "/my", expected: null },
      { name: "/community/search?q=private", url: "/community/search?token=private", expected: "/community/search" },
      { name: "/community/private-review-id", url: "/community/private-review-id?token=private", expected: "/community/[postId]" },
      { name: "/community", url: "/community?token=private", expected: "/community" },
    ];
    const sample = getSentryOptions(config, () => "/community").tracesSampler;
    for (const { name, url, expected } of cases) {
      const attributes = { "sentry.op": op, "url.full": `https://www.sseullae.com${url}` };
      const span = { trace_id: "b".repeat(32), span_id: "c".repeat(16), name,
        start_timestamp: 1, end_timestamp: 2, status: "ok" as const, is_segment: true, attributes };
      expect(sample({ name, attributes, inheritOrSampleWith: (value) => value }), name).toBe(expected ? 0.1 : 0);
      const sanitized = sanitizeStreamedSpan(span, config);
      expect(sanitized.name, name).toBe(expected ?? "excluded");
      expect(JSON.stringify(sanitized)).not.toContain("private");
      const serialized = { ...span, attributes: Object.fromEntries(Object.entries(attributes).map(([key, value]) => [key, { type: "string", value }])) };
      const envelope = [{}, [[{ type: "span" }, { items: [serialized] }]]] as unknown as Envelope;
      const final = sanitizeEnvelope(envelope, config, "/community");
      if (expected) expect(final?.[1][0][1], name).toMatchObject({ items: [{ name: expected }] });
      else expect(final, name).toBeNull();
      expect(JSON.stringify(final)).not.toContain("private");
    }
  });

  it("retains numeric SDK 11 Web Vitals without DOM selectors, image URLs or user agents", () => {
    const span = { trace_id: "b".repeat(32), span_id: "c".repeat(16), name: secret,
      start_timestamp: 1, end_timestamp: 2, status: "ok", is_segment: false,
      attributes: { "sentry.op": { type: "string", value: "ui.webvital.lcp" },
        "sentry.segment.name": { type: "string", value: "/community" },
        "browser.web_vital.lcp.value": { type: "double", value: 1234 },
        "browser.web_vital.lcp.element": { type: "string", value: secret } } };
    const result = sanitizeEnvelope([{}, [[{ type: "span" }, { items: [span] }]]] as unknown as Envelope, config, "/community");
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(result?.[1][0][1]).toMatchObject({ items: [{ name: "webvital.lcp",
      attributes: { "browser.web_vital.lcp.value": { type: "double", value: 1234 } } }] });
  });

  it("samples SDK 11 standalone vital spans only on an allowed segment", () => {
    const sample = getSentryOptions(config, () => "/community").tracesSampler;
    const context = { name: "private-component", attributes: { "sentry.segment.name": "/community", "browser.web_vital.lcp.value": 1000 },
      inheritOrSampleWith: (value: number) => value };
    expect(sample(context)).toBe(0.1);
    expect(sample({ ...context, attributes: { ...context.attributes, "sentry.segment.name": "/my" } })).toBe(0);
  });
});
