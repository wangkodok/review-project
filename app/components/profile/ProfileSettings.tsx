"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { FormEvent, useState } from "react";
import PageBackHeader from "../common/PageBackHeader";
import {
  fetchProfile,
  patchNickname,
  PROFILE_QUERY_KEY,
  type ProfileUser,
} from "./profileClient";

const NICKNAME_MAX_LENGTH = 6;

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function ProfileSettingsSkeleton() {
  return (
    <section className="space-y-8">
      <PageBackHeader title="프로필 설정" right={<span className="text-base font-semibold text-neutral-300">저장</span>} />
      <div className="space-y-7">
        <div>
          <div className="h-4 w-10 rounded bg-neutral-100" />
          <div className="mt-3 h-5 w-44 rounded bg-neutral-100" />
        </div>
        <div>
          <div className="h-4 w-14 rounded bg-neutral-100" />
          <div className="mt-3 h-5 w-28 rounded bg-neutral-100" />
        </div>
        <div>
          <div className="h-4 w-16 rounded bg-neutral-100" />
          <div className="mt-3 h-11 rounded bg-neutral-100" />
          <div className="mt-2 h-4 w-48 rounded bg-neutral-100" />
        </div>
      </div>
    </section>
  );
}

export default function ProfileSettings() {
  const query = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: fetchProfile,
  });

  if (query.isLoading) {
    return <ProfileSettingsSkeleton />;
  }

  if (query.isError || !query.data) {
    return (
      <section className="space-y-5">
        <PageBackHeader title="프로필 설정" />
        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center">
          <p className="text-sm font-semibold text-neutral-950">
            프로필 정보를 불러오지 못했습니다.
          </p>
          <button
            className="mt-4 h-10 rounded-lg bg-neutral-950 px-4 text-sm font-semibold text-white"
            onClick={() => query.refetch()}
            type="button"
          >
            다시 시도
          </button>
        </div>
      </section>
    );
  }

  return <ProfileSettingsForm user={query.data} />;
}

function ProfileSettingsForm({ user }: { user: ProfileUser }) {
  const queryClient = useQueryClient();
  const [nickname, setNickname] = useState(user.nickname);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const trimmedNickname = nickname.trim();
  const isValidNickname = /^[A-Za-z가-힣]{2,6}$/.test(trimmedNickname);
  const isChanged = trimmedNickname !== user.nickname;
  const isSaveDisabled =
    !user.canChangeNickname || !isValidNickname || !isChanged || isSubmitting;

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (isSaveDisabled) {
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const updatedUser = await patchNickname(trimmedNickname);
      queryClient.setQueryData(PROFILE_QUERY_KEY, updatedUser);
      setNickname(updatedUser.nickname);
      setMessage("닉네임이 변경되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "닉네임 변경에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-5">
      <PageBackHeader
        right={
          <button
            className={`text-base font-semibold ${
              isSaveDisabled ? "text-neutral-300" : "text-neutral-950 active:text-neutral-500"
            }`}
            disabled={isSaveDisabled}
            form="profile-settings-form"
            type="submit"
          >
            저장
          </button>
        }
        title="프로필 설정"
      />

      <form className="space-y-8" id="profile-settings-form" onSubmit={handleSubmit}>
        <div>
          <p className="text-sm font-semibold text-neutral-400">이메일</p>
          <p className="mt-2 break-all text-base font-bold text-neutral-950">
            {user.email}
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-neutral-400">익명 ID</p>
          <p className="mt-2 break-all text-base font-bold text-neutral-950">
            {user.anonymousId}
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-neutral-400" htmlFor="nickname">
            닉네임(필수)
          </label>
          <input
            className="h-11 w-full border border-neutral-950 bg-white px-3 text-base font-semibold text-neutral-950 outline-none placeholder:text-neutral-400 disabled:border-neutral-200 disabled:bg-neutral-50 disabled:text-neutral-400"
            disabled={!user.canChangeNickname || isSubmitting}
            id="nickname"
            maxLength={NICKNAME_MAX_LENGTH}
            onChange={(event) => {
              setNickname(event.target.value);
              setMessage("");
            }}
            value={nickname}
          />
          <p className="text-sm font-medium text-neutral-950">
            한글 또는 영문 2~6자 입력해 주세요.
          </p>
          {!user.canChangeNickname && user.nextNicknameChangeAt ? (
            <p className="rounded-lg bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-950">
              닉네임은 {formatDateTime(user.nextNicknameChangeAt)} 이후 변경할 수 있습니다.
            </p>
          ) : null}
          {message ? (
            <p className="rounded-lg bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-950">
              {message}
            </p>
          ) : null}
        </div>

        <div className="space-y-3 pt-3 text-sm leading-6 text-neutral-500">
          <div className="flex items-center gap-1.5">
            <Info aria-hidden="true" size={15} />
            <p className="font-semibold">확인해 주세요.</p>
          </div>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              로그인을 통해 안전하게 연동된 이메일과 익명 ID는 시스템 보안 및 데이터
              무결성을 위한 고유 식별 정보로 사용되며 로그인 후에는 변경할 수 없습니다.
            </li>
            <li>
              정보 변경이 꼭 필요한 경우 기존 계정 탈퇴 후 새롭게 재가입해 주세요.
            </li>
            <li>
              닉네임 수정 및 변경 시 30일 이후에 다시 변경을 하실 수 있습니다.
            </li>
          </ul>
        </div>
      </form>
    </section>
  );
}
