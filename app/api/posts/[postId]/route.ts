import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth/options";
import { deletePost, getPostDetail, updatePost } from "@/app/lib/posts/service";

type RouteContext = {
  params: Promise<{
    postId: string;
  }>;
};

const TITLE_MIN_LENGTH = 2;
const TITLE_MAX_LENGTH = 50;
const CONTENT_MIN_LENGTH = 10;
const CONTENT_MAX_LENGTH = 3000;

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { postId } = await context.params;
    const session = await getServerSession(authOptions);
    const post = await getPostDetail(postId, session?.user.id);

    if (!post) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "존재하지 않는 게시글입니다.",
          code: "POST_NOT_FOUND",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { post },
      message: "게시글을 조회했습니다.",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: "게시글을 불러오지 못했습니다.",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
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

    const { postId } = await context.params;
    const body = (await request.json()) as {
      title?: unknown;
      content?: unknown;
    };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";

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

    const result = await updatePost({
      postId,
      userId: session.user.id,
      title,
      content,
    });

    if (result.status === "not_found") {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "존재하지 않는 게시글입니다.",
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
          message: "수정 권한이 없습니다.",
          code: "FORBIDDEN",
        },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        post: {
          id: result.post.id,
        },
      },
      message: "게시글이 수정되었습니다.",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: "게시글 수정에 실패했습니다.",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
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

    const { postId } = await context.params;
    const result = await deletePost({
      postId,
      userId: session.user.id,
    });

    if (result.status === "not_found") {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "존재하지 않는 게시글입니다.",
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
          message: "삭제 권한이 없습니다.",
          code: "FORBIDDEN",
        },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: true,
      data: null,
      message: "게시글이 삭제되었습니다.",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: "게시글 삭제에 실패했습니다.",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
