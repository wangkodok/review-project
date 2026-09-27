import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  getSignedUrl: vi.fn(),
  commands: [] as Array<{ name: string; input: Record<string, unknown> }>,
}));

vi.mock("server-only", () => ({}));
vi.mock("./config", () => ({
  getReviewImageStorageConfig: () => ({
    endpoint: "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com",
    accessKeyId: "test-access-key",
    secretAccessKey: "test-secret-key",
    tempBucketName: "sseullae-review-images-temp",
    publicBucketName: "sseullae-review-images-public",
  }),
}));
vi.mock("@aws-sdk/client-s3", () => {
  class Command {
    constructor(
      public input: Record<string, unknown>,
      name: string,
    ) {
      mocks.commands.push({ name, input });
    }
  }

  return {
    S3Client: class S3Client {
      send = mocks.send;
    },
    PutObjectCommand: class PutObjectCommand extends Command {
      constructor(input: Record<string, unknown>) {
        super(input, "put");
      }
    },
    HeadObjectCommand: class HeadObjectCommand extends Command {
      constructor(input: Record<string, unknown>) {
        super(input, "head");
      }
    },
    GetObjectCommand: class GetObjectCommand extends Command {
      constructor(input: Record<string, unknown>) {
        super(input, "get");
      }
    },
    DeleteObjectCommand: class DeleteObjectCommand extends Command {
      constructor(input: Record<string, unknown>) {
        super(input, "delete");
      }
    },
  };
});
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mocks.getSignedUrl,
}));

import {
  createReviewImageTempUploadUrl,
  deleteReviewImageObject,
  headReviewImageTempObject,
  putReviewImageObject,
  readReviewImageTempObject,
  ReviewImageTempObjectNotFoundError,
} from "./storage";

function createStreamingBody(chunks: Uint8Array[]) {
  const destroy = vi.fn();

  return {
    destroy,
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

describe("review image R2 storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.commands.length = 0;
  });

  it("presigns an exact temporary PUT for 180 seconds", async () => {
    mocks.getSignedUrl.mockResolvedValue("https://upload.example.invalid/signed");

    await expect(
      createReviewImageTempUploadUrl({
        key: "temp/image-id/source",
        contentType: "image/heic",
      }),
    ).resolves.toBe("https://upload.example.invalid/signed");

    expect(mocks.commands).toEqual([
      {
        name: "put",
        input: {
          Bucket: "sseullae-review-images-temp",
          Key: "temp/image-id/source",
          ContentType: "image/heic",
        },
      },
    ]);
    expect(mocks.getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        input: expect.objectContaining({
          Bucket: "sseullae-review-images-temp",
          Key: "temp/image-id/source",
          ContentType: "image/heic",
        }),
      }),
      { expiresIn: 180 },
    );
  });

  it("reads temporary object size and content type with HEAD", async () => {
    mocks.send.mockResolvedValue({
      ContentLength: 4_120_151,
      ContentType: "image/jpeg",
      Metadata: { private: "must-not-be-returned" },
    });

    await expect(
      headReviewImageTempObject("temp/image-id/source"),
    ).resolves.toEqual({
      byteSize: 4_120_151,
      contentType: "image/jpeg",
    });

    expect(mocks.commands).toEqual([
      {
        name: "head",
        input: {
          Bucket: "sseullae-review-images-temp",
          Key: "temp/image-id/source",
        },
      },
    ]);
  });

  it("rejects a temporary HEAD response without a valid byte size", async () => {
    mocks.send.mockResolvedValue({ ContentType: "image/jpeg" });

    await expect(
      headReviewImageTempObject("temp/image-id/source"),
    ).rejects.toThrow("R2 object size is unavailable");
  });

  it("normalizes an R2 HEAD 404 without exposing SDK details", async () => {
    mocks.send.mockRejectedValue(
      Object.assign(new Error("private R2 object detail"), {
        name: "NotFound",
        $metadata: { httpStatusCode: 404 },
      }),
    );

    await expect(
      headReviewImageTempObject("temp/image-id/source"),
    ).rejects.toBeInstanceOf(ReviewImageTempObjectNotFoundError);
  });

  it("reads a temporary object through a bounded stream", async () => {
    const body = createStreamingBody([
      new Uint8Array([1, 2]),
      new Uint8Array([3, 4]),
    ]);
    mocks.send.mockResolvedValue({ Body: body });

    await expect(
      readReviewImageTempObject("temp/image-id/source"),
    ).resolves.toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(body.destroy).not.toHaveBeenCalled();
    expect(mocks.commands).toEqual([
      {
        name: "get",
        input: {
          Bucket: "sseullae-review-images-temp",
          Key: "temp/image-id/source",
        },
      },
    ]);
  });

  it("accepts exactly 10 MB from the temporary object stream", async () => {
    const body = createStreamingBody([new Uint8Array(10_000_000)]);
    mocks.send.mockResolvedValue({ Body: body });

    const result = await readReviewImageTempObject("temp/image-id/source");

    expect(result.byteLength).toBe(10_000_000);
    expect(body.destroy).not.toHaveBeenCalled();
  });

  it("stops reading when a temporary object exceeds 10 MB", async () => {
    const body = createStreamingBody([
      new Uint8Array(10_000_000),
      new Uint8Array([1]),
    ]);
    mocks.send.mockResolvedValue({ Body: body });

    await expect(
      readReviewImageTempObject("temp/image-id/source"),
    ).rejects.toThrow("R2 object exceeds the maximum allowed size");
    expect(body.destroy).toHaveBeenCalledOnce();
  });

  it("uploads to the selected bucket and verifies the stored size", async () => {
    mocks.send.mockResolvedValueOnce({}).mockResolvedValueOnce({ ContentLength: 3 });

    await putReviewImageObject({
      bucket: "public",
      key: "detail/image-id/image.webp",
      body: new Uint8Array([1, 2, 3]),
      contentType: "image/webp",
      cacheControl: "public, max-age=31536000, immutable",
    });

    expect(mocks.commands).toEqual([
      {
        name: "put",
        input: expect.objectContaining({
          Bucket: "sseullae-review-images-public",
          Key: "detail/image-id/image.webp",
          ContentType: "image/webp",
        }),
      },
      {
        name: "head",
        input: {
          Bucket: "sseullae-review-images-public",
          Key: "detail/image-id/image.webp",
        },
      },
    ]);
  });

  it("fails when R2 reports a different stored size", async () => {
    mocks.send.mockResolvedValueOnce({}).mockResolvedValueOnce({ ContentLength: 2 });

    await expect(
      putReviewImageObject({
        bucket: "temp",
        key: "temp/image-id/source",
        body: new Uint8Array([1, 2, 3]),
        contentType: "image/webp",
        cacheControl: "no-store",
      }),
    ).rejects.toThrow("R2 object size verification failed");
  });

  it("deletes through the private temporary bucket", async () => {
    mocks.send.mockResolvedValue({});

    await deleteReviewImageObject("temp", "temp/image-id/source");

    expect(mocks.commands).toEqual([
      {
        name: "delete",
        input: {
          Bucket: "sseullae-review-images-temp",
          Key: "temp/image-id/source",
        },
      },
    ]);
  });
});
