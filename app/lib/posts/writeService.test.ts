import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({ rpc: mocks.rpc }),
}));

import { createPost, updatePost } from "./service";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const POST_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const REGION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CATEGORY_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const IMAGE_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const UPDATED_AT = "2026-09-14T01:00:00.000Z";

const sharedInput = {
  userId: USER_ID,
  storeName: "냉면과고기집",
  regionId: REGION_ID,
  title: "물냉면",
  content: "구조화된 리뷰",
  categoryId: CATEGORY_ID,
  menuName: "물냉면",
  goodPoints: ["tasty"],
  badPoints: ["long_wait_time"],
  overallReview: null,
};

describe("atomic review write service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a post and attaches the selected image in one RPC", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ result: "ok", post_id: POST_ID, updated_at: UPDATED_AT }],
      error: null,
    });

    await expect(createPost({ ...sharedInput, imageId: IMAGE_ID })).resolves.toEqual({
      status: "ok",
      post: { id: POST_ID },
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_review_post_with_image_atomic",
      {
        p_user_id: USER_ID,
        p_store_name: "냉면과고기집",
        p_region_id: REGION_ID,
        p_title: "물냉면",
        p_content: "구조화된 리뷰",
        p_category_id: CATEGORY_ID,
        p_menu_name: "물냉면",
        p_good_points: ["tasty"],
        p_bad_points: ["long_wait_time"],
        p_overall_review: null,
        p_image_id: IMAGE_ID,
      },
    );
  });

  it("returns a safe create failure status from the RPC", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ result: "image_forbidden", post_id: null, updated_at: null }],
      error: null,
    });

    await expect(createPost({ ...sharedInput, imageId: IMAGE_ID })).resolves.toEqual({
      status: "image_forbidden",
    });
  });

  it("updates a post and replaces its image in one RPC", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          result: "ok",
          post_id: POST_ID,
          updated_at: UPDATED_AT,
          replaced_image_id: null,
        },
      ],
      error: null,
    });

    await expect(
      updatePost({
        ...sharedInput,
        postId: POST_ID,
        expectedUpdatedAt: UPDATED_AT,
        imageAction: "replace",
        imageId: IMAGE_ID,
      }),
    ).resolves.toEqual({
      status: "ok",
      post: { id: POST_ID, updatedAt: UPDATED_AT },
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "update_review_post_with_image_atomic",
      expect.objectContaining({
        p_post_id: POST_ID,
        p_user_id: USER_ID,
        p_expected_updated_at: UPDATED_AT,
        p_image_action: "replace",
        p_image_id: IMAGE_ID,
      }),
    );
  });

  it("maps the DB post_not_found result to the existing service contract", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          result: "post_not_found",
          post_id: null,
          updated_at: null,
          replaced_image_id: null,
        },
      ],
      error: null,
    });

    await expect(
      updatePost({
        ...sharedInput,
        postId: POST_ID,
        expectedUpdatedAt: UPDATED_AT,
        imageAction: "keep",
        imageId: null,
      }),
    ).resolves.toEqual({ status: "not_found" });
  });

  it("does not expose database errors through the service", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "private database detail" },
    });

    await expect(createPost({ ...sharedInput, imageId: null })).rejects.toThrow(
      "Atomic review create failed",
    );
  });
});
