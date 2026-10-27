"use client";

import { cn } from "@/lib/utils";

export function ProgressRing({
  value,
  total,
  size = 148,
  stroke = 11,
  children,
}: {
  value: number;
  total: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = total > 0 ? Math.min(1, value / total) : 0;
  const offset = circumference * (1 - ratio);

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5b5bf5" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#eeebe5"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#ring-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function StatTile({
  label,
  value,
  unit,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  tone?: "default" | "brand" | "good" | "accent";
  icon?: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    default: "bg-surface border-line",
    brand: "bg-brand-soft border-[#dcdaff]",
    good: "bg-good-soft border-[#cdeee0]",
    accent: "bg-accent-soft border-[#f8e2ba]",
  };
  return (
    <div className={cn("rounded-2xl border p-4", tones[tone])}>
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-muted">{label}</span>
        {icon}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-[26px] font-semibold leading-none tracking-tight">
          {value}
        </span>
        {unit && <span className="text-[12px] text-muted">{unit}</span>}
      </div>
      {hint && <p className="mt-1.5 text-[11.5px] text-muted">{hint}</p>}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-brand">
            {eyebrow}
          </p>
        )}
        <h1 className="text-[26px] font-semibold tracking-tight lg:text-[30px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-muted">
            {description}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}

export function EmptyHint({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-muted">
        {text}
      </p>
    </div>
  );
}
