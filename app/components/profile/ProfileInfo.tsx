"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  IdCard,
  Info,
  PenLine,
  ScrollText,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import LogoutButton from "../auth/LogoutButton";
import WithdrawButton from "./WithdrawButton";
import {
  fetchProfile,
  formatActivityCount,
  PROFILE_QUERY_KEY,
} from "./profileClient";

function ProfileSkeleton() {
  return (
    <div className="-mx-5 -mt-5 bg-white">
      <div className="review-list-skeleton px-4 pb-[18px] pt-3">
        <div className="flex min-h-[52px] items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-[#e4e4e4]" />
            <div className="space-y-2">
              <div className="h-5 w-24 bg-[#e4e4e4]" />
              <div className="h-4 w-16 bg-[#e4e4e4]" />
            </div>
          </div>
          <div className="h-5 w-20 bg-[#e4e4e4]" />
        </div>
        <div className="mt-7 grid grid-cols-3 gap-1.5">
          <div className="h-20 rounded-lg bg-[#e4e4e4]" />
          <div className="h-20 rounded-lg bg-[#e4e4e4]" />
          <div className="h-20 rounded-lg bg-[#e4e4e4]" />
        </div>
        <div className="mt-2 h-[18px] w-44 bg-[#e4e4e4]" />
      </div>
      <div className="review-list-skeleton border-t border-[#dbdbdb]">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            className="h-14 border-b border-[#dbdbdb] bg-[#eeeeee]"
            key={index}
          />
        ))}
      </div>
    </div>
  );
}

function ActivityCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-h-20 min-w-0 flex-col items-center justify-center rounded-lg bg-[#f5f5f5] px-2 text-center">
      <strong className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xl font-bold leading-7 text-[#0a0a0a] tabular-nums">
        {formatActivityCount(value)}
      </strong>
      <span className="mt-1 text-sm font-semibold leading-5 text-[#404040]">{label}</span>
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
    <section className="-mx-5 -mt-5 bg-white">
      <div className="px-4 pb-[18px] pt-3">
        <div className="flex min-h-[52px] items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              aria-label="서비스 기본 프로필"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#e5e5e5] bg-[#f0f0f0] text-[#777777]"
              role="img"
            >
              <UserRound aria-hidden="true" size={25} strokeWidth={1.45} />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-medium leading-[23px] text-[#121212]">
                {user.anonymousId}
              </h2>
              <p className="mt-px truncate text-xs font-normal leading-[18px] text-[#777777]">
                {user.nickname}
              </p>
            </div>
          </div>

          <Link
            className="inline-flex min-h-12 shrink-0 items-center justify-end gap-1 pl-2.5 text-[15px] font-semibold leading-[22px] text-[#121212] active:text-[#777777]"
            href="/my/profile"
          >
            프로필 설정
            <ChevronRight aria-hidden="true" size={18} strokeWidth={1.5} />
          </Link>
        </div>

        <div className="mt-7">
          <div aria-label="리뷰 활동 합계" className="grid grid-cols-3 gap-1.5">
            <ActivityCard label="좋아요" value={user.activitySummary.totalLikes} />
            <ActivityCard label="조회 수" value={user.activitySummary.totalViews} />
            <ActivityCard label="작성 수" value={user.activitySummary.postCount} />
          </div>
          <p className="mt-2 flex items-center gap-1 text-xs font-medium leading-[18px] text-[#a1a1a1]">
            <Info aria-hidden="true" size={13} strokeWidth={1.5} />
            리뷰 활동 총 합산 내역입니다.
          </p>
        </div>
      </div>

      <div aria-label="내 정보 메뉴" className="border-t border-[#dbdbdb]">
        <Link
          className="flex h-14 items-center justify-between border-b border-[#dbdbdb] px-4 text-[#121212] active:bg-[#f7f7f7]"
          href="/my/posts"
        >
          <span className="flex min-w-0 items-center gap-[11px] text-base font-medium leading-6">
            <PenLine aria-hidden="true" size={21} strokeWidth={1.7} />
            내가 작성한 리뷰
          </span>
          <ChevronRight aria-hidden="true" size={19} strokeWidth={1.45} />
        </Link>
        <LogoutButton />
        <WithdrawButton />
        <button
          aria-disabled="true"
          className="flex h-14 w-full items-center justify-between border-b border-[#dbdbdb] px-4 text-left text-[#121212]"
          disabled
          type="button"
        >
          <span className="flex min-w-0 items-center gap-[11px] text-base font-medium leading-6">
            <ScrollText aria-hidden="true" size={21} strokeWidth={1.7} />
            서비스 이용약관
          </span>
          <ChevronRight aria-hidden="true" size={19} strokeWidth={1.45} />
        </button>
        <Link
          className="flex h-14 items-center justify-between border-b border-[#dbdbdb] px-4 text-[#121212] active:bg-[#f7f7f7]"
          href="/privacy"
        >
          <span className="flex min-w-0 items-center gap-[11px] text-base font-medium leading-6">
            <IdCard aria-hidden="true" size={21} strokeWidth={1.7} />
            개인정보처리방침
          </span>
          <ChevronRight aria-hidden="true" size={19} strokeWidth={1.45} />
        </Link>
      </div>
    </section>
  );
}
