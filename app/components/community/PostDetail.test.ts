import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const post = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  title: "돈까스",
  content: "",
  storeName: "핵밥",
  menuName: "돈까스",
  goodPoints: ["tasty"],
  badPoints: [],
  goodPointLabels: ["맛있어요"],
  badPointLabels: [],
  overallReview: null,
  likeCount: 1,
  viewCount: 2,
  createdAt: "2026-10-03T00:00:00.000Z",
  updatedAt: "2026-10-03T00:00:00.000Z",
  author: { anonymousId: "익명테스트" },
  category: { id: "category-id", name: "한식", slug: "korean" },
  region: { id: "region-id", name: "서울", slug: "seoul" },
  image: {
    detailUrl: "https://media.sseullae.com/detail/review.webp",
    thumbnailUrl: "https://media.sseullae.com/thumbnail/review.webp",
    width: 1200,
    height: 900,
  },
  isOwner: false,
  isLiked: false,
  requiresCategorySelection: false,
  requiresRegionSelection: false,
  requiresReviewCompletion: false,
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: post,
    error: null,
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  }),
}));

import PostDetail from "./PostDetail";

describe("PostDetail", () => {
  it("renders the guest like action as a login dialog trigger", () => {
    const html = renderToStaticMarkup(
      createElement(PostDetail, {
        isAuthenticated: false,
        postId: post.id,
      }),
    );

    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("로그인이 필요합니다.");
  });

  it("shows the representative image before the review identity text", () => {
    const html = renderToStaticMarkup(
      createElement(PostDetail, {
        isAuthenticated: false,
        postId: post.id,
      }),
    );

    const imageIndex = html.indexOf('aria-label="대표 사진 크게 보기"');
    const taxonomyIndex = html.indexOf("서울");
    const storeNameIndex = html.indexOf(">핵밥</h1>");
    const menuNameIndex = html.indexOf(">돈까스</p>");

    expect(imageIndex).toBeGreaterThan(-1);
    expect(taxonomyIndex).toBeGreaterThan(imageIndex);
    expect(storeNameIndex).toBeGreaterThan(taxonomyIndex);
    expect(menuNameIndex).toBeGreaterThan(storeNameIndex);
  });
});
