import { describe, expect, it, vi } from "vitest";
import { buildOperatorQaOptions, getOperatorQaConfig, isOperatorQaEnabled } from "./operatorQa";

const environment = { nodeEnv: "development", flag: "true" };
const input = { ...environment, appOrigin: "http://localhost:3001", projectToken: "phc_synthetic_qa", confirmed: true };
const uuid = "12345678-1234-4234-8234-123456789abc";

describe("operator-only analytics QA", () => {
  it("requires an explicit local development process and manual participation", () => {
    expect(getOperatorQaConfig(input)).toEqual({ analytics: true, replay: false, projectToken: "phc_synthetic_qa", apiHost: "https://us.i.posthog.com" });
    for (const change of [
      { nodeEnv: "production" }, { nodeEnv: "test" }, { flag: undefined }, { flag: "false" },
      { deploymentEnv: "preview" }, { deploymentEnv: "production" }, { confirmed: false },
      { appOrigin: "https://www.sseullae.com" }, { appOrigin: "http://192.168.1.2:3001" },
      { appOrigin: "http://localhost.evil.test:3001" }, { appOrigin: "http://user@localhost:3001" },
      { appOrigin: "http://localhost:3001/path" }, { projectToken: "phx_private" },
    ]) expect(getOperatorQaConfig({ ...input, ...change })).toBeNull();
    expect(isOperatorQaEnabled({ ...environment, deploymentEnv: "development" })).toBe(false);
  });

  it("labels only real navigation and filter events after the existing payload sanitizer", () => {
    const config = getOperatorQaConfig(input)!;
    const options = buildOperatorQaOptions(config, () => true);
    const beforeSend = options.before_send! as (event: unknown) => unknown;
    const event = { uuid, event: "ui_action", properties: {
      screen: "/community/private-id?email=private", action: "review_write", distinct_id: uuid,
      email: "private", $current_url: "http://localhost:3001/private", $set: { name: "private" },
    } };
    expect(beforeSend(event)).toEqual({ uuid, event: "qa_ui_action", properties: {
      screen: "/community/[postId]", action: "review_write", distinct_id: uuid,
      token: "phc_synthetic_qa", $process_person_profile: false, $geoip_disable: true,
    } });
    for (const name of ["$pageview", "filter_changed", "review_write_opened"]) {
      expect(beforeSend({ ...event, event: name, properties: { screen: "/community", distinct_id: uuid, filter: "photo", enabled: true, $geoip_disable: false } })).toMatchObject({
        event: `qa_${name === "$pageview" ? "pageview" : name}`, properties: { $geoip_disable: true },
      });
    }
    for (const name of ["review_save_succeeded", "like_result", "$snapshot", "search_submitted"]) {
      expect(beforeSend({ ...event, event: name })).toBeNull();
    }
    expect(options.disable_session_recording).toBe(true);
    expect(options.autocapture).toBe(false);
    expect(options.persistence).toBe("memory");
    expect(options.request_batching).toBe(false);
  });

  it("drops events after stop and rejects invalid SDK identities", () => {
    let active = true;
    const beforeSend = buildOperatorQaOptions(getOperatorQaConfig(input)!, () => active).before_send! as (event: unknown) => unknown;
    const event = { uuid, event: "$pageview", properties: { screen: "/community", distinct_id: uuid } };
    expect(beforeSend(event)).not.toBeNull();
    expect(beforeSend({ ...event, properties: { ...event.properties, distinct_id: "account-id" } })).toBeNull();
    active = false;
    expect(beforeSend(event)).toBeNull();
  });

  it("serializes_QA_names_and_clean_properties_in_the_real_SDK_without_network", async () => {
    const { PostHog } = await vi.importActual<typeof import("posthog-js")>("posthog-js/lib/src/posthog-core.js");
    const client = new PostHog();
    // Only this offline fixture intercepts transport; runtime uses the public SDK unchanged.
    const send = vi.spyOn(client, "_send_retriable_request").mockImplementation(() => {});
    const config = getOperatorQaConfig(input)!;
    client.init(config.projectToken, { ...buildOperatorQaOptions(config, () => true), opt_out_useragent_filter: true });
    try {
      client.capture("filter_changed", { screen: "/community?email=private", filter: "photo", enabled: true, email: "private", $current_url: "private", $geoip_disable: false });
      expect(send).toHaveBeenCalledTimes(1);
      const payload = send.mock.calls[0][0].data;
      expect(payload).toMatchObject({ event: "qa_filter_changed", properties: { screen: "/community", filter: "photo", enabled: true, $geoip_disable: true } });
      expect(JSON.stringify(payload)).not.toMatch(/private|email|current_url|referrer/);
      client.capture("review_save_succeeded", { screen: "/community/write", mode: "create", hasImage: false });
      client.capture("$snapshot", { screen: "/community" });
      expect(send).toHaveBeenCalledTimes(1);
    } finally { await client.shutdown(); }
  });
});
