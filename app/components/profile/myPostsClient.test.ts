import type { InfiniteData } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import type { CommunityPost, PostsPage } from "@/app/types/post";
import { removePostFromMyPostsData } from "./myPostsClient";

function createPost(id: string): CommunityPost {
  return {
    id,
    title: id,
    content: "",
    storeName: id,
    menuName: "메뉴",
    goodPoints: [],
    badPoints: [],
    goodPointLabels: [],
    badPointLabels: [],
    overallReview: null,
    likeCount: 0,
    viewCount: 0,
    createdAt: "2026-09-09T00:00:00.000Z",
    author: { anonymousId: "익명테스트" },
    category: null,
    region: null,
    image: null,
    isOwner: true,
    requiresCategorySelection: false,
    requiresRegionSelection: false,
    requiresReviewCompletion: false,
  };
}

describe("removePostFromMyPostsData", () => {
  it("모든 페이지에서 삭제한 리뷰를 제거하고 전체 개수를 한 번 줄인다", () => {
    const data: InfiniteData<PostsPage, number> = {
      pages: [
        {
          posts: [createPost("post-1"), createPost("post-2")],
          page: 1,
          limit: 2,
          totalCount: 3,
          hasMore: true,
        },
        {
          posts: [createPost("post-3")],
          page: 2,
          limit: 2,
          totalCount: 3,
          hasMore: false,
        },
      ],
      pageParams: [1, 2],
    };

    const result = removePostFromMyPostsData(data, "post-2");

    expect(result?.pages.map((page) => page.posts.map((post) => post.id))).toEqual([
      ["post-1"],
      ["post-3"],
    ]);
    expect(result?.pages.map((page) => page.totalCount)).toEqual([2, 2]);
  });

  it("목록에 없는 리뷰라면 기존 캐시를 그대로 반환한다", () => {
    const data: InfiniteData<PostsPage, number> = {
      pages: [
        {
          posts: [createPost("post-1")],
          page: 1,
          limit: 10,
          totalCount: 1,
          hasMore: false,
        },
      ],
      pageParams: [1],
    };

    expect(removePostFromMyPostsData(data, "missing-post")).toBe(data);
  });
});
