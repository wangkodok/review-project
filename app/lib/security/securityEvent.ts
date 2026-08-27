import "server-only";

type AuthProvider = "google" | "kakao";
type RateLimitPolicy = "auth" | "like" | "posts" | "search" | "withdrawal";

type WithdrawalEventCode =
  | "withdrawal_processing_release_failed"
  | "withdrawal_provider_unlink_account_mismatch"
  | "withdrawal_provider_revoked_state_persist_failed"
  | "withdrawal_database_delete_failed"
  | "withdrawal_state_cleanup_failed"
  | "withdrawal_state_store_unavailable"
  | "withdrawal_unexpected_failure";

type WithdrawalSecurityEvent = {
  eventCode: WithdrawalEventCode;
  provider?: AuthProvider;
};

type RateLimitSecurityEvent = {
  eventCode: "rate_limit_store_unavailable";
  policy: RateLimitPolicy;
  resultCode: "configuration_missing" | "timeout" | "request_failed";
};

type KakaoSecurityEvent =
  | {
      eventCode: "kakao_webhook_configuration_missing";
    }
  | {
      eventCode: "kakao_event_verification_unavailable";
    }
  | {
      eventCode: "kakao_event_storage_failed";
      resultCode: "event_storage_failed" | "invalid_storage_result";
    }
  | {
      eventCode: "kakao_webhook_processing_failed";
    };

export type SecurityEventInput =
  | WithdrawalSecurityEvent
  | RateLimitSecurityEvent
  | KakaoSecurityEvent;

type SecurityEventSeverity = "warn" | "error";

const EVENT_DEFINITIONS: Record<
  SecurityEventInput["eventCode"],
  {
    severity: SecurityEventSeverity;
    route?: string;
    httpStatus: number;
  }
> = {
  withdrawal_processing_release_failed: {
    severity: "error",
    route: "/api/withdraw",
    httpStatus: 503,
  },
  withdrawal_provider_unlink_account_mismatch: {
    severity: "warn",
    route: "/api/withdraw",
    httpStatus: 502,
  },
  withdrawal_provider_revoked_state_persist_failed: {
    severity: "error",
    route: "/api/withdraw",
    httpStatus: 503,
  },
  withdrawal_database_delete_failed: {
    severity: "error",
    route: "/api/withdraw",
    httpStatus: 500,
  },
  withdrawal_state_cleanup_failed: {
    severity: "warn",
    route: "/api/withdraw",
    httpStatus: 200,
  },
  withdrawal_state_store_unavailable: {
    severity: "error",
    route: "/api/withdraw",
    httpStatus: 503,
  },
  withdrawal_unexpected_failure: {
    severity: "error",
    route: "/api/withdraw",
    httpStatus: 500,
  },
  rate_limit_store_unavailable: {
    severity: "error",
    httpStatus: 503,
  },
  kakao_webhook_configuration_missing: {
    severity: "error",
    route: "/api/webhooks/kakao/account-events",
    httpStatus: 503,
  },
  kakao_event_verification_unavailable: {
    severity: "error",
    route: "/api/webhooks/kakao/account-events",
    httpStatus: 503,
  },
  kakao_event_storage_failed: {
    severity: "error",
    route: "/api/webhooks/kakao/account-events",
    httpStatus: 503,
  },
  kakao_webhook_processing_failed: {
    severity: "error",
    route: "/api/webhooks/kakao/account-events",
    httpStatus: 503,
  },
};

function getEnvironment() {
  const value = process.env.VERCEL_ENV ?? process.env.NODE_ENV;

  if (
    value === "production" ||
    value === "preview" ||
    value === "development" ||
    value === "test"
  ) {
    return value;
  }

  return "unknown";
}

export function recordSecurityEvent(event: SecurityEventInput) {
  const definition = EVENT_DEFINITIONS[event.eventCode];
  const basePayload = {
    schemaVersion: 1,
    timestamp: new Date().toISOString(),
    eventCode: event.eventCode,
    severity: definition.severity,
    environment: getEnvironment(),
    ...(definition.route ? { route: definition.route } : {}),
    httpStatus: definition.httpStatus,
  };

  let payload: Record<string, unknown> = basePayload;

  if (event.eventCode.startsWith("withdrawal_")) {
    const provider = "provider" in event ? event.provider : undefined;

    if (provider === "google" || provider === "kakao") {
      payload = {
        ...basePayload,
        provider,
      };
    }
  } else if (event.eventCode === "rate_limit_store_unavailable") {
    payload = {
      ...basePayload,
      policy: event.policy,
      resultCode: event.resultCode,
    };
  } else if (event.eventCode === "kakao_event_storage_failed") {
    payload = {
      ...basePayload,
      resultCode: event.resultCode,
    };
  }

  const serializedPayload = JSON.stringify(payload);

  if (definition.severity === "warn") {
    console.warn(serializedPayload);
    return;
  }

  console.error(serializedPayload);
}
