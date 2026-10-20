import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  getR2UploadOrigin,
} from "./contentSecurityPolicy";

const ACCOUNT_ID = "0123456789abcdef0123456789abcdef";
const R2_ORIGIN = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;

describe("content security policy", () => {
  it("allows_QA_ingestion_only_in_an_explicit_local_development_process", () => {
    expect(buildContentSecurityPolicy({ nodeEnv: "development", operatorQaEnabled: true })).toContain("connect-src 'self' ws: wss: https://us.i.posthog.com");
    expect(buildContentSecurityPolicy({ nodeEnv: "production", operatorQaEnabled: true })).not.toContain("posthog.com");
    expect(buildContentSecurityPolicy({ nodeEnv: "development", operatorQaEnabled: false })).not.toContain("posthog.com");
  });
  it("allows_only_the_US_ingestion_origin_for_valid_analytics", () => {
    const config = { analytics: true, replay: false, environment: "production", projectToken: "phc_synthetic", apiHost: "https://us.i.posthog.com" } as const;
    const policy = buildContentSecurityPolicy({ nodeEnv: "production", analyticsConfig: config });
    expect(policy).toContain("connect-src 'self' https://us.i.posthog.com");
    expect(policy).not.toContain("us-assets.i.posthog.com");
    expect(policy).toContain("frame-src 'none'");
    expect(policy).toContain("worker-src 'self' blob:");
    for (const invalid of [null, { ...config, replay: true }, { ...config, apiHost: "https://evil.test" }]) {
      expect(buildContentSecurityPolicy({ nodeEnv: "production", analyticsConfig: invalid as typeof config })).not.toContain("posthog.com");
    }
  });
  it("adds only the exact validated R2 S3 origin to connect-src", () => {
    const policy = buildContentSecurityPolicy({
      nodeEnv: "production",
      reviewImagePublicBaseUrl: "https://media.sseullae.com",
      r2AccountId: ACCOUNT_ID,
      r2Endpoint: `${R2_ORIGIN}/`,
    });

    expect(policy).toContain(
      `connect-src 'self' ${R2_ORIGIN}`,
    );
    expect(policy).toContain(
      "img-src 'self' data: blob: https://media.sseullae.com",
    );
    expect(policy.match(new RegExp(R2_ORIGIN.replaceAll(".", "\\."), "g"))).toHaveLength(1);
  });

  it("omits R2 from connect-src when its environment is absent", () => {
    const policy = buildContentSecurityPolicy({ nodeEnv: "production" });

    expect(policy).toContain("connect-src 'self'");
    expect(policy).not.toContain("r2.cloudflarestorage.com");
  });

  it.each([
    ["missing account", undefined, R2_ORIGIN],
    ["invalid account", "not-an-account", R2_ORIGIN],
    ["HTTP", ACCOUNT_ID, R2_ORIGIN.replace("https://", "http://")],
    [
      "different account",
      ACCOUNT_ID,
      "https://ffffffffffffffffffffffffffffffff.r2.cloudflarestorage.com",
    ],
    ["path", ACCOUNT_ID, `${R2_ORIGIN}/bucket`],
    ["query", ACCOUNT_ID, `${R2_ORIGIN}?bucket=temp`],
    ["fragment", ACCOUNT_ID, `${R2_ORIGIN}#temp`],
    ["credentials", ACCOUNT_ID, R2_ORIGIN.replace("https://", "https://user@")],
    ["port", ACCOUNT_ID, `${R2_ORIGIN}:444`],
  ])("rejects the %s endpoint variant", (_name, accountId, endpoint) => {
    expect(
      getR2UploadOrigin({ r2AccountId: accountId, r2Endpoint: endpoint }),
    ).toBeNull();
  });

  it("allows websocket connections only during development", () => {
    const development = buildContentSecurityPolicy({ nodeEnv: "development" });
    const production = buildContentSecurityPolicy({ nodeEnv: "production" });

    expect(development).toContain("connect-src 'self' ws: wss:");
    expect(production).not.toContain("ws:");
    expect(production).not.toContain("wss:");
  });

  it("rejects an invalid public image URL instead of widening img-src", () => {
    const policy = buildContentSecurityPolicy({
      nodeEnv: "production",
      reviewImagePublicBaseUrl: "javascript:alert(1)",
    });

    expect(policy).toContain("img-src 'self' data: blob:");
    expect(policy).not.toContain("javascript:");
  });

  it("does not allow the unused Google Identity Services client", () => {
    const policy = buildContentSecurityPolicy({ nodeEnv: "production" });

    expect(policy).not.toContain("accounts.google.com/gsi");
  });
});
