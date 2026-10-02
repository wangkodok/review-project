import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn() }),
}));

import PageBackHeader from "./PageBackHeader";

describe("PageBackHeader", () => {
  it("renders the shared 56px back action and centered title style", () => {
    const html = renderToStaticMarkup(
      createElement(PageBackHeader, { title: "리뷰 작성" }),
    );

    expect(html).toContain(
      "grid h-14 grid-cols-[56px_minmax(0,1fr)_56px]",
    );
    expect(html).toContain("-mx-4 -mt-5");
    expect(html).toContain('class="flex h-14 w-14 items-center justify-center');
    expect(html).toContain('stroke-width="1.25"');
    expect(html).toContain(
      'class="truncate text-center text-[18px] font-medium leading-7 text-[#121212]"',
    );
    expect(html).toContain("리뷰 작성");
  });

  it("supports a flush parent without changing the shared visual contract", () => {
    const html = renderToStaticMarkup(
      createElement(PageBackHeader, {
        backDisabled: true,
        flush: true,
        title: "회원 탈퇴",
      }),
    );

    expect(html).not.toContain("-mx-4 -mt-5");
    expect(html).toContain("disabled");
    expect(html).toContain('stroke-width="1.25"');
  });
});
