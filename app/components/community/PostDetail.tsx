"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import PostActionSummary from "./PostActionSummary";
import PostMeta from "./PostMeta";

type PostDetailData = {
  id: string;
  title: string;
  content: string;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    anonymousId: string;
  };
  isOwner: boolean;
  isLiked: boolean;
};

type PostDetailResponse = {
  success: boolean;
  data: {
    post: PostDetailData;
  } | null;
  message: string;
  code?: string;
};

type DeletePostResponse = {
  success: boolean;
  data: null;
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

export default function PostDetail({ postId }: { postId: string }) {
  const router = useRouter();
  const [isOwnerMenuOpen, setIsOwnerMenuOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState("");
  const query = useQuery({
    queryKey: ["post", postId],
    queryFn: () => fetchPostDetail(postId),
  });
  const errorName = query.error instanceof Error ? query.error.name : "";
  const isNotFound = errorName === "POST_NOT_FOUND";

  async function handleDelete() {
    if (isDeleting) {
      return;
    }

    const confirmed = window.confirm(
      "삭제한 게시글은 복구할 수 없습니다. 정말 삭제하시겠습니까?",
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setDeleteErrorMessage("");

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as DeletePostResponse;

      if (!response.ok || !result.success) {
        setDeleteErrorMessage(result.message || "게시글 삭제에 실패했습니다.");
        return;
      }

      router.replace("/community");
    } catch {
      setDeleteErrorMessage("게시글 삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  }

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
        <div className="relative flex h-11 w-11 items-center justify-center">
          {query.data?.isOwner ? (
            <button
              aria-label="게시글 더보기"
              className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-950 active:bg-neutral-100"
              onClick={() => setIsOwnerMenuOpen((prev) => !prev)}
              type="button"
            >
              <MoreHorizontal aria-hidden="true" size={22} />
            </button>
          ) : null}
          {query.data?.isOwner && isOwnerMenuOpen ? (
            <div className="absolute right-0 top-12 z-20 w-32 rounded-lg border border-neutral-200 bg-white p-1 shadow-sm">
              <Link
                className="flex h-10 items-center rounded-md px-3 text-sm font-semibold text-neutral-950 active:bg-neutral-100"
                href={`/community/${postId}/edit`}
                replace
              >
                게시글 수정
              </Link>
              <button
                className="flex h-10 w-full items-center rounded-md px-3 text-left text-sm font-semibold text-neutral-950 active:bg-neutral-100 disabled:text-neutral-400"
                disabled={isDeleting}
                onClick={handleDelete}
                type="button"
              >
                게시글 삭제
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {query.isLoading ? <PostDetailSkeleton /> : null}

      {deleteErrorMessage ? (
        <p className="rounded-lg bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-950">
          {deleteErrorMessage}
        </p>
      ) : null}

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
            <h2 className="break-all text-2xl font-bold leading-9 text-neutral-950">
              {query.data.title}
            </h2>
          </div>
          <p className="whitespace-pre-wrap break-all text-base leading-8 text-neutral-800">
            {query.data.content}
          </p>
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
