import { getServerSession } from "next-auth";
import GuestLoginScreen from "../components/auth/GuestLoginScreen";
import ProfileInfo from "../components/profile/ProfileInfo";
import { authOptions } from "../lib/auth/options";

export default async function MyPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return <GuestLoginScreen />;
  }

  return <ProfileInfo />;
}
