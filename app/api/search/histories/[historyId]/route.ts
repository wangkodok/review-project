import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth/options";
import { deleteSearchHistory } from "@/app/lib/search/histories";

type RouteContext = {
  params: Promise<{
    historyId: string;
  }>;
};

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

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user.id) {
      return unauthorizedResponse();
    }

    const { historyId } = await context.params;
    const result = await deleteSearchHistory(session.user.id, historyId);

    if (result.status === "not_found") {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "최근 검색어를 찾을 수 없습니다.",
          code: "SEARCH_HISTORY_NOT_FOUND",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: null,
      message: "최근 검색어를 삭제했습니다.",
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
