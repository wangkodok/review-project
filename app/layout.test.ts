import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./components/layout/Header", () => ({
  default: () => createElement("header", null, "header"),
}));

vi.mock("./components/layout/BottomTab", () => ({
  default: () => createElement("nav", null, "bottom tab"),
}));

vi.mock("./components/providers/QueryProvider", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

import RootLayout from "./layout";

describe("RootLayout", () => {
  it("uses the shared 16px horizontal content inset", () => {
    const html = renderToStaticMarkup(
      createElement(RootLayout, null, createElement("p", null, "content")),
    );

    expect(html).toContain(
      '<main class="flex flex-1 flex-col px-4 pb-24 pt-5">',
    );
  });
});
