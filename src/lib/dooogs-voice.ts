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
  if (v.lang.toLowerCase().startsWith(want === "fr" ? "fr-ca" : "en-us")) score += 14;
  // Prefer high-quality / network voices (closer to desktop neural quality on phones)
  if (/(neural|premium|enhanced|natural|siri|quality)/.test(name)) score += 45;
  if (v.localService === false) score += 35;
  if (
    /(samantha|karen|moira|fiona|tessa|aria|jenny|sonia|allison|ava|nicky|zoe|zoey|susan|victoria|google us english|google uk english female|microsoft.*(aria|jenny|zira)|samantha|amelie|amélie|aurelie|aurélie|marie)/.test(
      name
    )
  ) {
    score += 40;
  }
  if (/(female|woman|girl)/.test(name)) score += 10;
  if (/(compact|eloquence)/.test(name)) score -= 15;
  if (/(male|david|daniel|alex|fred|thomas|riviere)/.test(name) && !/female/.test(name))
    score -= 28;
  return score;
}

export function pickBrowserVoice(locale: Locale): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  return [...voices].sort((a, b) => scoreVoice(b, locale) - scoreVoice(a, locale))[0] ?? null;
}

function waitForVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices();
    if (existing.length) {
      resolve(existing);
      return;
    }
    const done = () => resolve(window.speechSynthesis.getVoices());
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      done();
    };
    window.setTimeout(done, 700);
  });
}

type SpeakHandles = {
  stop: () => void;
  done: Promise<void>;
};

/**
 * Prefer shared Edge neural TTS (identical on mobile + desktop).
 * Fall back to the best local browser voice.
 */
export function speakDooogs(
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

    // 1) Shared neural voice via API (same MP3 on phone and desktop)
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
      /* fall through */
    }

    if (stopped) return;
    if (typeof window === "undefined" || !window.speechSynthesis) {
      opts?.onEnd?.();
      return;
    }

    // 2) Browser fallback — prefer enhanced voices; chunk for iOS limits
    await waitForVoices();
    if (stopped) return;

    const chunks = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [
      text,
    ];
    const voice = pickBrowserVoice(locale);

    opts?.onStart?.();
    for (const chunk of chunks) {
      if (stopped) break;
      await new Promise<void>((resolve) => {
        const utter = new SpeechSynthesisUtterance(chunk);
        utter.lang = locale === "fr" ? "fr-CA" : "en-US";
        utter.rate = 0.94;
        utter.pitch = 1.05;
        utter.volume = 1;
        if (voice) utter.voice = voice;
        utter.onend = () => resolve();
        utter.onerror = () => resolve();
        window.speechSynthesis.speak(utter);
      });
    }
    opts?.onEnd?.();
  })();

  return { stop, done };
}
