import type { Locale } from "@/lib/lisa-types";
import { apiUrl } from "@/lib/api-url";

export function stripDialogHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ". ")
    .replace(/<\/p>/gi, ". ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .replace(/\s*\.\s*\./g, ".")
    .trim();
}

function scoreVoice(v: SpeechSynthesisVoice, locale: Locale): number {
  const name = `${v.name} ${v.lang}`.toLowerCase();
  let score = 0;
  const want = locale === "fr" ? "fr" : "en";
  if (v.lang.toLowerCase().startsWith(want)) score += 40;
  if (v.lang.toLowerCase().startsWith(want === "fr" ? "fr-ca" : "en-us")) score += 10;
  if (/(neural|premium|enhanced|natural|online)/.test(name)) score += 30;
  if (/(samantha|karen|moira|fiona|tessa|aria|jenny|sonia|google.*female|microsoft.*aria)/.test(name))
    score += 25;
  if (/(female|woman)/.test(name)) score += 8;
  if (v.localService === false) score += 5; // cloud voices often sound better
  if (/(male|david|daniel|alex|fred)/.test(name) && !/female/.test(name)) score -= 20;
  return score;
}

export function pickBrowserVoice(locale: Locale): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  return [...voices].sort((a, b) => scoreVoice(b, locale) - scoreVoice(a, locale))[0] ?? null;
}

type SpeakHandles = {
  stop: () => void;
  done: Promise<void>;
};

/**
 * Prefer OpenAI HD TTS (real human-like). Falls back to best browser voice.
 */
export function speakGinny(
  html: string,
  locale: Locale,
  opts?: { onStart?: () => void; onEnd?: () => void }
): SpeakHandles {
  const text = stripDialogHtml(html);
  let stopped = false;
  let audio: HTMLAudioElement | null = null;
  let objectUrl: string | null = null;
  const abort = new AbortController();

  const stop = () => {
    stopped = true;
    abort.abort();
    if (audio) {
      audio.pause();
      audio.src = "";
      audio = null;
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    opts?.onEnd?.();
  };

  const done = (async () => {
    if (!text) return;

    // 1) OpenAI HD via API
    try {
      const res = await fetch(apiUrl("/api/tts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, locale }),
        signal: abort.signal,
      });
      if (res.ok) {
        const blob = await res.blob();
        if (stopped) return;
        objectUrl = URL.createObjectURL(blob);
        audio = new Audio(objectUrl);
        audio.preload = "auto";
        opts?.onStart?.();
        await new Promise<void>((resolve, reject) => {
          if (!audio) return resolve();
          audio.onended = () => resolve();
          audio.onerror = () => reject(new Error("audio_error"));
          void audio.play().catch(reject);
        });
        opts?.onEnd?.();
        return;
      }
    } catch {
      /* fall through to browser TTS */
    }

    if (stopped) return;

    // 2) Browser Speech Synthesis fallback
    if (typeof window === "undefined" || !window.speechSynthesis) {
      opts?.onEnd?.();
      return;
    }

    await new Promise<void>((resolve) => {
      let started = false;
      const run = () => {
        if (started || stopped) {
          resolve();
          return;
        }
        started = true;
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = locale === "fr" ? "fr-CA" : "en-US";
        utter.rate = 0.96;
        utter.pitch = 1.04;
        utter.volume = 1;
        const voice = pickBrowserVoice(locale);
        if (voice) utter.voice = voice;
        utter.onend = () => {
          opts?.onEnd?.();
          resolve();
        };
        utter.onerror = () => {
          opts?.onEnd?.();
          resolve();
        };
        opts?.onStart?.();
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
      };

      const voices = window.speechSynthesis.getVoices();
      if (voices.length) run();
      else {
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.onvoiceschanged = null;
          run();
        };
        window.setTimeout(run, 400);
      }
    });
  })();

  return { stop, done };
}
