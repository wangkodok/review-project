import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("next-auth/react", () => ({ getProviders: vi.fn(), signIn: vi.fn() }));
vi.mock("@/app/lib/auth/options", () => ({ authOptions: {} }));
vi.mock("@/app/lib/reviewImages/config", () => ({
  isReviewImageUploadEnabled: () => false,
}));
vi.mock("@/app/components/community/PostForm", () => ({
  default: () => "post-form",
}));
vi.mock("../components/profile/ProfileInfo", () => ({
  default: () => "profile-info",
}));

import WritePostPage from "../community/write/page";
import ReviewWriteLoginDialog from "../components/auth/ReviewWriteLoginDialog";
import MyPage from "./page";

describe("guest policy links", () => {
  beforeEach(() => {
    mocks.getServerSession.mockResolvedValue(null);
  });

  it("links to both policies in the same tab below the login area on /my", async () => {
    const html = renderToStaticMarkup(await MyPage());

    expect(html).toContain('href="/terms">서비스 이용약관</a>');
    expect(html).toContain('href="/privacy">개인정보처리방침</a>');
    expect(html).not.toContain('target="_blank"');
    expect(html.indexOf('role="status"')).toBeGreaterThan(-1);
    expect(html.indexOf('href="/terms"')).toBeGreaterThan(
      html.indexOf('role="status"'),
    );
  });

  it("keeps the authenticated /my profile branch", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: "user-id" } });

    expect(renderToStaticMarkup(await MyPage())).toBe("profile-info");
  });

  it("does not add policy links on the direct guest review-write page", async () => {
    const html = renderToStaticMarkup(await WritePostPage());

    expect(html).toContain("guest-login-screen");
    expect(html).not.toContain('href="/terms"');
    expect(html).not.toContain('href="/privacy"');
  });

  it("does not add policy links in the review-write login dialog", () => {
    const html = renderToStaticMarkup(
      createElement(ReviewWriteLoginDialog, { isOpen: true, onClose: vi.fn() }),
    );

    expect(html).toContain('role="dialog"');
    expect(html).not.toContain('href="/terms"');
    expect(html).not.toContain('href="/privacy"');
  });
});
