import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth/options";
import {
  clearSearchHistories,
  getSearchHistories,
  recordSearchHistory,
} from "@/app/lib/search/histories";

function unauthorizedResponse() {
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

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user.id) {
      return unauthorizedResponse();
    }

    const histories = await getSearchHistories(session.user.id);

    return NextResponse.json({
      success: true,
      data: { histories },
      message: "최근 검색어를 조회했습니다.",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: "최근 검색어를 불러오지 못했습니다.",
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
      return unauthorizedResponse();
    }

    const body = (await request.json()) as { keyword?: unknown };
    const result = await recordSearchHistory(session.user.id, body.keyword);

    if (result.status === "invalid_keyword") {
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

    return NextResponse.json(
      {
        success: true,
        data: null,
        message: "최근 검색어를 저장했습니다.",
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: "최근 검색어 저장에 실패했습니다.",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user.id) {
      return unauthorizedResponse();
    }

    await clearSearchHistories(session.user.id);

    return NextResponse.json({
      success: true,
      data: null,
      message: "최근 검색어를 모두 삭제했습니다.",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: "최근 검색어 삭제에 실패했습니다.",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
