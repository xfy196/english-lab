export type Level = "A2" | "B1" | "B2";

export type Word = {
  id: string;
  word: string;
  phonetic: string;
  pos: string;
  meaning: string;
  /** 例句：仅手写词条提供，自动生成的词条没有 */
  example?: string;
  exampleCn?: string;
  level: Level;
};

export type WordStatus = "learning" | "mastered";

export type WordProgress = {
  seen: number;
  correct: number;
  wrong: number;
  lastSeen: string;
  status: WordStatus;
};

export type DailyStat = {
  learned: number;
  reviewed: number;
  correct: number;
  wrong: number;
};

export type AppState = {
  version: 1;
  words: Record<string, WordProgress>;
  daily: Record<string, DailyStat>;
};

export type QuizMode = "listen" | "spell";
