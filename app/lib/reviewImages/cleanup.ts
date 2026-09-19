import "server-only";

import {
  claimReviewImageCleanupJobs,
  completeReviewImageCleanupJob,
  queueExpiredReviewImages,
  type ReviewImageCleanupJob,
} from "./repository";
import { deleteReviewImageObject } from "./storage";

const EXPIRED_IMAGE_LIMIT = 100;
const CLEANUP_JOB_LIMIT = 25;
const CLEANUP_CONCURRENCY = 5;

type CleanupJobResult =
  | "deleted"
  | "retry_scheduled"
  | "failed"
  | "completion_failed";

export type ReviewImageCleanupResult = {
  queued: number;
  claimed: number;
  deleted: number;
  retryScheduled: number;
  failed: number;
  completionFailed: number;
};

export function getCleanupRetryAfterSeconds(attemptCount: number) {
  const boundedAttempt = Math.max(1, Math.min(attemptCount, 10));
  return Math.min(86_400, 300 * 2 ** (boundedAttempt - 1));
}

async function processCleanupJob(
  job: ReviewImageCleanupJob,
): Promise<CleanupJobResult> {
  try {
    await deleteReviewImageObject(job.bucketKind, job.objectKey);
  } catch {
    try {
      const completion = await completeReviewImageCleanupJob({
        jobId: job.jobId,
        succeeded: false,
        errorCode: "R2_DELETE_FAILED",
        retryAfterSeconds: getCleanupRetryAfterSeconds(job.attemptCount),
      });

      if (completion === "retry_scheduled" || completion === "failed") {
        return completion;
      }

      return "completion_failed";
    } catch {
      return "completion_failed";
    }
  }

  try {
    const completion = await completeReviewImageCleanupJob({
      jobId: job.jobId,
      succeeded: true,
      errorCode: null,
      retryAfterSeconds: null,
    });

    return completion === "ok" ? "deleted" : "completion_failed";
  } catch {
    // A stale processing lock lets a later run retry this idempotent R2 delete.
    return "completion_failed";
  }
}

export async function runReviewImageCleanup(): Promise<ReviewImageCleanupResult> {
  const queued = await queueExpiredReviewImages(EXPIRED_IMAGE_LIMIT);
  const jobs = await claimReviewImageCleanupJobs(CLEANUP_JOB_LIMIT);
  const jobResults: CleanupJobResult[] = [];

  for (let index = 0; index < jobs.length; index += CLEANUP_CONCURRENCY) {
    const batch = jobs.slice(index, index + CLEANUP_CONCURRENCY);
    jobResults.push(...(await Promise.all(batch.map(processCleanupJob))));
  }

  return {
    queued,
    claimed: jobs.length,
    deleted: jobResults.filter((result) => result === "deleted").length,
    retryScheduled: jobResults.filter((result) => result === "retry_scheduled")
      .length,
    failed: jobResults.filter((result) => result === "failed").length,
    completionFailed: jobResults.filter(
      (result) => result === "completion_failed",
    ).length,
  };
}
