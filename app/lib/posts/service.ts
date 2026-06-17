import { createSupabaseServerClient } from "../supabase/server";
import { getPostLikedByUser } from "./likes";
import { increaseViewCountIfNeeded } from "./views";

type SortValue = "latest" | "likes" | "views";

type GetPostsParams = {
  page: number;
  limit: number;
  search: string;
  sort: SortValue;
};

type GetMyPostsParams = {
  userId: string;
  page: number;
  limit: number;
};

type CreatePostParams = {
  userId: string;
  title: string;
  content: string;
};

type UpdatePostParams = {
  postId: string;
  userId: string;
  title: string;
  content: string;
};

type DeletePostParams = {
  postId: string;
  userId: string;
};

type PostRow = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  view_count: number;
  like_count: number;
  created_at: string;
  updated_at: string;
};

type PostListRow = Omit<PostRow, "user_id">;

type UserRow = {
  id: string;
  anonymous_id: string;
};

function sanitizeSearch(value: string) {
  return value.replace(/[,%()]/g, " ").trim();
}

export async function getPosts({ page, limit, search, sort }: GetPostsParams) {
  const supabase = createSupabaseServerClient();
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const normalizedSearch = sanitizeSearch(search);

  let query = supabase
    .from("posts")
    .select("id,title,content,view_count,like_count,created_at,updated_at", {
      count: "exact",
    });

  if (normalizedSearch) {
    const pattern = `%${normalizedSearch}%`;
    query = query.or(`title.ilike.${pattern},content.ilike.${pattern}`);
  }

  if (sort === "likes") {
    query = query.order("like_count", { ascending: false }).order("created_at", {
      ascending: false,
    });
  } else if (sort === "views") {
    query = query.order("view_count", { ascending: false }).order("created_at", {
      ascending: false,
    });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  const totalCount = count ?? 0;

  return {
    posts: (data ?? []) as PostListRow[],
    page,
    limit,
    totalCount,
    hasMore: page * limit < totalCount,
  };
}

export async function getMyPosts({ userId, page, limit }: GetMyPostsParams) {
  const supabase = createSupabaseServerClient();
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabase
    .from("posts")
    .select("id,title,content,view_count,like_count,created_at,updated_at", {
      count: "exact",
    })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  const totalCount = count ?? 0;

  return {
    posts: (data ?? []) as PostListRow[],
    page,
    limit,
    totalCount,
    hasMore: page * limit < totalCount,
  };
}

export async function createPost({ userId, title, content }: CreatePostParams) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("posts")
    .insert({
      user_id: userId,
      title,
      content,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getPostForEdit(postId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("posts")
    .select("id,user_id,title,content")
    .eq("id", postId)
    .maybeSingle<Pick<PostRow, "id" | "user_id" | "title" | "content">>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updatePost({ postId, userId, title, content }: UpdatePostParams) {
  const supabase = createSupabaseServerClient();
  const existingPost = await getPostForEdit(postId);

  if (!existingPost) {
    return { status: "not_found" as const };
  }

  if (existingPost.user_id !== userId) {
    return { status: "forbidden" as const };
  }

  const { data, error } = await supabase
    .from("posts")
    .update({
      title,
      content,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId)
    .eq("user_id", userId)
    .select("id")
    .single<{ id: string }>();

  if (error) {
    throw new Error(error.message);
  }

  return { status: "ok" as const, post: data };
}

export async function deletePost({ postId, userId }: DeletePostParams) {
  const supabase = createSupabaseServerClient();
  const existingPost = await getPostForEdit(postId);

  if (!existingPost) {
    return { status: "not_found" as const };
  }

  if (existingPost.user_id !== userId) {
    return { status: "forbidden" as const };
  }

  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  return { status: "ok" as const };
}

export async function getPostDetail(postId: string, currentUserId?: string) {
  const supabase = createSupabaseServerClient();

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id,user_id,title,content,view_count,like_count,created_at,updated_at")
    .eq("id", postId)
    .maybeSingle<PostRow>();

  if (postError) {
    throw new Error(postError.message);
  }

  if (!post) {
    return null;
  }

  const { data: author, error: authorError } = await supabase
    .from("users")
    .select("id,anonymous_id")
    .eq("id", post.user_id)
    .single<UserRow>();

  if (authorError) {
    throw new Error(authorError.message);
  }

  const viewCount = currentUserId
    ? await increaseViewCountIfNeeded({
        postId: post.id,
        userId: currentUserId,
        currentViewCount: post.view_count,
      })
    : post.view_count;
  const isLiked = await getPostLikedByUser(post.id, currentUserId);

  return {
    id: post.id,
    title: post.title,
    content: post.content,
    viewCount,
    likeCount: post.like_count,
    createdAt: post.created_at,
    updatedAt: post.updated_at,
    author: {
      id: author.id,
      anonymousId: author.anonymous_id,
    },
    isOwner: currentUserId === post.user_id,
    isLiked,
  };
}
