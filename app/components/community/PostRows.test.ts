import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CommunityPost } from "@/app/types/post";
import PostRows from "./PostRows";

const post: CommunityPost = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  title: "버거",
  content: "",
  storeName: "봉구스 밥버거",
  menuName: "밥버거",
  goodPoints: ["tasty"],
  badPoints: [],
  goodPointLabels: ["맛있어요"],
  badPointLabels: [],
  overallReview: "신메뉴하고 인기메뉴랑 같이 먹으면 배가 불러요.",
  likeCount: 12,
  viewCount: 34,
  createdAt: "2026-06-17T00:00:00.000Z",
  author: { anonymousId: "익명F19dF1" },
  category: { id: "category-id", name: "한식", slug: "korean" },
  region: { id: "region-id", name: "서울", slug: "seoul" },
  image: null,
  isOwner: false,
  requiresCategorySelection: false,
  requiresRegionSelection: false,
  requiresReviewCompletion: false,
};

describe("PostRows", () => {
  it("renders region and category with the previous colored badges", () => {
    const html = renderToStaticMarkup(
      createElement(PostRows, {
        posts: [post],
        isAuthenticated: false,
      }),
    );

    expect(html).toContain("서울");
    expect(html).toContain("한식");
    expect(html).toContain("bg-[#e7f8ed]");
    expect(html).toContain("bg-[#ddf3ff]");
    expect(html).not.toContain("서울 · 한식");
  });
});
