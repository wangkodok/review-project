import type { BrowserOptions, ErrorEvent } from "@sentry/nextjs";
import { SENTRY_APP_ORIGIN, SERVER_OPERATIONS, type SentryConfig } from "./config";

type TransportFactory = NonNullable<BrowserOptions["transport"]>;
type Transport = ReturnType<TransportFactory>;
type BaseTransportOptions = Parameters<TransportFactory>[0];
export type Envelope = Parameters<Transport["send"]>[0];
type StreamedSpanJSON = Parameters<NonNullable<BrowserOptions["beforeSendSpan"]>>[0];
type TracesSamplerSamplingContext = Parameters<NonNullable<BrowserOptions["tracesSampler"]>>[0];

const TRACE_ID = /^[a-f0-9]{32}$/;
const SPAN_ID = /^[a-f0-9]{16}$/;
const ERROR_TYPES = new Set(["Error", "TypeError", "RangeError", "ReferenceError", "SyntaxError", "URIError", "AggregateError"]);
const SPAN_OPS = new Set(["pageload", "navigation", "http.client", "function", "ui.webvital.lcp", "ui.webvital.inp", "ui.webvital.cls",
  "ui.interaction.click", "ui.interaction.press", "ui.interaction.drag", "ui.interaction.hover"]);
const METRICS = new Set(["lcp", "inp", "cls", "ttfb", "fcp", "fp", "fid"]);

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 1e12;
}

export function normalizeObservedRoute(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 4096) return null;
  try {
    const url = new URL(value, SENTRY_APP_ORIGIN);
    if (url.origin !== SENTRY_APP_ORIGIN || url.username || url.password) return null;
    const path = url.pathname;
    if (["/community", "/community/write", "/community/search", "/api/posts", "/api/search/posts"].includes(path)) return path;
    if (/^\/community\/(?:\[postId\]|[A-Za-z0-9_-]{1,100})$/.test(path)) return "/community/[postId]";
    if (/^\/api\/posts\/(?:\[postId\]|[A-Za-z0-9_-]{1,100})$/.test(path)) return "/api/posts/[postId]";
  } catch { /* Malformed locations are not observable. */ }
  return null;
}

function safeFrames(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(-30).flatMap((item) => {
    const frame = record(item);
    if (typeof frame.filename !== "string") return [];
    const file = frame.filename.replaceAll("\\", "/");
    const match = file.match(/(?:^|\/)(app\/(?:api\/(?:posts|search\/posts)\/route|lib\/observability\/(?:config|privacy|report))\.[cm]?[jt]sx?)$/) ||
      file.match(/(?:^|\/)(_next\/static\/chunks\/[a-f0-9_-]+\.js)$/);
    if (!match) return [];
    return [{ filename: match[1], ...(Number.isSafeInteger(frame.lineno) && finite(frame.lineno) ? { lineno: frame.lineno } : {}),
      ...(Number.isSafeInteger(frame.colno) && finite(frame.colno) ? { colno: frame.colno } : {}) }];
  });
}

export function sanitizeErrorEvent(value: unknown, config: SentryConfig, location: string | null): ErrorEvent | null {
  try {
    const route = normalizeObservedRoute(location);
    if (!route) return null;
    const event = record(value);
    const exception = record(event.exception);
    const values = Array.isArray(exception.values) ? exception.values.slice(0, 3) : [{}];
    const operation = record(event.tags).operation;
    const trace = record(record(event.contexts).trace);
    return {
      type: undefined,
      ...(typeof event.event_id === "string" && TRACE_ID.test(event.event_id) ? { event_id: event.event_id } : {}),
      ...(finite(event.timestamp) ? { timestamp: event.timestamp } : {}),
      platform: event.platform === "node" ? "node" : "javascript", level: "error",
      sdk: { name: "sentry.javascript.nextjs", version: "11.14.0", settings: { infer_ip: "never" } },
      environment: config.environment, ...(config.release ? { release: config.release } : {}),
      tags: { route, ...(typeof operation === "string" && Object.hasOwn(SERVER_OPERATIONS, operation) ? { operation } : {}) },
      ...(typeof trace.trace_id === "string" && TRACE_ID.test(trace.trace_id) && typeof trace.span_id === "string" && SPAN_ID.test(trace.span_id)
        ? { contexts: { trace: { trace_id: trace.trace_id, span_id: trace.span_id } } } : {}),
      exception: { values: values.map((item) => {
        const error = record(item);
        const frames = safeFrames(record(error.stacktrace).frames);
        return { type: typeof error.type === "string" && ERROR_TYPES.has(error.type) ? error.type : "Error",
          value: "Unexpected application error", ...(frames.length ? { stacktrace: { frames } } : {}) };
      }) },
    };
  } catch {
    return null;
  }
}

function spanName(value: unknown, method: unknown): string | null {
  if (typeof value !== "string") return null;
  if (Object.hasOwn(SERVER_OPERATIONS, value)) return value;
  const match = value.match(/^(GET|POST) (.+)$/);
  const route = normalizeObservedRoute(match ? match[2] : value);
  if (!route) return null;
  const verb = match?.[1] ?? method;
  if (match && method !== undefined && method !== verb) return null;
  if (route.startsWith("/api/")) {
    if (verb !== "GET" && !(verb === "POST" && route === "/api/posts")) return null;
    return `${verb} ${route}`;
  }
  return route;
}

function observedSpanName(name: unknown, method: unknown, url: unknown, op: unknown): string | null {
  if (op === "pageload" || op === "navigation") {
    const route = normalizeObservedRoute(name);
    return route && (url === undefined || normalizeObservedRoute(url) === route) ? route : null;
  }
  return spanName(url === undefined ? name : url, method);
}

function sanitizeSpan(value: unknown, config: SentryConfig, serialized: boolean) {
  const span = record(value);
  const attributes = record(span.attributes);
  const read = (key: string) => serialized ? record(attributes[key]).value : attributes[key];
  const webVital = Object.keys(attributes).find((key) => /^browser\.web_vital\.(lcp|inp|cls)\.value$/.test(key));
  const segment = normalizeObservedRoute(read("sentry.segment.name") ?? read("sentry.transaction"));
  const requestName = observedSpanName(span.name, read("http.request.method"), read("url.full"), read("sentry.op"));
  const name = webVital && segment ? `webvital.${webVital.split(".")[2]}` : requestName;
  if (!name || typeof span.trace_id !== "string" || !TRACE_ID.test(span.trace_id) ||
    typeof span.span_id !== "string" || !SPAN_ID.test(span.span_id) || !finite(span.start_timestamp) ||
    !finite(span.end_timestamp) || span.end_timestamp < span.start_timestamp || span.end_timestamp - span.start_timestamp > 3600) return null;
  const safe: Record<string, unknown> = { "sentry.environment": config.environment };
  if (config.release) safe["sentry.release"] = config.release;
  if (segment) safe["sentry.segment.name"] = segment;
  const op = read("sentry.op");
  if (typeof op === "string" && SPAN_OPS.has(op)) safe["sentry.op"] = op;
  const method = read("http.request.method");
  if (method === "GET" || method === "POST") safe["http.request.method"] = method;
  const status = read("http.response.status_code");
  if (typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599) safe["http.response.status_code"] = status;
  for (const key of Object.keys(attributes)) {
    const metric = key.match(/^(?:sentry\.)?measurements?\.([a-z]+)(?:\.value)?$/)?.[1] ??
      key.match(/^browser\.web_vital\.([a-z]+)\.value$/)?.[1];
    const metricValue = read(key);
    if (metric && METRICS.has(metric) && finite(metricValue)) safe[key] = metricValue;
  }
  const finalAttributes = serialized ? Object.fromEntries(Object.entries(safe).map(([key, value]) =>
    [key, { type: typeof value === "string" ? "string" : "double", value }])) : safe;
  return { name, trace_id: span.trace_id, span_id: span.span_id,
    ...(typeof span.parent_span_id === "string" && SPAN_ID.test(span.parent_span_id) ? { parent_span_id: span.parent_span_id } : {}),
    start_timestamp: span.start_timestamp, end_timestamp: span.end_timestamp,
    status: span.status === "ok" ? "ok" as const : "error" as const,
    is_segment: span.is_segment === true, attributes: finalAttributes };
}

export function sanitizeStreamedSpan(span: StreamedSpanJSON, config: SentryConfig): StreamedSpanJSON {
  // This hook cannot drop spans. The final transport boundary rejects excluded spans.
  return (sanitizeSpan(span, config, false) ?? { ...span, name: "excluded", attributes: {}, links: [] }) as StreamedSpanJSON;
}

export function sanitizeEnvelope(envelope: Envelope, config: SentryConfig, location: string | null): Envelope | null {
  try {
    if (location !== null && !normalizeObservedRoute(location)) return null;
    const items: Array<[{ type: "event" | "span"; item_count?: number; content_type?: string }, unknown]> = [];
    for (const [header, payload] of envelope[1]) {
      if (header.type === "event") {
        const event = sanitizeErrorEvent(payload, config, location ?? (record(record(payload).tags).route as string | null));
        if (event) items.push([{ type: "event" }, event]);
      } else if (header.type === "span") {
        const container = record(payload);
        const spans = Array.isArray(container.items) ? container.items.slice(0, 100).flatMap((value) => {
          const span = sanitizeSpan(value, config, true);
          return span ? [span] : [];
        }) : [];
        if (spans.length) items.push([{ type: "span", item_count: spans.length, content_type: "application/vnd.sentry.items.span.v2+json" },
          { items: spans, ingest_settings: { infer_ip: "never", infer_user_agent: "never" } }]);
      }
    }
    if (!items.length) return null;
    const header = envelope[0];
    const trace = record(header.trace);
    return [{
      ...(typeof header.event_id === "string" && TRACE_ID.test(header.event_id) ? { event_id: header.event_id } : {}),
      sdk: { name: "sentry.javascript.nextjs", version: "11.14.0" },
      ...(typeof trace.trace_id === "string" && TRACE_ID.test(trace.trace_id) ? { trace: {
        trace_id: trace.trace_id, public_key: new URL(config.dsn).username, environment: config.environment,
        ...(config.release ? { release: config.release } : {}),
      } } : {}),
    }, items] as unknown as Envelope;
  } catch {
    return null;
  }
}

export function createPrivacyTransport(config: SentryConfig, base: (options: BaseTransportOptions) => Transport,
  location: () => string | null) {
  return (options: BaseTransportOptions): Transport => {
    const url = new URL(options.url);
    const allowed = url.origin === config.ingestOrigin && url.pathname === `/api/${new URL(config.dsn).pathname.slice(1)}/envelope/`;
    const transport = allowed ? base({ ...options, headers: {} }) : null;
    return {
      send(envelope) {
        try {
          const safe = sanitizeEnvelope(envelope, config, location());
          return safe && transport ? Promise.resolve(transport.send(safe)).catch(() => ({ statusCode: 0 })) : Promise.resolve({ statusCode: 200 });
        } catch { return Promise.resolve({ statusCode: 0 }); }
      },
      flush(timeout) {
        try { return transport ? Promise.resolve(transport.flush(timeout)).catch(() => false) : Promise.resolve(true); }
        catch { return Promise.resolve(false); }
      },
    };
  };
}

export function getSentryOptions(config: SentryConfig, location: () => string | null) {
  return {
    dsn: config.dsn, environment: config.environment, release: config.release,
    defaultIntegrations: false as const, spotlight: false as const, debug: false, sendClientReports: false, maxBreadcrumbs: 0,
    traceLifecycle: "stream" as const, sampleRate: 1, tracePropagationTargets: [] as RegExp[],
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false,
      databaseQueryData: false, queues: false, graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false }, mcp: { inputs: false, outputs: false }, stackFrameVariables: false, frameContextLines: 0 },
    beforeBreadcrumb: () => null, beforeSendLog: () => null, beforeSendMetric: () => null,
    beforeSend: (event: ErrorEvent) => sanitizeErrorEvent(event, config, location() ?? (record(event.tags).route as string | null)),
    beforeSendSpan: (span: StreamedSpanJSON) => sanitizeStreamedSpan(span, config),
    tracesSampler: (context: TracesSamplerSamplingContext) => {
      const segment = normalizeObservedRoute(context.attributes["sentry.segment.name"] ?? context.attributes["sentry.transaction"]);
      const vital = segment && Object.keys(context.attributes).some((key) =>
        /^browser\.web_vital\.(lcp|inp|cls)\.value$/.test(key) && finite(context.attributes[key]));
      const method = context.attributes["http.request.method"];
      const name = observedSpanName(context.name, method, context.attributes["url.full"], context.attributes["sentry.op"]);
      return vital || name ? context.inheritOrSampleWith(0.1) : 0;
    },
  };
}
