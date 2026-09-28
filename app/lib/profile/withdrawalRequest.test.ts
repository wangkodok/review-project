import { describe, expect, it } from "vitest";
import { parseWithdrawalRequest } from "./withdrawalRequest";

describe("parseWithdrawalRequest", () => {
  it("accepts only explicit withdrawal consent", () => {
    expect(parseWithdrawalRequest({ consent: true })).toEqual({
      ok: true,
      value: { consent: true },
    });
  });

  it.each([
    ["missing consent", {}],
    ["declined consent", { consent: false }],
  ])("requires consent when it is %s", (_name, value) => {
    expect(parseWithdrawalRequest(value)).toEqual({
      ok: false,
      code: "WITHDRAWAL_CONSENT_REQUIRED",
    });
  });

  it.each([
    ["null", null],
    ["an array", []],
    ["a string", "true"],
    ["a numeric consent", { consent: 1 }],
    ["a string consent", { consent: "true" }],
    ["a user id", { consent: true, userId: "attacker-selected-user" }],
    ["a provider", { consent: true, provider: "google" }],
  ])("rejects malformed input containing %s", (_name, value) => {
    expect(parseWithdrawalRequest(value)).toEqual({
      ok: false,
      code: "INVALID_REQUEST",
    });
  });
});
