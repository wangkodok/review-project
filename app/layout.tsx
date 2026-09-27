import type { Metadata } from "next";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";
import Header from "./components/layout/Header";
import BottomTab from "./components/layout/BottomTab";
import QueryProvider from "./components/providers/QueryProvider";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.sseullae.com"),
  title: "쓸래? 리뷰 길게 쓰지 않아도 괜찮아요.",
  description: "간편하게 선택하고, 내가 먹었던 메뉴를 공유해 보세요. 나의 경험이 누군가의 선택에 도움이 돼요.",
  openGraph: {
    title: "쓸래? 리뷰 길게 쓰지 않아도 괜찮아요.",
    description: "간편하게 선택하고, 내가 먹었던 메뉴를 공유해 보세요. 나의 경험이 누군가의 선택에 도움이 돼요.",
    url: "/",
    siteName: "쓸래? 리뷰 길게 쓰지 않아도 괜찮아요.",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "쓸래? 리뷰 길게 쓰지 않아도 괜찮아요.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "쓸래? 리뷰 길게 쓰지 않아도 괜찮아요.",
    description: "간편하게 선택하고, 내가 먹었던 메뉴를 공유해 보세요. 나의 경험이 누군가의 선택에 도움이 돼요.",
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
          <div className="app-shell mx-auto flex min-h-dvh w-full max-w-[var(--app-frame-max-width)] flex-col bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.04)]">
            <Header />
            <main className="flex flex-1 flex-col px-5 pb-24 pt-5">
              <div className="flex-1">{children}</div>
            </main>
            <BottomTab />
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
