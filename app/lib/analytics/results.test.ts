import { expect, it, vi } from "vitest";
import { createAnalyticsOperation } from "./results";
it("drops_old_epoch_cancelled_and_throwing_observations", () => {
  let epoch = 1; let current = true;
  const runtime = { epoch: () => epoch, track: vi.fn() };
  const record = createAnalyticsOperation(runtime, () => current);
  const event = { event: "search_submitted", properties: { screen: "/community/search" } } as const;
  record(event); expect(runtime.track).toHaveBeenCalledWith(event, 1);
  current = false; record(event); current = true; epoch++; record(event);
  expect(runtime.track).toHaveBeenCalledTimes(1);
  runtime.track.mockImplementation(() => { throw new Error("analytics"); });
  expect(() => createAnalyticsOperation(runtime)(event)).not.toThrow();
});
