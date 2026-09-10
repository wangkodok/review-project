"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { ArrowLeft, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MY_POSTS_QUERY_KEY,
  markMyPostsDeleteSuccess,
  removePostFromMyPostsData,
} from "@/app/components/profile/myPostsClient";
import { PROFILE_QUERY_KEY, type ProfileUser } from "@/app/components/profile/profileClient";
import type { CommunityPost, PostsPage } from "@/app/types/post";
import PostMoreMenu from "./PostMoreMenu";
import PostActionSummary from "./PostActionSummary";
import { buildReviewReportHref } from "./reviewReportClient";

type PostDetailData = CommunityPost & {
  updatedAt: string;
  isLiked: boolean;
};

type PostDetailResponse = {
  success: boolean;
  data: {
    post: PostDetailData;
  } | null;
  message: string;
  code?: string;
};

async function fetchPostDetail(postId: string) {
  const response = await fetch(`/api/posts/${postId}`);
  const result = (await response.json()) as PostDetailResponse;

  if (!response.ok || !result.success || !result.data) {
    const error = new Error(result.message || "리뷰를 불러오지 못했습니다.");
    error.name = result.code ?? "POST_DETAIL_ERROR";
    throw error;
  }

  return result.data.post;
}

function formatDetailDate(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}.${month}.${day}`;
}

function PostDetailSkeleton() {
  return (
    <div aria-label="리뷰를 불러오는 중" role="status">
      <div className="review-list-skeleton flex min-h-[72px] items-center border-b border-[#dbdbdb] px-4 py-2.5">
        <div className="h-[42px] w-[42px] shrink-0 rounded-full bg-[#e4e4e4]" />
        <div className="ml-2 min-w-0 flex-1">
          <div className="h-5 w-28 bg-[#e4e4e4]" />
          <div className="mt-1 h-4 w-20 bg-[#e4e4e4]" />
        </div>
      </div>
      <div className="review-list-skeleton px-4 pt-5">
        <div className="h-5 w-24 bg-[#e4e4e4]" />
        <div className="mt-2 h-[30px] w-3/4 bg-[#e4e4e4]" />
        <div className="mt-[18px] h-6 w-full bg-[#e4e4e4]" />
        <div className="mt-7 h-7 w-20 bg-[#e4e4e4]" />
        <div className="mt-2.5 h-6 w-4/5 bg-[#e4e4e4]" />
        <div className="mt-7 h-7 w-24 bg-[#e4e4e4]" />
        <div className="mt-2.5 h-6 w-full bg-[#e4e4e4]" />
      </div>
    </div>
  );
}

export default function PostDetail({
  postId,
  isAuthenticated,
  source,
}: {
  postId: string;
  isAuthenticated: boolean;
  source?: "my-posts";
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["post", postId],
    queryFn: () => fetchPostDetail(postId),
  });
  const errorName = query.error instanceof Error ? query.error.name : "";
  const isNotFound = errorName === "POST_NOT_FOUND";
  const goodPointLabels = query.data?.goodPointLabels ?? [];
  const badPointLabels = query.data?.badPointLabels ?? [];
  const displayStoreName = query.data?.storeName || query.data?.menuName || "";
  const hasTaxonomy = Boolean(query.data?.region || query.data?.category);
  const showMenuCopy = Boolean(query.data?.storeName && query.data.menuName);

  function handleDeleteSuccess(deletedPostId: string) {
    if (source !== "my-posts") {
      router.replace("/community");
      return;
    }

    queryClient.setQueryData<InfiniteData<PostsPage, number>>(MY_POSTS_QUERY_KEY, (current) =>
      removePostFromMyPostsData(current, deletedPostId),
    );
    queryClient.setQueryData<ProfileUser>(PROFILE_QUERY_KEY, (current) =>
      current
        ? {
            ...current,
            activitySummary: {
              ...current.activitySummary,
              postCount: Math.max(0, current.activitySummary.postCount - 1),
            },
          }
        : current,
    );
    void queryClient.invalidateQueries({ queryKey: MY_POSTS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
    markMyPostsDeleteSuccess();
    router.back();
  }

  return (
    <section className="-mx-5 -mt-5 bg-white">
      <header className="sticky top-0 z-20 grid h-14 grid-cols-[56px_minmax(0,1fr)_56px] items-center border-b border-[#dbdbdb] bg-white">
        <button
          aria-label="뒤로가기"
          className="flex h-14 w-14 items-center justify-center text-[#121212] active:bg-neutral-100"
          onClick={() => router.back()}
          type="button"
        >
          <ArrowLeft aria-hidden="true" size={22} strokeWidth={1.8} />
        </button>
        <span aria-hidden="true" />
        {query.data && isAuthenticated ? (
          <PostMoreMenu
            editHref={
              source === "my-posts"
                ? `/community/${query.data.id}/edit?from=my-posts`
                : undefined
            }
            fullHeightAction
            menuAlignEndOffset={16}
            mode={query.data.isOwner ? "owner" : "report"}
            onDeleteSuccess={source === "my-posts" ? handleDeleteSuccess : undefined}
            postId={query.data.id}
            reportHref={
              query.data.isOwner
                ? undefined
                : buildReviewReportHref(query.data.id, "detail")
            }
          />
        ) : (
          <div className="h-14 w-14" />
        )}
      </header>

      {query.isLoading ? <PostDetailSkeleton /> : null}

      {query.isError ? (
        <div className="px-5 py-20 text-center">
          <p className="text-sm font-bold text-[#121212]">
            {isNotFound
              ? "삭제되었거나 존재하지 않는 리뷰입니다."
              : "리뷰를 불러오지 못했습니다."}
          </p>
          {isNotFound ? (
            <Link
              className="mt-4 inline-flex h-10 items-center justify-center px-4 text-sm font-bold text-[#121212] underline underline-offset-4"
              href="/community"
            >
              리뷰 목록으로 이동
            </Link>
          ) : (
            <button
              className="mt-4 h-10 px-4 text-sm font-bold text-[#121212] underline underline-offset-4"
              onClick={() => query.refetch()}
              type="button"
            >
              다시 시도
            </button>
          )}
        </div>
      ) : null}

      {query.data ? (
        <article className="pb-7">
          <div className="flex min-h-[72px] items-center border-b border-[#dbdbdb] px-4 py-2.5">
            <span
              aria-hidden="true"
              className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full bg-[#ededed] text-[#777777]"
            >
              <UserRound size={24} strokeWidth={1.7} />
            </span>
            <div className="ml-2 min-w-0">
              <p className="mb-[3px] break-words text-base font-normal leading-6 text-[#121212]">
                {query.data.author.anonymousId}
              </p>
              <time
                className="block text-xs font-normal leading-[18px] text-[#777777]"
                dateTime={query.data.createdAt}
              >
                {formatDetailDate(query.data.createdAt)}
              </time>
            </div>
          </div>

          <div className="px-4 pt-5">
            {hasTaxonomy ? (
              <p className="mb-2 text-sm font-normal leading-5 text-[#777777]">
                {query.data.region?.name}
                {query.data.region && query.data.category ? (
                  <span aria-hidden="true"> · </span>
                ) : null}
                {query.data.category?.name}
              </p>
            ) : null}
            <h1
              className={`break-words text-[22px] font-bold leading-[1.35] text-[#121212] ${
                showMenuCopy ? "mb-[18px]" : "mb-7"
              }`}
            >
              {displayStoreName}
            </h1>
            {showMenuCopy ? (
              <p className="mb-7 whitespace-pre-wrap break-words text-[17px] font-normal leading-[1.55] text-[#121212]">
                {query.data.menuName}
              </p>
            ) : null}

            {goodPointLabels.length ? (
              <section className="mb-7">
                <h2 className="mb-2.5 inline-block bg-[#ddf3ff] px-2 py-[5px] text-[13px] font-normal leading-[18px] text-[#3399ff]">
                  좋았던 점
                </h2>
                <p className="whitespace-pre-wrap break-words text-base font-normal leading-[1.6] text-[#121212]">
                  {goodPointLabels.join(", ")}
                </p>
              </section>
            ) : null}

            {badPointLabels.length ? (
              <section className="mb-7">
                <h2 className="mb-2.5 inline-block bg-[#fff0f2] px-2 py-[5px] text-[13px] font-normal leading-[18px] text-[#f44250]">
                  아쉬웠던 점
                </h2>
                <p className="whitespace-pre-wrap break-words text-base font-normal leading-[1.6] text-[#121212]">
                  {badPointLabels.join(", ")}
                </p>
              </section>
            ) : null}

            {!goodPointLabels.length && !badPointLabels.length ? (
              <p className="mb-7 whitespace-pre-wrap break-words text-base font-normal leading-[1.6] text-[#121212]">
                {query.data.content}
              </p>
            ) : null}

            {query.data.overallReview ? (
              <section className="mb-7">
                <h2 className="mb-2.5 inline-block bg-[#f3f3f3] px-2 py-[5px] text-[13px] font-normal leading-[18px] text-[#999999]">
                  남기고 싶은 나의 한마디
                </h2>
                <p className="whitespace-pre-wrap break-words text-base font-normal leading-[1.6] text-[#121212]">
                  {query.data.overallReview}
                </p>
              </section>
            ) : null}

            <div className="border-t border-[#aaaaaa]">
              <PostActionSummary
                isLiked={query.data.isLiked}
                likeCount={query.data.likeCount}
                postId={query.data.id}
                viewCount={query.data.viewCount}
              />
            </div>
          </div>
        </article>
      ) : null}
    </section>
  );
}
