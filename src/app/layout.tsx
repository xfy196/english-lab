import type { Metadata } from "next";
import { ProgressProvider } from "@/lib/store";
import { WordProvider } from "@/lib/words-context";
import { Sidebar, MobileNav } from "@/components/nav";
import { PackDialog, PackNudge } from "@/components/pack-dialog";
import "./globals.css";

export const metadata: Metadata = {
  title: "WordLoop · 把英语单词真正记住",
  description:
    "基于间隔重复的英语单词学习工具：翻转卡片记单词、听音与拼写练习、学习数据可视化。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-dvh">
        <WordProvider>
          <ProgressProvider>
            <Sidebar />
            <MobileNav />
            <div className="lg:pl-[252px]">
              <main className="mx-auto w-full max-w-5xl px-5 pb-28 pt-6 lg:px-10 lg:pb-16 lg:pt-10">
                <PackNudge />
                {children}
              </main>
            </div>
            <PackDialog />
          </ProgressProvider>
        </WordProvider>
      </body>
    </html>
  );
}
