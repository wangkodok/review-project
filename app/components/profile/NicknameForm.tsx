"use client";

import { FormEvent, useState } from "react";

type NicknameFormProps = {
  currentNickname: string;
  canChangeNickname: boolean;
  nextNicknameChangeAt: string | null;
  onNicknameUpdated: (nickname: string) => Promise<void>;
};

const NICKNAME_MAX_LENGTH = 6;

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

export default function NicknameForm({
  currentNickname,
  canChangeNickname,
  nextNicknameChangeAt,
  onNicknameUpdated,
}: NicknameFormProps) {
  const [nickname, setNickname] = useState(currentNickname);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const trimmedNickname = nickname.trim();
  const isValidNickname = /^[A-Za-z가-힣]{2,6}$/.test(trimmedNickname);
  const isChanged = trimmedNickname !== currentNickname;
  const isButtonDisabled =
    !canChangeNickname || !isValidNickname || !isChanged || isSubmitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isButtonDisabled) {
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      await onNicknameUpdated(trimmedNickname);
      setMessage("닉네임이 변경되었습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "닉네임 변경에 실패했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium text-neutral-500" htmlFor="nickname">
          닉네임 변경
        </label>
        <input
          className="h-12 w-full rounded-lg border border-neutral-200 bg-white px-4 text-base text-neutral-950 outline-none placeholder:text-neutral-400 focus:border-neutral-950 disabled:bg-neutral-50 disabled:text-neutral-400"
          disabled={!canChangeNickname || isSubmitting}
          id="nickname"
          maxLength={NICKNAME_MAX_LENGTH}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="새 닉네임"
          value={nickname}
        />
        <div className="flex items-center justify-between text-xs font-medium text-neutral-400">
          <span>한글 또는 영문 2~6자</span>
          <span>
            {nickname.length} / {NICKNAME_MAX_LENGTH}
          </span>
        </div>
      </div>

      {!canChangeNickname && nextNicknameChangeAt ? (
        <p className="rounded-lg bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-950">
          닉네임은 {formatDateTime(nextNicknameChangeAt)} 이후 변경할 수 있습니다.
        </p>
      ) : null}

      {message ? (
        <p className="rounded-lg bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-950">
          {message}
        </p>
      ) : null}

      <button
        className={`h-12 w-full rounded-lg text-base font-semibold text-white ${
          isButtonDisabled ? "bg-neutral-300" : "bg-neutral-950 active:bg-neutral-800"
        }`}
        disabled={isButtonDisabled}
        type="submit"
      >
        닉네임 변경
      </button>
    </form>
  );
}
