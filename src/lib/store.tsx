"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useWords } from "@/lib/words-context";
import type { AppState, DailyStat, WordProgress } from "@/lib/types";
import { addDays, dateKey, lastNDays } from "@/lib/utils";

const STORAGE_KEY = "wordloop:progress:v1";
export const DAILY_GOAL = 12;

const EMPTY_DAY: DailyStat = { learned: 0, reviewed: 0, correct: 0, wrong: 0 };

function emptyState(): AppState {
  return { version: 1, words: {}, daily: {} };
}

function isActive(day?: DailyStat) {
  if (!day) return false;
  return day.learned + day.reviewed + day.correct + day.wrong > 0;
}

function readState(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed || parsed.version !== 1) return emptyState();
    return {
      version: 1,
      words: parsed.words ?? {},
      daily: parsed.daily ?? {},
    };
  } catch {
    return emptyState();
  }
}

type SeriesPoint = { key: string; label: string; count: number };

type Store = {
  hydrated: boolean;
  today: DailyStat;
  todayKey: string;
  streak: number;
  /** 有学习记录的单词数 */
  touchedCount: number;
  masteredCount: number;
  totalWords: number;
  totalAnswers: number;
  accuracy: number;
  series: SeriesPoint[];
  progressOf: (id: string) => WordProgress | undefined;
  markWord: (id: string, known: boolean) => void;
  recordAnswer: (id: string, correct: boolean) => void;
  reset: () => void;
};

const StoreContext = createContext<Store | null>(null);

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const { words } = useWords();
  const [state, setState] = useState<AppState>(emptyState);
  const [hydrated, setHydrated] = useState(false);
  const [todayKey, setTodayKey] = useState(() => dateKey());

  useEffect(() => {
    setState(readState());
    setTodayKey(dateKey());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* 忽略隐私模式下的写入失败 */
    }
  }, [state, hydrated]);

  const markWord = useCallback((id: string, known: boolean) => {
    const key = dateKey();
    setState((prev) => {
      const old = prev.words[id];
      const isNew = !old;
      const seen = (old?.seen ?? 0) + 1;
      const correct = (old?.correct ?? 0) + (known ? 1 : 0);
      const wrong = (old?.wrong ?? 0) + (known ? 0 : 1);
      const status: WordProgress["status"] =
        known && correct >= 2 ? "mastered" : "learning";
      const day = prev.daily[key] ?? EMPTY_DAY;
      return {
        ...prev,
        words: {
          ...prev.words,
          [id]: { seen, correct, wrong, lastSeen: key, status },
        },
        daily: {
          ...prev.daily,
          [key]: {
            ...day,
            learned: day.learned + (isNew ? 1 : 0),
            reviewed: day.reviewed + (isNew ? 0 : 1),
          },
        },
      };
    });
  }, []);

  const recordAnswer = useCallback((id: string, correct: boolean) => {
    const key = dateKey();
    setState((prev) => {
      const old = prev.words[id];
      const seen = (old?.seen ?? 0) + 1;
      const rightCount = (old?.correct ?? 0) + (correct ? 1 : 0);
      const wrong = (old?.wrong ?? 0) + (correct ? 0 : 1);
      const status: WordProgress["status"] =
        correct && rightCount >= 2 ? "mastered" : (old?.status ?? "learning");
      const day = prev.daily[key] ?? EMPTY_DAY;
      return {
        ...prev,
        words: {
          ...prev.words,
          [id]: { seen, correct: rightCount, wrong, lastSeen: key, status },
        },
        daily: {
          ...prev.daily,
          [key]: {
            ...day,
            correct: day.correct + (correct ? 1 : 0),
            wrong: day.wrong + (correct ? 0 : 1),
          },
        },
      };
    });
  }, []);

  const reset = useCallback(() => {
    setState(emptyState());
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  }, []);

  const value = useMemo<Store>(() => {
    const today = state.daily[todayKey] ?? EMPTY_DAY;

    // 连续打卡：今天没学则从昨天开始算
    let cursor = new Date();
    if (!isActive(state.daily[dateKey(cursor)])) {
      cursor = addDays(cursor, -1);
    }
    let streak = 0;
    while (isActive(state.daily[dateKey(cursor)])) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }

    const entries = Object.values(state.words);
    const masteredCount = entries.filter((w) => w.status === "mastered").length;
    const totalAnswers = entries.reduce((sum, w) => sum + w.correct + w.wrong, 0);
    const totalCorrect = entries.reduce((sum, w) => sum + w.correct, 0);

    const series: SeriesPoint[] = lastNDays(14).map((key) => {
      const d = state.daily[key];
      const count = d ? d.learned + d.reviewed + d.correct + d.wrong : 0;
      const [, m, day] = key.split("-");
      return { key, label: `${Number(m)}/${Number(day)}`, count };
    });

    return {
      hydrated,
      today,
      todayKey,
      streak,
      touchedCount: entries.length,
      masteredCount,
      totalWords: words.length,
      totalAnswers,
      accuracy: totalAnswers ? Math.round((totalCorrect / totalAnswers) * 100) : 0,
      series,
      progressOf: (id: string) => state.words[id],
      markWord,
      recordAnswer,
      reset,
    };
  }, [state, hydrated, todayKey, words.length, markWord, recordAnswer, reset]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useProgress() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useProgress 必须在 ProgressProvider 内使用");
  return ctx;
}
