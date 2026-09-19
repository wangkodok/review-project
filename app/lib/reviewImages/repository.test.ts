import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({ rpc: mocks.rpc }),
}));

import {
  claimReviewImageCleanupJobs,
  completeReviewImageCleanupJob,
  completeReviewImageUpload,
  queueExpiredReviewImages,
  queueReviewImageCleanup,
  reserveReviewImageUpload,
} from "./repository";

const IMAGE_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

describe("review image repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reserves storage through the approved atomic RPC", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ result: "ok", image_id: IMAGE_ID, reserved_byte_size: 3_100_000 }],
      error: null,
    });

    const result = await reserveReviewImageUpload({
      imageId: IMAGE_ID,
      ownerUserId: USER_ID,
      tempObjectKey: `temp/${IMAGE_ID}/source`,
      detailObjectKey: `detail/${IMAGE_ID}/image.webp`,
      thumbnailObjectKey: `thumbnail/${IMAGE_ID}/image.webp`,
      expiresAt: "2026-09-14T03:00:00.000Z",
    });

    expect(result.result).toBe("ok");
    expect(mocks.rpc).toHaveBeenCalledWith("reserve_review_image_upload_atomic", {
      p_image_id: IMAGE_ID,
      p_owner_user_id: USER_ID,
      p_temp_object_key: `temp/${IMAGE_ID}/source`,
      p_detail_object_key: `detail/${IMAGE_ID}/image.webp`,
      p_thumbnail_object_key: `thumbnail/${IMAGE_ID}/image.webp`,
      p_expires_at: "2026-09-14T03:00:00.000Z",
    });
  });

  it("completes storage accounting with server-observed byte sizes", async () => {
    mocks.rpc.mockResolvedValue({ data: "ok", error: null });

    await expect(
      completeReviewImageUpload({
        imageId: IMAGE_ID,
        ownerUserId: USER_ID,
        detailObjectKey: `detail/${IMAGE_ID}/image.webp`,
        thumbnailObjectKey: `thumbnail/${IMAGE_ID}/image.webp`,
        width: 1_200,
        height: 800,
        tempByteSize: 500_000,
        detailByteSize: 800_000,
        thumbnailByteSize: 80_000,
      }),
    ).resolves.toBe("ok");

    expect(mocks.rpc).toHaveBeenCalledWith("complete_review_image_upload_atomic", {
      p_image_id: IMAGE_ID,
      p_owner_user_id: USER_ID,
      p_detail_object_key: `detail/${IMAGE_ID}/image.webp`,
      p_thumbnail_object_key: `thumbnail/${IMAGE_ID}/image.webp`,
      p_mime_type: "image/webp",
      p_width: 1_200,
      p_height: 800,
      p_temp_byte_size: 500_000,
      p_detail_byte_size: 800_000,
      p_thumbnail_byte_size: 80_000,
      p_temp_deleted: true,
    });
  });

  it("queues cancellation with session-derived ownership", async () => {
    mocks.rpc.mockResolvedValue({ data: "ok", error: null });

    await expect(
      queueReviewImageCleanup({ imageId: IMAGE_ID, ownerUserId: USER_ID }),
    ).resolves.toBe("ok");
    expect(mocks.rpc).toHaveBeenCalledWith("queue_review_image_cleanup_atomic", {
      p_image_id: IMAGE_ID,
      p_owner_user_id: USER_ID,
    });
  });

  it("does not expose private database errors", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "private database detail" },
    });

    await expect(
      queueReviewImageCleanup({ imageId: IMAGE_ID, ownerUserId: USER_ID }),
    ).rejects.toThrow("Review image cleanup queue failed");
  });

  it("queues expired images with a bounded batch", async () => {
    mocks.rpc.mockResolvedValue({ data: 4, error: null });

    await expect(queueExpiredReviewImages(100)).resolves.toBe(4);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "queue_expired_review_images_atomic",
      { p_limit: 100 },
    );
  });

  it("claims cleanup jobs and maps only the required fields", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          job_id: IMAGE_ID,
          bucket_kind: "public",
          object_kind: "detail",
          object_key: `detail/${IMAGE_ID}/image.webp`,
          attempt_count: 2,
        },
      ],
      error: null,
    });

    await expect(claimReviewImageCleanupJobs(25)).resolves.toEqual([
      {
        jobId: IMAGE_ID,
        bucketKind: "public",
        objectKind: "detail",
        objectKey: `detail/${IMAGE_ID}/image.webp`,
        attemptCount: 2,
      },
    ]);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "claim_review_image_cleanup_jobs",
      { p_limit: 25 },
    );
  });

  it("rejects malformed claimed jobs", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          job_id: IMAGE_ID,
          bucket_kind: "private",
          object_kind: "detail",
          object_key: "private/key",
          attempt_count: 1,
        },
      ],
      error: null,
    });

    await expect(claimReviewImageCleanupJobs(25)).rejects.toThrow(
      "Review image cleanup claim returned invalid data",
    );
  });

  it("completes cleanup through the atomic accounting RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: "retry_scheduled", error: null });

    await expect(
      completeReviewImageCleanupJob({
        jobId: IMAGE_ID,
        succeeded: false,
        errorCode: "R2_DELETE_FAILED",
        retryAfterSeconds: 600,
      }),
    ).resolves.toBe("retry_scheduled");
    expect(mocks.rpc).toHaveBeenCalledWith(
      "complete_review_image_cleanup_job_atomic",
      {
        p_job_id: IMAGE_ID,
        p_succeeded: false,
        p_error_code: "R2_DELETE_FAILED",
        p_retry_after_seconds: 600,
      },
    );
  });
});
