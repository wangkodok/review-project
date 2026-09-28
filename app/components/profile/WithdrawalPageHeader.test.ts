import { describe, expect, it, vi } from "vitest";
import { replaceWithdrawalLocation } from "./WithdrawalPageHeader";

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
});
