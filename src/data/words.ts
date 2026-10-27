import type { Word } from "@/lib/types";
import { CURATED } from "./curated";

/**
 * 内置保底词库：始终随站点打包，只有 60 个手写词（带例句）。
 * 它的作用是保证「没授权 / 断网 / 词包还没下载完」时网站依然可用。
 *
 * 大词库不在这里——运行时会从 public/packs/ 拉取并存进 IndexedDB，
 * 详见 src/lib/words-context.tsx 与 src/lib/wordpack.ts。
 */
export const SEED_WORDS: Word[] = CURATED;

export const SEED_COUNT = SEED_WORDS.length;
