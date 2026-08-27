import { NextRequest, NextResponse } from "next/server";
import {
  recordVerifiedExternalAuthEvent,
  ExternalAuthEventServiceError,
} from "@/app/lib/auth/externalAuthEvents";
import {
  verifyKakaoAccountEventSet,
  KakaoAccountEventSetError,
  type KakaoAccountEventSetErrorCode,
} from "@/app/lib/auth/kakaoAccountEventSet";
import { recordSecurityEvent } from "@/app/lib/security/securityEvent";

export const runtime = "nodejs";

const KAKAO_SET_CONTENT_TYPE = "application/secevent+jwt";
const MAX_SET_BYTES = 16 * 1024;
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

const ERROR_DESCRIPTIONS: Record<
  Exclude<KakaoAccountEventSetErrorCode, "temporarily_unavailable">,
  string
> = {
  invalid_request: "The SET request is invalid.",
  invalid_key: "The SET signing key or signature is invalid.",
  invalid_issuer: "The SET issuer is invalid.",
  invalid_audience: "The SET audience is invalid.",
};

function isWebhookEnabled() {
  return process.env.AUTH_KAKAO_ACCOUNT_EVENTS_ENABLED === "true";
}

function getMediaType(request: NextRequest) {
  return request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
}

function hasInvalidContentLength(request: NextRequest) {
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
    parsedLength > MAX_SET_BYTES
  );
}

async function readBoundedSetBody(request: NextRequest) {
  if (!request.body) {
    return null;
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

      if (byteLength > MAX_SET_BYTES) {
        await reader.cancel();
        return null;
      }

      chunks.push(value);
    }

    const body = new Uint8Array(byteLength);
    let offset = 0;

    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

function invalidSetResponse(
  code: Exclude<KakaoAccountEventSetErrorCode, "temporarily_unavailable">,
) {
  return NextResponse.json(
    {
      err: code,
      description: ERROR_DESCRIPTIONS[code],
    },
    {
      status: 400,
      headers: NO_STORE_HEADERS,
    },
  );
}

function unavailableResponse() {
  return new NextResponse(null, {
    status: 503,
    headers: NO_STORE_HEADERS,
  });
}

export async function POST(request: NextRequest) {
  if (!isWebhookEnabled()) {
    return new NextResponse(null, {
      status: 404,
      headers: NO_STORE_HEADERS,
    });
  }

  if (
    getMediaType(request) !== KAKAO_SET_CONTENT_TYPE ||
    hasInvalidContentLength(request)
  ) {
    return invalidSetResponse("invalid_request");
  }

  const audience = process.env.AUTH_KAKAO_ID?.trim();

  if (!audience) {
    recordSecurityEvent({
      eventCode: "kakao_webhook_configuration_missing",
    });
    return unavailableResponse();
  }

  const rawSet = await readBoundedSetBody(request);

  if (
    rawSet === null ||
    rawSet.trim().length === 0 ||
    Buffer.byteLength(rawSet, "utf8") > MAX_SET_BYTES
  ) {
    return invalidSetResponse("invalid_request");
  }

  try {
    const event = await verifyKakaoAccountEventSet(rawSet, { audience });
    await recordVerifiedExternalAuthEvent(event);

    return new NextResponse(null, {
      status: 202,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    if (error instanceof KakaoAccountEventSetError) {
      if (error.code === "temporarily_unavailable") {
        recordSecurityEvent({
          eventCode: "kakao_event_verification_unavailable",
        });
        return unavailableResponse();
      }

      return invalidSetResponse(error.code);
    }

    if (
      error instanceof ExternalAuthEventServiceError &&
      error.code === "INVALID_EXTERNAL_AUTH_EVENT"
    ) {
      return invalidSetResponse("invalid_request");
    }

    if (error instanceof ExternalAuthEventServiceError) {
      recordSecurityEvent({
        eventCode: "kakao_event_storage_failed",
        resultCode:
          error.code === "EVENT_STORAGE_FAILED"
            ? "event_storage_failed"
            : "invalid_storage_result",
      });
      return unavailableResponse();
    }

    recordSecurityEvent({
      eventCode: "kakao_webhook_processing_failed",
    });

    return unavailableResponse();
  }
}
