/**
 * ECDICT 音标字段是旧式 ASC-II/西里尔混排编码，不是标准 IPA。
 * 这里做一次保序映射，把它尽量还原成 IPA。
 *
 * 典型输入：`ә'bændәn`、`.kɒntrә'vә:ʃәl`、`mein'tein`
 * 目标输出：`əˈbændən`、`ˌkɒntrəˈvɜːʃəl`、`meɪnˈteɪn`
 */

// 单字符映射：旧编码用的西里尔字母/变体符号 → IPA
const CHAR_MAP = new Map([
  ["\u04D9", "ə"], // ә 西里尔 schwa
  ["\u0454", "e"], // є
  ["\u04AF", "y"],
  [".", "ˌ"], // 旧式次重音
  ["'", "ˈ"], // 旧式主重音
]);

// 必须先处理的双字符组合（长音、双元音）
const DIGRAPHS = [
  ["ɒ:", "ɔː"],
  ["ɔ:", "ɔː"],
  ["ə:", "ɜː"],
  ["ә:", "ɜː"],
  ["a:", "ɑː"],
  ["i:", "iː"],
  ["u:", "uː"],
  ["e:", "eɪ"],
  ["ei", "eɪ"],
  ["ai", "aɪ"],
  ["ɔi", "ɔɪ"],
  ["ɒu", "əʊ"],
  ["əu", "əʊ"],
  ["ou", "əʊ"],
  ["au", "aʊ"],
  ["iə", "ɪə"],
  ["uə", "ʊə"],
  ["dʒ", "dʒ"],
  ["tʃ", "tʃ"],
];

export function toIpa(raw) {
  if (!raw) return "";
  let s = "";
  for (const ch of raw.trim()) s += CHAR_MAP.get(ch) ?? ch;

  // 长音和双元音按长度优先替换（避免 au 抢走 a: 的位置）
  for (const [from, to] of DIGRAPHS) s = s.split(from).join(to);

  s = s.replace(/\s+/g, "");
  return s ? `/${s}/` : "";
}
