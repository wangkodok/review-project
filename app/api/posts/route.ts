import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth/options";
import { getActiveCategoryBySlug } from "@/app/lib/categories/service";
import { createPost, getPosts } from "@/app/lib/posts/service";
import { parseReviewWriteInput } from "@/app/lib/posts/reviewInput";
import { getActiveRegionBySlug } from "@/app/lib/regions/service";
import { enforceRateLimit, getRequestIp } from "@/app/lib/security/rateLimit";
import { buildStructuredReviewContent } from "@/app/lib/posts/structuredReview";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_PAGE = 10_000;
const MAX_LIMIT = 20;
const SORT_VALUES = ["latest", "likes", "views"] as const;
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

type SortValue = (typeof SORT_VALUES)[number];

function parsePositiveNumber(value: string | null, fallback: number, maximum?: number) {
  if (value === null) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1 || (maximum && parsed > maximum)) {
    return null;
  }

  return parsed;
}

function parseSort(value: string | null): SortValue | null {
  if (value === null) {
    return "latest";
  }

  return SORT_VALUES.includes(value as SortValue) ? (value as SortValue) : null;
}

export async function GET(request: Request) {
  try {
    const rateLimitResponse = await enforceRateLimit({
      identifier: getRequestIp(request),
      policy: "posts",
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { searchParams } = new URL(request.url);
    const page = parsePositiveNumber(searchParams.get("page"), DEFAULT_PAGE, MAX_PAGE);
    const limit = parsePositiveNumber(searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);

    if (page === null || limit === null) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: `page는 1~${MAX_PAGE}, limit은 1~${MAX_LIMIT} 사이의 정수여야 합니다.`,
          code: "INVALID_PAGINATION",
        },
        { status: 400 },
      );
    }
    const search = searchParams.get("search")?.trim() ?? "";
    const sort = parseSort(searchParams.get("sort"));
    const categorySlug = searchParams.get("category")?.trim() || undefined;
    const regionSlug = searchParams.get("region")?.trim() || undefined;

    if (search.length > 30) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "검색어는 30자 이하여야 합니다.",
          code: "INVALID_SEARCH_KEYWORD",
        },
        { status: 400 },
      );
    }

    if (!sort) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "선택할 수 없는 정렬 방식입니다.",
          code: "INVALID_SORT",
        },
        { status: 400 },
      );
    }

    const [category, region] = await Promise.all([
      categorySlug ? getActiveCategoryBySlug(categorySlug) : null,
      regionSlug ? getActiveRegionBySlug(regionSlug) : null,
    ]);

    if (categorySlug && !category) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "선택할 수 없는 카테고리입니다.",
          code: "INVALID_CATEGORY",
        },
        { status: 400 },
      );
    }

    if (regionSlug && !region) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "선택할 수 없는 지역입니다.",
          code: "INVALID_REGION",
        },
        { status: 400 },
      );
    }

    const session = await getServerSession(authOptions);
    const data = await getPosts({
      page,
      limit,
      search,
      sort,
      currentUserId: session?.user?.id,
      categoryId: category?.id,
      regionId: region?.id,
    });

    return NextResponse.json({
      success: true,
      data,
      message: "게시글 목록을 조회했습니다.",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: "게시글 목록을 불러오지 못했습니다.",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "로그인이 필요합니다.",
          code: "UNAUTHORIZED",
        },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }

    const rateLimitResponse = await enforceRateLimit({
      identifier: session.user.id,
      policy: "reviewCreate",
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "요청 내용을 확인해 주세요.",
          code: "INVALID_REQUEST",
        },
        { status: 400 },
      );
    }

    const parsed = parseReviewWriteInput(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: parsed.error.message,
          code: parsed.error.code,
        },
        { status: 400 },
      );
    }

    const review = parsed.data;
    const content = buildStructuredReviewContent({
      goodPoints: review.goodPoints,
      badPoints: review.badPoints,
    });

    const post = await createPost({
      userId: session.user.id,
      storeName: review.storeName,
      regionId: review.regionId,
      title: review.menuName,
      content,
      categoryId: review.categoryId,
      menuName: review.menuName,
      goodPoints: review.goodPoints,
      badPoints: review.badPoints,
      overallReview: review.overallReview,
    });

    if (post.status === "invalid_category") {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "선택할 수 없는 카테고리입니다.",
          code: "INVALID_CATEGORY",
        },
        { status: 400 },
      );
    }

    if (post.status === "invalid_region") {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "선택할 수 없는 지역입니다.",
          code: "INVALID_REGION",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: { post: post.post },
        message: "리뷰가 저장되었습니다.",
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: "리뷰를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
