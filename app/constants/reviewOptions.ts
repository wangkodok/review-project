export const REVIEW_OPTION_LIMITS = {
  min: 1,
  max: 3,
} as const;

export const GOOD_REVIEW_OPTIONS = [
  { key: "tasty", label: "맛있게 먹었어요" },
  { key: "generous_portion", label: "양이 많아요" },
  { key: "affordable_price", label: "저렴해요" },
  { key: "very_delicious", label: "꿀맛인정" },
  { key: "good_for_solo", label: "혼밥맛집" },
  { key: "clean_store", label: "깨끗한 매장이에요" },
  { key: "great_value", label: "가성비왕" },
  { key: "great_pairing", label: "환상조합" },
  { key: "impressive_taste", label: "감동의맛" },
  { key: "must_visit", label: "맛집" },
] as const;

export const BAD_REVIEW_OPTIONS = [
  { key: "crowded_store", label: "사람이 많아요" },
  { key: "small_portion_feeling", label: "양이 적게 느껴졌어요" },
  { key: "long_wait_time", label: "대기 시간" },
  { key: "ordinary_taste", label: "평범한맛" },
  { key: "no_parking", label: "주차불가" },
  { key: "mixed_preference", label: "호불호" },
  { key: "restroom_issue", label: "화장실" },
  { key: "narrow_seat", label: "좌석협소" },
  { key: "slow_cooking_time", label: "조리시간" },
] as const;

export type GoodReviewOptionKey = (typeof GOOD_REVIEW_OPTIONS)[number]["key"];
export type BadReviewOptionKey = (typeof BAD_REVIEW_OPTIONS)[number]["key"];

export type ReviewOption = {
  key: GoodReviewOptionKey | BadReviewOptionKey;
  label: string;
};

export const GOOD_REVIEW_OPTION_LABEL_MAP = new Map<string, string>(
  GOOD_REVIEW_OPTIONS.map((option) => [option.key, option.label]),
);

export const BAD_REVIEW_OPTION_LABEL_MAP = new Map<string, string>(
  BAD_REVIEW_OPTIONS.map((option) => [option.key, option.label]),
);

export function getGoodPointLabel(key: string) {
  return GOOD_REVIEW_OPTION_LABEL_MAP.get(key) ?? null;
}

export function getBadPointLabel(key: string) {
  return BAD_REVIEW_OPTION_LABEL_MAP.get(key) ?? null;
}

export function getReviewPointLabel(key: string) {
  return getGoodPointLabel(key) ?? getBadPointLabel(key);
}

export function isValidGoodPointKey(key: string) {
  return GOOD_REVIEW_OPTION_LABEL_MAP.has(key);
}

export function isValidBadPointKey(key: string) {
  return BAD_REVIEW_OPTION_LABEL_MAP.has(key);
}
