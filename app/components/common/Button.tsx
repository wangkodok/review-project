import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  href?: string;
};

const className =
  "inline-flex h-12 w-full items-center justify-center rounded-lg bg-neutral-950 px-4 text-base font-bold text-white active:bg-neutral-800";

// 버튼 관련된 것
export default function Button({ children, href, type = "button", ...props }: ButtonProps) {
  if (href === "/community") {
    return (
      <Link className={className} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <button className={className} type={type} {...props}>
      {children}
    </button>
  );
}
