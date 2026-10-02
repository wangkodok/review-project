import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import WithdrawButton from "./WithdrawButton";

const ConfigurableWithdrawButton = WithdrawButton as ComponentType<{
  href?: string;
}>;

describe("WithdrawButton", () => {
  it("keeps My withdrawal as the default destination", () => {
    const html = renderToStaticMarkup(createElement(WithdrawButton));

    expect(html).toContain('href="/my/withdraw"');
  });

  it("preserves the community source when opened from the review menu", () => {
    const html = renderToStaticMarkup(
      createElement(ConfigurableWithdrawButton, {
        href: "/my/withdraw?from=community",
      }),
    );

    expect(html).toContain('href="/my/withdraw?from=community"');
  });
});
