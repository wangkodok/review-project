"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import PostRows from "@/app/components/community/PostRows";
import type { PostsPage } from "@/app/types/post";

type MyPostsResponse = {
  success: boolean;
  data: PostsPage | null;
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

function PostSkeleton() {
  return (
    <div className="space-y-3 border-b border-neutral-200 py-5">
      <div className="h-4 w-14 rounded bg-neutral-100" />
      <div className="h-6 w-4/5 rounded bg-neutral-100" />
      <div className="h-4 w-full rounded bg-neutral-100" />
      <div className="flex gap-1.5">
        <div className="h-6 w-16 rounded bg-neutral-100" />
        <div className="h-6 w-16 rounded bg-neutral-100" />
        <div className="h-6 w-16 rounded bg-neutral-100" />
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
  const hasNoPosts = !query.isLoading && !query.isError && posts.length === 0;

  return (
    <section>
      {query.isLoading ? (
        <div>
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </div>
      ) : null}

      {query.isError ? (
        <div className="py-10 text-center">
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
        <PostRows
          isAuthenticated
          onDeleteSuccess={() => query.refetch()}
          posts={posts}
        />
      ) : null}

      {hasNoPosts ? (
        <div className="py-12 text-center">
          <p className="text-sm font-semibold text-neutral-500">
            작성한 게시글이 없습니다.
          </p>
        </div>
      ) : null}

      {query.hasNextPage ? (
        <button
          className="mt-5 h-12 w-full rounded-lg border border-neutral-200 bg-white text-base font-semibold text-neutral-950 disabled:text-neutral-400"
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
