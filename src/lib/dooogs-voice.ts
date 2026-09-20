import type { Locale } from "@/lib/lisa-types";
import { apiUrl } from "@/lib/api-url";

/** Tiny silent WAV — unlocks iOS/Android autoplay on a shared Audio element. */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

let sharedAudio: HTMLAudioElement | null = null;
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
  if (text.length > 1000) {
    const cut = text.slice(0, 980);
    const lastStop = Math.max(
      cut.lastIndexOf(". "),
      cut.lastIndexOf("! "),
      cut.lastIndexOf("? ")
    );
    text = (lastStop > 400 ? cut.slice(0, lastStop + 1) : cut).trim();
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

export function unlockDooogsAudio(): void {
  if (typeof window === "undefined") return;
  try {
    const audio = getSharedAudio();
    if (!audioUnlocked) {
      audio.src = SILENT_WAV;
      audio.volume = 0.01;
      void audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 1;
          audioUnlocked = true;
        })
        .catch(() => {
          audioUnlocked = true;
        });
    }
  } catch {
    audioUnlocked = true;
  }

  // Also unlock speechSynthesis (iOS)
  try {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const warm = new SpeechSynthesisUtterance(" ");
      warm.volume = 0;
      window.speechSynthesis.speak(warm);
      window.speechSynthesis.cancel();
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

function scoreVoice(v: SpeechSynthesisVoice, locale: Locale): number {
  const name = `${v.name} ${v.lang}`.toLowerCase();
  let score = 0;
  const want = locale === "fr" ? "fr" : "en";
  if (v.lang.toLowerCase().startsWith(want)) score += 40;
  if (v.lang.toLowerCase().startsWith(want === "fr" ? "fr-ca" : "en-us"))
    score += 14;
  if (/(neural|premium|enhanced|natural|siri|google|microsoft)/.test(name))
    score += 45;
  if (v.localService === false) score += 30;
  if (
    /(samantha|karen|moira|fiona|tessa|aria|jenny|sonia|ava|zoe|victoria|amelie|amélie|marie)/.test(
      name
    )
  ) {
    score += 35;
  }
  if (/(female|woman)/.test(name)) score += 8;
  if (/(male|david|daniel|alex|fred)/.test(name) && !/female/.test(name))
    score -= 25;
  return score;
}

function pickBrowserVoice(locale: Locale): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  return (
    [...voices].sort((a, b) => scoreVoice(b, locale) - scoreVoice(a, locale))[0] ??
    null
  );
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
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      done();
    };
    window.setTimeout(done, 800);
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

  const parts =
    text
      .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
      ?.map((s) => s.trim())
      .filter(Boolean) ?? [text];

  const voice = pickBrowserVoice(locale);
  opts?.onStart?.();

  const keepAlive = window.setInterval(() => {
    try {
      if (window.speechSynthesis.speaking) window.speechSynthesis.resume();
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
        utter.rate = 1.02;
        utter.pitch = 1.06;
        utter.volume = 1;
        if (voice) utter.voice = voice;
        utter.onend = () => resolve();
        utter.onerror = () => resolve();
        try {
          window.speechSynthesis.resume();
        } catch {
          /* ignore */
        }
        window.speechSynthesis.speak(utter);
      });
    }
    opts?.onEnd?.();
    return !signal.stopped;
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
    audio.pause();
    audio.src = objectUrl;
    audio.volume = 1;
    opts?.onStart?.();
    await audio.play();
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("audio_error"));
      if (audio.ended) resolve();
    });
    opts?.onEnd?.();
    return true;
  } catch {
    return false;
  } finally {
    // Revoke after a beat so playback isn't interrupted on some browsers
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
  }
}

async function fetchTtsBlob(
  text: string,
  locale: Locale,
  signal: AbortSignal
): Promise<Blob | null> {
  try {
    const res = await fetch(apiUrl("/api/tts"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, locale }),
      signal,
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("json")) return null;
    const blob = await res.blob();
    if (blob.size < 500) return null;
    return blob;
  } catch {
    return null;
  }
}

/**
 * Prefer shared Worker TTS MP3 (same voice everywhere).
 * Fall back to browser speech so voice still works when TTS is down.
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
      if (sharedAudio) {
        sharedAudio.pause();
      }
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

    // 1) Shared TTS MP3
    const blob = await fetchTtsBlob(text, locale, abort.signal);
    if (blob && !signal.stopped) {
      const played = await speakWithSharedMp3(blob, signal, {
        onStart: opts?.onStart,
        onEnd: endOnce,
      });
      if (played || signal.stopped) return;
    }

    if (signal.stopped) return;

    // 2) Browser voice fallback (keeps sound working when Worker TTS fails)
    const ok = await speakWithBrowser(text, locale, signal, {
      onStart: opts?.onStart,
      onEnd: endOnce,
    });
    if (!ok && !signal.stopped) {
      opts?.onError?.();
      endOnce();
    }
  })();

  return { stop, done };
}
