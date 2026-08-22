import { describe, expect, it } from "vitest";
import {
  createRateLimitIdentifier,
  isValidRateLimitIdentifierSecret,
} from "./rateLimitIdentifier";

const SECRET = "a-secure-rate-limit-secret-that-is-long-enough";

describe("createRateLimitIdentifier", () => {
  it("returns a stable opaque base64url identifier", () => {
    const sourceIdentifier = "user:4725f4e3-8dc7-475b-9262-d1ed2d78d0e8";
    const first = createRateLimitIdentifier(sourceIdentifier, SECRET);
    const second = createRateLimitIdentifier(sourceIdentifier, SECRET);

    expect(first).toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toContain(sourceIdentifier);
  });

  it("separates different identifiers and secrets", () => {
    expect(createRateLimitIdentifier("ip:203.0.113.1", SECRET)).not.toBe(
      createRateLimitIdentifier("ip:203.0.113.2", SECRET),
    );
    expect(createRateLimitIdentifier("ip:203.0.113.1", SECRET)).not.toBe(
      createRateLimitIdentifier(
        "ip:203.0.113.1",
        "a-different-rate-limit-secret-that-is-long-enough",
      ),
    );
  });

  it("rejects missing or short secrets", () => {
    expect(isValidRateLimitIdentifierSecret(undefined)).toBe(false);
    expect(isValidRateLimitIdentifierSecret("too-short")).toBe(false);
    expect(() => createRateLimitIdentifier("identifier", "too-short")).toThrow(
      "RATE_LIMIT_IDENTIFIER_SECRET is invalid",
    );
  });
});
