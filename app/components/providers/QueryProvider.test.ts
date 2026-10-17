import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ set: vi.fn(), reset: vi.fn(), callback: undefined as undefined | (() => void) }));
vi.mock("react", async (actual) => ({ ...await actual<typeof import("react")>(), useState: (initial: unknown) => [typeof initial === "function" ? initial() : initial, state.set] }));
vi.mock("@/app/lib/analytics/runtime", () => ({ analytics: { resetIdentity: state.reset } }));
vi.mock("../auth/AuthSessionLifecycle", () => ({ default: ({ onIdentityChange }: { onIdentityChange: () => void }) => { state.callback = onIdentityChange; return null; } }));
import QueryProvider from "./QueryProvider";
it("preserves_auth_view_reset_when_analytics_throws", () => {
  renderToStaticMarkup(createElement(QueryProvider, null, "content"));
  state.reset.mockImplementation(() => { throw new Error("analytics"); });
  expect(() => state.callback?.()).not.toThrow();
  expect(state.reset).toHaveBeenCalledTimes(1); expect(state.set).toHaveBeenCalledTimes(1);
});
