import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv.mjs";

const want = new Set([
  "abandon", "borrow", "careful", "apple", "abandon", "run", "the",
  "controversial", "efficient", "vulnerable", "withdraw", "evidence",
  "maintain", "inevitable",
]);

let n = 0;
await parseCsv(fileURLToPath(new URL("../.ecdict/ecdict.csv", import.meta.url)), (r) => {
  n++;
  if (want.has(r.word?.toLowerCase())) {
    console.log(JSON.stringify({
      word: r.word,
      phonetic: r.phonetic,
      translation: r.translation,
      pos: r.pos,
      collins: r.collins,
      oxford: r.oxford,
      tag: r.tag,
      bnc: r.bnc,
      frq: r.frq,
      exchange: r.exchange,
    }, null, 0));
  }
});
console.log("total records:", n);
