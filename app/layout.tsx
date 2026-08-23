import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import Header from "./components/layout/Header";
import BottomTab from "./components/layout/BottomTab";
import QueryProvider from "./components/providers/QueryProvider";

export const metadata: Metadata = {
  metadataBase: new URL("https://review-project-henna.vercel.app"),
  title: "리뷰쓸래",
  description: "익명 음식 리뷰 플랫폼",
  openGraph: {
    title: "리뷰쓸래",
    description: "익명 음식 리뷰 플랫폼",
    url: "/",
    siteName: "리뷰쓸래",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "리뷰쓸래",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "리뷰쓸래",
    description: "익명 음식 리뷰 플랫폼",
    images: ["/og-image.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">
        <QueryProvider>
          <div className="mx-auto flex min-h-dvh w-full max-w-[375px] flex-col bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.04)]">
            <Header />
            <main className="flex flex-1 flex-col px-5 pb-24 pt-5">
              <div className="flex-1">{children}</div>
              <footer className="mt-10 border-t border-neutral-100 pt-5 text-center">
                <Link
                  className="text-xs font-medium text-neutral-500 underline decoration-neutral-300 underline-offset-4 active:text-neutral-900"
                  href="/privacy"
                >
                  개인정보처리방침
                </Link>
              </footer>
            </main>
            <BottomTab />
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
