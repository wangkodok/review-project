"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getAnalyticsConfig, type AnalyticsConfigInput } from "@/app/lib/analytics/config";
import { analytics } from "@/app/lib/analytics/runtime";
import { registerAnalyticsInteractions } from "@/app/lib/analytics/interactions";

type Props = Omit<AnalyticsConfigInput, "appOrigin">;
export default function AnalyticsObserver(props: Props) {
  const pathname = usePathname();
  const { projectToken, host, analyticsFlag, replayFlag, deploymentEnv, nodeEnv } = props;
  useEffect(() => {
    analytics.configure(getAnalyticsConfig({ projectToken, host, analyticsFlag, replayFlag, deploymentEnv, nodeEnv, appOrigin: window.location.origin }));
    const update = () => { if (document.visibilityState !== "hidden") analytics.updateLocation(window.location.href); };
    update();
    void analytics.start();
    window.addEventListener("pageshow", update);
    document.addEventListener("visibilitychange", update);
    const removeClicks = registerAnalyticsInteractions(document, () => window.location.href, (event) => analytics.track(event));
    return () => {
      window.removeEventListener("pageshow", update);
      document.removeEventListener("visibilitychange", update);
      removeClicks();
    };
  }, [projectToken, host, analyticsFlag, replayFlag, deploymentEnv, nodeEnv]);
  useEffect(() => { analytics.updateLocation(window.location.href); }, [pathname]);
  return null;
}
