import { describe, expect, it } from "vitest";
import { getSentryConfig, SENTRY_APP_ORIGIN } from "./config";

const input = {
  flag: "true", nodeEnv: "production", deploymentEnv: "production",
  dsn: `https://${"a".repeat(32)}@o123.ingest.us.sentry.io/456`,
  release: "b".repeat(40),
};

describe("Sentry configuration", () => {
  it("enables only an explicit production configuration", () => {
    expect(getSentryConfig(input)).toEqual({
      dsn: input.dsn, ingestOrigin: "https://o123.ingest.us.sentry.io",
      environment: "production", release: input.release,
    });
  });

  it.each([undefined, "", "false", "TRUE", "1", " true "])("defaults OFF for flag %s", (flag) => {
    expect(getSentryConfig({ ...input, flag })).toBeNull();
  });

  it.each(["development", "test", "preview", undefined])("rejects environment %s", (value) => {
    expect(getSentryConfig({ ...input, deploymentEnv: value })).toBeNull();
    expect(getSentryConfig({ ...input, nodeEnv: value })).toBeNull();
  });

  it.each([
    "", "not-a-dsn", input.dsn.replace("https:", "http:"),
    input.dsn.replace(".us.", ".de."), `${input.dsn}?secret=excluded`,
    `${input.dsn}#excluded`, `${input.dsn}/extra`, ` ${input.dsn}`,
    input.dsn.replace("@", ":password@"), input.dsn.replace(".io/", ".io:8443/"),
    input.dsn.replace(".io/", ".io.evil.test/"),
  ])("rejects an unapproved DSN shape %s", (dsn) => {
    expect(getSentryConfig({ ...input, dsn })).toBeNull();
  });

  it("never uses arbitrary release text", () => {
    expect(getSentryConfig({ ...input, release: "private@example.invalid" })?.release).toBeUndefined();
  });

  it("pins the public application origin", () => {
    expect(SENTRY_APP_ORIGIN).toBe("https://www.sseullae.com");
  });
});
