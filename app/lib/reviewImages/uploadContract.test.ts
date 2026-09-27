import { describe, expect, it } from "vitest";
import { ReviewImageError } from "./errors";
import {
  parseReviewImageUploadRequest,
  type ActualReviewImageMime,
  type DeclaredReviewImageMime,
  type ReadyReviewImage,
  type ReviewImageUploadSlot,
} from "./uploadContract";

describe("review image upload contract", () => {
  it.each([1, 10_000_000])("accepts the byte-size boundary %d", (byteSize) => {
    expect(
      parseReviewImageUploadRequest({
        byteSize,
        mimeType: "image/jpeg",
      }),
    ).toEqual({ byteSize, mimeType: "image/jpeg" });
  });

  it.each([0, -1, 1.5, Number.NaN])(
    "rejects an invalid byte size %s",
    (byteSize) => {
      expect(() =>
        parseReviewImageUploadRequest({
          byteSize,
          mimeType: "image/jpeg",
        }),
      ).toThrowError(
        expect.objectContaining<Partial<ReviewImageError>>({
          code: "INVALID_IMAGE",
          status: 400,
        }),
      );
    },
  );

  it("rejects a byte size over the maximum", () => {
    expect(() =>
      parseReviewImageUploadRequest({
        byteSize: 10_000_001,
        mimeType: "image/jpeg",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ReviewImageError>>({
        code: "IMAGE_TOO_LARGE",
        status: 413,
      }),
    );
  });

  it.each([
    [" IMAGE/JPEG ", "image/jpeg"],
    ["image/png", "image/png"],
    ["IMAGE/WEBP", "image/webp"],
    ["image/heic", "image/heic"],
    ["IMAGE/HEIF", "image/heif"],
    ["application/octet-stream", "application/octet-stream"],
    ["", "application/octet-stream"],
    ["   ", "application/octet-stream"],
  ] as const)("normalizes declared MIME %j to %j", (input, expected) => {
    expect(
      parseReviewImageUploadRequest({
        byteSize: 1,
        mimeType: input,
      }),
    ).toEqual({ byteSize: 1, mimeType: expected });
  });

  it.each([undefined, null, 1, "image/gif", "text/plain"])(
    "rejects unsupported declared MIME %j",
    (mimeType) => {
      expect(() =>
        parseReviewImageUploadRequest({
          byteSize: 1,
          mimeType,
        }),
      ).toThrowError(
        expect.objectContaining<Partial<ReviewImageError>>({
          code: "UNSUPPORTED_IMAGE_TYPE",
          status: 415,
        }),
      );
    },
  );

  it.each([null, [], "{}", { byteSize: 1 }])(
    "rejects malformed JSON-shaped input %j",
    (value) => {
      expect(() => parseReviewImageUploadRequest(value)).toThrowError(
        expect.any(ReviewImageError),
      );
    },
  );

  it("exposes only the approved transport DTO shapes", () => {
    const declared: DeclaredReviewImageMime = "application/octet-stream";
    const actual: ActualReviewImageMime = "image/heif";
    const slot: ReviewImageUploadSlot = {
      imageId: "00000000-0000-4000-8000-000000000000",
      uploadUrl: "https://example.invalid/upload",
      expiresAt: "2026-09-22T00:03:00.000Z",
      requiredHeaders: { "Content-Type": declared },
    };
    const ready: ReadyReviewImage = {
      imageId: slot.imageId,
      width: 480,
      height: 640,
      detailByteSize: 80_000,
      thumbnailByteSize: 10_000,
      detailUrl: "https://images.example.invalid/detail/image.webp",
      thumbnailUrl: "https://images.example.invalid/thumbnail/image.webp",
    };

    expect({ actual, slot, ready }).toMatchObject({
      actual: "image/heif",
      slot: { requiredHeaders: { "Content-Type": declared } },
      ready: { imageId: slot.imageId },
    });
  });
});
