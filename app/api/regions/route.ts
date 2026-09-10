import { NextResponse } from "next/server";
import { getActiveRegions } from "@/app/lib/regions/service";

export async function GET() {
  try {
    const regions = await getActiveRegions();

    return NextResponse.json({
      success: true,
      data: { regions },
      message: "지역 목록을 조회했습니다.",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: "지역 목록을 불러오지 못했습니다.",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
