import { createSupabaseServerClient } from "../supabase/server";

type RecordPostViewRpcRow = {
  view_count: number;
};

export async function increaseViewCountIfNeeded({
  postId,
  userId,
}: {
  postId: string;
  userId: string;
}) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("record_post_view_atomic", {
    p_post_id: postId,
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const result = Array.isArray(data) ? (data[0] as RecordPostViewRpcRow | undefined) : undefined;

  if (!result) {
    throw new Error("Post not found while recording a view");
  }

  return result.view_count;
}
