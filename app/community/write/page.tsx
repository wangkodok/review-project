import { getServerSession } from "next-auth";
import GuestLoginScreen from "@/app/components/auth/GuestLoginScreen";
import PostForm from "@/app/components/community/PostForm";
import { authOptions } from "@/app/lib/auth/options";
import { isReviewImageUploadEnabled } from "@/app/lib/reviewImages/config";

export default async function WritePostPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return <GuestLoginScreen />;
  }

  return <PostForm imageUploadEnabled={isReviewImageUploadEnabled()} />;
}
