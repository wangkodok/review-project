import "server-only";

import { createSupabaseServerClient } from "@/app/lib/supabase/server";
import {
  ACTUAL_REVIEW_IMAGE_MIME_TYPES,
  DECLARED_REVIEW_IMAGE_MIME_TYPES,
  MAX_REVIEW_IMAGE_DETAIL_BYTES,
  MAX_REVIEW_IMAGE_EDGE,
  MAX_REVIEW_IMAGE_ORIGINAL_BYTES,
  MAX_REVIEW_IMAGE_THUMBNAIL_BYTES,
} from "./constants";
import type {
  ActualReviewImageMime,
  DeclaredReviewImageMime,
} from "./uploadContract";

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

const directUploadStatuses = new Set([
  "uploading",
  "processing",
  "ready",
  "attached",
  "delete_pending",
]);
const contextFailureResults = new Set(["invalid_input", "not_found", "forbidden"]);
const reserveFailureResults = new Set([
  "invalid_input",
  "user_not_found",
  "id_conflict",
  "upload_in_progress",
  "quota_exceeded",
]);
const claimResults = new Set([
  "invalid_input",
  "not_found",
  "forbidden",
  "processing",
  "ready",
  "invalid_state",
  "expired",
  "size_mismatch",
  "ok",
]);
const completeResults = new Set([
  "invalid_input",
  "not_found",
  "forbidden",
  "invalid_state",
  "object_key_mismatch",
  "ok",
]);
const declaredMimeTypes = new Set<string>(DECLARED_REVIEW_IMAGE_MIME_TYPES);
const actualMimeTypes = new Set<string>(ACTUAL_REVIEW_IMAGE_MIME_TYPES);

type DirectUploadStatus =
  | "uploading"
  | "processing"
  | "ready"
  | "attached"
  | "delete_pending";

export type ReviewImageDirectUploadContext =
  | { result: "invalid_input" | "not_found" | "forbidden" }
  | {
      result: "ok";
      status: DirectUploadStatus;
      tempObjectKey: string | null;
      detailObjectKey: string | null;
      thumbnailObjectKey: string | null;
      expectedTempByteSize: number | null;
      declaredSourceMimeType: DeclaredReviewImageMime | null;
      sourceMimeType: ActualReviewImageMime | null;
      width: number | null;
      height: number | null;
      detailByteSize: number | null;
      thumbnailByteSize: number | null;
    };

type RpcResponse = {
  data: unknown;
  error: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number | null {
  return (
    value === null ||
    (typeof value === "number" &&
      Number.isInteger(value) &&
      value >= minimum &&
      value <= maximum)
  );
}

function isNullableDeclaredMime(
  value: unknown,
): value is DeclaredReviewImageMime | null {
  return value === null || (typeof value === "string" && declaredMimeTypes.has(value));
}

function isNullableActualMime(
  value: unknown,
): value is ActualReviewImageMime | null {
  return value === null || (typeof value === "string" && actualMimeTypes.has(value));
}

async function callDirectUploadRpc(
  name: string,
  parameters: Record<string, unknown>,
  failureMessage: string,
) {
  try {
    const supabase = createSupabaseServerClient();
    const response = (await supabase.rpc(name, parameters)) as RpcResponse;

    if (response.error) {
      throw new Error(failureMessage);
    }

    return response.data;
  } catch {
    throw new Error(failureMessage);
  }
}

export async function getReviewImageDirectUploadContext(input: {
  imageId: string;
  ownerUserId: string;
}): Promise<ReviewImageDirectUploadContext> {
  const data = await callDirectUploadRpc(
    "get_review_image_direct_upload_context",
    {
      p_image_id: input.imageId,
      p_owner_user_id: input.ownerUserId,
    },
    "Review image direct-upload context failed",
  );
  const row = firstRow<Record<string, unknown>>(data);

  if (!isRecord(row) || typeof row.result !== "string") {
    throw new Error("Review image direct-upload context returned invalid data");
  }

  if (contextFailureResults.has(row.result)) {
    return {
      result: row.result as "invalid_input" | "not_found" | "forbidden",
    };
  }

  if (
    row.result !== "ok" ||
    typeof row.status !== "string" ||
    !directUploadStatuses.has(row.status) ||
    !isNullableString(row.temp_object_key) ||
    !isNullableString(row.detail_object_key) ||
    !isNullableString(row.thumbnail_object_key) ||
    !isNullableIntegerInRange(
      row.expected_temp_byte_size,
      1,
      MAX_REVIEW_IMAGE_ORIGINAL_BYTES,
    ) ||
    !isNullableDeclaredMime(row.declared_source_mime_type) ||
    !isNullableActualMime(row.source_mime_type) ||
    !isNullableIntegerInRange(row.width, 1, MAX_REVIEW_IMAGE_EDGE) ||
    !isNullableIntegerInRange(row.height, 1, MAX_REVIEW_IMAGE_EDGE) ||
    !isNullableIntegerInRange(
      row.detail_byte_size,
      1,
      MAX_REVIEW_IMAGE_DETAIL_BYTES,
    ) ||
    !isNullableIntegerInRange(
      row.thumbnail_byte_size,
      1,
      MAX_REVIEW_IMAGE_THUMBNAIL_BYTES,
    )
  ) {
    throw new Error("Review image direct-upload context returned invalid data");
  }

  return {
    result: "ok",
    status: row.status as DirectUploadStatus,
    tempObjectKey: row.temp_object_key,
    detailObjectKey: row.detail_object_key,
    thumbnailObjectKey: row.thumbnail_object_key,
    expectedTempByteSize: row.expected_temp_byte_size,
    declaredSourceMimeType: row.declared_source_mime_type,
    sourceMimeType: row.source_mime_type,
    width: row.width,
    height: row.height,
    detailByteSize: row.detail_byte_size,
    thumbnailByteSize: row.thumbnail_byte_size,
  };
}

export async function reserveReviewImageDirectUpload(input: {
  imageId: string;
  ownerUserId: string;
  tempObjectKey: string;
  detailObjectKey: string;
  thumbnailObjectKey: string;
  expectedTempByteSize: number;
  declaredSourceMimeType: DeclaredReviewImageMime;
  expiresAt: string;
}) {
  const data = await callDirectUploadRpc(
    "reserve_review_image_direct_upload_atomic",
    {
      p_image_id: input.imageId,
      p_owner_user_id: input.ownerUserId,
      p_temp_object_key: input.tempObjectKey,
      p_detail_object_key: input.detailObjectKey,
      p_thumbnail_object_key: input.thumbnailObjectKey,
      p_expected_temp_byte_size: input.expectedTempByteSize,
      p_declared_source_mime_type: input.declaredSourceMimeType,
      p_expires_at: input.expiresAt,
    },
    "Review image direct-upload reservation failed",
  );
  const row = firstRow<Record<string, unknown>>(data);

  if (!isRecord(row) || typeof row.result !== "string") {
    throw new Error("Review image direct-upload reservation returned invalid data");
  }

  if (reserveFailureResults.has(row.result)) {
    return {
      result: row.result as
        | "invalid_input"
        | "user_not_found"
        | "id_conflict"
        | "upload_in_progress"
        | "quota_exceeded",
    };
  }

  const expectedReservation = input.expectedTempByteSize + 1_100_000;

  if (
    row.result !== "ok" ||
    row.image_id !== input.imageId ||
    row.reserved_byte_size !== expectedReservation
  ) {
    throw new Error("Review image direct-upload reservation returned invalid data");
  }

  return {
    result: "ok" as const,
    imageId: row.image_id,
    reservedByteSize: row.reserved_byte_size,
  };
}

export async function claimReviewImageTempUpload(input: {
  imageId: string;
  ownerUserId: string;
  tempByteSize: number;
}) {
  const data = await callDirectUploadRpc(
    "claim_review_image_temp_upload_atomic",
    {
      p_image_id: input.imageId,
      p_owner_user_id: input.ownerUserId,
      p_temp_byte_size: input.tempByteSize,
    },
    "Review image direct-upload claim failed",
  );

  if (typeof data !== "string" || !claimResults.has(data)) {
    throw new Error("Review image direct-upload claim returned invalid data");
  }

  return data as
    | "invalid_input"
    | "not_found"
    | "forbidden"
    | "processing"
    | "ready"
    | "invalid_state"
    | "expired"
    | "size_mismatch"
    | "ok";
}

export async function completeReviewImageDirectUpload(input: {
  imageId: string;
  ownerUserId: string;
  detailObjectKey: string;
  thumbnailObjectKey: string;
  width: number;
  height: number;
  sourceMimeType: ActualReviewImageMime;
  detailByteSize: number;
  thumbnailByteSize: number;
  tempDeleted: true;
}) {
  const data = await callDirectUploadRpc(
    "complete_review_image_direct_upload_atomic",
    {
      p_image_id: input.imageId,
      p_owner_user_id: input.ownerUserId,
      p_detail_object_key: input.detailObjectKey,
      p_thumbnail_object_key: input.thumbnailObjectKey,
      p_width: input.width,
      p_height: input.height,
      p_source_mime_type: input.sourceMimeType,
      p_detail_byte_size: input.detailByteSize,
      p_thumbnail_byte_size: input.thumbnailByteSize,
      p_temp_deleted: input.tempDeleted,
    },
    "Review image direct-upload completion failed",
  );

  if (typeof data !== "string" || !completeResults.has(data)) {
    throw new Error("Review image direct-upload completion returned invalid data");
  }

  return data as
    | "invalid_input"
    | "not_found"
    | "forbidden"
    | "invalid_state"
    | "object_key_mismatch"
    | "ok";
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
