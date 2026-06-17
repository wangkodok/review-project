import { createSupabaseServerClient } from "../supabase/server";

const VIEW_INTERVAL_MS = 24 * 60 * 60 * 1000;

type PostViewRow = {
  id: string;
  viewed_at: string;
};

export async function increaseViewCountIfNeeded({
  postId,
  userId,
  currentViewCount,
}: {
  postId: string;
  userId: string;
  currentViewCount: number;
}) {
  const supabase = createSupabaseServerClient();
  const now = new Date();

  const { data: view, error: viewError } = await supabase
    .from("post_views")
    .select("id,viewed_at")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle<PostViewRow>();

  if (viewError) {
    throw new Error(viewError.message);
  }

  if (view) {
    const viewedAt = new Date(view.viewed_at);

    if (now.getTime() - viewedAt.getTime() < VIEW_INTERVAL_MS) {
      return currentViewCount;
    }

    const nextViewCount = currentViewCount + 1;
    const { error: updateViewError } = await supabase
      .from("post_views")
      .update({ viewed_at: now.toISOString() })
      .eq("id", view.id);

    if (updateViewError) {
      throw new Error(updateViewError.message);
    }

    const { error: updatePostError } = await supabase
      .from("posts")
      .update({ view_count: nextViewCount })
      .eq("id", postId);

    if (updatePostError) {
      throw new Error(updatePostError.message);
    }

    return nextViewCount;
  }

  const nextViewCount = currentViewCount + 1;
  const { error: insertViewError } = await supabase.from("post_views").insert({
    post_id: postId,
    user_id: userId,
    viewed_at: now.toISOString(),
  });

  if (insertViewError) {
    throw new Error(insertViewError.message);
  }

  const { error: updatePostError } = await supabase
    .from("posts")
    .update({ view_count: nextViewCount })
    .eq("id", postId);

  if (updatePostError) {
    throw new Error(updatePostError.message);
  }

  return nextViewCount;
}
