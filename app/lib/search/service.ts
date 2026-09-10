import { getPosts } from "@/app/lib/posts/service";

const SEARCH_KEYWORD_MIN_LENGTH = 1;
const SEARCH_KEYWORD_MAX_LENGTH = 30;

export function normalizeSearchKeyword(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const keyword = value.trim().toLowerCase();

  if (
    keyword.length < SEARCH_KEYWORD_MIN_LENGTH ||
    keyword.length > SEARCH_KEYWORD_MAX_LENGTH
  ) {
    return null;
  }

  return keyword;
}

export async function searchPosts({
  keyword,
  page,
  limit,
  currentUserId,
  sort,
  categoryId,
  regionId,
}: {
  keyword: string;
  page: number;
  limit: number;
  currentUserId?: string;
  sort: "latest" | "likes" | "views";
  categoryId?: string;
  regionId?: string;
}) {
  return getPosts({
    page,
    limit,
    search: keyword,
    sort,
    currentUserId,
    categoryId,
    regionId,
  });
}
