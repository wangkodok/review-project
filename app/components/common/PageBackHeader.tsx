"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export default function PageBackHeader({
  title,
  right,
  onBack,
  backDisabled = false,
  flush = false,
  sticky = false,
}: {
  title: string;
  right?: ReactNode;
  onBack?: () => void;
  backDisabled?: boolean;
  flush?: boolean;
  sticky?: boolean;
}) {
  const router = useRouter();

  return (
    <header
      className={`${
        flush ? "" : "-mx-4 -mt-5"
      } grid h-14 grid-cols-[56px_minmax(0,1fr)_56px] items-center border-b border-[#dbdbdb] bg-white ${
        sticky ? "sticky top-0 z-30" : ""
      }`}
    >
      <button
        aria-label="뒤로가기"
        className="flex h-14 w-14 items-center justify-center text-[#121212] active:bg-[#f7f7f7] disabled:text-[#bdbdbd]"
        disabled={backDisabled}
        onClick={onBack ?? (() => router.back())}
        type="button"
      >
        <ArrowLeft aria-hidden="true" size={22} strokeWidth={1.25} />
      </button>
      {title ? (
        <h1 className="truncate text-center text-[18px] font-medium leading-7 text-[#121212]">
          {title}
        </h1>
      ) : (
        <span aria-hidden="true" />
      )}
      <div className="flex h-14 w-14 items-center justify-center">{right}</div>
    </header>
  );
}
