import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [], isError: false }),
  useInfiniteQuery: () => ({
    data: {
      pages: [
        {
          posts: [{ id: "post-id" }],
          page: 1,
          limit: 10,
          totalCount: 0,
          hasMore: false,
        },
      ],
    },
    hasNextPage: false,
    isError: false,
    isLoading: false,
  }),
}));
vi.mock("./PostRows", () => ({
  default: ({
    getEditHref,
  }: {
    getEditHref?: (post: { id: string }) => string;
  }) => `edit:${getEditHref?.({ id: "post-id" }) ?? "default"}`,
}));
vi.mock("./ReviewListControls", () => ({
  default: () => null,
  ReviewListSkeleton: () => null,
}));
vi.mock("./ReviewPickerDialog", () => ({ default: () => null }));
vi.mock("@/app/components/auth/ReviewWriteLoginDialog", () => ({
  default: () => null,
}));

import CommunityList from "./CommunityList";

describe("CommunityList", () => {
  it("uses the shared page chrome and keeps the compact review write action", () => {
    const html = renderToStaticMarkup(
      createElement(CommunityList, { isAuthenticated: false }),
    );

    expect(html).not.toContain('aria-label="메뉴 열기"');
    expect(html).not.toContain('aria-label="게시글 검색"');
    expect(html).toContain("리뷰쓰기");
  });

  it("marks review edits as starting from the community list", () => {
    const html = renderToStaticMarkup(
      createElement(CommunityList, { isAuthenticated: true }),
    );

    expect(html).toContain("edit:/community/post-id/edit?from=community");
  });
});
