import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth/options";
import { isUuid } from "@/app/lib/posts/reviewInput";
import { parseReportInput } from "@/app/lib/reports/input";
import { createReviewReport } from "@/app/lib/reports/service";
import { enforceRateLimit } from "@/app/lib/security/rateLimit";

export const runtime = "nodejs";

const MAX_REPORT_BODY_BYTES = 2 * 1024;
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

type RouteContext = {
  params: Promise<{
    postId: string;
  }>;
};

function reportResponse(
  body: {
    success: boolean;
    data: null;
    message: string;
    code?: string;
  },
  status: number,
) {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

function hasJsonContentType(request: Request) {
  return (
    request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase() === "application/json"
  );
}

function hasInvalidContentLength(request: Request) {
  const contentLength = request.headers.get("content-length");

  if (contentLength === null) {
    return false;
  }

  if (!/^\d+$/.test(contentLength)) {
    return true;
  }

  const parsedLength = Number(contentLength);
  return (
    !Number.isSafeInteger(parsedLength) ||
    parsedLength < 0 ||
    parsedLength > MAX_REPORT_BODY_BYTES
  );
}

async function readBoundedJsonBody(request: Request): Promise<unknown | undefined> {
  if (!request.body) {
    return undefined;
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      byteLength += value.byteLength;

      if (byteLength > MAX_REPORT_BODY_BYTES) {
        await reader.cancel();
        return undefined;
      }

      chunks.push(value);
    }

    if (byteLength === 0) {
      return undefined;
    }

    const body = new Uint8Array(byteLength);
    let offset = 0;

    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const rawBody = new TextDecoder("utf-8", { fatal: true }).decode(body);

    if (!rawBody.trim()) {
      return undefined;
    }

    return JSON.parse(rawBody) as unknown;
  } catch {
    return undefined;
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return reportResponse(
        {
          success: false,
          data: null,
          message: "로그인이 필요합니다.",
          code: "UNAUTHORIZED",
        },
        401,
      );
    }

    const { postId } = await context.params;

    if (!isUuid(postId)) {
      return reportResponse(
        {
          success: false,
          data: null,
          message: "리뷰 주소를 확인해 주세요.",
          code: "INVALID_POST_ID",
        },
        400,
      );
    }

    if (!hasJsonContentType(request) || hasInvalidContentLength(request)) {
      return reportResponse(
        {
          success: false,
          data: null,
          message: "요청 내용을 확인해 주세요.",
          code: "INVALID_REQUEST",
        },
        400,
      );
    }

    const body = await readBoundedJsonBody(request);
    const parsed = parseReportInput(body);

    if (!parsed.success) {
      return reportResponse(
        {
          success: false,
          data: null,
          message: parsed.error.message,
          code: parsed.error.code,
        },
        400,
      );
    }

    const rateLimitResponse = await enforceRateLimit({
      identifier: session.user.id,
      policy: "report",
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const result = await createReviewReport({
      postId,
      reporterUserId: session.user.id,
      reason: parsed.data.reason,
      detail: parsed.data.detail,
    });

    if (result.status === "not_found") {
      return reportResponse(
        {
          success: false,
          data: null,
          message: "삭제되었거나 존재하지 않는 리뷰입니다.",
          code: "POST_NOT_FOUND",
        },
        404,
      );
    }

    if (result.status === "self_report") {
      return reportResponse(
        {
          success: false,
          data: null,
          message: "본인이 작성한 리뷰는 신고할 수 없습니다.",
          code: "SELF_REPORT_NOT_ALLOWED",
        },
        403,
      );
    }

    if (result.status === "duplicate") {
      return reportResponse(
        {
          success: false,
          data: null,
          message: "이미 신고한 리뷰입니다.",
          code: "REPORT_ALREADY_EXISTS",
        },
        409,
      );
    }

    return reportResponse(
      {
        success: true,
        data: null,
        message: "신고가 접수되었습니다.",
      },
      201,
    );
  } catch {
    return reportResponse(
      {
        success: false,
        data: null,
        message: "신고를 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        code: "INTERNAL_SERVER_ERROR",
      },
      500,
    );
  }
}
