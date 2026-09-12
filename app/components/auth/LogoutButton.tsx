"use client";

import { ChevronRight, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";
import ReviewConfirmDialog from "@/app/components/community/ReviewConfirmDialog";

const LOGOUT_DIALOG_TITLE = "로그아웃";
const LOGOUT_DIALOG_DESCRIPTION = "로그아웃을 하시겠습니까?";

export default function LogoutButton() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleLogout() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    await signOut({ callbackUrl: "/my" });
  }

  return (
    <>
      <button
        className="flex h-14 w-full items-center justify-between border-b border-[#dbdbdb] px-4 text-[#121212] active:bg-[#f7f7f7]"
        onClick={() => setIsDialogOpen(true)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-[11px] text-base font-medium leading-6">
          <LogOut aria-hidden="true" size={21} strokeWidth={1.7} />
          로그아웃
        </span>
        <ChevronRight aria-hidden="true" size={19} strokeWidth={1.45} />
      </button>

      <ReviewConfirmDialog
        cancelLabel="취소"
        compact
        confirmLabel="로그아웃"
        description={LOGOUT_DIALOG_DESCRIPTION}
        isOpen={isDialogOpen}
        isPending={isSigningOut}
        onCancel={() => setIsDialogOpen(false)}
        onConfirm={handleLogout}
        title={LOGOUT_DIALOG_TITLE}
      />
    </>
  );
}
