import { describe, expect, it, vi } from "vitest";
import type { PreparedClientReviewImage } from "./clientProcessor";
import {
  cancelReviewImageUpload,
  ClientReviewImageUploadError,
  uploadReviewImage,
} from "./clientUpload";

const IMAGE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const UPLOAD_URL =
  "https://r2.example.invalid/temp/source?X-Amz-Credential=secret-looking-value";

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function preparedImage(): PreparedClientReviewImage {
  return {
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
    mimeType: "image/jpeg",
    optimized: false,
  };
}

function slotResponse() {
  return jsonResponse(
    {
      success: true,
      data: {
        uploadSlot: {
          imageId: IMAGE_ID,
          uploadUrl: UPLOAD_URL,
          expiresAt: "2026-09-22T00:03:00.000Z",
          requiredHeaders: { "Content-Type": "image/jpeg" },
        },
      },
      message: "사진 업로드가 준비되었습니다.",
    },
    201,
  );
}

function finalizeResponse() {
  return jsonResponse({
    success: true,
    data: {
      image: {
        imageId: IMAGE_ID,
        width: 1200,
        height: 900,
        detailByteSize: 800_000,
        thumbnailByteSize: 80_000,
        detailUrl: `https://media.sseullae.com/detail/${IMAGE_ID}/image.webp`,
        thumbnailUrl: `https://media.sseullae.com/thumbnail/${IMAGE_ID}/image.webp`,
      },
    },
    message: "사진 업로드가 완료되었습니다.",
  });
}

describe("review image client upload", () => {
  it("uploads in slot POST, cross-origin PUT, finalize POST order", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(slotResponse())
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(finalizeResponse());
    const stages: string[] = [];
    const reserved: string[] = [];

    const result = await uploadReviewImage(preparedImage(), {
      fetchImpl,
      onStage: (stage) => stages.push(stage),
      onReserved: (imageId) => reserved.push(imageId),
      retryDelaysMs: [],
    });

    expect(result.imageId).toBe(IMAGE_ID);
    expect(result.thumbnailUrl).toContain(`/thumbnail/${IMAGE_ID}/image.webp`);
    expect(stages).toEqual(["reserving", "uploading", "finalizing", "ready"]);
    expect(reserved).toEqual([IMAGE_ID]);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "/api/review-images/upload-slot",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        body: JSON.stringify({ byteSize: 3, mimeType: "image/jpeg" }),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      UPLOAD_URL,
      expect.objectContaining({
        method: "PUT",
        credentials: "omit",
        headers: { "Content-Type": "image/jpeg" },
        body: expect.any(Blob),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      `/api/review-images/${IMAGE_ID}/finalize`,
      expect.objectContaining({ method: "POST", credentials: "same-origin" }),
    );
  });

  it("retries a transient PUT failure without requesting a second slot", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(slotResponse())
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(finalizeResponse());

    await expect(
      uploadReviewImage(preparedImage(), {
        fetchImpl,
        retryDelaysMs: [0],
      }),
    ).resolves.toMatchObject({ imageId: IMAGE_ID });

    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(fetchImpl.mock.calls.filter(([url]) => url === UPLOAD_URL)).toHaveLength(2);
  });

  it("stops immediately when cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn<typeof fetch>();

    await expect(
      uploadReviewImage(preparedImage(), {
        fetchImpl,
        signal: controller.signal,
        retryDelaysMs: [0],
      }),
    ).rejects.toMatchObject({ code: "UPLOAD_CANCELLED" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports cancellation after a slot was reserved without finalizing", async () => {
    const controller = new AbortController();
    const reserved: string[] = [];
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(slotResponse())
      .mockImplementationOnce(async () => {
        controller.abort();
        throw new DOMException("aborted", "AbortError");
      });

    await expect(
      uploadReviewImage(preparedImage(), {
        fetchImpl,
        signal: controller.signal,
        onReserved: (imageId) => reserved.push(imageId),
        retryDelaysMs: [0],
      }),
    ).rejects.toMatchObject({ code: "UPLOAD_CANCELLED" });

    expect(reserved).toEqual([IMAGE_ID]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("never exposes the presigned URL through a PUT failure", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(slotResponse())
      .mockRejectedValueOnce(new Error(`network failed for ${UPLOAD_URL}`));

    let caught: unknown;
    try {
      await uploadReviewImage(preparedImage(), {
        fetchImpl,
        retryDelaysMs: [],
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ClientReviewImageUploadError);
    expect(String(caught)).not.toContain(UPLOAD_URL);
    expect((caught as Error).message).toBe(
      "사진을 전송하지 못했습니다. 인터넷 연결을 확인한 후 다시 시도해 주세요.",
    );
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("uses a fixed safe message when finalize returns an unsafe body", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(slotResponse())
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            success: false,
            data: null,
            message: `failed near ${UPLOAD_URL}`,
            code: "INTERNAL_SERVER_ERROR",
          },
          500,
        ),
      );

    await expect(
      uploadReviewImage(preparedImage(), { fetchImpl, retryDelaysMs: [] }),
    ).rejects.toMatchObject({
      code: "FINALIZE_FAILED",
      message: "사진을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    });
  });

  it("cancels a reserved image with a same-origin DELETE", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 200 }));

    await expect(
      cancelReviewImageUpload(IMAGE_ID, { fetchImpl, keepalive: true }),
    ).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(`/api/review-images/${IMAGE_ID}`, {
      method: "DELETE",
      credentials: "same-origin",
      keepalive: true,
    });
  });
});
