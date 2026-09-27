import "server-only";

import { randomUUID } from "node:crypto";
import { recordSecurityEvent } from "@/app/lib/security/securityEvent";
import {
  MAX_REVIEW_IMAGE_ORIGINAL_BYTES,
  REVIEW_IMAGE_RESERVATION_MINUTES,
  REVIEW_IMAGE_UPLOAD_URL_SECONDS,
} from "./constants";
import { ReviewImageError } from "./errors";
import { processReviewImage } from "./processor";
import { toReadyReviewImage } from "./publicUrl";
import {
  claimReviewImageTempUpload,
  completeReviewImageDirectUpload,
  completeReviewImageUpload,
  getReviewImageDirectUploadContext,
  queueReviewImageCleanup,
  reserveReviewImageDirectUpload,
  reserveReviewImageUpload,
} from "./repository";
import {
  createReviewImageTempUploadUrl,
  deleteReviewImageObject,
  deleteReviewImageObjectsBestEffort,
  headReviewImageTempObject,
  putReviewImageObject,
  readReviewImageTempObject,
  ReviewImageTempObjectNotFoundError,
  type ReviewImageObjectKeys,
} from "./storage";
import type {
  DeclaredReviewImageMime,
  ReadyReviewImage,
  ReviewImageUploadSlot,
} from "./uploadContract";

function createObjectKeys(imageId: string): ReviewImageObjectKeys {
  return {
    temp: `temp/${imageId}/source`,
    detail: `detail/${imageId}/image.webp`,
    thumbnail: `thumbnail/${imageId}/image.webp`,
  };
}

function reservationExpiry() {
  return new Date(
    Date.now() + REVIEW_IMAGE_RESERVATION_MINUTES * 60 * 1_000,
  ).toISOString();
}

function uploadUrlExpiry() {
  return new Date(
    Date.now() + REVIEW_IMAGE_UPLOAD_URL_SECONDS * 1_000,
  ).toISOString();
}

function mapReservationResult(result: string): never {
  if (result === "upload_in_progress") {
    throw new ReviewImageError(
      "IMAGE_UPLOAD_IN_PROGRESS",
      409,
      "이미 처리 중인 사진이 있습니다. 잠시 후 다시 시도해 주세요.",
    );
  }

  if (result === "quota_exceeded") {
    throw new ReviewImageError(
      "STORAGE_QUOTA_EXCEEDED",
      507,
      "현재 사진 저장 공간이 부족합니다.",
    );
  }

  throw new ReviewImageError(
    "IMAGE_STORAGE_UNAVAILABLE",
    503,
    "사진 저장 서비스를 일시적으로 사용할 수 없습니다.",
  );
}

function storageUnavailable(): ReviewImageError {
  return new ReviewImageError(
    "IMAGE_STORAGE_UNAVAILABLE",
    503,
    "사진을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  );
}

function imageNotFound(): ReviewImageError {
  return new ReviewImageError(
    "IMAGE_NOT_FOUND",
    404,
    "삭제되었거나 존재하지 않는 사진입니다.",
  );
}

function forbiddenImage(): ReviewImageError {
  return new ReviewImageError(
    "FORBIDDEN",
    403,
    "해당 사진을 처리할 수 없습니다.",
  );
}

function uploadInProgress(): ReviewImageError {
  return new ReviewImageError(
    "IMAGE_UPLOAD_IN_PROGRESS",
    409,
    "사진을 처리하고 있습니다. 잠시 후 다시 확인해 주세요.",
  );
}

function readyImageFromContext(
  imageId: string,
  context: {
    detailObjectKey: string | null;
    thumbnailObjectKey: string | null;
    width: number | null;
    height: number | null;
    detailByteSize: number | null;
    thumbnailByteSize: number | null;
  },
): ReadyReviewImage | null {
  if (
    !context.detailObjectKey ||
    !context.thumbnailObjectKey ||
    context.width === null ||
    context.height === null ||
    context.detailByteSize === null ||
    context.thumbnailByteSize === null
  ) {
    return null;
  }

  return toReadyReviewImage({
    imageId,
    detailObjectKey: context.detailObjectKey,
    thumbnailObjectKey: context.thumbnailObjectKey,
    width: context.width,
    height: context.height,
    detailByteSize: context.detailByteSize,
    thumbnailByteSize: context.thumbnailByteSize,
  });
}

async function cleanupFailedDirectUpload(input: {
  imageId: string;
  ownerUserId: string;
  keys: ReviewImageObjectKeys;
}) {
  try {
    await deleteReviewImageObjectsBestEffort(input.keys);
  } catch {
    // The cleanup queue and bucket lifecycle remain as reconciliation paths.
  }

  let cleanupQueued = false;

  try {
    cleanupQueued =
      (await queueReviewImageCleanup({
        imageId: input.imageId,
        ownerUserId: input.ownerUserId,
      })) === "ok";
  } catch {
    // The database reservation remains visible to the expiration worker.
  }

  if (!cleanupQueued) {
    recordSecurityEvent({
      eventCode: "review_image_finalize_failed",
      resultCode: "cleanup_queue_failed",
    });
  }
}

function mapDirectUploadContextFailure(result: string): never {
  if (result === "not_found") {
    throw imageNotFound();
  }

  if (result === "forbidden") {
    throw forbiddenImage();
  }

  throw new ReviewImageError(
    "INVALID_IMAGE",
    400,
    "사진 정보를 확인해 주세요.",
  );
}

async function readReadyImage(input: {
  imageId: string;
  ownerUserId: string;
}) {
  const context = await getReviewImageDirectUploadContext(input);

  if (context.result !== "ok") {
    mapDirectUploadContextFailure(context.result);
  }

  if (context.status !== "ready" && context.status !== "attached") {
    throw storageUnavailable();
  }

  const image = readyImageFromContext(input.imageId, context);

  if (!image) {
    throw storageUnavailable();
  }

  return image;
}

export async function createReviewImageUploadSlot(input: {
  ownerUserId: string;
  byteSize: number;
  mimeType: DeclaredReviewImageMime;
}): Promise<ReviewImageUploadSlot> {
  const imageId = randomUUID();
  const keys = createObjectKeys(imageId);
  const reservation = await reserveReviewImageDirectUpload({
    imageId,
    ownerUserId: input.ownerUserId,
    tempObjectKey: keys.temp,
    detailObjectKey: keys.detail,
    thumbnailObjectKey: keys.thumbnail,
    expectedTempByteSize: input.byteSize,
    declaredSourceMimeType: input.mimeType,
    expiresAt: reservationExpiry(),
  });

  if (reservation.result !== "ok") {
    mapReservationResult(reservation.result);
  }

  try {
    const expiresAt = uploadUrlExpiry();
    const uploadUrl = await createReviewImageTempUploadUrl({
      key: keys.temp,
      contentType: input.mimeType,
    });

    return {
      imageId,
      uploadUrl,
      expiresAt,
      requiredHeaders: { "Content-Type": input.mimeType },
    };
  } catch {
    let cleanupQueued = false;

    try {
      const cleanupResult = await queueReviewImageCleanup({
        imageId,
        ownerUserId: input.ownerUserId,
      });
      cleanupQueued = cleanupResult === "ok";
    } catch {
      // The reservation remains visible for the cleanup reconciliation task.
    }

    recordSecurityEvent({
      eventCode: "review_image_presign_failed",
      resultCode: cleanupQueued ? "cleanup_queued" : "cleanup_queue_failed",
    });

    throw new ReviewImageError(
      "IMAGE_STORAGE_UNAVAILABLE",
      503,
      "사진 업로드를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }
}

export async function finalizeReviewImageDirectUpload(input: {
  imageId: string;
  ownerUserId: string;
}): Promise<ReadyReviewImage> {
  let context: Awaited<ReturnType<typeof getReviewImageDirectUploadContext>>;

  try {
    context = await getReviewImageDirectUploadContext(input);
  } catch {
    throw storageUnavailable();
  }

  if (context.result !== "ok") {
    mapDirectUploadContextFailure(context.result);
  }

  if (context.status === "ready" || context.status === "attached") {
    const image = readyImageFromContext(input.imageId, context);

    if (!image) {
      throw storageUnavailable();
    }

    return image;
  }

  if (context.status === "processing") {
    throw uploadInProgress();
  }

  if (context.status !== "uploading") {
    throw imageNotFound();
  }

  if (
    !context.tempObjectKey ||
    !context.detailObjectKey ||
    !context.thumbnailObjectKey ||
    context.expectedTempByteSize === null
  ) {
    throw storageUnavailable();
  }

  const keys = createObjectKeys(input.imageId);

  if (
    context.tempObjectKey !== keys.temp ||
    context.detailObjectKey !== keys.detail ||
    context.thumbnailObjectKey !== keys.thumbnail
  ) {
    throw storageUnavailable();
  }

  let shouldCleanup = true;

  try {
    let head: Awaited<ReturnType<typeof headReviewImageTempObject>>;

    try {
      head = await headReviewImageTempObject(keys.temp);
    } catch (error) {
      if (error instanceof ReviewImageTempObjectNotFoundError) {
        throw imageNotFound();
      }

      throw storageUnavailable();
    }

    if (head.byteSize > MAX_REVIEW_IMAGE_ORIGINAL_BYTES) {
      throw new ReviewImageError(
        "IMAGE_TOO_LARGE",
        413,
        "사진 용량은 10MB 이하여야 합니다.",
      );
    }

    if (head.byteSize !== context.expectedTempByteSize) {
      throw new ReviewImageError(
        "INVALID_IMAGE",
        422,
        "업로드된 사진 크기를 확인해 주세요.",
      );
    }

    const claim = await claimReviewImageTempUpload({
      imageId: input.imageId,
      ownerUserId: input.ownerUserId,
      tempByteSize: head.byteSize,
    });

    if (claim === "processing") {
      shouldCleanup = false;
      throw uploadInProgress();
    }

    if (claim === "ready") {
      shouldCleanup = false;
      return await readReadyImage(input);
    }

    if (claim === "not_found") {
      throw imageNotFound();
    }

    if (claim === "forbidden") {
      shouldCleanup = false;
      throw forbiddenImage();
    }

    if (claim === "expired") {
      throw new ReviewImageError(
        "IMAGE_UPLOAD_EXPIRED",
        410,
        "사진 업로드 시간이 만료되었습니다. 다시 선택해 주세요.",
      );
    }

    if (claim === "size_mismatch") {
      throw new ReviewImageError(
        "INVALID_IMAGE",
        422,
        "업로드된 사진 크기를 확인해 주세요.",
      );
    }

    if (claim !== "ok") {
      throw storageUnavailable();
    }

    const body = await readReviewImageTempObject(keys.temp);

    if (body.byteLength !== head.byteSize) {
      throw new ReviewImageError(
        "INVALID_IMAGE",
        422,
        "업로드된 사진 크기를 확인해 주세요.",
      );
    }

    const processed = await processReviewImage(body);
    const image = toReadyReviewImage({
      imageId: input.imageId,
      detailObjectKey: keys.detail,
      thumbnailObjectKey: keys.thumbnail,
      width: processed.detail.info.width,
      height: processed.detail.info.height,
      detailByteSize: processed.detail.data.byteLength,
      thumbnailByteSize: processed.thumbnail.data.byteLength,
    });

    if (!image) {
      throw storageUnavailable();
    }

    await putReviewImageObject({
      bucket: "public",
      key: keys.detail,
      body: processed.detail.data,
      contentType: "image/webp",
      cacheControl: "public, max-age=31536000, immutable",
    });
    await putReviewImageObject({
      bucket: "public",
      key: keys.thumbnail,
      body: processed.thumbnail.data,
      contentType: "image/webp",
      cacheControl: "public, max-age=31536000, immutable",
    });
    await deleteReviewImageObject("temp", keys.temp);

    const completion = await completeReviewImageDirectUpload({
      imageId: input.imageId,
      ownerUserId: input.ownerUserId,
      detailObjectKey: keys.detail,
      thumbnailObjectKey: keys.thumbnail,
      width: processed.detail.info.width,
      height: processed.detail.info.height,
      sourceMimeType: processed.inputMimeType,
      detailByteSize: processed.detail.data.byteLength,
      thumbnailByteSize: processed.thumbnail.data.byteLength,
      tempDeleted: true,
    });

    if (completion === "not_found") {
      throw imageNotFound();
    }

    if (completion === "forbidden") {
      throw forbiddenImage();
    }

    if (completion !== "ok") {
      throw storageUnavailable();
    }

    return image;
  } catch (error) {
    if (shouldCleanup) {
      await cleanupFailedDirectUpload({ ...input, keys });
    }

    if (error instanceof ReviewImageError) {
      throw error;
    }

    throw storageUnavailable();
  }
}

export async function createReadyReviewImage(input: {
  ownerUserId: string;
  body: Uint8Array;
}) {
  const processed = await processReviewImage(input.body);
  const imageId = randomUUID();
  const keys = createObjectKeys(imageId);
  const reservation = await reserveReviewImageUpload({
    imageId,
    ownerUserId: input.ownerUserId,
    tempObjectKey: keys.temp,
    detailObjectKey: keys.detail,
    thumbnailObjectKey: keys.thumbnail,
    expiresAt: reservationExpiry(),
  });

  if (reservation.result !== "ok") {
    mapReservationResult(reservation.result);
  }

  try {
    await putReviewImageObject({
      bucket: "temp",
      key: keys.temp,
      body: input.body,
      contentType: processed.inputMimeType,
      cacheControl: "no-store",
    });
    await putReviewImageObject({
      bucket: "public",
      key: keys.detail,
      body: processed.detail.data,
      contentType: "image/webp",
      cacheControl: "public, max-age=31536000, immutable",
    });
    await putReviewImageObject({
      bucket: "public",
      key: keys.thumbnail,
      body: processed.thumbnail.data,
      contentType: "image/webp",
      cacheControl: "public, max-age=31536000, immutable",
    });

    await deleteReviewImageObject("temp", keys.temp);

    const completion = await completeReviewImageUpload({
      imageId,
      ownerUserId: input.ownerUserId,
      detailObjectKey: keys.detail,
      thumbnailObjectKey: keys.thumbnail,
      width: processed.detail.info.width,
      height: processed.detail.info.height,
      tempByteSize: input.body.byteLength,
      detailByteSize: processed.detail.data.byteLength,
      thumbnailByteSize: processed.thumbnail.data.byteLength,
    });

    if (completion !== "ok") {
      throw new Error("Review image completion returned an invalid state");
    }

    return {
      id: imageId,
      width: processed.detail.info.width,
      height: processed.detail.info.height,
      detailByteSize: processed.detail.data.byteLength,
      thumbnailByteSize: processed.thumbnail.data.byteLength,
    };
  } catch {
    await deleteReviewImageObjectsBestEffort(keys);
    let cleanupQueued = true;

    try {
      await queueReviewImageCleanup({
        imageId,
        ownerUserId: input.ownerUserId,
      });
    } catch {
      cleanupQueued = false;
      // The reservation remains visible for the later reconciliation task.
    }

    recordSecurityEvent({
      eventCode: "review_image_storage_failed",
      resultCode: cleanupQueued ? "cleanup_queued" : "cleanup_queue_failed",
    });

    throw new ReviewImageError(
      "IMAGE_STORAGE_UNAVAILABLE",
      503,
      "사진을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }
}

export async function cancelReviewImage(input: {
  imageId: string;
  ownerUserId: string;
}) {
  const result = await queueReviewImageCleanup(input);

  if (result === "ok") {
    return { status: "ok" as const };
  }

  if (result === "not_found") {
    return { status: "not_found" as const };
  }

  if (result === "forbidden") {
    return { status: "forbidden" as const };
  }

  throw new Error("Review image cancellation returned an invalid state");
}
