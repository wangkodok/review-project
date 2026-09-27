import { describe, expect, it, vi } from "vitest";
import { returnToMyAfterWithdrawalCancel } from "./WithdrawalPageHeader";

describe("returnToMyAfterWithdrawalCancel", () => {
  it("returns to My without updating the session when no reauthentication flow exists", async () => {
    const clearWithdrawalReauth = vi.fn();
    const replaceLocation = vi.fn();

    await returnToMyAfterWithdrawalCancel({
      status: "idle",
      clearWithdrawalReauth,
      replaceLocation,
    });

    expect(clearWithdrawalReauth).not.toHaveBeenCalled();
    expect(replaceLocation).toHaveBeenCalledWith("/my");
  });

  it("clears reauthentication state before returning when a flow was cancelled", async () => {
    const calls: string[] = [];
    const clearWithdrawalReauth = vi.fn(async () => {
      calls.push("clear");
    });
    const replaceLocation = vi.fn(() => {
      calls.push("replace");
    });

    await returnToMyAfterWithdrawalCancel({
      status: "cancelled",
      clearWithdrawalReauth,
      replaceLocation,
    });

    expect(calls).toEqual(["clear", "replace"]);
  });
});
