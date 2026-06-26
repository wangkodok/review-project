"use client";

import { Eye, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { CommunityPost } from "@/app/types/post";
import PostMeta from "./PostMeta";
import PostMoreMenu from "./PostMoreMenu";

export default function PostRows({
  posts,
  isAuthenticated,
  onDeleteSuccess,
}: {
  posts: CommunityPost[];
  isAuthenticated: boolean;
  onDeleteSuccess?: () => void;
}) {
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);

  return (
    <div>
      {posts.map((post) => (
        <article className="relative border-b border-neutral-200 py-5" key={post.id}>
          <PostMoreMenu
            className="absolute right-0 top-3"
            closeOnOutsidePointerDown
            editNavigation="push"
            isAuthenticated={isAuthenticated}
            isMenuOpen={openMenuPostId === post.id}
            isOwner={post.isOwner}
            onMenuOpenChange={(isOpen) => setOpenMenuPostId(isOpen ? post.id : null)}
            onDeleteSuccess={onDeleteSuccess}
            postId={post.id}
            requiresCategorySelection={post.requiresCategorySelection}
          />
          <Link className="block pr-12 active:bg-neutral-50" href={`/community/${post.id}`}>
            <PostMeta anonymousId={post.author.anonymousId} createdAt={post.createdAt} />
            {post.category ? (
              <span className="mt-2 inline-flex h-7 items-center rounded-full bg-[#f7f7f7] px-3 text-xs font-medium text-[#121212]">
                {post.category.name}
              </span>
            ) : null}
            <h2 className="mt-2 line-clamp-2 break-all text-lg font-bold leading-6 text-neutral-950">
              {post.title}
            </h2>
            <p className="mt-2 line-clamp-2 break-all text-sm leading-6 text-neutral-600">
              {post.content}
            </p>
            <div className="mt-3 flex items-center gap-4 text-sm font-medium text-neutral-500">
              <span className="inline-flex items-center gap-1">
                <ThumbsUp aria-hidden="true" size={16} />
                {post.likeCount}
              </span>
              <span className="inline-flex items-center gap-1">
                <Eye aria-hidden="true" size={16} />
                {post.viewCount}
              </span>
            </div>
          </Link>
        </article>
      ))}
    </div>
  );
}
