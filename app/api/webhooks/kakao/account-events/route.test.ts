import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  class KakaoAccountEventSetError extends Error {
    constructor(public readonly code: string) {
      super(code);
    }
  }

  class ExternalAuthEventServiceError extends Error {
    constructor(public readonly code: string) {
      super(code);
    }
  }

  return {
    verify: vi.fn(),
    record: vi.fn(),
    recordSecurityEvent: vi.fn(),
    KakaoAccountEventSetError,
    ExternalAuthEventServiceError,
  };
});

vi.mock("@/app/lib/auth/kakaoAccountEventSet", () => ({
  verifyKakaoAccountEventSet: mocks.verify,
  KakaoAccountEventSetError: mocks.KakaoAccountEventSetError,
}));
vi.mock("@/app/lib/auth/externalAuthEvents", () => ({
  recordVerifiedExternalAuthEvent: mocks.record,
  ExternalAuthEventServiceError: mocks.ExternalAuthEventServiceError,
}));
vi.mock("@/app/lib/security/securityEvent", () => ({
  recordSecurityEvent: mocks.recordSecurityEvent,
}));

import { POST } from "./route";

const ORIGINAL_FEATURE_FLAG = process.env.AUTH_KAKAO_ACCOUNT_EVENTS_ENABLED;
const ORIGINAL_KAKAO_ID = process.env.AUTH_KAKAO_ID;

const verifiedEvent = {
  provider: "kakao",
  providerAccountId: "123456789",
  eventId: "event-123",
  transactionId: "transaction-123",
  reasonCode: "UNLINK_FROM_APPS",
  occurredAt: "2026-08-10T00:00:00.000Z",
};

function createRequest(
  body = "signed.set.value",
  contentType = "application/secevent+jwt",
) {
  return new NextRequest(
    "http://localhost:3000/api/webhooks/kakao/account-events",
    {
      method: "POST",
      headers: {
        "content-type": contentType,
      },
      body,
    },
  );
}

describe("POST /api/webhooks/kakao/account-events", () => {
  beforeEach(() => {
    process.env.AUTH_KAKAO_ACCOUNT_EVENTS_ENABLED = "true";
    process.env.AUTH_KAKAO_ID = "test-kakao-rest-api-key";
    mocks.verify.mockReset();
    mocks.record.mockReset();
    mocks.recordSecurityEvent.mockReset();
    mocks.verify.mockResolvedValue(verifiedEvent);
    mocks.record.mockResolvedValue({
      auditEventId: "audit-event-id",
      status: "observed",
      resultCode: "observe_only",
      duplicateEvent: false,
      deliveryCount: 1,
    });
  });

  afterAll(() => {
    if (ORIGINAL_FEATURE_FLAG === undefined) {
      delete process.env.AUTH_KAKAO_ACCOUNT_EVENTS_ENABLED;
    } else {
      process.env.AUTH_KAKAO_ACCOUNT_EVENTS_ENABLED = ORIGINAL_FEATURE_FLAG;
    }

    if (ORIGINAL_KAKAO_ID === undefined) {
      delete process.env.AUTH_KAKAO_ID;
    } else {
      process.env.AUTH_KAKAO_ID = ORIGINAL_KAKAO_ID;
    }
  });

  it("returns 404 without processing when the feature is disabled", async () => {
    process.env.AUTH_KAKAO_ACCOUNT_EVENTS_ENABLED = "false";

    const response = await POST(createRequest());

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("verifies, records, and acknowledges a valid SET with an empty 202", async () => {
    const response = await POST(createRequest());

    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("");
    expect(mocks.verify).toHaveBeenCalledWith("signed.set.value", {
      audience: "test-kakao-rest-api-key",
    });
    expect(mocks.record).toHaveBeenCalledWith(verifiedEvent);
  });

  it.each([
    ["a wrong content type", createRequest("signed.set.value", "text/plain")],
    ["an empty body", createRequest("   ")],
    ["an oversized body", createRequest("a".repeat(16 * 1024 + 1))],
  ])("returns invalid_request for %s", async (_name, request) => {
    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      err: "invalid_request",
      description: "The SET request is invalid.",
    });
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid_key", "The SET signing key or signature is invalid."],
    ["invalid_issuer", "The SET issuer is invalid."],
    ["invalid_audience", "The SET audience is invalid."],
  ])("returns Kakao's %s error contract", async (code, description) => {
    mocks.verify.mockRejectedValue(new mocks.KakaoAccountEventSetError(code));

    const response = await POST(createRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ err: code, description });
  });

  it("returns 503 when key retrieval or storage is temporarily unavailable", async () => {
    mocks.verify.mockRejectedValue(
      new mocks.KakaoAccountEventSetError("temporarily_unavailable"),
    );

    const response = await POST(createRequest());

    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
    expect(mocks.recordSecurityEvent).toHaveBeenCalledWith({
      eventCode: "kakao_event_verification_unavailable",
    });
  });

  it("maps an RPC validation rejection to invalid_request", async () => {
    mocks.record.mockRejectedValue(
      new mocks.ExternalAuthEventServiceError("INVALID_EXTERNAL_AUTH_EVENT"),
    );

    const response = await POST(createRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      err: "invalid_request",
    });
  });

  it("fails closed with 503 when the server audience is unavailable", async () => {
    delete process.env.AUTH_KAKAO_ID;

    const response = await POST(createRequest());

    expect(response.status).toBe(503);
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
    expect(mocks.recordSecurityEvent).toHaveBeenCalledWith({
      eventCode: "kakao_webhook_configuration_missing",
    });
  });

  it.each([
    ["EVENT_STORAGE_FAILED", "event_storage_failed"],
    ["INTERNAL_SERVER_ERROR", "invalid_storage_result"],
  ])(
    "records a privacy-minimized event for %s",
    async (code, resultCode) => {
      mocks.record.mockRejectedValue(
        new mocks.ExternalAuthEventServiceError(code),
      );

      const response = await POST(createRequest());

      expect(response.status).toBe(503);
      expect(mocks.recordSecurityEvent).toHaveBeenCalledWith({
        eventCode: "kakao_event_storage_failed",
        resultCode,
      });
    },
  );

  it("records an unexpected processing failure without exposing the error", async () => {
    mocks.record.mockRejectedValue(new Error("private failure detail"));

    const response = await POST(createRequest());

    expect(response.status).toBe(503);
    expect(mocks.recordSecurityEvent).toHaveBeenCalledWith({
      eventCode: "kakao_webhook_processing_failed",
    });
  });
});
