import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPostForEdit: vi.fn(),
  getServerSession: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/app/lib/auth/options", () => ({ authOptions: {} }));
vi.mock("@/app/lib/posts/service", () => ({
  getPostForEdit: mocks.getPostForEdit,
}));
vi.mock("@/app/lib/reviewImages/config", () => ({
  isReviewImageUploadEnabled: () => false,
}));
vi.mock("@/app/components/community/PostForm", () => ({
  default: ({ returnSource }: { returnSource?: string }) =>
    `return:${returnSource ?? "detail"}`,
}));

import EditPostPage from "./page";

describe("EditPostPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: "user-id" } });
    mocks.getPostForEdit.mockResolvedValue({
      id: "post-id",
      user_id: "user-id",
      title: "리뷰",
      menu_name: "메뉴",
      good_points: [],
      bad_points: [],
      updated_at: "2026-10-02T00:00:00.000Z",
      category: null,
      region: null,
      requiresCategorySelection: false,
      requiresRegionSelection: false,
      image: null,
    });
  });

  it("passes the community list source to the edit form", async () => {
    const html = renderToStaticMarkup(
      await EditPostPage({
        params: Promise.resolve({ postId: "post-id" }),
        searchParams: Promise.resolve({ from: "community" }),
      }),
    );

    expect(html).toContain("return:community");
  });
});
