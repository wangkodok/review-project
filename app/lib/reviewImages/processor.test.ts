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
