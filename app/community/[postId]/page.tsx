import PostDetail from "@/app/components/community/PostDetail";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;

  return <PostDetail postId={postId} />;
}
