import { getServerSession } from "next-auth";
import LoginOptions from "@/app/components/auth/LoginOptions";
import PageBackHeader from "@/app/components/common/PageBackHeader";
import MyPostList from "@/app/components/profile/MyPostList";
import { authOptions } from "@/app/lib/auth/options";

export default async function MyPostsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return (
      <section className="space-y-5">
        <PageBackHeader
          backIconStrokeWidth={1.25}
          fullHeightActions
          title="내가 작성한 리뷰"
          titleClassName="text-[18px] font-bold leading-6 text-[#121212]"
        />
        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center">
          <p className="text-sm font-semibold text-neutral-950">로그인이 필요합니다.</p>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            로그인 후 내가 작성한 리뷰를 확인할 수 있습니다.
          </p>
        </div>
        <LoginOptions />
      </section>
    );
  }

  return <MyPostList />;
}
