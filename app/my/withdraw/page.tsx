import { getServerSession } from "next-auth";
import LoginOptions from "@/app/components/auth/LoginOptions";
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
            로그인 후 회원 탈퇴를 진행할 수 있습니다.
          </p>
        </div>
        <LoginOptions />
      </section>
    );
  }

  const authProvider = session.user.authProvider;

  if (authProvider !== "google" && authProvider !== "kakao") {
    return (
      <section>
        <WithdrawalPageHeader />
        <div className="py-8">
          <p className="bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            로그인 세션을 확인할 수 없습니다. 다시 로그인해 주세요.
          </p>
        </div>
      </section>
    );
  }

  const providerName = authProvider === "google" ? "Google" : "Kakao";

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
          안전한 처리를 위해 현재 계정과 동일한 {providerName} 계정으로 본인
          확인이 필요합니다.
        </p>
        {authProvider === "kakao" ? (
          <p className="mt-3 text-sm leading-6 text-neutral-500">
            KakaoTalk 인앱 브라우저에서는 본인 확인이 지원되지 않습니다. 외부
            브라우저에서 다시 진행해 주세요.
          </p>
        ) : null}
        <div className="mt-8">
          <WithdrawalReauthButton
            authProvider={authProvider}
            initialErrorCode={errorCode}
          />
        </div>
      </div>
    </section>
  );
}
