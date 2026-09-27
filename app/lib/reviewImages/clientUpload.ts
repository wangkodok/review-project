import type { PreparedClientReviewImage } from "./clientProcessor";
import type {
  ReadyReviewImage,
  ReviewImageUploadSlot,
} from "./uploadContract";

export type ReviewImageUploadStage =
  | "reserving"
  | "uploading"
  | "finalizing"
  | "ready";

export type ClientReviewImageUploadErrorCode =
  | "UPLOAD_CANCELLED"
  | "SLOT_FAILED"
  | "UPLOAD_FAILED"
  | "FINALIZE_FAILED";

export class ClientReviewImageUploadError extends Error {
  constructor(
    public readonly code: ClientReviewImageUploadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ClientReviewImageUploadError";
  }
}

type UploadOptions = {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  onStage?: (stage: ReviewImageUploadStage) => void;
  onReserved?: (imageId: string) => void;
  retryDelaysMs?: readonly number[];
};

type CancelOptions = {
  fetchImpl?: typeof fetch;
  keepalive?: boolean;
};

const DEFAULT_RETRY_DELAYS_MS = [250] as const;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cancelled(): ClientReviewImageUploadError {
  return new ClientReviewImageUploadError(
    "UPLOAD_CANCELLED",
    "사진 업로드가 취소되었습니다.",
  );
}

function assertNotCancelled(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw cancelled();
  }
}

function isTransientStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function waitForRetry(delayMs: number, signal?: AbortSignal) {
  if (delayMs <= 0) {
    assertNotCancelled(signal);
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const timeout = globalThis.setTimeout(resolve, delayMs);

    signal?.addEventListener(
      "abort",
      () => {
        globalThis.clearTimeout(timeout);
        reject(cancelled());
      },
      { once: true },
    );
  });
}

async function fetchWithRetry(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  retryDelaysMs: readonly number[],
  signal?: AbortSignal,
) {
  let attempt = 0;

  while (true) {
    assertNotCancelled(signal);

    try {
      const response = await fetchImpl(url, { ...init, signal });

      if (!isTransientStatus(response.status) || attempt >= retryDelaysMs.length) {
        return response;
      }
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
        throw cancelled();
      }

      if (attempt >= retryDelaysMs.length) {
        throw error;
      }
    }

    await waitForRetry(retryDelaysMs[attempt], signal);
    attempt += 1;
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function parseUploadSlot(value: unknown): ReviewImageUploadSlot | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const envelope = value as Record<string, unknown>;
  const data = envelope.data;
  if (envelope.success !== true || !data || typeof data !== "object") {
    return null;
  }

  const slot = (data as Record<string, unknown>).uploadSlot;
  if (!slot || typeof slot !== "object") {
    return null;
  }

  const candidate = slot as Record<string, unknown>;
  const requiredHeaders = candidate.requiredHeaders;
  const contentType =
    requiredHeaders && typeof requiredHeaders === "object"
      ? (requiredHeaders as Record<string, unknown>)["Content-Type"]
      : null;

  if (
    typeof candidate.imageId !== "string" ||
    !UUID_PATTERN.test(candidate.imageId) ||
    typeof candidate.uploadUrl !== "string" ||
    !candidate.uploadUrl.startsWith("https://") ||
    typeof candidate.expiresAt !== "string" ||
    typeof contentType !== "string"
  ) {
    return null;
  }

  return {
    imageId: candidate.imageId,
    uploadUrl: candidate.uploadUrl,
    expiresAt: candidate.expiresAt,
    requiredHeaders: { "Content-Type": contentType as ReviewImageUploadSlot["requiredHeaders"]["Content-Type"] },
  };
}

function parseReadyImage(value: unknown): ReadyReviewImage | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const envelope = value as Record<string, unknown>;
  const data = envelope.data;
  if (envelope.success !== true || !data || typeof data !== "object") {
    return null;
  }

  const image = (data as Record<string, unknown>).image;
  if (!image || typeof image !== "object") {
    return null;
  }

  const candidate = image as Record<string, unknown>;
  if (
    typeof candidate.imageId !== "string" ||
    !UUID_PATTERN.test(candidate.imageId) ||
    typeof candidate.width !== "number" ||
    typeof candidate.height !== "number" ||
    typeof candidate.detailByteSize !== "number" ||
    typeof candidate.thumbnailByteSize !== "number" ||
    typeof candidate.detailUrl !== "string" ||
    typeof candidate.thumbnailUrl !== "string"
  ) {
    return null;
  }

  return candidate as ReadyReviewImage;
}

export async function uploadReviewImage(
  image: PreparedClientReviewImage,
  options: UploadOptions = {},
): Promise<ReadyReviewImage> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;

  assertNotCancelled(options.signal);
  options.onStage?.("reserving");

  let slotResponse: Response;
  try {
    slotResponse = await fetchWithRetry(
      fetchImpl,
      "/api/review-images/upload-slot",
      {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          byteSize: image.blob.size,
          mimeType: image.mimeType,
        }),
      },
      retryDelaysMs,
      options.signal,
    );
  } catch (error) {
    if (error instanceof ClientReviewImageUploadError) {
      throw error;
    }
    throw new ClientReviewImageUploadError(
      "SLOT_FAILED",
      "사진 업로드를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }

  const slot = parseUploadSlot(await readJson(slotResponse));
  if (!slotResponse.ok || !slot || slot.requiredHeaders["Content-Type"] !== image.mimeType) {
    throw new ClientReviewImageUploadError(
      "SLOT_FAILED",
      "사진 업로드를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }

  options.onReserved?.(slot.imageId);
  options.onStage?.("uploading");

  let uploadResponse: Response;
  try {
    uploadResponse = await fetchWithRetry(
      fetchImpl,
      slot.uploadUrl,
      {
        method: "PUT",
        credentials: "omit",
        headers: slot.requiredHeaders,
        body: image.blob,
      },
      retryDelaysMs,
      options.signal,
    );
  } catch (error) {
    if (error instanceof ClientReviewImageUploadError) {
      throw error;
    }
    throw new ClientReviewImageUploadError(
      "UPLOAD_FAILED",
      "사진을 전송하지 못했습니다. 인터넷 연결을 확인한 후 다시 시도해 주세요.",
    );
  }

  if (!uploadResponse.ok) {
    throw new ClientReviewImageUploadError(
      "UPLOAD_FAILED",
      "사진을 전송하지 못했습니다. 인터넷 연결을 확인한 후 다시 시도해 주세요.",
    );
  }

  options.onStage?.("finalizing");

  let finalizeResponse: Response;
  try {
    finalizeResponse = await fetchWithRetry(
      fetchImpl,
      `/api/review-images/${slot.imageId}/finalize`,
      { method: "POST", credentials: "same-origin" },
      retryDelaysMs,
      options.signal,
    );
  } catch (error) {
    if (error instanceof ClientReviewImageUploadError) {
      throw error;
    }
    throw new ClientReviewImageUploadError(
      "FINALIZE_FAILED",
      "사진을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }

  const readyImage = parseReadyImage(await readJson(finalizeResponse));
  if (!finalizeResponse.ok || !readyImage || readyImage.imageId !== slot.imageId) {
    throw new ClientReviewImageUploadError(
      "FINALIZE_FAILED",
      "사진을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }

  options.onStage?.("ready");
  return readyImage;
}

export async function cancelReviewImageUpload(
  imageId: string,
  options: CancelOptions = {},
) {
  try {
    const response = await (options.fetchImpl ?? fetch)(
      `/api/review-images/${imageId}`,
      {
        method: "DELETE",
        credentials: "same-origin",
        keepalive: options.keepalive,
      },
    );
    return response.ok;
  } catch {
    return false;
  }
}
