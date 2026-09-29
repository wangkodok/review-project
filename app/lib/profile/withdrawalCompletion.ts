import { isGoogleRevokeStatus } from "@/app/lib/auth/googleRevokeStatus";

export function shouldShowGoogleManualUnlinkNotice(value: unknown) {
  return isGoogleRevokeStatus(value) && value !== "success";
}
