import { describe, expect, it } from "vitest";
import {
  buildReviewReportHref,
  canSubmitReviewReport,
  getReviewReportErrorMessage,
  parseReviewReportSource,
  shouldUseReviewHistoryBack,
} from "./reviewReportClient";

describe("review report client helpers", () => {
  it("accepts only approved internal return sources", () => {
    expect(parseReviewReportSource("community")).toBe("community");
    expect(parseReviewReportSource("search")).toBe("search");
    expect(parseReviewReportSource("detail")).toBe("detail");
    expect(parseReviewReportSource("https://example.com")).toBeUndefined();
    expect(parseReviewReportSource(["community"])).toBeUndefined();
  });

  it("builds a report URL with an internal source enum", () => {
    expect(buildReviewReportHref("post-id", "search")).toBe(
      "/community/post-id/report?from=search",
    );
  });

  it("uses browser back only after an internal same-document navigation", () => {
    expect(
      shouldUseReviewHistoryBack({
        source: "community",
        currentUrl: "http://localhost/community/post-id/report?from=community",
        documentNavigationUrl: "http://localhost/community",
      }),
    ).toBe(true);
    expect(
      shouldUseReviewHistoryBack({
        source: "community",
        currentUrl: "http://localhost/community/post-id/report?from=community",
        documentNavigationUrl:
          "http://localhost/community/post-id/report?from=community",
      }),
    ).toBe(false);
    expect(
      shouldUseReviewHistoryBack({
        source: "community",
        currentUrl: "http://localhost/community/post-id/report?from=community",
        documentNavigationUrl: "https://example.com/community",
      }),
    ).toBe(false);
  });

  it("requires non-blank detail only for the other reason", () => {
    expect(canSubmitReviewReport(null, "")).toBe(false);
    expect(canSubmitReviewReport("inappropriate_content", "")).toBe(true);
    expect(canSubmitReviewReport("other", "   ")).toBe(false);
    expect(canSubmitReviewReport("other", "구체적인 신고 내용")).toBe(true);
  });

  it("maps known API failures to user-facing messages", () => {
    expect(getReviewReportErrorMessage("REPORT_ALREADY_EXISTS")).toBe(
      "이미 신고한 리뷰입니다.",
    );
    expect(getReviewReportErrorMessage("SELF_REPORT_NOT_ALLOWED")).toBe(
      "본인이 작성한 리뷰는 신고할 수 없습니다.",
    );
    expect(getReviewReportErrorMessage()).toBe(
      "신고를 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  });
});
