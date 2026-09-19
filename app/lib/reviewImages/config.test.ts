import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getReviewImageStorageConfig,
  isReviewImageUploadEnabled,
} from "./config";

const ACCOUNT_ID = "0123456789abcdef0123456789abcdef";

function stubValidConfig() {
  vi.stubEnv("R2_ACCOUNT_ID", ACCOUNT_ID);
  vi.stubEnv("R2_ENDPOINT", `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`);
  vi.stubEnv("R2_ACCESS_KEY_ID", "test-access-key");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret-key");
  vi.stubEnv("R2_TEMP_BUCKET_NAME", "sseullae-review-images-temp");
  vi.stubEnv("R2_PUBLIC_BUCKET_NAME", "sseullae-review-images-public");
}

describe("review image storage config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("enables uploads only for the exact true value", () => {
    vi.stubEnv("REVIEW_IMAGE_UPLOAD_ENABLED", "TRUE");
    expect(isReviewImageUploadEnabled()).toBe(false);

    vi.stubEnv("REVIEW_IMAGE_UPLOAD_ENABLED", "true");
    expect(isReviewImageUploadEnabled()).toBe(true);
  });

  it("accepts a matching server-only R2 configuration", () => {
    stubValidConfig();

    expect(getReviewImageStorageConfig()).toMatchObject({
      endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
      tempBucketName: "sseullae-review-images-temp",
      publicBucketName: "sseullae-review-images-public",
    });
  });

  it("rejects an endpoint for a different account", () => {
    stubValidConfig();
    vi.stubEnv(
      "R2_ENDPOINT",
      "https://ffffffffffffffffffffffffffffffff.r2.cloudflarestorage.com",
    );

    expect(() => getReviewImageStorageConfig()).toThrow(
      "R2_ENDPOINT does not match R2_ACCOUNT_ID",
    );
  });
});
