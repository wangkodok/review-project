"use client";

import { Heart } from "lucide-react";
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
        className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold disabled:opacity-60 ${
          isLiked
            ? "border-neutral-950 bg-neutral-950 text-white"
            : "border-neutral-200 bg-white text-neutral-950"
        }`}
        disabled={isPending}
        onClick={handleClick}
        type="button"
      >
        <Heart aria-hidden="true" fill={isLiked ? "currentColor" : "none"} size={18} />
        {likeCount}
      </button>
      {message ? <p className="text-sm font-medium text-neutral-500">{message}</p> : null}
    </div>
  );
}
