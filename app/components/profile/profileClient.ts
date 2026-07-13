export type ActivitySummary = {
  totalLikes: number;
  totalViews: number;
  postCount: number;
};

export type ProfileUser = {
  id: string;
  email: string;
  anonymousId: string;
  nickname: string;
  nicknameUpdatedAt: string | null;
  nicknameChangeCount: number;
  canChangeNickname: boolean;
  nextNicknameChangeAt: string | null;
  activitySummary: ActivitySummary;
};

export type ProfileResponse = {
  success: boolean;
  data: {
    user: ProfileUser;
  } | null;
  message: string;
  code?: string;
};

export const PROFILE_QUERY_KEY = ["profile"] as const;

export async function fetchProfile() {
  const response = await fetch("/api/profile");
  const result = (await response.json()) as ProfileResponse;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.message || "내 정보를 불러오지 못했습니다.");
  }

  return result.data.user;
}

export async function patchNickname(nickname: string) {
  const response = await fetch("/api/profile", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ nickname }),
  });
  const result = (await response.json()) as ProfileResponse;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.message || "닉네임 변경에 실패했습니다.");
  }

  return result.data.user;
}
