import { beforeEach, describe, expect, it, vi } from "vitest";

const IMAGE_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  enforceRateLimit: vi.fn(),
  cancelReviewImage: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/app/lib/auth/options", () => ({ authOptions: {} }));
vi.mock("@/app/lib/security/rateLimit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));
vi.mock("@/app/lib/reviewImages/service", () => ({
  cancelReviewImage: mocks.cancelReviewImage,
}));

import { DELETE } from "./route";

function context(imageId = IMAGE_ID) {
  return { params: Promise.resolve({ imageId }) };
}

describe("DELETE /api/review-images/[imageId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.enforceRateLimit.mockResolvedValue(null);
    mocks.cancelReviewImage.mockResolvedValue({ status: "ok" });
  });

  it("allows cleanup even when upload activation is not consulted", async () => {
    const response = await DELETE(
      new Request(`http://localhost/api/review-images/${IMAGE_ID}`, {
        method: "DELETE",
      }),
      context(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.cancelReviewImage).toHaveBeenCalledWith({
      imageId: IMAGE_ID,
      ownerUserId: USER_ID,
    });
  });

  it("rejects invalid ids before rate limiting", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/review-images/invalid", { method: "DELETE" }),
      context("invalid"),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("INVALID_IMAGE_ID");
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
  });

  it.each([
    ["not_found", 404, "IMAGE_NOT_FOUND"],
    ["forbidden", 403, "FORBIDDEN"],
  ] as const)("maps %s cancellation", async (status, httpStatus, code) => {
    mocks.cancelReviewImage.mockResolvedValue({ status });

    const response = await DELETE(
      new Request(`http://localhost/api/review-images/${IMAGE_ID}`, {
        method: "DELETE",
      }),
      context(),
    );

    expect(response.status).toBe(httpStatus);
    expect((await response.json()).code).toBe(code);
  });
});
