"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export default function PageBackHeader({
  title,
  right,
  onBack,
  fullHeightActions = false,
  sticky = false,
  titleClassName,
  backIconStrokeWidth,
}: {
  title: string;
  right?: ReactNode;
  onBack?: () => void;
  fullHeightActions?: boolean;
  sticky?: boolean;
  titleClassName?: string;
  backIconStrokeWidth?: number;
}) {
  const router = useRouter();

  return (
    <header
      className={`-mx-5 -mt-5 flex h-14 items-center justify-between border-b border-neutral-100 bg-white ${
        fullHeightActions ? "px-0" : "px-3"
      } ${sticky ? "sticky top-0 z-30" : ""}`}
    >
      <button
        aria-label="뒤로가기"
        className={`flex items-center justify-center text-neutral-950 active:bg-neutral-100 ${
          fullHeightActions ? "h-14 w-14" : "h-11 w-11 rounded-full"
        }`}
        onClick={onBack ?? (() => router.back())}
        type="button"
      >
        <ArrowLeft aria-hidden="true" size={22} strokeWidth={backIconStrokeWidth} />
      </button>
      <h1 className={titleClassName ?? "text-base font-bold text-neutral-950"}>{title}</h1>
      <div
        className={`flex items-center justify-center ${
          fullHeightActions ? "h-14 w-14" : "h-11 w-11"
        }`}
      >
        {right}
      </div>
    </header>
  );
}
