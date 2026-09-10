import { getServerSession } from "next-auth";
import PostDetail from "@/app/components/community/PostDetail";
import { authOptions } from "@/app/lib/auth/options";

export default async function PostDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ postId: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { postId } = await params;
  const { from } = await searchParams;
  const session = await getServerSession(authOptions);
  const source = from === "my-posts" ? "my-posts" : undefined;

  return (
    <PostDetail
      isAuthenticated={Boolean(session?.user?.id)}
      postId={postId}
      source={source}
    />
  );
}
