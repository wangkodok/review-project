"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import PostRows from "@/app/components/community/PostRows";
import { ReviewListSkeleton } from "@/app/components/community/ReviewListControls";
import PageBackHeader from "@/app/components/common/PageBackHeader";
import type { PostsPage } from "@/app/types/post";
import { PROFILE_QUERY_KEY, type ProfileUser } from "./profileClient";
import {
  MY_POSTS_QUERY_KEY,
  consumeMyPostsDeleteSuccess,
  removePostFromMyPostsData,
} from "./myPostsClient";

type MyPostsResponse = {
  success: boolean;
  data: PostsPage | null;
  message: string;
  code?: string;
};

type MyPostsStateSnapshot = {
  scrollY: number;
};

const MY_POSTS_HISTORY_STATE_KEY = "__myReviewListState";
const MY_POSTS_QUERY_CACHE_TIME = 30 * 60 * 1000;

function readMyPostsState(): MyPostsStateSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = (window.history.state as Record<string, unknown> | null)?.[
    MY_POSTS_HISTORY_STATE_KEY
  ];

  if (!value || typeof value !== "object") {
    return null;
  }

  const snapshot = value as Partial<MyPostsStateSnapshot>;

  if (
    typeof snapshot.scrollY !== "number" ||
    !Number.isFinite(snapshot.scrollY) ||
    snapshot.scrollY < 0
  ) {
    return null;
  }

  return snapshot as MyPostsStateSnapshot;
}

function writeMyPostsState(snapshot: MyPostsStateSnapshot) {
  const currentState = (window.history.state as Record<string, unknown> | null) ?? {};
  window.history.replaceState(
    { ...currentState, [MY_POSTS_HISTORY_STATE_KEY]: snapshot },
    "",
  );
}

function clearMyPostsState() {
  const currentState = (window.history.state as Record<string, unknown> | null) ?? {};
  const nextState = { ...currentState };
  delete nextState[MY_POSTS_HISTORY_STATE_KEY];
  window.history.replaceState(nextState, "");
}

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

export default function MyPostList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const restoreScrollYRef = useRef<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const query = useInfiniteQuery({
    queryKey: MY_POSTS_QUERY_KEY,
    queryFn: ({ pageParam }) => fetchMyPosts({ pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    gcTime: MY_POSTS_QUERY_CACHE_TIME,
  });
  const posts = useMemo(
    () => query.data?.pages.flatMap((page) => page.posts) ?? [],
    [query.data],
  );
  const hasNoPosts = !query.isLoading && !query.isError && posts.length === 0;

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      const snapshot = readMyPostsState();
      restoreScrollYRef.current = snapshot?.scrollY ?? null;
      writeMyPostsState({ scrollY: snapshot?.scrollY ?? 0 });

      if (consumeMyPostsDeleteSuccess()) {
        setSuccessMessage("리뷰가 삭제되었습니다.");
      }

      setIsReady(true);
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    let animationFrame = 0;

    function saveScrollPosition() {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        writeMyPostsState({ scrollY: window.scrollY });
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

    if (!isReady || scrollY === null || query.isLoading || query.isFetchingNextPage) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, behavior: "auto" });
      restoreScrollYRef.current = null;
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [isReady, posts.length, query.isFetchingNextPage, query.isLoading]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timer = window.setTimeout(() => setSuccessMessage(""), 2400);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  function handleBack() {
    clearMyPostsState();
    router.replace("/my");
  }

  function handleDeleteSuccess(postId: string) {
    queryClient.setQueryData<InfiniteData<PostsPage, number>>(MY_POSTS_QUERY_KEY, (current) =>
      removePostFromMyPostsData(current, postId),
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
    setSuccessMessage("리뷰가 삭제되었습니다.");
  }

  return (
    <section className="bg-white">
      <PageBackHeader
        backIconStrokeWidth={1.25}
        fullHeightActions
        onBack={handleBack}
        sticky
        title="내가 작성한 리뷰"
        titleClassName="text-[18px] font-bold leading-6 text-[#121212]"
      />

      {query.isLoading ? (
        <div
          aria-label="내가 작성한 리뷰를 불러오는 중"
          className="-mx-5"
          role="status"
        >
          <ReviewListSkeleton />
          <ReviewListSkeleton />
          <ReviewListSkeleton />
        </div>
      ) : null}

      {query.isError ? (
        <div className="-mx-5 grid justify-items-center gap-4 px-5 py-20 text-center">
          <p className="text-[15px] leading-6 text-[#666666]">
            내가 작성한 리뷰를 불러오지 못했어요.
          </p>
          <button
            className="h-11 min-w-28 rounded border border-[#dbdbdb] bg-white px-[18px] text-sm text-[#121212]"
            onClick={() => query.refetch()}
            type="button"
          >
            다시 시도
          </button>
        </div>
      ) : null}

      {!query.isLoading && !query.isError ? (
        <div className="-mx-5">
          <PostRows
            getDetailHref={(post) => `/community/${post.id}?from=my-posts`}
            getEditHref={(post) => `/community/${post.id}/edit?from=my-posts`}
            isAuthenticated
            onDeleteSuccess={handleDeleteSuccess}
            posts={posts}
          />
        </div>
      ) : null}

      {hasNoPosts ? (
        <div className="-mx-5 px-5 py-20 text-center">
          <p className="text-[15px] leading-6 text-[#666666]">
            작성한 리뷰가 없어요.
          </p>
        </div>
      ) : null}

      {query.hasNextPage ? (
        <div className="-mx-5 px-4 pb-6 pt-5">
          <button
            className="flex h-11 w-full items-center justify-center gap-2 rounded border border-[#dbdbdb] bg-white text-sm text-[#121212] disabled:text-[#686868]"
            disabled={query.isFetchingNextPage}
            onClick={() => query.fetchNextPage()}
            type="button"
          >
            <span>{query.isFetchingNextPage ? "불러오는 중" : "더보기"}</span>
            <ChevronDown aria-hidden="true" size={16} strokeWidth={1.3} />
          </button>
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
    </section>
  );
}
