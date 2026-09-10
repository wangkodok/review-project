"use client";

import { ChevronRight, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";

const LOGOUT_DIALOG_TITLE = "로그아웃";
const LOGOUT_DIALOG_DESCRIPTION = "현재 계정에서 로그아웃할까요?";

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

      {isDialogOpen ? (
        <div
          aria-labelledby="logout-dialog-title"
          aria-modal="true"
          className="fixed inset-y-0 left-1/2 z-50 flex w-full max-w-[var(--app-frame-max-width)] -translate-x-1/2 items-center justify-center bg-black/30 px-4"
          role="dialog"
        >
          <div className="w-full max-w-[343px] overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="px-5 pb-[22px] pt-[25px] text-center">
              <h2
                className="text-[19px] font-bold leading-[27px] text-[#121212]"
                id="logout-dialog-title"
              >
                {LOGOUT_DIALOG_TITLE}
              </h2>
              <p className="mt-[9px] text-sm font-normal leading-[22px] text-[#777777]">
                {LOGOUT_DIALOG_DESCRIPTION}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 px-4 pb-4">
              <button
                className="h-12 rounded-lg bg-[#f0f0f0] text-base font-semibold text-[#121212] active:brightness-95 disabled:text-neutral-400"
                disabled={isSigningOut}
                onClick={() => setIsDialogOpen(false)}
                type="button"
              >
                취소
              </button>
              <button
                className="h-12 rounded-lg bg-[#121212] text-base font-semibold text-white active:brightness-95 disabled:bg-neutral-400"
                disabled={isSigningOut}
                onClick={handleLogout}
                type="button"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
