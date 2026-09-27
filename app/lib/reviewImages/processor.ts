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
import { decodeSingleHeic } from "./heicDecoder";
import type { ActualReviewImageMime } from "./uploadContract";

const SUPPORTED_FORMATS = new Set(["jpeg", "png", "webp"]);
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx"]);
const HEIF_BRANDS = new Set(["mif1", "msf1"]);
const DETAIL_QUALITIES = [82, 76, 70, 64, 58, 52];
const DETAIL_EDGES = [MAX_REVIEW_IMAGE_EDGE, 1_440, 1_280, 1_120, 960];
const THUMBNAIL_QUALITIES = [76, 68, 60, 52, 44];

type EncodedImage = {
  data: Buffer;
  info: OutputInfo;
};

export type ProcessedReviewImage = {
  inputMimeType: ActualReviewImageMime;
  detail: EncodedImage;
  thumbnail: EncodedImage;
};

type ImagePipelineInput =
  | {
      kind: "encoded";
      data: Uint8Array;
    }
  | {
      kind: "rgba";
      data: Uint8Array;
      width: number;
      height: number;
    };

function toMimeType(format: string): ActualReviewImageMime {
  if (format === "jpeg") {
    return "image/jpeg";
  }

  if (format === "png") {
    return "image/png";
  }

  return "image/webp";
}

function readAscii(input: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...input.subarray(start, end));
}

function detectHeifMimeType(input: Uint8Array): ActualReviewImageMime | null {
  if (input.byteLength < 12 || readAscii(input, 4, 8) !== "ftyp") {
    return null;
  }

  const brand = readAscii(input, 8, 12);

  if (HEIC_BRANDS.has(brand)) {
    return "image/heic";
  }

  if (HEIF_BRANDS.has(brand)) {
    return "image/heif";
  }

  return null;
}

function imagePipeline(input: ImagePipelineInput) {
  if (input.kind === "rgba") {
    return sharp(input.data, {
      raw: {
        width: input.width,
        height: input.height,
        channels: 4,
      },
      limitInputPixels: MAX_REVIEW_IMAGE_INPUT_PIXELS,
    });
  }

  return sharp(input.data, {
    animated: true,
    limitInputPixels: MAX_REVIEW_IMAGE_INPUT_PIXELS,
  });
}

async function encodeDetail(input: ImagePipelineInput) {
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

async function encodeThumbnail(input: ImagePipelineInput) {
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

async function inspectReviewImage(input: Uint8Array): Promise<{
  inputMimeType: ActualReviewImageMime;
  pipelineInput: ImagePipelineInput;
}> {
  const heifMimeType = detectHeifMimeType(input);

  if (heifMimeType) {
    const decoded = await decodeSingleHeic(input);

    return {
      inputMimeType: heifMimeType,
      pipelineInput: {
        kind: "rgba",
        data: new Uint8Array(
          decoded.data.buffer,
          decoded.data.byteOffset,
          decoded.data.byteLength,
        ),
        width: decoded.width,
        height: decoded.height,
      },
    };
  }

  const pipelineInput: ImagePipelineInput = { kind: "encoded", data: input };
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;

  try {
    metadata = await imagePipeline(pipelineInput).metadata();
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
      "JPEG, PNG, WebP, HEIC, HEIF 사진만 올릴 수 있어요.",
    );
  }

  if (!metadata.width || !metadata.height || (metadata.pages ?? 1) !== 1) {
    throw new ReviewImageError(
      "INVALID_IMAGE",
      422,
      "한 장으로 된 사진 파일을 선택해 주세요.",
    );
  }

  return {
    inputMimeType: toMimeType(metadata.format),
    pipelineInput,
  };
}

export async function processReviewImage(
  input: Uint8Array,
): Promise<ProcessedReviewImage> {
  const inspected = await inspectReviewImage(input);

  try {
    const [detail, thumbnail] = await Promise.all([
      encodeDetail(inspected.pipelineInput),
      encodeThumbnail(inspected.pipelineInput),
    ]);

    return {
      inputMimeType: inspected.inputMimeType,
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
