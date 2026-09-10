"use client";

import { useEffect, useRef } from "react";
import type { ButtonHTMLAttributes, ReactNode, RefObject } from "react";

type ReviewMenuPopoverProps = {
  ariaLabel: string;
  isOpen: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  children: ReactNode;
  alignEndOffset?: number;
  closeOnScroll?: boolean;
};

export function ReviewMenuItem({
  className = "",
  role = "menuitem",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`block min-h-11 w-full whitespace-nowrap px-4 py-2 text-left text-lg leading-7 text-[#121212] hover:bg-[#f4f4f4] focus-visible:bg-[#f4f4f4] focus-visible:outline-offset-[-3px] active:bg-[#f4f4f4] ${className}`}
      role={role}
      type={type}
      {...props}
    />
  );
}

export default function ReviewMenuPopover({
  ariaLabel,
  isOpen,
  triggerRef,
  onClose,
  children,
  alignEndOffset = 0,
  closeOnScroll = false,
}: ReviewMenuPopoverProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    if (!closeOnScroll) {
      document.body.style.overflow = "hidden";
    }

    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus({
      preventScroll: true,
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        triggerRef.current?.focus({ preventScroll: true });
      }
    }

    function handleScroll() {
      onClose();
    }

    window.addEventListener("keydown", handleKeyDown);

    if (closeOnScroll) {
      window.addEventListener("scroll", handleScroll, true);
    }

    return () => {
      if (!closeOnScroll) {
        document.body.style.overflow = previousOverflow;
      }

      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [closeOnScroll, isOpen, onClose, triggerRef]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-y-0 left-1/2 z-30 w-full max-w-[var(--app-frame-max-width)] -translate-x-1/2"
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onClose();
          triggerRef.current?.focus({ preventScroll: true });
        }}
      />
      <div
        aria-label={ariaLabel}
        className="absolute top-[calc(100%+4px)] z-40 min-w-[116px] rounded-lg border border-[#dbdbdb] bg-white py-1.5"
        ref={menuRef}
        role="menu"
        style={{ right: alignEndOffset }}
      >
        {children}
      </div>
    </>
  );
}
