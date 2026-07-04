import { getServerSession } from "next-auth";
import Link from "next/link";
import LoginButton from "@/app/components/auth/LoginButton";
import PageBackHeader from "@/app/components/common/PageBackHeader";
import PostForm from "@/app/components/community/PostForm";
import { authOptions } from "@/app/lib/auth/options";
import { getPostForEdit } from "@/app/lib/posts/service";

type EditPostPageProps = {
  params: Promise<{
    postId: string;
  }>;
};

export default async function EditPostPage({ params }: EditPostPageProps) {
  const { postId } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user.id) {
    return (
      <section className="space-y-5">
        <PageBackHeader title="게시글 수정" />
        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center">
          <p className="text-sm font-semibold text-neutral-950">로그인이 필요합니다.</p>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            Google 로그인 후 게시글을 수정할 수 있습니다.
          </p>
        </div>
        <LoginButton />
      </section>
    );
  }

  const post = await getPostForEdit(postId);

  if (!post) {
    return (
      <section className="space-y-5">
        <PageBackHeader title="게시글 수정" />
        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center">
          <p className="text-sm font-semibold text-neutral-950">
            존재하지 않는 게시글입니다.
          </p>
          <Link
            className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-neutral-950 px-4 text-sm font-semibold text-white"
            href="/community"
          >
            목록으로 이동
          </Link>
        </div>
      </section>
    );
  }

  if (post.user_id !== session.user.id) {
    return (
      <section className="space-y-5">
        <PageBackHeader title="게시글 수정" />
        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center">
          <p className="text-sm font-semibold text-neutral-950">수정 권한이 없습니다.</p>
          <Link
            className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-neutral-950 px-4 text-sm font-semibold text-white"
            href={`/community/${post.id}`}
          >
            게시글로 이동
          </Link>
        </div>
      </section>
    );
  }

  const currentCategory = Array.isArray(post.category) ? post.category[0] : post.category;

  return (
    <PostForm
      initialCategoryId={post.requiresCategorySelection ? "" : (currentCategory?.id ?? "")}
      initialContent={post.content}
      initialBadPoints={post.bad_points ?? []}
      initialGoodPoints={post.good_points ?? []}
      initialMenuName={post.menu_name ?? post.title}
      initialTitle={post.title}
      mode="edit"
      postId={post.id}
      requiresCategorySelection={post.requiresCategorySelection}
    />
  );
}
