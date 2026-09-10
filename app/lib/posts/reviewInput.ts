import { BAD_REVIEW_OPTIONS, GOOD_REVIEW_OPTIONS } from "@/app/constants/reviewOptions";
import {
  MENU_NAME_MAX_LENGTH,
  MENU_NAME_MIN_LENGTH,
  normalizeOverallReview,
  parseReviewPointKeys,
} from "./structuredReview";

export const STORE_NAME_MIN_LENGTH = 1;
export const STORE_NAME_MAX_LENGTH = 30;

type ReviewInputErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_STORE_NAME"
  | "INVALID_MENU_NAME"
  | "INVALID_REGION"
  | "INVALID_CATEGORY"
  | "INVALID_GOOD_POINTS"
  | "INVALID_BAD_POINTS"
  | "INVALID_OVERALL_REVIEW"
  | "INVALID_UPDATED_AT";

type ReviewWriteInput = {
  storeName: string;
  menuName: string;
  regionId: string;
  categoryId: string;
  goodPoints: string[];
  badPoints: string[];
  overallReview: string | null;
  expectedUpdatedAt?: string;
};

type ReviewInputResult =
  | { success: true; data: ReviewWriteInput }
  | {
      success: false;
      error: {
        code: ReviewInputErrorCode;
        message: string;
      };
    };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function error(code: ReviewInputErrorCode, message: string): ReviewInputResult {
  return { success: false, error: { code, message } };
}

export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export function parseReviewWriteInput(
  value: unknown,
  { requireUpdatedAt = false }: { requireUpdatedAt?: boolean } = {},
): ReviewInputResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return error("INVALID_REQUEST", "요청 내용을 확인해 주세요.");
  }

  const body = value as Record<string, unknown>;
  const storeName = typeof body.storeName === "string" ? body.storeName.trim() : "";
  const menuName = typeof body.menuName === "string" ? body.menuName.trim() : "";
  const regionId = typeof body.regionId === "string" ? body.regionId.trim() : "";
  const categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : "";
  const goodPoints = parseReviewPointKeys(body.goodPoints, GOOD_REVIEW_OPTIONS);
  const badPoints = parseReviewPointKeys(body.badPoints, BAD_REVIEW_OPTIONS);

  if (
    storeName.length < STORE_NAME_MIN_LENGTH ||
    storeName.length > STORE_NAME_MAX_LENGTH
  ) {
    return error(
      "INVALID_STORE_NAME",
      `매장 이름은 ${STORE_NAME_MIN_LENGTH}~${STORE_NAME_MAX_LENGTH}자여야 합니다.`,
    );
  }

  if (menuName.length < MENU_NAME_MIN_LENGTH || menuName.length > MENU_NAME_MAX_LENGTH) {
    return error(
      "INVALID_MENU_NAME",
      `메뉴 이름은 ${MENU_NAME_MIN_LENGTH}~${MENU_NAME_MAX_LENGTH}자여야 합니다.`,
    );
  }

  if (!isUuid(regionId)) {
    return error("INVALID_REGION", "지역을 선택해 주세요.");
  }

  if (!isUuid(categoryId)) {
    return error("INVALID_CATEGORY", "카테고리를 선택해 주세요.");
  }

  if (!goodPoints) {
    return error("INVALID_GOOD_POINTS", "좋았던 점은 1~3개 선택해야 합니다.");
  }

  if (!badPoints) {
    return error("INVALID_BAD_POINTS", "아쉬웠던 점은 1~3개 선택해야 합니다.");
  }

  if (!Object.prototype.hasOwnProperty.call(body, "overallReview")) {
    return error("INVALID_OVERALL_REVIEW", "남기고 싶은 한마디는 300자 이하여야 합니다.");
  }

  const overallReview = normalizeOverallReview(body.overallReview);

  if (overallReview === false || overallReview === undefined) {
    return error("INVALID_OVERALL_REVIEW", "남기고 싶은 한마디는 300자 이하여야 합니다.");
  }

  let expectedUpdatedAt: string | undefined;

  if (requireUpdatedAt) {
    expectedUpdatedAt =
      typeof body.updatedAt === "string" ? body.updatedAt.trim() : "";

    if (
      !expectedUpdatedAt ||
      !ISO_TIMESTAMP_PATTERN.test(expectedUpdatedAt) ||
      Number.isNaN(Date.parse(expectedUpdatedAt))
    ) {
      return error("INVALID_UPDATED_AT", "최신 리뷰 정보를 다시 확인해 주세요.");
    }
  }

  return {
    success: true,
    data: {
      storeName,
      menuName,
      regionId,
      categoryId,
      goodPoints,
      badPoints,
      overallReview,
      expectedUpdatedAt,
    },
  };
}
