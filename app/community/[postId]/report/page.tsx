import { getServerSession } from "next-auth";
import LoginOptions from "@/app/components/auth/LoginOptions";
import PageBackHeader from "@/app/components/common/PageBackHeader";
import ReviewReportForm from "@/app/components/community/ReviewReportForm";
import { parseReviewReportSource } from "@/app/components/community/reviewReportClient";
import { authOptions } from "@/app/lib/auth/options";

export default async function ReviewReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ postId: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { postId } = await params;
  const { from } = await searchParams;
  const session = await getServerSession(authOptions);
  const source = parseReviewReportSource(from);

  if (!session?.user?.id) {
    const callbackUrl = `/community/${postId}/report${source ? `?from=${source}` : ""}`;

    return (
      <section className="space-y-5">
        <PageBackHeader
          backIconStrokeWidth={1.25}
          fullHeightActions
          title="신고하기"
          titleClassName="text-[18px] font-bold leading-7 text-[#121212]"
        />
        <div className="border border-neutral-200 bg-white p-6 text-center">
          <p className="text-sm font-semibold text-neutral-950">로그인이 필요합니다.</p>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            로그인 후 리뷰를 신고할 수 있습니다.
          </p>
        </div>
        <LoginOptions callbackUrl={callbackUrl} />
      </section>
    );
  }

  return <ReviewReportForm postId={postId} source={source} />;
}
