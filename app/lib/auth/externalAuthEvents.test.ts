import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({
    rpc: mocks.rpc,
  }),
}));

import { recordVerifiedExternalAuthEvent } from "./externalAuthEvents";
import type { VerifiedKakaoAccountEvent } from "./kakaoAccountEventSet";

const event: VerifiedKakaoAccountEvent = {
  provider: "kakao",
  providerAccountId: "123456789",
  eventId: "event-123",
  transactionId: "transaction-123",
  reasonCode: "UNLINK_FROM_APPS",
  occurredAt: "2026-08-10T00:00:00.000Z",
};

describe("recordVerifiedExternalAuthEvent", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
  });

  it("calls the atomic RPC in observe-only mode", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          audit_event_id: "audit-event-id",
          event_status: "observed",
          event_result_code: "observe_only",
          duplicate_event: false,
          delivery_count: 1,
        },
      ],
      error: null,
    });

    await expect(recordVerifiedExternalAuthEvent(event)).resolves.toEqual({
      auditEventId: "audit-event-id",
      status: "observed",
      resultCode: "observe_only",
      duplicateEvent: false,
      deliveryCount: 1,
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "process_external_unlink_event_atomic",
      {
        p_provider: "kakao",
        p_provider_account_id: "123456789",
        p_event_id: "event-123",
        p_transaction_id: "transaction-123",
        p_reason_code: "UNLINK_FROM_APPS",
        p_occurred_at: "2026-08-10T00:00:00.000Z",
        p_apply_deletion: false,
      },
    );
  });

  it("accepts an idempotent duplicate response", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          audit_event_id: "audit-event-id",
          event_status: "ignored",
          event_result_code: "already_absent",
          duplicate_event: true,
          delivery_count: 2,
        },
      ],
      error: null,
    });

    await expect(recordVerifiedExternalAuthEvent(event)).resolves.toMatchObject({
      status: "ignored",
      resultCode: "already_absent",
      duplicateEvent: true,
      deliveryCount: 2,
    });
  });

  it.each(["22004", "22023", "23505"])(
    "maps PostgreSQL %s to an invalid event",
    async (code) => {
      mocks.rpc.mockResolvedValue({ data: null, error: { code } });

      await expect(recordVerifiedExternalAuthEvent(event)).rejects.toMatchObject({
        code: "INVALID_EXTERNAL_AUTH_EVENT",
      });
    },
  );

  it("maps an unexpected storage error without exposing database details", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "08006", message: "private database detail" },
    });

    await expect(recordVerifiedExternalAuthEvent(event)).rejects.toMatchObject({
      code: "EVENT_STORAGE_FAILED",
      message: "EVENT_STORAGE_FAILED",
    });
  });

  it.each([
    ["empty result", []],
    ["multiple rows", [{}, {}]],
    [
      "inconsistent status and result",
      [
        {
          audit_event_id: "audit-event-id",
          event_status: "observed",
          event_result_code: "stale_event",
          duplicate_event: false,
          delivery_count: 1,
        },
      ],
    ],
  ])("rejects a malformed RPC %s", async (_name, data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });

    await expect(recordVerifiedExternalAuthEvent(event)).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });
});
