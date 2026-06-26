"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { PostCategory, PostsPage } from "@/app/types/post";
import PostRows from "./PostRows";

type PostsResponse = {
  success: boolean;
  data: PostsPage | null;
  message: string;
};

type CategoriesResponse = {
  success: boolean;
  data: {
    categories: PostCategory[];
  } | null;
  message: string;
};

async function fetchCategories() {
  const response = await fetch("/api/categories");
  const result = (await response.json()) as CategoriesResponse;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.message || "카테고리 목록을 불러오지 못했습니다.");
  }

  return result.data.categories;
}

async function fetchPosts({ pageParam, categorySlug }: { pageParam: number; categorySlug: string }) {
  const params = new URLSearchParams({
    page: String(pageParam),
    limit: "10",
    sort: "latest",
  });

  if (categorySlug) {
    params.set("category", categorySlug);
  }

  const response = await fetch(`/api/posts?${params.toString()}`);
  const result = (await response.json()) as PostsResponse;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.message || "게시글을 불러오지 못했습니다.");
  }

  return result.data;
}

function PostSkeleton() {
  return (
    <div className="space-y-3 border-b border-neutral-200 py-5">
      <div className="h-4 w-28 rounded bg-neutral-100" />
      <div className="h-6 w-4/5 rounded bg-neutral-100" />
      <div className="h-4 w-full rounded bg-neutral-100" />
      <div className="h-4 w-24 rounded bg-neutral-100" />
    </div>
  );
}

export default function CommunityList({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [categorySlug, setCategorySlug] = useState("");
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });
  const postsQuery = useInfiniteQuery({
    queryKey: ["posts", "latest", categorySlug],
    queryFn: ({ pageParam }) => fetchPosts({ pageParam, categorySlug }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
  });

  const posts = useMemo(
    () => postsQuery.data?.pages.flatMap((page) => page.posts) ?? [],
    [postsQuery.data],
  );
  const hasNoPosts = !postsQuery.isLoading && !postsQuery.isError && posts.length === 0;

  return (
    <section className="relative">
      <div className="pb-4">
        {categoriesQuery.isLoading ? (
          <div className="flex gap-2">
            <div className="h-9 w-14 rounded-full bg-neutral-100" />
            <div className="h-9 w-14 rounded-full bg-neutral-100" />
            <div className="h-9 w-14 rounded-full bg-neutral-100" />
          </div>
        ) : null}

        {categoriesQuery.isError ? (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-neutral-100 px-4 py-3">
            <p className="text-sm font-semibold text-neutral-950">카테고리 목록을 불러오지 못했습니다.</p>
            <button
              className="shrink-0 text-sm font-bold text-neutral-950 underline"
              onClick={() => categoriesQuery.refetch()}
              type="button"
            >
              다시 시도
            </button>
          </div>
        ) : null}

        {categoriesQuery.data ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label="게시글 카테고리 필터">
            <button
              aria-pressed={!categorySlug}
              className={`h-9 rounded-full border px-4 text-sm font-semibold ${
                !categorySlug
                  ? "border-neutral-950 bg-neutral-950 text-white"
                  : "border-neutral-300 bg-white text-neutral-700 active:bg-neutral-100"
              }`}
              onClick={() => setCategorySlug("")}
              type="button"
            >
              전체
            </button>
            {categoriesQuery.data.map((category) => {
              const isSelected = categorySlug === category.slug;

              return (
                <button
                  aria-pressed={isSelected}
                  className={`h-9 rounded-full border px-4 text-sm font-semibold ${
                    isSelected
                      ? "border-neutral-950 bg-neutral-950 text-white"
                      : "border-neutral-300 bg-white text-neutral-700 active:bg-neutral-100"
                  }`}
                  key={category.id}
                  onClick={() => setCategorySlug(category.slug)}
                  type="button"
                >
                  {category.name}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {postsQuery.isLoading ? (
        <div>
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </div>
      ) : null}

      {postsQuery.isError ? (
        <div className="py-10 text-center">
          <p className="text-sm font-semibold text-neutral-950">게시글을 불러오지 못했습니다.</p>
          <button
            className="mt-4 h-10 rounded-lg bg-neutral-950 px-4 text-sm font-semibold text-white"
            onClick={() => postsQuery.refetch()}
            type="button"
          >
            다시 시도
          </button>
        </div>
      ) : null}

      {!postsQuery.isLoading && !postsQuery.isError ? (
        <PostRows
          isAuthenticated={isAuthenticated}
          onDeleteSuccess={() => postsQuery.refetch()}
          posts={posts}
        />
      ) : null}

      {hasNoPosts ? (
        <div className="py-12 text-center">
          <p className="text-sm font-semibold text-neutral-500">
            아직 등록된 음식 리뷰가 없습니다.
          </p>
        </div>
      ) : null}

      {postsQuery.hasNextPage ? (
        <button
          className="mt-5 h-12 w-full rounded-lg border border-neutral-200 bg-white text-base font-semibold text-neutral-950 disabled:text-neutral-400"
          disabled={postsQuery.isFetchingNextPage}
          onClick={() => postsQuery.fetchNextPage()}
          type="button"
        >
          {postsQuery.isFetchingNextPage ? "불러오는 중" : "더보기"}
        </button>
      ) : null}

      <div className="pointer-events-none fixed bottom-20 left-1/2 z-20 flex w-full max-w-[375px] -translate-x-1/2 justify-end px-5">
        <Link
          aria-label="글쓰기"
          className="pointer-events-auto inline-flex h-11 items-center gap-1 rounded-full bg-neutral-950 px-4 text-sm font-semibold text-white shadow-lg active:bg-neutral-800"
          href="/community/write"
        >
          <Plus aria-hidden="true" size={18} />
          글쓰기
        </Link>
      </div>
    </section>
  );
}
