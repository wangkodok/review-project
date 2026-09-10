import type { InfiniteData } from "@tanstack/react-query";
import type { PostsPage } from "@/app/types/post";

export const MY_POSTS_QUERY_KEY = ["my-posts"] as const;
const MY_POSTS_DELETE_NOTICE_KEY = "review-my-posts-delete-success";

export function markMyPostsDeleteSuccess() {
  window.sessionStorage.setItem(MY_POSTS_DELETE_NOTICE_KEY, "true");
}

export function consumeMyPostsDeleteSuccess() {
  const hasNotice = window.sessionStorage.getItem(MY_POSTS_DELETE_NOTICE_KEY) === "true";

  if (hasNotice) {
    window.sessionStorage.removeItem(MY_POSTS_DELETE_NOTICE_KEY);
  }

  return hasNotice;
}

export function removePostFromMyPostsData(
  data: InfiniteData<PostsPage, number> | undefined,
  postId: string,
) {
  if (!data || !data.pages.some((page) => page.posts.some((post) => post.id === postId))) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      posts: page.posts.filter((post) => post.id !== postId),
      totalCount: Math.max(0, page.totalCount - 1),
    })),
  };
}
