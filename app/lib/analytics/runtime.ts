import { ANALYTICS_APP_ORIGIN, type AnalyticsConfig } from "./config";
import { normalizeAnalyticsLocation, sanitizeAnalyticsEvent, type AnalyticsEvent } from "./events";
import { loadAnalyticsDriver, type AnalyticsDriver } from "./posthogAdapter";

export type AnalyticsRuntime = {
  start(): Promise<void>;
  updateLocation(url: string): void;
  track(event: AnalyticsEvent, epoch?: number): void;
  epoch(): number;
  resetIdentity(): void;
  stop(): void;
};

function safely(work: () => void) { try { work(); } catch { /* Analytics must not alter application results. */ } }

export function createAnalyticsRuntime(config: AnalyticsConfig | null,
  loadDriver: (isActive: () => boolean) => Promise<AnalyticsDriver>): AnalyticsRuntime {
  let stopped = false;
  let generation = 0;
  let pendingReset = false;
  let loading: Promise<void> | undefined;
  let driver: AnalyticsDriver | undefined;
  let location: { key: string; screen: string } | null = null;
  let lastPage: string | null = null;
  const active = () => !!config && !stopped;
  const capture = (event: AnalyticsEvent) => {
    if (!active() || !driver || !config) return;
    const clean = sanitizeAnalyticsEvent(event, config);
    if (clean) safely(() => driver?.capture(clean));
  };
  const pageview = () => {
    if (!active() || !driver || !location || lastPage === location.key) return;
    lastPage = location.key;
    capture({ event: "$pageview", properties: { screen: location.screen } });
    if (location.screen === "/community/write") capture({ event: "review_write_opened", properties: { screen: "/community/write" } });
  };
  return {
    start() {
      if (!active()) return Promise.resolve();
      if (!loading) loading = (async () => {
        try {
          const loaded = await loadDriver(active);
          if (!active()) { safely(() => loaded.stop()); return; }
          driver = loaded;
          if (pendingReset) safely(() => driver?.resetIdentity());
          pageview();
        } catch { stopped = true; generation++; }
      })();
      return loading;
    },
    updateLocation(url) {
      const screen = normalizeAnalyticsLocation(url);
      location = screen ? { screen, key: new URL(url, ANALYTICS_APP_ORIGIN).pathname } : null;
      if (!location) lastPage = null;
      pageview();
    },
    track(event, epoch = generation) {
      if (!active() || !driver || epoch !== generation || !config) return;
      capture(event);
    },
    epoch: () => generation,
    resetIdentity() {
      generation++;
      pendingReset = true;
      safely(() => driver?.resetIdentity());
    },
    stop() {
      if (stopped) return;
      stopped = true; generation++;
      safely(() => driver?.stop());
    },
  };
}

let configured = false;
let initialConfig: string | undefined;
let facadeEpoch = 0;
let runtime: AnalyticsRuntime | undefined;
export const analytics: AnalyticsRuntime & { configure(config: AnalyticsConfig | null, driverLoader?: typeof loadAnalyticsDriver): void } = {
  configure(config, driverLoader = loadAnalyticsDriver) {
    const signature = JSON.stringify(config);
    if (configured) { if (signature !== initialConfig) analytics.stop(); return; }
    configured = true; initialConfig = signature; facadeEpoch++;
    runtime = createAnalyticsRuntime(config, (active) => config ? driverLoader(config, active) : Promise.reject());
  },
  start: () => runtime?.start() ?? Promise.resolve(),
  updateLocation: (url) => runtime?.updateLocation(url),
  track(event, epoch = facadeEpoch) { if (epoch === facadeEpoch) runtime?.track(event); },
  epoch: () => facadeEpoch,
  resetIdentity() { facadeEpoch++; runtime?.resetIdentity(); },
  stop() { facadeEpoch++; runtime?.stop(); },
};
