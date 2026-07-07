"use client";

import { Eye, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { CommunityPost } from "@/app/types/post";
import PostMoreMenu from "./PostMoreMenu";

const MAX_VISIBLE_REVIEW_CHIPS = 3;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export default function PostRows({
  posts,
  isAuthenticated,
  onDeleteSuccess,
}: {
  posts: CommunityPost[];
  isAuthenticated: boolean;
  onDeleteSuccess?: () => void;
}) {
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);

  return (
    <div>
      {posts.map((post) => {
        const reviewLabels = [...post.goodPointLabels, ...post.badPointLabels];
        const visibleReviewLabels = reviewLabels.slice(0, MAX_VISIBLE_REVIEW_CHIPS);
        const hiddenReviewLabelCount = reviewLabels.length - visibleReviewLabels.length;

        return (
          <article className="relative border-b border-neutral-200 py-4" key={post.id}>
            <PostMoreMenu
              className="absolute right-0 top-2"
              closeOnOutsidePointerDown
              editNavigation="push"
              isAuthenticated={isAuthenticated}
              isMenuOpen={openMenuPostId === post.id}
              isOwner={post.isOwner}
              onMenuOpenChange={(isOpen) => setOpenMenuPostId(isOpen ? post.id : null)}
              onDeleteSuccess={onDeleteSuccess}
              postId={post.id}
              requiresCategorySelection={post.requiresCategorySelection}
            />
            <Link className="block pr-12 active:bg-neutral-50" href={`/community/${post.id}`}>
              {post.category ? (
                <span className="inline-flex h-6 max-w-[120px] items-center overflow-hidden bg-neutral-100 px-2 text-xs font-bold text-neutral-950">
                  {post.category.name}
                </span>
              ) : null}
              <h2 className="mt-3 line-clamp-2 break-all text-[19px] font-extrabold leading-[1.32] text-neutral-900">
                {post.menuName}
              </h2>
              {post.overallReview ? (
                <p className="mt-2 line-clamp-2 break-all text-sm font-medium leading-6 text-neutral-500">
                  {post.overallReview}
                </p>
              ) : null}
              {reviewLabels.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {visibleReviewLabels.map((label, index) => (
                    <span
                      className="inline-flex min-h-6 max-w-full items-center overflow-hidden text-ellipsis whitespace-nowrap border border-neutral-400 bg-white px-2 text-xs font-bold text-neutral-800"
                      key={`${label}-${index}`}
                    >
                      {label}
                    </span>
                  ))}
                  {hiddenReviewLabelCount > 0 ? (
                    <span className="inline-flex min-h-6 items-center border border-neutral-400 bg-white px-2 text-xs font-bold text-neutral-800">
                      +{hiddenReviewLabelCount}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-6 flex items-center justify-between gap-3">
                <div className="min-w-0 truncate text-xs font-semibold text-neutral-400">
                  {post.author.anonymousId} ·{" "}
                  <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-sm font-semibold text-neutral-500">
                  <span className="inline-flex items-center gap-1">
                    <ThumbsUp aria-hidden="true" size={15} strokeWidth={1.8} />
                    {post.likeCount}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Eye aria-hidden="true" size={15} strokeWidth={1.8} />
                    {post.viewCount}
                  </span>
                </div>
              </div>
            </Link>
          </article>
        );
      })}
    </div>
  );
}
