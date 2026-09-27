import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  MAX_REVIEW_IMAGE_DETAIL_BYTES,
  MAX_REVIEW_IMAGE_EDGE,
  MAX_REVIEW_IMAGE_THUMBNAIL_BYTES,
  REVIEW_IMAGE_THUMBNAIL_EDGE,
} from "./constants";
import { processReviewImage } from "./processor";

describe("processReviewImage", () => {
  it("creates bounded WebP detail and thumbnail images", async () => {
    const input = await sharp({
      create: {
        width: 2_000,
        height: 1_000,
        channels: 3,
        background: { r: 210, g: 80, b: 45 },
      },
    })
      .jpeg({ quality: 90 })
      .toBuffer();

    const result = await processReviewImage(input);

    expect(result.inputMimeType).toBe("image/jpeg");
    expect(result.detail.info.format).toBe("webp");
    expect(result.detail.info.width).toBeLessThanOrEqual(MAX_REVIEW_IMAGE_EDGE);
    expect(result.detail.info.height).toBeLessThanOrEqual(MAX_REVIEW_IMAGE_EDGE);
    expect(result.detail.data.byteLength).toBeLessThanOrEqual(
      MAX_REVIEW_IMAGE_DETAIL_BYTES,
    );
    expect(result.thumbnail.info.width).toBe(REVIEW_IMAGE_THUMBNAIL_EDGE);
    expect(result.thumbnail.info.height).toBe(REVIEW_IMAGE_THUMBNAIL_EDGE);
    expect(result.thumbnail.data.byteLength).toBeLessThanOrEqual(
      MAX_REVIEW_IMAGE_THUMBNAIL_BYTES,
    );
  });

  it.each([
    ["jpeg", "image/jpeg"],
    ["png", "image/png"],
    ["webp", "image/webp"],
  ] as const)("detects actual %s bytes", async (format, expectedMime) => {
    const source = sharp({
      create: {
        width: 8,
        height: 6,
        channels: 3,
        background: { r: 30, g: 120, b: 210 },
      },
    });
    const input = await source[format]().toBuffer();

    const result = await processReviewImage(input);

    expect(result.inputMimeType).toBe(expectedMime);
  });

  it("decodes actual HEIC bytes and sends RGBA through the WebP pipeline", async () => {
    const input = await readFile(
      new URL("./__fixtures__/single-frame.heic", import.meta.url),
    );

    const result = await processReviewImage(input);

    expect(result.inputMimeType).toBe("image/heic");
    expect(result.detail.info.format).toBe("webp");
    expect(result.detail.info.width).toBeLessThanOrEqual(MAX_REVIEW_IMAGE_EDGE);
    expect(result.detail.info.height).toBeLessThanOrEqual(MAX_REVIEW_IMAGE_EDGE);
    expect(result.detail.data.byteLength).toBeLessThanOrEqual(
      MAX_REVIEW_IMAGE_DETAIL_BYTES,
    );
    expect(result.thumbnail.data.byteLength).toBeLessThanOrEqual(
      MAX_REVIEW_IMAGE_THUMBNAIL_BYTES,
    );
  });

  it("classifies an HEIF-compatible container from its actual brand", async () => {
    const input = Buffer.from(
      await readFile(new URL("./__fixtures__/single-frame.heic", import.meta.url)),
    );
    input.write("mif1", 8, "ascii");

    const result = await processReviewImage(input);

    expect(result.inputMimeType).toBe("image/heif");
  });

  it("rejects animated WebP input", async () => {
    const frames = await Promise.all(
      ["#ef4444", "#3b82f6"].map((background) =>
        sharp({
          create: { width: 2, height: 2, channels: 4, background },
        })
          .png()
          .toBuffer(),
      ),
    );
    const animatedWebp = await sharp(frames, { join: { animated: true } })
      .webp({ loop: 0, delay: [100, 100] })
      .toBuffer();

    await expect(processReviewImage(animatedWebp)).rejects.toMatchObject({
      code: "INVALID_IMAGE",
    });
  });

  it("removes input metadata from both public WebP outputs", async () => {
    const input = await sharp({
      create: {
        width: 16,
        height: 12,
        channels: 3,
        background: { r: 180, g: 80, b: 30 },
      },
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Artist: "private-test-value" } } })
      .toBuffer();
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const result = await processReviewImage(input);
    const [detailMetadata, thumbnailMetadata] = await Promise.all([
      sharp(result.detail.data).metadata(),
      sharp(result.thumbnail.data).metadata(),
    ]);

    expect(detailMetadata.exif).toBeUndefined();
    expect(detailMetadata.xmp).toBeUndefined();
    expect(thumbnailMetadata.exif).toBeUndefined();
    expect(thumbnailMetadata.xmp).toBeUndefined();
  });

  it("rejects unsupported SVG and invalid bytes", async () => {
    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
    );

    await expect(processReviewImage(svg)).rejects.toMatchObject({
      code: "UNSUPPORTED_IMAGE_TYPE",
    });
    await expect(
      processReviewImage(new Uint8Array([1, 2, 3])),
    ).rejects.toMatchObject({ code: "INVALID_IMAGE" });
  });
});
