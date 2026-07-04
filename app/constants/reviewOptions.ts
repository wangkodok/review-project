export const REVIEW_OPTION_LIMITS = {
  min: 1,
  max: 3,
} as const;

export const GOOD_REVIEW_OPTIONS = [
  { key: "tasty", label: "맛있어요" },
  { key: "reasonable_price", label: "가격이 합리적이에요" },
  { key: "large_portion", label: "양이 넉넉해요" },
  { key: "kind_service", label: "친절해요" },
  { key: "good_atmosphere", label: "분위기가 좋아요" },
  { key: "fast_serving", label: "음식이 빨리 나와요" },
  { key: "want_revisit", label: "재방문하고 싶어요" },
  { key: "good_alone", label: "혼밥하기 좋아요" },
  { key: "varied_menu", label: "메뉴가 다양해요" },
] as const;

export const BAD_REVIEW_OPTIONS = [
  { key: "expensive", label: "가격이 비싸게 느껴졌어요" },
  { key: "small_portion", label: "양이 적게 느껴졌어요" },
  { key: "slow_serving", label: "음식이 늦게 나왔어요" },
  { key: "long_wait", label: "대기 시간이 길었어요" },
  { key: "not_my_taste", label: "제 입맛에는 맞지 않았어요" },
  { key: "parking_uncomfortable", label: "주차가 불편했어요" },
  { key: "crowded", label: "매장이 조금 붐볐어요" },
  { key: "hard_to_choose", label: "메뉴 선택이 조금 어려웠어요" },
] as const;

export type GoodReviewOptionKey = (typeof GOOD_REVIEW_OPTIONS)[number]["key"];
export type BadReviewOptionKey = (typeof BAD_REVIEW_OPTIONS)[number]["key"];

export type ReviewOption = {
  key: GoodReviewOptionKey | BadReviewOptionKey;
  label: string;
};
