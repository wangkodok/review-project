import { describe, expect, it, vi } from "vitest";
import { ANALYTICS_EVENTS } from "./events";
import { buildOperatorQaOptions, getOperatorQaConfig, isOperatorQaEnabled } from "./operatorQa";

const environment = { nodeEnv: "development", flag: "true" };
const input = { ...environment, appOrigin: "http://localhost:3001", projectToken: "phc_synthetic_qa", confirmed: true };
const uuid = "12345678-1234-4234-8234-123456789abc";
const properties = { screen: "/community/private-id?email=private", mode: "create", hasImage: false,
  error: "network", distinct_id: "$posthog_cookieless", $cookieless_mode: true, email: "private",
  environment: "production", $current_url: "private", $set: { name: "private" } };

describe("operator-only cookieless analytics QA", () => {
  it("requires an explicit local development process and manual participation", () => {
    expect(getOperatorQaConfig(input)).toEqual({ analytics: true, replay: false, environment: "test",
      projectToken: "phc_synthetic_qa", apiHost: "https://us.i.posthog.com" });
    for (const change of [
      { nodeEnv: "production" }, { nodeEnv: "test" }, { flag: undefined }, { flag: "false" },
      { deploymentEnv: "preview" }, { deploymentEnv: "production" }, { confirmed: false },
      { appOrigin: "https://www.sseullae.com" }, { appOrigin: "http://192.168.1.2:3001" },
      { appOrigin: "http://localhost.evil.test:3001" }, { appOrigin: "http://user@localhost:3001" },
      { appOrigin: "http://localhost:3001/path" }, { projectToken: "phx_private" },
    ]) expect(getOperatorQaConfig({ ...input, ...change })).toBeNull();
    expect(isOperatorQaEnabled({ ...environment, deploymentEnv: "development" })).toBe(false);
  });

  it("uses_the_same_five_names_and_filter_with_trusted_test_environment", () => {
    const onEvent = vi.fn();
    const config = getOperatorQaConfig(input)!;
    const options = buildOperatorQaOptions(config, () => true, onEvent);
    const beforeSend = options.before_send! as (event: unknown) => unknown;
    for (const event of ANALYTICS_EVENTS) {
      const output = beforeSend({ uuid, event, properties });
      expect(output).toMatchObject({ uuid, event, properties: {
        screen: "/community/[postId]", environment: "test", distinct_id: "$posthog_cookieless",
        $cookieless_mode: true, token: input.projectToken, $process_person_profile: false, $geoip_disable: true,
      } });
      expect(JSON.stringify(output)).not.toMatch(/private|email|current_url|\$set|production/);
    }
    expect(onEvent.mock.calls.map(([name]) => name)).toEqual([...ANALYTICS_EVENTS]);
    for (const event of ["ui_action", "filter_changed", "qa_pageview", "$snapshot", "search_submitted"]) {
      expect(beforeSend({ uuid, event, properties })).toBeNull();
    }
    const invalid = buildOperatorQaOptions({ ...config, environment: "production" }, () => true).before_send! as (event: unknown) => unknown;
    expect(invalid({ uuid, event: "$pageview", properties })).toBeNull();
    expect(options).toMatchObject({ cookieless_mode: "always", disable_session_recording: true,
      autocapture: false, persistence: "memory", request_batching: false });
  });

  it("drops_events_after_stop_and_rejects_non_cookieless_identities", () => {
    let active = true;
    const beforeSend = buildOperatorQaOptions(getOperatorQaConfig(input)!, () => active).before_send! as (event: unknown) => unknown;
    const event = { uuid, event: "$pageview", properties };
    expect(beforeSend(event)).not.toBeNull();
    expect(beforeSend({ ...event, properties: { ...properties, distinct_id: uuid } })).toBeNull();
    active = false;
    expect(beforeSend(event)).toBeNull();
  });

  it("serializes_funnel_events_and_test_properties_in_the_real_SDK_without_network", async () => {
    const { PostHog } = await vi.importActual<typeof import("posthog-js")>("posthog-js/lib/src/posthog-core.js");
    const client = new PostHog();
    const send = vi.spyOn(client, "_send_retriable_request").mockImplementation(() => {});
    const config = getOperatorQaConfig(input)!;
    client.init(config.projectToken, { ...buildOperatorQaOptions(config, () => true), opt_out_useragent_filter: true });
    try {
      for (const event of ANALYTICS_EVENTS) client.capture(event, properties);
      expect(send).toHaveBeenCalledTimes(5);
      expect(send.mock.calls.map(([request]) => request.data)).toEqual(ANALYTICS_EVENTS.map((event) => expect.objectContaining({
        event, properties: expect.objectContaining({ environment: "test", $cookieless_mode: true, $geoip_disable: true }),
      })));
      expect(JSON.stringify(send.mock.calls)).not.toMatch(/private|email|current_url|referrer/);
      client.capture("ui_action", properties);
      client.capture("$snapshot", properties);
      expect(send).toHaveBeenCalledTimes(5);
    } finally { await client.shutdown(); }
  });
});
