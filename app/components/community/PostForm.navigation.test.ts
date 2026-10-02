import { describe, expect, it } from "vitest";
import { getPostFormLeaveNavigation } from "./PostForm";

describe("getPostFormLeaveNavigation", () => {
  it("returns to the exact My reviews history entry when edit started there", () => {
    expect(
      getPostFormLeaveNavigation({
        detailHref: "/community/post-id?from=my-posts",
        isEditMode: true,
        postId: "post-id",
        returnSource: "my-posts",
      }),
    ).toEqual({ type: "back" });
  });

  it("returns to the exact community list history entry when edit started there", () => {
    expect(
      getPostFormLeaveNavigation({
        detailHref: "/community/post-id",
        isEditMode: true,
        postId: "post-id",
        returnSource: "community",
      }),
    ).toEqual({ type: "back" });
  });

  it("keeps the existing detail destination for a regular detail edit", () => {
    expect(
      getPostFormLeaveNavigation({
        detailHref: "/community/post-id",
        isEditMode: true,
        postId: "post-id",
      }),
    ).toEqual({ type: "replace", href: "/community/post-id" });
  });

  it("keeps browser back navigation for review creation", () => {
    expect(
      getPostFormLeaveNavigation({
        detailHref: "",
        isEditMode: false,
      }),
    ).toEqual({ type: "back" });
  });
});
