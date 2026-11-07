import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  QueryClient,
  QueryObserver,
  type QueryObserverOptions,
} from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryHooks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useInfiniteQuery: vi.fn(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...await importOriginal<typeof import("@tanstack/react-query")>(),
  ...queryHooks,
}));

beforeEach(() => {
  vi.clearAllMocks();
  queryHooks.useQuery.mockReturnValue({ data: [], isError: false });
  queryHooks.useInfiniteQuery.mockReturnValue({
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
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
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

import CommunityList, { buildPostsRequestUrl } from "./CommunityList";

describe("CommunityList", () => {
  it("limits five-minute freshness to reference data without changing posts pagination", () => {
    renderToStaticMarkup(createElement(CommunityList, { isAuthenticated: false }));

    expect(queryHooks.useQuery.mock.calls.map(([options]) => options)).toEqual([
      { queryKey: ["categories"], queryFn: expect.any(Function), staleTime: 300_000 },
      { queryKey: ["regions"], queryFn: expect.any(Function), staleTime: 300_000 },
    ]);
    const postsOptions = queryHooks.useInfiniteQuery.mock.calls[0][0];
    expect(postsOptions).toEqual({
      queryKey: ["posts", "latest", "", "", false],
      queryFn: expect.any(Function),
      initialPageParam: 1,
      getNextPageParam: expect.any(Function),
    });
    expect(postsOptions.getNextPageParam({ page: 1, hasMore: true })).toBe(2);
    expect(postsOptions.getNextPageParam({ page: 1, hasMore: false })).toBeUndefined();
  });

  it.each(["categories", "regions"])(
    "reuses fresh %s on focus and refetches only after a stale wake or explicit retry",
    async (queryKey) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-11-07T00:00:00Z"));
      renderToStaticMarkup(createElement(CommunityList, { isAuthenticated: false }));
      const options = queryHooks.useQuery.mock.calls
        .map(([options]) => options as QueryObserverOptions<unknown[]>)
        .find((options) => options.queryKey?.[0] === queryKey)!;
      const fetchMock = vi.fn(async () => Response.json({
        success: true,
        data: { categories: [], regions: [] },
        message: "",
      }));
      vi.stubGlobal("fetch", fetchMock);
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const observer = new QueryObserver(client, options);
      const unsubscribe = observer.subscribe(() => undefined);

      try {
        await vi.advanceTimersByTimeAsync(0);
        expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`/api/${queryKey}`);
        expect(observer.getCurrentResult().data).toEqual([]);

        await vi.advanceTimersByTimeAsync(299_999);
        client.getQueryCache().onFocus();
        expect(fetchMock).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        client.getQueryCache().onFocus();
        await vi.advanceTimersByTimeAsync(0);
        expect(fetchMock).toHaveBeenCalledTimes(2);

        await observer.refetch();
        expect(fetchMock).toHaveBeenCalledTimes(3);
      } finally {
        unsubscribe();
        client.clear();
      }
    },
  );

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

  it("adds the photo query only while the photo-only filter is enabled", () => {
    const enabledUrl = new URL(
      buildPostsRequestUrl({
        pageParam: 1,
        sort: "latest",
        categorySlug: "korean",
        regionSlug: "seoul",
        withImage: true,
      }),
      "http://localhost",
    );
    const disabledUrl = new URL(
      buildPostsRequestUrl({
        pageParam: 1,
        sort: "latest",
        categorySlug: "",
        regionSlug: "",
        withImage: false,
      }),
      "http://localhost",
    );

    expect(enabledUrl.searchParams.get("withImage")).toBe("true");
    expect(enabledUrl.searchParams.get("category")).toBe("korean");
    expect(enabledUrl.searchParams.get("region")).toBe("seoul");
    expect(disabledUrl.searchParams.has("withImage")).toBe(false);
  });

  it.each(["latest", "likes", "views"] as const)(
    "keeps %s sorting in the paginated posts request",
    (sort) => {
      const url = new URL(buildPostsRequestUrl({
        pageParam: 2,
        sort,
        categorySlug: "",
        regionSlug: "",
        withImage: false,
      }), "http://localhost");

      expect(url.search).toBe(`?page=2&limit=10&sort=${sort}`);
    },
  );
});
