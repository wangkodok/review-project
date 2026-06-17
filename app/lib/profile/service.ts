import { createSupabaseServerClient } from "../supabase/server";

type UserRow = {
  id: string;
  email: string;
  nickname: string;
  anonymous_id: string;
  nickname_updated_at: string | null;
  nickname_change_count: number;
};

type UpdateNicknameParams = {
  userId: string;
  nickname: string;
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

function toProfileUser(user: UserRow) {
  const nicknameStatus = getNicknameStatus(user);

  return {
    id: user.id,
    email: user.email,
    anonymousId: user.anonymous_id,
    nickname: user.nickname,
    nicknameUpdatedAt: user.nickname_updated_at,
    nicknameChangeCount: user.nickname_change_count,
    canChangeNickname: nicknameStatus.canChangeNickname,
    nextNicknameChangeAt: nicknameStatus.nextNicknameChangeAt,
  };
}

export function isValidNickname(nickname: string) {
  return /^[A-Za-z\uAC00-\uD7A3]{2,6}$/.test(nickname);
}

export async function getProfile(userId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("users")
    .select("id,email,nickname,anonymous_id,nickname_updated_at,nickname_change_count")
    .eq("id", userId)
    .single<UserRow>();

  if (error) {
    throw new Error(error.message);
  }

  return toProfileUser(data);
}

export async function updateNickname({ userId, nickname }: UpdateNicknameParams) {
  const currentProfile = await getProfile(userId);

  if (!currentProfile.canChangeNickname) {
    return {
      status: "limited" as const,
      user: currentProfile,
    };
  }

  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("users")
    .update({
      nickname,
      nickname_updated_at: now,
      nickname_change_count: currentProfile.nicknameChangeCount + 1,
      updated_at: now,
    })
    .eq("id", userId)
    .select("id,email,nickname,anonymous_id,nickname_updated_at,nickname_change_count")
    .single<UserRow>();

  if (error) {
    throw new Error(error.message);
  }

  return {
    status: "ok" as const,
    user: toProfileUser(data),
  };
}

export async function withdrawUser(userId: string) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("users").delete().eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }
}
