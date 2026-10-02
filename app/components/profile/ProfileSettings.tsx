"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
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
    <section>
      <PageBackHeader title="프로필 설정" right={<span className="text-base font-medium text-neutral-300">저장</span>} />
      <div className="pt-11">
        <div className="mx-auto h-20 w-20 rounded-full bg-neutral-100" />
        <div className="mt-7">
          <div className="flex items-center justify-between">
            <div className="h-5 w-14 bg-neutral-100" />
            <div className="h-4 w-7 bg-neutral-100" />
          </div>
          <div className="mt-2 h-11 bg-neutral-100" />
          <div className="mt-2 h-4 w-48 bg-neutral-100" />
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
    <section>
      <PageBackHeader
        right={
          <button
            className={`text-base ${
              isSaveDisabled ? "text-neutral-300" : "text-neutral-950 active:text-neutral-500"
            }`}
            disabled={isSaveDisabled}
            form="profile-settings-form"
            type="submit"
          >
            <span className="font-medium">저장</span>
          </button>
        }
        title="프로필 설정"
      />

      <div className="pt-11">
        <div
          aria-label="기본 프로필 이미지"
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[#e5e5e5] bg-[#f0f0f0] text-[#777777]"
          role="img"
        >
          <UserRound aria-hidden="true" size={34} strokeWidth={1.25} />
        </div>

        <form className="mt-7" id="profile-settings-form" onSubmit={handleSubmit}>
          <div className="mb-2 flex items-center justify-between">
            <label
              className="text-base font-medium leading-5 text-[#121212]"
              htmlFor="nickname"
            >
              닉네임
            </label>
            <span className="text-sm font-normal leading-5 text-[#a1a1a1]">
              {nickname.length}/{NICKNAME_MAX_LENGTH}
            </span>
          </div>
          <input
            className="h-11 w-full border border-[#dbdbdb] bg-white px-3.5 text-base font-normal text-[#121212] outline-none placeholder:text-[#b0b0b0] disabled:bg-neutral-50 disabled:text-neutral-400"
            disabled={!user.canChangeNickname || isSubmitting}
            id="nickname"
            maxLength={NICKNAME_MAX_LENGTH}
            onChange={(event) => {
              setNickname(event.target.value);
              setMessage("");
            }}
            placeholder="닉네임을 입력해 주세요."
            value={nickname}
          />
          <p className="mt-2 text-xs font-normal leading-5 text-[#121212]">
            한글 또는 영문 2~6자 입력해 주세요.
          </p>
          {!user.canChangeNickname && user.nextNicknameChangeAt ? (
            <p className="mt-3 rounded-lg bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-950">
              닉네임은 {formatDateTime(user.nextNicknameChangeAt)} 이후 변경할 수 있습니다.
            </p>
          ) : null}
          {message ? (
            <p className="mt-3 rounded-lg bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-950">
              {message}
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}
