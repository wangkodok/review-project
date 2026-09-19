import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MAX_REVIEW_IMAGE_UPLOAD_BYTES } from "./constants";
import { readReviewImageRequestBody } from "./requestBody";

function imageRequest(body: Uint8Array, contentLength?: string) {
  const headers = new Headers({ "Content-Type": "image/webp" });

  if (contentLength !== undefined) {
    headers.set("Content-Length", contentLength);
  }

  return new Request("http://localhost/api/review-images", {
    method: "POST",
    headers,
    body: body.buffer.slice(
      body.byteOffset,
      body.byteOffset + body.byteLength,
    ) as ArrayBuffer,
  });
}

describe("readReviewImageRequestBody", () => {
  it("returns the actual image bytes", async () => {
    const body = new Uint8Array([1, 2, 3, 4]);

    await expect(readReviewImageRequestBody(imageRequest(body))).resolves.toEqual(body);
  });

  it("rejects a declared body larger than two megabytes", async () => {
    const promise = readReviewImageRequestBody(
      imageRequest(new Uint8Array([1]), String(MAX_REVIEW_IMAGE_UPLOAD_BYTES + 1)),
    );

    await expect(promise).rejects.toMatchObject({
      code: "IMAGE_TOO_LARGE",
      status: 413,
    });
  });

  it("rejects streamed bytes larger than two megabytes", async () => {
    const body = new Uint8Array(MAX_REVIEW_IMAGE_UPLOAD_BYTES + 1);
    const promise = readReviewImageRequestBody(imageRequest(body));

    await expect(promise).rejects.toMatchObject({
      code: "IMAGE_TOO_LARGE",
      status: 413,
    });
  });

  it("rejects an empty body and malformed content length", async () => {
    const emptyRequest = new Request("http://localhost/api/review-images", {
      method: "POST",
    });
    const malformedLengthRequest = imageRequest(new Uint8Array([1]), "invalid");

    await expect(readReviewImageRequestBody(emptyRequest)).rejects.toMatchObject({
      code: "IMAGE_REQUIRED",
    });
    await expect(
      readReviewImageRequestBody(malformedLengthRequest),
    ).rejects.toMatchObject({ code: "INVALID_IMAGE" });
  });
});
