import "server-only";

import { MAX_REVIEW_IMAGE_UPLOAD_BYTES } from "./constants";
import { ReviewImageError } from "./errors";

function parseContentLength(value: string | null) {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new ReviewImageError(
      "INVALID_IMAGE",
      400,
      "사진 요청을 확인해 주세요.",
    );
  }

  return parsed;
}

export async function readReviewImageRequestBody(request: Request) {
  const contentLength = parseContentLength(request.headers.get("content-length"));

  if (contentLength !== null && contentLength > MAX_REVIEW_IMAGE_UPLOAD_BYTES) {
    throw new ReviewImageError(
      "IMAGE_TOO_LARGE",
      413,
      "처리된 사진은 2MB 이하여야 합니다.",
    );
  }

  if (!request.body) {
    throw new ReviewImageError("IMAGE_REQUIRED", 400, "사진을 선택해 주세요.");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    totalBytes += value.byteLength;

    if (totalBytes > MAX_REVIEW_IMAGE_UPLOAD_BYTES) {
      await reader.cancel();
      throw new ReviewImageError(
        "IMAGE_TOO_LARGE",
        413,
        "처리된 사진은 2MB 이하여야 합니다.",
      );
    }

    chunks.push(value);
  }

  if (totalBytes === 0) {
    throw new ReviewImageError("IMAGE_REQUIRED", 400, "사진을 선택해 주세요.");
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return body;
}
