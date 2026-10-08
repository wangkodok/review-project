import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import KakaoLoginButton from "./KakaoLoginButton";

describe("KakaoLoginButton", () => {
  it("renders the current Kakao label and brand icon", () => {
    const html = renderToStaticMarkup(
      createElement(KakaoLoginButton, {
        disabled: false,
        isLoading: false,
        onClick: vi.fn(),
        variant: "my-guest",
      }),
    );

    expect(html).toContain('aria-label="카카오 로그인"');
    expect(html).toContain(">카카오 로그인<");
    expect(html).toContain('class="absolute left-4 h-6 w-6"');
    expect(html).toContain('width="24"');
    expect(html).toContain('height="24"');
    expect(html).toContain('viewBox="13 14 22 21"');
    expect(html).toContain('preserveAspectRatio="none"');
    expect(html).toContain(
      "M24.0014 14C17.9241 14 13 18.0219 13 22.9825",
    );
    expect(html).toContain("h-[52px]");
  });

  it("keeps the label centered while fixing the brand icon to the left", () => {
    const html = renderToStaticMarkup(
      createElement(KakaoLoginButton, {
        disabled: false,
        isLoading: false,
        onClick: vi.fn(),
        variant: "my-guest",
      }),
    );

    expect(html).toContain(
      'class="relative flex w-full items-center justify-center',
    );
    expect(html).toContain('class="absolute left-4');
    expect(html).not.toContain("gap-2");
  });

  it("shows the pending label without changing the dialog dimensions", () => {
    const html = renderToStaticMarkup(
      createElement(KakaoLoginButton, {
        disabled: true,
        isLoading: true,
        onClick: vi.fn(),
        variant: "review-write-dialog",
      }),
    );

    expect(html).toContain("로그인 중");
    expect(html).not.toContain(">Kakao<");
    expect(html).toContain("h-14");
    expect(html).toContain("disabled");
  });
});
