import { createSupabaseServerClient } from "../supabase/server";
import { getCategoryForWrite } from "../categories/service";
import { getPostLikedByUser } from "./likes";
import { increaseViewCountIfNeeded } from "./views";

type SortValue = "latest" | "likes" | "views";

type GetPostsParams = {
  page: number;
  limit: number;
  search: string;
  sort: SortValue;
  currentUserId?: string;
  categoryId?: string;
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
  categoryId: string;
};

type UpdatePostParams = {
  postId: string;
  userId: string;
  title: string;
  content: string;
  categoryId?: string;
};

type DeletePostParams = {
  postId: string;
  userId: string;
};

type PostRow = {
  id: string;
  user_id: string;
  category_id: string | null;
  title: string;
  content: string;
  view_count: number;
  like_count: number;
  created_at: string;
  updated_at: string;
};

type UserRow = {
  id: string;
  anonymous_id: string;
};

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
};

type RelatedRow<T> = T | T[] | null;

type PostWithRelationsRow = PostRow & {
  author: RelatedRow<Pick<UserRow, "anonymous_id">>;
  category: RelatedRow<CategoryRow>;
};

type PostForEditRow = Pick<PostRow, "id" | "user_id" | "category_id" | "title" | "content"> & {
  category: RelatedRow<CategoryRow>;
};

type PublicCategory = {
  id: string;
  name: string;
  slug: string;
};

function getSingleRelatedRow<T>(value: RelatedRow<T>): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function toPublicCategory(category: RelatedRow<CategoryRow>): PublicCategory | null {
  const relatedCategory = getSingleRelatedRow(category);

  if (!relatedCategory) {
    return null;
  }

  return {
    id: relatedCategory.id,
    name: relatedCategory.name,
    slug: relatedCategory.slug,
  };
}

function requiresCategorySelection(category: RelatedRow<CategoryRow>) {
  return !getSingleRelatedRow(category)?.is_active;
}

function sanitizeSearch(value: string) {
  return value
    .trim()
    .replace(/\\/g, "\\\\")
    .replace(/[%_]/g, "\\$&")
    .replace(/[,()]/g, "\\$&");
}

export async function getPosts({
  page,
  limit,
  search,
  sort,
  currentUserId,
  categoryId,
}: GetPostsParams) {
  const supabase = createSupabaseServerClient();
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const normalizedSearch = sanitizeSearch(search);

  let query = supabase
    .from("posts")
    .select(
      "id,user_id,category_id,title,content,view_count,like_count,created_at,updated_at,author:users!posts_user_id_fkey(anonymous_id),category:categories!posts_category_id_fkey(id,name,slug,is_active)",
      {
      count: "exact",
      },
    );

  if (normalizedSearch) {
    const pattern = `%${normalizedSearch}%`;
    query = query.or(`title.ilike.${pattern},content.ilike.${pattern}`);
  }

  if (categoryId) {
    query = query.eq("category_id", categoryId);
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
    posts: ((data ?? []) as PostWithRelationsRow[]).map((post) => ({
      id: post.id,
      title: post.title,
      content: post.content,
      likeCount: post.like_count,
      viewCount: post.view_count,
      createdAt: post.created_at,
      category: toPublicCategory(post.category),
      author: {
        anonymousId: getSingleRelatedRow(post.author)?.anonymous_id ?? "",
      },
      isOwner: currentUserId === post.user_id,
      requiresCategorySelection: requiresCategorySelection(post.category),
    })),
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
    posts: data ?? [],
    page,
    limit,
    totalCount,
    hasMore: page * limit < totalCount,
  };
}

export async function createPost({ userId, title, content, categoryId }: CreatePostParams) {
  const category = await getCategoryForWrite(categoryId);

  if (!category) {
    return { status: "invalid_category" as const };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("posts")
    .insert({
      user_id: userId,
      category_id: category.id,
      title,
      content,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    throw new Error(error.message);
  }

  return { status: "ok" as const, post: data };
}

export async function getPostForEdit(postId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id,user_id,category_id,title,content,category:categories!posts_category_id_fkey(id,name,slug,is_active)",
    )
    .eq("id", postId)
    .maybeSingle<PostForEditRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    ...data,
    requiresCategorySelection: requiresCategorySelection(data.category),
  };
}

export async function updatePost({ postId, userId, title, content, categoryId }: UpdatePostParams) {
  const supabase = createSupabaseServerClient();
  const existingPost = await getPostForEdit(postId);

  if (!existingPost) {
    return { status: "not_found" as const };
  }

  if (existingPost.user_id !== userId) {
    return { status: "forbidden" as const };
  }

  let nextCategoryId = existingPost.category_id;

  if (categoryId !== undefined) {
    const category = await getCategoryForWrite(categoryId);

    if (!category) {
      return { status: "invalid_category" as const };
    }

    nextCategoryId = category.id;
  } else if (requiresCategorySelection(existingPost.category)) {
    return { status: "invalid_category" as const };
  }

  const { data, error } = await supabase
    .from("posts")
    .update({
      category_id: nextCategoryId,
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
    .select(
      "id,user_id,category_id,title,content,view_count,like_count,created_at,updated_at,category:categories!posts_category_id_fkey(id,name,slug,is_active)",
    )
    .eq("id", postId)
    .maybeSingle<PostRow & { category: RelatedRow<CategoryRow> }>();

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
    category: toPublicCategory(post.category),
    author: {
      id: author.id,
      anonymousId: author.anonymous_id,
    },
    isOwner: currentUserId === post.user_id,
    isLiked,
    requiresCategorySelection: requiresCategorySelection(post.category),
  };
}
