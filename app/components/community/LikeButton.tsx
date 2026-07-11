"use client";

import { ThumbsUp } from "lucide-react";
import { useState } from "react";

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
  postId,
  initialLiked,
  initialLikeCount,
}: {
  postId: string;
  initialLiked: boolean;
  initialLikeCount: number;
}) {
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState("");

  async function handleClick() {
    if (isPending) {
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
        setMessage(result.message || "좋아요 처리에 실패했습니다.");
        return;
      }

      setIsLiked(result.data.liked);
      setLikeCount(result.data.likeCount);
    } catch {
      setMessage("좋아요 처리에 실패했습니다.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        aria-pressed={isLiked}
        className={`inline-flex items-center gap-1 text-sm font-semibold disabled:opacity-60 ${
          isLiked ? "text-neutral-950" : "text-neutral-500"
        }`}
        disabled={isPending}
        onClick={handleClick}
        type="button"
      >
        <ThumbsUp aria-hidden="true" fill={isLiked ? "currentColor" : "none"} size={18} />
        {likeCount}
      </button>
      {message ? <p className="text-sm font-medium text-neutral-500">{message}</p> : null}
    </div>
  );
}
