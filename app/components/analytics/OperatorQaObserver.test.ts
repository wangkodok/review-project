import { isValidElement, type ReactElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ effects: [] as (() => void | (() => void))[], index: 0,
  confirmed: true, load: vi.fn(), status: vi.fn() }));
vi.mock("react", async (actual) => ({ ...await actual<typeof import("react")>(),
  useEffect: (effect: () => void | (() => void)) => { state.effects.push(effect); },
  useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => {
    const index = state.index++;
    return [index === 1 ? "phc_synthetic_qa" : index === 2 ? state.confirmed : value, index === 0 ? state.status : vi.fn()];
  },
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/community" }));
vi.mock("@/app/lib/analytics/operatorQaDriver", () => ({ loadOperatorQaDriver: state.load }));

function findForm(node: unknown): ReactElement<{ onSubmit(event: { preventDefault(): void }): Promise<void> }> | undefined {
  if (Array.isArray(node)) return node.map(findForm).find(Boolean);
  if (!isValidElement<{ children?: unknown }>(node)) return;
  if (node.type === "form") return node as ReturnType<typeof findForm>;
  return findForm(node.props.children);
}

beforeEach(() => {
  vi.resetModules(); vi.stubEnv("NODE_ENV", "development");
  state.effects = []; state.index = 0; state.confirmed = true; state.load.mockReset(); state.status.mockReset();
  vi.stubGlobal("window", Object.assign(new EventTarget(), { location: { origin: "http://localhost:3001", pathname: "/community" } }));
  vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
  vi.stubGlobal("navigator", { doNotTrack: null });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("does_not_load_the_SDK_before_start_or_without_manual_participation", async () => {
  state.confirmed = false;
  const { default: Observer } = await import("./OperatorQaObserver");
  const form = findForm(Observer())!;
  const cleanup = state.effects[0]();
  expect(state.load).not.toHaveBeenCalled();
  await form.props.onSubmit({ preventDefault() {} });
  expect(state.load).not.toHaveBeenCalled();
  if (cleanup) cleanup();
});

it("keeps_StrictMode_pre_start_cleanup_safe_and_stops_a_pending_import_on_unmount", async () => {
  let resolve!: (driver: { capture: ReturnType<typeof vi.fn>; resetIdentity: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }) => void;
  const driver = { capture: vi.fn(), resetIdentity: vi.fn(), stop: vi.fn() };
  state.load.mockImplementation(() => new Promise((r) => { resolve = r; }));
  const { default: Observer } = await import("./OperatorQaObserver");
  const form = findForm(Observer())!;
  const firstCleanup = state.effects[0](); if (firstCleanup) firstCleanup();
  const cleanup = state.effects[0]();
  const pending = form.props.onSubmit({ preventDefault() {} });
  await form.props.onSubmit({ preventDefault() {} });
  expect(state.load).toHaveBeenCalledTimes(1);
  expect(state.load.mock.calls[0][0]).toMatchObject({ environment: "test" });
  if (cleanup) cleanup();
  expect(state.status).toHaveBeenLastCalledWith("stopped");
  expect(state.load.mock.calls[0][1]()).toBe(false);
  resolve(driver); await pending;
  expect(driver.capture).not.toHaveBeenCalled();
  expect(driver.stop).toHaveBeenCalledTimes(1);
});
