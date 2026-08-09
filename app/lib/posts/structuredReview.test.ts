import { describe, expect, it } from "vitest";

import {
  BAD_REVIEW_OPTIONS,
  GOOD_REVIEW_OPTIONS,
  getBadPointLabel,
  getGoodPointLabel,
  getReviewPointLabel,
  isValidBadPointKey,
  isValidGoodPointKey,
} from "@/app/constants/reviewOptions";
import {
  OVERALL_REVIEW_MAX_LENGTH,
  buildStructuredReviewContent,
  getReviewOptionKeysByLabelSearch,
  normalizeOverallReview,
  parseReviewPointKeys,
  toReviewPointLabels,
} from "./structuredReview";

describe("parseReviewPointKeys", () => {
  it("trims and returns valid unique keys", () => {
    expect(
      parseReviewPointKeys([" tasty ", "generous_portion"], GOOD_REVIEW_OPTIONS),
    ).toEqual(["tasty", "generous_portion"]);
  });

  it.each([
    ["non-array", "tasty"],
    ["empty", []],
    ["too many", ["tasty", "generous_portion", "affordable_price", "clean_store"]],
    ["duplicate after trimming", ["tasty", " tasty "]],
    ["unknown key", ["unknown"]],
    ["non-string item", [1]],
  ])("rejects %s input", (_caseName, value) => {
    expect(parseReviewPointKeys(value, GOOD_REVIEW_OPTIONS)).toBeNull();
  });
});

describe("normalizeOverallReview", () => {
  it("preserves an omitted value", () => {
    expect(normalizeOverallReview(undefined)).toBeUndefined();
  });

  it.each([null, "", "   "])("normalizes %p to null", (value) => {
    expect(normalizeOverallReview(value)).toBeNull();
  });

  it("trims valid text", () => {
    expect(normalizeOverallReview("  다시 방문하고 싶어요.  ")).toBe(
      "다시 방문하고 싶어요.",
    );
  });

  it("accepts exactly 300 characters and rejects 301 characters", () => {
    expect(normalizeOverallReview("가".repeat(OVERALL_REVIEW_MAX_LENGTH))).toBe(
      "가".repeat(OVERALL_REVIEW_MAX_LENGTH),
    );
    expect(
      normalizeOverallReview("가".repeat(OVERALL_REVIEW_MAX_LENGTH + 1)),
    ).toBe(false);
  });

  it("rejects a non-string value", () => {
    expect(normalizeOverallReview(123)).toBe(false);
  });
});

describe("review option labels", () => {
  it("keeps key order and filters unknown labels", () => {
    expect(
      toReviewPointLabels(
        ["generous_portion", "unknown", "tasty"],
        new Map(GOOD_REVIEW_OPTIONS.map((option) => [option.key, option.label])),
      ),
    ).toEqual(["양이 많아요", "맛있게 먹었어요"]);
  });

  it("looks up labels and validates keys by review group", () => {
    expect(getGoodPointLabel("tasty")).toBe("맛있게 먹었어요");
    expect(getBadPointLabel("no_parking")).toBe("주차불가");
    expect(getReviewPointLabel("mixed_preference")).toBe("호불호");
    expect(getReviewPointLabel("unknown")).toBeNull();
    expect(isValidGoodPointKey("tasty")).toBe(true);
    expect(isValidGoodPointKey("no_parking")).toBe(false);
    expect(isValidBadPointKey("no_parking")).toBe(true);
    expect(isValidBadPointKey("tasty")).toBe(false);
  });
});

describe("getReviewOptionKeysByLabelSearch", () => {
  it("returns no keys for a blank keyword", () => {
    expect(getReviewOptionKeysByLabelSearch("   ")).toEqual({
      goodPointKeys: [],
      badPointKeys: [],
    });
  });

  it("finds matching good and bad review labels", () => {
    expect(getReviewOptionKeysByLabelSearch("맛있게")).toEqual({
      goodPointKeys: ["tasty"],
      badPointKeys: [],
    });
    expect(getReviewOptionKeysByLabelSearch("주차")).toEqual({
      goodPointKeys: [],
      badPointKeys: ["no_parking"],
    });
  });
});

describe("buildStructuredReviewContent", () => {
  it("builds the legacy-compatible content from option keys", () => {
    expect(
      buildStructuredReviewContent({
        goodPoints: ["tasty", "great_value"],
        badPoints: ["no_parking"],
      }),
    ).toBe(
      "좋았던 점: 맛있게 먹었어요, 가성비왕\n아쉬웠던 점: 주차불가",
    );
  });
});

describe("review option fixtures", () => {
  it("keeps every configured option key unique", () => {
    const allKeys = [...GOOD_REVIEW_OPTIONS, ...BAD_REVIEW_OPTIONS].map(
      (option) => option.key,
    );

    expect(new Set(allKeys).size).toBe(allKeys.length);
  });
});
