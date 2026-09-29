"use client";

import { Check, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import WithdrawalPageHeader from "./WithdrawalPageHeader";

export default function WithdrawalCompleteView({
  showGoogleManualUnlinkNotice = false,
}: {
  showGoogleManualUnlinkNotice?: boolean;
}) {
  const router = useRouter();

  return (
    <section className="-mx-5 -mb-24 -mt-5 flex min-h-dvh flex-col bg-white">
      <WithdrawalPageHeader backHref="/" title="완료" />

      <div className="border-b border-[#dbdbdb] px-4 pb-12 pt-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#121212] text-white">
          <Check aria-hidden="true" size={39} strokeWidth={2.1} />
        </div>
        <h2 className="mt-4 text-[18px] font-medium leading-7 text-[#303030]">
          회원 탈퇴가 완료되었습니다.
        </h2>
        <p className="mt-1 text-sm font-normal leading-6 text-[#777777]">
          서비스를 이용해 주셔서 고맙습니다.
        </p>
      </div>

      {showGoogleManualUnlinkNotice ? (
        <div className="border-b border-[#dbdbdb] bg-[#fff7f7] px-4 py-5">
          <p className="text-[15px] font-medium leading-6 text-[#303030]">
            Google 계정 연결이 자동으로 해제되지 않았을 수 있습니다.
          </p>
          <a
            className="mt-3 inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-[#1769d2] underline underline-offset-4"
            href="https://myaccount.google.com/permissions"
            rel="noopener noreferrer"
            target="_blank"
          >
            Google 계정 연결 확인
            <ExternalLink aria-hidden="true" size={17} strokeWidth={2} />
          </a>
        </div>
      ) : null}

      <div className="px-4 pt-8">
        <button
          className="h-[52px] w-full bg-[#3398ef] text-base font-semibold text-white active:brightness-95"
          onClick={() => router.replace("/")}
          type="button"
        >
          홈으로 가기
        </button>
      </div>
    </section>
  );
}
