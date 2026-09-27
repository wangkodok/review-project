import { describe, expect, it, vi } from "vitest";
import {
  ClientReviewImageError,
  getConstrainedImageDimensions,
  prepareReviewImageForUpload,
  validateReviewImageFile,
} from "./clientProcessor";

function imageFile(size: number, type: string, name = "review-image") {
  const blob = new Blob([new Uint8Array(size)], { type });
  return Object.assign(blob, { name, lastModified: 0 }) as File;
}

describe("review image client processing", () => {
  it.each([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "",
  ])(
    "accepts the mobile-compatible %s type",
    (type) => {
      expect(() => validateReviewImageFile({ size: 1_000, type })).not.toThrow();
    },
  );

  it("rejects GIF, empty, and oversized files", () => {
    expect(() => validateReviewImageFile({ size: 1_000, type: "image/gif" })).toThrow(
      "JPEG, PNG, WebP, HEIC, HEIF 사진만 올릴 수 있어요.",
    );
    expect(() => validateReviewImageFile({ size: 0, type: "image/jpeg" })).toThrow(
      "사진 파일을 확인해 주세요.",
    );
    expect(() =>
      validateReviewImageFile({ size: 10_000_001, type: "image/jpeg" }),
    ).toThrow("10MB 이하의 사진을 선택해 주세요.");
  });

  it.each(["image/heic", "image/heif", ""])(
    "skips Canvas optimization for %s and keeps the original",
    async (type) => {
      const file = imageFile(2_000, type);
      const optimizeImage = vi.fn();

      await expect(
        prepareReviewImageForUpload(file, { optimizeImage }),
      ).resolves.toEqual({
        blob: file,
        mimeType: type || "application/octet-stream",
        optimized: false,
      });
      expect(optimizeImage).not.toHaveBeenCalled();
    },
  );

  it.each([
    "createImageBitmap failed",
    "Canvas context failed",
    "WebP encoding failed",
  ])("falls back to the JPEG original when %s", async (reason) => {
    const file = imageFile(2_000, "image/jpeg", "meal.jpg");
    const optimizeImage = vi.fn().mockRejectedValue(new Error(reason));

    await expect(
      prepareReviewImageForUpload(file, { optimizeImage }),
    ).resolves.toEqual({
      blob: file,
      mimeType: "image/jpeg",
      optimized: false,
    });
  });

  it("keeps the original when WebP optimization is larger", async () => {
    const file = imageFile(2_000, "image/png", "meal.png");
    const largerWebp = new Blob([new Uint8Array(2_001)], { type: "image/webp" });

    await expect(
      prepareReviewImageForUpload(file, {
        optimizeImage: vi.fn().mockResolvedValue(largerWebp),
      }),
    ).resolves.toEqual({
      blob: file,
      mimeType: "image/png",
      optimized: false,
    });
  });

  it("uses a smaller WebP optimization", async () => {
    const file = imageFile(2_000, "image/jpeg", "meal.jpg");
    const smallerWebp = new Blob([new Uint8Array(1_000)], { type: "image/webp" });

    await expect(
      prepareReviewImageForUpload(file, {
        optimizeImage: vi.fn().mockResolvedValue(smallerWebp),
      }),
    ).resolves.toEqual({
      blob: smallerWebp,
      mimeType: "image/webp",
      optimized: true,
    });
  });

  it("keeps small dimensions and proportionally constrains a large image", () => {
    expect(getConstrainedImageDimensions(800, 600, 1600)).toEqual({
      width: 800,
      height: 600,
    });
    expect(getConstrainedImageDimensions(4000, 3000, 1600)).toEqual({
      width: 1600,
      height: 1200,
    });
    expect(getConstrainedImageDimensions(1000, 4000, 1600)).toEqual({
      width: 400,
      height: 1600,
    });
  });

  it("rejects invalid dimensions", () => {
    expect(() => getConstrainedImageDimensions(0, 100, 1600)).toThrow(
      ClientReviewImageError,
    );
  });
});
