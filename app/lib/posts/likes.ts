import { createSupabaseServerClient } from "../supabase/server";

type PostLikeState = {
  liked: boolean;
  likeCount: number;
};

type PostLikeRow = {
  user_id: string;
  post_id: string;
};

type TogglePostLikeRpcRow = {
  liked: boolean;
  like_count: number;
};

export async function getPostLikedByUser(postId: string, userId?: string) {
  if (!userId) {
    return false;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("likes")
    .select("user_id,post_id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle<PostLikeRow>();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function togglePostLike({
  postId,
  userId,
}: {
  postId: string;
  userId: string;
}): Promise<PostLikeState | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("toggle_post_like_atomic", {
    p_post_id: postId,
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const result = Array.isArray(data) ? (data[0] as TogglePostLikeRpcRow | undefined) : undefined;

  return result
    ? {
        liked: result.liked,
        likeCount: result.like_count,
      }
    : null;
}
