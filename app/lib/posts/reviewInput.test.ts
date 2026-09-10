import { describe, expect, it } from "vitest";
import { parseReviewWriteInput } from "./reviewInput";

const REGION_ID = "11111111-1111-4111-8111-111111111111";
const CATEGORY_ID = "22222222-2222-4222-8222-222222222222";
const UPDATED_AT = "2026-09-07T12:00:00.000Z";

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    storeName: " 냉면과고기집 ",
    menuName: " 물냉면 ",
    regionId: REGION_ID,
    categoryId: CATEGORY_ID,
    goodPoints: ["tasty"],
    badPoints: ["long_wait_time"],
    overallReview: " 다시 방문하고 싶어요. ",
    ...overrides,
  };
}

describe("parseReviewWriteInput", () => {
  it("normalizes a valid review payload", () => {
    expect(parseReviewWriteInput(validInput())).toEqual({
      success: true,
      data: {
        storeName: "냉면과고기집",
        menuName: "물냉면",
        regionId: REGION_ID,
        categoryId: CATEGORY_ID,
        goodPoints: ["tasty"],
        badPoints: ["long_wait_time"],
        overallReview: "다시 방문하고 싶어요.",
        expectedUpdatedAt: undefined,
      },
    });
  });

  it.each([
    ["non-object body", null, "INVALID_REQUEST"],
    ["blank store", validInput({ storeName: "   " }), "INVALID_STORE_NAME"],
    ["long store", validInput({ storeName: "가".repeat(31) }), "INVALID_STORE_NAME"],
    ["blank menu", validInput({ menuName: "" }), "INVALID_MENU_NAME"],
    ["long menu", validInput({ menuName: "가".repeat(31) }), "INVALID_MENU_NAME"],
    ["invalid region", validInput({ regionId: "seoul" }), "INVALID_REGION"],
    ["invalid category", validInput({ categoryId: "korean" }), "INVALID_CATEGORY"],
    ["missing good points", validInput({ goodPoints: [] }), "INVALID_GOOD_POINTS"],
    [
      "duplicate good points",
      validInput({ goodPoints: ["tasty", "tasty"] }),
      "INVALID_GOOD_POINTS",
    ],
    [
      "deprecated good point",
      validInput({ goodPoints: ["must_visit"] }),
      "INVALID_GOOD_POINTS",
    ],
    ["missing bad points", validInput({ badPoints: [] }), "INVALID_BAD_POINTS"],
    [
      "deprecated bad point",
      validInput({ badPoints: ["slow_cooking_time"] }),
      "INVALID_BAD_POINTS",
    ],
    [
      "long overall review",
      validInput({ overallReview: "가".repeat(301) }),
      "INVALID_OVERALL_REVIEW",
    ],
  ])("rejects %s", (_name, value, expectedCode) => {
    const result = parseReviewWriteInput(value);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(expectedCode);
    }
  });

  it("accepts the exact store and menu boundaries", () => {
    expect(
      parseReviewWriteInput(validInput({ storeName: "가", menuName: "나" })).success,
    ).toBe(true);
    expect(
      parseReviewWriteInput(
        validInput({ storeName: "가".repeat(30), menuName: "나".repeat(30) }),
      ).success,
    ).toBe(true);
  });

  it("requires an explicit optional-review field", () => {
    const input: Record<string, unknown> = validInput();
    delete input.overallReview;

    const result = parseReviewWriteInput(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_OVERALL_REVIEW");
    }
  });

  it("normalizes an empty optional review to null", () => {
    const result = parseReviewWriteInput(validInput({ overallReview: "   " }));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.overallReview).toBeNull();
    }
  });

  it("requires a valid updatedAt value for edits", () => {
    const missing = parseReviewWriteInput(validInput(), { requireUpdatedAt: true });
    const invalid = parseReviewWriteInput(validInput({ updatedAt: "not-a-date" }), {
      requireUpdatedAt: true,
    });
    const valid = parseReviewWriteInput(validInput({ updatedAt: UPDATED_AT }), {
      requireUpdatedAt: true,
    });

    expect(missing.success).toBe(false);
    expect(invalid.success).toBe(false);
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.expectedUpdatedAt).toBe(UPDATED_AT);
    }
  });
});
