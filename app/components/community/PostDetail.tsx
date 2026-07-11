"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PostMoreMenu from "./PostMoreMenu";
import PostActionSummary from "./PostActionSummary";

type PostDetailData = {
  id: string;
  title: string;
  content: string;
  menuName: string;
  goodPoints: string[];
  badPoints: string[];
  goodPointLabels: string[];
  badPointLabels: string[];
  overallReview: string | null;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    anonymousId: string;
  };
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
  isOwner: boolean;
  isLiked: boolean;
  requiresCategorySelection: boolean;
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
    const error = new Error(result.message || "게시글을 불러오지 못했습니다.");
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
    <div className="space-y-7">
      <div className="space-y-2">
        <div className="h-5 w-24 rounded bg-neutral-100" />
        <div className="h-4 w-20 rounded bg-neutral-100" />
      </div>
      <div className="border-t border-neutral-200 pt-5">
        <div className="h-8 w-14 rounded-full bg-neutral-100" />
        <div className="mt-4 h-6 w-4/5 rounded bg-neutral-100" />
      </div>
      <div className="space-y-3">
        <div className="h-4 w-20 rounded bg-neutral-100" />
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded-full bg-neutral-100" />
          <div className="h-9 w-20 rounded-full bg-neutral-100" />
        </div>
      </div>
    </div>
  );
}

export default function PostDetail({
  postId,
  isAuthenticated,
}: {
  postId: string;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const query = useQuery({
    queryKey: ["post", postId],
    queryFn: () => fetchPostDetail(postId),
  });
  const errorName = query.error instanceof Error ? query.error.name : "";
  const isNotFound = errorName === "POST_NOT_FOUND";
  const goodPointLabels = query.data?.goodPointLabels ?? [];
  const badPointLabels = query.data?.badPointLabels ?? [];

  return (
    <section className="space-y-6">
      <header className="-mx-5 -mt-5 flex h-14 items-center justify-between border-b border-neutral-100 bg-white px-3">
        <button
          aria-label="뒤로가기"
          className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-950 active:bg-neutral-100"
          onClick={() => router.back()}
          type="button"
        >
          <ArrowLeft aria-hidden="true" size={22} />
        </button>
        <h1 className="text-base font-bold text-neutral-950">글 내용</h1>
        {query.data ? (
          <PostMoreMenu
            isAuthenticated={isAuthenticated}
            isOwner={query.data.isOwner}
            postId={query.data.id}
            requiresCategorySelection={query.data.requiresCategorySelection}
          />
        ) : (
          <div className="h-11 w-11" />
        )}
      </header>

      {query.isLoading ? <PostDetailSkeleton /> : null}

      {query.isError ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center">
          <p className="text-sm font-semibold text-neutral-950">
            {isNotFound ? "존재하지 않는 게시글입니다." : "게시글을 불러오지 못했습니다."}
          </p>
          {isNotFound ? (
            <Link
              className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-neutral-950 px-4 text-sm font-semibold text-white"
              href="/community"
            >
              목록으로 이동
            </Link>
          ) : (
            <button
              className="mt-4 h-10 rounded-lg bg-neutral-950 px-4 text-sm font-semibold text-white"
              onClick={() => query.refetch()}
              type="button"
            >
              다시 시도
            </button>
          )}
        </div>
      ) : null}

      {query.data ? (
        <article className="space-y-7">
          <div className="space-y-1">
            <p className="break-all text-base font-bold text-neutral-950">
              {query.data.author.anonymousId}
            </p>
            <time className="block text-xs font-medium text-neutral-500" dateTime={query.data.createdAt}>
              {formatDetailDate(query.data.createdAt)}
            </time>
          </div>

          <div className="space-y-4 border-t border-neutral-300 pt-5">
            {query.data.category ? (
              <span className="inline-flex h-8 items-center rounded-full bg-neutral-100 px-3 text-sm font-semibold text-neutral-950">
                {query.data.category.name}
              </span>
            ) : null}
            <h2 className="break-all text-xl font-bold leading-8 text-neutral-950">
              {query.data.menuName}
            </h2>
          </div>
          {goodPointLabels.length || badPointLabels.length ? (
            <div className="space-y-8">
              <section className="space-y-4">
                <h3 className="text-sm font-bold text-neutral-950">좋았던 점</h3>
                <div className="flex flex-wrap gap-2">
                  {goodPointLabels.map((label) => (
                    <span
                      className="inline-flex min-h-9 items-center rounded-full bg-neutral-950 px-3 py-1 text-sm font-bold text-white"
                      key={label}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </section>
              <section className="space-y-4">
                <h3 className="text-sm font-bold text-neutral-950">아쉬웠던 점</h3>
                <div className="flex flex-wrap gap-2">
                  {badPointLabels.map((label) => (
                    <span
                      className="inline-flex min-h-9 items-center rounded-full bg-neutral-100 px-3 py-1 text-sm font-bold text-neutral-950"
                      key={label}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-all text-base leading-8 text-neutral-800">
              {query.data.content}
            </p>
          )}
          {query.data.overallReview ? (
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-neutral-950">남기고 싶은 나의 한마디</h3>
              <p className="whitespace-pre-wrap break-all text-base leading-8 text-neutral-800">
                {query.data.overallReview}
              </p>
            </section>
          ) : null}
          <div className="border-t border-neutral-300 pt-4">
            <PostActionSummary
              isLiked={query.data.isLiked}
              likeCount={query.data.likeCount}
              postId={query.data.id}
              viewCount={query.data.viewCount}
            />
          </div>
        </article>
      ) : null}

    </section>
  );
}
