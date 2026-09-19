import {
  BAD_REVIEW_OPTION_LABEL_MAP,
  GOOD_REVIEW_OPTION_LABEL_MAP,
} from "@/app/constants/reviewOptions";
import {
  type ReviewImageRelationRow,
  toPublicReviewImage,
} from "@/app/lib/reviewImages/publicUrl";
import { createSupabaseServerClient } from "../supabase/server";
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
  regionId?: string;
};

type GetMyPostsParams = {
  userId: string;
  page: number;
  limit: number;
};

type CreatePostParams = {
  userId: string;
  storeName: string;
  regionId: string;
  title: string;
  content: string;
  categoryId: string;
  menuName: string;
  goodPoints: string[];
  badPoints: string[];
  overallReview: string | null;
  imageId: string | null;
};

type UpdatePostParams = {
  postId: string;
  userId: string;
  storeName: string;
  regionId: string;
  title: string;
  content: string;
  categoryId: string;
  menuName: string;
  goodPoints: string[];
  badPoints: string[];
  overallReview: string | null;
  expectedUpdatedAt: string;
  imageAction: "keep" | "remove" | "replace";
  imageId: string | null;
};

type AtomicCreatePostRow = {
  result: string;
  post_id: string | null;
  updated_at: string | null;
};

type AtomicUpdatePostRow = AtomicCreatePostRow & {
  replaced_image_id: string | null;
};

type CreatePostFailureStatus =
  | "invalid_category"
  | "invalid_region"
  | "user_not_found"
  | "image_not_found"
  | "image_forbidden"
  | "image_invalid_state"
  | "image_expired";

type UpdatePostFailureStatus =
  | "not_found"
  | "forbidden"
  | "conflict"
  | "invalid_category"
  | "invalid_region"
  | "image_not_found"
  | "image_forbidden"
  | "image_invalid_state"
  | "image_expired";

type FailureResult<T extends string> = T extends T ? { status: T } : never;

type CreatePostResult =
  | { status: "ok"; post: { id: string } }
  | FailureResult<CreatePostFailureStatus>;

type UpdatePostResult =
  | { status: "ok"; post: { id: string; updatedAt: string } }
  | FailureResult<UpdatePostFailureStatus>;

type DeletePostParams = {
  postId: string;
  userId: string;
};

type PostRow = {
  id: string;
  user_id: string;
  category_id: string | null;
  region_id: string | null;
  store_name: string | null;
  title: string;
  content: string;
  menu_name: string | null;
  good_points: string[] | null;
  bad_points: string[] | null;
  overall_review: string | null;
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

type RegionRow = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
};

type RelatedRow<T> = T | T[] | null;

type PostWithRelationsRow = PostRow & {
  author: RelatedRow<Pick<UserRow, "anonymous_id">>;
  category: RelatedRow<CategoryRow>;
  region: RelatedRow<RegionRow>;
  image: RelatedRow<ReviewImageRelationRow>;
};

type PostForEditRow = Pick<
  PostRow,
  | "id"
  | "user_id"
  | "category_id"
  | "region_id"
  | "store_name"
  | "title"
  | "content"
  | "menu_name"
  | "good_points"
  | "bad_points"
  | "overall_review"
  | "updated_at"
> & {
  category: RelatedRow<CategoryRow>;
  region: RelatedRow<RegionRow>;
  image: RelatedRow<ReviewImageRelationRow>;
};

type PublicCategory = {
  id: string;
  name: string;
  slug: string;
};

type PublicRegion = {
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

function getFirstRpcRow<T>(data: unknown): T | null {
  return Array.isArray(data) && data.length > 0 ? (data[0] as T) : null;
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

function toPublicRegion(region: RelatedRow<RegionRow>): PublicRegion | null {
  const relatedRegion = getSingleRelatedRow(region);

  if (!relatedRegion) {
    return null;
  }

  return {
    id: relatedRegion.id,
    name: relatedRegion.name,
    slug: relatedRegion.slug,
  };
}

function requiresCategorySelection(category: RelatedRow<CategoryRow>) {
  return !getSingleRelatedRow(category)?.is_active;
}

function requiresRegionSelection(region: RelatedRow<RegionRow>) {
  return !getSingleRelatedRow(region)?.is_active;
}

const goodReviewOptionLabelMap = GOOD_REVIEW_OPTION_LABEL_MAP;
const badReviewOptionLabelMap = BAD_REVIEW_OPTION_LABEL_MAP;

function normalizeReviewOptionKeys(
  value: string[] | null,
  labelMap: Map<string, string>,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((key) => labelMap.has(key));
}

function toReviewOptionLabels(keys: string[], labelMap: Map<string, string>) {
  return keys.map((key) => labelMap.get(key)).filter((label): label is string => Boolean(label));
}

function toStructuredReviewFields(
  post: Pick<
    PostRow,
    "title" | "menu_name" | "good_points" | "bad_points" | "overall_review"
  >,
) {
  const goodPoints = normalizeReviewOptionKeys(post.good_points, goodReviewOptionLabelMap);
  const badPoints = normalizeReviewOptionKeys(post.bad_points, badReviewOptionLabelMap);

  return {
    menuName: post.menu_name?.trim() || post.title,
    goodPoints,
    badPoints,
    goodPointLabels: toReviewOptionLabels(goodPoints, goodReviewOptionLabelMap),
    badPointLabels: toReviewOptionLabels(badPoints, badReviewOptionLabelMap),
    overallReview: post.overall_review?.trim() || null,
  };
}

function sanitizeSearch(value: string) {
  return value
    .trim()
    .replace(/\\/g, "\\\\")
    .replace(/[%_]/g, "\\$&")
    .replace(/[,()]/g, "\\$&");
}

function buildPostSearchFilter(search: string) {
  const pattern = `%${sanitizeSearch(search)}%`;

  return [
    `store_name.ilike.${pattern}`,
    `menu_name.ilike.${pattern}`,
    `overall_review.ilike.${pattern}`,
  ].join(",");
}

export async function getPosts({
  page,
  limit,
  search,
  sort,
  currentUserId,
  categoryId,
  regionId,
}: GetPostsParams) {
  const supabase = createSupabaseServerClient();
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const normalizedSearch = search.trim();

  let query = supabase
    .from("posts")
    .select(
      "id,user_id,category_id,region_id,store_name,title,content,menu_name,good_points,bad_points,overall_review,view_count,like_count,created_at,updated_at,author:users!posts_user_id_fkey(anonymous_id),category:categories!posts_category_id_fkey(id,name,slug,is_active),region:regions!posts_region_id_fkey(id,name,slug,is_active),image:review_images!review_images_post_id_fkey(status,detail_object_key,thumbnail_object_key,width,height)",
      {
      count: "exact",
      },
    );

  if (normalizedSearch) {
    query = query.or(buildPostSearchFilter(normalizedSearch));
  }

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  if (regionId) {
    query = query.eq("region_id", regionId);
  }

  if (sort === "likes") {
    query = query.order("like_count", { ascending: false }).order("created_at", {
      ascending: false,
    }).order("id", { ascending: false });
  } else if (sort === "views") {
    query = query.order("view_count", { ascending: false }).order("created_at", {
      ascending: false,
    }).order("id", { ascending: false });
  } else {
    query = query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  const totalCount = count ?? 0;

  return {
    posts: ((data ?? []) as PostWithRelationsRow[]).map((post) => {
      const structuredReview = toStructuredReviewFields(post);

      return {
        id: post.id,
        title: post.title,
        content: post.content,
        storeName: post.store_name?.trim() || null,
        ...structuredReview,
        likeCount: post.like_count,
        viewCount: post.view_count,
        createdAt: post.created_at,
        category: toPublicCategory(post.category),
        region: toPublicRegion(post.region),
        image: toPublicReviewImage(post.image),
        author: {
          anonymousId: getSingleRelatedRow(post.author)?.anonymous_id ?? "",
        },
        isOwner: currentUserId === post.user_id,
        requiresCategorySelection: requiresCategorySelection(post.category),
        requiresRegionSelection: requiresRegionSelection(post.region),
        requiresReviewCompletion:
          !post.store_name?.trim() ||
          requiresCategorySelection(post.category) ||
          requiresRegionSelection(post.region),
      };
    }),
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
    .select(
      "id,user_id,category_id,region_id,store_name,title,content,menu_name,good_points,bad_points,overall_review,view_count,like_count,created_at,updated_at,author:users!posts_user_id_fkey(anonymous_id),category:categories!posts_category_id_fkey(id,name,slug,is_active),region:regions!posts_region_id_fkey(id,name,slug,is_active),image:review_images!review_images_post_id_fkey(status,detail_object_key,thumbnail_object_key,width,height)",
      {
        count: "exact",
      },
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  const totalCount = count ?? 0;

  return {
    posts: ((data ?? []) as PostWithRelationsRow[]).map((post) => {
      const structuredReviewFields = toStructuredReviewFields(post);

      return {
        id: post.id,
        title: post.title,
        content: post.content,
        storeName: post.store_name?.trim() || null,
        menuName: structuredReviewFields.menuName,
        goodPoints: structuredReviewFields.goodPoints,
        badPoints: structuredReviewFields.badPoints,
        goodPointLabels: structuredReviewFields.goodPointLabels,
        badPointLabels: structuredReviewFields.badPointLabels,
        overallReview: structuredReviewFields.overallReview,
        likeCount: post.like_count,
        viewCount: post.view_count,
        createdAt: post.created_at,
        category: toPublicCategory(post.category),
        region: toPublicRegion(post.region),
        image: toPublicReviewImage(post.image),
        author: {
          anonymousId: getSingleRelatedRow(post.author)?.anonymous_id ?? "",
        },
        isOwner: true,
        requiresCategorySelection: requiresCategorySelection(post.category),
        requiresRegionSelection: requiresRegionSelection(post.region),
        requiresReviewCompletion:
          !post.store_name?.trim() ||
          requiresCategorySelection(post.category) ||
          requiresRegionSelection(post.region),
      };
    }),
    page,
    limit,
    totalCount,
    hasMore: page * limit < totalCount,
  };
}

export async function createPost({
  userId,
  storeName,
  regionId,
  title,
  content,
  categoryId,
  menuName,
  goodPoints,
  badPoints,
  overallReview,
  imageId,
}: CreatePostParams): Promise<CreatePostResult> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc(
    "create_review_post_with_image_atomic",
    {
      p_user_id: userId,
      p_store_name: storeName,
      p_region_id: regionId,
      p_title: title,
      p_content: content,
      p_category_id: categoryId,
      p_menu_name: menuName,
      p_good_points: goodPoints,
      p_bad_points: badPoints,
      p_overall_review: overallReview,
      p_image_id: imageId,
    },
  );

  if (error) {
    throw new Error("Atomic review create failed");
  }

  const row = getFirstRpcRow<AtomicCreatePostRow>(data);

  if (!row) {
    throw new Error("Atomic review create returned no result");
  }

  if (row.result === "ok") {
    if (!row.post_id) {
      throw new Error("Atomic review create returned invalid data");
    }

    return { status: "ok" as const, post: { id: row.post_id } };
  }

  const failureStatuses = new Set<CreatePostFailureStatus>([
    "invalid_category",
    "invalid_region",
    "user_not_found",
    "image_not_found",
    "image_forbidden",
    "image_invalid_state",
    "image_expired",
  ]);

  if (failureStatuses.has(row.result as CreatePostFailureStatus)) {
    return { status: row.result as CreatePostFailureStatus };
  }

  throw new Error("Atomic review create returned an unknown result");
}

export async function getPostForEdit(postId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id,user_id,category_id,region_id,store_name,title,content,menu_name,good_points,bad_points,overall_review,updated_at,category:categories!posts_category_id_fkey(id,name,slug,is_active),region:regions!posts_region_id_fkey(id,name,slug,is_active),image:review_images!review_images_post_id_fkey(status,detail_object_key,thumbnail_object_key,width,height)",
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
    image: toPublicReviewImage(data.image),
    requiresCategorySelection: requiresCategorySelection(data.category),
    requiresRegionSelection: requiresRegionSelection(data.region),
  };
}

export async function updatePost({
  postId,
  userId,
  storeName,
  regionId,
  title,
  content,
  categoryId,
  menuName,
  goodPoints,
  badPoints,
  overallReview,
  expectedUpdatedAt,
  imageAction,
  imageId,
}: UpdatePostParams): Promise<UpdatePostResult> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc(
    "update_review_post_with_image_atomic",
    {
      p_post_id: postId,
      p_user_id: userId,
      p_expected_updated_at: expectedUpdatedAt,
      p_store_name: storeName,
      p_region_id: regionId,
      p_title: title,
      p_content: content,
      p_category_id: categoryId,
      p_menu_name: menuName,
      p_good_points: goodPoints,
      p_bad_points: badPoints,
      p_overall_review: overallReview,
      p_image_action: imageAction,
      p_image_id: imageId,
    },
  );

  if (error) {
    throw new Error("Atomic review update failed");
  }

  const row = getFirstRpcRow<AtomicUpdatePostRow>(data);

  if (!row) {
    throw new Error("Atomic review update returned no result");
  }

  if (row.result === "ok") {
    if (!row.post_id || !row.updated_at) {
      throw new Error("Atomic review update returned invalid data");
    }

    return {
      status: "ok" as const,
      post: { id: row.post_id, updatedAt: row.updated_at },
    };
  }

  const failureStatusMap: Record<string, UpdatePostFailureStatus | undefined> = {
    post_not_found: "not_found",
    forbidden: "forbidden",
    conflict: "conflict",
    invalid_category: "invalid_category",
    invalid_region: "invalid_region",
    image_not_found: "image_not_found",
    image_forbidden: "image_forbidden",
    image_invalid_state: "image_invalid_state",
    image_expired: "image_expired",
  };
  const status = failureStatusMap[row.result];

  if (status) {
    return { status };
  }

  throw new Error("Atomic review update returned an unknown result");
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
      "id,user_id,category_id,region_id,store_name,title,content,menu_name,good_points,bad_points,overall_review,view_count,like_count,created_at,updated_at,author:users!posts_user_id_fkey(anonymous_id),category:categories!posts_category_id_fkey(id,name,slug,is_active),region:regions!posts_region_id_fkey(id,name,slug,is_active),image:review_images!review_images_post_id_fkey(status,detail_object_key,thumbnail_object_key,width,height)",
    )
    .eq("id", postId)
    .maybeSingle<PostWithRelationsRow>();

  if (postError) {
    throw new Error(postError.message);
  }

  if (!post) {
    return null;
  }

  const viewCount = currentUserId
    ? await increaseViewCountIfNeeded({
        postId: post.id,
        userId: currentUserId,
      })
    : post.view_count;
  const isLiked = await getPostLikedByUser(post.id, currentUserId);

  return {
    id: post.id,
    title: post.title,
    content: post.content,
    storeName: post.store_name?.trim() || null,
    ...toStructuredReviewFields(post),
    viewCount,
    likeCount: post.like_count,
    createdAt: post.created_at,
    updatedAt: post.updated_at,
    category: toPublicCategory(post.category),
    region: toPublicRegion(post.region),
    image: toPublicReviewImage(post.image),
    author: {
      anonymousId: getSingleRelatedRow(post.author)?.anonymous_id ?? "",
    },
    isOwner: currentUserId === post.user_id,
    isLiked,
    requiresCategorySelection: requiresCategorySelection(post.category),
    requiresRegionSelection: requiresRegionSelection(post.region),
    requiresReviewCompletion:
      !post.store_name?.trim() ||
      requiresCategorySelection(post.category) ||
      requiresRegionSelection(post.region),
  };
}
