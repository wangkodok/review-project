import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth/options";
import { isReviewImageUploadEnabled } from "@/app/lib/reviewImages/config";
import { ReviewImageError } from "@/app/lib/reviewImages/errors";
import { readReviewImageRequestBody } from "@/app/lib/reviewImages/requestBody";
import { createReadyReviewImage } from "@/app/lib/reviewImages/service";
import { enforceRateLimit } from "@/app/lib/security/rateLimit";

export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

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

    if (!isReviewImageUploadEnabled()) {
      throw new ReviewImageError(
        "IMAGE_UPLOAD_DISABLED",
        503,
        "사진 업로드를 현재 사용할 수 없습니다.",
      );
    }

    const rateLimitResponse = await enforceRateLimit({
      identifier: session.user.id,
      policy: "reviewImageUpload",
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await readReviewImageRequestBody(request);
    const image = await createReadyReviewImage({
      ownerUserId: session.user.id,
      body,
    });

    return NextResponse.json(
      {
        success: true,
        data: { image },
        message: "사진이 준비되었습니다.",
      },
      { status: 201, headers: NO_STORE_HEADERS },
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
        message: "사진을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
