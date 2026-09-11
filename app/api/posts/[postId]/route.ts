import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth/options";
import { deletePost, getPostDetail, updatePost } from "@/app/lib/posts/service";
import { isUuid, parseReviewWriteInput } from "@/app/lib/posts/reviewInput";
import { buildStructuredReviewContent } from "@/app/lib/posts/structuredReview";
import { enforceRateLimit, getRequestIp } from "@/app/lib/security/rateLimit";

type RouteContext = {
  params: Promise<{
    postId: string;
  }>;
};

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export async function GET(request: Request, context: RouteContext) {
  try {
    const rateLimitResponse = await enforceRateLimit({
      identifier: getRequestIp(request),
      policy: "posts",
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { postId } = await context.params;

    if (!isUuid(postId)) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "리뷰 주소를 확인해 주세요.",
          code: "INVALID_POST_ID",
        },
        { status: 400 },
      );
    }

    const session = await getServerSession(authOptions);
    const post = await getPostDetail(postId, session?.user?.id);

    if (!post) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "삭제되었거나 존재하지 않는 리뷰입니다.",
          code: "POST_NOT_FOUND",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { post },
      message: "리뷰를 조회했습니다.",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: "리뷰를 불러오지 못했습니다.",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
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

    const { postId } = await context.params;

    if (!isUuid(postId)) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "리뷰 주소를 확인해 주세요.",
          code: "INVALID_POST_ID",
        },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const rateLimitResponse = await enforceRateLimit({
      identifier: session.user.id,
      policy: "reviewManage",
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
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const parsed = parseReviewWriteInput(body, { requireUpdatedAt: true });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: parsed.error.message,
          code: parsed.error.code,
        },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const review = parsed.data;
    const content = buildStructuredReviewContent({
      goodPoints: review.goodPoints,
      badPoints: review.badPoints,
    });

    const result = await updatePost({
      postId,
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
      expectedUpdatedAt: review.expectedUpdatedAt!,
    });

    if (result.status === "not_found") {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "삭제되었거나 존재하지 않는 리뷰입니다.",
          code: "POST_NOT_FOUND",
        },
        { status: 404 },
      );
    }

    if (result.status === "forbidden") {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "해당 리뷰는 수정할 수 없습니다.",
          code: "FORBIDDEN",
        },
        { status: 403, headers: NO_STORE_HEADERS },
      );
    }

    if (result.status === "invalid_category") {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "선택할 수 없는 카테고리입니다.",
          code: "INVALID_CATEGORY",
        },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (result.status === "invalid_region") {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "선택할 수 없는 지역입니다.",
          code: "INVALID_REGION",
        },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (result.status === "conflict") {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "리뷰가 다른 곳에서 변경되었습니다. 최신 내용을 다시 확인해 주세요.",
          code: "REVIEW_CONFLICT",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        post: {
          id: result.post.id,
          updatedAt: result.post.updatedAt,
        },
      },
      message: "리뷰가 수정되었습니다.",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: "리뷰를 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}

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

    const { postId } = await context.params;

    if (!isUuid(postId)) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "리뷰 주소를 확인해 주세요.",
          code: "INVALID_POST_ID",
        },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const rateLimitResponse = await enforceRateLimit({
      identifier: session.user.id,
      policy: "reviewManage",
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const result = await deletePost({
      postId,
      userId: session.user.id,
    });

    if (result.status === "not_found") {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "삭제되었거나 존재하지 않는 리뷰입니다.",
          code: "POST_NOT_FOUND",
        },
        { status: 404 },
      );
    }

    if (result.status === "forbidden") {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "해당 리뷰는 삭제할 수 없습니다.",
          code: "FORBIDDEN",
        },
        { status: 403, headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json({
      success: true,
      data: null,
      message: "리뷰가 삭제되었습니다.",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: "리뷰를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
