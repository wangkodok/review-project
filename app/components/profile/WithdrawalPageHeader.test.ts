import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

import { replaceWithdrawalLocation } from "./WithdrawalPageHeader";
import WithdrawalPageHeader from "./WithdrawalPageHeader";

describe("replaceWithdrawalLocation", () => {
  it("returns to My without calling a cancellation API or session update", () => {
    const replaceLocation = vi.fn();

    replaceWithdrawalLocation({
      href: "/my",
      replaceLocation,
    });

    expect(replaceLocation).toHaveBeenCalledWith("/my");
  });

  it("returns to Home from the completion screen", () => {
    const replaceLocation = vi.fn();

    replaceWithdrawalLocation({
      href: "/",
      replaceLocation,
    });

    expect(replaceLocation).toHaveBeenCalledWith("/");
  });

  it("returns to the review list when withdrawal starts in the community menu", () => {
    const replaceLocation = vi.fn();

    replaceWithdrawalLocation({
      href: "/community",
      replaceLocation,
    });

    expect(replaceLocation).toHaveBeenCalledWith("/community");
  });
});

describe("WithdrawalPageHeader", () => {
  it("uses the shared back-header visual contract", () => {
    const html = renderToStaticMarkup(
      createElement(WithdrawalPageHeader, {
        backHref: "/my",
        title: "회원 탈퇴",
      }),
    );

    expect(html).toContain("lucide-arrow-left");
    expect(html).not.toContain("lucide-chevron-left");
    expect(html).toContain('stroke-width="1.25"');
    expect(html).toContain(
      'class="truncate text-center text-[18px] font-medium leading-7 text-[#121212]"',
    );
  });
});
