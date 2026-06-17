"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button
      className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-neutral-200 bg-white px-4 text-base font-semibold text-neutral-950 active:bg-neutral-100"
      onClick={() => signOut({ callbackUrl: "/my" })}
      type="button"
    >
      로그아웃
    </button>
  );
}
