import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import WithdrawalCompleteView from "@/app/components/profile/WithdrawalCompleteView";
import WithdrawalCompletePage from "./page";

describe("WithdrawalCompletePage", () => {
  it("shows the standard completion view without provider unlink state", () => {
    const result = WithdrawalCompletePage() as ReactElement<Record<string, never>>;

    expect(result.type).toBe(WithdrawalCompleteView);
    expect(result.props).toEqual({});
  });
});
