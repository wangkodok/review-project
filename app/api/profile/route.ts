import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth/options";
import { getProfile, isValidNickname, updateNickname } from "@/app/lib/profile/service";

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

    const user = await getProfile(session.user.id);

    return NextResponse.json({
      success: true,
      data: {
        user,
      },
      message: "내 정보를 조회했습니다.",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: "내 정보 처리에 실패했습니다.",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user.id) {
      return unauthorizedResponse();
    }

    const body = (await request.json()) as {
      nickname?: unknown;
    };
    const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";

    if (!isValidNickname(nickname)) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "닉네임은 한글 또는 영문 2~6자여야 합니다.",
          code: "INVALID_NICKNAME",
        },
        { status: 400 },
      );
    }

    const result = await updateNickname({
      userId: session.user.id,
      nickname,
    });

    if (result.status === "limited") {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "닉네임은 30일마다 변경할 수 있습니다.",
          code: "NICKNAME_CHANGE_LIMIT",
        },
        { status: 429 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        user: result.user,
      },
      message: "닉네임이 변경되었습니다.",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: "내 정보 처리에 실패했습니다.",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
