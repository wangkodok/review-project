"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export default function PageBackHeader({
  title,
  right,
  onBack,
}: {
  title: string;
  right?: ReactNode;
  onBack?: () => void;
}) {
  const router = useRouter();

  return (
    <header className="-mx-5 -mt-5 flex h-14 items-center justify-between border-b border-neutral-100 bg-white px-3">
      <button
        aria-label="뒤로가기"
        className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-950 active:bg-neutral-100"
        onClick={onBack ?? (() => router.back())}
        type="button"
      >
        <ArrowLeft aria-hidden="true" size={22} />
      </button>
      <h1 className="text-base font-bold text-neutral-950">{title}</h1>
      <div className="flex h-11 w-11 items-center justify-center">{right}</div>
    </header>
  );
}
