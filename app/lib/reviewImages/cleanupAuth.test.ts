import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getReviewImageCleanupAuthStatus } from "./cleanupAuth";

const SECRET = "a-secure-test-cron-secret-with-32-chars";

describe("review image cleanup cron authentication", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed when the secret is missing or too short", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(getReviewImageCleanupAuthStatus(null)).toBe("misconfigured");

    vi.stubEnv("CRON_SECRET", "too-short");
    expect(getReviewImageCleanupAuthStatus("Bearer too-short")).toBe(
      "misconfigured",
    );
  });

  it("accepts only the exact bearer secret", () => {
    vi.stubEnv("CRON_SECRET", SECRET);

    expect(getReviewImageCleanupAuthStatus(`Bearer ${SECRET}`)).toBe(
      "authorized",
    );
    expect(getReviewImageCleanupAuthStatus(`Bearer ${SECRET}-wrong`)).toBe(
      "unauthorized",
    );
    expect(getReviewImageCleanupAuthStatus(null)).toBe("unauthorized");
  });
});
