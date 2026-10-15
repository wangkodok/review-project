import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import AuthSessionDialog from "./AuthSessionDialog";

describe("AuthSessionDialog", () => {
  it("shows only the Kakao additional consent action for an email notice", () => {
    const html = renderToStaticMarkup(createElement(AuthSessionDialog, {
      kind: "kakao-email", onClose: vi.fn(), onConfirm: vi.fn(),
    }));
    expect(html).toContain("카카오 이메일 동의");
    expect(html).toContain("동의하기");
    expect(html).not.toContain("Google");
    expect(html).toContain('role="dialog"');
  });
  it("explains the twelve-hour expiration without exposing an account identity", () => {
    const html = renderToStaticMarkup(createElement(AuthSessionDialog, {
      kind: "expired", onClose: vi.fn(), onConfirm: vi.fn(),
    }));
    expect(html).toContain("12시간");
    expect(html).toContain("다시 로그인");
    expect(html).toContain("로그인");
  });
  it("renders nothing when no notice is needed", () => {
    expect(renderToStaticMarkup(createElement(AuthSessionDialog, {
      kind: null, onClose: vi.fn(), onConfirm: vi.fn(),
    }))).toBe("");
  });
});
