"use client";

import { Check, Siren } from "lucide-react";
import { useRouter } from "next/navigation";
import { KeyboardEvent, useEffect, useRef, useState } from "react";
import type { ReportReason } from "@/app/lib/reports/input";
import PageBackHeader from "../common/PageBackHeader";
import ReviewConfirmDialog from "./ReviewConfirmDialog";
import {
  canSubmitReviewReport,
  getReviewReportErrorMessage,
  shouldUseReviewHistoryBack,
  type ReviewReportSource,
} from "./reviewReportClient";

const REPORT_REASON_OPTIONS: ReadonlyArray<{
  key: ReportReason;
  label: string;
}> = [
  { key: "inappropriate_content", label: "게시글의 사진이나 정보가 부적절해요." },
  { key: "advertising_or_false_information", label: "광고(홍보) 또는 허위 리뷰예요." },
  { key: "off_topic", label: "서비스 취지에 맞지 않는 리뷰예요." },
  { key: "other", label: "기타" },
];

type ReportResponse = {
  success: boolean;
  data: null;
  message: string;
  code?: string;
};

type ConfirmMode = "leave" | "submit" | null;

export default function ReviewReportForm({
  postId,
  source,
}: {
  postId: string;
  source?: ReviewReportSource;
}) {
  const router = useRouter();
  const reasonButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState("");
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const hasDraft = Boolean(selectedReason) || detail.length > 0;
  const canSubmit = canSubmitReviewReport(selectedReason, detail);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!hasDraft || isComplete || isSubmitting) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasDraft, isComplete, isSubmitting]);

  function returnToReview() {
    const navigationEntry = window.performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming | undefined;
    const canUseHistoryBack = shouldUseReviewHistoryBack({
      source,
      currentUrl: window.location.href,
      documentNavigationUrl: navigationEntry?.name,
    });

    if (canUseHistoryBack) {
      router.back();
      return;
    }

    router.replace("/community");
  }

  function handleBack() {
    if (hasDraft) {
      setConfirmMode("leave");
      return;
    }

    returnToReview();
  }

  function selectReason(reason: ReportReason) {
    if (selectedReason === "other" && reason !== "other") {
      setDetail("");
    }

    setSelectedReason(reason);
    setErrorMessage("");
  }

  function handleReasonKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    let nextIndex = event.key === "ArrowUp" ? index - 1 : index + 1;

    if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = REPORT_REASON_OPTIONS.length - 1;
    }

    nextIndex = (nextIndex + REPORT_REASON_OPTIONS.length) % REPORT_REASON_OPTIONS.length;
    const nextReason = REPORT_REASON_OPTIONS[nextIndex];
    selectReason(nextReason.key);
    reasonButtonRefs.current[nextIndex]?.focus();
  }

  async function submitReport() {
    if (!selectedReason || !canSubmit || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/posts/${postId}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: selectedReason,
          ...(selectedReason === "other" ? { detail: detail.trim() } : {}),
        }),
      });
      const result = (await response.json()) as ReportResponse;

      if (!response.ok || !result.success) {
        setErrorMessage(getReviewReportErrorMessage(result.code));
        return;
      }

      setConfirmMode(null);
      setIsComplete(true);
    } catch {
      setErrorMessage("인터넷 연결을 확인한 후 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isComplete) {
    return (
      <section className="-mx-5 -mb-24 -mt-5 min-h-dvh bg-white px-4 pt-[88px] text-center">
        <span
          aria-hidden="true"
          className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#121212] text-white"
        >
          <Check size={34} strokeWidth={2} />
        </span>
        <h1 className="mt-[18px] text-xl font-bold leading-7 text-[#121212]">
          신고가 접수되었습니다.
        </h1>
        <p className="mx-auto mt-2.5 max-w-80 text-sm leading-[22px] text-[#777777]">
          신고해 주셔서 감사합니다.
          <br />
          확인 후 필요한 조치를 진행하겠습니다.
        </p>
        <button
          className="mt-[42px] h-[52px] w-full bg-[#3399ff] text-base font-bold text-white active:bg-[#2186e8]"
          onClick={returnToReview}
          type="button"
        >
          리뷰로 돌아가기
        </button>
      </section>
    );
  }

  return (
    <section className="-mb-24 min-h-[calc(100dvh-1.25rem)] bg-white">
      <PageBackHeader
        backIconStrokeWidth={1.25}
        fullHeightActions
        onBack={handleBack}
        title="신고하기"
        titleClassName="text-[18px] font-bold leading-7 text-[#121212]"
      />

      <div className="-mx-5">
        <section
          aria-labelledby="report-reason-title"
          className="border-b border-[#dbdbdb] px-4 pb-[30px] pt-8 text-center"
        >
          <span
            aria-hidden="true"
            className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#121212] text-white"
          >
            <Siren size={38} strokeWidth={1.4} />
          </span>
          <h2
            className="mt-4 text-[17px] font-bold leading-[25px] text-[#121212]"
            id="report-reason-title"
          >
            신고하시는 이유가 무엇인가요?
          </h2>
          <p className="mt-[7px] text-[13px] leading-[21px] text-[#777777]">
            신고 내용을 확인한 후
            <br />
            운영 정책에 따라 검토합니다.
          </p>
        </section>

        <ul
          aria-labelledby="report-reason-title"
          className="border-b border-[#dbdbdb]"
          role="radiogroup"
        >
          {REPORT_REASON_OPTIONS.map((option, index) => {
            const isSelected = selectedReason === option.key;

            return (
              <li className="border-b border-[#dbdbdb] last:border-b-0" key={option.key}>
                <button
                  aria-checked={isSelected}
                  className="grid min-h-14 w-full grid-cols-[24px_minmax(0,1fr)] items-center gap-2 px-4 py-2 text-left text-[#121212] active:bg-neutral-50"
                  onClick={() => selectReason(option.key)}
                  onKeyDown={(event) => handleReasonKeyDown(event, index)}
                  ref={(element) => {
                    reasonButtonRefs.current[index] = element;
                  }}
                  role="radio"
                  tabIndex={isSelected || (!selectedReason && index === 0) ? 0 : -1}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className={`grid h-[18px] w-[18px] place-items-center rounded-full border ${
                      isSelected
                        ? "border-[#121212] bg-[#121212] text-white"
                        : "border-[#dbdbdb] bg-white text-transparent"
                    }`}
                  >
                    <Check size={12} strokeWidth={2.4} />
                  </span>
                  <span className="min-w-0 break-words text-base leading-6">
                    {option.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {selectedReason === "other" ? (
          <section className="border-b border-[#dbdbdb] px-4 py-4">
            <div className="flex items-end justify-between gap-2.5">
              <label
                className="max-w-[280px] text-[15px] font-bold leading-[21px] text-[#121212]"
                htmlFor="review-report-detail"
              >
                신고하는 이유를 자세히 작성해 주세요. (필수)
              </label>
              <span className="shrink-0 text-xs leading-[18px] text-[#aaaaaa] tabular-nums">
                {detail.length}/100
              </span>
            </div>
            <p className="mb-2.5 mt-2 text-xs leading-[18px] text-[#777777]">
              신고 내용을 확인할 수 있도록 구체적으로 작성해 주세요.
            </p>
            <textarea
              className="block h-[120px] w-full resize-none rounded-none border border-[#dbdbdb] bg-white p-3 text-[15px] leading-[23px] text-[#121212] outline-none placeholder:text-[#b5b5b5] focus:border-[#dbdbdb] focus:outline-none"
              id="review-report-detail"
              maxLength={100}
              onChange={(event) => {
                setDetail(event.target.value);
                setErrorMessage("");
              }}
              placeholder="예시) 리뷰 내용 중 사실과 다른 부분이 있어요."
              value={detail}
            />
          </section>
        ) : null}

        <div className="px-4 pb-10 pt-8">
          {errorMessage && confirmMode !== "submit" ? (
            <p className="mb-3 text-center text-sm leading-5 text-[#e53545]" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <button
            className="h-[52px] w-full bg-[#f44250] text-base font-bold text-white active:bg-[#dc3543] disabled:bg-[#fac1c6]"
            disabled={!canSubmit || isSubmitting}
            onClick={() => {
              setErrorMessage("");
              setConfirmMode("submit");
            }}
            type="button"
          >
            신고하기
          </button>
        </div>
      </div>

      <ReviewConfirmDialog
        cancelLabel={confirmMode === "leave" ? "계속 작성" : "취소"}
        confirmLabel={confirmMode === "leave" ? "나가기" : "신고"}
        description={
          confirmMode === "leave"
            ? "작성 중인 신고 내용이 저장되지 않습니다.\n그래도 나가시겠습니까?"
            : "신고 내용은 운영 정책에 따라 검토됩니다."
        }
        errorMessage={confirmMode === "submit" ? errorMessage : ""}
        isOpen={confirmMode !== null}
        isPending={isSubmitting}
        onCancel={() => {
          if (!isSubmitting) {
            setErrorMessage("");
            setConfirmMode(null);
          }
        }}
        onConfirm={() => {
          if (confirmMode === "leave") {
            setConfirmMode(null);
            returnToReview();
            return;
          }

          void submitReport();
        }}
        pendingLabel="신고 중..."
        title={confirmMode === "leave" ? "신고 취소" : "이 리뷰를 신고하시겠습니까?"}
        tone="danger"
      />
    </section>
  );
}
