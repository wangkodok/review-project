import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { loadOperatorQaDriver } from "./operatorQaDriver";

const sdk = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn(), reset: vi.fn(), shutdown: vi.fn() }));
vi.mock("posthog-js", () => ({ PostHog: class { constructor() { return sdk; } } }));
const config = { analytics: true, replay: false, environment: "test", projectToken: "phc_synthetic_qa", apiHost: "https://us.i.posthog.com" } as const;
beforeEach(() => {
  vi.clearAllMocks(); sdk.shutdown.mockResolvedValue(undefined);
  vi.stubEnv("NODE_ENV", "development");
  vi.stubGlobal("window", { location: { origin: "http://localhost:3001" } });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("refuses_Production_and_non_loopback_execution_before_SDK_init", async () => {
  vi.stubEnv("NODE_ENV", "production");
  await expect(loadOperatorQaDriver(config, () => true, vi.fn(), vi.fn())).rejects.toThrow("operator_qa_disabled");
  vi.stubEnv("NODE_ENV", "development");
  vi.stubGlobal("window", { location: { origin: "https://www.sseullae.com" } });
  await expect(loadOperatorQaDriver(config, () => true, vi.fn(), vi.fn())).rejects.toThrow("operator_qa_disabled");
  expect(sdk.init).not.toHaveBeenCalled();
});

it("does_not_initialize_if_stopped_while_the_import_is_pending", async () => {
  let active = true;
  const pending = loadOperatorQaDriver(config, () => active, vi.fn(), vi.fn());
  active = false;
  await expect(pending).rejects.toThrow("operator_qa_disabled");
  expect(sdk.init).not.toHaveBeenCalled();
});

it.each([{ doNotTrack: "1" }, { globalPrivacyControl: true }])("blocks_QA_privacy_signals_%j_before_init", async (navigator) => {
  vi.stubGlobal("navigator", navigator);
  await expect(loadOperatorQaDriver(config, () => true, vi.fn(), vi.fn())).rejects.toThrow("operator_qa_disabled");
  expect(sdk.init).not.toHaveBeenCalled();
});

it("sanitizes_capture_and_stops_new_events_without_account_identifiers", async () => {
  const driver = await loadOperatorQaDriver(config, () => true, vi.fn(), vi.fn());
  driver.capture({ event: "review_write_opened", properties: { screen: "/community/private?email=private", email: "private" } });
  expect(sdk.capture).toHaveBeenCalledExactlyOnceWith("review_write_opened", { screen: "/community/[postId]", environment: "test" });
  driver.resetIdentity(); expect(sdk.reset).toHaveBeenCalledExactlyOnceWith(true);
  driver.stop(); driver.stop();
  driver.capture({ event: "$pageview", properties: { screen: "/community" } });
  expect(sdk.capture).toHaveBeenCalledTimes(1);
  expect(sdk.shutdown).toHaveBeenCalledTimes(1);
});
