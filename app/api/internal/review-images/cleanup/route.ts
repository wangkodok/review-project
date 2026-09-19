import { NextResponse } from "next/server";
import { getReviewImageCleanupAuthStatus } from "@/app/lib/reviewImages/cleanupAuth";
import { runReviewImageCleanup } from "@/app/lib/reviewImages/cleanup";
import { recordSecurityEvent } from "@/app/lib/security/securityEvent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const authStatus = getReviewImageCleanupAuthStatus(
    request.headers.get("authorization"),
  );

  if (authStatus === "misconfigured") {
    recordSecurityEvent({
      eventCode: "review_image_cleanup_failed",
      resultCode: "configuration_missing",
    });

    return NextResponse.json(
      {
        success: false,
        data: null,
        message: "정리 작업을 현재 실행할 수 없습니다.",
        code: "CLEANUP_UNAVAILABLE",
      },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  if (authStatus !== "authorized") {
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: "인증되지 않은 요청입니다.",
        code: "UNAUTHORIZED",
      },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const result = await runReviewImageCleanup();

    if (result.completionFailed > 0 || result.failed > 0) {
      recordSecurityEvent({
        eventCode: "review_image_cleanup_failed",
        resultCode:
          result.failed > 0 ? "permanent_failure" : "job_completion_failed",
      });
    }

    const hasUnresolvedFailure = result.completionFailed > 0 || result.failed > 0;

    return NextResponse.json(
      {
        success: !hasUnresolvedFailure,
        data: { cleanup: result },
        message: hasUnresolvedFailure
          ? "일부 사진 정리 작업을 완료하지 못했습니다."
          : "사진 정리 작업을 완료했습니다.",
        code: hasUnresolvedFailure ? "CLEANUP_PARTIAL_FAILURE" : null,
      },
      {
        status: hasUnresolvedFailure ? 503 : 200,
        headers: NO_STORE_HEADERS,
      },
    );
  } catch {
    recordSecurityEvent({
      eventCode: "review_image_cleanup_failed",
      resultCode: "execution_failed",
    });

    return NextResponse.json(
      {
        success: false,
        data: null,
        message: "사진 정리 작업을 완료하지 못했습니다.",
        code: "CLEANUP_FAILED",
      },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}
