import { existsSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/components/common/PageBackHeader", () => ({
  default: ({ title }: { title: string }) => createElement("header", null, title),
}));

describe("TermsPage", () => {
  it("publishes the MVP service terms at a public route", async () => {
    expect(existsSync(new URL("./page.tsx", import.meta.url))).toBe(true);

    const { default: TermsPage, metadata } = await import("./page");
    const html = renderToStaticMarkup(createElement(TermsPage));

    expect(metadata.title).toBe("서비스 이용약관 | 쓸래");
    expect(html).toContain("서비스 이용약관");
    expect(html).toContain("시행일 2026년 10월 2일");
    expect(html).toContain("만 14세 미만");
    expect(html).toContain("작성한 리뷰의 저작권");
    expect(html).toContain("신고");
    expect(html).toContain("회원 탈퇴");
    expect(html).toContain('href="/privacy"');
    expect(html).toContain("sseullae@gmail.com");
  });
});
