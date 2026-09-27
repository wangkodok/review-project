import { beforeEach, describe, expect, it, vi } from "vitest";

const USER_ID = "22222222-2222-4222-8222-222222222222";
const IMAGE_ID = "11111111-1111-4111-8111-111111111111";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  isReviewImageUploadEnabled: vi.fn(),
  enforceRateLimit: vi.fn(),
  createReviewImageUploadSlot: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/app/lib/auth/options", () => ({ authOptions: {} }));
vi.mock("@/app/lib/reviewImages/config", () => ({
  isReviewImageUploadEnabled: mocks.isReviewImageUploadEnabled,
}));
vi.mock("@/app/lib/reviewImages/service", () => ({
  createReviewImageUploadSlot: mocks.createReviewImageUploadSlot,
}));
vi.mock("@/app/lib/security/rateLimit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));

import { POST } from "./route";

function slotRequest(body: BodyInit = JSON.stringify({
  byteSize: 4_120_151,
  mimeType: "image/heic",
})) {
  return new Request("http://localhost/api/review-images/upload-slot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("POST /api/review-images/upload-slot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.isReviewImageUploadEnabled.mockReturnValue(true);
    mocks.enforceRateLimit.mockResolvedValue(null);
    mocks.createReviewImageUploadSlot.mockResolvedValue({
      imageId: IMAGE_ID,
      uploadUrl:
        "https://upload.example.invalid/signed?X-Amz-Credential=test-access-key",
      expiresAt: "2026-09-22T00:03:00.000Z",
      requiredHeaders: { "Content-Type": "image/heic" },
    });
  });

  it("returns 401 before feature, rate-limit, or body processing", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const response = await POST(slotRequest("{"));

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await response.json()).code).toBe("UNAUTHORIZED");
    expect(mocks.isReviewImageUploadEnabled).not.toHaveBeenCalled();
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.createReviewImageUploadSlot).not.toHaveBeenCalled();
  });

  it("fails closed with 503 while direct uploads are disabled", async () => {
    mocks.isReviewImageUploadEnabled.mockReturnValue(false);

    const response = await POST(slotRequest());

    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("IMAGE_UPLOAD_DISABLED");
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.createReviewImageUploadSlot).not.toHaveBeenCalled();
  });

  it("uses the existing upload rate limit before parsing JSON", async () => {
    mocks.enforceRateLimit.mockResolvedValue(
      Response.json(
        { success: false, data: null, code: "RATE_LIMIT_EXCEEDED" },
        { status: 429, headers: { "Cache-Control": "no-store" } },
      ),
    );

    const response = await POST(slotRequest("{"));

    expect(response.status).toBe(429);
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      identifier: USER_ID,
      policy: "reviewImageUpload",
    });
    expect(mocks.createReviewImageUploadSlot).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await POST(slotRequest("{"));

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await response.json()).code).toBe("INVALID_IMAGE");
    expect(mocks.createReviewImageUploadSlot).not.toHaveBeenCalled();
  });

  it("returns 413 before reserving storage over 10 MB", async () => {
    const response = await POST(
      slotRequest(
        JSON.stringify({ byteSize: 10_000_001, mimeType: "image/jpeg" }),
      ),
    );

    expect(response.status).toBe(413);
    expect((await response.json()).code).toBe("IMAGE_TOO_LARGE");
    expect(mocks.createReviewImageUploadSlot).not.toHaveBeenCalled();
  });

  it("normalizes an empty browser MIME before creating the slot", async () => {
    mocks.createReviewImageUploadSlot.mockResolvedValue({
      imageId: IMAGE_ID,
      uploadUrl: "https://upload.example.invalid/signed",
      expiresAt: "2026-09-22T00:03:00.000Z",
      requiredHeaders: { "Content-Type": "application/octet-stream" },
    });

    const response = await POST(
      slotRequest(JSON.stringify({ byteSize: 1_130, mimeType: "" })),
    );

    expect(response.status).toBe(201);
    expect(mocks.createReviewImageUploadSlot).toHaveBeenCalledWith({
      ownerUserId: USER_ID,
      byteSize: 1_130,
      mimeType: "application/octet-stream",
    });
  });

  it("returns only the safe upload slot with 201 and no-store", async () => {
    const response = await POST(slotRequest());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({
      success: true,
      data: {
        uploadSlot: {
          imageId: IMAGE_ID,
          uploadUrl:
            "https://upload.example.invalid/signed?X-Amz-Credential=test-access-key",
          expiresAt: "2026-09-22T00:03:00.000Z",
          requiredHeaders: { "Content-Type": "image/heic" },
        },
      },
      message: "사진 업로드가 준비되었습니다.",
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("objectKey");
    expect(serialized).not.toContain("secretAccessKey");
    expect(serialized).not.toContain("private database detail");
  });

  it("hides unexpected service and database details", async () => {
    mocks.createReviewImageUploadSlot.mockRejectedValue(
      new Error("private database detail with secretAccessKey"),
    );

    const response = await POST(slotRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_SERVER_ERROR");
    expect(JSON.stringify(body)).not.toContain("private database detail");
    expect(JSON.stringify(body)).not.toContain("secretAccessKey");
  });
});
