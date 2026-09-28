import { afterEach, describe, expect, it, vi } from "vitest";
import { revokeGoogleIdentityGrant } from "./googleIdentityClient";

describe("revokeGoogleIdentityGrant", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns unavailable without a login hint or GIS", async () => {
    await expect(
      revokeGoogleIdentityGrant({ loginHint: "", googleIdentity: undefined }),
    ).resolves.toBe("unavailable");
    await expect(
      revokeGoogleIdentityGrant({
        loginHint: "private@example.com",
        googleIdentity: undefined,
      }),
    ).resolves.toBe("unavailable");
  });

  it("revokes consent when GIS reports success", async () => {
    const revoke = vi.fn((_hint, callback) => callback({ successful: true }));

    const result = await revokeGoogleIdentityGrant({
      loginHint: "private@example.com",
      googleIdentity: { accounts: { id: { revoke } } },
    });

    expect(result).toBe("revoked");
    expect(revoke).toHaveBeenCalledWith(
      "private@example.com",
      expect.any(Function),
    );
  });

  it("normalizes an unsuccessful callback", async () => {
    const result = await revokeGoogleIdentityGrant({
      loginHint: "private@example.com",
      googleIdentity: {
        accounts: {
          id: {
            revoke: (_hint, callback) =>
              callback({ successful: false, error: "private error" }),
          },
        },
      },
    });

    expect(result).toBe("failed");
  });

  it("normalizes a synchronous GIS failure", async () => {
    const result = await revokeGoogleIdentityGrant({
      loginHint: "private@example.com",
      googleIdentity: {
        accounts: {
          id: {
            revoke: () => {
              throw new Error("private error");
            },
          },
        },
      },
    });

    expect(result).toBe("failed");
  });

  it("stops waiting after the bounded timeout", async () => {
    vi.useFakeTimers();
    const pending = revokeGoogleIdentityGrant({
      loginHint: "private@example.com",
      googleIdentity: {
        accounts: { id: { revoke: () => undefined } },
      },
    });
    await vi.advanceTimersByTimeAsync(3_000);

    await expect(pending).resolves.toBe("timed_out");
  });

  it("ignores duplicate callbacks after the first result", async () => {
    const result = await revokeGoogleIdentityGrant({
      loginHint: "private@example.com",
      googleIdentity: {
        accounts: {
          id: {
            revoke: (_hint, callback) => {
              callback({ successful: true });
              callback({ successful: false, error: "late private error" });
            },
          },
        },
      },
    });

    expect(result).toBe("revoked");
  });
});
