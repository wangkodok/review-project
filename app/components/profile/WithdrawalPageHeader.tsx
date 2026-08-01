"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import PageBackHeader from "@/app/components/common/PageBackHeader";

type WithdrawalReauthCancelResponse = {
  success: boolean;
  data: {
    status?: "idle" | "cancelled";
  } | null;
  message: string;
  code?: string;
};

function WithdrawalPageHeaderContent() {
  const { update } = useSession();
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function cancelAndReturn() {
    if (isCancelling) {
      return;
    }

    setIsCancelling(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/withdraw/reauth", {
        method: "DELETE",
      });
      const result = (await response.json()) as WithdrawalReauthCancelResponse;

      if (!response.ok || !result.success) {
        if (
          result.code === "UNAUTHORIZED" ||
          result.code === "SESSION_INVALID" ||
          result.code === "WITHDRAWAL_FLOW_EXPIRED"
        ) {
          router.replace("/my");
          return;
        }

        setErrorMessage(
          result.message || "본인 확인 요청을 취소하지 못했습니다.",
        );
        return;
      }

      await update({
        clearWithdrawalReauth: true,
      });
      router.replace("/my");
    } catch {
      setErrorMessage("본인 확인 요청을 취소하지 못했습니다.");
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <>
      <PageBackHeader onBack={cancelAndReturn} title="회원 탈퇴" />
      {errorMessage ? (
        <p className="mt-4 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </p>
      ) : null}
    </>
  );
}

export default function WithdrawalPageHeader() {
  return (
    <SessionProvider>
      <WithdrawalPageHeaderContent />
    </SessionProvider>
  );
}
