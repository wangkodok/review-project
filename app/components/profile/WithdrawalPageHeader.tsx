"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function replaceWithdrawalLocation({
  href,
  replaceLocation,
}: {
  href: "/" | "/my";
  replaceLocation: (href: string) => void;
}) {
  replaceLocation(href);
}

export default function WithdrawalPageHeader({
  title,
  backHref,
  disabled = false,
}: {
  title: "회원 탈퇴" | "완료";
  backHref: "/" | "/my";
  disabled?: boolean;
}) {
  const router = useRouter();

  return (
    <header className="relative flex h-14 shrink-0 items-center border-b border-[#dbdbdb] bg-white">
      <button
        aria-label="뒤로가기"
        className="flex h-14 w-14 items-center justify-center text-[#121212] active:bg-[#f7f7f7] disabled:text-[#bdbdbd]"
        disabled={disabled}
        onClick={() =>
          replaceWithdrawalLocation({
            href: backHref,
            replaceLocation: (href) => router.replace(href),
          })
        }
        type="button"
      >
        <ChevronLeft aria-hidden="true" size={24} strokeWidth={1.6} />
      </button>
      <h1 className="pointer-events-none absolute inset-x-14 text-center text-base font-medium leading-6 text-[#121212]">
        {title}
      </h1>
    </header>
  );
}
