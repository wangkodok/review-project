import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => ({
  getProviders: vi.fn(),
  signIn: vi.fn(),
}));

import LoginOptions from "./LoginOptions";

describe("LoginOptions", () => {
  it("links both public policies before login", () => {
    const html = renderToStaticMarkup(createElement(LoginOptions));

    expect(html).toContain('href="/terms"');
    expect(html).toContain("서비스 이용약관");
    expect(html).toContain('href="/privacy"');
    expect(html).toContain("개인정보처리방침");
  });
});
