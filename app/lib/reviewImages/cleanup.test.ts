import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queueExpiredReviewImages: vi.fn(),
  claimReviewImageCleanupJobs: vi.fn(),
  completeReviewImageCleanupJob: vi.fn(),
  deleteReviewImageObject: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("./repository", () => ({
  queueExpiredReviewImages: mocks.queueExpiredReviewImages,
  claimReviewImageCleanupJobs: mocks.claimReviewImageCleanupJobs,
  completeReviewImageCleanupJob: mocks.completeReviewImageCleanupJob,
}));
vi.mock("./storage", () => ({
  deleteReviewImageObject: mocks.deleteReviewImageObject,
}));

import {
  getCleanupRetryAfterSeconds,
  runReviewImageCleanup,
} from "./cleanup";

const jobs = [
  {
    jobId: "11111111-1111-4111-8111-111111111111",
    bucketKind: "temp" as const,
    objectKind: "temp" as const,
    objectKey: "temp/image/source",
    attemptCount: 1,
  },
  {
    jobId: "22222222-2222-4222-8222-222222222222",
    bucketKind: "public" as const,
    objectKind: "detail" as const,
    objectKey: "detail/image/image.webp",
    attemptCount: 3,
  },
];

describe("review image cleanup worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queueExpiredReviewImages.mockResolvedValue(2);
    mocks.claimReviewImageCleanupJobs.mockResolvedValue(jobs);
    mocks.deleteReviewImageObject.mockResolvedValue(undefined);
    mocks.completeReviewImageCleanupJob.mockResolvedValue("ok");
  });

  it("queues expired images, claims bounded work, and completes deletions", async () => {
    await expect(runReviewImageCleanup()).resolves.toEqual({
      queued: 2,
      claimed: 2,
      deleted: 2,
      retryScheduled: 0,
      failed: 0,
      completionFailed: 0,
    });

    expect(mocks.queueExpiredReviewImages).toHaveBeenCalledWith(100);
    expect(mocks.claimReviewImageCleanupJobs).toHaveBeenCalledWith(25);
    expect(mocks.deleteReviewImageObject).toHaveBeenCalledWith(
      "temp",
      "temp/image/source",
    );
    expect(mocks.completeReviewImageCleanupJob).toHaveBeenCalledWith({
      jobId: jobs[0].jobId,
      succeeded: true,
      errorCode: null,
      retryAfterSeconds: null,
    });
  });

  it("schedules a bounded retry when R2 deletion fails", async () => {
    mocks.claimReviewImageCleanupJobs.mockResolvedValue([jobs[1]]);
    mocks.deleteReviewImageObject.mockRejectedValue(new Error("private R2 detail"));
    mocks.completeReviewImageCleanupJob.mockResolvedValue("retry_scheduled");

    await expect(runReviewImageCleanup()).resolves.toMatchObject({
      claimed: 1,
      retryScheduled: 1,
      deleted: 0,
    });

    expect(mocks.completeReviewImageCleanupJob).toHaveBeenCalledWith({
      jobId: jobs[1].jobId,
      succeeded: false,
      errorCode: "R2_DELETE_FAILED",
      retryAfterSeconds: 1_200,
    });
  });

  it("leaves an uncompleted job reclaimable after its processing lock expires", async () => {
    mocks.claimReviewImageCleanupJobs.mockResolvedValue([jobs[0]]);
    mocks.completeReviewImageCleanupJob.mockRejectedValue(
      new Error("private database detail"),
    );

    await expect(runReviewImageCleanup()).resolves.toMatchObject({
      claimed: 1,
      completionFailed: 1,
      deleted: 0,
    });
  });

  it("caps retry delays at one day", () => {
    expect(getCleanupRetryAfterSeconds(1)).toBe(300);
    expect(getCleanupRetryAfterSeconds(10)).toBe(86_400);
    expect(getCleanupRetryAfterSeconds(100)).toBe(86_400);
  });
});
