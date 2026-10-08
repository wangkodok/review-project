import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import GoogleLoginButton from "./GoogleLoginButton";

describe("GoogleLoginButton", () => {
  it("renders the current Google label with the four-color brand icon", () => {
    const html = renderToStaticMarkup(
      createElement(GoogleLoginButton, {
        disabled: false,
        isLoading: false,
        onClick: vi.fn(),
        variant: "my-guest",
      }),
    );

    expect(html).toContain('aria-label="구글 로그인"');
    expect(html).toContain(">구글 로그인<");
    expect(html).toContain('viewBox="0 0 48 48"');
    expect(html).toContain('fill="#EA4335"');
    expect(html).toContain('fill="#4285F4"');
    expect(html).toContain('fill="#FBBC05"');
    expect(html).toContain('fill="#34A853"');
    expect(html).toContain("h-[52px]");
  });

  it("keeps the label centered while fixing the brand icon to the left", () => {
    const html = renderToStaticMarkup(
      createElement(GoogleLoginButton, {
        disabled: false,
        isLoading: false,
        onClick: vi.fn(),
        variant: "review-write-dialog",
      }),
    );

    expect(html).toContain(
      'class="relative flex w-full items-center justify-center',
    );
    expect(html).toContain('class="absolute left-4 h-6 w-6"');
    expect(html).not.toContain("gap-2");
    expect(html).toContain("h-14");
  });

  it("shows the pending label without changing the default dimensions", () => {
    const html = renderToStaticMarkup(
      createElement(GoogleLoginButton, {
        disabled: true,
        isLoading: true,
        onClick: vi.fn(),
        variant: "default",
      }),
    );

    expect(html).toContain("로그인 중");
    expect(html).not.toContain(">구글 로그인<");
    expect(html).toContain("aspect-[20/3]");
    expect(html).toContain("disabled");
  });
});
