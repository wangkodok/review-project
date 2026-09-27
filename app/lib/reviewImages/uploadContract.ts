import {
  ACTUAL_REVIEW_IMAGE_MIME_TYPES,
  DECLARED_REVIEW_IMAGE_MIME_TYPES,
  MAX_REVIEW_IMAGE_ORIGINAL_BYTES,
} from "./constants";
import { ReviewImageError } from "./errors";

export type DeclaredReviewImageMime =
  (typeof DECLARED_REVIEW_IMAGE_MIME_TYPES)[number];
export type ActualReviewImageMime =
  (typeof ACTUAL_REVIEW_IMAGE_MIME_TYPES)[number];

export type ReviewImageUploadRequest = {
  byteSize: number;
  mimeType: DeclaredReviewImageMime;
};

export type ReviewImageUploadSlot = {
  imageId: string;
  uploadUrl: string;
  expiresAt: string;
  requiredHeaders: { "Content-Type": DeclaredReviewImageMime };
};

export type ReadyReviewImage = {
  imageId: string;
  width: number;
  height: number;
  detailByteSize: number;
  thumbnailByteSize: number;
  detailUrl: string;
  thumbnailUrl: string;
};

const declaredMimeTypes = new Set<string>(DECLARED_REVIEW_IMAGE_MIME_TYPES);

function invalidRequest(): never {
  throw new ReviewImageError(
    "INVALID_IMAGE",
    400,
    "사진 정보를 확인해 주세요.",
  );
}

function normalizeDeclaredMimeType(value: unknown): DeclaredReviewImageMime {
  if (typeof value !== "string") {
    throw new ReviewImageError(
      "UNSUPPORTED_IMAGE_TYPE",
      415,
      "지원하지 않는 사진 형식입니다.",
    );
  }

  const normalized = value.trim().toLowerCase() || "application/octet-stream";

  if (!declaredMimeTypes.has(normalized)) {
    throw new ReviewImageError(
      "UNSUPPORTED_IMAGE_TYPE",
      415,
      "지원하지 않는 사진 형식입니다.",
    );
  }

  return normalized as DeclaredReviewImageMime;
}

export function parseReviewImageUploadRequest(
  value: unknown,
): ReviewImageUploadRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalidRequest();
  }

  const record = value as Record<string, unknown>;
  const byteSize = record.byteSize;

  if (typeof byteSize !== "number" || !Number.isInteger(byteSize) || byteSize < 1) {
    invalidRequest();
  }

  if (byteSize > MAX_REVIEW_IMAGE_ORIGINAL_BYTES) {
    throw new ReviewImageError(
      "IMAGE_TOO_LARGE",
      413,
      "사진 용량은 10MB 이하여야 합니다.",
    );
  }

  return {
    byteSize,
    mimeType: normalizeDeclaredMimeType(record.mimeType),
  };
}
