import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: {
      anonymousId: "익명테스트",
      nickname: "테스트",
      activitySummary: {
        totalLikes: 0,
        totalViews: 0,
        postCount: 0,
      },
    },
    isError: false,
    isLoading: false,
  }),
}));

vi.mock("../auth/LogoutButton", () => ({
  default: () => null,
}));

vi.mock("./WithdrawButton", () => ({
  default: () => null,
}));

import ProfileInfo from "./ProfileInfo";

describe("ProfileInfo", () => {
  it("links the service terms from the profile menu", () => {
    const html = renderToStaticMarkup(createElement(ProfileInfo));

    expect(html).toContain('href="/terms"');
    expect(html).toContain("서비스 이용약관");
    expect(html).not.toContain('aria-disabled="true"');
  });
});
