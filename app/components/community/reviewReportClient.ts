import type { ReportReason } from "@/app/lib/reports/input";

export const REVIEW_REPORT_SOURCES = ["community", "search", "detail"] as const;

export type ReviewReportSource = (typeof REVIEW_REPORT_SOURCES)[number];

export function parseReviewReportSource(value: unknown): ReviewReportSource | undefined {
  if (
    typeof value === "string" &&
    REVIEW_REPORT_SOURCES.includes(value as ReviewReportSource)
  ) {
    return value as ReviewReportSource;
  }

  return undefined;
}

export function buildReviewReportHref(postId: string, source: ReviewReportSource) {
  return `/community/${postId}/report?from=${source}`;
}

export function shouldUseReviewHistoryBack({
  source,
  currentUrl,
  documentNavigationUrl,
}: {
  source?: ReviewReportSource;
  currentUrl: string;
  documentNavigationUrl?: string;
}) {
  if (!source || !documentNavigationUrl) {
    return false;
  }

  try {
    const current = new URL(currentUrl);
    const documentNavigation = new URL(documentNavigationUrl);

    return (
      current.origin === documentNavigation.origin &&
      current.href !== documentNavigation.href
    );
  } catch {
    return false;
  }
}

export function canSubmitReviewReport(reason: ReportReason | null, detail: string) {
  return Boolean(reason) && (reason !== "other" || detail.trim().length > 0);
}

export function getReviewReportErrorMessage(code?: string) {
  if (code === "UNAUTHORIZED") {
    return "로그인이 만료되었습니다. 다시 로그인해 주세요.";
  }

  if (code === "SELF_REPORT_NOT_ALLOWED") {
    return "본인이 작성한 리뷰는 신고할 수 없습니다.";
  }

  if (code === "POST_NOT_FOUND") {
    return "삭제되었거나 존재하지 않는 리뷰입니다.";
  }

  if (code === "REPORT_ALREADY_EXISTS") {
    return "이미 신고한 리뷰입니다.";
  }

  if (code === "RATE_LIMIT_EXCEEDED" || code === "RATE_LIMIT_UNAVAILABLE") {
    return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  }

  if (
    code === "INVALID_POST_ID" ||
    code === "INVALID_REQUEST" ||
    code === "INVALID_REPORT_REASON" ||
    code === "INVALID_REPORT_DETAIL"
  ) {
    return "신고 내용을 확인해 주세요.";
  }

  return "신고를 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
