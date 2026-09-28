import { getServerSession } from "next-auth";
import LoginOptions from "@/app/components/auth/LoginOptions";
import WithdrawalConsentScreen from "@/app/components/profile/WithdrawalConsentScreen";
import WithdrawalPageHeader from "@/app/components/profile/WithdrawalPageHeader";
import { authOptions } from "@/app/lib/auth/options";
import { getWithdrawalExternalAuthAccount } from "@/app/lib/auth/sessionSecurity";

export default async function MyWithdrawPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return (
      <section className="-mx-5 -mb-24 -mt-5 min-h-dvh bg-white">
        <WithdrawalPageHeader backHref="/my" title="회원 탈퇴" />
        <div className="border-b border-neutral-200 px-5 py-8 text-center">
          <p className="text-sm font-semibold text-neutral-950">
            로그인이 필요합니다.
          </p>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            로그인 후 회원 탈퇴를 진행할 수 있습니다.
          </p>
        </div>
        <div className="px-5 pt-5">
          <LoginOptions />
        </div>
      </section>
    );
  }

  const authProvider = session.user.authProvider;

  if (authProvider !== "google" && authProvider !== "kakao") {
    return (
      <section className="-mx-5 -mb-24 -mt-5 min-h-dvh bg-white">
        <WithdrawalPageHeader backHref="/my" title="회원 탈퇴" />
        <div className="px-5 py-8">
          <p className="bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            로그인 세션을 확인할 수 없습니다. 다시 로그인해 주세요.
          </p>
        </div>
      </section>
    );
  }

  let googleLoginHint = "";

  if (authProvider === "google") {
    try {
      const account = await getWithdrawalExternalAuthAccount({
        userId: session.user.id,
        provider: authProvider,
      });

      if (typeof account?.providerEmail === "string") {
        googleLoginHint = account.providerEmail.trim();
      }
    } catch {
      // Provider cleanup remains best effort; the API revalidates the account.
    }
  }

  return (
    <WithdrawalConsentScreen
      authProvider={authProvider}
      googleLoginHint={googleLoginHint}
    />
  );
}
