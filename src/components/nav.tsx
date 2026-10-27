"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Database,
  Flame,
  Headphones,
  Home,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { useProgress } from "@/lib/store";
import { useWords } from "@/lib/words-context";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
};

const NAV: NavItem[] = [
  { href: "/", label: "今日概览", hint: "Dashboard", icon: Home },
  { href: "/learn", label: "词汇卡片", hint: "Flashcards", icon: Layers },
  { href: "/quiz", label: "听写练习", hint: "Listening", icon: Headphones },
  { href: "/stats", label: "学习数据", hint: "Progress", icon: BarChart3 },
];

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <span
      className="relative grid place-items-center rounded-[14px] bg-linear-to-br from-brand to-[#8b5cf6] text-white shadow-[0_6px_16px_-6px_rgba(91,91,245,0.7)]"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55} fill="none">
        <circle
          cx="12"
          cy="12"
          r="7.2"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeDasharray="30 8"
        />
        <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      </svg>
    </span>
  );
}

/** 词库管理入口：常驻在侧边栏 / 移动端底栏，任何页面都能重新打开下载弹窗 */
function PackNavItem({ compact = false }: { compact?: boolean }) {
  const { ready, installed, installedCount, openDialog } = useWords();

  const hint = !ready ? "" : installed.length ? `${installed.length} 个包` : "未下载";
  const dot = ready && installed.length > 0;

  if (compact) {
    return (
      <button
        type="button"
        onClick={openDialog}
        aria-label="词库管理"
        className="flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10.5px] font-medium text-muted transition-colors hover:text-brand"
      >
        <span className="relative">
          <Database size={20} strokeWidth={1.9} />
          {dot && (
            <span className="absolute -right-1 -top-0.5 size-1.5 rounded-full bg-good ring-2 ring-surface" />
          )}
        </span>
        词库
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openDialog}
      title={installedCount ? `已装 ${installedCount.toLocaleString()} 词` : "还没有下载词库"}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted transition-colors hover:bg-paper hover:text-ink"
    >
      <Database size={18} strokeWidth={1.9} />
      <span className="flex-1 text-left">词库管理</span>
      <span className="text-[10px] tracking-wide text-muted/50">{hint}</span>
    </button>
  );
}

function NavLinks({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className={cn(compact ? "flex flex-1 items-stretch justify-around" : "mt-8 flex flex-col gap-1.5")}>
      {NAV.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        if (compact) {
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10.5px] font-medium transition-colors",
                active ? "text-brand" : "text-muted",
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 1.9} />
              {item.label}
            </Link>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
              active
                ? "bg-brand-soft font-semibold text-brand-dark"
                : "text-muted hover:bg-paper hover:text-ink",
            )}
          >
            <Icon size={18} strokeWidth={active ? 2.3 : 1.9} />
            <span className="flex-1">{item.label}</span>
            <span
              className={cn(
                "text-[10px] tracking-wide",
                active ? "text-brand/60" : "text-muted/50",
              )}
            >
              {item.hint}
            </span>
            {active && (
              <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-brand" />
            )}
          </Link>
        );
      })}
      {compact && <PackNavItem compact />}
    </nav>
  );
}

export function Sidebar() {
  const { streak, today, masteredCount } = useProgress();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[252px] flex-col border-r border-line bg-surface px-5 py-7 lg:flex">
      <Link href="/" className="flex items-center gap-3">
        <Logo />
        <span className="flex flex-col">
          <span className="text-[17px] font-semibold tracking-tight">
            WordLoop
          </span>
          <span className="text-[11px] text-muted">每天十分钟 · 记住一个词</span>
        </span>
      </Link>

      <NavLinks />

      <div className="mt-1.5 border-t border-line/70 pt-1.5">
        <PackNavItem />
      </div>

      <div className="mt-auto space-y-3">
        <div className="rounded-2xl border border-line bg-paper/70 p-3.5">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <Flame size={15} className="text-accent" />
            连续学习 {streak} 天
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
            今天已学 {today.learned} 个新词
            {today.reviewed > 0 ? ` · 复习 ${today.reviewed} 个` : ""}
          </p>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-linear-to-r from-brand to-[#8b5cf6] transition-[width] duration-500"
              style={{
                width: `${Math.min(100, (today.learned / 12) * 100)}%`,
              }}
            />
          </div>
        </div>
        <p className="px-1 text-[11px] text-muted">
          已掌握 {masteredCount} 个单词 · 数据保存在本地
        </p>
      </div>
    </aside>
  );
}

export function MobileNav() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="flex h-[62px] items-stretch px-2">
        <NavLinks compact />
      </div>
    </div>
  );
}
