import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/components/common/PageBackHeader", () => ({
  default: () => null,
}));

import PrivacyPage from "./page";

describe("PrivacyPage", () => {
  it("discloses_analytics_preparation_without_collection_or_consent_UI", () => {
    const html = renderToStaticMarkup(createElement(PrivacyPage));
    expect(html).toContain("현재 이용 통계와 화면 이용 기록(세션 리플레이)을 수집하지 않습니다.");
    expect(html).toContain("PostHog");
    expect(html).toContain("검색어");
    expect(html).not.toContain('type="checkbox"');
  });
  it("describes the current Google withdrawal policy", () => {
    const html = renderToStaticMarkup(createElement(PrivacyPage));

    expect(html).toContain("시행일 2026년 09월 30일");
    expect(html).toContain(
      "Google 계정과 서비스 사이의 외부 로그인 연결은 자동으로 해제하지 않습니다.",
    );
    expect(html).toContain("https://myaccount.google.com/permissions");
    expect(html).not.toContain("회원 탈퇴 재인증");
    expect(html).not.toContain("Google 로그인과 계정 연결 해제");
  });
});
