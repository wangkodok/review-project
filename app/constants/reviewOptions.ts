export const REVIEW_OPTION_LIMITS = {
  min: 1,
  max: 3,
} as const;

export const GOOD_REVIEW_OPTIONS = [
  { key: "tasty", label: "맛있어요" },
  { key: "generous_portion", label: "양이 많아요" },
  { key: "affordable_price", label: "저렴해요" },
  { key: "very_delicious", label: "꿀맛 인정" },
  { key: "good_for_solo", label: "혼밥 맛집" },
  { key: "clean_store", label: "깔끔한 매장" },
  { key: "great_value", label: "가성비 왕" },
  { key: "great_pairing", label: "환상 조합" },
  { key: "impressive_taste", label: "감동의 맛" },
] as const;

export const BAD_REVIEW_OPTIONS = [
  { key: "crowded_store", label: "방문 당시 사람이 많았어요" },
  { key: "small_portion_feeling", label: "양이 적게 느껴졌어요" },
  { key: "long_wait_time", label: "기다리는 시간이 있었어요" },
  { key: "ordinary_taste", label: "맛이 평범하게 느껴졌어요" },
  { key: "no_parking", label: "방문 당시 주차가 어려웠어요" },
  { key: "mixed_preference", label: "제 취향과는 조금 달랐어요" },
  { key: "restroom_issue", label: "화장실 이용이 불편했어요" },
  { key: "narrow_seat", label: "좌석이 좁게 느껴졌어요" },
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
