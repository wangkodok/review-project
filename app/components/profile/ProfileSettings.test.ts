import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const profileUser = {
  email: "profile@example.com",
  authProvider: "google" as const,
  anonymousId: "익명테스트",
  nickname: "테스트",
  nicknameUpdatedAt: null,
  nicknameChangeCount: 0,
  canChangeNickname: true,
  nextNicknameChangeAt: null,
  activitySummary: {
    totalLikes: 0,
    totalViews: 0,
    postCount: 0,
  },
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn() }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: profileUser,
    isError: false,
    isLoading: false,
  }),
  useQueryClient: () => ({ setQueryData: vi.fn() }),
}));

import ProfileSettings from "./ProfileSettings";

describe("ProfileSettings", () => {
  it("renders the focused nickname editor without immutable account metadata", () => {
    const html = renderToStaticMarkup(createElement(ProfileSettings));

    expect(html).toContain('aria-label="기본 프로필 이미지"');
    expect(html).toContain("h-20 w-20");
    expect(html).toContain(">닉네임</label>");
    expect(html).toContain(">3/6</span>");
    expect(html).toContain('placeholder="닉네임을 입력해 주세요."');
    expect(html).toContain('maxLength="6"');
    expect(html).toContain("한글 또는 영문 2~6자 입력해 주세요.");
    expect(html).toContain('class="font-medium">저장</span>');
    expect(html).not.toContain("이메일");
    expect(html).not.toContain("로그인 계정");
    expect(html).not.toContain("익명 ID");
    expect(html).not.toContain("확인해 주세요.");
  });
});
