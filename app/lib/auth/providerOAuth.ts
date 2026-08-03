import "server-only";

import type { AuthProvider } from "./externalIdentity";
import { revokeGoogleOAuthGrant } from "./googleOAuth";

const KAKAO_UNLINK_URL = "https://kapi.kakao.com/v1/user/unlink";
const PROVIDER_UNLINK_TIMEOUT_MS = 5_000;

export type ProviderUnlinkResult =
  | "unlinked"
  | "failed"
  | "account_mismatch";

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

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return value.trim();
  }

  return null;
}

async function unlinkKakaoAccount({
  accessToken,
  providerAccountId,
}: {
  accessToken: string;
  providerAccountId: string;
}): Promise<ProviderUnlinkResult> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    PROVIDER_UNLINK_TIMEOUT_MS,
  );

  try {
    const response = await fetch(KAKAO_UNLINK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      },
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });

    if (!response.ok) {
      return "failed";
    }

    const body = (await response.json()) as KakaoUnlinkResponse;
    const unlinkedAccountId = normalizeKakaoAccountId(body.id);

    if (!unlinkedAccountId) {
      return "failed";
    }

    return unlinkedAccountId === providerAccountId
      ? "unlinked"
      : "account_mismatch";
  } catch {
    return "failed";
  } finally {
    clearTimeout(timeout);
  }
}

export async function unlinkExternalProviderAccount({
  provider,
  accessToken,
  providerAccountId,
}: {
  provider: AuthProvider;
  accessToken: string;
  providerAccountId: string;
}): Promise<ProviderUnlinkResult> {
  const normalizedAccessToken = accessToken.trim();
  const normalizedProviderAccountId = providerAccountId.trim();

  if (!normalizedAccessToken || !normalizedProviderAccountId) {
    return "failed";
  }

  if (provider === "google") {
    return (await revokeGoogleOAuthGrant(normalizedAccessToken))
      ? "unlinked"
      : "failed";
  }

  return unlinkKakaoAccount({
    accessToken: normalizedAccessToken,
    providerAccountId: normalizedProviderAccountId,
  });
}
