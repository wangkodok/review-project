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
        className="flex h-14 w-full items-center justify-between border-t border-neutral-200 px-5 text-neutral-950 active:bg-neutral-50"
        onClick={() => setIsDialogOpen(true)}
        type="button"
      >
        <span className="flex items-center gap-3 text-base font-semibold">
          <LogOut aria-hidden="true" size={22} strokeWidth={1.7} />
          로그아웃
        </span>
        <ChevronRight aria-hidden="true" size={21} strokeWidth={1.7} />
      </button>

      {isDialogOpen ? (
        <div
          aria-labelledby="logout-dialog-title"
          aria-modal="true"
          className="fixed inset-y-0 left-1/2 z-50 flex w-full max-w-[375px] -translate-x-1/2 items-center justify-center bg-black/30 px-5"
          role="dialog"
        >
          <div className="w-full max-w-[335px] overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="px-5 py-7 text-center">
              <h2
                className="text-lg font-bold text-neutral-950"
                id="logout-dialog-title"
              >
                {LOGOUT_DIALOG_TITLE}
              </h2>
              <p className="mt-3 text-sm font-semibold text-neutral-500">
                {LOGOUT_DIALOG_DESCRIPTION}
              </p>
            </div>
            <div className="grid grid-cols-2">
              <button
                className="h-14 bg-neutral-100 text-base font-semibold text-neutral-950 active:bg-neutral-200 disabled:text-neutral-400"
                disabled={isSigningOut}
                onClick={() => setIsDialogOpen(false)}
                type="button"
              >
                취소
              </button>
              <button
                className="h-14 bg-neutral-950 text-base font-semibold text-white active:bg-neutral-800 disabled:bg-neutral-400"
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
