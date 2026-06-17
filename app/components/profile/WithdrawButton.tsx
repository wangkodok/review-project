"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

type WithdrawResponse = {
  success: boolean;
  data: null;
  message: string;
  code?: string;
};

export default function WithdrawButton() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleWithdraw() {
    if (isSubmitting) {
      return;
    }

    const confirmed = window.confirm(
      "회원 탈퇴 시 작성한 게시글, 좋아요, 조회 기록이 모두 삭제되며 복구할 수 없습니다. 정말 탈퇴하시겠습니까?",
    );

    if (!confirmed) {
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
        return;
      }

      await signOut({ callbackUrl: "/community" });
    } catch {
      setErrorMessage("회원 탈퇴에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      {errorMessage ? (
        <p className="rounded-lg bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-950">
          {errorMessage}
        </p>
      ) : null}
      <button
        className="h-12 w-full rounded-lg border border-neutral-200 bg-white px-4 text-base font-semibold text-neutral-950 active:bg-neutral-100 disabled:text-neutral-400"
        disabled={isSubmitting}
        onClick={handleWithdraw}
        type="button"
      >
        회원 탈퇴
      </button>
    </div>
  );
}
