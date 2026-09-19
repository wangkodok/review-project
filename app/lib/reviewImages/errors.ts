export type ReviewImageErrorCode =
  | "IMAGE_UPLOAD_DISABLED"
  | "IMAGE_REQUIRED"
  | "IMAGE_TOO_LARGE"
  | "UNSUPPORTED_IMAGE_TYPE"
  | "INVALID_IMAGE"
  | "IMAGE_PROCESSING_FAILED"
  | "IMAGE_UPLOAD_IN_PROGRESS"
  | "STORAGE_QUOTA_EXCEEDED"
  | "IMAGE_NOT_FOUND"
  | "FORBIDDEN"
  | "IMAGE_STORAGE_UNAVAILABLE";

export class ReviewImageError extends Error {
  constructor(
    public readonly code: ReviewImageErrorCode,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ReviewImageError";
  }
}
