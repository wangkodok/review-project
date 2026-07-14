"use client";

import { ChevronRight, UserX } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";

type WithdrawResponse = {
  success: boolean;
  data: null;
  message: string;
  code?: string;
};

const WITHDRAW_DIALOG_TITLE = "회원 탈퇴";
const WITHDRAW_DIALOG_DESCRIPTION =
  "회원 탈퇴 시 사용자의 모든 개인정보 및 이용 기록이 삭제되며 복구할 수 없습니다. 정말로 회원 탈퇴하시겠습니까?";

export default function WithdrawButton() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleWithdraw() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/withdraw", {
        method: "DELETE",
      });
      const result = (await response.json()) as WithdrawResponse;

      if (!response.ok || !result.success) {
        setErrorMessage(result.message || "회원 탈퇴에 실패했습니다.");
        setIsDialogOpen(false);
        return;
      }

      await signOut({ callbackUrl: "/community" });
    } catch {
      setErrorMessage("회원 탈퇴에 실패했습니다.");
      setIsDialogOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      {errorMessage ? (
        <p className="mx-5 my-3 rounded-lg bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-950">
          {errorMessage}
        </p>
      ) : null}
      <button
        className="flex h-14 w-full items-center justify-between border-t border-neutral-200 px-5 text-neutral-950 active:bg-neutral-50 disabled:text-neutral-400"
        disabled={isSubmitting}
        onClick={() => setIsDialogOpen(true)}
        type="button"
      >
        <span className="flex items-center gap-3 text-base font-semibold">
          <UserX aria-hidden="true" size={22} strokeWidth={1.7} />
          회원 탈퇴
        </span>
        <ChevronRight aria-hidden="true" size={21} strokeWidth={1.7} />
      </button>

      {isDialogOpen ? (
        <div
          aria-labelledby="withdraw-dialog-title"
          aria-modal="true"
          className="fixed inset-y-0 left-1/2 z-50 flex w-full max-w-[375px] -translate-x-1/2 items-center justify-center bg-black/30 px-5"
          role="dialog"
        >
          <div className="w-full max-w-[335px] overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="px-5 py-7 text-center">
              <h2
                className="text-lg font-bold text-neutral-950"
                id="withdraw-dialog-title"
              >
                {WITHDRAW_DIALOG_TITLE}
              </h2>
              <p className="mt-3 whitespace-pre-line text-sm font-semibold leading-7 text-neutral-500">
                {WITHDRAW_DIALOG_DESCRIPTION}
              </p>
            </div>
            <div className="grid grid-cols-2">
              <button
                className="h-14 bg-neutral-100 text-base font-semibold text-neutral-950 active:bg-neutral-200 disabled:text-neutral-400"
                disabled={isSubmitting}
                onClick={() => setIsDialogOpen(false)}
                type="button"
              >
                취소
              </button>
              <button
                className="h-14 bg-red-500 text-base font-semibold text-white active:bg-red-600 disabled:bg-red-50 disabled:text-red-300"
                disabled={isSubmitting}
                onClick={handleWithdraw}
                type="button"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
