/**
 * ECDICT 字段清洗的公共逻辑，供 build-packs.mjs / build-words.mjs 复用。
 *
 * ECDICT 13 列实测可用性（77 万条全量扫描结果）：
 *   可用   word、translation（5.5% 含 [网络] 需过滤）、tag、bnc/frq、oxford、exchange
 *   不可用 phonetic（仅 28% 有值，70% 是旧式编码如 ә'bændәn）、pos（整列为空）、detail/audio（全空）
 */
import { readFileSync } from "node:fs";

// 纯语法功能词，即使高频也不适合做学习卡片
export const FUNCTION_WORDS = new Set(
  `this that these those they them their theirs there here have has had having
   will would shall should must may might can could been being does doing done
   from with what when where which while who whom whose why how than then them
   into onto upon about above after again against because before below between
   both each every few more most other some such only very also just even ever
   over under until unless though although whether either neither another any
   much many same own off out away back down again once twice`
    .split(/\s+/)
    .filter(Boolean),
);

// ECDICT 词性缩写 → 展示用缩写
const POS_PREFIX = [
  [/^vt\.\s*/, "v."],
  [/^vi\.\s*/, "v."],
  [/^v\.\s*/, "v."],
  [/^n\.\s*/, "n."],
  [/^adj\.\s*/, "adj."],
  [/^a\.\s*/, "adj."],
  [/^adv\.\s*/, "adv."],
  [/^ad\.\s*/, "adv."],
  [/^prep\.\s*/, "prep."],
  [/^conj\.\s*/, "conj."],
  [/^pron\.\s*/, "pron."],
  [/^num\.\s*/, "num."],
  [/^art\.\s*/, "art."],
];

/** 清洗 ECDICT 多行释义：去掉 [医][计][网络] 等领域标注，只留通用义 */
export function cleanTranslation(raw) {
  const lines = (raw || "")
    .split(/\\n|\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("["))
    .map((l) => l.replace(/\[[^\]]{1,4}\]\s*/g, ""));
  if (!lines.length) return null;

  const first = lines[0];
  let pos = "";
  let body = first;
  for (const [re, label] of POS_PREFIX) {
    if (re.test(first)) {
      pos = label;
      body = first.replace(re, "");
      break;
    }
  }

  const segments = body
    .split(/[,，;；]/)
    .map((s) => s.trim())
    .filter(Boolean)
    // 过长的解释性片段截断，卡片上放不下
    .filter((s) => s.length <= 14);

  if (!segments.length) return null;
  const meaning = segments.slice(0, 4).join("；");
  return meaning.length >= 2 ? { pos, meaning } : null;
}

/** 中文释义没标词性时，退回英文释义前缀（ECDICT 的 definition 首段带 n./v./a.） */
export function posFromDefinition(def) {
  const first = (def || "").split(/\\n|\n/)[0].trim();
  for (const [re, label] of POS_PREFIX) {
    if (re.test(first)) return label;
  }
  return "";
}

/** 按考纲标签定级：中考→A2、高考/四级→B1、六级及以上→B2 */
export function levelOfTag(tag) {
  const has = (t) => new RegExp(`\\b${t}\\b`).test(tag || "");
  if (has("zk")) return "A2";
  if (has("gk") || has("cet4")) return "B1";
  if (has("cet6") || has("ky") || has("ielts") || has("toefl") || has("gre")) return "B2";
  return null;
}

/** 派生词判断：sooner / swimming / correctly 这类不该单独做卡片 */
export function isDerived(w, allWords) {
  // 去后缀后可能剩双写辅音（planning → plann → plan）
  const exists = (base) =>
    !!base &&
    (allWords.has(base) ||
      (/([bdfglmnprt])\1$/.test(base) && allWords.has(base.slice(0, -1))));

  for (const suffix of ["ing", "ed", "er", "est"]) {
    if (!w.endsWith(suffix)) continue;
    const base = w.slice(0, -suffix.length);
    // -er/-est 只过滤短词，避免误伤 teacher / computer 这类独立词
    if ((suffix === "er" && w.length > 7) || (suffix === "est" && w.length > 8)) continue;
    if (exists(base)) return true;
  }
  return false;
}

/** 读 ipa-dict 的 en_UK 表，词 → IPA（一个词多读音取第一个） */
export function loadIpaMap(path) {
  const map = new Map();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    const w = line.slice(0, tab).trim().toLowerCase();
    const ipa = line.slice(tab + 1).trim();
    if (w && ipa && !map.has(w)) map.set(w, ipa.split(",")[0].trim());
  }
  return map;
}
