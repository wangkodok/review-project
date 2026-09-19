import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth/options";
import { cancelReviewImage } from "@/app/lib/reviewImages/service";
import { isUuid } from "@/app/lib/posts/reviewInput";
import { enforceRateLimit } from "@/app/lib/security/rateLimit";

type RouteContext = {
  params: Promise<{ imageId: string }>;
};

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export async function DELETE(_request: Request, context: RouteContext) {
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

    const { imageId } = await context.params;

    if (!isUuid(imageId)) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "사진 주소를 확인해 주세요.",
          code: "INVALID_IMAGE_ID",
        },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const rateLimitResponse = await enforceRateLimit({
      identifier: session.user.id,
      policy: "reviewImageUpload",
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const result = await cancelReviewImage({
      imageId,
      ownerUserId: session.user.id,
    });

    if (result.status === "not_found") {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "삭제되었거나 존재하지 않는 사진입니다.",
          code: "IMAGE_NOT_FOUND",
        },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }

    if (result.status === "forbidden") {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "해당 사진은 삭제할 수 없습니다.",
          code: "FORBIDDEN",
        },
        { status: 403, headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: null,
        message: "사진 정리를 요청했습니다.",
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: "사진을 정리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
