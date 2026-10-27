/**
 * 规范化 ipa-dict 的英式音标，使其符合常见词典的书写习惯。
 *
 * 该数据源把重音符号紧邻重读元音之前（`pˈɜːsən`、`kənsˈɪdə`），
 * 而标准写法应落在重读音节的起首辅音之前（`ˈpɜːsən`、`kənˈsɪdə`）。
 * 这里按「最大音节首原则」把重音符号左移到正确位置。
 */

const VOWELS = new Set([
  "a", "e", "i", "o", "u",
  "ɪ", "ʊ", "ɛ", "æ", "ʌ", "ə", "ɜ", "ɔ", "ɒ", "ɑ",
  "ɐ", "ɘ", "ɵ", "œ", "ø", "ɨ", "ʉ", "ɯ", "ɤ",
]);

// 合法的双辅音音节首
const ONSET2 = new Set([
  "pr", "br", "tr", "dr", "kr", "gr", "fr", "θr", "ʃr",
  "pl", "bl", "kl", "gl", "fl", "sl",
  "sp", "st", "sk", "sm", "sn", "sw",
  "tw", "dw", "kw", "gw", "θw", "ʃw",
  // 辅音 + j 的组合（cure、music、tune 等）
  "kj", "gj", "tj", "dj", "sj", "zj", "nj", "lj", "mj", "hj", "fj", "vj", "θj",
]);
// 合法的三辅音音节首
const ONSET3 = new Set(["spr", "str", "skr", "spl", "skl", "spj", "stj", "skj"]);

/** 切分成音素 token：dʒ/tʃ 合并成一个，长音符依附前一 token */
function tokenize(s) {
  const tokens = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const next = s[i + 1];
    if ((c === "d" || c === "t") && (next === "ʒ" || next === "ʃ")) {
      tokens.push(c + next);
      i++;
      continue;
    }
    if (c === "ː") {
      if (tokens.length) tokens[tokens.length - 1] += "ː";
      continue;
    }
    tokens.push(c);
  }
  return tokens;
}

const isVowelTok = (tok) => VOWELS.has(tok[0]);

/** 数音节：连续元音（含双元音）算一组 */
function syllableCount(tokens) {
  let n = 0;
  let prevVowel = false;
  for (const tok of tokens) {
    const v = isVowelTok(tok);
    if (v && !prevVowel) n++;
    prevVowel = v;
  }
  return n;
}

/** 把重音符号左移到重读音节起始处 */
function placeStress(tokens) {
  const idx = tokens.indexOf("ˈ");
  if (idx <= 0) return tokens;

  let start = idx;
  while (start > 0 && !isVowelTok(tokens[start - 1]) && tokens[start - 1] !== "ˈ") start--;

  const cluster = tokens.slice(start, idx);
  let keep;
  if (cluster.length === 0) keep = 0;
  else if (cluster.length >= 3 && ONSET3.has(cluster.slice(-3).join(""))) keep = 3;
  else if (cluster.length >= 2 && ONSET2.has(cluster.slice(-2).join(""))) keep = 2;
  else keep = 1;

  const out = tokens.slice();
  out.splice(idx, 1);
  out.splice(start + cluster.length - keep, 0, "ˈ");
  return out;
}

export function normalizeIpa(raw) {
  if (!raw) return "";
  let s = raw.trim().replace(/^\/+|\/+$/g, "");

  // 次重音在该数据源里标注不稳定，去掉减少视觉噪音
  s = s.replace(/[ˌ.]/g, "");
  // 统一字符：ɹ 是卷舌近音、ɐ 是它对非重读 schwa 的写法
  s = s.replaceAll("ɹ", "r").replaceAll("ɛ", "e").replaceAll("ɐ", "ə");

  let tokens = tokenize(s);
  tokens = placeStress(tokens);

  // 单音节词传统上不标重音
  if (syllableCount(tokens) <= 1) tokens = tokens.filter((t) => t !== "ˈ");

  const out = tokens.join("");
  return out ? `/${out}/` : "";
}
