import "server-only";

import { createSupabaseServerClient } from "../supabase/server";
import type { VerifiedKakaoAccountEvent } from "./kakaoAccountEventSet";

const OBSERVE_ONLY_STATUSES = ["observed", "ignored"] as const;
const OBSERVE_ONLY_RESULTS = [
  "observe_only",
  "already_absent",
  "stale_event",
] as const;

type ObserveOnlyStatus = (typeof OBSERVE_ONLY_STATUSES)[number];
type ObserveOnlyResult = (typeof OBSERVE_ONLY_RESULTS)[number];

type ExternalAuthEventRpcRow = {
  audit_event_id: string;
  event_status: string;
  event_result_code: string;
  duplicate_event: boolean;
  delivery_count: number;
};

export type RecordedExternalAuthEvent = {
  auditEventId: string;
  status: ObserveOnlyStatus;
  resultCode: ObserveOnlyResult;
  duplicateEvent: boolean;
  deliveryCount: number;
};

export type ExternalAuthEventServiceErrorCode =
  | "INVALID_EXTERNAL_AUTH_EVENT"
  | "EVENT_STORAGE_FAILED"
  | "INTERNAL_SERVER_ERROR";

export class ExternalAuthEventServiceError extends Error {
  constructor(public readonly code: ExternalAuthEventServiceErrorCode) {
    super(code);
    this.name = "ExternalAuthEventServiceError";
  }
}

function isObserveOnlyStatus(value: string): value is ObserveOnlyStatus {
  return OBSERVE_ONLY_STATUSES.some((status) => status === value);
}

function isObserveOnlyResult(value: string): value is ObserveOnlyResult {
  return OBSERVE_ONLY_RESULTS.some((result) => result === value);
}

function isExternalAuthEventRpcRow(
  value: unknown,
): value is ExternalAuthEventRpcRow {
  if (!value || typeof value !== "object") {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    typeof row.audit_event_id === "string" &&
    row.audit_event_id.length > 0 &&
    typeof row.event_status === "string" &&
    typeof row.event_result_code === "string" &&
    typeof row.duplicate_event === "boolean" &&
    typeof row.delivery_count === "number" &&
    Number.isSafeInteger(row.delivery_count) &&
    row.delivery_count >= 1
  );
}

function isConsistentObserveOnlyResult(
  status: ObserveOnlyStatus,
  resultCode: ObserveOnlyResult,
) {
  if (status === "observed") {
    return resultCode === "observe_only";
  }

  return resultCode === "already_absent" || resultCode === "stale_event";
}

export async function recordVerifiedExternalAuthEvent(
  event: VerifiedKakaoAccountEvent,
): Promise<RecordedExternalAuthEvent> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc(
    "process_external_unlink_event_atomic",
    {
      p_provider: event.provider,
      p_provider_account_id: event.providerAccountId,
      p_event_id: event.eventId,
      p_transaction_id: event.transactionId,
      p_reason_code: event.reasonCode,
      p_occurred_at: event.occurredAt,
      p_apply_deletion: false,
    },
  );

  if (error) {
    if (
      error.code === "22023" ||
      error.code === "22004" ||
      error.code === "23505"
    ) {
      throw new ExternalAuthEventServiceError("INVALID_EXTERNAL_AUTH_EVENT");
    }

    throw new ExternalAuthEventServiceError("EVENT_STORAGE_FAILED");
  }

  if (
    !Array.isArray(data) ||
    data.length !== 1 ||
    !isExternalAuthEventRpcRow(data[0])
  ) {
    throw new ExternalAuthEventServiceError("INTERNAL_SERVER_ERROR");
  }

  const row = data[0];

  if (
    !isObserveOnlyStatus(row.event_status) ||
    !isObserveOnlyResult(row.event_result_code) ||
    !isConsistentObserveOnlyResult(row.event_status, row.event_result_code)
  ) {
    throw new ExternalAuthEventServiceError("INTERNAL_SERVER_ERROR");
  }

  return {
    auditEventId: row.audit_event_id,
    status: row.event_status,
    resultCode: row.event_result_code,
    duplicateEvent: row.duplicate_event,
    deliveryCount: row.delivery_count,
  };
}
