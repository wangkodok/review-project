import { createSupabaseServerClient } from "../supabase/server";

const ANONYMOUS_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export type AppUser = {
  id: string;
  email: string;
  nickname: string;
  anonymousId: string;
};

type UsersRow = {
  id: string;
  email: string;
  google_id: string;
  nickname: string;
  anonymous_id: string;
};

function generateAnonymousId() {
  let suffix = "";

  for (let index = 0; index < 6; index += 1) {
    suffix += ANONYMOUS_CHARS[Math.floor(Math.random() * ANONYMOUS_CHARS.length)];
  }

  return `익명${suffix}`;
}

function generateNickname(anonymousId: string) {
  return anonymousId.slice(0, 4);
}

function toAppUser(user: UsersRow): AppUser {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    anonymousId: user.anonymous_id,
  };
}

async function findUserByGoogleId(googleId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("users")
    .select("id,email,google_id,nickname,anonymous_id")
    .eq("google_id", googleId)
    .maybeSingle<UsersRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ? toAppUser(data) : null;
}

export async function findOrCreateUserByGoogle({
  googleId,
  email,
}: {
  googleId: string;
  email: string;
}) {
  const existingUser = await findUserByGoogleId(googleId);

  if (existingUser) {
    return existingUser;
  }

  const supabase = createSupabaseServerClient();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const anonymousId = generateAnonymousId();
    const nickname = generateNickname(anonymousId);

    const { data, error } = await supabase
      .from("users")
      .insert({
        google_id: googleId,
        email,
        anonymous_id: anonymousId,
        nickname,
      })
      .select("id,email,google_id,nickname,anonymous_id")
      .single<UsersRow>();

    if (!error && data) {
      return toAppUser(data);
    }

    if (error?.code === "23505") {
      const userAfterConflict = await findUserByGoogleId(googleId);

      if (userAfterConflict) {
        return userAfterConflict;
      }

      continue;
    }

    throw new Error(error?.message ?? "사용자 생성에 실패했습니다.");
  }

  throw new Error("익명 ID 생성에 실패했습니다.");
}
