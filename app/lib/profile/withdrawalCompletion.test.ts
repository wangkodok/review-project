import { describe, expect, it } from "vitest";
import { shouldShowGoogleManualUnlinkNotice } from "./withdrawalCompletion";

describe("shouldShowGoogleManualUnlinkNotice", () => {
  it.each(["failed", "timeout", "not_attempted"])(
    "shows the manual unlink notice for %s",
    (status) => {
      expect(shouldShowGoogleManualUnlinkNotice(status)).toBe(true);
    },
  );

  it.each(["success", undefined, "unknown", ["failed"]])(
    "hides the manual unlink notice for %s",
    (status) => {
      expect(shouldShowGoogleManualUnlinkNotice(status)).toBe(false);
    },
  );
});
