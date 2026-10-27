import { Suspense } from "react";
import LearnView from "@/components/learn-view";
import { PageHeader } from "@/components/ui";

export const metadata = {
  title: "词汇卡片 · WordLoop",
  description: "翻转卡片学习英语单词，按认识与否自动安排复习优先级。",
};

export default function LearnPage() {
  return (
    <Suspense
      fallback={
        <div>
          <PageHeader
            eyebrow="Flashcards"
            title="词汇卡片"
            description="正在准备这一轮的单词…"
          />
          <div className="h-[368px] animate-pulse rounded-[26px] border border-line bg-surface" />
        </div>
      }
    >
      <LearnView />
    </Suspense>
  );
}
