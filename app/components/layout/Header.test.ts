import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const navigationState = vi.hoisted(() => ({ pathname: "/community" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
}));

import Header from "./Header";

describe("Header", () => {
  it("renders the shared review header on the community list", () => {
    navigationState.pathname = "/community";
    const html = renderToStaticMarkup(createElement(Header));

    expect(html).toContain("<header");
    expect(html).toContain("px-4");
    expect(html).toContain("리뷰");
    expect(html).toContain('aria-label="게시글 검색"');
    expect(html).toContain("-mr-4");
  });

  it("hides the shared header on the service terms page", () => {
    navigationState.pathname = "/terms";

    const html = renderToStaticMarkup(createElement(Header));

    expect(html).toBe("");
  });
});
