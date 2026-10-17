"use client";

import { ThumbsUp } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import ReviewWriteLoginDialog from "@/app/components/auth/ReviewWriteLoginDialog";
import { analytics } from "@/app/lib/analytics/runtime";
import { createAnalyticsOperation } from "@/app/lib/analytics/results";

type LikeResponse = {
  success: boolean;
  data: {
    liked: boolean;
    likeCount: number;
  } | null;
  message: string;
  code?: string;
};

export default function LikeButton({
  isAuthenticated,
  postId,
  initialLiked,
  initialLikeCount,
}: {
  isAuthenticated: boolean;
  postId: string;
  initialLiked: boolean;
  initialLikeCount: number;
}) {
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const likeButtonRef = useRef<HTMLButtonElement>(null);

  const closeLoginDialog = useCallback(() => {
    setIsLoginDialogOpen(false);
    window.requestAnimationFrame(() => {
      likeButtonRef.current?.focus({ preventScroll: true });
    });
  }, []);

  async function handleClick() {
    if (isPending) {
      return;
    }

    const record = createAnalyticsOperation(analytics);
    const screen = "/community/[postId]";
    if (!isAuthenticated) {
      record({ event: "like_result", properties: { screen, result: "login_required" } });
      setMessage("");
      setIsLoginDialogOpen(true);
      return;
    }

    setIsPending(true);
    setMessage("");

    try {
      const response = await fetch(`/api/posts/${postId}/like`, {
        method: "POST",
      });
      const result = (await response.json()) as LikeResponse;

      if (!response.ok || !result.success || !result.data) {
        record({ event: "like_result", properties: { screen, result: "failed" } });
        setMessage(result.message || "좋아요 처리에 실패했습니다.");
        return;
      }

      setIsLiked(result.data.liked);
      setLikeCount(result.data.likeCount);
      record({ event: "like_result", properties: { screen, result: result.data.liked ? "added" : "removed" } });
    } catch {
      record({ event: "like_result", properties: { screen, result: "failed" } });
      setMessage("좋아요 처리에 실패했습니다.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="contents">
      <button
        data-analytics-action="like_click"
        aria-expanded={isAuthenticated ? undefined : isLoginDialogOpen}
        aria-haspopup={isAuthenticated ? undefined : "dialog"}
        aria-pressed={isLiked}
        className={`inline-flex min-h-11 items-center gap-1 whitespace-nowrap text-sm font-normal disabled:opacity-60 ${
          isLiked ? "text-[#3399ff]" : "text-[#777777]"
        }`}
        disabled={isPending}
        onClick={handleClick}
        ref={likeButtonRef}
        type="button"
      >
        <ThumbsUp
          aria-hidden="true"
          fill={isLiked ? "currentColor" : "none"}
          size={18}
          strokeWidth={1.8}
        />
        {likeCount.toLocaleString("ko-KR")}
      </button>
      {message ? (
        <p className="w-full pb-3 text-sm font-normal text-[#686868]">{message}</p>
      ) : null}
      <ReviewWriteLoginDialog
        callbackUrl={`/community/${postId}`}
        isOpen={isLoginDialogOpen}
        onClose={closeLoginDialog}
      />
    </div>
  );
}
