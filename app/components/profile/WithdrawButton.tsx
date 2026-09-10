"use client";

import { ChevronRight, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const WITHDRAW_DIALOG_TITLE = "회원 탈퇴";
const WITHDRAW_DIALOG_DESCRIPTION =
  "회원 탈퇴 시 사용자의 모든 개인정보 및 이용 기록이 삭제되며 복구할 수 없습니다. 정말로 회원 탈퇴하시겠습니까?";

export default function WithdrawButton() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  function continueToWithdrawal() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setIsDialogOpen(false);
    router.push("/my/withdraw");
  }

  return (
    <div>
      <button
        className="flex h-14 w-full items-center justify-between border-b border-[#dbdbdb] px-4 text-[#121212] active:bg-[#f7f7f7] disabled:text-neutral-400"
        disabled={isSubmitting}
        onClick={() => setIsDialogOpen(true)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-[11px] text-base font-medium leading-6">
          <UserX aria-hidden="true" size={21} strokeWidth={1.7} />
          회원 탈퇴
        </span>
        <ChevronRight aria-hidden="true" size={19} strokeWidth={1.45} />
      </button>

      {isDialogOpen ? (
        <div
          aria-labelledby="withdraw-dialog-title"
          aria-modal="true"
          className="fixed inset-y-0 left-1/2 z-50 flex w-full max-w-[var(--app-frame-max-width)] -translate-x-1/2 items-center justify-center bg-black/30 px-4"
          role="dialog"
        >
          <div className="w-full max-w-[343px] overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="px-5 pb-[22px] pt-[25px] text-center">
              <h2
                className="text-[19px] font-bold leading-[27px] text-[#121212]"
                id="withdraw-dialog-title"
              >
                {WITHDRAW_DIALOG_TITLE}
              </h2>
              <p className="mt-[9px] whitespace-pre-line text-sm font-normal leading-[22px] text-[#777777]">
                {WITHDRAW_DIALOG_DESCRIPTION}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 px-4 pb-4">
              <button
                className="h-12 rounded-lg bg-[#f0f0f0] text-base font-semibold text-[#121212] active:brightness-95 disabled:text-neutral-400"
                disabled={isSubmitting}
                onClick={() => setIsDialogOpen(false)}
                type="button"
              >
                취소
              </button>
              <button
                className="h-12 rounded-lg bg-[#f04452] text-base font-semibold text-white active:brightness-95 disabled:bg-red-50 disabled:text-red-300"
                disabled={isSubmitting}
                onClick={continueToWithdrawal}
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
