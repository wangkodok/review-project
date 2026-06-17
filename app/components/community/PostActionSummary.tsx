import { Eye } from "lucide-react";
import LikeButton from "./LikeButton";

export default function PostActionSummary({
  isLiked = false,
  likeCount,
  postId,
  viewCount,
}: {
  isLiked?: boolean;
  likeCount: number;
  postId?: string;
  viewCount: number;
}) {
  return (
    <div className="flex items-center gap-4 text-sm font-semibold text-neutral-500">
      {postId ? (
        <LikeButton initialLiked={isLiked} initialLikeCount={likeCount} postId={postId} />
      ) : null}
      <span className="inline-flex items-center gap-1">
        <Eye aria-hidden="true" size={18} />
        {viewCount}
      </span>
    </div>
  );
}
