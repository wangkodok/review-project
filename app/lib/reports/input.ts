export const REPORT_REASONS = [
  "inappropriate_content",
  "advertising_or_false_information",
  "off_topic",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

type ReportInput = {
  reason: ReportReason;
  detail: string | null;
};

type ReportInputErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_REPORT_REASON"
  | "INVALID_REPORT_DETAIL";

type ReportInputResult =
  | { success: true; data: ReportInput }
  | {
      success: false;
      error: {
        code: ReportInputErrorCode;
        message: string;
      };
    };

const ALLOWED_FIELDS = new Set(["reason", "detail"]);

function error(code: ReportInputErrorCode, message: string): ReportInputResult {
  return { success: false, error: { code, message } };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isReportReason(value: unknown): value is ReportReason {
  return (
    typeof value === "string" &&
    REPORT_REASONS.includes(value as ReportReason)
  );
}

export function parseReportInput(value: unknown): ReportInputResult {
  if (!isPlainObject(value)) {
    return error("INVALID_REQUEST", "요청 내용을 확인해 주세요.");
  }

  if (Object.keys(value).some((field) => !ALLOWED_FIELDS.has(field))) {
    return error("INVALID_REQUEST", "요청 내용을 확인해 주세요.");
  }

  if (!isReportReason(value.reason)) {
    return error("INVALID_REPORT_REASON", "신고 사유를 선택해 주세요.");
  }

  if (value.reason !== "other") {
    if (value.detail !== undefined && value.detail !== null) {
      return error(
        "INVALID_REPORT_DETAIL",
        "신고 내용을 1~100자로 작성해 주세요.",
      );
    }

    return {
      success: true,
      data: { reason: value.reason, detail: null },
    };
  }

  if (typeof value.detail !== "string") {
    return error(
      "INVALID_REPORT_DETAIL",
      "신고 내용을 1~100자로 작성해 주세요.",
    );
  }

  const detail = value.detail.trim();
  const detailLength = Array.from(detail).length;

  if (detailLength < 1 || detailLength > 100 || detail.includes("\u0000")) {
    return error(
      "INVALID_REPORT_DETAIL",
      "신고 내용을 1~100자로 작성해 주세요.",
    );
  }

  return {
    success: true,
    data: { reason: value.reason, detail },
  };
}
