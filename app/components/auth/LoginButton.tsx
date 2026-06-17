"use client";

import { signIn } from "next-auth/react";

export default function LoginButton() {
  return (
    <button
      className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-neutral-950 px-4 text-base font-semibold text-white active:bg-neutral-800"
      onClick={() => signIn("google", { callbackUrl: "/my" })}
      type="button"
    >
      Google로 로그인
    </button>
  );
}
