"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Info, Pen, UserRound } from "lucide-react";
import Link from "next/link";
import LogoutButton from "../auth/LogoutButton";
import WithdrawButton from "./WithdrawButton";
import { fetchProfile, PROFILE_QUERY_KEY } from "./profileClient";

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-neutral-100" />
          <div className="space-y-2">
            <div className="h-5 w-24 rounded bg-neutral-100" />
            <div className="h-4 w-16 rounded bg-neutral-100" />
          </div>
        </div>
        <div className="h-5 w-20 rounded bg-neutral-100" />
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <div className="h-20 rounded-lg bg-neutral-100" />
        <div className="h-20 rounded-lg bg-neutral-100" />
        <div className="h-20 rounded-lg bg-neutral-100" />
      </div>
      <div className="-mx-5 space-y-0 border-y border-neutral-200">
        <div className="h-14 bg-neutral-50" />
        <div className="h-14 border-t border-neutral-200 bg-neutral-50" />
        <div className="h-14 border-t border-neutral-200 bg-neutral-50" />
      </div>
    </div>
  );
}

function ActivityCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-h-20 flex-col items-center justify-center rounded-lg bg-neutral-100 px-2 text-center">
      <strong className="text-xl font-bold leading-7 text-neutral-950">{value}</strong>
      <span className="mt-1 text-sm font-semibold text-neutral-700">{label}</span>
    </div>
  );
}

export default function ProfileInfo() {
  const query = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: fetchProfile,
  });

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
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
            <UserRound aria-hidden="true" size={23} strokeWidth={1.7} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-neutral-950">
              {user.anonymousId}
            </h2>
            <p className="mt-0.5 truncate text-sm font-medium text-neutral-500">
              {user.nickname}
            </p>
          </div>
        </div>

        <Link
          className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-neutral-950 active:text-neutral-500"
          href="/my/profile"
        >
          프로필 설정
          <ChevronRight aria-hidden="true" size={18} strokeWidth={1.8} />
        </Link>
      </div>

      <div>
        <div className="grid grid-cols-3 gap-1.5">
          <ActivityCard label="좋아요" value={user.activitySummary.totalLikes} />
          <ActivityCard label="조회 수" value={user.activitySummary.totalViews} />
          <ActivityCard label="작성 수" value={user.activitySummary.postCount} />
        </div>
        <p className="mt-2 flex items-center gap-1 text-xs font-medium text-neutral-400">
          <Info aria-hidden="true" size={13} />
          리뷰 활동 총 합산 내역입니다.
        </p>
      </div>

      <div className="-mx-5 border-y border-neutral-200">
        <Link
          className="flex h-14 items-center justify-between px-5 text-neutral-950 active:bg-neutral-50"
          href="/my/posts"
        >
          <span className="flex items-center gap-3 text-base font-semibold">
            <Pen aria-hidden="true" size={22} strokeWidth={1.7} />
            작성한 게시 글
          </span>
          <ChevronRight aria-hidden="true" size={21} strokeWidth={1.7} />
        </Link>
        <LogoutButton />
        <WithdrawButton />
      </div>
    </section>
  );
}
