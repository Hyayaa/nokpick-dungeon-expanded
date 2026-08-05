import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "하수도 탐사 기록 · 턴제 웹 던전",
  description:
    "Shattered Pixel Dungeon의 오픈소스 타일과 구조를 바탕으로 재구성한 비공식 턴제 웹 로그라이크 프로토타입입니다.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
