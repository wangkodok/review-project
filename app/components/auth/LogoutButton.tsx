"use client";

import { ChevronRight, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button
      className="flex h-14 w-full items-center justify-between border-t border-neutral-200 px-5 text-neutral-950 active:bg-neutral-50"
      onClick={() => signOut({ callbackUrl: "/my" })}
      type="button"
    >
      <span className="flex items-center gap-3 text-base font-semibold">
        <LogOut aria-hidden="true" size={22} strokeWidth={1.7} />
        로그아웃
      </span>
      <ChevronRight aria-hidden="true" size={21} strokeWidth={1.7} />
    </button>
  );
}
