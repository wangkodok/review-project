import { describe, expect, it } from "vitest";
import { getLogoutOptions } from "./LogoutButton";

describe("getLogoutOptions", () => {
  it("uses a custom callback only for the caller that supplies it", () => {
    expect(getLogoutOptions("/community?menu=guest")).toEqual({
      callbackUrl: "/community?menu=guest",
    });
    expect(getLogoutOptions()).toEqual({ callbackUrl: "/my" });
  });
});
