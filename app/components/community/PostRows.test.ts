import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CommunityPost } from "@/app/types/post";
import CommunityList from "./CommunityList";
import PostRows from "./PostRows";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [], isError: false }),
  useInfiniteQuery: () => ({
    data: {
      pages: [{ posts: [post], page: 1, limit: 10, totalCount: 1, hasMore: false }],
    },
    hasNextPage: false,
    isError: false,
    isLoading: false,
  }),
}));

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

  it("renders plain taxonomy only when the community list requests it", () => {
    const html = renderToStaticMarkup(
      createElement(CommunityList, { isAuthenticated: false }),
    );

    expect(html).toContain("서울 · 한식");
    expect(html).toContain("text-[#565656]");
    expect(html).not.toContain("bg-[#e7f8ed]");
    expect(html).not.toContain("bg-[#ddf3ff]");
    expect(html).toContain(`/community/${post.id}`);
  });

  it.each([
    { region: post.region, category: null, label: "서울" },
    { region: null, category: post.category, label: "한식" },
    { region: null, category: null, label: "" },
  ])("omits the separator for incomplete plain taxonomy: $label", ({ region, category, label }) => {
    const html = renderToStaticMarkup(
      createElement(PostRows, {
        posts: [{ ...post, region, category, author: { anonymousId: "guest" } }],
        isAuthenticated: false,
        taxonomyDisplay: "text",
      }),
    );

    const taxonomy = html.match(/<span class="[^"]*text-\[#565656\][^"]*">([^<]*)<\/span>/)?.[1];
    expect(taxonomy).toBe(label);
    expect(taxonomy).not.toContain(" · ");
  });
});
