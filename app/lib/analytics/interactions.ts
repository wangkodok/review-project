import { ANALYTICS_ACTIONS, normalizeAnalyticsLocation, type AnalyticsAction, type AnalyticsEvent } from "./events";
import { analytics } from "./runtime";

// Next Link prevents the native click even for accepted SPA navigations.
export function recordAnalyticsNavigation(action: AnalyticsAction) {
  try {
    const screen = normalizeAnalyticsLocation(new URL(window.location.href).pathname);
    if (screen && resolveAnalyticsAction(action, false, false)) analytics.track({ event: "ui_action", properties: { screen, action } });
  } catch { /* Navigation remains independent of analytics. */ }
}

export function resolveAnalyticsAction(action: unknown, disabled: boolean, defaultPrevented: boolean): AnalyticsAction | null {
  return !disabled && !defaultPrevented && typeof action === "string" && ANALYTICS_ACTIONS.includes(action as AnalyticsAction) ? action as AnalyticsAction : null;
}

export function registerAnalyticsInteractions(target: EventTarget, getLocation: () => string, capture: (event: AnalyticsEvent) => void) {
  const onClick = (event: Event) => {
    try {
      const origin = event.target as Element | null;
      const control = origin?.closest?.("[data-analytics-action]");
      if (!control) return;
      const action = resolveAnalyticsAction(control.getAttribute("data-analytics-action"),
        control.hasAttribute("disabled") || control.getAttribute("aria-disabled") === "true" || !!control.closest("fieldset[disabled]"), event.defaultPrevented);
      const screen = normalizeAnalyticsLocation(getLocation());
      if (action && screen) capture({ event: "ui_action", properties: { screen, action } });
    } catch { /* Ignore malformed targets and analytics failures. */ }
  };
  target.addEventListener("click", onClick);
  return () => target.removeEventListener("click", onClick);
}
