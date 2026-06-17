import { createSupabaseServerClient } from "../supabase/server";

type PostLikeState = {
  liked: boolean;
  likeCount: number;
};

type PostLikeRow = {
  user_id: string;
  post_id: string;
};

type PostLikeCountRow = {
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

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("like_count")
    .eq("id", postId)
    .maybeSingle<PostLikeCountRow>();

  if (postError) {
    throw new Error(postError.message);
  }

  if (!post) {
    return null;
  }

  const { data: like, error: likeError } = await supabase
    .from("likes")
    .select("user_id,post_id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle<PostLikeRow>();

  if (likeError) {
    throw new Error(likeError.message);
  }

  if (like) {
    const nextLikeCount = Math.max(0, post.like_count - 1);
    const { error: deleteError } = await supabase
      .from("likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    const { data: updatedPost, error: updateError } = await supabase
      .from("posts")
      .update({ like_count: nextLikeCount })
      .eq("id", postId)
      .select("like_count")
      .single<PostLikeCountRow>();

    if (updateError) {
      throw new Error(updateError.message);
    }

    return {
      liked: false,
      likeCount: updatedPost.like_count,
    };
  }

  const nextLikeCount = post.like_count + 1;
  const { error: insertError } = await supabase.from("likes").insert({
    post_id: postId,
    user_id: userId,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }

  const { data: updatedPost, error: updateError } = await supabase
    .from("posts")
    .update({ like_count: nextLikeCount })
    .eq("id", postId)
    .select("like_count")
    .single<PostLikeCountRow>();

  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    liked: true,
    likeCount: updatedPost.like_count,
  };
}
