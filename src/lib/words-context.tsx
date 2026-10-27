"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SEED_WORDS } from "@/data/words";
import type { Level, Word } from "@/lib/types";
import type { PackSource } from "@/lib/pack-source";
import {
  clearInstalled,
  downloadPack,
  fetchManifest,
  listInstalled,
  removeInstalled,
  storageIsPersistent,
  type InstalledPack,
  type Manifest,
  type PackMeta,
} from "@/lib/wordpack";

const LEVEL_SET = new Set<Level>(["A2", "B1", "B2"]);

function toWord(row: [string, string, string, string, string]): Word | null {
  const [word, phonetic, pos, meaning, level] = row;
  if (!word || !meaning) return null;
  return {
    id: word,
    word,
    phonetic: phonetic || "",
    pos: pos || "—",
    meaning,
    level: LEVEL_SET.has(level as Level) ? (level as Level) : "B1",
  };
}

/** 内置词 + 已装词包，按 id 去重（内置词优先，它带例句） */
function mergeWords(packs: InstalledPack[]): Word[] {
  const seen = new Set<string>(SEED_WORDS.map((w) => w.id));
  const out = [...SEED_WORDS];
  for (const pack of packs) {
    for (const row of pack.words) {
      const w = toWord(row as [string, string, string, string, string]);
      if (!w || seen.has(w.id)) continue;
      seen.add(w.id);
      out.push(w);
    }
  }
  return out;
}

type WordsStore = {
  words: Word[];
  wordMap: Record<string, Word>;
  levels: Level[];
  /** 已从 IndexedDB 读过一次（页面可以据此决定是否渲染真实数据） */
  ready: boolean;
  /** 本地存储可用；为 false 时词包只存在内存，刷新即失效 */
  persistent: boolean;
  installed: InstalledPack[];
  manifest: Manifest | null;
  /** 词包下载通道链（远程开源平台在前，同源兜底） */
  sources: PackSource[];
  /** 正在下载时，每个包当前走的通道名，如 "jsDelivr" */
  sourceLabels: Record<string, string>;
  /** 已装词包的总词数（不含内置词） */
  installedCount: number;
  installedBytes: number;
  /** id → 0~1 或 null（不确定进度） */
  progress: Record<string, number | null>;
  errors: Record<string, string>;
  installing: boolean;
  /** 词库管理弹窗开关（首次访问自动弹出，之后可从导航 / 数据页手动打开） */
  dialogOpen: boolean;
  openDialog: () => void;
  closeDialog: () => void;
  install: (ids: string[]) => Promise<string[]>;
  remove: (id: string) => Promise<void>;
  removeAll: () => Promise<void>;
  refreshManifest: () => Promise<void>;
};

const Ctx = createContext<WordsStore | null>(null);

export function WordProvider({ children }: { children: React.ReactNode }) {
  const [installed, setInstalled] = useState<InstalledPack[]>([]);
  const [ready, setReady] = useState(false);
  const [persistent, setPersistent] = useState(true);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [sources, setSources] = useState<PackSource[]>([]);
  const [sourceLabels, setSourceLabels] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<Record<string, number | null>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [installing, setInstalling] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const booted = useRef(false);

  const openDialog = useCallback(() => setDialogOpen(true), []);
  const closeDialog = useCallback(() => setDialogOpen(false), []);

  const loadInstalled = useCallback(async () => {
    const packs = await listInstalled();
    setInstalled(packs);
    setPersistent(storageIsPersistent());
    return packs;
  }, []);

  const refreshManifest = useCallback(async () => {
    try {
      const { manifest: next, sources: chain } = await fetchManifest();
      setManifest(next);
      setSources(chain);
    } catch {
      // 清单拉不到不影响已装词包使用，静默失败即可
      setManifest(null);
      setSources([]);
    }
  }, []);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void (async () => {
      await loadInstalled();
      setReady(true);
      void refreshManifest();
    })();
  }, [loadInstalled, refreshManifest]);

  const install = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return [];
      const list = manifest?.packs ?? [];
      const targets = ids
        .map((id) => list.find((p) => p.id === id))
        .filter((p): p is PackMeta => !!p);
      if (!targets.length) return [];

      setInstalling(true);
      setErrors({});
      setProgress(Object.fromEntries(targets.map((t) => [t.id, 0])));
      const failed: string[] = [];

      for (const meta of targets) {
        try {
          await downloadPack(meta, {
            sources,
            onProgress: (ratio) => setProgress((p) => ({ ...p, [meta.id]: ratio })),
            onAttempt: (src) =>
              setSourceLabels((prev) => ({ ...prev, [meta.id]: src.label })),
          });
          // 单包完成即刷新，用户能马上看到已装数量变化
          await loadInstalled();
          setProgress((p) => ({ ...p, [meta.id]: 1 }));
        } catch (e) {
          const msg = e instanceof Error ? e.message : "下载失败";
          setErrors((prev) => ({ ...prev, [meta.id]: msg }));
          setProgress((p) => {
            const next = { ...p };
            delete next[meta.id];
            return next;
          });
          failed.push(meta.id);
        }
      }

      setInstalling(false);
      return failed;
    },
    [manifest, sources, loadInstalled],
  );

  const remove = useCallback(
    async (id: string) => {
      await removeInstalled(id);
      await loadInstalled();
    },
    [loadInstalled],
  );

  const removeAll = useCallback(async () => {
    await clearInstalled();
    await loadInstalled();
  }, [loadInstalled]);

  const value = useMemo<WordsStore>(() => {
    const words = mergeWords(installed);
    const wordMap = Object.fromEntries(words.map((w) => [w.id, w]));
    const levels = [...new Set(words.map((w) => w.level))].sort() as Level[];
    return {
      words,
      wordMap,
      levels,
      ready,
      persistent,
      installed,
      manifest,
      sources,
      sourceLabels,
      installedCount: installed.reduce((s, p) => s + p.count, 0),
      installedBytes: installed.reduce((s, p) => s + p.bytes, 0),
      progress,
      errors,
      installing,
      dialogOpen,
      openDialog,
      closeDialog,
      install,
      remove,
      removeAll,
      refreshManifest,
    };
  }, [
    installed,
    ready,
    persistent,
    manifest,
    sources,
    sourceLabels,
    progress,
    errors,
    installing,
    dialogOpen,
    openDialog,
    closeDialog,
    install,
    remove,
    removeAll,
    refreshManifest,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWords() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWords 必须在 WordProvider 内使用");
  return ctx;
}
