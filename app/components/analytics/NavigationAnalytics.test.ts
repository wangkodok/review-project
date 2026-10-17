import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const observation = vi.hoisted(() => ({ navigate: undefined as undefined | (() => void), track: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/community" }));
vi.mock("@/app/lib/analytics/runtime", () => ({ analytics: { track: observation.track } }));
vi.mock("next/link", () => ({ default: ({ onNavigate, children, ...props }: { onNavigate?: () => void; children?: ReactNode }) => {
  observation.navigate = onNavigate;
  return createElement("a", props, children);
} }));
import Header from "../layout/Header";
import { registerAnalyticsInteractions } from "@/app/lib/analytics/interactions";
it("connects_the_review_search_Link_to_the_accepted_navigation_hook_once", () => {
  vi.stubGlobal("window", { location: { href: "https://www.sseullae.com/community" } });
  const document = new EventTarget();
  const remove = registerAnalyticsInteractions(document, () => "/community", observation.track);
  try {
    const html = renderToStaticMarkup(createElement(Header));
    expect(html).toContain('href="/community/search"');
    expect(observation.navigate).toBeTypeOf("function");
    observation.navigate?.();
    // Next Link prevents the native event; the bubble observer must not duplicate the hook.
    const nativeClick = new Event("click", { cancelable: true }); nativeClick.preventDefault();
    document.dispatchEvent(nativeClick);
    expect(observation.track).toHaveBeenCalledExactlyOnceWith({ event: "ui_action", properties: { screen: "/community", action: "search_open" } });
  } finally { remove(); vi.unstubAllGlobals(); }
});
