import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth/options";
import { getMyPosts } from "@/app/lib/posts/service";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_PAGE = 10_000;
const MAX_LIMIT = 50;

function parsePositiveNumber(value: string | null, defaultValue: number, maximum: number) {
  if (value === null) {
    return defaultValue;
  }

  const parsedValue = Number(value);

  if (!Number.isSafeInteger(parsedValue) || parsedValue < 1 || parsedValue > maximum) {
    return null;
  }

  return parsedValue;
}

export async function GET(request: Request) {
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
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parsePositiveNumber(
      searchParams.get("page"),
      DEFAULT_PAGE,
      MAX_PAGE,
    );
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

    const data = await getMyPosts({
      userId: session.user.id,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      data,
      message: "내가 작성한 게시글 목록을 조회했습니다.",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: "내가 작성한 게시글을 불러오지 못했습니다.",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
