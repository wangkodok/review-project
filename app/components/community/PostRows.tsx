"use client";

import { Eye, ThumbsUp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { ReactNode } from "react";
import type { CommunityPost } from "@/app/types/post";
import PostMoreMenu from "./PostMoreMenu";
import {
  buildReviewReportHref,
  type ReviewReportSource,
} from "./reviewReportClient";

const MAX_VISIBLE_REVIEW_CHIPS = 3;
const countFormatter = new Intl.NumberFormat("ko-KR");

function formatDate(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}.${month}.${day}`;
}

function ReviewBadge({ children, tone }: { children: ReactNode; tone: "region" | "category" }) {
  return (
    <span
      className={`inline-flex h-6 max-w-[120px] items-center overflow-hidden whitespace-nowrap px-2 text-xs ${
        tone === "region"
          ? "bg-[#e7f8ed] text-[#27a970]"
          : "bg-[#ddf3ff] text-[#3399ff]"
      }`}
    >
      {children}
    </span>
  );
}

export default function PostRows({
  posts,
  isAuthenticated,
  onDeleteSuccess,
  getDetailHref,
  getEditHref,
  reportSource,
}: {
  posts: CommunityPost[];
  isAuthenticated: boolean;
  onDeleteSuccess?: (postId: string) => void;
  getDetailHref?: (post: CommunityPost) => string;
  getEditHref?: (post: CommunityPost) => string;
  reportSource?: Extract<ReviewReportSource, "community" | "search">;
}) {
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);

  return (
    <div aria-label="리뷰 목록">
      {posts.map((post) => {
        const reviewLabels = [...post.goodPointLabels, ...post.badPointLabels];
        const visibleReviewLabels = reviewLabels.slice(0, MAX_VISIBLE_REVIEW_CHIPS);
        const hiddenReviewLabelCount = reviewLabels.length - visibleReviewLabels.length;
        const displayStoreName = post.storeName || post.menuName;
        const showMenu = isAuthenticated;
        const detailHref = getDetailHref?.(post) ?? `/community/${post.id}`;

        return (
          <article className="border-b border-[#dbdbdb] px-4 py-4" key={post.id}>
            <div className="mb-4 flex h-7 items-center justify-between gap-3">
              <Link
                aria-label={`${displayStoreName} 리뷰 상세 보기`}
                className="flex min-w-0 flex-1 gap-[5px]"
                href={detailHref}
              >
                {post.region ? <ReviewBadge tone="region">{post.region.name}</ReviewBadge> : null}
                {post.category ? (
                  <ReviewBadge tone="category">{post.category.name}</ReviewBadge>
                ) : null}
              </Link>
              {showMenu ? (
                <PostMoreMenu
                  className="relative -mr-2.5"
                  editHref={getEditHref?.(post)}
                  editNavigation="push"
                  isMenuOpen={openMenuPostId === post.id}
                  menuAlignEndOffset={10}
                  mode={post.isOwner ? "owner" : "report"}
                  onDeleteSuccess={onDeleteSuccess}
                  onMenuOpenChange={(isOpen) => setOpenMenuPostId(isOpen ? post.id : null)}
                  postId={post.id}
                  reportHref={
                    !post.isOwner && reportSource
                      ? buildReviewReportHref(post.id, reportSource)
                      : undefined
                  }
                />
              ) : null}
            </div>

            <Link className="block active:bg-neutral-50" href={detailHref}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="line-clamp-2 break-words text-xl font-bold leading-7 text-[#121212]">
                    {displayStoreName}
                  </h2>
                  {post.overallReview ? (
                    <p className="mt-1.5 line-clamp-2 break-words text-base font-normal leading-6 text-[#3d3d3d]">
                      {post.overallReview}
                    </p>
                  ) : null}

                  {reviewLabels.length ? (
                    <div className="mt-[9px] flex flex-wrap gap-1">
                      {visibleReviewLabels.map((label, index) => (
                        <span
                          className="inline-flex min-h-5 max-w-full items-center overflow-hidden text-ellipsis whitespace-nowrap bg-[#efefef] px-2 py-px text-xs font-normal leading-[18px] text-[#373737]"
                          key={`${label}-${index}`}
                        >
                          {label}
                        </span>
                      ))}
                      {hiddenReviewLabelCount > 0 ? (
                        <span className="inline-flex min-h-5 items-center bg-[#efefef] px-2 py-px text-xs font-normal leading-[18px] text-[#373737]">
                          +{hiddenReviewLabelCount}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {post.image ? (
                  <Image
                    alt={`${displayStoreName} 대표 사진`}
                    className="h-24 w-24 shrink-0 object-cover"
                    height={96}
                    loading="lazy"
                    src={post.image.thumbnailUrl}
                    unoptimized
                    width={96}
                  />
                ) : null}
              </div>

              <div className={`${post.image ? "mt-3" : "mt-[30px]"} flex min-h-[18px] flex-wrap items-center justify-between gap-x-2.5 gap-y-1.5 text-xs leading-[18px] text-[#656565]`}>
                <div className="min-w-0 break-words">
                  {post.author.anonymousId} ·{" "}
                  <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-[9px] tabular-nums">
                  <span className="inline-flex items-center gap-[3px] whitespace-nowrap">
                    <ThumbsUp aria-hidden="true" size={15} strokeWidth={1.3} />
                    {countFormatter.format(post.likeCount)}
                  </span>
                  <span className="inline-flex items-center gap-[3px] whitespace-nowrap">
                    <Eye aria-hidden="true" size={15} strokeWidth={1.3} />
                    {countFormatter.format(post.viewCount)}
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
