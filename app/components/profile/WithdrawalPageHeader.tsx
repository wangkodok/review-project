"use client";

import { useRouter } from "next/navigation";
import PageBackHeader from "../common/PageBackHeader";

export type WithdrawalPageHref = "/" | "/community" | "/my";

export function replaceWithdrawalLocation({
  href,
  replaceLocation,
}: {
  href: WithdrawalPageHref;
  replaceLocation: (href: string) => void;
}) {
  replaceLocation(href);
}

export default function WithdrawalPageHeader({
  title,
  backHref,
  disabled = false,
}: {
  title: "회원 탈퇴" | "완료";
  backHref: WithdrawalPageHref;
  disabled?: boolean;
}) {
  const router = useRouter();

  return (
    <PageBackHeader
      backDisabled={disabled}
      flush
      onBack={() =>
        replaceWithdrawalLocation({
          href: backHref,
          replaceLocation: (href) => router.replace(href),
        })
      }
      title={title}
    />
  );
}
