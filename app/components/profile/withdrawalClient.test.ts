import { describe, expect, it, vi } from "vitest";
import {
  createWithdrawalSubmissionLock,
  submitWithdrawal,
  type WithdrawalRequestResult,
} from "./withdrawalClient";

function failedRequest(
  status: number,
  code: string,
): WithdrawalRequestResult {
  return {
    ok: false,
    status,
    code,
  };
}

describe("submitWithdrawal", () => {
  it("blocks submission until the user consents", async () => {
    const requestWithdrawal = vi.fn();
    const navigateToComplete = vi.fn();

    const result = await submitWithdrawal({
      consent: false,
      provider: "kakao",
      lock: createWithdrawalSubmissionLock(),
      requestWithdrawal,
      navigateToComplete,
    });

    expect(result).toEqual({
      status: "blocked",
      message: "회원 탈퇴 동의가 필요합니다.",
      preserveConsent: true,
    });
    expect(requestWithdrawal).not.toHaveBeenCalled();
    expect(navigateToComplete).not.toHaveBeenCalled();
  });

  it("sends only one delete request while a submission is in progress", async () => {
    let resolveRequest: ((value: WithdrawalRequestResult) => void) | undefined;
    const requestWithdrawal = vi.fn(
      () =>
        new Promise<WithdrawalRequestResult>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const navigateToComplete = vi.fn();
    const lock = createWithdrawalSubmissionLock();

    const firstSubmission = submitWithdrawal({
      consent: true,
      provider: "kakao",
      lock,
      requestWithdrawal,
      navigateToComplete,
    });
    const repeatedSubmission = await submitWithdrawal({
      consent: true,
      provider: "kakao",
      lock,
      requestWithdrawal,
      navigateToComplete,
    });

    expect(repeatedSubmission.status).toBe("blocked");
    expect(requestWithdrawal).toHaveBeenCalledTimes(1);

    resolveRequest?.({ ok: true, status: 200 });

    await expect(firstSubmission).resolves.toEqual({ status: "success" });
    expect(navigateToComplete).toHaveBeenCalledTimes(1);
  });

  it.each([
    [401, "UNAUTHORIZED", "로그인이 만료되었습니다. 다시 로그인해 주세요."],
    [400, "INVALID_REQUEST", "회원 탈퇴 요청을 확인해 주세요."],
    [429, "RATE_LIMIT_EXCEEDED", "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."],
    [500, "WITHDRAWAL_DELETE_FAILED", "회원 탈퇴를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요."],
  ])(
    "keeps consent after a %i failure",
    async (status, code, expectedMessage) => {
      const requestWithdrawal = vi.fn(async () => failedRequest(status, code));
      const navigateToComplete = vi.fn();

      const result = await submitWithdrawal({
        consent: true,
        provider: "kakao",
        lock: createWithdrawalSubmissionLock(),
        requestWithdrawal,
        navigateToComplete,
      });

      expect(result).toEqual({
        status: "error",
        message: expectedMessage,
        preserveConsent: true,
      });
      expect(navigateToComplete).not.toHaveBeenCalled();
    },
  );

  it("runs the Google post-success hook before navigating", async () => {
    const calls: string[] = [];
    const runGooglePostSuccess = vi.fn(async () => {
      calls.push("revoke");
    });
    const navigateToComplete = vi.fn(() => {
      calls.push("navigate");
    });

    const result = await submitWithdrawal({
      consent: true,
      provider: "google",
      lock: createWithdrawalSubmissionLock(),
      requestWithdrawal: vi.fn(async () => ({ ok: true, status: 200 })),
      runGooglePostSuccess,
      navigateToComplete,
    });

    expect(result).toEqual({ status: "success" });
    expect(calls).toEqual(["revoke", "navigate"]);
  });

  it("still navigates when the Google post-success hook fails", async () => {
    const navigateToComplete = vi.fn();

    const result = await submitWithdrawal({
      consent: true,
      provider: "google",
      lock: createWithdrawalSubmissionLock(),
      requestWithdrawal: vi.fn(async () => ({ ok: true, status: 200 })),
      runGooglePostSuccess: vi.fn(async () => {
        throw new Error("provider failure");
      }),
      navigateToComplete,
    });

    expect(result).toEqual({ status: "success" });
    expect(navigateToComplete).toHaveBeenCalledTimes(1);
  });
});
