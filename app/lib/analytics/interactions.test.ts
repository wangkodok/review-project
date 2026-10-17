import { describe, expect, it, vi } from "vitest";
import * as interactions from "./interactions";
const { registerAnalyticsInteractions, resolveAnalyticsAction } = interactions;
const tracking = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("./runtime", () => ({ analytics: tracking }));
import { ANALYTICS_ACTIONS } from "./events";
describe("analytics clicks", () => {
  it("records_accepted_Next_Link_navigation_without_counting_its_prevented_click", () => {
    vi.stubGlobal("window", { location: { href: "https://www.sseullae.com/community?private=query" } });
    const navigation = (interactions as typeof interactions & { recordAnalyticsNavigation?: (action: "post_open") => void }).recordAnalyticsNavigation;
    try {
      expect(navigation).toBeTypeOf("function");
      navigation?.("post_open");
      expect(tracking.track).toHaveBeenCalledWith({ event: "ui_action", properties: { screen: "/community", action: "post_open" } });
    } finally { vi.unstubAllGlobals(); }
  });
  it("accepts_only_static_enabled_uncancelled_actions", () => {
    for (const action of ANALYTICS_ACTIONS) expect(resolveAnalyticsAction(action, false, false)).toBe(action);
    expect(resolveAnalyticsAction("raw text", false, false)).toBeNull();
    expect(resolveAnalyticsAction("like_click", true, false)).toBeNull();
    expect(resolveAnalyticsAction("like_click", false, true)).toBeNull();
  });
  it("normalizes_the_current_document_path_for_accepted_local_QA_navigation", () => {
    tracking.track.mockClear();
    vi.stubGlobal("window", { location: { href: "http://localhost:3001/community?private=query" } });
    try {
      interactions.recordAnalyticsNavigation("review_write");
      expect(tracking.track).toHaveBeenCalledExactlyOnceWith({ event: "ui_action", properties: { screen: "/community", action: "review_write" } });
    } finally { vi.unstubAllGlobals(); }
  });
  it("observes_bubble_click_once_and_removes_the_listener", () => {
    const target = new EventTarget(); const capture = vi.fn();
    const button = { getAttribute: (name: string) => name === "data-analytics-action" ? "like_click" : null, hasAttribute: () => false, closest: () => null };
    const stop = registerAnalyticsInteractions(target, () => "/community/synthetic", capture);
    const click = () => { const event = new Event("click", { cancelable: true }); Object.defineProperty(event, "target", { value: { closest: () => button } }); return event; };
    target.dispatchEvent(click()); expect(capture).toHaveBeenCalledTimes(1);
    const cancelled = click(); cancelled.preventDefault(); target.dispatchEvent(cancelled);
    target.dispatchEvent(new Event("pointerdown")); expect(capture).toHaveBeenCalledTimes(1);
    stop(); target.dispatchEvent(click()); expect(capture).toHaveBeenCalledTimes(1);
  });
});
