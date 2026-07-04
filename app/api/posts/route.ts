import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { BAD_REVIEW_OPTIONS, GOOD_REVIEW_OPTIONS } from "@/app/constants/reviewOptions";
import { authOptions } from "@/app/lib/auth/options";
import { getActiveCategoryBySlug } from "@/app/lib/categories/service";
import { createPost, getPosts } from "@/app/lib/posts/service";
import {
  buildStructuredReviewContent,
  MENU_NAME_MAX_LENGTH,
  MENU_NAME_MIN_LENGTH,
  parseReviewPointKeys,
} from "@/app/lib/posts/structuredReview";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const TITLE_MIN_LENGTH = 2;
const TITLE_MAX_LENGTH = 50;
const CONTENT_MIN_LENGTH = 10;
const CONTENT_MAX_LENGTH = 3000;
const SORT_VALUES = ["latest", "likes", "views"] as const;

type SortValue = (typeof SORT_VALUES)[number];

function parsePositiveNumber(value: string | null, fallback: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function parseSort(value: string | null): SortValue {
  if (value && SORT_VALUES.includes(value as SortValue)) {
    return value as SortValue;
  }

  return "latest";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parsePositiveNumber(searchParams.get("page"), DEFAULT_PAGE);
    const limit = parsePositiveNumber(searchParams.get("limit"), DEFAULT_LIMIT);
    const search = searchParams.get("search")?.trim() ?? "";
    const sort = parseSort(searchParams.get("sort"));
    const categorySlug = searchParams.get("category")?.trim() || undefined;
    const category = categorySlug ? await getActiveCategoryBySlug(categorySlug) : null;

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

    const session = await getServerSession(authOptions);
    const data = await getPosts({
      page,
      limit,
      search,
      sort,
      currentUserId: session?.user.id,
      categoryId: category?.id,
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

    if (!session?.user.id) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "로그인이 필요합니다.",
          code: "UNAUTHORIZED",
        },
        { status: 401 },
      );
    }

    const body = (await request.json()) as {
      title?: unknown;
      content?: unknown;
      categoryId?: unknown;
      menuName?: unknown;
      goodPoints?: unknown;
      badPoints?: unknown;
    };
    const categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : "";
    const isStructuredReviewRequest =
      body.menuName !== undefined ||
      body.goodPoints !== undefined ||
      body.badPoints !== undefined;
    let title = typeof body.title === "string" ? body.title.trim() : "";
    let content = typeof body.content === "string" ? body.content.trim() : "";
    let menuName: string | undefined;
    let goodPoints: string[] | undefined;
    let badPoints: string[] | undefined;

    if (isStructuredReviewRequest) {
      menuName = typeof body.menuName === "string" ? body.menuName.trim() : "";
      goodPoints = parseReviewPointKeys(body.goodPoints, GOOD_REVIEW_OPTIONS) ?? undefined;
      badPoints = parseReviewPointKeys(body.badPoints, BAD_REVIEW_OPTIONS) ?? undefined;

      if (menuName.length < MENU_NAME_MIN_LENGTH || menuName.length > MENU_NAME_MAX_LENGTH) {
        return NextResponse.json(
          {
            success: false,
            data: null,
            message: "메뉴 이름은 2~50자여야 합니다.",
            code: "INVALID_MENU_NAME",
          },
          { status: 400 },
        );
      }

      if (!goodPoints) {
        return NextResponse.json(
          {
            success: false,
            data: null,
            message: "좋았던 점은 1~3개 선택해야 합니다.",
            code: "INVALID_GOOD_POINTS",
          },
          { status: 400 },
        );
      }

      if (!badPoints) {
        return NextResponse.json(
          {
            success: false,
            data: null,
            message: "아쉬웠던 점은 1~3개 선택해야 합니다.",
            code: "INVALID_BAD_POINTS",
          },
          { status: 400 },
        );
      }

      title = menuName;
      content = buildStructuredReviewContent({ goodPoints, badPoints });
    }

    if (title.length < TITLE_MIN_LENGTH || title.length > TITLE_MAX_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "제목은 2~50자여야 합니다.",
          code: "INVALID_TITLE",
        },
        { status: 400 },
      );
    }

    if (content.length < CONTENT_MIN_LENGTH || content.length > CONTENT_MAX_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "내용은 10~3000자여야 합니다.",
          code: "INVALID_CONTENT",
        },
        { status: 400 },
      );
    }

    const post = await createPost({
      userId: session.user.id,
      title,
      content,
      categoryId,
      menuName,
      goodPoints,
      badPoints,
    });

    if (post.status === "invalid_category") {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "카테고리를 선택해주세요.",
          code: "INVALID_CATEGORY",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: { post: post.post },
        message: "게시글이 등록되었습니다.",
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: "게시글 등록에 실패했습니다.",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
