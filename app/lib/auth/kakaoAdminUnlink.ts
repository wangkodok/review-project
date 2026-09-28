import "server-only";

const KAKAO_UNLINK_URL = "https://kapi.kakao.com/v1/user/unlink";
const KAKAO_UNLINK_TIMEOUT_MS = 3_000;
const KAKAO_ACCOUNT_ID_PATTERN = /^\d+$/;

export type KakaoAdminUnlinkResult =
  | "unlinked"
  | "configuration_missing"
  | "account_mismatch"
  | "request_failed"
  | "timed_out";

type KakaoUnlinkResponse = {
  id?: unknown;
};

function normalizeKakaoAccountId(value: unknown) {
  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  ) {
    return String(value);
  }

  if (typeof value === "string" && KAKAO_ACCOUNT_ID_PATTERN.test(value.trim())) {
    return value.trim();
  }

  return null;
}

export async function unlinkKakaoAccountWithAdminKey({
  adminKey,
  providerAccountId,
  fetchImpl = fetch,
}: {
  adminKey: string | undefined;
  providerAccountId: string;
  fetchImpl?: typeof fetch;
}): Promise<KakaoAdminUnlinkResult> {
  const normalizedAdminKey = adminKey?.trim();
  const normalizedProviderAccountId = providerAccountId.trim();

  if (!normalizedAdminKey) {
    return "configuration_missing";
  }

  if (!KAKAO_ACCOUNT_ID_PATTERN.test(normalizedProviderAccountId)) {
    return "request_failed";
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    KAKAO_UNLINK_TIMEOUT_MS,
  );

  try {
    const response = await fetchImpl(KAKAO_UNLINK_URL, {
      method: "POST",
      headers: {
        Authorization: `KakaoAK ${normalizedAdminKey}`,
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      },
      body: new URLSearchParams({
        target_id_type: "user_id",
        target_id: normalizedProviderAccountId,
      }),
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });

    if (!response.ok) {
      return "request_failed";
    }

    let body: KakaoUnlinkResponse;

    try {
      body = (await response.json()) as KakaoUnlinkResponse;
    } catch {
      return "request_failed";
    }

    const unlinkedAccountId = normalizeKakaoAccountId(body.id);

    if (!unlinkedAccountId) {
      return "request_failed";
    }

    return unlinkedAccountId === normalizedProviderAccountId
      ? "unlinked"
      : "account_mismatch";
  } catch {
    return controller.signal.aborted ? "timed_out" : "request_failed";
  } finally {
    clearTimeout(timeout);
  }
}
