import { beforeEach, describe, expect, it, vi } from "vitest";

const USER_ID = "22222222-2222-4222-8222-222222222222";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  isReviewImageUploadEnabled: vi.fn(),
  enforceRateLimit: vi.fn(),
  readReviewImageRequestBody: vi.fn(),
  createReadyReviewImage: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/app/lib/auth/options", () => ({ authOptions: {} }));
vi.mock("@/app/lib/reviewImages/config", () => ({
  isReviewImageUploadEnabled: mocks.isReviewImageUploadEnabled,
}));
vi.mock("@/app/lib/reviewImages/requestBody", () => ({
  readReviewImageRequestBody: mocks.readReviewImageRequestBody,
}));
vi.mock("@/app/lib/reviewImages/service", () => ({
  createReadyReviewImage: mocks.createReadyReviewImage,
}));
vi.mock("@/app/lib/security/rateLimit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));

import { ReviewImageError } from "@/app/lib/reviewImages/errors";
import { POST } from "./route";

function imageRequest() {
  return new Request("http://localhost/api/review-images", {
    method: "POST",
    body: new Uint8Array([1, 2, 3]),
  });
}

describe("POST /api/review-images", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.isReviewImageUploadEnabled.mockReturnValue(true);
    mocks.enforceRateLimit.mockResolvedValue(null);
    mocks.readReviewImageRequestBody.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mocks.createReadyReviewImage.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      width: 1_200,
      height: 800,
      detailByteSize: 800_000,
      thumbnailByteSize: 80_000,
    });
  });

  it("rejects unauthenticated requests before reading a file", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const response = await POST(imageRequest());

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("UNAUTHORIZED");
    expect(mocks.readReviewImageRequestBody).not.toHaveBeenCalled();
  });

  it("fails closed while the feature switch is disabled", async () => {
    mocks.isReviewImageUploadEnabled.mockReturnValue(false);

    const response = await POST(imageRequest());

    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("IMAGE_UPLOAD_DISABLED");
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
  });

  it("returns the shared rate limit response before reading a file", async () => {
    mocks.enforceRateLimit.mockResolvedValue(
      Response.json({ success: false, code: "RATE_LIMIT_EXCEEDED" }, { status: 429 }),
    );

    const response = await POST(imageRequest());

    expect(response.status).toBe(429);
    expect(mocks.readReviewImageRequestBody).not.toHaveBeenCalled();
  });

  it("returns only safe prepared image metadata", async () => {
    const response = await POST(imageRequest());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.data.image).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      width: 1_200,
      height: 800,
      detailByteSize: 800_000,
      thumbnailByteSize: 80_000,
    });
    expect(JSON.stringify(body)).not.toContain("objectKey");
  });

  it("maps a bounded image error without exposing internal details", async () => {
    mocks.readReviewImageRequestBody.mockRejectedValue(
      new ReviewImageError("IMAGE_TOO_LARGE", 413, "처리된 사진은 2MB 이하여야 합니다."),
    );

    const response = await POST(imageRequest());

    expect(response.status).toBe(413);
    expect((await response.json()).code).toBe("IMAGE_TOO_LARGE");
  });

  it("returns a generic response for an unexpected storage failure", async () => {
    mocks.createReadyReviewImage.mockRejectedValue(new Error("private storage detail"));

    const response = await POST(imageRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_SERVER_ERROR");
    expect(JSON.stringify(body)).not.toContain("private storage detail");
  });
});
