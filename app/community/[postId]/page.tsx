import { getServerSession } from "next-auth";
import PostDetail from "@/app/components/community/PostDetail";
import { authOptions } from "@/app/lib/auth/options";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const session = await getServerSession(authOptions);

  return <PostDetail isAuthenticated={Boolean(session?.user.id)} postId={postId} />;
}
