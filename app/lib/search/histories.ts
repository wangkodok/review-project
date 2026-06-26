import { createSupabaseServerClient } from "@/app/lib/supabase/server";
import { normalizeSearchKeyword } from "./service";

type SearchHistoryRow = {
  id: string;
  keyword: string;
  created_at: string;
  updated_at: string;
};

export async function getSearchHistories(userId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("search_histories")
    .select("id,keyword,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(5)
    .returns<SearchHistoryRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((history) => ({
    id: history.id,
    keyword: history.keyword,
    createdAt: history.created_at,
    updatedAt: history.updated_at,
  }));
}

export async function recordSearchHistory(userId: string, keyword: unknown) {
  const normalizedKeyword = normalizeSearchKeyword(keyword);

  if (!normalizedKeyword) {
    return { status: "invalid_keyword" as const };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("record_search_history", {
    p_user_id: userId,
    p_keyword: normalizedKeyword,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { status: "ok" as const };
}

export async function deleteSearchHistory(userId: string, historyId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("search_histories")
    .delete()
    .eq("id", historyId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new Error(error.message);
  }

  return data ? { status: "ok" as const } : { status: "not_found" as const };
}

export async function clearSearchHistories(userId: string) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("search_histories").delete().eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}
