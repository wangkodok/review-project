"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const tabs = [
  {
    href: "/home",
    label: "홈",
    activeIcon: "/icons/bottom-tab/home-active.svg",
    inactiveIcon: "/icons/bottom-tab/home-inactive.svg",
  },
  {
    href: "/community",
    label: "커뮤니티",
    activeIcon: "/icons/bottom-tab/community-active.svg",
    inactiveIcon: "/icons/bottom-tab/community-inactive.svg",
  },
  {
    href: "/my",
    label: "내 정보",
    activeIcon: "/icons/bottom-tab/my-active.svg",
    inactiveIcon: "/icons/bottom-tab/my-inactive.svg",
  },
];

const hiddenBottomTabPatterns = [
  /^\/community\/search$/,
  /^\/community\/write$/,
  /^\/community\/new$/,
  /^\/community\/[^/]+$/,
  /^\/community\/[^/]+\/edit$/,
  /^\/community\/[^/]+\/report$/,
  /^\/my\/posts$/,
  /^\/my\/profile$/,
  /^\/my\/withdraw$/,
  /^\/privacy$/,
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
    <nav className="fixed bottom-0 left-1/2 z-20 grid h-14 w-full max-w-[var(--app-frame-max-width)] -translate-x-1/2 grid-cols-3 border-t border-[#dbdbdb] bg-white">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            // className="flex flex-col items-center justify-center gap-1 text-xs font-semibold"
            className={`flex h-[55px] min-w-0 flex-col items-center justify-center gap-[3px] text-xs leading-[17px] ${
              isActive
                ? "font-medium text-[#121212]"
                : "font-normal text-[#858585]"
            }`}
            href={tab.href}
            key={tab.href}
          >
            <Image
              alt=""
              aria-hidden="true"
              height={24}
              src={isActive ? tab.activeIcon : tab.inactiveIcon}
              width={24}
            />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
