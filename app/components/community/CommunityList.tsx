"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Eye, Heart, Plus, Search } from "lucide-react";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

type SortValue = "latest" | "likes" | "views";

type Post = {
  id: string;
  title: string;
  content: string;
  view_count: number;
  like_count: number;
};

type PostsResponse = {
  success: boolean;
  data: {
    posts: Post[];
    page: number;
    limit: number;
    totalCount: number;
    hasMore: boolean;
  } | null;
  message: string;
  code?: string;
};

const SORT_OPTIONS: { label: string; value: SortValue }[] = [
  { label: "최신순", value: "latest" },
  { label: "좋아요순", value: "likes" },
  { label: "조회수순", value: "views" },
];

async function fetchPosts({
  pageParam,
  search,
  sort,
}: {
  pageParam: number;
  search: string;
  sort: SortValue;
}) {
  const params = new URLSearchParams({
    page: String(pageParam),
    limit: "10",
    sort,
  });

  if (search.trim()) {
    params.set("search", search.trim());
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
    <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-5">
      <div className="h-5 w-3/4 rounded bg-neutral-100" />
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-neutral-100" />
        <div className="h-4 w-2/3 rounded bg-neutral-100" />
      </div>
      <div className="h-4 w-24 rounded bg-neutral-100" />
    </div>
  );
}

export default function CommunityList() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortValue>("latest");

  const query = useInfiniteQuery({
    queryKey: ["posts", search, sort],
    queryFn: ({ pageParam }) => fetchPosts({ pageParam, search, sort }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
  });

  const posts = useMemo(
    () => query.data?.pages.flatMap((page) => page.posts) ?? [],
    [query.data],
  );
  const hasNoPosts = !query.isLoading && posts.length === 0;
  const isSearching = Boolean(search);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  return (
    <section className="relative space-y-5">
      <form className="space-y-3" onSubmit={handleSearch}>
        <div className="flex h-12 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4">
          <Search aria-hidden="true" className="shrink-0 text-neutral-400" size={20} />
          <input
            className="min-w-0 flex-1 border-0 bg-transparent text-base text-neutral-950 outline-none placeholder:text-neutral-400"
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="제목과 내용을 검색해 보세요"
            type="search"
            value={searchInput}
          />
          <button className="text-sm font-semibold text-neutral-950" type="submit">
            검색
          </button>
        </div>

        <select
          className="h-11 w-full rounded-lg border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-950 outline-none"
          onChange={(event) => setSort(event.target.value as SortValue)}
          value={sort}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </form>

      {query.isLoading ? (
        <div className="space-y-3">
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </div>
      ) : null}

      {query.isError ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-5 text-center">
          <p className="text-sm font-semibold text-neutral-950">게시글을 불러오지 못했습니다.</p>
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
          {posts.map((post) => (
            <Link
              className="block rounded-lg border border-neutral-200 bg-white p-5 active:bg-neutral-50"
              href={`/community/${post.id}`}
              key={post.id}
            >
              <h2 className="line-clamp-2 break-all text-lg font-bold leading-7 text-neutral-950">
                {post.title}
              </h2>
              <p className="mt-2 line-clamp-2 break-all text-sm leading-6 text-neutral-600">
                {post.content}
              </p>
              <div className="mt-4 flex items-center gap-4 text-sm font-medium text-neutral-500">
                <span className="inline-flex items-center gap-1">
                  <Heart aria-hidden="true" size={16} />
                  {post.like_count}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Eye aria-hidden="true" size={16} />
                  {post.view_count}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : null}

      {hasNoPosts ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-neutral-500">
            {isSearching ? "검색 결과가 없습니다." : "아직 등록된 음식 리뷰가 없습니다."}
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

      <Link
        aria-label="글쓰기"
        className="fixed bottom-20 left-1/2 z-20 ml-[115px] flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-neutral-950 text-white shadow-lg"
        href="/community/write"
      >
        <Plus color="#fff" aria-hidden="true" size={24} />
      </Link>
    </section>
  );
}
