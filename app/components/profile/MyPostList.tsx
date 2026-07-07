"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Eye, Heart } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

type MyPost = {
  id: string;
  title: string;
  content: string;
  menuName: string;
  goodPoints: string[];
  badPoints: string[];
  goodPointLabels: string[];
  badPointLabels: string[];
  overallReview: string | null;
  view_count: number;
  like_count: number;
  created_at: string;
};

type MyPostsResponse = {
  success: boolean;
  data: {
    posts: MyPost[];
    page: number;
    limit: number;
    totalCount: number;
    hasMore: boolean;
  } | null;
  message: string;
  code?: string;
};

async function fetchMyPosts({ pageParam }: { pageParam: number }) {
  const params = new URLSearchParams({
    page: String(pageParam),
    limit: "10",
  });
  const response = await fetch(`/api/my/posts?${params.toString()}`);
  const result = (await response.json()) as MyPostsResponse;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.message || "내가 작성한 게시글을 불러오지 못했습니다.");
  }

  return result.data;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function PostSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-5">
      <div className="h-5 w-3/4 rounded bg-neutral-100" />
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-neutral-100" />
        <div className="h-4 w-2/3 rounded bg-neutral-100" />
      </div>
      <div className="h-4 w-32 rounded bg-neutral-100" />
    </div>
  );
}

export default function MyPostList() {
  const query = useInfiniteQuery({
    queryKey: ["my-posts"],
    queryFn: ({ pageParam }) => fetchMyPosts({ pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
  });
  const posts = useMemo(
    () => query.data?.pages.flatMap((page) => page.posts) ?? [],
    [query.data],
  );
  const hasNoPosts = !query.isLoading && posts.length === 0;

  return (
    <section className="space-y-5">
      {query.isLoading ? (
        <div className="space-y-3">
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </div>
      ) : null}

      {query.isError ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-5 text-center">
          <p className="text-sm font-semibold text-neutral-950">
            내가 작성한 게시글을 불러오지 못했습니다.
          </p>
          <button
            className="mt-4 h-10 rounded-lg bg-neutral-950 px-4 text-sm font-semibold text-white"
            onClick={() => query.refetch()}
            type="button"
          >
            다시 시도
          </button>
        </div>
      ) : null}

      {!query.isLoading && !query.isError ? (
        <div className="space-y-3">
          {posts.map((post) => {
            const previewText = post.goodPointLabels.length
              ? post.goodPointLabels.join(", ")
              : post.content;

            return (
              <Link
                className="block rounded-lg border border-neutral-200 bg-white p-5 active:bg-neutral-50"
                href={`/community/${post.id}`}
                key={post.id}
              >
                <h2 className="line-clamp-2 break-all text-lg font-bold leading-7 text-neutral-950">
                  {post.menuName}
                </h2>
                <p className="mt-2 line-clamp-2 break-all text-sm leading-6 text-neutral-600">
                  {previewText}
                </p>
                {post.overallReview ? (
                  <p className="mt-2 line-clamp-2 break-all text-sm leading-6 text-neutral-800">
                    {post.overallReview}
                  </p>
                ) : null}
                <div className="mt-4 flex items-center justify-between gap-4 text-sm font-medium text-neutral-500">
                  <div className="flex items-center gap-4">
                    <span className="inline-flex items-center gap-1">
                      <Heart aria-hidden="true" size={16} />
                      {post.like_count}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Eye aria-hidden="true" size={16} />
                      {post.view_count}
                    </span>
                  </div>
                  <time dateTime={post.created_at}>{formatDate(post.created_at)}</time>
                </div>
              </Link>
            );
          })}
        </div>
      ) : null}

      {hasNoPosts ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-neutral-500">
            작성한 게시글이 없습니다.
          </p>
        </div>
      ) : null}

      {query.hasNextPage ? (
        <button
          className="h-12 w-full rounded-lg border border-neutral-200 bg-white text-base font-semibold text-neutral-950 disabled:text-neutral-400"
          disabled={query.isFetchingNextPage}
          onClick={() => query.fetchNextPage()}
          type="button"
        >
          {query.isFetchingNextPage ? "불러오는 중" : "더보기"}
        </button>
      ) : null}
    </section>
  );
}
