"use client";

import { ChevronRight, UserX } from "lucide-react";
import Link from "next/link";

export default function WithdrawButton({
  href = "/my/withdraw",
}: {
  href?: "/my/withdraw" | "/my/withdraw?from=community";
}) {
  return (
    <Link
      className="flex h-14 w-full items-center justify-between border-b border-[#dbdbdb] px-4 text-[#121212] active:bg-[#f7f7f7]"
      href={href}
    >
      <span className="flex min-w-0 items-center gap-[11px] text-base font-medium leading-6">
        <UserX aria-hidden="true" size={21} strokeWidth={1.7} />
        회원 탈퇴
      </span>
      <ChevronRight aria-hidden="true" size={19} strokeWidth={1.45} />
    </Link>
  );
}
