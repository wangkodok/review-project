export type PostCategory = {
  id: string;
  name: string;
  slug: string;
};

export type CommunityPost = {
  id: string;
  title: string;
  content: string;
  likeCount: number;
  viewCount: number;
  createdAt: string;
  author: {
    anonymousId: string;
  };
  category: PostCategory | null;
  isOwner: boolean;
  requiresCategorySelection: boolean;
};

export type PostsPage = {
  posts: CommunityPost[];
  page: number;
  limit: number;
  totalCount: number;
  hasMore: boolean;
};
