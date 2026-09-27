import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { toPublicReviewImage, toReadyReviewImage } from "./publicUrl";

const attachedImage = {
  status: "attached",
  detail_object_key: "detail/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/image.webp",
  thumbnail_object_key: "thumbnail/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/image.webp",
  width: 1200,
  height: 900,
};

describe("review image public URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds encoded public URLs from an attached image", () => {
    vi.stubEnv("REVIEW_IMAGE_PUBLIC_BASE_URL", "https://media.example.com/");

    expect(toPublicReviewImage(attachedImage)).toEqual({
      detailUrl:
        "https://media.example.com/detail/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/image.webp",
      thumbnailUrl:
        "https://media.example.com/thumbnail/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/image.webp",
      width: 1200,
      height: 900,
    });
  });

  it("builds a safe ready DTO only from matching canonical object keys", () => {
    vi.stubEnv("REVIEW_IMAGE_PUBLIC_BASE_URL", "https://media.example.com/");

    expect(
      toReadyReviewImage({
        imageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        detailObjectKey:
          "detail/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/image.webp",
        thumbnailObjectKey:
          "thumbnail/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/image.webp",
        width: 1_200,
        height: 900,
        detailByteSize: 800_000,
        thumbnailByteSize: 80_000,
      }),
    ).toEqual({
      imageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      detailUrl:
        "https://media.example.com/detail/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/image.webp",
      thumbnailUrl:
        "https://media.example.com/thumbnail/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/image.webp",
      width: 1_200,
      height: 900,
      detailByteSize: 800_000,
      thumbnailByteSize: 80_000,
    });
  });

  it("rejects ready DTO keys that do not belong to the image id", () => {
    vi.stubEnv("REVIEW_IMAGE_PUBLIC_BASE_URL", "https://media.example.com/");

    expect(
      toReadyReviewImage({
        imageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        detailObjectKey:
          "detail/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/image.webp",
        thumbnailObjectKey:
          "thumbnail/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/image.webp",
        width: 1_200,
        height: 900,
        detailByteSize: 800_000,
        thumbnailByteSize: 80_000,
      }),
    ).toBeNull();
  });

  it.each([
    ["a missing base URL", undefined, attachedImage],
    ["an insecure base URL", "http://media.example.com", attachedImage],
    ["a non-attached image", "https://media.example.com", { ...attachedImage, status: "ready" }],
    [
      "an invalid object prefix",
      "https://media.example.com",
      { ...attachedImage, detail_object_key: "temp/image.webp" },
    ],
    [
      "a traversal-like object key",
      "https://media.example.com",
      { ...attachedImage, detail_object_key: "detail/../private/image.webp" },
    ],
  ])("returns null for %s", (_name, baseUrl, image) => {
    if (baseUrl) {
      vi.stubEnv("REVIEW_IMAGE_PUBLIC_BASE_URL", baseUrl);
    } else {
      vi.stubEnv("REVIEW_IMAGE_PUBLIC_BASE_URL", "");
    }

    expect(toPublicReviewImage(image)).toBeNull();
  });
});
