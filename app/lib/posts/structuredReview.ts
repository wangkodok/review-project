import {
  BAD_REVIEW_OPTIONS,
  BAD_REVIEW_OPTION_LABEL_MAP,
  GOOD_REVIEW_OPTIONS,
  GOOD_REVIEW_OPTION_LABEL_MAP,
} from "@/app/constants/reviewOptions";

type ReviewOption = {
  key: string;
  label: string;
};

export const MENU_NAME_MIN_LENGTH = 2;
export const MENU_NAME_MAX_LENGTH = 50;
export const OVERALL_REVIEW_MAX_LENGTH = 300;
export const REVIEW_POINT_MIN_COUNT = 1;
export const REVIEW_POINT_MAX_COUNT = 3;

export const goodReviewOptionMap = GOOD_REVIEW_OPTION_LABEL_MAP;
export const badReviewOptionMap = BAD_REVIEW_OPTION_LABEL_MAP;

export function parseReviewPointKeys(value: unknown, allowedOptions: readonly ReviewOption[]) {
  if (!Array.isArray(value)) {
    return null;
  }

  const allowedKeys = new Set(allowedOptions.map((option) => option.key));
  const keys = value.map((item) => (typeof item === "string" ? item.trim() : ""));
  const uniqueKeys = new Set(keys);

  if (
    keys.length < REVIEW_POINT_MIN_COUNT ||
    keys.length > REVIEW_POINT_MAX_COUNT ||
    uniqueKeys.size !== keys.length ||
    keys.some((key) => !allowedKeys.has(key))
  ) {
    return null;
  }

  return keys;
}

export function normalizeOverallReview(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return false;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  if (trimmedValue.length > OVERALL_REVIEW_MAX_LENGTH) {
    return false;
  }

  return trimmedValue;
}

export function toReviewPointLabels(keys: string[], optionMap: Map<string, string>) {
  return keys.map((key) => optionMap.get(key)).filter((label): label is string => Boolean(label));
}

export function getReviewOptionKeysByLabelSearch(keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();

  if (!normalizedKeyword) {
    return {
      goodPointKeys: [],
      badPointKeys: [],
    };
  }

  return {
    goodPointKeys: GOOD_REVIEW_OPTIONS.filter((option) =>
      option.label.toLowerCase().includes(normalizedKeyword),
    ).map((option) => option.key),
    badPointKeys: BAD_REVIEW_OPTIONS.filter((option) =>
      option.label.toLowerCase().includes(normalizedKeyword),
    ).map((option) => option.key),
  };
}

export function buildStructuredReviewContent({
  goodPoints,
  badPoints,
}: {
  goodPoints: string[];
  badPoints: string[];
}) {
  const goodPointLabels = toReviewPointLabels(goodPoints, goodReviewOptionMap);
  const badPointLabels = toReviewPointLabels(badPoints, badReviewOptionMap);

  return `좋았던 점: ${goodPointLabels.join(", ")}\n아쉬웠던 점: ${badPointLabels.join(", ")}`;
}
