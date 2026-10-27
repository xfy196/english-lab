/**
 * 词包（word pack）的浏览器端存取层。
 *
 * 设计：
 * - 词库存 IndexedDB，不进 JS bundle，装过一次之后断网也能用
 * - 词包本体托管在开源平台（GitHub + jsDelivr 等公共 CDN），本站不承担这 1MB 流量
 * - 下载走流式读取，能报告进度、能中止；一条通道失败自动换下一条
 * - 落地前校验 sha256，避免拿到半截或被篡改的文件（镜像被污染也拦得住）
 * - IndexedDB 不可用（隐私模式）时降级为内存态，本次会话内可用但刷新即消失
 */

import {
  basesFromEnv,
  joinUrl,
  manifestUrl,
  resolveSources,
  type PackSource,
} from "@/lib/pack-source";

/** 词包里的单条单词：紧凑数组，比对象省约 40% 体积 */
export type PackWord = [
  word: string,
  phonetic: string,
  pos: string,
  meaning: string,
  level: string,
];

export type PackMeta = {
  id: string;
  name: string;
  subtitle: string;
  level: string;
  count: number;
  bytes: number;
  /** 旧字段：相对站点的路径，形如 /packs/zk.20261027.json */
  url: string;
  /** 新字段：文件名，配合来源基址拼绝对地址；缺省时从 url 里取 */
  file?: string;
  sha256: string;
};

export type Manifest = {
  v: number;
  version: string;
  builtAt: string;
  seed: number;
  /** 跨包去重后的单词总数 */
  unique: number;
  /** 词包所在的开源平台基址，可写单个或数组；不填则走同源 */
  cdn?: string | string[];
  packs: PackMeta[];
};

export type InstalledPack = {
  id: string;
  version: string;
  count: number;
  bytes: number;
  savedAt: number;
  /** 实际下载通道的名字，例如 "jsDelivr" */
  source?: string;
  words: PackWord[];
};

export type ManifestResult = {
  manifest: Manifest;
  /** 按优先级排好的下载通道，下载时逐个尝试 */
  sources: PackSource[];
  /** 清单实际是从哪个通道取到的 */
  from: PackSource;
};

const DB_NAME = "wordloop-packs";
const DB_VERSION = 1;
const STORE = "packs";
/** IndexedDB 不可用时（隐私模式 / 老浏览器）退回内存 Map */
const memory = new Map<string, InstalledPack>();
let dbBroken = false;

// 有些环境（隐私模式、被扩展拦截、部分 WebView）indexedDB.open 既不 resolve 也不 reject，
// 会永久挂起并让整个应用卡在“未就绪”。所以每步都加超时，超时就当不可用、退回内存。
const OPEN_TIMEOUT = 2500;
const REQ_TIMEOUT = 8000;

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(msg)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

function openDb(): Promise<IDBDatabase> {
  const p = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB 不可用"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("打开 IndexedDB 失败"));
    req.onblocked = () => reject(new Error("IndexedDB 被其他标签页占用"));
  });
  return withTimeout(p, OPEN_TIMEOUT, "打开 IndexedDB 超时");
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    const req = new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const r = fn(tx.objectStore(STORE));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error ?? new Error("IndexedDB 操作失败"));
    });
    return await withTimeout(req, REQ_TIMEOUT, "IndexedDB 读写超时");
  } finally {
    db.close();
  }
}

/** 本地存储是否可用。不可用时词包只存在内存里，刷新即失效 */
export function storageIsPersistent(): boolean {
  return !dbBroken;
}

export async function listInstalled(): Promise<InstalledPack[]> {
  if (dbBroken) return [...memory.values()];
  try {
    const rows = await withStore<InstalledPack[]>("readonly", (s) => s.getAll());
    return rows ?? [];
  } catch {
    dbBroken = true;
    return [...memory.values()];
  }
}

async function saveInstalled(pack: InstalledPack): Promise<void> {
  if (!dbBroken) {
    try {
      await withStore("readwrite", (s) => s.put(pack));
      return;
    } catch {
      dbBroken = true;
    }
  }
  memory.set(pack.id, pack);
}

export async function removeInstalled(id: string): Promise<void> {
  memory.delete(id);
  if (dbBroken) return;
  try {
    await withStore("readwrite", (s) => s.delete(id));
  } catch {
    dbBroken = true;
  }
}

export async function clearInstalled(): Promise<void> {
  memory.clear();
  if (dbBroken) return;
  try {
    await withStore("readwrite", (s) => s.clear());
  } catch {
    dbBroken = true;
  }
}

/**
 * 拉清单。先问本站（快、同源），拿不到再去环境变量里配的开源基址找。
 * 清单里如果声明了 cdn，就顺手把下载通道链算好返回，供后续下载复用。
 */
export async function fetchManifest(signal?: AbortSignal): Promise<ManifestResult> {
  const candidates = ["", ...basesFromEnv()];
  const failures: string[] = [];

  for (const base of candidates) {
    try {
      const res = await fetch(manifestUrl(base), { cache: "no-store", signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as Manifest;
      if (!json || !Array.isArray(json.packs) || !json.packs.length) {
        throw new Error("清单格式不正确");
      }
      const sources = resolveSources(json.cdn, { from: base, extra: base ? [] : undefined });
      return {
        manifest: json,
        sources,
        from: sources.find((s) => s.base === base) ?? sources[sources.length - 1],
      };
    } catch (e) {
      if (signal?.aborted) throw new Error("已取消");
      failures.push(`${base || "本站"}：${e instanceof Error ? e.message : "获取失败"}`);
    }
  }

  throw new Error(`清单请求失败（${failures.join("；")}）`);
}

async function sha256Hex(buf: ArrayBuffer): Promise<string | null> {
  // crypto.subtle 只在安全上下文可用（https 或 localhost），拿不到就跳过校验
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  try {
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

export type DownloadOptions = {
  /** 0~1，拿不到 content-length 时为 null（不确定进度） */
  onProgress?: (ratio: number | null, loaded: number, total: number) => void;
  /** 每次切换下载通道时回调，界面上可以显示“正在从 jsDelivr 下载” */
  onAttempt?: (source: PackSource) => void;
  /** 下载通道链；缺省时只用同源 */
  sources?: PackSource[];
  signal?: AbortSignal;
};

/** 单条通道的上限，别让一个挂掉的镜像把整个下载拖到超时 */
const PER_SOURCE_TIMEOUT = 30_000;

async function fetchFromSource(
  source: PackSource,
  meta: PackMeta,
  { onProgress, signal }: DownloadOptions,
): Promise<InstalledPack> {
  const url = joinUrl(source.base, meta.file ?? meta.url);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PER_SOURCE_TIMEOUT);
  const relay = () => ctrl.abort();
  signal?.addEventListener("abort", relay);

  let res: Response;
  try {
    res = await fetch(url, { cache: "force-cache", signal: ctrl.signal });
  } catch (e) {
    if (signal?.aborted) throw new Error("已取消");
    if (ctrl.signal.aborted) throw new Error("连接超时");
    throw e instanceof Error ? e : new Error("请求失败");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", relay);
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const declared = Number(res.headers.get("content-length") || 0) || meta.bytes || 0;
  let received = 0;
  const chunks: Uint8Array[] = [];

  if (res.body) {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.byteLength;
        onProgress?.(declared ? Math.min(received / declared, 1) : null, received, declared);
      }
    }
  } else {
    // 极老的浏览器没有流式 body，退化成一次性读取
    const buf = await res.arrayBuffer();
    chunks.push(new Uint8Array(buf));
    received = buf.byteLength;
    onProgress?.(1, received, received);
  }

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }

  const actual = await sha256Hex(merged.buffer as ArrayBuffer);
  if (actual && meta.sha256 && actual !== meta.sha256) {
    throw new Error("sha256 校验不通过，文件可能被篡改或不完整");
  }

  let parsed: { v: number; id: string; version: string; words: PackWord[] };
  try {
    parsed = JSON.parse(new TextDecoder().decode(merged));
  } catch {
    throw new Error("数据损坏，无法解析");
  }
  if (!Array.isArray(parsed.words) || !parsed.words.length) {
    throw new Error("内容为空");
  }

  const pack: InstalledPack = {
    id: meta.id,
    version: parsed.version || "",
    count: parsed.words.length,
    bytes: received,
    savedAt: Date.now(),
    source: source.label,
    words: parsed.words,
  };
  await saveInstalled(pack);
  return pack;
}

/**
 * 下载并落库一个词包。
 * 通道链里任何一条成功即可；全部失败才抛错，错误里会带上每条通道的原因。
 */
export async function downloadPack(
  meta: PackMeta,
  opts: DownloadOptions = {},
): Promise<InstalledPack> {
  const chain =
    opts.sources && opts.sources.length
      ? opts.sources
      : [{ base: "", label: "本站", remote: false } satisfies PackSource];

  const failures: string[] = [];
  for (const source of chain) {
    if (opts.signal?.aborted) throw new Error("已取消");
    try {
      opts.onAttempt?.(source);
      return await fetchFromSource(source, meta, opts);
    } catch (e) {
      if (opts.signal?.aborted) throw new Error("已取消");
      failures.push(`${source.label}：${e instanceof Error ? e.message : "下载失败"}`);
    }
  }

  const detail = failures.join("；");
  throw new Error(
    failures.length > 1 ? `${meta.name}所有通道都失败了（${detail}）` : `${meta.name}${detail}`,
  );
}

/** 人类可读的体积 */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
