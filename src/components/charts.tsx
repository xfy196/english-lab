"use client";

import { cn } from "@/lib/utils";

type Point = { label: string; count: number };

export function TrendChart({ data }: { data: Point[] }) {
  const W = 560;
  const H = 190;
  const pad = { top: 16, right: 16, bottom: 26, left: 16 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = Math.max(6, ...data.map((d) => d.count));
  const n = Math.max(1, data.length);
  const step = n > 1 ? innerW / (n - 1) : 0;

  const points = data.map((d, i) => ({
    x: pad.left + i * step,
    y: pad.top + innerH - (d.count / max) * innerH,
    ...d,
  }));

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${points[points.length - 1].x.toFixed(1)},${(
    pad.top + innerH
  ).toFixed(1)} L${points[0].x.toFixed(1)},${(pad.top + innerH).toFixed(1)} Z`;

  const last = points[points.length - 1];

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img">
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5b5bf5" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#5b5bf5" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((t) => (
          <line
            key={t}
            x1={pad.left}
            x2={W - pad.right}
            y1={pad.top + innerH * t}
            y2={pad.top + innerH * t}
            stroke="#f0ece5"
            strokeWidth="1"
            strokeDasharray={t === 1 ? "0" : "4 5"}
          />
        ))}

        <path d={area} fill="url(#trend-fill)" />
        <path
          d={line}
          fill="none"
          stroke="#5b5bf5"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((p, i) => (
          <circle
            key={p.label + i}
            cx={p.x}
            cy={p.y}
            r={i === points.length - 1 ? 4.5 : 2.6}
            fill={i === points.length - 1 ? "#5b5bf5" : "#ffffff"}
            stroke="#5b5bf5"
            strokeWidth="2"
          />
        ))}

        {data.map((d, i) =>
          (i % 2 === 0 && i < data.length - 2) || i === data.length - 1 ? (
            <text
              key={d.label + i}
              x={points[i].x}
              y={H - 7}
              textAnchor={
                i === 0
                  ? "start"
                  : i === data.length - 1
                    ? "end"
                    : "middle"
              }
              style={{ fontSize: 10, fill: "#a8a29a" }}
            >
              {d.label}
            </text>
          ) : null,
        )}

        <text
          x={last.x}
          y={Math.max(11, last.y - 11)}
          textAnchor={last.x > W - 40 ? "end" : "middle"}
          style={{ fontSize: 11, fill: "#5b5bf5", fontWeight: 600 }}
        >
          {last.count}
        </text>
      </svg>
    </div>
  );
}

export function WeekBars({
  data,
}: {
  data: { label: string; count: number; isToday: boolean }[];
}) {
  const max = Math.max(6, ...data.map((d) => d.count));
  return (
    <div className="flex h-[132px] items-end gap-2.5">
      {data.map((d) => {
        const h = Math.max(6, (d.count / max) * 96);
        return (
          <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
            <span
              className={cn(
                "text-[10.5px] tabular-nums",
                d.isToday ? "font-semibold text-brand" : "text-muted",
              )}
            >
              {d.count || ""}
            </span>
            <div className="flex w-full flex-1 items-end">
              <div
                className={cn(
                  "w-full rounded-t-[7px] transition-[height] duration-700",
                  d.isToday
                    ? "bg-linear-to-t from-brand to-[#8b8bfa]"
                    : d.count > 0
                      ? "bg-[#dcdaff]"
                      : "bg-[#f1eee8]",
                )}
                style={{ height: h }}
              />
            </div>
            <span
              className={cn(
                "text-[11px]",
                d.isToday ? "font-semibold text-ink" : "text-muted",
              )}
            >
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
