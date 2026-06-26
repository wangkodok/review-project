"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import PageBackHeader from "@/app/components/common/PageBackHeader";
import type { PostsPage } from "@/app/types/post";
import PostRows from "./PostRows";

type SearchResponse = {
  success: boolean;
  data: PostsPage | null;
  message: string;
};

type SearchHistory = {
  id: string;
  keyword: string;
  createdAt: string;
  updatedAt: string;
};

type SearchHistoriesResponse = {
  success: boolean;
  data: { histories: SearchHistory[] } | null;
  message: string;
};

async function fetchSearchPosts({ pageParam, keyword }: { pageParam: number; keyword: string }) {
  const params = new URLSearchParams({
    q: keyword,
    page: String(pageParam),
    limit: "10",
  });
  const response = await fetch(`/api/search/posts?${params.toString()}`);
  const result = (await response.json()) as SearchResponse;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.message || "게시글을 검색하지 못했습니다.");
  }

  return result.data;
}

async function fetchSearchHistories() {
  const response = await fetch("/api/search/histories");
  const result = (await response.json()) as SearchHistoriesResponse;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.message || "최근 검색어를 불러오지 못했습니다.");
  }

  return result.data.histories;
}

async function saveSearchHistory(keyword: string) {
  await fetch("/api/search/histories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keyword }),
  });
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

export default function SearchPosts({ isAuthenticated }: { isAuthenticated: boolean }) {
  const router = useRouter();
  const [inputValue, setInputValue] = useState("");
  const [submittedKeyword, setSubmittedKeyword] = useState("");
  const [searchVersion, setSearchVersion] = useState(0);
  const [inputError, setInputError] = useState("");
  const savedSearchVersion = useRef(0);
  const historiesQuery = useQuery({
    queryKey: ["search-histories"],
    queryFn: fetchSearchHistories,
    enabled: isAuthenticated,
  });
  const searchQuery = useInfiniteQuery({
    queryKey: ["search-posts", submittedKeyword, searchVersion],
    queryFn: ({ pageParam }) => fetchSearchPosts({ pageParam, keyword: submittedKeyword }),
    initialPageParam: 1,
    enabled: searchVersion > 0 && Boolean(submittedKeyword),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
  });
  const posts = useMemo(
    () => searchQuery.data?.pages.flatMap((page) => page.posts) ?? [],
    [searchQuery.data],
  );

  useEffect(() => {
    if (
      !isAuthenticated ||
      !searchQuery.isSuccess ||
      searchVersion === 0 ||
      savedSearchVersion.current === searchVersion
    ) {
      return;
    }

    savedSearchVersion.current = searchVersion;
    void saveSearchHistory(submittedKeyword).then(() => historiesQuery.refetch()).catch(() => undefined);
  }, [historiesQuery, isAuthenticated, searchQuery.isSuccess, searchVersion, submittedKeyword]);

  function runSearch(keyword: string) {
    const trimmedKeyword = keyword.trim();

    if (trimmedKeyword.length < 1 || trimmedKeyword.length > 30) {
      setInputError("검색어는 1~30자여야 합니다.");
      return;
    }

    setInputError("");
    setInputValue(trimmedKeyword);
    setSubmittedKeyword(trimmedKeyword);
    setSearchVersion((previous) => previous + 1);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runSearch(inputValue);
  }

  async function handleDeleteHistory(historyId: string) {
    const response = await fetch(`/api/search/histories/${historyId}`, { method: "DELETE" });

    if (response.ok) {
      await historiesQuery.refetch();
    }
  }

  async function handleClearHistories() {
    const response = await fetch("/api/search/histories", { method: "DELETE" });

    if (response.ok) {
      await historiesQuery.refetch();
    }
  }

  const hasSearched = searchVersion > 0;

  return (
    <section>
      <PageBackHeader onBack={() => router.replace("/community")} title="검색" />

      <form className="mt-5" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="community-search">
          게시글 검색
        </label>
        <div className="flex h-12 items-center rounded-lg border border-neutral-300 bg-white pr-1 focus-within:border-neutral-950">
          <input
            className="h-full min-w-0 flex-1 rounded-lg px-4 text-base text-neutral-950 outline-none placeholder:text-neutral-400"
            id="community-search"
            maxLength={30}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="검색어를 입력하세요."
            value={inputValue}
          />
          <button
            aria-label="검색"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-neutral-950 active:bg-neutral-100"
            type="submit"
          >
            <Search aria-hidden="true" size={20} />
          </button>
        </div>
        {inputError ? <p className="mt-2 text-sm font-medium text-red-600">{inputError}</p> : null}
      </form>

      {!hasSearched ? (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-neutral-950">최근 검색어</h2>
            {isAuthenticated && historiesQuery.data?.length ? (
              <button
                className="text-sm font-semibold text-neutral-600 underline"
                onClick={handleClearHistories}
                type="button"
              >
                전체 삭제
              </button>
            ) : null}
          </div>

          {!isAuthenticated ? (
            <p className="mt-4 text-sm leading-6 text-neutral-500">
              로그인하면 최근 검색어를 저장할 수 있습니다.
            </p>
          ) : null}

          {isAuthenticated && historiesQuery.isLoading ? (
            <div className="mt-4 space-y-3">
              <div className="h-5 w-28 rounded bg-neutral-100" />
              <div className="h-5 w-20 rounded bg-neutral-100" />
            </div>
          ) : null}

          {isAuthenticated && historiesQuery.data?.length ? (
            <ul className="mt-3 divide-y divide-neutral-100">
              {historiesQuery.data.map((history) => (
                <li className="flex min-h-12 items-center gap-3" key={history.id}>
                  <button
                    className="min-w-0 flex-1 truncate text-left text-sm font-medium text-neutral-800"
                    onClick={() => runSearch(history.keyword)}
                    type="button"
                  >
                    {history.keyword}
                  </button>
                  <button
                    aria-label={`${history.keyword} 최근 검색어 삭제`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-500 active:bg-neutral-100"
                    onClick={() => handleDeleteHistory(history.id)}
                    type="button"
                  >
                    <X aria-hidden="true" size={18} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {isAuthenticated && !historiesQuery.isLoading && !historiesQuery.data?.length ? (
            <p className="mt-4 text-sm text-neutral-500">최근 검색어가 없습니다.</p>
          ) : null}
        </section>
      ) : null}

      {hasSearched && searchQuery.isLoading ? (
        <div className="mt-5">
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </div>
      ) : null}

      {hasSearched && searchQuery.isError ? (
        <div className="py-10 text-center">
          <p className="text-sm font-semibold text-neutral-950">게시글을 검색하지 못했습니다.</p>
          <button
            className="mt-4 h-10 rounded-lg bg-neutral-950 px-4 text-sm font-semibold text-white"
            onClick={() => searchQuery.refetch()}
            type="button"
          >
            다시 시도
          </button>
        </div>
      ) : null}

      {hasSearched && !searchQuery.isLoading && !searchQuery.isError ? (
        <>
          {posts.length ? (
            <PostRows
              isAuthenticated={isAuthenticated}
              onDeleteSuccess={() => searchQuery.refetch()}
              posts={posts}
            />
          ) : null}
          {!posts.length ? (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold text-neutral-500">검색 결과가 없습니다.</p>
            </div>
          ) : null}
          {searchQuery.hasNextPage ? (
            <button
              className="mt-5 h-12 w-full rounded-lg border border-neutral-200 bg-white text-base font-semibold text-neutral-950 disabled:text-neutral-400"
              disabled={searchQuery.isFetchingNextPage}
              onClick={() => searchQuery.fetchNextPage()}
              type="button"
            >
              {searchQuery.isFetchingNextPage ? "불러오는 중" : "더보기"}
            </button>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
