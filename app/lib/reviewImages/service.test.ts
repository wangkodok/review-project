import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const IMAGE_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

const mocks = vi.hoisted(() => ({
  ReviewImageTempObjectNotFoundError: class ReviewImageTempObjectNotFoundError extends Error {},
  processReviewImage: vi.fn(),
  getReviewImageDirectUploadContext: vi.fn(),
  claimReviewImageTempUpload: vi.fn(),
  completeReviewImageDirectUpload: vi.fn(),
  reserveReviewImageDirectUpload: vi.fn(),
  reserveReviewImageUpload: vi.fn(),
  completeReviewImageUpload: vi.fn(),
  queueReviewImageCleanup: vi.fn(),
  putReviewImageObject: vi.fn(),
  deleteReviewImageObject: vi.fn(),
  deleteReviewImageObjectsBestEffort: vi.fn(),
  createReviewImageTempUploadUrl: vi.fn(),
  headReviewImageTempObject: vi.fn(),
  readReviewImageTempObject: vi.fn(),
  toReadyReviewImage: vi.fn(),
  recordSecurityEvent: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("node:crypto", () => ({ randomUUID: () => IMAGE_ID }));
vi.mock("@/app/lib/security/securityEvent", () => ({
  recordSecurityEvent: mocks.recordSecurityEvent,
}));
vi.mock("./processor", () => ({
  processReviewImage: mocks.processReviewImage,
}));
vi.mock("./repository", () => ({
  getReviewImageDirectUploadContext: mocks.getReviewImageDirectUploadContext,
  claimReviewImageTempUpload: mocks.claimReviewImageTempUpload,
  completeReviewImageDirectUpload: mocks.completeReviewImageDirectUpload,
  reserveReviewImageDirectUpload: mocks.reserveReviewImageDirectUpload,
  reserveReviewImageUpload: mocks.reserveReviewImageUpload,
  completeReviewImageUpload: mocks.completeReviewImageUpload,
  queueReviewImageCleanup: mocks.queueReviewImageCleanup,
}));
vi.mock("./storage", () => ({
  ReviewImageTempObjectNotFoundError:
    mocks.ReviewImageTempObjectNotFoundError,
  createReviewImageTempUploadUrl: mocks.createReviewImageTempUploadUrl,
  headReviewImageTempObject: mocks.headReviewImageTempObject,
  readReviewImageTempObject: mocks.readReviewImageTempObject,
  putReviewImageObject: mocks.putReviewImageObject,
  deleteReviewImageObject: mocks.deleteReviewImageObject,
  deleteReviewImageObjectsBestEffort: mocks.deleteReviewImageObjectsBestEffort,
}));
vi.mock("./publicUrl", () => ({
  toReadyReviewImage: mocks.toReadyReviewImage,
}));

import {
  cancelReviewImage,
  createReadyReviewImage,
  createReviewImageUploadSlot,
  finalizeReviewImageDirectUpload,
} from "./service";
import { ReviewImageError } from "./errors";

const processed = {
  inputMimeType: "image/webp",
  detail: {
    data: new Uint8Array(800_000),
    info: { width: 1_200, height: 800 },
  },
  thumbnail: {
    data: new Uint8Array(80_000),
    info: { width: 320, height: 320 },
  },
};

const directUploadContext = {
  result: "ok" as const,
  status: "uploading" as const,
  tempObjectKey: `temp/${IMAGE_ID}/source`,
  detailObjectKey: `detail/${IMAGE_ID}/image.webp`,
  thumbnailObjectKey: `thumbnail/${IMAGE_ID}/image.webp`,
  expectedTempByteSize: 4,
  declaredSourceMimeType: "image/heic" as const,
  sourceMimeType: null,
  width: null,
  height: null,
  detailByteSize: null,
  thumbnailByteSize: null,
};

const readyImage = {
  imageId: IMAGE_ID,
  width: 1_200,
  height: 800,
  detailByteSize: 800_000,
  thumbnailByteSize: 80_000,
  detailUrl: `https://media.example.invalid/detail/${IMAGE_ID}/image.webp`,
  thumbnailUrl: `https://media.example.invalid/thumbnail/${IMAGE_ID}/image.webp`,
};

describe("review image service", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-22T00:00:00.000Z"));
    vi.resetAllMocks();
    mocks.processReviewImage.mockResolvedValue(processed);
    mocks.reserveReviewImageUpload.mockResolvedValue({ result: "ok" });
    mocks.putReviewImageObject.mockResolvedValue(undefined);
    mocks.deleteReviewImageObject.mockResolvedValue(undefined);
    mocks.completeReviewImageUpload.mockResolvedValue("ok");
    mocks.deleteReviewImageObjectsBestEffort.mockResolvedValue([]);
    mocks.queueReviewImageCleanup.mockResolvedValue("ok");
    mocks.reserveReviewImageDirectUpload.mockResolvedValue({
      result: "ok",
      imageId: IMAGE_ID,
      reservedByteSize: 5_220_151,
    });
    mocks.createReviewImageTempUploadUrl.mockResolvedValue(
      "https://upload.example.invalid/signed?X-Amz-Credential=test-access-key",
    );
    mocks.getReviewImageDirectUploadContext.mockResolvedValue(
      directUploadContext,
    );
    mocks.headReviewImageTempObject.mockResolvedValue({
      byteSize: 4,
      contentType: "image/heic",
    });
    mocks.claimReviewImageTempUpload.mockResolvedValue("ok");
    mocks.readReviewImageTempObject.mockResolvedValue(
      new Uint8Array([1, 2, 3, 4]),
    );
    mocks.completeReviewImageDirectUpload.mockResolvedValue("ok");
    mocks.toReadyReviewImage.mockReturnValue(readyImage);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reserves for 15 minutes before presigning a 180-second upload slot", async () => {
    const result = await createReviewImageUploadSlot({
      ownerUserId: USER_ID,
      byteSize: 4_120_151,
      mimeType: "image/heic",
    });

    expect(mocks.reserveReviewImageDirectUpload).toHaveBeenCalledWith({
      imageId: IMAGE_ID,
      ownerUserId: USER_ID,
      tempObjectKey: `temp/${IMAGE_ID}/source`,
      detailObjectKey: `detail/${IMAGE_ID}/image.webp`,
      thumbnailObjectKey: `thumbnail/${IMAGE_ID}/image.webp`,
      expectedTempByteSize: 4_120_151,
      declaredSourceMimeType: "image/heic",
      expiresAt: "2026-09-22T00:15:00.000Z",
    });
    expect(mocks.createReviewImageTempUploadUrl).toHaveBeenCalledWith({
      key: `temp/${IMAGE_ID}/source`,
      contentType: "image/heic",
    });
    expect(
      mocks.reserveReviewImageDirectUpload.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mocks.createReviewImageTempUploadUrl.mock.invocationCallOrder[0],
    );
    expect(result).toEqual({
      imageId: IMAGE_ID,
      uploadUrl:
        "https://upload.example.invalid/signed?X-Amz-Credential=test-access-key",
      expiresAt: "2026-09-22T00:03:00.000Z",
      requiredHeaders: { "Content-Type": "image/heic" },
    });
    expect(JSON.stringify(result)).not.toContain("temp/");
    expect(JSON.stringify(result)).not.toContain("detail/");
    expect(JSON.stringify(result)).not.toContain("thumbnail/");
  });

  it("finalizes a direct upload in the required safe order", async () => {
    const result = await finalizeReviewImageDirectUpload({
      imageId: IMAGE_ID,
      ownerUserId: USER_ID,
    });

    expect(result).toEqual(readyImage);
    expect(mocks.getReviewImageDirectUploadContext).toHaveBeenCalledWith({
      imageId: IMAGE_ID,
      ownerUserId: USER_ID,
    });
    expect(mocks.headReviewImageTempObject).toHaveBeenCalledWith(
      `temp/${IMAGE_ID}/source`,
    );
    expect(mocks.claimReviewImageTempUpload).toHaveBeenCalledWith({
      imageId: IMAGE_ID,
      ownerUserId: USER_ID,
      tempByteSize: 4,
    });
    expect(mocks.readReviewImageTempObject).toHaveBeenCalledWith(
      `temp/${IMAGE_ID}/source`,
    );
    expect(mocks.processReviewImage).toHaveBeenCalledWith(
      new Uint8Array([1, 2, 3, 4]),
    );
    expect(mocks.putReviewImageObject).toHaveBeenNthCalledWith(1, {
      bucket: "public",
      key: `detail/${IMAGE_ID}/image.webp`,
      body: processed.detail.data,
      contentType: "image/webp",
      cacheControl: "public, max-age=31536000, immutable",
    });
    expect(mocks.putReviewImageObject).toHaveBeenNthCalledWith(2, {
      bucket: "public",
      key: `thumbnail/${IMAGE_ID}/image.webp`,
      body: processed.thumbnail.data,
      contentType: "image/webp",
      cacheControl: "public, max-age=31536000, immutable",
    });
    expect(mocks.deleteReviewImageObject).toHaveBeenCalledWith(
      "temp",
      `temp/${IMAGE_ID}/source`,
    );
    expect(mocks.completeReviewImageDirectUpload).toHaveBeenCalledWith({
      imageId: IMAGE_ID,
      ownerUserId: USER_ID,
      detailObjectKey: `detail/${IMAGE_ID}/image.webp`,
      thumbnailObjectKey: `thumbnail/${IMAGE_ID}/image.webp`,
      width: 1_200,
      height: 800,
      sourceMimeType: "image/webp",
      detailByteSize: 800_000,
      thumbnailByteSize: 80_000,
      tempDeleted: true,
    });

    const order = [
      mocks.getReviewImageDirectUploadContext,
      mocks.headReviewImageTempObject,
      mocks.claimReviewImageTempUpload,
      mocks.readReviewImageTempObject,
      mocks.processReviewImage,
      mocks.putReviewImageObject,
      mocks.deleteReviewImageObject,
      mocks.completeReviewImageDirectUpload,
    ].map((mock) => mock.mock.invocationCallOrder[0]);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("returns an existing ready image without touching R2 or accounting again", async () => {
    mocks.getReviewImageDirectUploadContext.mockResolvedValue({
      ...directUploadContext,
      status: "ready",
      tempObjectKey: null,
      sourceMimeType: "image/heic",
      width: 1_200,
      height: 800,
      detailByteSize: 800_000,
      thumbnailByteSize: 80_000,
    });

    await expect(
      finalizeReviewImageDirectUpload({ imageId: IMAGE_ID, ownerUserId: USER_ID }),
    ).resolves.toEqual(readyImage);
    expect(mocks.headReviewImageTempObject).not.toHaveBeenCalled();
    expect(mocks.claimReviewImageTempUpload).not.toHaveBeenCalled();
    expect(mocks.completeReviewImageDirectUpload).not.toHaveBeenCalled();
  });

  it.each([
    ["not_found", "IMAGE_NOT_FOUND", 404],
    ["forbidden", "FORBIDDEN", 403],
  ] as const)("maps %s before accessing R2", async (result, code, status) => {
    mocks.getReviewImageDirectUploadContext.mockResolvedValue({ result });

    await expect(
      finalizeReviewImageDirectUpload({ imageId: IMAGE_ID, ownerUserId: USER_ID }),
    ).rejects.toMatchObject({ code, status });
    expect(mocks.headReviewImageTempObject).not.toHaveBeenCalled();
    expect(mocks.deleteReviewImageObjectsBestEffort).not.toHaveBeenCalled();
    expect(mocks.queueReviewImageCleanup).not.toHaveBeenCalled();
  });

  it("maps an initial database context outage to a safe 503", async () => {
    mocks.getReviewImageDirectUploadContext.mockRejectedValue(
      new Error("private database detail"),
    );

    await expect(
      finalizeReviewImageDirectUpload({ imageId: IMAGE_ID, ownerUserId: USER_ID }),
    ).rejects.toMatchObject({
      code: "IMAGE_STORAGE_UNAVAILABLE",
      status: 503,
    });
    expect(mocks.headReviewImageTempObject).not.toHaveBeenCalled();
    expect(mocks.deleteReviewImageObjectsBestEffort).not.toHaveBeenCalled();
  });

  it("rejects an in-progress duplicate without deleting another request's work", async () => {
    mocks.getReviewImageDirectUploadContext.mockResolvedValue({
      ...directUploadContext,
      status: "processing",
    });

    await expect(
      finalizeReviewImageDirectUpload({ imageId: IMAGE_ID, ownerUserId: USER_ID }),
    ).rejects.toMatchObject({ code: "IMAGE_UPLOAD_IN_PROGRESS", status: 409 });
    expect(mocks.headReviewImageTempObject).not.toHaveBeenCalled();
    expect(mocks.deleteReviewImageObjectsBestEffort).not.toHaveBeenCalled();
  });

  it("rejects non-canonical database object keys before any R2 access", async () => {
    mocks.getReviewImageDirectUploadContext.mockResolvedValue({
      ...directUploadContext,
      tempObjectKey: "temp/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/source",
    });

    await expect(
      finalizeReviewImageDirectUpload({ imageId: IMAGE_ID, ownerUserId: USER_ID }),
    ).rejects.toMatchObject({
      code: "IMAGE_STORAGE_UNAVAILABLE",
      status: 503,
    });
    expect(mocks.headReviewImageTempObject).not.toHaveBeenCalled();
    expect(mocks.deleteReviewImageObjectsBestEffort).not.toHaveBeenCalled();
    expect(mocks.queueReviewImageCleanup).not.toHaveBeenCalled();
  });

  it.each([
    [3, "INVALID_IMAGE", 422],
    [10_000_001, "IMAGE_TOO_LARGE", 413],
  ] as const)(
    "rejects HEAD byte size %i before claim or GET",
    async (byteSize, code, status) => {
      mocks.headReviewImageTempObject.mockResolvedValue({ byteSize });

      await expect(
        finalizeReviewImageDirectUpload({ imageId: IMAGE_ID, ownerUserId: USER_ID }),
      ).rejects.toMatchObject({ code, status });
      expect(mocks.claimReviewImageTempUpload).not.toHaveBeenCalled();
      expect(mocks.readReviewImageTempObject).not.toHaveBeenCalled();
      expect(mocks.deleteReviewImageObjectsBestEffort).toHaveBeenCalledWith({
        temp: `temp/${IMAGE_ID}/source`,
        detail: `detail/${IMAGE_ID}/image.webp`,
        thumbnail: `thumbnail/${IMAGE_ID}/image.webp`,
      });
      expect(mocks.queueReviewImageCleanup).toHaveBeenCalledWith({
        imageId: IMAGE_ID,
        ownerUserId: USER_ID,
      });
    },
  );

  it("maps a missing temporary object to 404 and schedules cleanup", async () => {
    mocks.headReviewImageTempObject.mockRejectedValue(
      new mocks.ReviewImageTempObjectNotFoundError(),
    );

    await expect(
      finalizeReviewImageDirectUpload({ imageId: IMAGE_ID, ownerUserId: USER_ID }),
    ).rejects.toMatchObject({ code: "IMAGE_NOT_FOUND", status: 404 });
    expect(mocks.deleteReviewImageObjectsBestEffort).toHaveBeenCalledOnce();
    expect(mocks.queueReviewImageCleanup).toHaveBeenCalledOnce();
  });

  it("maps an expired atomic claim and schedules cleanup", async () => {
    mocks.claimReviewImageTempUpload.mockResolvedValue("expired");

    await expect(
      finalizeReviewImageDirectUpload({ imageId: IMAGE_ID, ownerUserId: USER_ID }),
    ).rejects.toMatchObject({ code: "IMAGE_UPLOAD_EXPIRED", status: 410 });
    expect(mocks.readReviewImageTempObject).not.toHaveBeenCalled();
    expect(mocks.deleteReviewImageObjectsBestEffort).toHaveBeenCalledOnce();
    expect(mocks.queueReviewImageCleanup).toHaveBeenCalledOnce();
  });

  it("does not clean up when a competing request wins the atomic claim", async () => {
    mocks.claimReviewImageTempUpload.mockResolvedValue("processing");

    await expect(
      finalizeReviewImageDirectUpload({ imageId: IMAGE_ID, ownerUserId: USER_ID }),
    ).rejects.toMatchObject({ code: "IMAGE_UPLOAD_IN_PROGRESS", status: 409 });
    expect(mocks.readReviewImageTempObject).not.toHaveBeenCalled();
    expect(mocks.deleteReviewImageObjectsBestEffort).not.toHaveBeenCalled();
    expect(mocks.queueReviewImageCleanup).not.toHaveBeenCalled();
  });

  it("returns the completed image when a competing request finishes first", async () => {
    mocks.claimReviewImageTempUpload.mockResolvedValue("ready");
    mocks.getReviewImageDirectUploadContext
      .mockResolvedValueOnce(directUploadContext)
      .mockResolvedValueOnce({
        ...directUploadContext,
        status: "ready",
        tempObjectKey: null,
        sourceMimeType: "image/heic",
        width: 1_200,
        height: 800,
        detailByteSize: 800_000,
        thumbnailByteSize: 80_000,
      });

    await expect(
      finalizeReviewImageDirectUpload({ imageId: IMAGE_ID, ownerUserId: USER_ID }),
    ).resolves.toEqual(readyImage);
    expect(mocks.readReviewImageTempObject).not.toHaveBeenCalled();
    expect(mocks.deleteReviewImageObjectsBestEffort).not.toHaveBeenCalled();
    expect(mocks.completeReviewImageDirectUpload).not.toHaveBeenCalled();
  });

  it("maps a temporary storage outage to 503 and schedules cleanup", async () => {
    mocks.headReviewImageTempObject.mockRejectedValue(
      new Error("private R2 outage detail"),
    );

    await expect(
      finalizeReviewImageDirectUpload({ imageId: IMAGE_ID, ownerUserId: USER_ID }),
    ).rejects.toMatchObject({
      code: "IMAGE_STORAGE_UNAVAILABLE",
      status: 503,
    });
    expect(mocks.deleteReviewImageObjectsBestEffort).toHaveBeenCalledOnce();
    expect(mocks.queueReviewImageCleanup).toHaveBeenCalledOnce();
  });

  it("rejects a body that changed after HEAD and schedules cleanup", async () => {
    mocks.readReviewImageTempObject.mockResolvedValue(new Uint8Array([1, 2, 3]));

    await expect(
      finalizeReviewImageDirectUpload({ imageId: IMAGE_ID, ownerUserId: USER_ID }),
    ).rejects.toMatchObject({ code: "INVALID_IMAGE", status: 422 });
    expect(mocks.processReviewImage).not.toHaveBeenCalled();
    expect(mocks.deleteReviewImageObjectsBestEffort).toHaveBeenCalledOnce();
    expect(mocks.recordSecurityEvent).not.toHaveBeenCalled();
  });

  it.each([
    ["damaged HEIC", "INVALID_IMAGE", 422],
    ["animated input", "UNSUPPORTED_IMAGE_TYPE", 415],
  ] as const)("cleans up %s processing failures", async (_name, code, status) => {
    mocks.processReviewImage.mockRejectedValue(
      new ReviewImageError(code, status, "안전한 사진 오류입니다."),
    );

    await expect(
      finalizeReviewImageDirectUpload({ imageId: IMAGE_ID, ownerUserId: USER_ID }),
    ).rejects.toMatchObject({ code, status });
    expect(mocks.putReviewImageObject).not.toHaveBeenCalled();
    expect(mocks.deleteReviewImageObjectsBestEffort).toHaveBeenCalledOnce();
    expect(mocks.queueReviewImageCleanup).toHaveBeenCalledOnce();
  });

  it.each([
    [
      "partial derivative upload",
      () =>
        mocks.putReviewImageObject
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error("private R2 detail")),
    ],
    ["source deletion", () => mocks.deleteReviewImageObject.mockRejectedValueOnce(new Error("private R2 detail"))],
    ["database completion", () => mocks.completeReviewImageDirectUpload.mockRejectedValueOnce(new Error("private DB detail"))],
  ] as const)("cleans all keys after a %s failure", async (_name, arrange) => {
    arrange();

    await expect(
      finalizeReviewImageDirectUpload({ imageId: IMAGE_ID, ownerUserId: USER_ID }),
    ).rejects.toMatchObject({ code: "IMAGE_STORAGE_UNAVAILABLE", status: 503 });
    expect(mocks.deleteReviewImageObjectsBestEffort).toHaveBeenCalledWith({
      temp: `temp/${IMAGE_ID}/source`,
      detail: `detail/${IMAGE_ID}/image.webp`,
      thumbnail: `thumbnail/${IMAGE_ID}/image.webp`,
    });
    expect(mocks.queueReviewImageCleanup).toHaveBeenCalledWith({
      imageId: IMAGE_ID,
      ownerUserId: USER_ID,
    });
  });

  it("keeps the safe original error and records a bounded cleanup failure", async () => {
    mocks.processReviewImage.mockRejectedValue(
      new ReviewImageError("INVALID_IMAGE", 422, "사진 파일을 확인해 주세요."),
    );
    mocks.queueReviewImageCleanup.mockRejectedValue(
      new Error("private database detail"),
    );

    await expect(
      finalizeReviewImageDirectUpload({ imageId: IMAGE_ID, ownerUserId: USER_ID }),
    ).rejects.toMatchObject({ code: "INVALID_IMAGE", status: 422 });
    expect(mocks.recordSecurityEvent).toHaveBeenCalledWith({
      eventCode: "review_image_finalize_failed",
      resultCode: "cleanup_queue_failed",
    });
    const recorded = JSON.stringify(mocks.recordSecurityEvent.mock.calls);
    expect(recorded).not.toContain(IMAGE_ID);
    expect(recorded).not.toContain(USER_ID);
    expect(recorded).not.toContain("private");
  });

  it("does not presign when direct-upload storage reservation fails", async () => {
    mocks.reserveReviewImageDirectUpload.mockResolvedValue({
      result: "quota_exceeded",
    });

    await expect(
      createReviewImageUploadSlot({
        ownerUserId: USER_ID,
        byteSize: 4_120_151,
        mimeType: "image/jpeg",
      }),
    ).rejects.toMatchObject({
      code: "STORAGE_QUOTA_EXCEEDED",
      status: 507,
    });
    expect(mocks.createReviewImageTempUploadUrl).not.toHaveBeenCalled();
  });

  it("queues cleanup and hides private details when presigning fails", async () => {
    mocks.createReviewImageTempUploadUrl.mockRejectedValue(
      new Error(
        "https://private.example.invalid/?X-Amz-Signature=private-signature",
      ),
    );

    await expect(
      createReviewImageUploadSlot({
        ownerUserId: USER_ID,
        byteSize: 4_120_151,
        mimeType: "application/octet-stream",
      }),
    ).rejects.toMatchObject({
      code: "IMAGE_STORAGE_UNAVAILABLE",
      status: 503,
      message: "사진 업로드를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    });
    expect(mocks.queueReviewImageCleanup).toHaveBeenCalledWith({
      imageId: IMAGE_ID,
      ownerUserId: USER_ID,
    });
    expect(mocks.recordSecurityEvent).toHaveBeenCalledWith({
      eventCode: "review_image_presign_failed",
      resultCode: "cleanup_queued",
    });
    const recorded = JSON.stringify(mocks.recordSecurityEvent.mock.calls);
    expect(recorded).not.toContain("X-Amz-Signature");
    expect(recorded).not.toContain(IMAGE_ID);
    expect(recorded).not.toContain(USER_ID);
  });

  it("stores verified objects and completes the reservation", async () => {
    const body = new Uint8Array(500_000);
    const result = await createReadyReviewImage({ ownerUserId: USER_ID, body });

    expect(result).toEqual({
      id: IMAGE_ID,
      width: 1_200,
      height: 800,
      detailByteSize: 800_000,
      thumbnailByteSize: 80_000,
    });
    expect(mocks.reserveReviewImageUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        imageId: IMAGE_ID,
        ownerUserId: USER_ID,
        tempObjectKey: `temp/${IMAGE_ID}/source`,
      }),
    );
    expect(mocks.putReviewImageObject).toHaveBeenCalledTimes(3);
    expect(mocks.deleteReviewImageObject).toHaveBeenCalledWith(
      "temp",
      `temp/${IMAGE_ID}/source`,
    );
    expect(mocks.completeReviewImageUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        imageId: IMAGE_ID,
        tempByteSize: 500_000,
        detailByteSize: 800_000,
        thumbnailByteSize: 80_000,
      }),
    );
  });

  it("does not write objects when the global quota is exhausted", async () => {
    mocks.reserveReviewImageUpload.mockResolvedValue({ result: "quota_exceeded" });

    await expect(
      createReadyReviewImage({ ownerUserId: USER_ID, body: new Uint8Array([1]) }),
    ).rejects.toMatchObject({ code: "STORAGE_QUOTA_EXCEEDED", status: 507 });
    expect(mocks.putReviewImageObject).not.toHaveBeenCalled();
  });

  it("cleans objects and queues reconciliation after a storage failure", async () => {
    mocks.putReviewImageObject.mockRejectedValueOnce(new Error("private R2 detail"));

    await expect(
      createReadyReviewImage({ ownerUserId: USER_ID, body: new Uint8Array([1]) }),
    ).rejects.toMatchObject({ code: "IMAGE_STORAGE_UNAVAILABLE", status: 503 });
    expect(mocks.deleteReviewImageObjectsBestEffort).toHaveBeenCalledWith({
      temp: `temp/${IMAGE_ID}/source`,
      detail: `detail/${IMAGE_ID}/image.webp`,
      thumbnail: `thumbnail/${IMAGE_ID}/image.webp`,
    });
    expect(mocks.queueReviewImageCleanup).toHaveBeenCalledWith({
      imageId: IMAGE_ID,
      ownerUserId: USER_ID,
    });
    expect(mocks.recordSecurityEvent).toHaveBeenCalledWith({
      eventCode: "review_image_storage_failed",
      resultCode: "cleanup_queued",
    });
  });

  it("records a reconciliation warning without private identifiers", async () => {
    mocks.putReviewImageObject.mockRejectedValueOnce(new Error("private R2 detail"));
    mocks.queueReviewImageCleanup.mockRejectedValueOnce(
      new Error("private database detail"),
    );

    await expect(
      createReadyReviewImage({ ownerUserId: USER_ID, body: new Uint8Array([1]) }),
    ).rejects.toMatchObject({ code: "IMAGE_STORAGE_UNAVAILABLE" });
    expect(mocks.recordSecurityEvent).toHaveBeenCalledWith({
      eventCode: "review_image_storage_failed",
      resultCode: "cleanup_queue_failed",
    });
    expect(JSON.stringify(mocks.recordSecurityEvent.mock.calls)).not.toContain(USER_ID);
    expect(JSON.stringify(mocks.recordSecurityEvent.mock.calls)).not.toContain(IMAGE_ID);
  });

  it("maps cancellation ownership outcomes", async () => {
    await expect(
      cancelReviewImage({ imageId: IMAGE_ID, ownerUserId: USER_ID }),
    ).resolves.toEqual({ status: "ok" });

    mocks.queueReviewImageCleanup.mockResolvedValue("forbidden");
    await expect(
      cancelReviewImage({ imageId: IMAGE_ID, ownerUserId: USER_ID }),
    ).resolves.toEqual({ status: "forbidden" });
  });
});
