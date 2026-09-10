"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ChevronDown, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import PageBackHeader from "@/app/components/common/PageBackHeader";
import type { PostCategory, PostRegion, PostsPage } from "@/app/types/post";
import PostRows from "./PostRows";
import ReviewListControls, {
  ReviewListSkeleton,
  type ReviewSortValue,
} from "./ReviewListControls";
import ReviewPickerDialog from "./ReviewPickerDialog";

type PickerKind = "region" | "category" | null;

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

type CategoriesResponse = {
  success: boolean;
  data: { categories: PostCategory[] } | null;
  message: string;
};

type RegionsResponse = {
  success: boolean;
  data: { regions: PostRegion[] } | null;
  message: string;
};

type SearchStateSnapshot = {
  inputValue: string;
  submittedKeyword: string;
  searchVersion: number;
  sort: ReviewSortValue;
  categorySlug: string;
  regionSlug: string;
  deletedPostIds: string[];
  scrollY: number;
};

const SEARCH_HISTORY_STATE_KEY = "__reviewSearchState";
const SEARCH_QUERY_CACHE_TIME = 30 * 60 * 1000;

function isReviewSortValue(value: unknown): value is ReviewSortValue {
  return value === "latest" || value === "likes" || value === "views";
}

function readSearchState(): SearchStateSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = (window.history.state as Record<string, unknown> | null)?.[
    SEARCH_HISTORY_STATE_KEY
  ];

  if (!value || typeof value !== "object") {
    return null;
  }

  const snapshot = value as Partial<SearchStateSnapshot>;

  if (
    typeof snapshot.inputValue !== "string" ||
    typeof snapshot.submittedKeyword !== "string" ||
    typeof snapshot.searchVersion !== "number" ||
    !Number.isSafeInteger(snapshot.searchVersion) ||
    snapshot.searchVersion < 0 ||
    !isReviewSortValue(snapshot.sort) ||
    typeof snapshot.categorySlug !== "string" ||
    typeof snapshot.regionSlug !== "string" ||
    !Array.isArray(snapshot.deletedPostIds) ||
    !snapshot.deletedPostIds.every((id) => typeof id === "string") ||
    typeof snapshot.scrollY !== "number" ||
    !Number.isFinite(snapshot.scrollY) ||
    snapshot.scrollY < 0
  ) {
    return null;
  }

  return snapshot as SearchStateSnapshot;
}

function writeSearchState(snapshot: SearchStateSnapshot) {
  const currentState = (window.history.state as Record<string, unknown> | null) ?? {};
  window.history.replaceState(
    { ...currentState, [SEARCH_HISTORY_STATE_KEY]: snapshot },
    "",
  );
}

function clearSearchState() {
  const currentState = (window.history.state as Record<string, unknown> | null) ?? {};
  const nextState = { ...currentState };
  delete nextState[SEARCH_HISTORY_STATE_KEY];
  window.history.replaceState(nextState, "");
}

async function fetchCategories() {
  const response = await fetch("/api/categories");
  const result = (await response.json()) as CategoriesResponse;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.message || "카테고리 목록을 불러오지 못했습니다.");
  }

  return result.data.categories;
}

async function fetchRegions() {
  const response = await fetch("/api/regions");
  const result = (await response.json()) as RegionsResponse;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.message || "지역 목록을 불러오지 못했습니다.");
  }

  return result.data.regions;
}

async function fetchSearchPosts({
  pageParam,
  keyword,
  sort,
  categorySlug,
  regionSlug,
}: {
  pageParam: number;
  keyword: string;
  sort: ReviewSortValue;
  categorySlug: string;
  regionSlug: string;
}) {
  const params = new URLSearchParams({
    q: keyword,
    page: String(pageParam),
    limit: "10",
    sort,
  });

  if (categorySlug) {
    params.set("category", categorySlug);
  }

  if (regionSlug) {
    params.set("region", regionSlug);
  }

  const response = await fetch(`/api/search/posts?${params.toString()}`);
  const result = (await response.json()) as SearchResponse;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.message || "리뷰를 검색하지 못했습니다.");
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
  const response = await fetch("/api/search/histories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keyword }),
  });

  if (!response.ok) {
    throw new Error("최근 검색어를 저장하지 못했습니다.");
  }
}

export default function SearchPosts({ isAuthenticated }: { isAuthenticated: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const savedSearchVersion = useRef(0);
  const restoreScrollYRef = useRef<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [submittedKeyword, setSubmittedKeyword] = useState("");
  const [searchVersion, setSearchVersion] = useState(0);
  const [sort, setSort] = useState<ReviewSortValue>("latest");
  const [categorySlug, setCategorySlug] = useState("");
  const [regionSlug, setRegionSlug] = useState("");
  const [pickerKind, setPickerKind] = useState<PickerKind>(null);
  const [inputError, setInputError] = useState("");
  const [historyActionError, setHistoryActionError] = useState("");
  const [deletedPostIds, setDeletedPostIds] = useState<Set<string>>(() => new Set());
  const [successMessage, setSuccessMessage] = useState("");
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });
  const regionsQuery = useQuery({
    queryKey: ["regions"],
    queryFn: fetchRegions,
  });
  const historiesQuery = useQuery({
    queryKey: ["search-histories"],
    queryFn: fetchSearchHistories,
    enabled: isAuthenticated,
  });
  const searchQuery = useInfiniteQuery({
    queryKey: [
      "search-posts",
      submittedKeyword,
      searchVersion,
      sort,
      regionSlug,
      categorySlug,
    ],
    queryFn: ({ pageParam }) =>
      fetchSearchPosts({
        pageParam,
        keyword: submittedKeyword,
        sort,
        categorySlug,
        regionSlug,
      }),
    initialPageParam: 1,
    enabled: isReady && searchVersion > 0 && Boolean(submittedKeyword),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    gcTime: SEARCH_QUERY_CACHE_TIME,
  });
  const loadedPosts = useMemo(
    () => searchQuery.data?.pages.flatMap((page) => page.posts) ?? [],
    [searchQuery.data],
  );
  const posts = useMemo(
    () => loadedPosts.filter((post) => !deletedPostIds.has(post.id)),
    [deletedPostIds, loadedPosts],
  );
  const deletedVisibleCount = loadedPosts.length - posts.length;
  const totalCount = Math.max(
    0,
    (searchQuery.data?.pages[0]?.totalCount ?? 0) - deletedVisibleCount,
  );
  const selectedRegion = regionsQuery.data?.find((region) => region.slug === regionSlug);
  const selectedCategory = categoriesQuery.data?.find(
    (category) => category.slug === categorySlug,
  );
  const hasSearched = searchVersion > 0;
  const hasActiveFilters = Boolean(regionSlug || categorySlug);
  const hasReferenceDataError = regionsQuery.isError || categoriesQuery.isError;

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      const snapshot = readSearchState();

      if (snapshot) {
        setInputValue(snapshot.inputValue);
        setSubmittedKeyword(snapshot.submittedKeyword);
        setSearchVersion(snapshot.searchVersion);
        setSort(snapshot.sort);
        setCategorySlug(snapshot.categorySlug);
        setRegionSlug(snapshot.regionSlug);
        setDeletedPostIds(new Set(snapshot.deletedPostIds));
        savedSearchVersion.current = snapshot.searchVersion;
        restoreScrollYRef.current = snapshot.scrollY;
      }

      setIsReady(true);
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const previousScrollY = readSearchState()?.scrollY ?? 0;
    writeSearchState({
      inputValue,
      submittedKeyword,
      searchVersion,
      sort,
      categorySlug,
      regionSlug,
      deletedPostIds: [...deletedPostIds],
      scrollY: previousScrollY,
    });
  }, [
    categorySlug,
    deletedPostIds,
    inputValue,
    isReady,
    regionSlug,
    searchVersion,
    sort,
    submittedKeyword,
  ]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    let animationFrame = 0;

    function saveScrollPosition() {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const snapshot = readSearchState();

        if (snapshot) {
          writeSearchState({ ...snapshot, scrollY: window.scrollY });
        }
      });
    }

    window.addEventListener("scroll", saveScrollPosition, { passive: true });
    return () => {
      window.removeEventListener("scroll", saveScrollPosition);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [isReady]);

  useEffect(() => {
    const scrollY = restoreScrollYRef.current;

    if (
      !isReady ||
      scrollY === null ||
      (hasSearched && (searchQuery.isLoading || searchQuery.isFetchingNextPage))
    ) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, behavior: "auto" });
      restoreScrollYRef.current = null;
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [hasSearched, isReady, posts.length, searchQuery.isFetchingNextPage, searchQuery.isLoading]);

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
    void saveSearchHistory(submittedKeyword)
      .then(() => historiesQuery.refetch())
      .catch(() => undefined);
  }, [
    historiesQuery,
    isAuthenticated,
    searchQuery.isSuccess,
    searchVersion,
    submittedKeyword,
  ]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timer = window.setTimeout(() => setSuccessMessage(""), 2400);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  function runSearch(keyword: string) {
    const trimmedKeyword = keyword.trim();

    if (trimmedKeyword.length < 1 || trimmedKeyword.length > 30) {
      setInputError("검색어를 입력해 주세요.");
      inputRef.current?.focus();
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

  function handleBack() {
    clearSearchState();
    router.replace("/community");
  }

  async function handleDeleteHistory(historyId: string) {
    setHistoryActionError("");

    try {
      const response = await fetch(`/api/search/histories/${historyId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        setHistoryActionError("최근 검색어를 삭제하지 못했어요.");
        return;
      }

      await historiesQuery.refetch();
    } catch {
      setHistoryActionError("최근 검색어를 삭제하지 못했어요.");
    }
  }

  async function handleClearHistories() {
    setHistoryActionError("");

    try {
      const response = await fetch("/api/search/histories", { method: "DELETE" });

      if (!response.ok) {
        setHistoryActionError("최근 검색어를 삭제하지 못했어요.");
        return;
      }

      await historiesQuery.refetch();
    } catch {
      setHistoryActionError("최근 검색어를 삭제하지 못했어요.");
    }
  }

  function handleDeleteSuccess(postId: string) {
    setDeletedPostIds((current) => {
      const next = new Set(current);
      next.add(postId);
      return next;
    });
    setSuccessMessage("리뷰가 삭제되었습니다.");
  }

  function clearFilters() {
    setRegionSlug("");
    setCategorySlug("");
  }

  const pickerOptions = (
    pickerKind === "region" ? regionsQuery.data ?? [] : categoriesQuery.data ?? []
  ).map((option) => ({
    id: option.slug,
    name: option.name,
  }));
  const pickerValue = pickerKind === "region" ? regionSlug : categorySlug;
  const pickerTitle = pickerKind === "region" ? "지역 선택" : "카테고리 선택";

  return (
    <section>
      <div className="sticky top-0 z-20 bg-white">
        <PageBackHeader
          backIconStrokeWidth={1.25}
          fullHeightActions
          onBack={handleBack}
          title="검색"
          titleClassName="text-[18px] font-bold leading-7 text-[#121212]"
        />

        <div className="-mx-5 bg-white px-4 py-4">
          <form onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="community-search">
              리뷰 검색어
            </label>
            <div className="grid h-12 grid-cols-[48px_minmax(0,1fr)_48px] border border-[#dbdbdb] bg-white">
              <button
                aria-label="검색"
                className="grid h-[46px] w-12 place-items-center text-[#121212] disabled:text-[#999999]"
                disabled={searchQuery.isFetching}
                type="submit"
              >
                <Search aria-hidden="true" size={20} strokeWidth={1.4} />
              </button>
              <input
                autoComplete="off"
                className="h-[46px] min-w-0 border-0 bg-transparent pr-3.5 text-base leading-6 text-[#121212] outline-none placeholder:text-[#b0b0b0] focus:outline-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-cancel-button]:appearance-none"
                enterKeyHint="search"
                id="community-search"
                maxLength={30}
                onChange={(event) => {
                  setInputValue(event.target.value);
                  setInputError("");
                }}
                placeholder="검색어를 입력해 주세요."
                ref={inputRef}
                type="search"
                value={inputValue}
              />
              {inputValue ? (
                <button
                  aria-label="검색어 지우기"
                  className="grid h-[46px] w-12 place-items-center text-[#121212]"
                  onClick={() => {
                    setInputValue("");
                    setInputError("");
                    inputRef.current?.focus();
                  }}
                  title="검색어 지우기"
                  type="button"
                >
                  <X aria-hidden="true" size={19} strokeWidth={1.4} />
                </button>
              ) : (
                <span aria-hidden="true" className="h-[46px] w-12" />
              )}
            </div>
            {inputError ? (
              <p className="mt-[7px] text-[13px] leading-[18px] text-[#e53545]" role="alert">
                {inputError}
              </p>
            ) : null}
          </form>
        </div>

        {
          hasSearched ? (
            <section
              aria-label="검색 결과 정렬과 필터"
              className="-mx-5 border-y border-[#dbdbdb] bg-white"
            >
              <ReviewListControls
                categoryActive={Boolean(categorySlug)}
                categoryDisabled={!categoriesQuery.data}
                categoryLabel={selectedCategory?.name ?? "카테고리"}
                count={totalCount}
                countLabel={
                  searchQuery.isLoading ? "검색 중" : searchQuery.isError ? "" : undefined
                }
                filtersActive={hasActiveFilters}
                onCategoryClick={() => setPickerKind("category")}
                onClearFilters={clearFilters}
                onRegionClick={() => setPickerKind("region")}
                onSortChange={setSort}
                regionActive={Boolean(regionSlug)}
                regionDisabled={!regionsQuery.data}
                regionLabel={selectedRegion?.name ?? "지역"}
                sort={sort}
              />

              {hasReferenceDataError ? (
                <div className="flex min-h-12 items-center justify-between gap-3 border-t border-neutral-100 px-4 py-2">
                  <p className="text-sm text-neutral-600">
                    필터 목록을 불러오지 못했습니다.
                  </p>
                  <button
                    className="h-9 shrink-0 px-2 text-sm font-bold text-[#121212]"
                    onClick={() => {
                      void Promise.all([
                        regionsQuery.refetch(),
                        categoriesQuery.refetch(),
                      ]);
                    }}
                    type="button"
                  >
                    다시 시도
                  </button>
                </div>
              ) : null}
            </section>
          ) : null
        }
      </div>

      {!hasSearched ? (
        <section className="-mx-5 bg-white" aria-labelledby="recent-search-title">
          <div className="flex h-14 items-center justify-between px-4">
            <h2 className="text-base font-bold leading-6 text-[#121212]" id="recent-search-title">
              최근 검색어
            </h2>
            {isAuthenticated && historiesQuery.data?.length ? (
              <button
                className="h-11 min-w-16 text-right text-base text-[#121212]"
                onClick={handleClearHistories}
                type="button"
              >
                전체삭제
              </button>
            ) : null}
          </div>

          {!isAuthenticated ? (
            <p className="px-5 py-[72px] text-center text-[15px] leading-6 text-[#666666]">
              로그인하면 최근 검색어를 저장할 수 있어요.
            </p>
          ) : null}

          {isAuthenticated && historiesQuery.isLoading ? (
            <div aria-label="최근 검색어를 불러오는 중" className="px-4" role="status">
              <div className="review-list-skeleton h-10 w-full bg-[#eeeeee]" />
              <div className="review-list-skeleton mt-2 h-10 w-4/5 bg-[#eeeeee]" />
            </div>
          ) : null}

          {isAuthenticated && historiesQuery.isError ? (
            <div className="grid justify-items-center gap-3 px-5 py-[72px] text-center">
              <p className="text-[15px] leading-6 text-[#666666]">
                최근 검색어를 불러오지 못했어요.
              </p>
              <button
                className="h-11 min-w-28 rounded border border-[#dbdbdb] bg-white px-[18px] text-sm text-[#121212]"
                onClick={() => historiesQuery.refetch()}
                type="button"
              >
                다시 시도
              </button>
            </div>
          ) : null}

          {isAuthenticated && historiesQuery.data?.length ? (
            <ul className="px-2 pb-4">
              {historiesQuery.data.map((history) => (
                <li className="grid min-h-10 grid-cols-[minmax(0,1fr)_48px]" key={history.id}>
                  <button
                    className="min-w-0 truncate p-2 text-left text-base leading-6 text-[#121212]"
                    onClick={() => runSearch(history.keyword)}
                    type="button"
                  >
                    {history.keyword}
                  </button>
                  <button
                    aria-label={`${history.keyword} 최근 검색어 삭제`}
                    className="grid h-10 w-12 place-items-center text-[#121212]"
                    onClick={() => handleDeleteHistory(history.id)}
                    type="button"
                  >
                    <X aria-hidden="true" size={17} strokeWidth={1.4} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {isAuthenticated && historiesQuery.isSuccess && !historiesQuery.data.length ? (
            <p className="px-5 py-[72px] text-center text-[15px] leading-6 text-[#666666]">
              최근 검색어가 없어요.
            </p>
          ) : null}

          {historyActionError ? (
            <p className="px-5 pb-5 text-center text-sm text-[#e53545]" role="alert">
              {historyActionError}
            </p>
          ) : null}
        </section>
      ) : null}

      {hasSearched && searchQuery.isLoading ? (
        <div aria-label="검색 결과를 불러오는 중" className="-mx-5" role="status">
          <ReviewListSkeleton />
          <ReviewListSkeleton />
          <ReviewListSkeleton />
        </div>
      ) : null}

      {hasSearched && searchQuery.isError ? (
        <div className="-mx-5 grid justify-items-center gap-4 px-5 py-20 text-center">
          <p className="text-[15px] leading-6 text-[#666666]">
            검색 결과를 불러오지 못했어요.
          </p>
          <button
            className="h-11 min-w-28 rounded border border-[#dbdbdb] bg-white px-[18px] text-sm text-[#121212]"
            onClick={() => searchQuery.refetch()}
            type="button"
          >
            다시 시도
          </button>
        </div>
      ) : null}

      {hasSearched && !searchQuery.isLoading && !searchQuery.isError ? (
        <div className="-mx-5">
          {posts.length ? (
            <PostRows
              isAuthenticated={isAuthenticated}
              onDeleteSuccess={handleDeleteSuccess}
              posts={posts}
              reportSource="search"
            />
          ) : (
            <div className="px-5 py-20 text-center">
              <p className="text-[15px] leading-6 text-[#666666]">
                {hasActiveFilters
                  ? "선택한 조건에 맞는 리뷰가 없어요."
                  : "검색 결과가 없어요."}
              </p>
            </div>
          )}

          {searchQuery.hasNextPage ? (
            <div className="px-4 pb-6 pt-5">
              <button
                className="flex h-11 w-full items-center justify-center gap-2 rounded border border-[#dbdbdb] bg-white text-sm text-[#121212] disabled:text-[#686868]"
                disabled={searchQuery.isFetchingNextPage}
                onClick={() => searchQuery.fetchNextPage()}
                type="button"
              >
                <span>{searchQuery.isFetchingNextPage ? "불러오는 중" : "더보기"}</span>
                <ChevronDown aria-hidden="true" size={16} strokeWidth={1.3} />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {successMessage ? (
        <div
          className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-[7px] bg-neutral-950 px-4 py-3 text-sm font-semibold text-white shadow-lg"
          role="status"
        >
          {successMessage}
        </div>
      ) : null}

      <ReviewPickerDialog
        clearLabel={pickerKind === "region" ? "지역 초기화" : "카테고리 초기화"}
        isOpen={pickerKind !== null}
        onClear={() => {
          if (pickerKind === "region") {
            setRegionSlug("");
          } else {
            setCategorySlug("");
          }
          setPickerKind(null);
        }}
        onClose={() => setPickerKind(null)}
        onConfirm={(value) => {
          if (pickerKind === "region") {
            setRegionSlug(value);
          } else {
            setCategorySlug(value);
          }
          setPickerKind(null);
        }}
        options={pickerOptions}
        title={pickerTitle}
        value={pickerValue}
      />
    </section>
  );
}
