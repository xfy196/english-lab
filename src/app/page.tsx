"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  Flame,
  Headphones,
  Repeat2,
  Sparkles,
  Target,
} from "lucide-react";
import { PageHeader, ProgressRing, StatTile } from "@/components/ui";
import { WeekBars } from "@/components/charts";
import { useProgress, DAILY_GOAL } from "@/lib/store";
import { useWords } from "@/lib/words-context";
import { dateKey, weekdayLabel } from "@/lib/utils";

const MODES = [
  {
    href: "/learn",
    title: "词汇卡片",
    en: "Flashcards",
    desc: "翻面看释义，认识与否决定下次出现的时机",
    icon: BookOpen,
    accent: "from-[#5b5bf5] to-[#8b5cf6]",
  },
  {
    href: "/quiz",
    title: "听写练习",
    en: "Listening & Spelling",
    desc: "听音选词、看释义拼写，把被动词汇变主动",
    icon: Headphones,
    accent: "from-[#f5a524] to-[#f97316]",
  },
  {
    href: "/stats",
    title: "学习数据",
    en: "Progress",
    desc: "掌握度、正确率与最近两周的学习曲线",
    icon: Target,
    accent: "from-[#16a06a] to-[#0f9b8e]",
  },
];

function greetingByHour(hour: number) {
  if (hour < 6) return "夜深了";
  if (hour < 12) return "早上好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

export default function HomePage() {
  const {
    today,
    todayKey,
    streak,
    masteredCount,
    touchedCount,
    totalWords,
    series,
    progressOf,
    hydrated,
  } = useProgress();
  const { wordMap } = useWords();
  const [greeting, setGreeting] = useState("你好");
  const [todayLabel, setTodayLabel] = useState("");

  useEffect(() => {
    const now = new Date();
    setGreeting(greetingByHour(now.getHours()));
    setTodayLabel(
      `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日 · 周${weekdayLabel(
        dateKey(now),
      )}`,
    );
  }, []);

  const todayTotal = today.learned + today.reviewed + today.correct + today.wrong;

  const week = useMemo(
    () =>
      series.slice(-7).map((p) => ({
        label: weekdayLabel(p.key),
        count: p.count,
        isToday: p.key === todayKey,
      })),
    [series, todayKey],
  );

  const due = useMemo(() => {
    if (!hydrated) return [];
    return Object.keys(wordMap)
      .map((id) => ({ id, progress: progressOf(id) }))
      .filter((row) => row.progress?.status === "learning")
      .sort((a, b) =>
        a.progress!.lastSeen > b.progress!.lastSeen ? 1 : -1,
      )
      .slice(0, 3)
      .map((row) => wordMap[row.id])
      .filter(Boolean);
  }, [hydrated, progressOf, wordMap]);

  return (
    <div>
      <PageHeader
        eyebrow={todayLabel || "今日概览"}
        title={`${greeting}，今天也来记几个词`}
        description="每次 10 分钟，先过一遍卡片，再做一组听写。循环三次，短期记忆才会变成长期记忆。"
        action={
          <Link
            href="/learn"
            className="group inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13px] font-medium text-white transition-transform hover:-translate-y-0.5"
          >
            开始今日学习
            <ArrowRight
              size={15}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="animate-rise relative overflow-hidden rounded-[26px] border border-line bg-surface p-6 lg:p-7">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand-soft blur-2xl" />
          <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-center">
            <ProgressRing value={today.learned} total={DAILY_GOAL} size={150}>
              <div>
                <div className="text-[30px] font-semibold leading-none tracking-tight">
                  {today.learned}
                  <span className="text-[15px] text-muted">/{DAILY_GOAL}</span>
                </div>
                <p className="mt-1 text-[11px] text-muted">今日新词</p>
              </div>
            </ProgressRing>

            <div className="w-full flex-1">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-brand">
                <Sparkles size={13} />
                今日目标
              </div>
              <h2 className="mt-2 text-[19px] font-semibold leading-snug tracking-tight">
                {today.learned >= DAILY_GOAL
                  ? "目标达成，可以再加一组听写"
                  : `还差 ${DAILY_GOAL - today.learned} 个词就完成今天的目标`}
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                今天已产生 {todayTotal} 次学习动作，其中复习 {today.reviewed} 次、答对{" "}
                {today.correct} 题。
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/learn"
                  className="rounded-full bg-brand px-4 py-2 text-[12.5px] font-medium text-white transition-colors hover:bg-brand-dark"
                >
                  学新词
                </Link>
                <Link
                  href="/quiz"
                  className="rounded-full border border-line px-4 py-2 text-[12.5px] font-medium text-ink transition-colors hover:bg-paper"
                >
                  做听写
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
          <StatTile
            label="连续打卡"
            value={streak}
            unit="天"
            tone="accent"
            hint={streak > 0 ? "保持住这个节奏" : "今天开始算第一天"}
            icon={<Flame size={15} className="text-accent" />}
          />
          <StatTile
            label="已掌握"
            value={masteredCount}
            unit={`/ ${totalWords} 词`}
            tone="good"
            hint={`接触过 ${touchedCount} 个单词`}
            icon={<CalendarCheck size={15} className="text-good" />}
          />
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold tracking-tight">三种练习方式</h2>
          <span className="text-[11.5px] text-muted">建议顺序：卡片 → 听写 → 复盘</span>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-3">
          {MODES.map((m, i) => {
            const Icon = m.icon;
            return (
              <Link
                key={m.href}
                href={m.href}
                className="animate-rise group relative overflow-hidden rounded-2xl border border-line bg-surface p-5 transition-all hover:-translate-y-1 hover:border-[#d9d3c8] hover:shadow-[0_16px_32px_-22px_rgba(22,24,29,0.35)]"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span
                  className={`grid h-10 w-10 place-items-center rounded-xl bg-linear-to-br ${m.accent} text-white`}
                >
                  <Icon size={18} strokeWidth={2} />
                </span>
                <h3 className="mt-4 text-[15px] font-semibold tracking-tight">
                  {m.title}
                </h3>
                <p className="mt-0.5 text-[10.5px] uppercase tracking-[0.12em] text-muted">
                  {m.en}
                </p>
                <p className="mt-2.5 pr-4 text-[12.5px] leading-relaxed text-muted">
                  {m.desc}
                </p>
                <ArrowRight
                  size={16}
                  className="absolute right-5 top-5 text-muted/40 transition-all group-hover:translate-x-0.5 group-hover:text-brand"
                />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-[22px] border border-line bg-surface p-5 lg:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight">本周学习节奏</h2>
              <p className="mt-0.5 text-[11.5px] text-muted">
                柱高代表当天的新学 + 复习 + 答题次数
              </p>
            </div>
            <Link
              href="/stats"
              className="text-[12px] font-medium text-brand hover:underline"
            >
              查看趋势
            </Link>
          </div>
          <WeekBars data={week} />
        </div>

        <div className="rounded-[22px] border border-line bg-surface p-5 lg:p-6">
          <div className="mb-3 flex items-center gap-1.5">
            <Repeat2 size={15} className="text-brand" />
            <h2 className="text-[15px] font-semibold tracking-tight">该复习了</h2>
          </div>
          {!hydrated ? (
            <p className="text-[12.5px] text-muted">正在读取学习记录…</p>
          ) : due.length === 0 ? (
            <p className="text-[12.5px] leading-relaxed text-muted">
              还没有待复习的单词。先去「词汇卡片」过一遍，认识的词会被标为学习中，下次就会出现在这里。
            </p>
          ) : (
            <ul className="space-y-2">
              {due.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between rounded-xl bg-paper/70 px-3 py-2"
                >
                  <span>
                    <span className="font-display text-[15px]">{w.word}</span>
                    <span className="ml-2 text-[11.5px] text-muted">{w.meaning}</span>
                  </span>
                  <span className="text-[10.5px] text-muted">{w.level}</span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/learn?mode=review"
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-line py-2 text-[12.5px] font-medium transition-colors hover:bg-paper"
          >
            复习这些词
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    </div>
  );
}
