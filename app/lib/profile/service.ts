import { createSupabaseServerClient } from "../supabase/server";
import type { AuthProvider } from "../auth/externalIdentity";

type UserRow = {
  id: string;
  email: string | null;
  nickname: string;
  anonymous_id: string;
  nickname_updated_at: string | null;
  nickname_change_count: number;
};

type AuthAccountRow = {
  provider_email: string | null;
};

type DeletedUserRow = {
  id: string;
};

type PostActivityRow = {
  like_count: number | null;
  view_count: number | null;
};

type UpdateNicknameParams = {
  userId: string;
  nickname: string;
  authProvider?: AuthProvider;
};

const NICKNAME_CHANGE_INTERVAL_DAYS = 30;

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getNicknameStatus(user: UserRow) {
  if (user.nickname_change_count === 0 || !user.nickname_updated_at) {
    return {
      canChangeNickname: true,
      nextNicknameChangeAt: null,
    };
  }

  const nextNicknameChangeAt = addDays(
    new Date(user.nickname_updated_at),
    NICKNAME_CHANGE_INTERVAL_DAYS,
  );
  const canChangeNickname = Date.now() >= nextNicknameChangeAt.getTime();

  return {
    canChangeNickname,
    nextNicknameChangeAt: canChangeNickname ? null : nextNicknameChangeAt.toISOString(),
  };
}

async function getActivitySummary(userId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error, count } = await supabase
    .from("posts")
    .select("like_count,view_count", { count: "exact" })
    .eq("user_id", userId)
    .returns<PostActivityRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return {
    totalLikes: data.reduce((sum, post) => sum + (post.like_count ?? 0), 0),
    totalViews: data.reduce((sum, post) => sum + (post.view_count ?? 0), 0),
    postCount: count ?? data.length,
  };
}

async function getProfileEmail(user: UserRow, authProvider?: AuthProvider) {
  if (!authProvider) {
    return user.email;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("auth_accounts")
    .select("provider_email")
    .eq("user_id", user.id)
    .eq("provider", authProvider)
    .maybeSingle<AuthAccountRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("External auth account not found for profile");
  }

  return data.provider_email;
}

async function toProfileUser(user: UserRow, authProvider?: AuthProvider) {
  const nicknameStatus = getNicknameStatus(user);
  const email = await getProfileEmail(user, authProvider);
  const activitySummary = await getActivitySummary(user.id);

  return {
    email,
    authProvider: authProvider ?? null,
    anonymousId: user.anonymous_id,
    nickname: user.nickname,
    nicknameUpdatedAt: user.nickname_updated_at,
    nicknameChangeCount: user.nickname_change_count,
    canChangeNickname: nicknameStatus.canChangeNickname,
    nextNicknameChangeAt: nicknameStatus.nextNicknameChangeAt,
    activitySummary,
  };
}

export function isValidNickname(nickname: string) {
  return /^[A-Za-z\uAC00-\uD7A3]{2,6}$/.test(nickname);
}

export async function getProfile(userId: string, authProvider?: AuthProvider) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("users")
    .select("id,email,nickname,anonymous_id,nickname_updated_at,nickname_change_count")
    .eq("id", userId)
    .single<UserRow>();

  if (error) {
    throw new Error(error.message);
  }

  return toProfileUser(data, authProvider);
}

export async function updateNickname({
  userId,
  nickname,
  authProvider,
}: UpdateNicknameParams) {
  const supabase = createSupabaseServerClient();
  const { data: status, error } = await supabase.rpc("update_nickname_atomic", {
    p_nickname: nickname,
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (status === "limited") {
    return {
      status: "limited" as const,
      user: await getProfile(userId, authProvider),
    };
  }

  if (status !== "ok") {
    throw new Error("User not found while updating nickname");
  }

  return {
    status: "ok" as const,
    user: await getProfile(userId, authProvider),
  };
}

export async function withdrawUser(userId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("users")
    .delete()
    .eq("id", userId)
    .select("id")
    .maybeSingle<DeletedUserRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("User not found while withdrawing");
  }
}
