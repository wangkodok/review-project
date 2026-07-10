"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  BAD_REVIEW_OPTIONS,
  GOOD_REVIEW_OPTIONS,
  REVIEW_OPTION_LIMITS,
} from "@/app/constants/reviewOptions";
import { OVERALL_REVIEW_MAX_LENGTH } from "@/app/lib/posts/structuredReview";
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
  initialMenuName?: string;
  initialGoodPoints?: string[];
  initialBadPoints?: string[];
  initialOverallReview?: string | null;
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

type ReviewOption = {
  key: string;
  label: string;
};

const MENU_NAME_MAX_LENGTH = 50;

async function fetchCategories() {
  const response = await fetch("/api/categories");
  const result = (await response.json()) as CategoriesResponse;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.message || "카테고리 목록을 불러오지 못했습니다.");
  }

  return result.data.categories;
}

function hasSameItems(left: string[], right: string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function getInitialReviewPoints(value?: string[]) {
  return Array.isArray(value) ? value : [];
}

export default function PostForm({
  mode = "create",
  postId,
  initialTitle = "",
  initialMenuName,
  initialGoodPoints,
  initialBadPoints,
  initialOverallReview,
  initialCategoryId = "",
  requiresCategorySelection = false,
}: PostFormProps) {
  const router = useRouter();
  const initialMenuValue = initialMenuName?.trim() || initialTitle;
  const initialGoodPointValues = getInitialReviewPoints(initialGoodPoints);
  const initialBadPointValues = getInitialReviewPoints(initialBadPoints);
  const initialOverallReviewValue = initialOverallReview?.trim() ?? "";
  const [menuName, setMenuName] = useState(initialMenuValue);
  const [goodPoints, setGoodPoints] = useState<string[]>(initialGoodPointValues);
  const [badPoints, setBadPoints] = useState<string[]>(initialBadPointValues);
  const [overallReview, setOverallReview] = useState(initialOverallReviewValue);
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
  const trimmedMenuName = menuName.trim();
  const trimmedOverallReview = overallReview.trim();
  const isEditMode = mode === "edit";
  const isDirty =
    menuName !== initialMenuValue ||
    overallReview !== initialOverallReviewValue ||
    categoryId !== initialCategoryId ||
    !hasSameItems(goodPoints, initialGoodPointValues) ||
    !hasSameItems(badPoints, initialBadPointValues);
  const isMenuNameValid = trimmedMenuName.length >= 2 && trimmedMenuName.length <= MENU_NAME_MAX_LENGTH;
  const isOverallReviewValid = trimmedOverallReview.length <= OVERALL_REVIEW_MAX_LENGTH;
  const areGoodPointsValid =
    goodPoints.length >= REVIEW_OPTION_LIMITS.min && goodPoints.length <= REVIEW_OPTION_LIMITS.max;
  const areBadPointsValid =
    badPoints.length >= REVIEW_OPTION_LIMITS.min && badPoints.length <= REVIEW_OPTION_LIMITS.max;
  const isCategoryValid = Boolean(categoryId) && !categoryQuery.isLoading && !categoryQuery.isError;
  const isValid =
    isMenuNameValid &&
    isOverallReviewValid &&
    areGoodPointsValid &&
    areBadPointsValid &&
    isCategoryValid;
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

  function toggleReviewPoint({
    key,
    values,
    setValues,
  }: {
    key: string;
    values: string[];
    setValues: (value: string[]) => void;
  }) {
    if (values.includes(key)) {
      setValues(values.filter((value) => value !== key));
      return;
    }

    if (values.length >= REVIEW_OPTION_LIMITS.max) {
      return;
    }

    setValues([...values, key]);
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
          menuName: trimmedMenuName,
          goodPoints,
          badPoints,
          overallReview: trimmedOverallReview || null,
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

  function renderReviewOptions({
    label,
    options,
    values,
    setValues,
  }: {
    label: string;
    options: readonly ReviewOption[];
    values: string[];
    setValues: (value: string[]) => void;
  }) {
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-base font-extrabold leading-5 text-neutral-950">{label}</p>
          <p className="text-xs font-semibold text-neutral-300">
            {values.length}/{REVIEW_OPTION_LIMITS.max}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-2.5" role="group" aria-label={label}>
          {options.map((option) => {
            const isSelected = values.includes(option.key);
            const isDisabled = !isSelected && values.length >= REVIEW_OPTION_LIMITS.max;

            return (
              <button
                aria-pressed={isSelected}
                className={`min-h-[30px] rounded-full border-0 px-3.5 py-1.5 text-sm font-extrabold leading-5 ${
                  isSelected
                    ? "bg-neutral-950 text-white"
                    : "bg-neutral-100 text-neutral-950 active:bg-neutral-200"
                } ${isDisabled ? "opacity-40" : ""}`}
                disabled={isDisabled}
                key={option.key}
                onClick={() => toggleReviewPoint({ key: option.key, values, setValues })}
                type="button"
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <form className="space-y-9 pb-24" onSubmit={handleSubmit}>
      <PageBackHeader onBack={handleBack} title={headerTitle} />

      <section className="space-y-3">
        <p className="text-base font-extrabold leading-5 text-neutral-950">
          카테고리 선택(필수)
        </p>
        {categoryQuery.isLoading ? (
          <div className="flex gap-2">
            <div className="h-[30px] w-16 rounded-full bg-neutral-100" />
            <div className="h-[30px] w-16 rounded-full bg-neutral-100" />
            <div className="h-[30px] w-16 rounded-full bg-neutral-100" />
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
                  className={`min-h-[30px] rounded-full px-3.5 py-1.5 text-sm font-extrabold leading-5 ${
                    isSelected
                      ? "bg-neutral-950 text-white"
                      : "bg-neutral-100 text-neutral-950 active:bg-neutral-200"
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
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-base font-extrabold leading-5 text-neutral-950">
            메뉴 이름(필수)
          </p>
          <p className="text-xs font-semibold text-neutral-300">
            {menuName.length}/{MENU_NAME_MAX_LENGTH}
          </p>
        </div>
        <input
          className="h-11 w-full rounded-none border border-neutral-300 bg-white px-4 text-base text-neutral-950 outline-none placeholder:text-neutral-300 focus:border-neutral-950"
          maxLength={MENU_NAME_MAX_LENGTH}
          onChange={(event) => setMenuName(event.target.value)}
          placeholder="예시) 제육볶음, 김치찌개 ... 등"
          value={menuName}
        />
      </section>

      {renderReviewOptions({
        label: "좋았던 점(필수)",
        options: GOOD_REVIEW_OPTIONS,
        values: goodPoints,
        setValues: setGoodPoints,
      })}

      {renderReviewOptions({
        label: "아쉬웠던 점(필수)",
        options: BAD_REVIEW_OPTIONS,
        values: badPoints,
        setValues: setBadPoints,
      })}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-base font-extrabold leading-5 text-neutral-950">
              남기고 싶은 나의 한마디(선택)
            </p>
            <p className="mt-2 text-xs font-medium leading-5 text-neutral-500">
              예쁜 말 한마디가 건강한 리뷰를 만들어요.
            </p>
          </div>
          <p
            className={`self-end text-xs font-semibold ${
              isOverallReviewValid ? "text-neutral-300" : "text-neutral-950"
            }`}
          >
            {overallReview.length}/{OVERALL_REVIEW_MAX_LENGTH}
          </p>
        </div>
        <textarea
          className="min-h-[120px] w-full resize-none rounded-none border border-neutral-300 bg-white px-4 py-3 text-base leading-7 text-neutral-950 outline-none placeholder:text-neutral-300 focus:border-neutral-950"
          maxLength={OVERALL_REVIEW_MAX_LENGTH + 1}
          onChange={(event) => setOverallReview(event.target.value)}
          placeholder="예시) 맛있게 먹었는데 아쉽게도 가격에 비해 양이 조금 적은 편이에요."
          value={overallReview}
        />
      </section>

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
