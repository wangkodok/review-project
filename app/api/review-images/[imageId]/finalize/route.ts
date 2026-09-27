import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth/options";
import { isUuid } from "@/app/lib/posts/reviewInput";
import { isReviewImageUploadEnabled } from "@/app/lib/reviewImages/config";
import { ReviewImageError } from "@/app/lib/reviewImages/errors";
import { finalizeReviewImageDirectUpload } from "@/app/lib/reviewImages/service";
import { enforceRateLimit } from "@/app/lib/security/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = {
  params: Promise<{ imageId: string }>;
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

    if (!isReviewImageUploadEnabled()) {
      throw new ReviewImageError(
        "IMAGE_UPLOAD_DISABLED",
        503,
        "사진 업로드를 현재 사용할 수 없습니다.",
      );
    }

    const rateLimitResponse = await enforceRateLimit({
      identifier: session.user.id,
      policy: "reviewImageFinalize",
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const image = await finalizeReviewImageDirectUpload({
      imageId: imageId.toLowerCase(),
      ownerUserId: session.user.id,
    });

    return NextResponse.json(
      {
        success: true,
        data: { image },
        message: "사진 업로드가 완료되었습니다.",
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof ReviewImageError) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: error.message,
          code: error.code,
        },
        { status: error.status, headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json(
      {
        success: false,
        data: null,
        message: "사진 업로드를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
