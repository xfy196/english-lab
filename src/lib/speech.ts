"use client";

import { useCallback, useEffect, useState } from "react";

export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" && "speechSynthesis" in window,
    );
    // 提前触发一次 voice 列表加载（部分浏览器是异步的）
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  const speak = useCallback((text: string, rate = 0.9) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return false;
    }
    const synth = window.speechSynthesis;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.rate = rate;
    utter.pitch = 1;

    const voices = synth.getVoices();
    const preferred =
      voices.find(
        (v) =>
          v.lang?.replace("_", "-") === "en-US" &&
          /Samantha|Aria|Jenny|Google US English|Zira/i.test(v.name),
      ) ?? voices.find((v) => v.lang?.startsWith("en"));
    if (preferred) utter.voice = preferred;

    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);

    synth.speak(utter);
    return true;
  }, []);

  return { speak, speaking, supported };
}
