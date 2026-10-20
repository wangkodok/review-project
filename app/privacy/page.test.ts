import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/components/common/PageBackHeader", () => ({
  default: () => null,
}));

import PrivacyPage from "./page";

describe("PrivacyPage", () => {
  it("discloses_disabled_by_default_cookieless_analytics_without_legal_exemptions_or_consent_UI", () => {
    const html = renderToStaticMarkup(createElement(PrivacyPage));
    expect(html).toContain("분석 수집은 기본 설정에서 꺼져 있습니다.");
    expect(html).toContain("PostHog");
    for (const fact of ["쿠키리스", "화면 조회", "리뷰 작성 진입", "저장 시도", "저장 성공", "저장 실패",
      "IP 주소", "브라우저 정보", "국외 처리", "보유기간", "localStorage", "화면 녹화는 사용하지 않습니다."]) {
      expect(html).toContain(fact);
    }
    expect(html).toContain("검색어");
    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toMatch(/IP가 전혀 전달되지|법적 의무가 없|동의가 필요 없|행동 분석 SDK는 사용하지 않습니다/);
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
