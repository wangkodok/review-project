import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
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
    DeleteObjectCommand: class DeleteObjectCommand extends Command {
      constructor(input: Record<string, unknown>) {
        super(input, "delete");
      }
    },
  };
});

import {
  deleteReviewImageObject,
  putReviewImageObject,
} from "./storage";

describe("review image R2 storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.commands.length = 0;
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
