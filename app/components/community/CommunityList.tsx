"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ChevronDown, PenLine } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReviewWriteLoginDialog from "@/app/components/auth/ReviewWriteLoginDialog";
import type { PostCategory, PostRegion, PostsPage } from "@/app/types/post";
import PostRows from "./PostRows";
import ReviewListControls, {
  ReviewListSkeleton,
  type ReviewSortValue,
} from "./ReviewListControls";
import ReviewPickerDialog from "./ReviewPickerDialog";

type PickerKind = "region" | "category" | null;

type PostsResponse = {
  success: boolean;
  data: PostsPage | null;
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

async function fetchPosts({
  pageParam,
  sort,
  categorySlug,
  regionSlug,
}: {
  pageParam: number;
  sort: ReviewSortValue;
  categorySlug: string;
  regionSlug: string;
}) {
  const params = new URLSearchParams({
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

  const response = await fetch(`/api/posts?${params.toString()}`);
  const result = (await response.json()) as PostsResponse;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.message || "리뷰 목록을 불러오지 못했습니다.");
  }

  return result.data;
}

export default function CommunityList({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [sort, setSort] = useState<ReviewSortValue>("latest");
  const [categorySlug, setCategorySlug] = useState("");
  const [regionSlug, setRegionSlug] = useState("");
  const [pickerKind, setPickerKind] = useState<PickerKind>(null);
  const [deletedPostIds, setDeletedPostIds] = useState<Set<string>>(() => new Set());
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const reviewWriteButtonRef = useRef<HTMLButtonElement>(null);
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });
  const regionsQuery = useQuery({
    queryKey: ["regions"],
    queryFn: fetchRegions,
  });
  const postsQuery = useInfiniteQuery({
    queryKey: ["posts", sort, regionSlug, categorySlug],
    queryFn: ({ pageParam }) =>
      fetchPosts({ pageParam, sort, categorySlug, regionSlug }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
  });
  const loadedPosts = useMemo(
    () => postsQuery.data?.pages.flatMap((page) => page.posts) ?? [],
    [postsQuery.data],
  );
  const posts = useMemo(
    () => loadedPosts.filter((post) => !deletedPostIds.has(post.id)),
    [deletedPostIds, loadedPosts],
  );
  const deletedVisibleCount = loadedPosts.length - posts.length;
  const totalCount = Math.max(
    0,
    (postsQuery.data?.pages[0]?.totalCount ?? 0) - deletedVisibleCount,
  );
  const selectedRegion = regionsQuery.data?.find((region) => region.slug === regionSlug);
  const selectedCategory = categoriesQuery.data?.find(
    (category) => category.slug === categorySlug,
  );
  const hasActiveFilters = Boolean(regionSlug || categorySlug);
  const hasReferenceDataError = regionsQuery.isError || categoriesQuery.isError;

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timer = window.setTimeout(() => setSuccessMessage(""), 2400);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

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

  const closeLoginDialog = useCallback(() => {
    setIsLoginDialogOpen(false);
    window.requestAnimationFrame(() => {
      reviewWriteButtonRef.current?.focus({ preventScroll: true });
    });
  }, []);

  const pickerOptions = (
    pickerKind === "region" ? regionsQuery.data ?? [] : categoriesQuery.data ?? []
  ).map((option) => ({
    id: option.slug,
    name: option.name,
  }));
  const pickerValue = pickerKind === "region" ? regionSlug : categorySlug;
  const pickerTitle = pickerKind === "region" ? "지역 선택" : "카테고리 선택";

  return (
    <section className="-mx-5 -mt-5">
      <div className="sticky top-14 z-10 border-b border-[#dbdbdb] bg-white">
        <ReviewListControls
          categoryActive={Boolean(categorySlug)}
          categoryDisabled={!categoriesQuery.data}
          categoryLabel={selectedCategory?.name ?? "카테고리"}
          count={totalCount}
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
            <p className="text-sm text-neutral-600">필터 목록을 불러오지 못했습니다.</p>
            <button
              className="h-9 shrink-0 px-2 text-sm font-bold text-[#121212]"
              onClick={() => {
                void Promise.all([regionsQuery.refetch(), categoriesQuery.refetch()]);
              }}
              type="button"
            >
              다시 시도
            </button>
          </div>
        ) : null}
      </div>

      {postsQuery.isLoading ? (
        <div aria-label="리뷰 목록을 불러오는 중" role="status">
          <ReviewListSkeleton />
          <ReviewListSkeleton />
          <ReviewListSkeleton />
        </div>
      ) : null}

      {postsQuery.isError ? (
        <div className="px-4 py-14 text-center">
          <p className="text-sm font-semibold text-[#121212]">
            리뷰 목록을 불러오지 못했습니다.
          </p>
          <button
            className="mt-4 h-10 px-4 text-sm font-bold text-[#121212] underline underline-offset-4"
            onClick={() => postsQuery.refetch()}
            type="button"
          >
            다시 시도
          </button>
        </div>
      ) : null}

      {!postsQuery.isLoading && !postsQuery.isError && posts.length ? (
        <PostRows
          isAuthenticated={isAuthenticated}
          onDeleteSuccess={handleDeleteSuccess}
          posts={posts}
          reportSource="community"
        />
      ) : null}

      {!postsQuery.isLoading && !postsQuery.isError && !posts.length ? (
        <div className="px-5 py-20 text-center">
          <p className="text-[15px] leading-6 text-[#686868]">
            {hasActiveFilters
              ? "조건에 맞는 리뷰가 없습니다."
              : "아직 등록된 리뷰가 없습니다."}
          </p>
        </div>
      ) : null}

      {postsQuery.hasNextPage && !postsQuery.isError ? (
        <div className="px-4 pb-6 pt-5">
          <button
            className="flex h-11 w-full items-center justify-center gap-2 rounded border border-[#dbdbdb] bg-white text-sm text-[#121212] disabled:text-[#686868]"
            disabled={postsQuery.isFetchingNextPage}
            onClick={() => postsQuery.fetchNextPage()}
            type="button"
          >
            <span>{postsQuery.isFetchingNextPage ? "불러오는 중" : "더보기"}</span>
            <ChevronDown aria-hidden="true" size={16} strokeWidth={1.3} />
          </button>
        </div>
      ) : null}

      <div className="pointer-events-none fixed bottom-20 left-1/2 z-20 flex w-full max-w-[var(--app-frame-max-width)] -translate-x-1/2 justify-end px-4">
        {isAuthenticated ? (
          <Link
            aria-label="리뷰쓰기"
            className="pointer-events-auto inline-flex h-[34px] items-center justify-center gap-1 rounded-full bg-[#3399ff] px-[13px] text-sm leading-5 text-white shadow-sm active:bg-[#2186e8]"
            href="/community/write"
          >
            <PenLine aria-hidden="true" size={16} strokeWidth={1.3} />
            리뷰쓰기
          </Link>
        ) : (
          <button
            aria-label="리뷰쓰기"
            className="pointer-events-auto inline-flex h-[34px] items-center justify-center gap-1 rounded-full bg-[#3399ff] px-[13px] text-sm leading-5 text-white shadow-sm active:bg-[#2186e8]"
            onClick={() => setIsLoginDialogOpen(true)}
            ref={reviewWriteButtonRef}
            type="button"
          >
            <PenLine aria-hidden="true" size={16} strokeWidth={1.3} />
            리뷰쓰기
          </button>
        )}
      </div>

      {successMessage ? (
        <div
          className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-[7px] bg-neutral-950 px-4 py-3 text-sm font-semibold text-white shadow-lg"
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

      <ReviewWriteLoginDialog
        isOpen={isLoginDialogOpen}
        onClose={closeLoginDialog}
      />
    </section>
  );
}
