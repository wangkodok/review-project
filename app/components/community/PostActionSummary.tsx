import { Eye } from "lucide-react";
import LikeButton from "./LikeButton";

const countFormatter = new Intl.NumberFormat("ko-KR");

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
    <div className="flex min-h-12 flex-wrap items-center gap-x-3.5 text-sm font-normal text-[#777777]">
      {postId ? (
        <LikeButton initialLiked={isLiked} initialLikeCount={likeCount} postId={postId} />
      ) : null}
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        <Eye aria-hidden="true" size={18} strokeWidth={1.8} />
        {countFormatter.format(viewCount)}
      </span>
    </div>
  );
}
