import { getServerSession } from "next-auth";
import LoginButton from "@/app/components/auth/LoginButton";
import WithdrawalReauthButton from "@/app/components/profile/WithdrawalReauthButton";
import WithdrawalPageHeader from "@/app/components/profile/WithdrawalPageHeader";
import { authOptions } from "@/app/lib/auth/options";

type MyWithdrawPageProps = {
  searchParams: Promise<{
    error?: string | string[];
  }>;
};

export default async function MyWithdrawPage({
  searchParams,
}: MyWithdrawPageProps) {
  const session = await getServerSession(authOptions);
  const params = await searchParams;
  const errorCode =
    typeof params.error === "string" ? params.error : params.error?.[0];

  if (!session?.user?.id) {
    return (
      <section className="space-y-5">
        <WithdrawalPageHeader />
        <div className="border-b border-neutral-200 py-8 text-center">
          <p className="text-sm font-semibold text-neutral-950">
            로그인이 필요합니다.
          </p>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            Google 로그인 후 회원 탈퇴를 진행할 수 있습니다.
          </p>
        </div>
        <LoginButton />
      </section>
    );
  }

  return (
    <section>
      <WithdrawalPageHeader />
      <div className="py-8">
        <h2 className="text-lg font-bold text-neutral-950">
          회원 탈퇴 전 확인해 주세요.
        </h2>
        <p className="mt-3 text-sm leading-6 text-neutral-600">
          회원 탈퇴 시 개인정보와 이용 기록이 삭제되며 복구할 수 없습니다.
        </p>
        <p className="mt-3 text-sm leading-6 text-neutral-600">
          안전한 처리를 위해 현재 계정과 동일한 Google 계정으로 본인 확인이
          필요합니다.
        </p>
        <div className="mt-8">
          <WithdrawalReauthButton initialErrorCode={errorCode} />
        </div>
      </div>
    </section>
  );
}
