import { getServerSession } from "next-auth";
import SearchPosts from "@/app/components/community/SearchPosts";
import { authOptions } from "@/app/lib/auth/options";

export default async function CommunitySearchPage() {
  const session = await getServerSession(authOptions);

  return <SearchPosts isAuthenticated={Boolean(session?.user.id)} />;
}
