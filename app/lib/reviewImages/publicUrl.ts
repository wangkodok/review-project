import "server-only";

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
