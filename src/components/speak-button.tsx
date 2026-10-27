"use client";

import { Volume2 } from "lucide-react";
import { useSpeech } from "@/lib/speech";
import { cn } from "@/lib/utils";

export function SpeakButton({
  text,
  size = "md",
  variant = "soft",
  className,
}: {
  text: string;
  size?: "sm" | "md" | "lg";
  variant?: "soft" | "plain" | "white";
  className?: string;
}) {
  const { speak, speaking, supported } = useSpeech();

  const dims = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  }[size];

  const iconSize = { sm: 14, md: 17, lg: 20 }[size];

  const variants = {
    soft: "bg-brand-soft text-brand hover:bg-[#e2e0ff]",
    plain: "text-muted hover:bg-paper hover:text-ink",
    white: "bg-white/15 text-white hover:bg-white/25",
  }[variant];

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        speak(text);
      }}
      aria-label="朗读发音"
      title={
        supported ? "朗读发音（浏览器语音合成）" : "当前浏览器不支持语音朗读"
      }
      className={cn(
        "grid shrink-0 place-items-center rounded-full transition-colors",
        dims,
        variants,
        speaking && "animate-sound",
        className,
      )}
    >
      <Volume2 size={iconSize} strokeWidth={2} />
    </button>
  );
}
