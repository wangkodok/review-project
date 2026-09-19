import { beforeEach, describe, expect, it, vi } from "vitest";

const IMAGE_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

const mocks = vi.hoisted(() => ({
  processReviewImage: vi.fn(),
  reserveReviewImageUpload: vi.fn(),
  completeReviewImageUpload: vi.fn(),
  queueReviewImageCleanup: vi.fn(),
  putReviewImageObject: vi.fn(),
  deleteReviewImageObject: vi.fn(),
  deleteReviewImageObjectsBestEffort: vi.fn(),
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
  reserveReviewImageUpload: mocks.reserveReviewImageUpload,
  completeReviewImageUpload: mocks.completeReviewImageUpload,
  queueReviewImageCleanup: mocks.queueReviewImageCleanup,
}));
vi.mock("./storage", () => ({
  putReviewImageObject: mocks.putReviewImageObject,
  deleteReviewImageObject: mocks.deleteReviewImageObject,
  deleteReviewImageObjectsBestEffort: mocks.deleteReviewImageObjectsBestEffort,
}));

import { cancelReviewImage, createReadyReviewImage } from "./service";

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

describe("review image service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.processReviewImage.mockResolvedValue(processed);
    mocks.reserveReviewImageUpload.mockResolvedValue({ result: "ok" });
    mocks.putReviewImageObject.mockResolvedValue(undefined);
    mocks.deleteReviewImageObject.mockResolvedValue(undefined);
    mocks.completeReviewImageUpload.mockResolvedValue("ok");
    mocks.deleteReviewImageObjectsBestEffort.mockResolvedValue([]);
    mocks.queueReviewImageCleanup.mockResolvedValue("ok");
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
