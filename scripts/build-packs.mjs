/**
 * 按考纲把 ECDICT 切成 5 个静态词包，输出到 public/packs/。
 *
 * 用法：
 *   node scripts/build-packs.mjs --dry-run   只打印统计
 *   node scripts/build-packs.mjs             写入 public/packs/
 *
 * 产物：
 *   public/packs/index.json          清单（含每个包的词数、字节数、sha256）
 *   public/packs/<id>.<版本>.json     词包，文件名带版本号，可永久缓存
 *
 * 词包格式（刻意压成数组，一列一个字段，比对象省约 40% 体积）：
 *   { "v": 1, "id": "cet4", "words": [["abandon","/əˈbændən/","v.","放弃；抛弃","A2"], ...] }
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv.mjs";
import { normalizeIpa } from "./ipa.mjs";
import {
  FUNCTION_WORDS,
  cleanTranslation,
  isDerived,
  levelOfTag,
  loadIpaMap,
  posFromDefinition,
} from "./ecdict-lib.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const DRY = process.argv.includes("--dry-run");

// 版本号进文件名，词库更新时换个日期即可让浏览器重新拉取
const VERSION = new Date().toISOString().slice(0, 10).replace(/-/g, "");

// 单包上限，防止某个考纲包过大
const MAX_PER_PACK = 5000;

const PACKS = [
  { id: "zk", name: "中考核心词", subtitle: "初中毕业 / 中考大纲", tag: "zk", level: "A2" },
  { id: "gk", name: "高考核心词", subtitle: "高中 / 高考大纲", tag: "gk", level: "B1" },
  { id: "cet4", name: "四级核心词", subtitle: "大学英语四级", tag: "cet4", level: "B1" },
  { id: "cet6", name: "六级核心词", subtitle: "大学英语六级", tag: "cet6", level: "B2" },
  { id: "ky", name: "考研核心词", subtitle: "考研英语大纲", tag: "ky", level: "B2" },
];

const ipaMap = loadIpaMap(root + ".ecdict/ipa-en_UK.txt");

// 手写词已随站点内置，不重复打进包里
const seedWords = new Set(
  [...readFileSync(root + "src/data/curated.ts", "utf8").matchAll(/word: "([^"]+)"/g)].map((m) =>
    m[1].toLowerCase(),
  ),
);

// ---------- 第一遍：收集全库单词集合，用于派生词判断 ----------
const allWords = new Set();
await parseCsv(root + ".ecdict/ecdict.csv", (r) => {
  const w = (r.word || "").trim().toLowerCase();
  if (/^[a-z]{3,14}$/.test(w)) allWords.add(w);
});

// ---------- 第二遍：按考纲分桶 ----------
const buckets = Object.fromEntries(PACKS.map((p) => [p.id, []]));
const skipped = { badWord: 0, funcWord: 0, seed: 0, derived: 0, noIpa: 0, noMeaning: 0, noTag: 0 };
let total = 0;

await parseCsv(root + ".ecdict/ecdict.csv", (r) => {
  total++;
  const w = (r.word || "").trim().toLowerCase();
  const tag = (r.tag || "").trim();

  if (!/^[a-z]{4,12}$/.test(w)) return skipped.badWord++;
  if (FUNCTION_WORDS.has(w)) return skipped.funcWord++;
  if (seedWords.has(w)) return skipped.seed++;
  if (!tag) return skipped.noTag++;
  if (!ipaMap.has(w)) return skipped.noIpa++;
  if (isDerived(w, allWords)) return skipped.derived++;

  const clean = cleanTranslation(r.translation || "");
  if (!clean) return skipped.noMeaning++;

  const level = levelOfTag(tag);
  if (!level) return skipped.noTag++;

  const bnc = Number(r.bnc || 0);
  const frq = Number(r.frq || 0);
  const rank = bnc > 0 ? bnc : frq > 0 ? frq + 100000 : 0;

  const phonetic = normalizeIpa(ipaMap.get(w));
  if (!phonetic) return skipped.noIpa++;

  const entry = {
    row: [w, phonetic, clean.pos || posFromDefinition(r.definition), clean.meaning, level],
    rank,
    oxford: r.oxford === "1",
  };

  for (const pack of PACKS) {
    if (new RegExp(`\\b${pack.tag}\\b`).test(tag)) buckets[pack.id].push(entry);
  }
});

// ---------- 排序取词 ----------
mkdirSync(root + "public/packs", { recursive: true });

// 重新生成时保留清单里已配置的 CDN 基址，别把发布配置冲掉
let prevCdn;
try {
  prevCdn = JSON.parse(readFileSync(root + "public/packs/index.json", "utf8")).cdn;
} catch {
  prevCdn = undefined;
}

const manifest = { v: 1, version: VERSION, builtAt: new Date().toISOString(), seed: seedWords.size, packs: [] };
if (prevCdn) manifest.cdn = prevCdn;

console.log(`ECDICT 总记录 ${total}`);
console.log(
  `跳过：非纯字母 ${skipped.badWord} / 功能词 ${skipped.funcWord} / 已内置 ${skipped.seed} / ` +
    `派生词 ${skipped.derived} / 无 IPA ${skipped.noIpa} / 释义空 ${skipped.noMeaning} / 无考纲标签 ${skipped.noTag}`,
);
console.log("");

for (const pack of PACKS) {
  const list = buckets[pack.id]
    .sort((a, b) => Number(b.oxford) - Number(a.oxford) || a.rank - b.rank)
    .slice(0, MAX_PER_PACK);
  const words = list.map((e) => e.row);

  const payload = JSON.stringify({ v: 1, id: pack.id, version: VERSION, words });
  const bytes = Buffer.byteLength(payload);
  const sha256 = createHash("sha256").update(payload).digest("hex");
  const file = `${pack.id}.${VERSION}.json`;
  const url = `/packs/${file}`;

  if (!DRY) writeFileSync(root + "public" + url, payload);

  manifest.packs.push({
    id: pack.id,
    name: pack.name,
    subtitle: pack.subtitle,
    level: pack.level,
    count: words.length,
    bytes,
    file,
    url,
    sha256,
  });

  console.log(
    `${pack.id.padEnd(5)} ${pack.name.padEnd(6)} ${String(words.length).padStart(5)} 词  ` +
      `${(bytes / 1024).toFixed(0).padStart(4)}KB  ${url}`,
  );
}

const allBytes = manifest.packs.reduce((s, p) => s + p.bytes, 0);
const uniqueAll = new Set(PACKS.flatMap((p) => buckets[p.id].slice(0, MAX_PER_PACK).map((e) => e.row[0]))).size;

// 跨包大量重叠（六级 ⊃ 四级 ⊃ 高考），单独给出真实去重后的规模
manifest.unique = uniqueAll;

console.log(
  `\n合计 ${manifest.packs.reduce((s, p) => s + p.count, 0)} 词条 / ${(allBytes / 1024 / 1024).toFixed(2)}MB，` +
    `跨包去重后 ${uniqueAll} 个单词`,
);

if (DRY) {
  console.log("\n--dry-run，未写文件");
  process.exit(0);
}

writeFileSync(root + "public/packs/index.json", JSON.stringify(manifest, null, 2) + "\n");
console.log(`\n已写入 public/packs/index.json（版本 ${VERSION}）`);
