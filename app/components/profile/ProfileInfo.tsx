"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import LogoutButton from "../auth/LogoutButton";
import NicknameForm from "./NicknameForm";
import WithdrawButton from "./WithdrawButton";

type ProfileUser = {
  id: string;
  email: string;
  anonymousId: string;
  nickname: string;
  nicknameUpdatedAt: string | null;
  nicknameChangeCount: number;
  canChangeNickname: boolean;
  nextNicknameChangeAt: string | null;
};

type ProfileResponse = {
  success: boolean;
  data: {
    user: ProfileUser;
  } | null;
  message: string;
  code?: string;
};

async function fetchProfile() {
  const response = await fetch("/api/profile");
  const result = (await response.json()) as ProfileResponse;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.message || "내 정보를 불러오지 못했습니다.");
  }

  return result.data.user;
}

async function patchNickname(nickname: string) {
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

function ProfileSkeleton() {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="h-6 w-24 rounded bg-neutral-100" />
        <div className="mt-5 space-y-4">
          <div className="h-10 rounded bg-neutral-100" />
          <div className="h-10 rounded bg-neutral-100" />
          <div className="h-10 rounded bg-neutral-100" />
        </div>
      </div>
    </div>
  );
}

export default function ProfileInfo() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile,
  });

  async function handleNicknameUpdated(nickname: string) {
    const updatedUser = await patchNickname(nickname);
    queryClient.setQueryData(["profile"], updatedUser);
  }

  if (query.isLoading) {
    return <ProfileSkeleton />;
  }

  if (query.isError || !query.data) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center">
        <p className="text-sm font-semibold text-neutral-950">
          내 정보를 불러오지 못했습니다.
        </p>
        <button
          className="mt-4 h-10 rounded-lg bg-neutral-950 px-4 text-sm font-semibold text-white"
          onClick={() => query.refetch()}
          type="button"
        >
          다시 시도
        </button>
      </div>
    );
  }

  const user = query.data;

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-neutral-950">내 정보</h2>
        <dl className="mt-5 space-y-4">
          <div>
            <dt className="text-sm font-medium text-neutral-500">익명ID</dt>
            <dd className="mt-1 break-all text-base font-semibold text-neutral-950">
              {user.anonymousId}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-neutral-500">Google 이메일</dt>
            <dd className="mt-1 break-all text-base font-semibold text-neutral-950">
              {user.email}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-neutral-500">닉네임</dt>
            <dd className="mt-1 break-all text-base font-semibold text-neutral-950">
              {user.nickname}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <NicknameForm
          canChangeNickname={user.canChangeNickname}
          currentNickname={user.nickname}
          nextNicknameChangeAt={user.nextNicknameChangeAt}
          onNicknameUpdated={handleNicknameUpdated}
        />
      </div>

      <Link
        className="flex h-12 w-full items-center justify-center rounded-lg border border-neutral-200 bg-white px-4 text-base font-semibold text-neutral-950 active:bg-neutral-100"
        href="/my/posts"
      >
        내가 작성한 게시글
      </Link>

      <LogoutButton />

      <WithdrawButton />
    </section>
  );
}
