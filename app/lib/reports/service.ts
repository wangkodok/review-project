import "server-only";

import { createSupabaseServerClient } from "@/app/lib/supabase/server";
import type { ReportReason } from "./input";

type CreateReviewReportParams = {
  postId: string;
  reporterUserId: string;
  reason: ReportReason;
  detail: string | null;
};

type PostOwnerRow = {
  id: string;
  user_id: string;
};

export async function createReviewReport({
  postId,
  reporterUserId,
  reason,
  detail,
}: CreateReviewReportParams) {
  const supabase = createSupabaseServerClient();
  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id,user_id")
    .eq("id", postId)
    .maybeSingle<PostOwnerRow>();

  if (postError) {
    throw new Error("REPORT_POST_LOOKUP_FAILED");
  }

  if (!post) {
    return { status: "not_found" as const };
  }

  if (post.user_id === reporterUserId) {
    return { status: "self_report" as const };
  }

  const { error } = await supabase.from("review_reports").insert({
    post_id: postId,
    reporter_user_id: reporterUserId,
    reason,
    detail,
  });

  if (!error) {
    return { status: "ok" as const };
  }

  if (error.code === "23505") {
    return { status: "duplicate" as const };
  }

  if (error.code === "23503") {
    return { status: "not_found" as const };
  }

  throw new Error("REPORT_STORAGE_FAILED");
}
