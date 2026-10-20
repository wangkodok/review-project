import { describe, expect, it } from "vitest";
import { getAnalyticsConfig } from "./config";

const valid = {
  deploymentEnv: "production", nodeEnv: "production", appOrigin: "https://www.sseullae.com",
  projectToken: "phc_synthetic_qa_only", host: "https://us.i.posthog.com",
};

describe("analytics configuration", () => {
  it("defaults_off_and_requires_exact_true", () => {
    expect(getAnalyticsConfig({})).toBeNull();
    for (const flag of [undefined, "false", "TRUE", "1", " true "]) {
      expect(getAnalyticsConfig({ ...valid, analyticsFlag: flag })).toBeNull();
    }
  });
  it("allows_analytics_only_and_blocks_replay", () => {
    expect(getAnalyticsConfig({ ...valid, analyticsFlag: "true", replayFlag: "false" }))
      .toEqual({ analytics: true, replay: false, environment: "production", projectToken: valid.projectToken, apiHost: valid.host });
    for (const analyticsFlag of ["false", "true"]) {
      expect(getAnalyticsConfig({ ...valid, analyticsFlag, replayFlag: "true" })).toBeNull();
    }
  });
  it("blocks_local_and_preview", () => {
    for (const override of [
      { deploymentEnv: "preview" }, { deploymentEnv: undefined }, { nodeEnv: "development" },
      { appOrigin: "http://localhost:3000" }, { appOrigin: "https://sseullae.com" },
      { appOrigin: "https://www.sseullae.com.evil.test" }, { appOrigin: "https://www.sseullae.com/private" },
    ]) expect(getAnalyticsConfig({ ...valid, analyticsFlag: "true", ...override })).toBeNull();
  });
  it("rejects_bad_host_or_personal_key", () => {
    for (const host of ["http://us.i.posthog.com", "https://eu.i.posthog.com", "https://us.i.posthog.com/path",
      "https://us.i.posthog.com?token=synthetic", "https://us.i.posthog.com#hash",
      "https://user@us.i.posthog.com", "https://us.i.posthog.com:444", "https://evil.test"]) {
      expect(getAnalyticsConfig({ ...valid, host, analyticsFlag: "true" })).toBeNull();
    }
    for (const projectToken of ["phx_synthetic_personal", "", "phc_", " phc_synthetic", "phc_synthetic\n"]) {
      expect(getAnalyticsConfig({ ...valid, projectToken, analyticsFlag: "true" })).toBeNull();
    }
    expect(getAnalyticsConfig({ ...valid, host: `${valid.host}/`, analyticsFlag: "true" })?.apiHost).toBe(valid.host);
  });
});
