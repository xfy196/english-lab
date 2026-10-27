"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Flame,
  Search,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useProgress } from "@/lib/store";
import { useWords } from "@/lib/words-context";
import { formatBytes } from "@/lib/wordpack";
import { TrendChart } from "@/components/charts";
import { PageHeader, StatTile } from "@/components/ui";
import { cn } from "@/lib/utils";

type Filter = "all" | "new" | "learning" | "mastered";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "new", label: "未学习" },
  { key: "learning", label: "学习中" },
  { key: "mastered", label: "已掌握" },
];

export default function StatsPage() {
  const {
    hydrated,
    series,
    today,
    streak,
    masteredCount,
    touchedCount,
    totalWords,
    totalAnswers,
    accuracy,
    progressOf,
    reset,
  } = useProgress();

  const { words, levels, installed, installedCount, installedBytes, openDialog } = useWords();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [confirming, setConfirming] = useState(false);
  // 词库有 500 词，一次渲染全部行会拖慢页面，分批展开
  const [limit, setLimit] = useState(40);
  useEffect(() => setLimit(40), [query, filter]);

  const learningCount = touchedCount - masteredCount;
  // 卸载词包后，学过的词进度还在但总数会变小，这里夹一下避免出现负数
  const untouched = Math.max(0, totalWords - touchedCount);
  const pct = (n: number) => (totalWords > 0 ? Math.min(100, Math.round((n / totalWords) * 100)) : 0);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return words.filter((w) => {
      const p = progressOf(w.id);
      if (filter === "new" && p) return false;
      if (filter === "learning" && p?.status !== "learning") return false;
      if (filter === "mastered" && p?.status !== "mastered") return false;
      if (!q) return true;
      return (
        w.word.toLowerCase().includes(q) ||
        w.meaning.includes(q) ||
        w.level.toLowerCase() === q
      );
    });
  }, [query, filter, progressOf, words]);

  const last14 = series.reduce((s, p) => s + p.count, 0);
  const activeDays = series.filter((p) => p.count > 0).length;

  if (!hydrated) {
    return (
      <div>
        <PageHeader eyebrow="Progress" title="学习数据" description="正在汇总…" />
        <div className="h-[220px] animate-pulse rounded-[26px] border border-line bg-surface" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Progress"
        title="学习数据"
        description="数据只保存在这台设备的浏览器里。换设备不会同步，但也不会传到任何服务器。"
        action={
          <Link
            href="/learn"
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2.5 text-[12.5px] font-medium text-white transition-colors hover:bg-brand-dark"
          >
            继续学习
            <ArrowRight size={14} />
          </Link>
        }
      />

      <section className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatTile
          label="累计答题"
          value={totalAnswers}
          unit="次"
          hint={`今天 ${today.correct + today.wrong} 次`}
          icon={<Target size={15} className="text-muted" />}
        />
        <StatTile
          label="答题正确率"
          value={accuracy}
          unit="%"
          tone="brand"
          hint={totalAnswers ? "含卡片与听写" : "还没有答题记录"}
          icon={<TrendingUp size={15} className="text-brand" />}
        />
        <StatTile
          label="已掌握"
          value={masteredCount}
          unit={`/ ${totalWords}`}
          tone="good"
          hint="连续答对 2 次以上"
          icon={<CheckCircle2 size={15} className="text-good" />}
        />
        <StatTile
          label="连续学习"
          value={streak}
          unit="天"
          tone="accent"
          hint={`近 14 天有 ${activeDays} 天在学`}
          icon={<Flame size={15} className="text-accent" />}
        />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-[22px] border border-line bg-surface p-5 lg:p-6">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold tracking-tight">最近 14 天学习量</h2>
            <span className="text-[11.5px] text-muted">合计 {last14} 次动作</span>
          </div>
          <TrendChart data={series} />
        </div>

        <div className="rounded-[22px] border border-line bg-surface p-5 lg:p-6">
          <h2 className="text-[15px] font-semibold tracking-tight">词汇掌握分布</h2>
          <p className="mt-0.5 text-[11.5px] text-muted">
            共 {totalWords} 个单词的素材库
          </p>

          <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-[#f1eee8]">
            <div
              className="h-full bg-good transition-[width] duration-700"
              style={{ width: `${pct(masteredCount)}%` }}
            />
            <div
              className="h-full bg-[#b9b7ff] transition-[width] duration-700"
              style={{ width: `${pct(learningCount)}%` }}
            />
          </div>

          <ul className="mt-4 space-y-2.5 text-[12.5px]">
            {[
              { label: "已掌握", value: masteredCount, dot: "bg-good" },
              { label: "学习中", value: learningCount, dot: "bg-[#b9b7ff]" },
              { label: "未学习", value: untouched, dot: "bg-[#e5e1d9]" },
            ].map((item) => (
              <li key={item.label} className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", item.dot)} />
                <span className="flex-1 text-muted">{item.label}</span>
                <span className="tabular-nums font-medium">{item.value}</span>
                <span className="w-10 text-right tabular-nums text-muted">
                  {pct(item.value)}%
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-5 rounded-xl bg-paper/80 px-3.5 py-3 text-[11.5px] leading-relaxed text-muted">
            小提示：一个词连续答对 2 次才会被标为「已掌握」，只要答错一次就会退回「学习中」。
          </p>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">词汇表</h2>
            <p className="mt-0.5 text-[11.5px] text-muted">
              共 {rows.length} 个单词 · 按状态筛选或搜索
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索单词或释义"
                className="w-48 rounded-full border border-line bg-surface py-2 pl-8 pr-3 text-[12.5px] outline-none transition-colors focus:border-brand"
              />
            </div>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12px] transition-colors",
                filter === f.key
                  ? "border-brand bg-brand-soft font-medium text-brand-dark"
                  : "border-line bg-surface text-muted hover:text-ink",
              )}
            >
              {f.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1 text-[11px] text-muted">
            {levels.map((lv) => (
              <span key={lv} className="rounded-full bg-paper px-2 py-1">
                {lv}
              </span>
            ))}
          </div>
        </div>

        <div className="max-h-[440px] overflow-y-auto rounded-[22px] border border-line bg-surface">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur">
              <tr className="border-b border-line text-[11px] text-muted">
                <th className="px-4 py-2.5 font-medium">单词</th>
                <th className="px-4 py-2.5 font-medium">释义</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">
                  正确 / 错误
                </th>
                <th className="px-4 py-2.5 text-right font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((w) => {
                const p = progressOf(w.id);
                return (
                  <tr
                    key={w.id}
                    className="border-b border-line/60 text-[13px] last:border-0 hover:bg-paper/50"
                  >
                    <td className="px-4 py-2.5">
                      <span className="font-display text-[15px]">{w.word}</span>
                      <span className="ml-2 text-[10.5px] text-muted">{w.level}</span>
                    </td>
                    <td className="px-4 py-2.5 text-muted">{w.meaning}</td>
                    <td className="hidden px-4 py-2.5 tabular-nums text-muted sm:table-cell">
                      {p ? `${p.correct} / ${p.wrong}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {!p ? (
                        <span className="rounded-full bg-paper px-2.5 py-1 text-[10.5px] text-muted">
                          未学习
                        </span>
                      ) : p.status === "mastered" ? (
                        <span className="rounded-full bg-good-soft px-2.5 py-1 text-[10.5px] text-good">
                          已掌握
                        </span>
                      ) : (
                        <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[10.5px] text-brand">
                          学习中
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-[12.5px] text-muted">
                    没有符合条件的单词
                  </td>
                </tr>
              )}
              {rows.length > limit && (
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => setLimit((n) => n + 60)}
                      className="rounded-full border border-line bg-paper px-4 py-1.5 text-[12px] text-muted transition-colors hover:border-brand/40 hover:text-brand"
                    >
                      再显示 60 个（还有 {rows.length - limit} 个）
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 rounded-[22px] border border-line bg-surface px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium">词库</p>
            <p className="mt-0.5 text-[11.5px] text-muted">
              {installed.length
                ? `已装 ${installed.length} 个包 · ${installedCount.toLocaleString()} 词 · 占用 ${formatBytes(installedBytes)}`
                : "还没装词包，当前只有内置的 60 个手写词"}
            </p>
          </div>
          <button
            type="button"
            onClick={openDialog}
            className="rounded-full border border-line bg-paper px-4 py-1.5 text-[12px] text-muted transition-colors hover:border-brand/40 hover:text-brand"
          >
            {installed.length ? "管理词库" : "去下载词库"}
          </button>
        </div>
        {installed.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {installed.map((p) => (
              <span
                key={p.id}
                className="rounded-full bg-paper px-2.5 py-1 text-[11px] text-muted"
              >
                {p.id} · {p.count.toLocaleString()} 词
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-line bg-surface px-5 py-4">
        <div>
          <p className="text-[13px] font-medium">清空学习记录</p>
          <p className="mt-0.5 text-[11.5px] text-muted">
            会删除本地的全部进度、打卡与答题数据，操作不可恢复。
          </p>
        </div>
        {confirming ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                reset();
                setConfirming(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-bad px-4 py-2 text-[12.5px] font-medium text-white"
            >
              <Trash2 size={13} />
              确认清空
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-full border border-line px-4 py-2 text-[12.5px] transition-colors hover:bg-paper"
            >
              取消
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#f3d3d0] px-4 py-2 text-[12.5px] font-medium text-bad transition-colors hover:bg-bad-soft"
          >
            <Trash2 size={13} />
            清空数据
          </button>
        )}
      </section>
    </div>
  );
}
