import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth/options";
import { normalizeSearchKeyword, searchPosts } from "@/app/lib/search/service";
import { enforceRateLimit, getRequestIp } from "@/app/lib/security/rateLimit";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;

function parsePositiveNumber(value: string | null, fallback: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

export async function GET(request: Request) {
  try {
    const rateLimitResponse = await enforceRateLimit({
      identifier: getRequestIp(request),
      policy: "search",
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { searchParams } = new URL(request.url);
    const keyword = normalizeSearchKeyword(searchParams.get("q"));

    if (!keyword) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "검색어는 1~30자여야 합니다.",
          code: "INVALID_SEARCH_KEYWORD",
        },
        { status: 400 },
      );
    }

    const page = parsePositiveNumber(searchParams.get("page"), DEFAULT_PAGE);
    const requestedLimit = parsePositiveNumber(searchParams.get("limit"), DEFAULT_LIMIT);
    const limit = Math.min(requestedLimit, MAX_LIMIT);
    const session = await getServerSession(authOptions);
    const data = await searchPosts({
      keyword,
      page,
      limit,
      currentUserId: session?.user.id,
    });

    return NextResponse.json({
      success: true,
      data,
      message: "게시글을 검색했습니다.",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: "게시글 검색에 실패했습니다.",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
