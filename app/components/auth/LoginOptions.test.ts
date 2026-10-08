import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => ({
  getProviders: vi.fn(),
  signIn: vi.fn(),
}));

import LoginOptions, * as loginOptionsModule from "./LoginOptions";

type RegisterLoginPageShowReset = (
  target: EventTarget,
  reset: () => void,
) => () => void;

describe("LoginOptions", () => {
  it("links both public policies before login", () => {
    const html = renderToStaticMarkup(createElement(LoginOptions));

    expect(html).toContain('href="/terms"');
    expect(html).toContain("서비스 이용약관");
    expect(html).toContain('href="/privacy"');
    expect(html).toContain("개인정보처리방침");
  });

  it("clears pending login state when the browser shows the page again", () => {
    const registerLoginPageShowReset = (
      loginOptionsModule as typeof loginOptionsModule & {
        registerLoginPageShowReset?: RegisterLoginPageShowReset;
      }
    ).registerLoginPageShowReset;
    const target = new EventTarget();
    let activeProvider: "kakao" | null = "kakao";
    const cleanup = registerLoginPageShowReset?.(target, () => {
      activeProvider = null;
    });

    target.dispatchEvent(new Event("pageshow"));

    expect(activeProvider).toBeNull();

    cleanup?.();
    activeProvider = "kakao";
    target.dispatchEvent(new Event("pageshow"));

    expect(activeProvider).toBe("kakao");
  });
});
