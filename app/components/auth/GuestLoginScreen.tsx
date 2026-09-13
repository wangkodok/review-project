import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import LoginOptions from "./LoginOptions";

export default function GuestLoginScreen() {
  return (
    <section className="guest-login-screen fixed inset-y-0 left-1/2 z-30 w-full max-w-[var(--app-frame-max-width)] -translate-x-1/2 overflow-y-auto bg-white px-4">
      <header className="-mx-4 flex h-14 items-center">
        <Link
          aria-label="커뮤니티로 이동"
          className="flex h-14 w-14 items-center justify-center text-[#121212] active:bg-neutral-100"
          href="/community"
        >
          <ArrowLeft aria-hidden="true" size={21} strokeWidth={1.5} />
        </Link>
      </header>

      <div className="pt-[18px]">
        <h1 className="text-[28px] font-bold leading-9 text-[#121212]">
          오늘 먹었던 메뉴
          <br />
          어땠나요?
        </h1>
        <p className="mt-5 text-[17px] leading-[25px] text-[#121212]">
          버튼으로 고르고,
          <br />
          내가 먹었던 메뉴를 공유해 보세요.
        </p>
        <LoginOptions className="mt-9" variant="my-guest" />
      </div>
    </section>
  );
}
