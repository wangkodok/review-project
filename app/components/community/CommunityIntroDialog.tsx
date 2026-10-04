"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  hasSeenCommunityIntro,
  markCommunityIntroSeen,
} from "./communityIntroStorage";

type CommunityIntroDialogContentProps = {
  onClose: () => void;
};

function getCommunityIntroStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function CommunityIntroDialogContent({
  onClose,
}: CommunityIntroDialogContentProps) {
  const titleId = useId();
  const descriptionId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    titleRef.current?.focus({ preventScroll: true });

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
  }, [onClose]);

  return (
    <div
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-y-0 left-1/2 z-[60] flex w-full max-w-[var(--app-frame-max-width)] -translate-x-1/2 items-center justify-center bg-black/30 px-4"
      role="dialog"
    >
      <div className="w-full max-w-[312px] rounded-[22px] bg-white px-4 pb-[15px] pt-8 text-center shadow-xl">
        <h2
          className="text-xl font-bold leading-[26px] text-[#121212] outline-none"
          id={titleId}
          ref={titleRef}
          tabIndex={-1}
        >
          다른 소비자에게 정보를
          <br />
          제공하고, 공익 목적의
          <br />
          익명 리뷰 서비스입니다.
        </h2>
        <p
          className="mt-4 text-sm leading-7 text-[#777777]"
          id={descriptionId}
        >
          각자가 느꼈던 좋았던 점과 아쉬웠던 점을
          <br />
          솔직하게 선택하고 리뷰를 공유합니다.
        </p>
        <button
          className="mt-8 flex h-[49px] w-full items-center justify-center rounded-[7px] bg-[#f4f4f4] text-base font-bold text-[#121212] active:bg-[#e9e9e9]"
          onClick={onClose}
          type="button"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

export default function CommunityIntroDialog() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const storage = getCommunityIntroStorage();
    if (storage && hasSeenCommunityIntro(storage)) {
      return;
    }

    const frame = window.requestAnimationFrame(() => setIsOpen(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const closeDialog = useCallback(() => {
    const storage = getCommunityIntroStorage();
    if (storage) {
      markCommunityIntroSeen(storage);
    }
    setIsOpen(false);
  }, []);

  if (!isOpen) {
    return null;
  }

  return <CommunityIntroDialogContent onClose={closeDialog} />;
}
