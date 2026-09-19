import "server-only";

import sharp, { type OutputInfo } from "sharp";
import {
  MAX_REVIEW_IMAGE_DETAIL_BYTES,
  MAX_REVIEW_IMAGE_EDGE,
  MAX_REVIEW_IMAGE_INPUT_PIXELS,
  MAX_REVIEW_IMAGE_THUMBNAIL_BYTES,
  REVIEW_IMAGE_THUMBNAIL_EDGE,
} from "./constants";
import { ReviewImageError } from "./errors";

const SUPPORTED_FORMATS = new Set(["jpeg", "png", "webp"]);
const DETAIL_QUALITIES = [82, 76, 70, 64, 58, 52];
const DETAIL_EDGES = [MAX_REVIEW_IMAGE_EDGE, 1_440, 1_280, 1_120, 960];
const THUMBNAIL_QUALITIES = [76, 68, 60, 52, 44];

type EncodedImage = {
  data: Buffer;
  info: OutputInfo;
};

export type ProcessedReviewImage = {
  inputMimeType: "image/jpeg" | "image/png" | "image/webp";
  detail: EncodedImage;
  thumbnail: EncodedImage;
};

function toMimeType(format: string): ProcessedReviewImage["inputMimeType"] {
  if (format === "jpeg") {
    return "image/jpeg";
  }

  if (format === "png") {
    return "image/png";
  }

  return "image/webp";
}

function imagePipeline(input: Uint8Array) {
  return sharp(input, {
    animated: true,
    limitInputPixels: MAX_REVIEW_IMAGE_INPUT_PIXELS,
  });
}

async function encodeDetail(input: Uint8Array) {
  for (const edge of DETAIL_EDGES) {
    for (const quality of DETAIL_QUALITIES) {
      const output = await imagePipeline(input)
        .rotate()
        .resize({
          width: edge,
          height: edge,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality, effort: 4 })
        .toBuffer({ resolveWithObject: true });

      if (output.data.byteLength <= MAX_REVIEW_IMAGE_DETAIL_BYTES) {
        return output;
      }
    }
  }

  throw new ReviewImageError(
    "IMAGE_PROCESSING_FAILED",
    422,
    "사진을 저장 크기에 맞게 처리하지 못했습니다.",
  );
}

async function encodeThumbnail(input: Uint8Array) {
  for (const quality of THUMBNAIL_QUALITIES) {
    const output = await imagePipeline(input)
      .rotate()
      .resize(REVIEW_IMAGE_THUMBNAIL_EDGE, REVIEW_IMAGE_THUMBNAIL_EDGE, {
        fit: "cover",
        position: "centre",
      })
      .webp({ quality, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    if (output.data.byteLength <= MAX_REVIEW_IMAGE_THUMBNAIL_BYTES) {
      return output;
    }
  }

  throw new ReviewImageError(
    "IMAGE_PROCESSING_FAILED",
    422,
    "사진을 저장 크기에 맞게 처리하지 못했습니다.",
  );
}

export async function processReviewImage(
  input: Uint8Array,
): Promise<ProcessedReviewImage> {
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;

  try {
    metadata = await imagePipeline(input).metadata();
  } catch {
    throw new ReviewImageError(
      "INVALID_IMAGE",
      422,
      "사진 파일을 확인해 주세요.",
    );
  }

  if (!metadata.format || !SUPPORTED_FORMATS.has(metadata.format)) {
    throw new ReviewImageError(
      "UNSUPPORTED_IMAGE_TYPE",
      415,
      "JPEG, PNG, WebP 사진만 올릴 수 있어요.",
    );
  }

  if (!metadata.width || !metadata.height || (metadata.pages ?? 1) !== 1) {
    throw new ReviewImageError(
      "INVALID_IMAGE",
      422,
      "한 장으로 된 사진 파일을 선택해 주세요.",
    );
  }

  try {
    const [detail, thumbnail] = await Promise.all([
      encodeDetail(input),
      encodeThumbnail(input),
    ]);

    return {
      inputMimeType: toMimeType(metadata.format),
      detail,
      thumbnail,
    };
  } catch (error) {
    if (error instanceof ReviewImageError) {
      throw error;
    }

    throw new ReviewImageError(
      "IMAGE_PROCESSING_FAILED",
      422,
      "사진을 처리하지 못했습니다. 다른 사진을 선택해 주세요.",
    );
  }
}
