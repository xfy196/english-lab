/**
 * 词包来源解析。
 *
 * 词包本体不放在本站服务器上，而是发布到开源托管平台（GitHub 仓库 + jsDelivr /
 * ghfast 这类公共 CDN），浏览器直接从那边拉、存进 IndexedDB。站点最多只托管
 * 一个 1.6KB 的 index.json，用来告诉前端“这一版词包在哪个 CDN”。
 *
 * 来源按优先级排成一条链：
 *   1. index.json 里声明的 cdn（发布者维护，改它不用重新构建前端）
 *   2. NEXT_PUBLIC_PACK_BASE 环境变量（构建时内联，用于完全不自建服务器）
 *   3. 同源 /packs（本地开发、或没配 CDN 时的兜底）
 *
 * 无论从哪条通道下载，落地前都要过 sha256，所以镜像被污染也拦得住。
 */

export type PackSource = {
  /** 基址，末尾不带斜杠；空字符串表示同源 */
  base: string;
  /** 界面上显示的名字 */
  label: string;
  /** 是否来自外部开源平台 */
  remote: boolean;
};

const HOST_LABEL: Record<string, string> = {
  "cdn.jsdelivr.net": "jsDelivr",
  "fastly.jsdelivr.net": "jsDelivr",
  "gcore.jsdelivr.net": "jsDelivr",
  "testingcf.jsdelivr.net": "jsDelivr",
  "raw.githubusercontent.com": "GitHub",
  "objects.githubusercontent.com": "GitHub",
  "ghfast.top": "ghfast 加速",
  "ghproxy.net": "ghproxy 加速",
  "unpkg.com": "unpkg",
  "cdn.statically.io": "Statically",
};

/** 给一个 URL 起个短名字，用于「来自 jsDelivr」这类文案 */
export function labelForBase(base: string): string {
  if (!base) return "本站";
  try {
    const host = new URL(base).hostname;
    if (HOST_LABEL[host]) return HOST_LABEL[host];
    // ghfast.top/https://raw.githubusercontent.com/... 这类代理，看被代理的域名
    if (host === "ghfast.top" || host === "ghproxy.net") return HOST_LABEL[host];
    return host;
  } catch {
    return "外部源";
  }
}

/** 逗号 / 空白分隔的基址串 → 干净的去重列表 */
export function parseBases(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const piece of raw.split(/[,\s]+/)) {
    const base = piece.trim().replace(/\/+$/, "");
    if (!base || seen.has(base)) continue;
    seen.add(base);
    out.push(base);
  }
  return out;
}

/** 清单里声明的 cdn，允许写成单个字符串或数组 */
export function basesFromManifest(cdn: string | string[] | undefined): string[] {
  if (!cdn) return [];
  return parseBases(Array.isArray(cdn) ? cdn.join(",") : cdn);
}

/** 构建时通过 NEXT_PUBLIC_PACK_BASE 注入的基址 */
export function basesFromEnv(): string[] {
  return parseBases(process.env.NEXT_PUBLIC_PACK_BASE);
}

function toSource(base: string): PackSource {
  return { base, label: labelForBase(base), remote: base !== "" };
}

/**
 * 把三类来源拼成一条按优先级排序的通道链。
 * `from` 是清单本身被取到的基址，保证「清单从哪来、包就从哪下」，
 * 避免清单在一个镜像上、包却跑到另一个不可达的镜像。
 */
export function resolveSources(
  cdn: string | string[] | undefined,
  opts: { from?: string; extra?: string[] } = {},
): PackSource[] {
  const ordered = [...basesFromManifest(cdn), ...(opts.extra ?? []), ...basesFromEnv()];
  // 清单若来自远程，那个远程排到最前（清单和包在同一个镜像上，最省事）。
  // 清单来自本站时不提升优先级——否则同源会永远抢在 CDN 前面，站点流量省不下来。
  if (opts.from) ordered.unshift(opts.from);

  const seen = new Set<string>();
  const out: PackSource[] = [];
  for (const base of ordered) {
    const key = base || "/";
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(toSource(base));
  }
  // 同源永远垫底：别的都失败了，至少本地 public/packs 还能救一下
  if (!seen.has("/")) out.push(toSource(""));
  return out;
}

/**
 * 拼一个包的真实地址。
 * base 本身已经指向词包目录（.../packs），所以只需拼文件名；
 * path 允许是 `/packs/x.json` 或 `x.json`，两种写法都归一成文件名。
 */
export function joinUrl(base: string, path: string): string {
  const clean = path.replace(/^\/+/, "").replace(/^packs\//, "");
  return base ? `${base}/${clean}` : `/packs/${clean}`;
}

/** 清单地址：同源用相对路径（带时间戳绕缓存），外部源要拼绝对地址 */
export function manifestUrl(base: string): string {
  const bust = `?t=${Date.now()}`;
  return base ? `${base}/index.json${bust}` : `/packs/index.json${bust}`;
}
