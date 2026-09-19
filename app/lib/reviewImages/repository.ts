import "server-only";

import { createSupabaseServerClient } from "@/app/lib/supabase/server";

type ReserveRow = {
  result: string;
  image_id: string | null;
  reserved_byte_size: number | null;
};

export type ReviewImageCleanupJob = {
  jobId: string;
  bucketKind: "temp" | "public";
  objectKind: "temp" | "detail" | "thumbnail";
  objectKey: string;
  attemptCount: number;
};

type CleanupJobRow = {
  job_id: string;
  bucket_kind: string;
  object_kind: string;
  object_key: string;
  attempt_count: number;
};

function firstRow<T>(data: unknown) {
  return Array.isArray(data) ? (data[0] as T | undefined) : undefined;
}

export async function reserveReviewImageUpload(input: {
  imageId: string;
  ownerUserId: string;
  tempObjectKey: string;
  detailObjectKey: string;
  thumbnailObjectKey: string;
  expiresAt: string;
}) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("reserve_review_image_upload_atomic", {
    p_image_id: input.imageId,
    p_owner_user_id: input.ownerUserId,
    p_temp_object_key: input.tempObjectKey,
    p_detail_object_key: input.detailObjectKey,
    p_thumbnail_object_key: input.thumbnailObjectKey,
    p_expires_at: input.expiresAt,
  });

  if (error) {
    throw new Error("Review image reservation failed");
  }

  const row = firstRow<ReserveRow>(data);

  if (!row) {
    throw new Error("Review image reservation returned no result");
  }

  return row;
}

export async function completeReviewImageUpload(input: {
  imageId: string;
  ownerUserId: string;
  detailObjectKey: string;
  thumbnailObjectKey: string;
  width: number;
  height: number;
  tempByteSize: number;
  detailByteSize: number;
  thumbnailByteSize: number;
}) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("complete_review_image_upload_atomic", {
    p_image_id: input.imageId,
    p_owner_user_id: input.ownerUserId,
    p_detail_object_key: input.detailObjectKey,
    p_thumbnail_object_key: input.thumbnailObjectKey,
    p_mime_type: "image/webp",
    p_width: input.width,
    p_height: input.height,
    p_temp_byte_size: input.tempByteSize,
    p_detail_byte_size: input.detailByteSize,
    p_thumbnail_byte_size: input.thumbnailByteSize,
    p_temp_deleted: true,
  });

  if (error) {
    throw new Error("Review image completion failed");
  }

  return data as string | null;
}

export async function queueReviewImageCleanup(input: {
  imageId: string;
  ownerUserId: string;
}) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("queue_review_image_cleanup_atomic", {
    p_image_id: input.imageId,
    p_owner_user_id: input.ownerUserId,
  });

  if (error) {
    throw new Error("Review image cleanup queue failed");
  }

  return data as string | null;
}

export async function queueExpiredReviewImages(limit: number) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc(
    "queue_expired_review_images_atomic",
    { p_limit: limit },
  );

  if (error || !Number.isInteger(data) || data < 0 || data > limit) {
    throw new Error("Expired review image queue failed");
  }

  return data as number;
}

export async function claimReviewImageCleanupJobs(limit: number) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc(
    "claim_review_image_cleanup_jobs",
    { p_limit: limit },
  );

  if (error || !Array.isArray(data)) {
    throw new Error("Review image cleanup claim failed");
  }

  return data.map((row: CleanupJobRow): ReviewImageCleanupJob => {
    if (
      !row ||
      typeof row.job_id !== "string" ||
      (row.bucket_kind !== "temp" && row.bucket_kind !== "public") ||
      !["temp", "detail", "thumbnail"].includes(row.object_kind) ||
      typeof row.object_key !== "string" ||
      !Number.isInteger(row.attempt_count) ||
      row.attempt_count < 1
    ) {
      throw new Error("Review image cleanup claim returned invalid data");
    }

    return {
      jobId: row.job_id,
      bucketKind: row.bucket_kind,
      objectKind: row.object_kind as ReviewImageCleanupJob["objectKind"],
      objectKey: row.object_key,
      attemptCount: row.attempt_count,
    };
  });
}

export async function completeReviewImageCleanupJob(input: {
  jobId: string;
  succeeded: boolean;
  errorCode: string | null;
  retryAfterSeconds: number | null;
}) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc(
    "complete_review_image_cleanup_job_atomic",
    {
      p_job_id: input.jobId,
      p_succeeded: input.succeeded,
      p_error_code: input.errorCode,
      p_retry_after_seconds: input.retryAfterSeconds,
    },
  );

  if (error || typeof data !== "string") {
    throw new Error("Review image cleanup completion failed");
  }

  return data;
}
