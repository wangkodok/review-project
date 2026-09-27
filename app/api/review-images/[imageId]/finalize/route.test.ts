import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewImageError } from "@/app/lib/reviewImages/errors";

const IMAGE_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  isReviewImageUploadEnabled: vi.fn(),
  enforceRateLimit: vi.fn(),
  finalizeReviewImageDirectUpload: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/app/lib/auth/options", () => ({ authOptions: {} }));
vi.mock("@/app/lib/reviewImages/config", () => ({
  isReviewImageUploadEnabled: mocks.isReviewImageUploadEnabled,
}));
vi.mock("@/app/lib/security/rateLimit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));
vi.mock("@/app/lib/reviewImages/service", () => ({
  finalizeReviewImageDirectUpload: mocks.finalizeReviewImageDirectUpload,
}));

import { maxDuration, POST, runtime } from "./route";

const readyImage = {
  imageId: IMAGE_ID,
  width: 1_200,
  height: 800,
  detailByteSize: 800_000,
  thumbnailByteSize: 80_000,
  detailUrl: `https://media.example.invalid/detail/${IMAGE_ID}/image.webp`,
  thumbnailUrl: `https://media.example.invalid/thumbnail/${IMAGE_ID}/image.webp`,
};

function request(imageId = IMAGE_ID) {
  return new Request(
    `http://localhost/api/review-images/${imageId}/finalize`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerUserId: "attacker-controlled" }),
    },
  );
}

function context(imageId = IMAGE_ID) {
  return { params: Promise.resolve({ imageId }) };
}

describe("POST /api/review-images/[imageId]/finalize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.isReviewImageUploadEnabled.mockReturnValue(true);
    mocks.enforceRateLimit.mockResolvedValue(null);
    mocks.finalizeReviewImageDirectUpload.mockResolvedValue(readyImage);
  });

  it("uses the Node.js runtime and a 60-second maximum duration", () => {
    expect(runtime).toBe("nodejs");
    expect(maxDuration).toBe(60);
  });

  it("returns 401 before params, feature, rate limit, or service work", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const params = new Promise<{ imageId: string }>(() => undefined);

    const response = await POST(request(), { params });

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await response.json()).code).toBe("UNAUTHORIZED");
    expect(mocks.isReviewImageUploadEnabled).not.toHaveBeenCalled();
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.finalizeReviewImageDirectUpload).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid UUID before feature or rate limiting", async () => {
    const response = await POST(request("invalid"), context("invalid"));

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await response.json()).code).toBe("INVALID_IMAGE_ID");
    expect(mocks.isReviewImageUploadEnabled).not.toHaveBeenCalled();
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
  });

  it("fails closed with 503 while direct uploads are disabled", async () => {
    mocks.isReviewImageUploadEnabled.mockReturnValue(false);

    const response = await POST(request(), context());

    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("IMAGE_UPLOAD_DISABLED");
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.finalizeReviewImageDirectUpload).not.toHaveBeenCalled();
  });

  it("uses the separate finalize rate limit", async () => {
    mocks.enforceRateLimit.mockResolvedValue(
      Response.json(
        { success: false, data: null, code: "RATE_LIMIT_EXCEEDED" },
        { status: 429, headers: { "Cache-Control": "no-store" } },
      ),
    );

    const response = await POST(request(), context());

    expect(response.status).toBe(429);
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      identifier: USER_ID,
      policy: "reviewImageFinalize",
    });
    expect(mocks.finalizeReviewImageDirectUpload).not.toHaveBeenCalled();
  });

  it.each([
    ["FORBIDDEN", 403],
    ["IMAGE_NOT_FOUND", 404],
    ["IMAGE_UPLOAD_IN_PROGRESS", 409],
    ["IMAGE_UPLOAD_EXPIRED", 410],
    ["IMAGE_TOO_LARGE", 413],
    ["UNSUPPORTED_IMAGE_TYPE", 415],
    ["INVALID_IMAGE", 422],
    ["IMAGE_PROCESSING_FAILED", 422],
    ["IMAGE_STORAGE_UNAVAILABLE", 503],
  ] as const)("maps safe %s errors", async (code, status) => {
    mocks.finalizeReviewImageDirectUpload.mockRejectedValue(
      new ReviewImageError(code, status, "안전한 사진 오류입니다."),
    );

    const response = await POST(request(), context());
    const body = await response.json();

    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({
      success: false,
      data: null,
      message: "안전한 사진 오류입니다.",
      code,
    });
  });

  it("returns only the safe ready DTO and ignores ownership fields in the body", async () => {
    const response = await POST(request(), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.finalizeReviewImageDirectUpload).toHaveBeenCalledWith({
      imageId: IMAGE_ID,
      ownerUserId: USER_ID,
    });
    expect(body).toEqual({
      success: true,
      data: { image: readyImage },
      message: "사진 업로드가 완료되었습니다.",
    });
    expect(JSON.stringify(body)).not.toContain("objectKey");
    expect(JSON.stringify(body)).not.toContain("attacker-controlled");
  });

  it("normalizes an uppercase UUID before calling the service", async () => {
    const uppercaseId = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";

    const response = await POST(request(uppercaseId), context(uppercaseId));

    expect(response.status).toBe(200);
    expect(mocks.finalizeReviewImageDirectUpload).toHaveBeenCalledWith({
      imageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      ownerUserId: USER_ID,
    });
  });

  it("hides unexpected storage and database details", async () => {
    mocks.finalizeReviewImageDirectUpload.mockRejectedValue(
      new Error("private database detail with secretAccessKey"),
    );

    const response = await POST(request(), context());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.code).toBe("INTERNAL_SERVER_ERROR");
    expect(JSON.stringify(body)).not.toContain("private database detail");
    expect(JSON.stringify(body)).not.toContain("secretAccessKey");
  });
});
