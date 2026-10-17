import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
const observation = vi.hoisted(() => ({ effects: [] as (() => void | (() => void))[], configure: vi.fn(), start: vi.fn(), updateLocation: vi.fn(), track: vi.fn() }));
vi.mock("react", async (actual) => ({ ...await actual<typeof import("react")>(), useEffect: (effect: () => void | (() => void)) => { observation.effects.push(effect); } }));
vi.mock("@/app/lib/analytics/runtime", () => ({ analytics: observation }));
vi.mock("next/navigation", () => ({ usePathname: () => "/community" }));
import AnalyticsObserver from "./AnalyticsObserver";
afterEach(() => { vi.unstubAllGlobals(); observation.effects = []; vi.clearAllMocks(); });
it("renders_no_ui_or_tracking_during_ssr", () => {
  expect(renderToStaticMarkup(createElement(AnalyticsObserver, {}))).toBe("");
  expect(observation.configure).not.toHaveBeenCalled();
});
it("cleans_up_click_and_return_listeners_during_strict_effect_remount", () => {
  const win = Object.assign(new EventTarget(), { location: { origin: "https://www.sseullae.com", href: "https://www.sseullae.com/community" } });
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  vi.stubGlobal("window", win); vi.stubGlobal("document", doc);
  renderToStaticMarkup(createElement(AnalyticsObserver, {}));
  const cleanup = observation.effects[0](); if (cleanup) cleanup();
  const cleanupAgain = observation.effects[0]();
  const control = { getAttribute: (key: string) => key === "data-analytics-action" ? "review_write" : null, hasAttribute: () => false, closest: () => null };
  const click = () => { const event = new Event("click"); Object.defineProperty(event, "target", { value: { closest: () => control } }); return event; };
  doc.dispatchEvent(click()); expect(observation.track).toHaveBeenCalledTimes(1);
  if (cleanupAgain) cleanupAgain();
  observation.updateLocation.mockClear();
  win.dispatchEvent(new Event("pageshow")); doc.dispatchEvent(new Event("visibilitychange")); doc.dispatchEvent(click());
  expect(observation.updateLocation).not.toHaveBeenCalled(); expect(observation.track).toHaveBeenCalledTimes(1);
});
