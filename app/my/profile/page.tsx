import { getServerSession } from "next-auth";
import LoginButton from "@/app/components/auth/LoginButton";
import PageBackHeader from "@/app/components/common/PageBackHeader";
import ProfileSettings from "@/app/components/profile/ProfileSettings";
import { authOptions } from "@/app/lib/auth/options";

export default async function MyProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return (
      <section className="space-y-5">
        <PageBackHeader title="프로필 설정" />
        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center">
          <p className="text-sm font-semibold text-neutral-950">로그인이 필요합니다.</p>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            Google 로그인 후 프로필을 설정할 수 있습니다.
          </p>
        </div>
        <LoginButton />
      </section>
    );
  }

  return <ProfileSettings />;
}
