import WithdrawalCompleteView from "@/app/components/profile/WithdrawalCompleteView";
import { shouldShowGoogleManualUnlinkNotice } from "@/app/lib/profile/withdrawalCompletion";

type WithdrawalCompletePageProps = {
  searchParams: Promise<{
    googleRevokeStatus?: string | string[];
  }>;
};

export default async function WithdrawalCompletePage({
  searchParams,
}: WithdrawalCompletePageProps) {
  const { googleRevokeStatus } = await searchParams;

  return (
    <WithdrawalCompleteView
      showGoogleManualUnlinkNotice={shouldShowGoogleManualUnlinkNotice(
        googleRevokeStatus,
      )}
    />
  );
}
