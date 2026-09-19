import "server-only";

import { randomUUID } from "node:crypto";
import { recordSecurityEvent } from "@/app/lib/security/securityEvent";
import { REVIEW_IMAGE_RESERVATION_MINUTES } from "./constants";
import { ReviewImageError } from "./errors";
import { processReviewImage } from "./processor";
import {
  completeReviewImageUpload,
  queueReviewImageCleanup,
  reserveReviewImageUpload,
} from "./repository";
import {
  deleteReviewImageObject,
  deleteReviewImageObjectsBestEffort,
  putReviewImageObject,
  type ReviewImageObjectKeys,
} from "./storage";

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
