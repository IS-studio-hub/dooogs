import type { Locale } from "@/lib/lisa-types";

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
  if (v.localService === false) score += 5;
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

/** Free browser speech — no cloud TTS / API key. */
export function speakDooogs(
  html: string,
  locale: Locale,
  opts?: { onStart?: () => void; onEnd?: () => void }
): SpeakHandles {
  const text = stripDialogHtml(html);
  let stopped = false;

  const stop = () => {
    stopped = true;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    opts?.onEnd?.();
  };

  const done = (async () => {
    if (!text) return;
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
