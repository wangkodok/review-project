"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PostMoreMenu from "./PostMoreMenu";
import PostActionSummary from "./PostActionSummary";
import PostMeta from "./PostMeta";

type PostDetailData = {
  id: string;
  title: string;
  content: string;
  menuName: string;
  goodPoints: string[];
  badPoints: string[];
  goodPointLabels: string[];
  badPointLabels: string[];
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

function PostDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-6 w-32 rounded bg-neutral-100" />
      <div className="space-y-3">
        <div className="h-8 w-5/6 rounded bg-neutral-100" />
        <div className="h-4 w-40 rounded bg-neutral-100" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-neutral-100" />
        <div className="h-4 w-full rounded bg-neutral-100" />
        <div className="h-4 w-2/3 rounded bg-neutral-100" />
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
        <h1 className="text-base font-bold text-neutral-950">게시글</h1>
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
        <article className="space-y-6">
          <div className="space-y-3">
            <PostMeta
              anonymousId={query.data.author.anonymousId}
              createdAt={query.data.createdAt}
            />
            {query.data.category ? (
              <span className="inline-flex h-7 items-center rounded-full bg-neutral-950 px-3 text-xs font-semibold text-white">
                {query.data.category.name}
              </span>
            ) : null}
            <h2 className="break-all text-2xl font-bold leading-9 text-neutral-950">
              {query.data.menuName}
            </h2>
          </div>
          {goodPointLabels.length || badPointLabels.length ? (
            <div className="space-y-5">
              <section className="space-y-3">
                <h3 className="text-sm font-bold text-neutral-950">좋았던 점</h3>
                <div className="flex flex-wrap gap-2">
                  {goodPointLabels.map((label) => (
                    <span
                      className="inline-flex min-h-9 items-center rounded-full bg-neutral-950 px-3 py-1 text-sm font-semibold text-white"
                      key={label}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </section>
              <section className="space-y-3">
                <h3 className="text-sm font-bold text-neutral-950">아쉬웠던 점</h3>
                <div className="flex flex-wrap gap-2">
                  {badPointLabels.map((label) => (
                    <span
                      className="inline-flex min-h-9 items-center rounded-full bg-neutral-100 px-3 py-1 text-sm font-semibold text-neutral-700"
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
          <PostActionSummary
            isLiked={query.data.isLiked}
            likeCount={query.data.likeCount}
            postId={query.data.id}
            viewCount={query.data.viewCount}
          />
        </article>
      ) : null}

    </section>
  );
}
