import { getServerSession } from "next-auth";
import CommunityList from "../components/community/CommunityList";
import { authOptions } from "../lib/auth/options";

export default async function CommunityPage() {
  const session = await getServerSession(authOptions);

  return <CommunityList isAuthenticated={Boolean(session?.user.id)} />;
}
