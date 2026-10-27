import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { normalizeIpa } from "./ipa.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

const ipaMap = new Map();
for (const line of readFileSync(root + ".ecdict/ipa-en_UK.txt", "utf8").split("\n")) {
  const tab = line.indexOf("\t");
  if (tab < 0) continue;
  const w = line.slice(0, tab).trim().toLowerCase();
  const ipa = line.slice(tab + 1).trim();
  if (w && ipa && !ipaMap.has(w)) ipaMap.set(w, ipa.split(",")[0].trim());
}

const src = readFileSync(root + "src/data/curated.ts", "utf8");
const pairs = [...src.matchAll(/word: "([^"]+)",\s*\n\s*phonetic: "([^"]+)"/g)].map((m) => ({
  word: m[1],
  expected: m[2],
}));

const strip = (s) => s.replace(/[/ˈˌːɡə]/g, (c) => (c === "ɡ" ? "g" : ""));
let exact = 0;
let missing = 0;
const bad = [];

for (const { word, expected } of pairs) {
  const raw = ipaMap.get(word.toLowerCase());
  if (!raw) {
    missing++;
    bad.push(`?  ${word.padEnd(14)} 人工 ${expected.padEnd(18)} IPA 表无此词`);
    continue;
  }
  const got = normalizeIpa(raw);
  const ok = strip(got) === strip(expected);
  if (ok) exact++;
  else bad.push(`✗  ${word.padEnd(14)} 人工 ${expected.padEnd(18)} 得到 ${got.padEnd(18)} 原始 ${raw}`);
}

console.log(bad.join("\n"));
console.log(
  `\n共 ${pairs.length} 词：完全一致 ${exact}，不一致 ${bad.length - missing}，IPA 表缺失 ${missing} → 一致率 ${((exact / pairs.length) * 100).toFixed(0)}%`,
);
