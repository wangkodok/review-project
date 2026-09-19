import { describe, expect, it } from "vitest";
import {
  ClientReviewImageError,
  getConstrainedImageDimensions,
  validateReviewImageFile,
} from "./clientProcessor";

describe("review image client processing", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])(
    "accepts the supported %s type",
    (type) => {
      expect(() => validateReviewImageFile({ size: 1_000, type })).not.toThrow();
    },
  );

  it("rejects unsupported, empty, and oversized files", () => {
    expect(() => validateReviewImageFile({ size: 1_000, type: "image/gif" })).toThrow(
      ClientReviewImageError,
    );
    expect(() => validateReviewImageFile({ size: 0, type: "image/jpeg" })).toThrow(
      "사진 파일을 확인해 주세요.",
    );
    expect(() =>
      validateReviewImageFile({ size: 10_000_001, type: "image/jpeg" }),
    ).toThrow("10MB 이하의 사진을 선택해 주세요.");
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
});
