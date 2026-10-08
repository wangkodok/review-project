"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import LoginOptions from "./LoginOptions";

type ReviewWriteLoginDialogProps = {
  callbackUrl?: string;
  isOpen: boolean;
  onClose: () => void;
};

export default function ReviewWriteLoginDialog({
  callbackUrl = "/community",
  isOpen,
  onClose,
}: ReviewWriteLoginDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus({ preventScroll: true });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-y-0 left-1/2 z-[60] flex w-full max-w-[var(--app-frame-max-width)] -translate-x-1/2 items-center justify-center bg-black/30 px-8"
      role="dialog"
    >
      <div className="relative w-full max-w-[360px] -translate-y-2 rounded-[22px] bg-white px-4 py-4 shadow-xl">
        <button
          aria-label="로그인 창 닫기"
          className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-[#121212] active:bg-neutral-100"
          onClick={onClose}
          ref={closeButtonRef}
          type="button"
        >
          <X aria-hidden="true" size={26} strokeWidth={1.5} />
        </button>

        <h2
          className="text-[20px] font-bold leading-[30px] text-[#121212]"
          id={titleId}
        >
          리뷰, 길게 쓰지 않아도 돼요. 
        </h2>
        <p
          className="mt-2 text-base leading-6 text-[#888888]"
          id={descriptionId}
        >
          카카오 로그인 3초만에 회원 가입
        </p>

        <LoginOptions
          callbackUrl={callbackUrl}
          className="mt-[16px]"
          variant="review-write-dialog"
        />
      </div>
    </div>
  );
}
