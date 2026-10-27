"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Keyboard,
  Lightbulb,
  RotateCcw,
  Volume2,
  X,
} from "lucide-react";
import type { QuizMode, Word } from "@/lib/types";
import { useProgress } from "@/lib/store";
import { useWords } from "@/lib/words-context";
import { shuffle } from "@/lib/utils";
import { useSpeech } from "@/lib/speech";
import { PageHeader } from "@/components/ui";
import { SpeakButton } from "@/components/speak-button";
import { cn } from "@/lib/utils";

const TOTAL = 10;

type Question = {
  word: Word;
  options: string[];
};

function buildQuestions(words: Word[]): Question[] {
  const picked = shuffle(words).slice(0, TOTAL);
  return picked.map((word) => {
    const distractors = shuffle(
      words.filter((w) => w.id !== word.id && w.meaning !== word.meaning),
    )
      .slice(0, 3)
      .map((w) => w.word);
    return { word, options: shuffle([word.word, ...distractors]) };
  });
}

export default function QuizPage() {
  const { hydrated, recordAnswer } = useProgress();
  const { words, ready: wordsReady } = useWords();
  const { speak } = useSpeech();

  const [mode, setMode] = useState<QuizMode>("listen");
  const [round, setRound] = useState(1);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<"idle" | "right" | "wrong">("idle");
  const [picked, setPicked] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);
  const [hint, setHint] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const builtKey = useRef("");

  useEffect(() => {
    if (!hydrated || !wordsReady) return;
    const key = `${mode}-${round}`;
    if (builtKey.current === key) return;
    builtKey.current = key;
    setQuestions(buildQuestions(words));
    setIndex(0);
    setStatus("idle");
    setPicked(null);
    setInput("");
    setScore(0);
    setHint(false);
  }, [hydrated, wordsReady, mode, round, words]);

  const current = questions?.[index];
  const done = questions !== null && index >= questions.length;

  // 听音模式自动朗读
  useEffect(() => {
    if (!current || mode !== "listen" || status !== "idle") return;
    const t = setTimeout(() => speak(current.word.word, 0.85), 220);
    return () => clearTimeout(t);
  }, [current, mode, status, speak]);

  useEffect(() => {
    if (mode === "spell" && status === "idle") inputRef.current?.focus();
  }, [mode, status, index]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const advance = useCallback(() => {
    setStatus("idle");
    setPicked(null);
    setInput("");
    setHint(false);
    setIndex((i) => i + 1);
  }, []);

  const answer = useCallback(
    (ok: boolean, choice?: string) => {
      if (!current || status !== "idle") return;
      setStatus(ok ? "right" : "wrong");
      if (choice) setPicked(choice);
      if (ok) setScore((s) => s + 1);
      recordAnswer(current.word.id, ok);
      timer.current = setTimeout(advance, ok ? 820 : 1700);
    },
    [current, status, recordAnswer, advance],
  );

  const submitSpell = useCallback(() => {
    if (!current || status !== "idle") return;
    const value = input.trim().toLowerCase();
    if (!value) return;
    answer(value === current.word.word.toLowerCase());
  }, [answer, current, input, status]);

  const masked = useMemo(() => {
    if (!current) return "";
    const w = current.word.word;
    if (!hint) return `${w[0]}${" ·".repeat(Math.max(0, w.length - 1))}`;
    return w
      .split("")
      .map((c, i) => (i < 3 || i === w.length - 1 ? c : "_"))
      .join(" ");
  }, [current, hint]);

  const accuracy = current ? Math.round((score / Math.max(1, index)) * 100) : 0;

  if (!hydrated || !questions) {
    return (
      <div>
        <PageHeader eyebrow="Practice" title="听写练习" description="正在出题…" />
        <div className="h-[300px] animate-pulse rounded-[26px] border border-line bg-surface" />
      </div>
    );
  }

  if (done) {
    const total = questions.length;
    return (
      <div>
        <PageHeader
          eyebrow={`第 ${round} 轮 · ${mode === "listen" ? "听音选词" : "看义拼写"}`}
          title="练习完成"
          description="错的词会更频繁地出现，不用担心记不住。"
        />
        <div className="animate-pop rounded-[26px] border border-line bg-surface p-8 text-center">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">得分</p>
          <p className="mt-2 text-[54px] font-semibold leading-none tracking-tight">
            {score}
            <span className="text-[22px] text-muted"> / {total}</span>
          </p>
          <p className="mt-2 text-[13px] text-muted">
            正确率 {Math.round((score / total) * 100)}% ·{" "}
            {score === total
              ? "全对，可以挑战更难的词了"
              : score >= total * 0.7
                ? "表现不错，把错的词再复习一遍"
                : "别急，先回卡片模式熟悉一下"}
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-2.5">
            <button
              onClick={() => setRound((r) => r + 1)}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-[13px] font-medium text-white transition-transform hover:-translate-y-0.5"
            >
              <RotateCcw size={14} />
              再来一轮
            </button>
            <button
              onClick={() => setMode(mode === "listen" ? "spell" : "listen")}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-brand-dark"
            >
              换个题型
              <ArrowRight size={14} />
            </button>
            <Link
              href="/learn"
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-5 py-2.5 text-[13px] font-medium transition-colors hover:bg-paper"
            >
              回词汇卡片
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const q = current!;

  return (
    <div>
      <PageHeader
        eyebrow="Practice"
        title="听写练习"
        description="听懂一个词、拼对一个词，才算真的认识它。每组 10 题，答错会立刻给出正确答案。"
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-full border border-line bg-surface p-1">
          {(
            [
              { key: "listen", label: "听音选词", icon: Volume2 },
              { key: "spell", label: "看义拼写", icon: Keyboard },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = mode === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  if (tab.key === mode) return;
                  if (timer.current) clearTimeout(timer.current);
                  setMode(tab.key);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                  active
                    ? "bg-brand text-white"
                    : "text-muted hover:text-ink",
                )}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-[12px] text-muted">
          <span className="tabular-nums">
            {index + 1} / {questions.length}
          </span>
          <span className="h-3 w-px bg-line" />
          <span className="tabular-nums">得分 {score}</span>
        </div>
      </div>

      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-[#eeebe5]">
        <div
          className="h-full rounded-full bg-linear-to-r from-brand to-[#8b5cf6] transition-[width] duration-500"
          style={{ width: `${(index / questions.length) * 100}%` }}
        />
      </div>

      <div
        className={cn(
          "rounded-[26px] border bg-surface p-6 lg:p-8",
          status === "right"
            ? "border-[#bfe8d4]"
            : status === "wrong"
              ? "border-[#f5c9c4]"
              : "border-line",
        )}
      >
        {mode === "listen" ? (
          <>
            <p className="text-center text-[11.5px] text-muted">
              点击喇叭听发音，选出你听到的单词
            </p>
            <div className="mt-4 flex flex-col items-center">
              <button
                onClick={() => speak(q.word.word, 0.85)}
                className="grid h-20 w-20 place-items-center rounded-full bg-brand text-white shadow-[0_14px_30px_-14px_rgba(91,91,245,0.9)] transition-transform hover:scale-105 active:scale-95"
                aria-label="播放发音"
              >
                <Volume2 size={30} />
              </button>
              <button
                onClick={() => speak(q.word.word, 0.6)}
                className="mt-2.5 text-[11.5px] text-muted hover:text-ink"
              >
                听慢速
              </button>
            </div>

            <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
              {q.options.map((opt) => {
                const isCorrect = opt === q.word.word;
                const isPicked = picked === opt;
                const revealed = status !== "idle";
                return (
                  <button
                    key={opt}
                    disabled={revealed}
                    onClick={() => answer(isCorrect, opt)}
                    className={cn(
                      "flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all",
                      !revealed &&
                        "border-line hover:border-[#c9c3ff] hover:bg-brand-soft/40",
                      revealed && isCorrect && "border-good bg-good-soft",
                      revealed && isPicked && !isCorrect && "border-bad bg-bad-soft",
                      revealed && !isCorrect && !isPicked && "border-line opacity-55",
                    )}
                  >
                    <span className="font-display text-[16px]">{opt}</span>
                    {revealed && isCorrect && (
                      <Check size={16} className="text-good" />
                    )}
                    {revealed && isPicked && !isCorrect && (
                      <X size={16} className="text-bad" />
                    )}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="text-center">
              <p className="text-[11px] uppercase tracking-[0.14em] text-brand">
                {q.word.pos}
              </p>
              <p className="mt-2 text-[24px] font-semibold tracking-tight">
                {q.word.meaning}
              </p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <span className="text-[12.5px] text-muted">{q.word.phonetic}</span>
                <SpeakButton text={q.word.word} size="sm" />
              </div>
            </div>

            <div className="mt-6">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitSpell();
                }}
                disabled={status !== "idle"}
                placeholder="输入这个单词的拼写…"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                className={cn(
                  "w-full rounded-xl border bg-paper/60 px-4 py-3.5 text-center font-display text-[20px] tracking-wide outline-none transition-colors placeholder:font-sans placeholder:text-[13px] placeholder:tracking-normal placeholder:text-muted",
                  status === "idle" && "border-line focus:border-brand focus:bg-white",
                  status === "right" && "border-good bg-good-soft text-good",
                  status === "wrong" && "animate-shake border-bad bg-bad-soft text-bad",
                )}
              />
              <div className="mt-2.5 flex items-center justify-between text-[11.5px] text-muted">
                <button
                  onClick={() => setHint(true)}
                  className="inline-flex items-center gap-1 hover:text-ink disabled:opacity-40"
                  disabled={hint}
                >
                  <Lightbulb size={12} />
                  {hint ? "已显示提示" : "需要提示？"}
                </button>
                <span className="tabular-nums">{q.word.word.length} 个字母</span>
              </div>
              {hint && status === "idle" && (
                <p className="mt-1 text-center font-display text-[15px] tracking-[0.3em] text-muted">
                  {masked}
                </p>
              )}
            </div>

            <button
              onClick={submitSpell}
              disabled={status !== "idle" || !input.trim()}
              className="mt-5 w-full rounded-xl bg-ink py-3 text-[13.5px] font-medium text-white transition-opacity disabled:opacity-35"
            >
              确认并继续
            </button>
          </>
        )}

        {status !== "idle" && (
          <div
            className={cn(
              "animate-rise mt-5 flex items-start gap-2.5 rounded-xl px-4 py-3",
              status === "right" ? "bg-good-soft" : "bg-bad-soft",
            )}
          >
            <span
              className={cn(
                "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-white",
                status === "right" ? "bg-good" : "bg-bad",
              )}
            >
              {status === "right" ? <Check size={12} /> : <X size={12} />}
            </span>
            <div className="text-[12.5px] leading-relaxed">
              <p className="font-medium">
                {status === "right" ? "正确" : `正确答案：${q.word.word}`}{" "}
                <span className="font-normal text-muted">
                  {q.word.phonetic} · {q.word.meaning}
                </span>
              </p>
              {q.word.example && (
                <>
                  <p className="mt-1 text-muted">{q.word.example}</p>
                  <p className="text-muted/80">{q.word.exampleCn}</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-[11.5px] text-muted">
        当前轮命中率 {accuracy}% · 本轮共 {questions.length} 题
      </p>
    </div>
  );
}
