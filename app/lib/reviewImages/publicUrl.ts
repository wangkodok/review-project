import "server-only";

import type { ReadyReviewImage } from "./uploadContract";

export type PublicReviewImage = {
  detailUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
};

export type ReviewImageRelationRow = {
  status: string;
  detail_object_key: string | null;
  thumbnail_object_key: string | null;
  width: number | null;
  height: number | null;
};

type RelatedReviewImage = ReviewImageRelationRow | ReviewImageRelationRow[] | null;
const IMAGE_ID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const DETAIL_OBJECT_KEY_PATTERN = new RegExp(`^detail/${IMAGE_ID_PATTERN}/image\\.webp$`, "i");
const THUMBNAIL_OBJECT_KEY_PATTERN = new RegExp(
  `^thumbnail/${IMAGE_ID_PATTERN}/image\\.webp$`,
  "i",
);

function getPublicBaseUrl() {
  const value = process.env.REVIEW_IMAGE_PUBLIC_BASE_URL?.trim();

  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
      return null;
    }

    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function encodeObjectKey(objectKey: string) {
  return objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function getSingleImage(value: RelatedReviewImage) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function toPublicReviewImage(value: RelatedReviewImage): PublicReviewImage | null {
  const image = getSingleImage(value);
  const baseUrl = getPublicBaseUrl();

  if (
    !baseUrl ||
    !image ||
    image.status !== "attached" ||
    !image.detail_object_key ||
    !DETAIL_OBJECT_KEY_PATTERN.test(image.detail_object_key) ||
    !image.thumbnail_object_key ||
    !THUMBNAIL_OBJECT_KEY_PATTERN.test(image.thumbnail_object_key) ||
    !Number.isInteger(image.width) ||
    !Number.isInteger(image.height) ||
    (image.width ?? 0) <= 0 ||
    (image.height ?? 0) <= 0
  ) {
    return null;
  }

  return {
    detailUrl: `${baseUrl}/${encodeObjectKey(image.detail_object_key)}`,
    thumbnailUrl: `${baseUrl}/${encodeObjectKey(image.thumbnail_object_key)}`,
    width: image.width as number,
    height: image.height as number,
  };
}

export function toReadyReviewImage(input: {
  imageId: string;
  detailObjectKey: string;
  thumbnailObjectKey: string;
  width: number;
  height: number;
  detailByteSize: number;
  thumbnailByteSize: number;
}): ReadyReviewImage | null {
  const baseUrl = getPublicBaseUrl();
  const expectedDetailKey = `detail/${input.imageId}/image.webp`;
  const expectedThumbnailKey = `thumbnail/${input.imageId}/image.webp`;

  if (
    !baseUrl ||
    !new RegExp(`^${IMAGE_ID_PATTERN}$`, "i").test(input.imageId) ||
    input.detailObjectKey !== expectedDetailKey ||
    input.thumbnailObjectKey !== expectedThumbnailKey ||
    !DETAIL_OBJECT_KEY_PATTERN.test(input.detailObjectKey) ||
    !THUMBNAIL_OBJECT_KEY_PATTERN.test(input.thumbnailObjectKey) ||
    !Number.isInteger(input.width) ||
    !Number.isInteger(input.height) ||
    !Number.isInteger(input.detailByteSize) ||
    !Number.isInteger(input.thumbnailByteSize) ||
    input.width < 1 ||
    input.height < 1 ||
    input.detailByteSize < 1 ||
    input.thumbnailByteSize < 1
  ) {
    return null;
  }

  return {
    imageId: input.imageId,
    detailUrl: `${baseUrl}/${encodeObjectKey(input.detailObjectKey)}`,
    thumbnailUrl: `${baseUrl}/${encodeObjectKey(input.thumbnailObjectKey)}`,
    width: input.width,
    height: input.height,
    detailByteSize: input.detailByteSize,
    thumbnailByteSize: input.thumbnailByteSize,
  };
}
