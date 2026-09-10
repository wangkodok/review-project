import { describe, expect, it } from "vitest";
import { parseReportInput, REPORT_REASONS } from "./input";

describe("parseReportInput", () => {
  it.each(REPORT_REASONS.filter((reason) => reason !== "other"))(
    "accepts the %s reason without detail",
    (reason) => {
      expect(parseReportInput({ reason })).toEqual({
        success: true,
        data: { reason, detail: null },
      });
    },
  );

  it("trims and accepts a valid other detail", () => {
    expect(
      parseReportInput({
        reason: "other",
        detail: "  신고 내용을 확인해 주세요.  ",
      }),
    ).toEqual({
      success: true,
      data: {
        reason: "other",
        detail: "신고 내용을 확인해 주세요.",
      },
    });
  });

  it.each([null, [], "other", new Date()])(
    "rejects a non-plain request body",
    (value) => {
      expect(parseReportInput(value)).toMatchObject({
        success: false,
        error: { code: "INVALID_REQUEST" },
      });
    },
  );

  it("rejects unknown fields", () => {
    expect(
      parseReportInput({ reason: "off_topic", reporterUserId: "client-value" }),
    ).toMatchObject({
      success: false,
      error: { code: "INVALID_REQUEST" },
    });
  });

  it.each([undefined, "", "   ", "가".repeat(101), "포함\u0000불가"])(
    "rejects an invalid other detail",
    (detail) => {
      expect(parseReportInput({ reason: "other", detail })).toMatchObject({
        success: false,
        error: { code: "INVALID_REPORT_DETAIL" },
      });
    },
  );

  it("counts Unicode code points consistently with the database limit", () => {
    const detail = "😀".repeat(100);

    expect(parseReportInput({ reason: "other", detail })).toEqual({
      success: true,
      data: { reason: "other", detail },
    });
  });

  it("rejects detail for a predefined reason", () => {
    expect(
      parseReportInput({ reason: "off_topic", detail: "추가 내용" }),
    ).toMatchObject({
      success: false,
      error: { code: "INVALID_REPORT_DETAIL" },
    });
  });

  it("rejects an unknown reason", () => {
    expect(parseReportInput({ reason: "unknown" })).toMatchObject({
      success: false,
      error: { code: "INVALID_REPORT_REASON" },
    });
  });
});
