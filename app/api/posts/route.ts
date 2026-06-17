import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth/options";
import { createPost, getPosts } from "@/app/lib/posts/service";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const SORT_VALUES = ["latest", "likes", "views"] as const;

type SortValue = (typeof SORT_VALUES)[number];

function parsePositiveNumber(value: string | null, fallback: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function parseSort(value: string | null): SortValue {
  if (value && SORT_VALUES.includes(value as SortValue)) {
    return value as SortValue;
  }

  return "latest";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parsePositiveNumber(searchParams.get("page"), DEFAULT_PAGE);
    const limit = parsePositiveNumber(searchParams.get("limit"), DEFAULT_LIMIT);
    const search = searchParams.get("search")?.trim() ?? "";
    const sort = parseSort(searchParams.get("sort"));

    const data = await getPosts({ page, limit, search, sort });

    return NextResponse.json({
      success: true,
      data,
      message: "게시글 목록을 조회했습니다.",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: "게시글 목록을 불러오지 못했습니다.",
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

    const body = (await request.json()) as { title?: unknown; content?: unknown };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";

    if (title.length < 2 || title.length > 50) {
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

    if (content.length < 10 || content.length > 3000) {
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

    const post = await createPost({
      userId: session.user.id,
      title,
      content,
    });

    return NextResponse.json(
      {
        success: true,
        data: { post },
        message: "게시글이 등록되었습니다.",
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: "게시글 등록에 실패했습니다.",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
