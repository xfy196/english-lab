"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import type { Word } from "@/lib/types";
import { useProgress } from "@/lib/store";
import { useWords } from "@/lib/words-context";
import { shuffle } from "@/lib/utils";
import { SpeakButton } from "@/components/speak-button";
import { PageHeader } from "@/components/ui";

const SESSION_SIZE = 10;

export default function LearnView() {
  const params = useSearchParams();
  const reviewOnly = params.get("mode") === "review";
  const { hydrated, markWord, progressOf } = useProgress();
  const { words, ready: wordsReady } = useWords();

  const [session, setSession] = useState<Word[] | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [again, setAgain] = useState(0);
  const [round, setRound] = useState(1);
  const builtRound = useRef(0);

  const buildSession = useCallback(
    (preferReview: boolean) => {
      const review = words.filter((w) => progressOf(w.id)?.status === "learning");
      const fresh = words.filter((w) => !progressOf(w.id));
      const mastered = words.filter(
        (w) => progressOf(w.id)?.status === "mastered",
      );

      const ordered = preferReview
        ? [...shuffle(review), ...shuffle(fresh), ...shuffle(mastered)]
        : [...shuffle(review).slice(0, 5), ...shuffle(fresh), ...shuffle(mastered)];
      const picked = ordered.slice(0, SESSION_SIZE);
      if (picked.length < SESSION_SIZE) {
        const rest = shuffle(words.filter((w) => !picked.includes(w)));
        picked.push(...rest.slice(0, SESSION_SIZE - picked.length));
      }
      return picked;
    },
    [progressOf, words],
  );

  useEffect(() => {
    if (!hydrated || !wordsReady) return;
    if (builtRound.current === round) return;
    builtRound.current = round;
    setSession(buildSession(reviewOnly));
    setIndex(0);
    setFlipped(false);
    setKnown(0);
    setAgain(0);
  }, [hydrated, wordsReady, round, reviewOnly, buildSession]);

  const current = session?.[index];
  const done = session !== null && index >= session.length;

  const judge = useCallback(
    (isKnown: boolean) => {
      if (!current) return;
      markWord(current.id, isKnown);
      if (isKnown) setKnown((n) => n + 1);
      else setAgain((n) => n + 1);
      setFlipped(false);
      setIndex((i) => i + 1);
    },
    [current, markWord],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done || !current) return;
      if (e.code === "Space") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowLeft" || e.key === "1") {
        e.preventDefault();
        judge(false);
      } else if (e.key === "ArrowRight" || e.key === "2") {
        e.preventDefault();
        judge(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [judge, done, current]);

  const accuracy = useMemo(() => {
    const total = known + again;
    return total ? Math.round((known / total) * 100) : 0;
  }, [known, again]);

  if (!hydrated || !session) {
    return (
      <div>
        <PageHeader
          eyebrow="Flashcards"
          title="词汇卡片"
          description="正在准备这一轮的单词…"
        />
        <div className="h-[360px] animate-pulse rounded-[26px] border border-line bg-surface" />
      </div>
    );
  }

  if (done) {
    return (
      <div>
        <PageHeader
          eyebrow={`第 ${round} 轮`}
          title="这一轮结束了"
          description="记忆不是一次性的动作，间隔重复才会让它留下。"
        />
        <div className="animate-pop rounded-[26px] border border-line bg-surface p-8">
          <div className="flex flex-col items-center text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-good-soft text-good">
              <Check size={26} strokeWidth={2.4} />
            </span>
            <h2 className="mt-4 text-[22px] font-semibold tracking-tight">
              {known} / {known + again} 个词有印象
            </h2>
            <p className="mt-1 text-[13px] text-muted">
              认识 {known} 个 · 需要再看 {again} 个 · 本轮命中率 {accuracy}%
            </p>

            <div className="mt-6 grid w-full max-w-md grid-cols-2 gap-3">
              <div className="rounded-xl bg-good-soft px-4 py-3 text-left">
                <p className="text-[11px] text-good">认识</p>
                <p className="mt-0.5 text-[20px] font-semibold">{known}</p>
              </div>
              <div className="rounded-xl bg-bad-soft px-4 py-3 text-left">
                <p className="text-[11px] text-bad">不认识</p>
                <p className="mt-0.5 text-[20px] font-semibold">{again}</p>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap justify-center gap-2.5">
              <button
                onClick={() => setRound((r) => r + 1)}
                className="inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-[13px] font-medium text-white transition-transform hover:-translate-y-0.5"
              >
                <RotateCcw size={14} />
                再来一组
              </button>
              <Link
                href="/quiz"
                className="inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-brand-dark"
              >
                去做听写
                <ArrowRight size={14} />
              </Link>
              <Link
                href="/stats"
                className="inline-flex items-center gap-1.5 rounded-full border border-line px-5 py-2.5 text-[13px] font-medium transition-colors hover:bg-paper"
              >
                看学习数据
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const word = current!;
  const progress = (index / session.length) * 100;

  return (
    <div>
      <PageHeader
        eyebrow={reviewOnly ? "Review session" : "Flashcards"}
        title={reviewOnly ? "复习模式" : "词汇卡片"}
        description="先自己回想释义，再翻面核对。诚实一点，系统才知道哪些词该多出现几次。"
        action={
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[12.5px] text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft size={14} />
            回到概览
          </Link>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eeebe5]">
          <div
            className="h-full rounded-full bg-linear-to-r from-brand to-[#8b5cf6] transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="shrink-0 text-[12px] tabular-nums text-muted">
          {index + 1} / {session.length}
        </span>
      </div>

      <div className="flip-scene h-[368px] w-full select-none lg:h-[400px]">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setFlipped((f) => !f)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setFlipped((f) => !f);
          }}
          className={`flip-inner cursor-pointer text-left outline-none ${
            flipped ? "is-flipped" : ""
          }`}
          aria-label="翻转卡片"
        >
          {/* 正面 */}
          <div className="flip-face border border-line bg-surface p-7 shadow-[0_20px_50px_-32px_rgba(22,24,29,0.4)] lg:p-9">
            <div className="flex items-start justify-between">
              <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[10.5px] font-medium tracking-wide text-brand">
                {word.level}
              </span>
              <span className="text-[11px] text-muted/70">点击卡片翻面</span>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center">
              <h2 className="font-display text-[46px] leading-none tracking-tight lg:text-[56px]">
                {word.word}
              </h2>
              <div className="mt-3 flex items-center gap-2.5">
                <span className="text-[13.5px] text-muted">{word.phonetic}</span>
                <SpeakButton text={word.word} size="sm" />
              </div>
            </div>

            <p className="hidden text-center text-[11.5px] text-muted/60 sm:block">
              空格键翻面 · ← 不认识 · → 认识
            </p>
          </div>

          {/* 背面 */}
          <div className="flip-face flip-face--back border border-[#e3e1ff] bg-[#f7f6ff] p-7 lg:p-9">
            <div className="flex items-center justify-between">
              <span className="font-display text-[17px] text-muted">{word.word}</span>
              <SpeakButton text={word.word} size="sm" />
            </div>

            <div className="flex flex-1 flex-col justify-center">
              <p className="text-[11px] uppercase tracking-[0.14em] text-brand">
                {word.pos}
              </p>
              <p className="mt-2 text-[26px] font-semibold leading-tight tracking-tight lg:text-[30px]">
                {word.meaning}
              </p>

              {word.example ? (
                <div className="mt-5 rounded-xl bg-white/80 px-4 py-3.5">
                  <p className="text-[13.5px] leading-relaxed text-ink/90">
                    {word.example}
                  </p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                    {word.exampleCn}
                  </p>
                </div>
              ) : (
                <p className="mt-5 text-[12.5px] leading-relaxed text-muted/70">
                  试着用它造个句子，能顺口说出来就算认识。
                </p>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-muted/70">
              <Sparkles size={12} />
              大声跟读一遍，再决定认不认识
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          onClick={() => judge(false)}
          className="group flex items-center justify-center gap-2 rounded-2xl border border-[#f3d3d0] bg-bad-soft py-3.5 text-[14px] font-medium text-bad transition-colors hover:bg-[#fbe2e0]"
        >
          <X size={16} strokeWidth={2.4} />
          不认识
          <span className="hidden text-[11px] text-bad/50 sm:inline">←</span>
        </button>
        <button
          onClick={() => judge(true)}
          className="group flex items-center justify-center gap-2 rounded-2xl bg-good py-3.5 text-[14px] font-medium text-white transition-colors hover:bg-[#128a5b]"
        >
          <Check size={16} strokeWidth={2.4} />
          认识
          <span className="hidden text-[11px] text-white/60 sm:inline">→</span>
        </button>
      </div>

      <p className="mt-3 text-center text-[11.5px] text-muted">
        本轮：认识 {known} · 不认识 {again}
      </p>
    </div>
  );
}
