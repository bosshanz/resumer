import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces, IBM_Plex_Sans, IBM_Plex_Mono, Inter_Tight, Noto_Sans_SC, Noto_Serif_SC } from "next/font/google";
import "./globals.css";
import "@/lib/templates/styles/index.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// 简历中文字形：随应用打包同一套开源字体（SIL OFL），预览和 PDF 都用它，
// 不再依赖各平台的苹方 / 雅黑 / 宋体，换机器分页也一致。
// Google Fonts 按 unicode-range 切片，浏览器只下载用到的字；没有中文子集可预加载。
const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  preload: false,
});

const notoSerifSC = Noto_Serif_SC({
  variable: "--font-noto-serif-sc",
  preload: false,
});

export const metadata: Metadata = {
  title: "Resumer — 让经历成为作品",
  description: "可视化简历工作台，区块编辑、专业主题与 PDF 导出。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable} ${interTight.variable} ${notoSansSC.variable} ${notoSerifSC.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
