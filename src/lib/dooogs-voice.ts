import type { Locale } from "@/lib/lisa-types";
import { apiUrl } from "@/lib/api-url";

/** Tiny silent WAV — unlocks iOS/Android autoplay. */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

let sharedAudio: HTMLAudioElement | null = null;
let unlockAudio: HTMLAudioElement | null = null;
let audioUnlocked = false;

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

export function forSpokenVoice(html: string): string {
  let text = stripDialogHtml(html);
  text = text
    .replace(/\bAKC\b/g, "A K C")
    .replace(/\bFCI\b/g, "F C I")
    .replace(/\bUS\b/g, "U S")
    .replace(/\bUK\b/g, "U K")
    .replace(/\bvs\.?\b/gi, "versus")
    .replace(/\be\.g\./gi, "for example")
    .replace(/\bi\.e\./gi, "that is")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length > 900) {
    const cut = text.slice(0, 880);
    const lastStop = Math.max(
      cut.lastIndexOf(". "),
      cut.lastIndexOf("! "),
      cut.lastIndexOf("? ")
    );
    text = (lastStop > 300 ? cut.slice(0, lastStop + 1) : cut).trim();
  }
  return text;
}

function getSharedAudio(): HTMLAudioElement {
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.setAttribute("playsinline", "true");
    sharedAudio.setAttribute("webkit-playsinline", "true");
    sharedAudio.preload = "auto";
    (sharedAudio as HTMLAudioElement & { playsInline?: boolean }).playsInline =
      true;
  }
  return sharedAudio;
}

function getUnlockAudio(): HTMLAudioElement {
  if (!unlockAudio) {
    unlockAudio = new Audio();
    unlockAudio.setAttribute("playsinline", "true");
    unlockAudio.setAttribute("webkit-playsinline", "true");
    (unlockAudio as HTMLAudioElement & { playsInline?: boolean }).playsInline =
      true;
  }
  return unlockAudio;
}

/** Call from a click/tap/send gesture so later speech is allowed. */
export function unlockDooogsAudio(): void {
  if (typeof window === "undefined") return;
  audioUnlocked = true;

  try {
    const audio = getUnlockAudio();
    audio.src = SILENT_WAV;
    audio.volume = 0.01;
    void audio.play().then(
      () => {
        audio.pause();
        audio.currentTime = 0;
      },
      () => undefined
    );
  } catch {
    /* ignore */
  }

  try {
    const tts = getSharedAudio();
    // Only prime if idle — never clobber an in-flight reply
    if (tts.paused || !tts.src || tts.src.startsWith("data:")) {
      tts.src = SILENT_WAV;
      tts.volume = 0.01;
      void tts.play().then(
        () => {
          if (tts.src.startsWith("data:audio/wav")) {
            tts.pause();
            tts.currentTime = 0;
            tts.volume = 1;
          }
        },
        () => undefined
      );
    }
  } catch {
    /* ignore */
  }

  try {
    if (window.speechSynthesis && !window.speechSynthesis.speaking) {
      const warm = new SpeechSynthesisUtterance(" ");
      warm.volume = 0;
      warm.rate = 2;
      warm.lang = "en-US";
      window.speechSynthesis.speak(warm);
    }
  } catch {
    /* ignore */
  }
}

export function isDooogsAudioUnlocked(): boolean {
  return audioUnlocked;
}

type SpeakHandles = {
  stop: () => void;
  done: Promise<void>;
};

function pickBrowserVoice(locale: Locale): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const want = locale === "fr" ? "fr" : "en";
  const scored = [...voices].map((v) => {
    const name = `${v.name} ${v.lang}`.toLowerCase();
    let score = 0;
    if (v.lang.toLowerCase().startsWith(want)) score += 50;
    if (/(google|natural|enhanced|premium|siri|neural)/.test(name)) score += 40;
    if (/(samantha|karen|moira|aria|jenny|ava|zoe|victoria|amelie|marie)/.test(name))
      score += 30;
    if (/(female|woman)/.test(name)) score += 10;
    if (/(male|david|daniel|alex)/.test(name) && !/female/.test(name)) score -= 20;
    return { v, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.v ?? null;
}

function waitForVoices(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve();
      return;
    }
    if (window.speechSynthesis.getVoices().length) {
      resolve();
      return;
    }
    const done = () => resolve();
    window.speechSynthesis.addEventListener("voiceschanged", done, {
      once: true,
    });
    try {
      window.speechSynthesis.getVoices();
    } catch {
      /* ignore */
    }
    window.setTimeout(done, 400);
  });
}

async function speakWithBrowser(
  text: string,
  locale: Locale,
  signal: { stopped: boolean },
  opts?: { onStart?: () => void; onEnd?: () => void }
): Promise<boolean> {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;

  await waitForVoices();
  if (signal.stopped) return false;

  window.speechSynthesis.cancel();

  const parts =
    text
      .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
      ?.map((s) => s.trim())
      .filter(Boolean) ?? [text];

  const voice = pickBrowserVoice(locale);
  opts?.onStart?.();

  const keepAlive = window.setInterval(() => {
    try {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    } catch {
      /* ignore */
    }
  }, 250);

  try {
    for (const chunk of parts) {
      if (signal.stopped) break;
      await new Promise<void>((resolve) => {
        const utter = new SpeechSynthesisUtterance(chunk);
        utter.lang = locale === "fr" ? "fr-FR" : "en-US";
        utter.rate = 1;
        utter.pitch = 1.05;
        utter.volume = 1;
        if (voice) utter.voice = voice;
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        utter.onend = finish;
        utter.onerror = finish;
        window.setTimeout(finish, Math.min(20000, 2000 + chunk.length * 80));
        window.speechSynthesis.speak(utter);
        window.setTimeout(() => {
          try {
            window.speechSynthesis.resume();
          } catch {
            /* ignore */
          }
        }, 30);
      });
    }
    opts?.onEnd?.();
    return parts.length > 0 && !signal.stopped;
  } finally {
    window.clearInterval(keepAlive);
  }
}

async function speakWithSharedMp3(
  blob: Blob,
  signal: { stopped: boolean },
  opts?: { onStart?: () => void; onEnd?: () => void }
): Promise<boolean> {
  if (signal.stopped) return false;
  const audio = getSharedAudio();
  const objectUrl = URL.createObjectURL(blob);
  try {
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.src = objectUrl;
    audio.load();
    audio.currentTime = 0;
    audio.volume = 1;
    opts?.onStart?.();
    await audio.play();
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("audio_error"));
    });
    opts?.onEnd?.();
    return true;
  } catch {
    return false;
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
  }
}

async function fetchTtsBlob(
  text: string,
  locale: Locale,
  signal: AbortSignal,
  timeoutMs = 8000
): Promise<Blob | null> {
  const timeout = new AbortController();
  const onAbort = () => timeout.abort();
  signal.addEventListener("abort", onAbort);
  const timer = window.setTimeout(() => timeout.abort(), timeoutMs);
  try {
    const res = await fetch(apiUrl("/api/tts"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, locale }),
      signal: timeout.signal,
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("json")) return null;
    const blob = await res.blob();
    if (blob.size < 500) return null;
    return blob;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}

/**
 * Speak a Dooogs! reply.
 * Prefer shared MP3 TTS (works across devices once unlocked);
 * fall back to browser speech if TTS is slow or fails.
 */
export function speakDooogs(
  html: string,
  locale: Locale,
  opts?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: () => void;
  }
): SpeakHandles {
  const text = forSpokenVoice(html);
  const signal = { stopped: false };
  const abort = new AbortController();
  let ended = false;

  const endOnce = () => {
    if (ended) return;
    ended = true;
    opts?.onEnd?.();
  };

  const stop = () => {
    signal.stopped = true;
    abort.abort();
    try {
      sharedAudio?.pause();
    } catch {
      /* ignore */
    }
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    endOnce();
  };

  const done = (async () => {
    if (!text || signal.stopped) return;

    const blob = await fetchTtsBlob(text, locale, abort.signal, 6000);
    if (blob && !signal.stopped) {
      const played = await speakWithSharedMp3(blob, signal, {
        onStart: opts?.onStart,
        onEnd: endOnce,
      });
      if (played || signal.stopped) return;
    }

    if (signal.stopped) return;

    const ok = await speakWithBrowser(text, locale, signal, {
      onStart: opts?.onStart,
      onEnd: endOnce,
    });
    if (!ok && !signal.stopped && !ended) {
      opts?.onError?.();
      endOnce();
    }
  })();

  return { stop, done };
}
