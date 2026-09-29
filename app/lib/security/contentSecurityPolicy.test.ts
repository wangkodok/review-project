import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  getR2UploadOrigin,
} from "./contentSecurityPolicy";

const ACCOUNT_ID = "0123456789abcdef0123456789abcdef";
const R2_ORIGIN = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;

describe("content security policy", () => {
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
