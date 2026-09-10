"use client";

import { useEffect, useId, useRef } from "react";

type ReviewConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  tone?: "primary" | "danger";
  isPending?: boolean;
  pendingLabel?: string;
  errorMessage?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ReviewConfirmDialog({
  isOpen,
  title,
  description,
  cancelLabel,
  confirmLabel,
  tone = "primary",
  isPending = false,
  pendingLabel,
  errorMessage,
  onCancel,
  onConfirm,
}: ReviewConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelButtonRef.current?.focus({ preventScroll: true });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPending) {
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isPending, onCancel]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-y-0 left-1/2 z-50 flex w-full max-w-[var(--app-frame-max-width)] -translate-x-1/2 items-center justify-center bg-black/30 px-[31px]"
      role="dialog"
    >
      <div className="w-full max-w-[360px] rounded-[22px] bg-white px-4 pb-4 pt-[22px] text-center shadow-xl">
        <h2 className="text-xl font-bold text-neutral-950" id={titleId}>
          {title}
        </h2>
        <p
          className="mt-2.5 min-h-[46px] whitespace-pre-line text-base leading-[1.55] text-neutral-500"
          id={descriptionId}
        >
          {description}
        </p>
        {errorMessage ? (
          <p
            className="mt-3 rounded-[7px] bg-neutral-100 px-3 py-2 text-sm font-semibold leading-5 text-neutral-800"
            role="status"
          >
            {errorMessage}
          </p>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            className="h-[52px] rounded-[7px] bg-neutral-100 text-base font-bold text-neutral-950 active:bg-neutral-200 disabled:text-neutral-400"
            disabled={isPending}
            onClick={onCancel}
            ref={cancelButtonRef}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className={`h-[52px] rounded-[7px] text-base font-bold text-white disabled:bg-neutral-300 ${
              tone === "danger"
                ? "bg-[#f44250] active:bg-[#dc3543]"
                : "bg-[#3399ff] active:bg-[#2186e8]"
            }`}
            disabled={isPending}
            onClick={onConfirm}
            type="button"
          >
            {isPending ? (pendingLabel ?? confirmLabel) : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
