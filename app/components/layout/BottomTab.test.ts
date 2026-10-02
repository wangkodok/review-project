import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const navigationState = vi.hoisted(() => ({ pathname: "/community" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
}));

import BottomTab from "./BottomTab";

describe("BottomTab", () => {
  it("renders the two-tab navigation on the community list while home stays deferred", () => {
    navigationState.pathname = "/community";
    const html = renderToStaticMarkup(createElement(BottomTab));

    expect(html).toContain("<nav");
    expect(html).toContain("커뮤니티");
    expect(html).toContain("내 정보");
    expect(html).not.toContain(">홈<");
  });

  it("hides the bottom navigation on the service terms page", () => {
    navigationState.pathname = "/terms";

    const html = renderToStaticMarkup(createElement(BottomTab));

    expect(html).toBe("");
  });
});
