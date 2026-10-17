import type { AnalyticsEvent } from "./events";
import type { AnalyticsRuntime } from "./runtime";

export function createAnalyticsOperation(runtime: Pick<AnalyticsRuntime, "epoch" | "track">, isCurrent: () => boolean = () => true) {
  let epoch: number;
  try { epoch = runtime.epoch(); } catch { return () => {}; }
  return (event: AnalyticsEvent) => {
    try {
      if (isCurrent() && runtime.epoch() === epoch) runtime.track(event, epoch);
    } catch { /* Observing a result must not change that result. */ }
  };
}
