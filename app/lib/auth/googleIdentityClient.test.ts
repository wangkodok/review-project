import { afterEach, describe, expect, it, vi } from "vitest";
import { revokeGoogleIdentityGrant } from "./googleIdentityClient";

describe("revokeGoogleIdentityGrant", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not attempt revocation without a login hint", async () => {
    await expect(
      revokeGoogleIdentityGrant({ loginHint: "" }),
    ).resolves.toBe("not_attempted");
  });

  it("revokes consent when GIS reports success", async () => {
    const revoke = vi.fn((_hint, callback) => callback({ successful: true }));

    const result = await revokeGoogleIdentityGrant({
      loginHint: "private@example.com",
      getGoogleIdentity: () => ({ accounts: { id: { revoke } } }),
    });

    expect(result).toBe("success");
    expect(revoke).toHaveBeenCalledWith(
      "private@example.com",
      expect.any(Function),
    );
  });

  it("normalizes an unsuccessful callback", async () => {
    const result = await revokeGoogleIdentityGrant({
      loginHint: "private@example.com",
      getGoogleIdentity: () => ({
        accounts: {
          id: {
            revoke: (_hint, callback) =>
              callback({ successful: false, error: "private error" }),
          },
        },
      }),
    });

    expect(result).toBe("failed");
  });

  it("normalizes a synchronous GIS failure", async () => {
    const result = await revokeGoogleIdentityGrant({
      loginHint: "private@example.com",
      getGoogleIdentity: () => ({
        accounts: {
          id: {
            revoke: () => {
              throw new Error("private error");
            },
          },
        },
      }),
    });

    expect(result).toBe("failed");
  });

  it("waits for GIS to load before revoking", async () => {
    vi.useFakeTimers();
    const revoke = vi.fn((_hint, callback) => callback({ successful: true }));
    const state: {
      googleIdentity?: { accounts: { id: { revoke: typeof revoke } } };
    } = {};

    const pending = revokeGoogleIdentityGrant({
      loginHint: "private@example.com",
      getGoogleIdentity: () => state.googleIdentity,
      getScriptStatus: () => "loading",
    });
    await vi.advanceTimersByTimeAsync(25);
    state.googleIdentity = { accounts: { id: { revoke } } };
    await vi.advanceTimersByTimeAsync(25);

    await expect(pending).resolves.toBe("success");
    expect(revoke).toHaveBeenCalledTimes(1);
  });

  it("returns not_attempted when the GIS script fails before invocation", async () => {
    await expect(
      revokeGoogleIdentityGrant({
        loginHint: "private@example.com",
        getGoogleIdentity: () => undefined,
        getScriptStatus: () => "failed",
      }),
    ).resolves.toBe("not_attempted");
  });

  it("uses one three-second budget for script loading and revoke", async () => {
    vi.useFakeTimers();
    const revoke = vi.fn(() => undefined);
    const state: {
      googleIdentity?: { accounts: { id: { revoke: typeof revoke } } };
    } = {};
    const pending = revokeGoogleIdentityGrant({
      loginHint: "private@example.com",
      getGoogleIdentity: () => state.googleIdentity,
      getScriptStatus: () => "loading",
    });
    await vi.advanceTimersByTimeAsync(2_900);
    state.googleIdentity = { accounts: { id: { revoke } } };
    await vi.advanceTimersByTimeAsync(25);
    expect(revoke).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(75);

    await expect(pending).resolves.toBe("timeout");
  });

  it("ignores duplicate callbacks after the first result", async () => {
    const result = await revokeGoogleIdentityGrant({
      loginHint: "private@example.com",
      getGoogleIdentity: () => ({
        accounts: {
          id: {
            revoke: (_hint, callback) => {
              callback({ successful: true });
              callback({ successful: false, error: "late private error" });
            },
          },
        },
      }),
    });

    expect(result).toBe("success");
  });
});
