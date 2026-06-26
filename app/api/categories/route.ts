import { NextResponse } from "next/server";
import { getActiveCategories } from "@/app/lib/categories/service";

export async function GET() {
  try {
    const categories = await getActiveCategories();

    return NextResponse.json({
      success: true,
      data: { categories },
      message: "카테고리 목록을 조회했습니다.",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: "카테고리 목록을 불러오지 못했습니다.",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
