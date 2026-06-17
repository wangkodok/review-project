"use client";

import Link from "next/link";
import { Home, MessageSquareText, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/home", label: "홈", icon: Home },
  { href: "/community", label: "커뮤니티", icon: MessageSquareText },
  { href: "/my", label: "내 정보", icon: UserRound },
];

const hiddenBottomTabPatterns = [
  /^\/community\/write$/,
  /^\/community\/new$/,
  /^\/community\/[^/]+$/,
  /^\/community\/[^/]+\/edit$/,
  /^\/my\/posts$/,
];

function shouldHideBottomTab(pathname: string) {
  return hiddenBottomTabPatterns.some((pattern) => pattern.test(pathname));
}

export default function BottomTab() {
  const pathname = usePathname();

  if (shouldHideBottomTab(pathname)) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-1/2 z-20 grid h-16 w-full max-w-[375px] -translate-x-1/2 grid-cols-3 border-t border-neutral-100 bg-white">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        const Icon = tab.icon;

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className="flex flex-col items-center justify-center gap-1 text-xs font-semibold"
            href={tab.href}
            key={tab.href}
          >
            <Icon
              aria-hidden="true"
              className={isActive ? "text-neutral-950" : "text-neutral-400"}
              size={22}
              strokeWidth={isActive ? 2.4 : 2}
            />
            <span className={isActive ? "text-neutral-950" : "text-neutral-400"}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
