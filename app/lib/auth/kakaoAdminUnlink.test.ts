import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { unlinkKakaoAccountWithAdminKey } from "./kakaoAdminUnlink";

describe("unlinkKakaoAccountWithAdminKey", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the admin key and verified provider account ID", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({ id: 123456789 }, { status: 200 }),
    );

    const result = await unlinkKakaoAccountWithAdminKey({
      adminKey: "test-admin-key",
      providerAccountId: "123456789",
      fetchImpl,
    });

    expect(result).toBe("unlinked");
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://kapi.kakao.com/v1/user/unlink");
    expect(init).toMatchObject({
      method: "POST",
      cache: "no-store",
      redirect: "error",
      headers: {
        Authorization: "KakaoAK test-admin-key",
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      },
    });
    expect(String(init?.body)).toBe(
      "target_id_type=user_id&target_id=123456789",
    );
  });

  it("does not call Kakao when the admin key is missing", async () => {
    const fetchImpl = vi.fn();

    const result = await unlinkKakaoAccountWithAdminKey({
      adminKey: "  ",
      providerAccountId: "123456789",
      fetchImpl,
    });

    expect(result).toBe("configuration_missing");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not call Kakao with a malformed account ID", async () => {
    const fetchImpl = vi.fn();

    const result = await unlinkKakaoAccountWithAdminKey({
      adminKey: "test-admin-key",
      providerAccountId: "not-a-kakao-id",
      fetchImpl,
    });

    expect(result).toBe("request_failed");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([400, 401, 429, 500])(
    "normalizes Kakao HTTP %s without exposing its body",
    async (status) => {
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        new Response("private Kakao error detail", { status }),
      );

      const result = await unlinkKakaoAccountWithAdminKey({
        adminKey: "test-admin-key",
        providerAccountId: "123456789",
        fetchImpl,
      });

      expect(result).toBe("request_failed");
    },
  );

  it("rejects a malformed success response", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({ id: {} }));

    const result = await unlinkKakaoAccountWithAdminKey({
      adminKey: "test-admin-key",
      providerAccountId: "123456789",
      fetchImpl,
    });

    expect(result).toBe("request_failed");
  });

  it("detects a response account mismatch", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({ id: 987654321 }),
    );

    const result = await unlinkKakaoAccountWithAdminKey({
      adminKey: "test-admin-key",
      providerAccountId: "123456789",
      fetchImpl,
    });

    expect(result).toBe("account_mismatch");
  });

  it("stops waiting after the bounded timeout", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    const pending = unlinkKakaoAccountWithAdminKey({
      adminKey: "test-admin-key",
      providerAccountId: "123456789",
      fetchImpl,
    });
    await vi.advanceTimersByTimeAsync(3_000);

    await expect(pending).resolves.toBe("timed_out");
  });
});
