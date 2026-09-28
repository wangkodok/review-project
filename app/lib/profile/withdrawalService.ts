import "server-only";
import { createSupabaseServerClient } from "@/app/lib/supabase/server";

type DeletedUserRow = {
  id: string;
};

export async function withdrawUser(
  userId: string,
): Promise<"deleted" | "not_found"> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("users")
    .delete()
    .eq("id", userId)
    .select("id")
    .maybeSingle<DeletedUserRow>();

  if (error) {
    throw new Error("WITHDRAWAL_DELETE_FAILED");
  }

  return data ? "deleted" : "not_found";
}
