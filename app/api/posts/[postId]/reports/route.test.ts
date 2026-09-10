import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  createReviewReport: vi.fn(),
  enforceRateLimit: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/app/lib/auth/options", () => ({ authOptions: {} }));
vi.mock("@/app/lib/reports/service", () => ({
  createReviewReport: mocks.createReviewReport,
}));
vi.mock("@/app/lib/security/rateLimit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));

import { POST } from "./route";

const POST_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const context = { params: Promise.resolve({ postId: POST_ID }) };

function reportRequest(
  body: unknown = { reason: "off_topic" },
  headers: Record<string, string> = {},
) {
  return new Request(`http://localhost/api/posts/${POST_ID}/reports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/posts/[postId]/reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.enforceRateLimit.mockResolvedValue(null);
    mocks.createReviewReport.mockResolvedValue({ status: "ok" });
  });

  it("accepts a valid report without exposing an internal report id", async () => {
    const response = await POST(
      reportRequest({ reason: "other", detail: "  구체적인 내용  " }),
      context,
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      success: true,
      data: null,
      message: "신고가 접수되었습니다.",
    });
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      identifier: USER_ID,
      policy: "report",
    });
    expect(mocks.createReviewReport).toHaveBeenCalledWith({
      postId: POST_ID,
      reporterUserId: USER_ID,
      reason: "other",
      detail: "구체적인 내용",
    });
  });

  it("rejects an unauthenticated request before reading or limiting it", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const response = await POST(reportRequest(), context);

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("UNAUTHORIZED");
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.createReviewReport).not.toHaveBeenCalled();
  });

  it("rejects an invalid review id before the body and rate limit", async () => {
    const response = await POST(reportRequest(), {
      params: Promise.resolve({ postId: "not-a-uuid" }),
    });

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("INVALID_POST_ID");
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
  });

  it("requires a JSON content type", async () => {
    const response = await POST(
      reportRequest('{"reason":"off_topic"}', { "Content-Type": "text/plain" }),
      context,
    );

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("INVALID_REQUEST");
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
  });

  it("rejects a declared body larger than two kilobytes", async () => {
    const response = await POST(
      reportRequest({ reason: "off_topic" }, { "Content-Length": "2049" }),
      context,
    );

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("INVALID_REQUEST");
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
  });

  it("rejects an oversized streamed body without a content-length header", async () => {
    const request = reportRequest({
      reason: "other",
      detail: "가".repeat(1_000),
    });
    request.headers.delete("content-length");

    const response = await POST(request, context);

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("INVALID_REQUEST");
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON and unknown fields", async () => {
    const malformedResponse = await POST(reportRequest("{"), context);
    const unknownFieldResponse = await POST(
      reportRequest({ reason: "off_topic", userId: USER_ID }),
      context,
    );

    expect(malformedResponse.status).toBe(400);
    expect((await malformedResponse.json()).code).toBe("INVALID_REQUEST");
    expect(unknownFieldResponse.status).toBe(400);
    expect((await unknownFieldResponse.json()).code).toBe("INVALID_REQUEST");
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
  });

  it("returns the shared rate limit response before storage", async () => {
    mocks.enforceRateLimit.mockResolvedValue(
      Response.json(
        {
          success: false,
          data: null,
          message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
          code: "RATE_LIMIT_EXCEEDED",
        },
        { status: 429, headers: { "Cache-Control": "no-store" } },
      ),
    );

    const response = await POST(reportRequest(), context);

    expect(response.status).toBe(429);
    expect(mocks.createReviewReport).not.toHaveBeenCalled();
  });

  it.each([
    ["not_found", 404, "POST_NOT_FOUND"],
    ["self_report", 403, "SELF_REPORT_NOT_ALLOWED"],
    ["duplicate", 409, "REPORT_ALREADY_EXISTS"],
  ] as const)("maps %s to a safe public response", async (status, httpStatus, code) => {
    mocks.createReviewReport.mockResolvedValue({ status });

    const response = await POST(reportRequest(), context);

    expect(response.status).toBe(httpStatus);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      success: false,
      data: null,
      code,
    });
  });

  it("returns a generic error without leaking a storage detail", async () => {
    mocks.createReviewReport.mockRejectedValue(
      new Error("private database detail"),
    );

    const response = await POST(reportRequest(), context);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toMatchObject({
      success: false,
      data: null,
      code: "INTERNAL_SERVER_ERROR",
    });
    expect(JSON.stringify(body)).not.toContain("private database detail");
  });
});
