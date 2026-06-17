import type { Metadata } from "next";
import "./globals.css";
import Header from "./components/layout/Header";
import BottomTab from "./components/layout/BottomTab";
import QueryProvider from "./components/providers/QueryProvider";

export const metadata: Metadata = {
  title: "익명 음식 리뷰",
  description: "익명 음식 리뷰 플랫폼 MVP",
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
            <main className="flex-1 px-5 pb-24 pt-5">{children}</main>
            <BottomTab />
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
