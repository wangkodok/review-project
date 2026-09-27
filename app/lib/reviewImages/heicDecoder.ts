import "server-only";

import decodeHeic from "heic-decode";
import { MAX_REVIEW_IMAGE_INPUT_PIXELS } from "./constants";
import { ReviewImageError } from "./errors";

type DecodedHeicFrame = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

type HeicFrame = {
  width: number;
  height: number;
  decode: () => Promise<DecodedHeicFrame>;
};

type HeicFrameCollection = HeicFrame[] & {
  dispose?: () => void;
};

export type DecodeAllHeic = (input: {
  buffer: Uint8Array;
}) => Promise<HeicFrameCollection>;

export type DecodedSingleHeic = DecodedHeicFrame;

const decodeAllHeic: DecodeAllHeic = (input) =>
  decodeHeic.all(input) as Promise<HeicFrameCollection>;

function invalidImage(message = "사진 파일을 확인해 주세요.") {
  return new ReviewImageError("INVALID_IMAGE", 422, message);
}

function validateDimensions(width: number, height: number) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width * height > MAX_REVIEW_IMAGE_INPUT_PIXELS
  ) {
    throw invalidImage();
  }
}

export async function decodeSingleHeic(
  input: Uint8Array,
  decodeAll: DecodeAllHeic = decodeAllHeic,
): Promise<DecodedSingleHeic> {
  let frames: HeicFrameCollection | undefined;
  let result: DecodedSingleHeic | undefined;
  let failure: ReviewImageError | undefined;

  try {
    frames = await decodeAll({ buffer: input });

    if (frames.length !== 1) {
      throw invalidImage("한 장으로 된 사진 파일을 선택해 주세요.");
    }

    const frame = frames[0];
    validateDimensions(frame.width, frame.height);

    const decoded = await frame.decode();
    validateDimensions(decoded.width, decoded.height);

    if (
      decoded.width !== frame.width ||
      decoded.height !== frame.height ||
      !(decoded.data instanceof Uint8ClampedArray) ||
      decoded.data.byteLength !== decoded.width * decoded.height * 4
    ) {
      throw invalidImage();
    }

    result = decoded;
  } catch (error) {
    failure = error instanceof ReviewImageError ? error : invalidImage();
  }

  try {
    frames?.dispose?.();
  } catch {
    failure ??= new ReviewImageError(
      "IMAGE_PROCESSING_FAILED",
      422,
      "사진을 처리하지 못했습니다. 다른 사진을 선택해 주세요.",
    );
  }

  if (failure) {
    throw failure;
  }

  if (!result) {
    throw invalidImage();
  }

  return result;
}
