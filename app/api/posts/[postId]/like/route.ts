import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth/options";
import { togglePostLike } from "@/app/lib/posts/likes";
import { enforceRateLimit } from "@/app/lib/security/rateLimit";

type RouteContext = {
  params: Promise<{
    postId: string;
  }>;
};

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export async function POST(_request: Request, context: RouteContext) {
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
      identifier: `user:${session.user.id}`,
      policy: "like",
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { postId } = await context.params;
    const result = await togglePostLike({
      postId,
      userId: session.user.id,
    });

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "존재하지 않는 게시글입니다.",
          code: "POST_NOT_FOUND",
        },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          liked: result.liked,
          likeCount: result.likeCount,
        },
        message: result.liked ? "좋아요를 눌렀습니다." : "좋아요를 취소했습니다.",
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: "좋아요 처리에 실패했습니다.",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
