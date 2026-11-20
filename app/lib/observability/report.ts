import { getServerSentryConfig, SERVER_OPERATIONS, type ServerOperation } from "./config";

let sdkImport: Promise<typeof import("@sentry/nextjs")> | undefined;

async function serverSdk() {
  if (!getServerSentryConfig()) return null;
  try {
    const sdk = await (sdkImport ??= import("@sentry/nextjs"));
    return sdk.getClient() ? sdk : null;
  } catch {
    return null;
  }
}

export async function reportServerError(operation: ServerOperation): Promise<void> {
  try {
    const sdk = await serverSdk();
    if (!sdk || !Object.hasOwn(SERVER_OPERATIONS, operation)) return;
    sdk.withIsolationScope((scope) => {
      scope.setTags({ operation, route: SERVER_OPERATIONS[operation].route });
      // Do not pass a database/provider exception, request, or user input to the SDK.
      sdk.captureException(new Error(`${operation} failed`));
    });
  } catch { /* Diagnostics must not change the application's error response. */ }
}

export async function observeServerOperation<T>(operation: ServerOperation, run: () => Promise<T>): Promise<T> {
  const sdk = await serverSdk();
  if (!sdk || !Object.hasOwn(SERVER_OPERATIONS, operation)) return run();
  let result: Promise<T> | undefined;
  // Memoize the business call: a failed SDK wrapper must never repeat a write.
  const invoke = () => result ??= Promise.resolve().then(run);
  try {
    return await sdk.withIsolationScope(() => sdk.startSpan({ name: operation, op: "function",
      attributes: { "sentry.segment.name": SERVER_OPERATIONS[operation].route } }, invoke));
  } catch {
    return result ?? run();
  }
}
