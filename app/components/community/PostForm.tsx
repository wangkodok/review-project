"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import PageBackHeader from "../common/PageBackHeader";
import CategoryReselectionDialog from "./CategoryReselectionDialog";

type PostFormResponse = {
  success: boolean;
  data: {
    post: {
      id: string;
    };
  } | null;
  message: string;
  code?: string;
};

type PostFormProps = {
  mode?: "create" | "edit";
  postId?: string;
  initialTitle?: string;
  initialContent?: string;
  initialCategoryId?: string;
  requiresCategorySelection?: boolean;
};

type Category = {
  id: string;
  name: string;
  slug: string;
};

type CategoriesResponse = {
  success: boolean;
  data: {
    categories: Category[];
  } | null;
  message: string;
};

const TITLE_MAX_LENGTH = 50;
const CONTENT_MAX_LENGTH = 3000;

async function fetchCategories() {
  const response = await fetch("/api/categories");
  const result = (await response.json()) as CategoriesResponse;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.message || "카테고리 목록을 불러오지 못했습니다.");
  }

  return result.data.categories;
}

export default function PostForm({
  mode = "create",
  postId,
  initialTitle = "",
  initialContent = "",
  initialCategoryId = "",
  requiresCategorySelection = false,
}: PostFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(
    mode === "edit" && requiresCategorySelection,
  );
  const categoryQuery = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });
  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  const isEditMode = mode === "edit";
  const isDirty =
    title !== initialTitle || content !== initialContent || categoryId !== initialCategoryId;
  const isTextValid =
    trimmedTitle.length >= 2 &&
    trimmedTitle.length <= TITLE_MAX_LENGTH &&
    trimmedContent.length >= 10 &&
    trimmedContent.length <= CONTENT_MAX_LENGTH;
  const isCategoryValid = Boolean(categoryId) && !categoryQuery.isLoading && !categoryQuery.isError;
  const isValid = isTextValid && isCategoryValid;
  const isButtonDisabled = !isValid || isSubmitting;
  const headerTitle = isEditMode ? "게시글 수정" : "글쓰기";
  const submitText = isEditMode ? "수정 완료" : "작성 완료";
  const leaveMessage = isEditMode
    ? "수정 중인 내용이 사라질 수 있습니다."
    : "작성 중인 내용이 사라질 수 있습니다.";
  const fallbackErrorMessage = isEditMode
    ? "게시글 수정에 실패했습니다."
    : "게시글 등록에 실패했습니다.";

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirty || isSubmitting) {
        return;
      }

      event.preventDefault();
      event.returnValue = leaveMessage;
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, isSubmitting, leaveMessage]);

  function handleBack() {
    if (isDirty && !window.confirm(leaveMessage)) {
      return;
    }

    router.back();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isValid || isSubmitting) {
      return;
    }

    if (isEditMode && !postId) {
      setErrorMessage(fallbackErrorMessage);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch(isEditMode ? `/api/posts/${postId}` : "/api/posts", {
        method: isEditMode ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: trimmedTitle,
          content: trimmedContent,
          categoryId,
        }),
      });
      const result = (await response.json()) as PostFormResponse;

      if (!response.ok || !result.success || !result.data) {
        setErrorMessage(result.message || fallbackErrorMessage);
        return;
      }

      router.replace(`/community/${result.data.post.id}`);
    } catch {
      setErrorMessage(fallbackErrorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <PageBackHeader onBack={handleBack} title={headerTitle} />

      <div className="space-y-2">
        <p className="text-sm font-bold text-neutral-950">카테고리 선택</p>
        {categoryQuery.isLoading ? (
          <div className="flex gap-2">
            <div className="h-10 w-16 rounded-full bg-neutral-100" />
            <div className="h-10 w-16 rounded-full bg-neutral-100" />
            <div className="h-10 w-16 rounded-full bg-neutral-100" />
          </div>
        ) : null}
        {categoryQuery.isError ? (
          <div className="rounded-lg bg-neutral-100 px-4 py-3">
            <p className="text-sm font-semibold text-neutral-950">
              카테고리 목록을 불러오지 못했습니다.
            </p>
            <button
              className="mt-2 text-sm font-bold text-neutral-950 underline"
              onClick={() => categoryQuery.refetch()}
              type="button"
            >
              다시 시도
            </button>
          </div>
        ) : null}
        {categoryQuery.data ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label="카테고리 선택">
            {categoryQuery.data.map((category) => {
              const isSelected = categoryId === category.id;

              return (
                <button
                  aria-pressed={isSelected}
                  className={`h-10 rounded-full border px-4 text-sm font-semibold ${
                    isSelected
                      ? "border-neutral-950 bg-neutral-950 text-white"
                      : "border-neutral-300 bg-white text-neutral-700 active:bg-neutral-100"
                  }`}
                  key={category.id}
                  onClick={() => setCategoryId(category.id)}
                  type="button"
                >
                  {category.name}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-bold text-neutral-950">음식 이름</p>
        <input
          className="h-12 w-full rounded-lg border border-neutral-200 bg-white px-4 text-base text-neutral-950 outline-none placeholder:text-neutral-400 focus:border-neutral-950"
          maxLength={TITLE_MAX_LENGTH}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="예: 음식 이름을 작성해 주세요. (예: 교촌치킨 허니콤보)"
          value={title}
        />
        <p className="text-right text-xs font-medium text-neutral-400">
          {title.length} / {TITLE_MAX_LENGTH}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-bold text-neutral-950">경험 요약</p>
        <textarea
          className="min-h-72 w-full resize-none rounded-lg border border-neutral-200 bg-white px-4 py-3 text-base leading-7 text-neutral-950 outline-none placeholder:text-neutral-400 focus:border-neutral-950"
          maxLength={CONTENT_MAX_LENGTH}
          onChange={(event) => setContent(event.target.value)}
          placeholder="음식 리뷰를 작성해 주세요. (예: 양은 괜찮고 소스가 달았어요. 100자 제한)"
          value={content}
        />
        <p className="text-right text-xs font-medium text-neutral-400">
          {content.length} / {CONTENT_MAX_LENGTH}
        </p>
      </div>

      {errorMessage ? (
        <p className="rounded-lg bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-950">
          {errorMessage}
        </p>
      ) : null}

      <button
        className={`fixed bottom-0 left-1/2 z-20 h-16 w-full max-w-[375px] -translate-x-1/2 text-base font-bold text-white ${
          isSubmitting
            ? "bg-neutral-950"
            : isValid
              ? "bg-neutral-950 active:bg-neutral-800"
              : "bg-neutral-300"
        }`}
        disabled={isButtonDisabled}
        type="submit"
      >
        {submitText}
      </button>

      {isCategoryDialogOpen ? (
        <CategoryReselectionDialog
          onCancel={() => router.replace(`/community/${postId}`)}
          onConfirm={() => setIsCategoryDialogOpen(false)}
        />
      ) : null}
    </form>
  );
}
