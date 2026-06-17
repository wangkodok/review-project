"use client";

import { usePathname } from "next/navigation";

const titles = [
  { href: "/home", title: "홈" },
  { href: "/community", title: "커뮤니티" },
  { href: "/my", title: "내 정보" },
];

const hiddenHeaderPatterns = [
  /^\/community\/write$/,
  /^\/community\/new$/,
  /^\/community\/[^/]+$/,
  /^\/community\/[^/]+\/edit$/,
  /^\/my\/posts$/,
];

function getTitle(pathname: string) {
  const match = titles.find((item) => pathname === item.href);
  return match?.title ?? "커뮤니티";
}

export default function Header() {
  const pathname = usePathname();

  if (hiddenHeaderPatterns.some((pattern) => pattern.test(pathname))) {
    return null;
  }

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-100 bg-white/95 px-5 py-4 backdrop-blur">
      <h1 className="text-xl font-bold tracking-normal text-neutral-950">{getTitle(pathname)}</h1>
    </header>
  );
}
