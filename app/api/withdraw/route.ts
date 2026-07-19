import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { authSecret } from "@/app/lib/auth/options";
import { withdrawUser } from "@/app/lib/profile/service";

const RECENT_AUTH_WINDOW_MS = 10 * 60 * 1000;

export async function DELETE(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: authSecret });

    if (!token?.userId) {
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

    const authenticatedAt = token.authenticatedAt;
    const authenticationAge =
      typeof authenticatedAt === "number"
        ? Date.now() - authenticatedAt
        : Number.POSITIVE_INFINITY;

    if (authenticationAge < 0 || authenticationAge > RECENT_AUTH_WINDOW_MS) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: "보안을 위해 Google 계정으로 다시 로그인해 주세요.",
          code: "REAUTHENTICATION_REQUIRED",
        },
        { status: 403 },
      );
    }

    await withdrawUser(token.userId);

    return NextResponse.json({
      success: true,
      data: null,
      message: "회원 탈퇴가 완료되었습니다.",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: "회원 탈퇴에 실패했습니다.",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
