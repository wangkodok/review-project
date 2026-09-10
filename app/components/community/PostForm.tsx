"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  BAD_REVIEW_OPTIONS,
  GOOD_REVIEW_OPTIONS,
  REVIEW_OPTION_LIMITS,
} from "@/app/constants/reviewOptions";
import {
  STORE_NAME_MAX_LENGTH,
  STORE_NAME_MIN_LENGTH,
} from "@/app/lib/posts/reviewInput";
import {
  MENU_NAME_MAX_LENGTH,
  MENU_NAME_MIN_LENGTH,
  OVERALL_REVIEW_MAX_LENGTH,
} from "@/app/lib/posts/structuredReview";
import PageBackHeader from "../common/PageBackHeader";
import ReviewConfirmDialog from "./ReviewConfirmDialog";
import ReviewPickerDialog, { ReviewPickerOption } from "./ReviewPickerDialog";

type PostFormResponse = {
  success: boolean;
  data: {
    post: {
      id: string;
      updatedAt?: string;
    };
  } | null;
  message: string;
  code?: string;
};

type PostFormProps = {
  mode?: "create" | "edit";
  postId?: string;
  initialStoreName?: string | null;
  initialMenuName?: string;
  initialGoodPoints?: string[];
  initialBadPoints?: string[];
  initialOverallReview?: string | null;
  initialCategoryId?: string;
  initialCategoryName?: string;
  initialRegionId?: string;
  initialRegionName?: string;
  initialUpdatedAt?: string;
  requiresCategorySelection?: boolean;
  requiresRegionSelection?: boolean;
  returnSource?: "my-posts";
};

type ReferenceOption = ReviewPickerOption & {
  slug: string;
};

type ReferenceOptionsResponse = {
  success: boolean;
  data: {
    categories?: ReferenceOption[];
    regions?: ReferenceOption[];
  } | null;
  message: string;
};

type ReviewOption = {
  key: string;
  label: string;
};

type PickerKind = "region" | "category";
type ConfirmMode = "save" | "leave";

const GOOD_OPTION_KEYS = new Set(GOOD_REVIEW_OPTIONS.map((option) => option.key));
const BAD_OPTION_KEYS = new Set(BAD_REVIEW_OPTIONS.map((option) => option.key));

async function fetchReferenceOptions(
  path: "/api/categories" | "/api/regions",
  key: "categories" | "regions",
) {
  const response = await fetch(path);
  const result = (await response.json()) as ReferenceOptionsResponse;
  const options = result.data?.[key];

  if (!response.ok || !result.success || !options) {
    throw new Error(result.message || "선택 목록을 불러오지 못했습니다.");
  }

  return options;
}

function hasSameItems(left: string[], right: string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function getInitialReviewPoints(value: string[] | undefined, allowedKeys: Set<string>) {
  return Array.isArray(value) ? value.filter((key) => allowedKeys.has(key)) : [];
}

function getSelectedName({
  options,
  selectedId,
  initialId,
  initialName,
}: {
  options?: ReferenceOption[];
  selectedId: string;
  initialId: string;
  initialName: string;
}) {
  return (
    options?.find((option) => option.id === selectedId)?.name ??
    (selectedId === initialId ? initialName : "")
  );
}

function getSaveErrorMessage(result: PostFormResponse, fallbackMessage: string) {
  if (result.code === "UNAUTHORIZED") {
    return "로그인이 만료되었습니다. 다시 로그인해 주세요.";
  }

  if (result.code === "RATE_LIMIT_EXCEEDED") {
    return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  }

  return result.message || fallbackMessage;
}

export default function PostForm({
  mode = "create",
  postId,
  initialStoreName,
  initialMenuName = "",
  initialGoodPoints,
  initialBadPoints,
  initialOverallReview,
  initialCategoryId = "",
  initialCategoryName = "",
  initialRegionId = "",
  initialRegionName = "",
  initialUpdatedAt,
  requiresCategorySelection = false,
  requiresRegionSelection = false,
  returnSource,
}: PostFormProps) {
  const router = useRouter();
  const initialStoreValue = initialStoreName?.trim() ?? "";
  const initialMenuValue = initialMenuName.trim();
  const initialGoodPointValues = getInitialReviewPoints(initialGoodPoints, GOOD_OPTION_KEYS);
  const initialBadPointValues = getInitialReviewPoints(initialBadPoints, BAD_OPTION_KEYS);
  const initialOverallReviewValue = initialOverallReview?.trim() ?? "";
  const [storeName, setStoreName] = useState(initialStoreValue);
  const [menuName, setMenuName] = useState(initialMenuValue);
  const [goodPoints, setGoodPoints] = useState<string[]>(initialGoodPointValues);
  const [badPoints, setBadPoints] = useState<string[]>(initialBadPointValues);
  const [overallReview, setOverallReview] = useState(initialOverallReviewValue);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [regionId, setRegionId] = useState(initialRegionId);
  const [activePicker, setActivePicker] = useState<PickerKind | null>(null);
  const [confirmMode, setConfirmMode] = useState<ConfirmMode | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const categoryQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => fetchReferenceOptions("/api/categories", "categories"),
    staleTime: 5 * 60 * 1000,
  });
  const regionQuery = useQuery({
    queryKey: ["regions"],
    queryFn: () => fetchReferenceOptions("/api/regions", "regions"),
    staleTime: 5 * 60 * 1000,
  });
  const trimmedStoreName = storeName.trim();
  const trimmedMenuName = menuName.trim();
  const trimmedOverallReview = overallReview.trim();
  const isEditMode = mode === "edit";
  const isDirty =
    storeName !== initialStoreValue ||
    menuName !== initialMenuValue ||
    overallReview !== initialOverallReviewValue ||
    categoryId !== initialCategoryId ||
    regionId !== initialRegionId ||
    !hasSameItems(goodPoints, initialGoodPointValues) ||
    !hasSameItems(badPoints, initialBadPointValues);
  const isStoreNameValid =
    trimmedStoreName.length >= STORE_NAME_MIN_LENGTH &&
    trimmedStoreName.length <= STORE_NAME_MAX_LENGTH;
  const isMenuNameValid =
    trimmedMenuName.length >= MENU_NAME_MIN_LENGTH &&
    trimmedMenuName.length <= MENU_NAME_MAX_LENGTH;
  const isOverallReviewValid = trimmedOverallReview.length <= OVERALL_REVIEW_MAX_LENGTH;
  const areGoodPointsValid =
    goodPoints.length >= REVIEW_OPTION_LIMITS.min && goodPoints.length <= REVIEW_OPTION_LIMITS.max;
  const areBadPointsValid =
    badPoints.length >= REVIEW_OPTION_LIMITS.min && badPoints.length <= REVIEW_OPTION_LIMITS.max;
  const isCategoryValid = Boolean(
    categoryId && categoryQuery.data?.some((category) => category.id === categoryId),
  );
  const isRegionValid = Boolean(
    regionId && regionQuery.data?.some((region) => region.id === regionId),
  );
  const isValid =
    isStoreNameValid &&
    isMenuNameValid &&
    isOverallReviewValid &&
    areGoodPointsValid &&
    areBadPointsValid &&
    isCategoryValid &&
    isRegionValid;
  const isSaveDisabled = !isValid || isSubmitting || (isEditMode && !isDirty);
  const selectedRegionName = getSelectedName({
    options: regionQuery.data,
    selectedId: regionId,
    initialId: initialRegionId,
    initialName: initialRegionName,
  });
  const selectedCategoryName = getSelectedName({
    options: categoryQuery.data,
    selectedId: categoryId,
    initialId: initialCategoryId,
    initialName: initialCategoryName,
  });
  const pickerOptions = activePicker === "region" ? regionQuery.data ?? [] : categoryQuery.data ?? [];
  const pickerValue = activePicker === "region" ? regionId : categoryId;
  const pickerTitle = activePicker === "region" ? "지역 선택" : "카테고리 선택";
  const fallbackErrorMessage = isEditMode
    ? "리뷰를 수정하지 못했습니다. 잠시 후 다시 시도해 주세요."
    : "리뷰를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  const detailHref = postId
    ? `/community/${postId}${returnSource === "my-posts" ? "?from=my-posts" : ""}`
    : "";

  const closePicker = useCallback(() => setActivePicker(null), []);
  const closeConfirm = useCallback(() => {
    if (!isSubmitting) {
      setConfirmMode(null);
    }
  }, [isSubmitting]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirty || isSubmitting) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, isSubmitting]);

  function handleBack() {
    if (isEditMode || isDirty) {
      setConfirmMode("leave");
      return;
    }

    router.back();
  }

  function handleLeave() {
    setConfirmMode(null);

    if (isEditMode && postId) {
      router.replace(detailHref);
      return;
    }

    router.back();
  }

  function applyPicker(value: string) {
    if (activePicker === "region") {
      setRegionId(value);
    } else if (activePicker === "category") {
      setCategoryId(value);
    }

    setActivePicker(null);
    setErrorMessage("");
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

  function handleSubmitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isSaveDisabled) {
      setConfirmMode("save");
    }
  }

  async function saveReview() {
    if (!isValid || isSubmitting || (isEditMode && !isDirty)) {
      return;
    }

    if (isEditMode && (!postId || !initialUpdatedAt)) {
      setConfirmMode(null);
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
          storeName: trimmedStoreName,
          menuName: trimmedMenuName,
          regionId,
          categoryId,
          goodPoints,
          badPoints,
          overallReview: trimmedOverallReview || null,
          ...(isEditMode ? { updatedAt: initialUpdatedAt } : {}),
        }),
      });
      const result = (await response.json()) as PostFormResponse;

      if (!response.ok || !result.success || !result.data) {
        setConfirmMode(null);
        setErrorMessage(getSaveErrorMessage(result, fallbackErrorMessage));
        return;
      }

      router.replace(
        `/community/${result.data.post.id}${
          returnSource === "my-posts" ? "?from=my-posts" : ""
        }`,
      );
    } catch {
      setConfirmMode(null);
      setErrorMessage("인터넷 연결을 확인한 후 다시 시도해 주세요.");
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
      <section className="mb-[30px]">
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          <p className="text-[17px] font-bold leading-6 text-neutral-950">
            {label} <span className="text-[#ff4d5e]">*</span>
          </p>
          <p className="text-[13px] font-normal text-neutral-400">
            {values.length}/{REVIEW_OPTION_LIMITS.max}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-1.5 gap-y-[7px]" role="group" aria-label={label}>
          {options.map((option) => {
            const isSelected = values.includes(option.key);

            return (
              <button
                aria-pressed={isSelected}
                className={`inline-flex h-[34px] items-center justify-center rounded-[18px] border px-[13px] text-[15px] font-normal leading-none ${
                  isSelected
                    ? "border-[#3399ff] text-[#3399ff]"
                    : "border-[#dbdbdb] text-neutral-950 active:bg-neutral-50"
                }`}
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

  function renderReferenceField({
    kind,
    label,
    placeholder,
    value,
    query,
    requiresSelection,
  }: {
    kind: PickerKind;
    label: string;
    placeholder: string;
    value: string;
    query: typeof categoryQuery;
    requiresSelection: boolean;
  }) {
    return (
      <section className="mb-[30px]">
        <p className="mb-2.5 text-[17px] font-bold leading-6 text-neutral-950">
          {label} <span className="text-[#ff4d5e]">*</span>
        </p>
        <button
          className="flex h-12 w-full items-center justify-between border border-[#dbdbdb] bg-white px-3 pl-3.5 text-left text-base disabled:text-neutral-400"
          disabled={query.isLoading || query.isError}
          onClick={() => setActivePicker(kind)}
          type="button"
        >
          <span className={value ? "text-neutral-950" : "text-neutral-400"}>
            {query.isLoading ? "목록을 불러오는 중입니다." : value || placeholder}
          </span>
          <ChevronDown aria-hidden="true" className="shrink-0 text-neutral-500" size={18} strokeWidth={1} />
        </button>
        {query.isError ? (
          <div className="mt-2 flex items-center justify-between gap-3 text-sm text-neutral-600">
            <p>목록을 불러오지 못했습니다.</p>
            <button className="font-bold text-neutral-950 underline" onClick={() => query.refetch()} type="button">
              다시 시도
            </button>
          </div>
        ) : null}
        {isEditMode && requiresSelection ? (
          <p className="mt-2 text-xs leading-5 text-neutral-500">
            기존 리뷰를 저장하려면 {label}을 다시 선택해 주세요.
          </p>
        ) : null}
      </section>
    );
  }

  const saveDialog = isEditMode
    ? {
        title: "리뷰 저장",
        description: "수정된 리뷰를 저장하시겠습니까?",
        cancelLabel: "아니요",
        confirmLabel: "저장하기",
      }
    : {
        title: "리뷰 저장",
        description: "리뷰를 저장하시겠습니까?",
        cancelLabel: "취소",
        confirmLabel: "저장",
      };
  const leaveDialog = isEditMode
    ? {
        title: "리뷰 수정 취소",
        description: "수정 중인 내용이 저장되지 않습니다.\n그래도 나가시겠습니까?",
        cancelLabel: "계속 수정",
      }
    : {
        title: "리뷰 작성 취소",
        description: "작성 중인 내용이 저장되지 않습니다.\n그래도 나가시겠습니까?",
        cancelLabel: "계속 작성",
      };

  return (
    <form className="pb-8" onSubmit={handleSubmitRequest}>
      <PageBackHeader
        fullHeightActions
        onBack={handleBack}
        right={
          <button
            className="h-14 w-14 text-base text-neutral-950 disabled:font-normal disabled:text-neutral-400 enabled:font-bold"
            disabled={isSaveDisabled}
            type="submit"
          >
            저장
          </button>
        }
        sticky
        title={isEditMode ? "리뷰 수정" : "리뷰 작성"}
        titleClassName="text-lg font-semibold text-neutral-950"
      />

      <div className="flex h-12 items-center justify-end text-base">
        <span><span className="text-[#ff4d5e]">*</span>필수</span>
      </div>

      <section className="mb-[30px]">
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          <label className="text-[17px] font-bold leading-6 text-neutral-950" htmlFor="review-store-name">
            어느 음식점인가요? <span className="text-[#ff4d5e]">*</span>
          </label>
          <span className="text-[13px] font-normal text-neutral-400">
            {storeName.length}/{STORE_NAME_MAX_LENGTH}
          </span>
        </div>
        <input
          autoComplete="off"
          className="h-12 w-full rounded-none border border-[#dbdbdb] bg-white px-3.5 text-base text-neutral-950 outline-none placeholder:text-neutral-400 focus:border-[#dbdbdb] focus:outline-none focus:ring-0"
          id="review-store-name"
          maxLength={STORE_NAME_MAX_LENGTH}
          onChange={(event) => setStoreName(event.target.value)}
          placeholder="예시) 네네치킨, 피자스쿨 ... 등"
          required
          type="text"
          value={storeName}
        />
      </section>

      <section className="mb-[30px]">
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          <label className="text-[17px] font-bold leading-6 text-neutral-950" htmlFor="review-menu-name">
            어떤 메뉴예요? <span className="text-[#ff4d5e]">*</span>
          </label>
          <span className="text-[13px] font-normal text-neutral-400">
            {menuName.length}/{MENU_NAME_MAX_LENGTH}
          </span>
        </div>
        <input
          autoComplete="off"
          className="h-12 w-full rounded-none border border-[#dbdbdb] bg-white px-3.5 text-base text-neutral-950 outline-none placeholder:text-neutral-400 focus:border-[#dbdbdb] focus:outline-none focus:ring-0"
          id="review-menu-name"
          maxLength={MENU_NAME_MAX_LENGTH}
          onChange={(event) => setMenuName(event.target.value)}
          placeholder="예시) 고구마피자, 닭강정 ... 등"
          required
          type="text"
          value={menuName}
        />
      </section>

      {renderReferenceField({
        kind: "region",
        label: "지역",
        placeholder: "지역을 선택해 주세요.",
        value: selectedRegionName,
        query: regionQuery,
        requiresSelection: requiresRegionSelection,
      })}

      {renderReferenceField({
        kind: "category",
        label: "카테고리",
        placeholder: "음식 카테고리를 선택해 주세요.",
        value: selectedCategoryName,
        query: categoryQuery,
        requiresSelection: requiresCategorySelection,
      })}

      {renderReviewOptions({
        label: "좋았던 점",
        options: GOOD_REVIEW_OPTIONS,
        values: goodPoints,
        setValues: setGoodPoints,
      })}

      {renderReviewOptions({
        label: "아쉬웠던 점",
        options: BAD_REVIEW_OPTIONS,
        values: badPoints,
        setValues: setBadPoints,
      })}

      <section className="mb-[30px]">
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          <label className="text-[17px] font-bold leading-6 text-neutral-950" htmlFor="review-overall-review">
            남기고 싶은 나의 한마디 <span className="text-[13px] font-normal text-neutral-400">(선택 사항)</span>
          </label>
          <span className="shrink-0 text-[13px] font-normal text-neutral-400">
            {overallReview.length}/{OVERALL_REVIEW_MAX_LENGTH}
          </span>
        </div>
        <p className="-mt-1 mb-2.5 text-xs leading-[1.5] text-neutral-500">
          솔직하고 예쁜 말 한마디가 건강한 리뷰를 만들어요.
        </p>
        <textarea
          className="min-h-[126px] w-full resize-y rounded-none border border-[#dbdbdb] bg-white px-3.5 py-[13px] text-base leading-[1.55] text-neutral-950 outline-none placeholder:text-neutral-400 focus:border-[#dbdbdb] focus:outline-none focus:ring-0"
          id="review-overall-review"
          maxLength={OVERALL_REVIEW_MAX_LENGTH}
          onChange={(event) => setOverallReview(event.target.value)}
          placeholder="예시) 맛있게 먹었는데 아쉽게도 가격에 비해 양이 조금 적은 편이에요."
          value={overallReview}
        />
      </section>

      {errorMessage ? (
        <p aria-live="polite" className="mb-5 bg-neutral-100 px-4 py-3 text-sm font-semibold leading-6 text-neutral-950">
          {errorMessage}
        </p>
      ) : null}

      <section className="-mx-5 -mb-8 border-t border-[#dbdbdb] px-5 pb-[34px] pt-[18px] text-neutral-500" aria-labelledby="review-notice-title">
        <h2 className="mb-2.5 text-base font-bold leading-[1.4] text-neutral-950" id="review-notice-title">
          반드시 확인해 주세요.
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-xs leading-[1.55]">
          <li>직접 경험한 내용을 사실에 맞게 작성해 주세요.</li>
          <li>타인을 모욕하거나 비방하는 표현은 운영 정책에 따라 제한될 수 있어요.</li>
          <li>개인정보, 광고 또는 도배성 내용은 작성하지 말아 주세요.</li>
          <li>서로 존중하는 표현을 사용해 주세요.</li>
        </ul>
      </section>

      {activePicker ? (
        <ReviewPickerDialog
          isOpen
          onClose={closePicker}
          onConfirm={applyPicker}
          options={pickerOptions}
          title={pickerTitle}
          value={pickerValue}
        />
      ) : null}

      <ReviewConfirmDialog
        cancelLabel={confirmMode === "save" ? saveDialog.cancelLabel : leaveDialog.cancelLabel}
        confirmLabel={confirmMode === "save" ? saveDialog.confirmLabel : "나가기"}
        description={confirmMode === "save" ? saveDialog.description : leaveDialog.description}
        isOpen={confirmMode !== null}
        isPending={isSubmitting}
        onCancel={closeConfirm}
        onConfirm={confirmMode === "save" ? saveReview : handleLeave}
        pendingLabel="저장 중..."
        title={confirmMode === "save" ? saveDialog.title : leaveDialog.title}
        tone={confirmMode === "leave" ? "danger" : "primary"}
      />
    </form>
  );
}
