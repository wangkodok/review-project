import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getReviewImageCleanupAuthStatus: vi.fn(),
  runReviewImageCleanup: vi.fn(),
  recordSecurityEvent: vi.fn(),
}));

vi.mock("@/app/lib/reviewImages/cleanupAuth", () => ({
  getReviewImageCleanupAuthStatus: mocks.getReviewImageCleanupAuthStatus,
}));
vi.mock("@/app/lib/reviewImages/cleanup", () => ({
  runReviewImageCleanup: mocks.runReviewImageCleanup,
}));
vi.mock("@/app/lib/security/securityEvent", () => ({
  recordSecurityEvent: mocks.recordSecurityEvent,
}));

import { GET } from "./route";

function cronRequest() {
  return new Request("http://localhost/api/internal/review-images/cleanup", {
    headers: { Authorization: "Bearer test-secret" },
  });
}

describe("GET /api/internal/review-images/cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getReviewImageCleanupAuthStatus.mockReturnValue("authorized");
    mocks.runReviewImageCleanup.mockResolvedValue({
      queued: 1,
      claimed: 1,
      deleted: 1,
      retryScheduled: 0,
      failed: 0,
      completionFailed: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fails closed before touching storage when the secret is missing", async () => {
    mocks.getReviewImageCleanupAuthStatus.mockReturnValue("misconfigured");

    const response = await GET(cronRequest());

    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("CLEANUP_UNAVAILABLE");
    expect(mocks.runReviewImageCleanup).not.toHaveBeenCalled();
  });

  it("rejects an invalid bearer secret", async () => {
    mocks.getReviewImageCleanupAuthStatus.mockReturnValue("unauthorized");

    const response = await GET(cronRequest());

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("UNAUTHORIZED");
    expect(mocks.runReviewImageCleanup).not.toHaveBeenCalled();
  });

  it("returns only aggregate cleanup counts", async () => {
    const response = await GET(cronRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.data.cleanup).toEqual({
      queued: 1,
      claimed: 1,
      deleted: 1,
      retryScheduled: 0,
      failed: 0,
      completionFailed: 0,
    });
    expect(JSON.stringify(body)).not.toContain("objectKey");
  });

  it("surfaces unresolved aggregate failures without private details", async () => {
    mocks.runReviewImageCleanup.mockResolvedValue({
      queued: 0,
      claimed: 1,
      deleted: 0,
      retryScheduled: 0,
      failed: 0,
      completionFailed: 1,
    });

    const response = await GET(cronRequest());

    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("CLEANUP_PARTIAL_FAILURE");
    expect(mocks.recordSecurityEvent).toHaveBeenCalledWith({
      eventCode: "review_image_cleanup_failed",
      resultCode: "job_completion_failed",
    });
  });

  it("returns a generic failure when the worker cannot start", async () => {
    mocks.runReviewImageCleanup.mockRejectedValue(
      new Error("private database detail"),
    );

    const response = await GET(cronRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.code).toBe("CLEANUP_FAILED");
    expect(JSON.stringify(body)).not.toContain("private database detail");
  });
});
