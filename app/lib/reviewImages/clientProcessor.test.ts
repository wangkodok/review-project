import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import {
  ClientReviewImageError,
  detectReviewImageMimeType,
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

  it("rejects GIF and empty files without rejecting a large supported source", () => {
    expect(() => validateReviewImageFile({ size: 1_000, type: "image/gif" })).toThrow(
      "JPEG, PNG, WebP, HEIC, HEIF 사진만 올릴 수 있어요.",
    );
    expect(() => validateReviewImageFile({ size: 0, type: "image/jpeg" })).toThrow(
      "사진 파일을 확인해 주세요.",
    );
    expect(() =>
      validateReviewImageFile({ size: 42_906_510, type: "image/png" }),
    ).not.toThrow();
  });

  it.each(["image/heic", "image/heif"])(
    "automatically optimizes a %s source before upload",
    async (type) => {
      const file = imageFile(2_000, type);
      const optimized = new Blob([new Uint8Array(1_000)], { type: "image/webp" });
      const optimizeImage = vi.fn().mockResolvedValue(optimized);

      await expect(
        prepareReviewImageForUpload(file, { optimizeImage }),
      ).resolves.toEqual({
        blob: optimized,
        mimeType: "image/webp",
        optimized: true,
      });
      expect(optimizeImage).toHaveBeenCalledWith(file);
    },
  );

  it("detects a MIME-less iPhone HEIC source before optimization", async () => {
    const bytes = await readFile(
      new URL("./__fixtures__/single-frame.heic", import.meta.url),
    );
    const file = Object.assign(new Blob([bytes]), {
      name: "phone-photo",
      lastModified: 0,
    }) as File;
    const optimized = new Blob([new Uint8Array(1_000)], { type: "image/webp" });
    const optimizeImage = vi.fn().mockResolvedValue(optimized);

    await expect(
      prepareReviewImageForUpload(file, { optimizeImage }),
    ).resolves.toEqual({
      blob: optimized,
      mimeType: "image/webp",
      optimized: true,
    });
    expect(optimizeImage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "image/heic" }),
    );
  });

  it("detects supported image signatures without trusting an empty MIME", async () => {
    const png = Object.assign(
      new Blob([
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ]),
      { name: "photo", lastModified: 0 },
    ) as File;
    const unknown = Object.assign(new Blob([new Uint8Array([1, 2, 3, 4])]), {
      name: "not-an-image",
      lastModified: 0,
    }) as File;

    await expect(detectReviewImageMimeType(png)).resolves.toBe("image/png");
    await expect(detectReviewImageMimeType(unknown)).rejects.toThrow(
      "사진 파일 형식을 확인하지 못했습니다.",
    );
  });

  it.each([
    "createImageBitmap failed",
    "Canvas context failed",
    "WebP encoding failed",
  ])("does not upload the unprocessed original when %s", async (reason) => {
    const file = imageFile(2_000, "image/jpeg", "meal.jpg");
    const optimizeImage = vi.fn().mockRejectedValue(new Error(reason));

    await expect(
      prepareReviewImageForUpload(file, { optimizeImage }),
    ).rejects.toThrow("사진을 자동으로 처리하지 못했습니다.");
  });

  it("uses a valid WebP optimization even when the encoded file is slightly larger", async () => {
    const file = imageFile(2_000, "image/png", "meal.png");
    const largerWebp = new Blob([new Uint8Array(2_001)], { type: "image/webp" });

    await expect(
      prepareReviewImageForUpload(file, {
        optimizeImage: vi.fn().mockResolvedValue(largerWebp),
      }),
    ).resolves.toEqual({
      blob: largerWebp,
      mimeType: "image/webp",
      optimized: true,
    });
  });

  it("rejects a processed result that still exceeds the upload budget", async () => {
    const file = imageFile(42_906_510, "image/png", "phone-photo.png");
    const oversizedWebp = new Blob([new Uint8Array(2_000_001)], {
      type: "image/webp",
    });

    await expect(
      prepareReviewImageForUpload(file, {
        optimizeImage: vi.fn().mockResolvedValue(oversizedWebp),
      }),
    ).rejects.toThrow("사진을 자동으로 처리하지 못했습니다.");
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
