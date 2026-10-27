"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Database,
  Loader2,
  Trash2,
  WifiOff,
  X,
} from "lucide-react";
import { useWords } from "@/lib/words-context";
import { formatBytes } from "@/lib/wordpack";

const ONBOARD_KEY = "wordloop:packs:onboarded:v1";

export function PackDialog() {
  const {
    ready,
    persistent,
    installed,
    manifest,
    sources,
    sourceLabels,
    installing,
    progress,
    errors,
    dialogOpen,
    openDialog,
    closeDialog,
    install,
    remove,
    refreshManifest,
  } = useWords();

  const [selected, setSelected] = useState<string[]>([]);
  const [failed, setFailed] = useState<string[]>([]);

  const installedIds = useMemo(() => new Set(installed.map((p) => p.id)), [installed]);
  const primary = sources[0];

  // 首次访问：已读过 IndexedDB、清单拿到了、一个包都没装过 → 主动弹窗征求许可
  useEffect(() => {
    if (!ready || !manifest || installed.length) return;
    let seen = false;
    try {
      seen = !!window.localStorage.getItem(ONBOARD_KEY);
    } catch {
      /* 隐私模式读不到，当作没看过 */
    }
    if (!seen) openDialog();
  }, [ready, manifest, installed.length, openDialog]);

  // 弹窗打开时锁掉背景滚动
  useEffect(() => {
    if (!dialogOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [dialogOpen]);

  useEffect(() => {
    if (!dialogOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDialog();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialogOpen, closeDialog]);

  const markOnboarded = useCallback(() => {
    try {
      window.localStorage.setItem(ONBOARD_KEY, "1");
    } catch {
      /* noop */
    }
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const chosen = (manifest?.packs ?? []).filter(
    (p) => selected.includes(p.id) && !installedIds.has(p.id),
  );
  const chosenBytes = chosen.reduce((s, p) => s + p.bytes, 0);
  const chosenCount = chosen.reduce((s, p) => s + p.count, 0);

  const start = async () => {
    if (!chosen.length || installing) return;
    markOnboarded();
    const bad = await install(chosen.map((p) => p.id));
    setFailed(bad);
    if (!bad.length) setSelected([]);
  };

  const skip = () => {
    markOnboarded();
    closeDialog();
  };

  if (!dialogOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="关闭"
        onClick={installing ? undefined : closeDialog}
        className="absolute inset-0 cursor-default bg-ink/45 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pack-dialog-title"
        className="relative flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-[0_24px_80px_-24px_rgba(22,24,29,0.35)]"
      >
        <div className="flex items-start gap-3 border-b border-line px-6 pb-5 pt-6">
          <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
            <Database size={17} />
          </div>
          <div className="flex-1">
            <h2 id="pack-dialog-title" className="font-display text-[19px] leading-tight">
              下载词库到你本机
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
              {primary?.remote ? (
                <>
                  词库不随网站打包，直接从 <span className="text-ink/80">{primary.label}</span>{" "}
                  开源 CDN 拉取，存进你本机浏览器。装完断网也能背。
                </>
              ) : (
                <>词库不随网站打包，需要你勾选后下载。数据只存本地浏览器，装完断网也能继续背。</>
              )}
            </p>
          </div>
          {!installing && (
            <button
              type="button"
              onClick={closeDialog}
              aria-label="关闭"
              className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-paper hover:text-ink"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!persistent && (
            <div className="mb-3 flex items-start gap-2 rounded-xl bg-accent-soft px-3.5 py-2.5 text-[11.5px] leading-relaxed text-ink/80">
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-accent" />
              <span>
                浏览器禁用了本地存储（隐私模式或被扩展拦截），词包只能本次会话临时生效，刷新后需要重新下载。
              </span>
            </div>
          )}
          {!manifest ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <WifiOff size={22} className="text-muted" />
              <p className="text-[13px] text-muted">取不到词库清单，请检查网络后重试</p>
              <button
                type="button"
                onClick={() => void refreshManifest()}
                className="rounded-full border border-line px-4 py-1.5 text-[12.5px] text-ink transition-colors hover:bg-paper"
              >
                重新获取
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {manifest.packs.map((pack) => {
                const done = installedIds.has(pack.id);
                const inst = installed.find((p) => p.id === pack.id);
                const ratio = progress[pack.id];
                const ratioKnown = typeof ratio === "number";
                const busy = installing && ratio !== undefined;
                const err = errors[pack.id];
                const via = sourceLabels[pack.id];

                return (
                  <div
                    key={pack.id}
                    className={
                      "rounded-xl border px-4 py-3 transition-colors " +
                      (done
                        ? "border-good/30 bg-good-soft/50"
                        : "border-line bg-paper/40")
                    }
                  >
                    <div className="flex items-center gap-3">
                      {done ? (
                        <span className="grid size-5 shrink-0 place-items-center rounded-md bg-good text-white">
                          <Check size={13} strokeWidth={3} />
                        </span>
                      ) : (
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={selected.includes(pack.id)}
                          aria-label={pack.name}
                          disabled={installing}
                          onClick={() => toggle(pack.id)}
                          className={
                            "grid size-5 shrink-0 place-items-center rounded-md border transition-colors " +
                            (selected.includes(pack.id)
                              ? "border-brand bg-brand text-white"
                              : "border-line bg-surface hover:border-brand/50")
                          }
                        >
                          {selected.includes(pack.id) && <Check size={13} strokeWidth={3} />}
                        </button>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-[13.5px] font-medium text-ink">{pack.name}</span>
                          <span className="text-[11.5px] text-muted">{pack.subtitle}</span>
                        </div>
                        <div className="mt-0.5 text-[11.5px] text-muted">
                          {pack.count.toLocaleString()} 词 · {formatBytes(pack.bytes)}
                          {done && <span className="text-good"> · 已装到本机</span>}
                          {done && inst?.source && (
                            <span className="text-muted/70"> · 来自 {inst.source}</span>
                          )}
                        </div>
                      </div>

                      {done && (
                        <button
                          type="button"
                          onClick={() => void remove(pack.id)}
                          disabled={installing}
                          aria-label={`删除${pack.name}`}
                          className="grid size-7 place-items-center rounded-lg text-muted transition-colors hover:bg-bad-soft hover:text-bad disabled:opacity-40"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      {busy && !done && (
                        <Loader2 size={15} className="shrink-0 animate-spin text-brand" />
                      )}
                    </div>

                    {busy && !done && (
                      <div className="mt-2.5">
                        <div className="h-1 overflow-hidden rounded-full bg-line">
                          <div
                            className="h-full rounded-full bg-brand transition-[width] duration-200"
                            style={{ width: ratioKnown ? `${Math.round((ratio as number) * 100)}%` : "35%" }}
                          />
                        </div>
                        <div className="mt-1 text-[11px] text-muted">
                          {ratioKnown
                            ? `从 ${via ?? "本站"} 下载中 ${Math.round((ratio as number) * 100)}%`
                            : "正在连接…"}
                        </div>
                      </div>
                    )}

                    {err && (
                      <div className="mt-2 flex items-start gap-1.5 text-[11.5px] text-bad">
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                        <span>{err}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {failed.length > 0 && (
            <p className="mt-3 text-[11.5px] text-bad">
              有 {failed.length} 个包没装成功，可以重新勾选再试一次。
            </p>
          )}
        </div>

        <div className="border-t border-line bg-paper/60 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12px] text-muted">
              {chosen.length
                ? `已选 ${chosen.length} 个包 · 约 ${chosenCount.toLocaleString()} 词 · ${formatBytes(chosenBytes)}`
                : installed.length
                  ? `已装 ${installed.length} 个包，也可以再补几个`
                  : "勾选你需要的词库"}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={skip}
                disabled={installing}
                className="rounded-full px-4 py-2 text-[12.5px] text-muted transition-colors hover:text-ink disabled:opacity-40"
              >
                {installed.length ? "关闭" : "先用内置 60 词"}
              </button>
              <button
                type="button"
                onClick={() => void start()}
                disabled={!chosen.length || installing}
                className="inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-[12.5px] font-medium text-white transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {installing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    下载中
                  </>
                ) : (
                  <>
                    下载并开始
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 没装词包时在页面顶部挂一条提示，点开弹窗 */
export function PackNudge() {
  const { ready, installed, manifest, openDialog } = useWords();
  if (!ready || installed.length > 0) return null;
  const total = manifest?.unique ?? 0;

  return (
    <button
      type="button"
      onClick={openDialog}
      className="mb-5 flex w-full items-center gap-2.5 rounded-xl border border-dashed border-line bg-surface/70 px-4 py-2.5 text-left transition-colors hover:border-brand/40 hover:bg-surface"
    >
      <Database size={14} className="shrink-0 text-brand" />
      <span className="flex-1 text-[12.5px] text-muted">
        现在只有内置的 60 个词
        {total > 0 && `，还可以下载 ${total.toLocaleString()} 个考纲词`}
      </span>
      <span className="shrink-0 text-[12px] font-medium text-brand">去下载</span>
    </button>
  );
}
