import type { Locale } from "@/lib/lisa-types";
import { apiUrl } from "@/lib/api-url";

/** Tiny silent WAV — unlocks iOS/Android autoplay on a shared Audio element. */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

let sharedAudio: HTMLAudioElement | null = null;
let audioUnlocked = false;
let speechUnlocked = false;

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

/** Make reply text sound more natural when spoken aloud. */
export function forSpokenVoice(html: string): string {
  let text = stripDialogHtml(html);
  // Soften abbreviations that TTS mangles
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
  // Cap length for mobile TTS reliability (still a full answer)
  if (text.length > 1200) {
    const cut = text.slice(0, 1180);
    const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
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

/**
 * Must run inside a user gesture (tap sound, send, mic).
 * Unlocks HTMLAudio + SpeechSynthesis for later async replies (critical on iOS).
 */
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

  try {
    if (!speechUnlocked && window.speechSynthesis) {
      const warm = new SpeechSynthesisUtterance(" ");
      warm.volume = 0;
      warm.rate = 1;
      window.speechSynthesis.speak(warm);
      window.speechSynthesis.cancel();
      speechUnlocked = true;
      // Prime voice list on iOS
      void window.speechSynthesis.getVoices();
    }
  } catch {
    speechUnlocked = true;
  }
}

export function isDooogsAudioUnlocked(): boolean {
  return audioUnlocked || speechUnlocked;
}

function scoreVoice(v: SpeechSynthesisVoice, locale: Locale): number {
  const name = `${v.name} ${v.lang}`.toLowerCase();
  let score = 0;
  const want = locale === "fr" ? "fr" : "en";
  if (v.lang.toLowerCase().startsWith(want)) score += 40;
  if (v.lang.toLowerCase().startsWith(want === "fr" ? "fr-ca" : "en-us")) score += 14;
  if (/(neural|premium|enhanced|natural|siri|quality|google|microsoft)/.test(name))
    score += 45;
  if (v.localService === false) score += 35;
  if (
    /(samantha|karen|moira|fiona|tessa|aria|jenny|sonia|allison|ava|nicky|zoe|zoey|susan|victoria|google us english|google uk english female|microsoft.*(aria|jenny|zira)|amelie|amélie|aurelie|aurélie|marie|thomas|nicky)/.test(
      name
    )
  ) {
    score += 40;
  }
  if (/(female|woman|girl)/.test(name)) score += 10;
  if (/(compact|eloquence)/.test(name)) score -= 15;
  if (/(male|david|daniel|alex|fred|riviere)/.test(name) && !/female/.test(name))
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
    window.setTimeout(done, 900);
  });
}

type SpeakHandles = {
  stop: () => void;
  done: Promise<void>;
};

function speakWithBrowser(
  text: string,
  locale: Locale,
  signal: { stopped: boolean },
  opts?: { onStart?: () => void; onEnd?: () => void }
): Promise<void> {
  return new Promise(async (resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      opts?.onEnd?.();
      resolve();
      return;
    }

    await waitForVoices();
    if (signal.stopped) {
      resolve();
      return;
    }

    const chunks =
      text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [
        text,
      ];
    // Keep spoken chunks short — sounds more human, works better on iOS
    const parts: string[] = [];
    for (const c of chunks) {
      if (c.length <= 180) parts.push(c);
      else {
        const bits = c.split(/,\s+/);
        let buf = "";
        for (const b of bits) {
          if ((buf + ", " + b).length > 160) {
            if (buf) parts.push(buf);
            buf = b;
          } else {
            buf = buf ? `${buf}, ${b}` : b;
          }
        }
        if (buf) parts.push(buf);
      }
    }

    const voice = pickBrowserVoice(locale);
    opts?.onStart?.();

    // iOS Safari pauses speechSynthesis when the UI updates — keep it alive
    const keepAlive = window.setInterval(() => {
      try {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          /* ok */
        } else if (window.speechSynthesis.speaking) {
          window.speechSynthesis.resume();
        }
      } catch {
        /* ignore */
      }
    }, 200);

    try {
      for (const chunk of parts) {
        if (signal.stopped) break;
        await new Promise<void>((chunkDone) => {
          const utter = new SpeechSynthesisUtterance(chunk);
          utter.lang = locale === "fr" ? "fr-FR" : "en-US";
          // Conversational pacing — like a real person, not a robot
          utter.rate = 1.02;
          utter.pitch = 1.08;
          utter.volume = 1;
          if (voice) utter.voice = voice;
          utter.onend = () => chunkDone();
          utter.onerror = () => chunkDone();
          try {
            window.speechSynthesis.resume();
          } catch {
            /* ignore */
          }
          window.speechSynthesis.speak(utter);
        });
        // Tiny natural pause between sentences
        if (!signal.stopped) {
          await new Promise((r) => window.setTimeout(r, 120));
        }
      }
    } finally {
      window.clearInterval(keepAlive);
      opts?.onEnd?.();
      resolve();
    }
  });
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
      // If already finished somehow
      if (audio.ended) resolve();
    });
    opts?.onEnd?.();
    return true;
  } catch {
    opts?.onEnd?.();
    return false;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Speak Dooogs! replies. Unlocks on first gesture; uses shared TTS MP3 when
 * possible, then a natural browser voice — reliable on mobile + desktop.
 */
export function speakDooogs(
  html: string,
  locale: Locale,
  opts?: { onStart?: () => void; onEnd?: () => void }
): SpeakHandles {
  const text = forSpokenVoice(html);
  const signal = { stopped: false };
  const abort = new AbortController();

  const stop = () => {
    signal.stopped = true;
    abort.abort();
    try {
      if (sharedAudio) {
        sharedAudio.pause();
        sharedAudio.removeAttribute("src");
        sharedAudio.load();
      }
    } catch {
      /* ignore */
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    opts?.onEnd?.();
  };

  const done = (async () => {
    if (!text || signal.stopped) return;

    // 1) Shared neural TTS MP3 (same voice phone + desktop)
    try {
      const res = await fetch(apiUrl("/api/tts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, locale }),
        signal: abort.signal,
      });
      if (res.ok) {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("json")) throw new Error("tts_json");
        const blob = await res.blob();
        if (blob.size > 500) {
          const played = await speakWithSharedMp3(blob, signal, opts);
          if (played || signal.stopped) return;
        }
      }
    } catch {
      /* fall through to browser voice */
    }

    if (signal.stopped) return;

    // 2) Natural browser voice (works offline; unlocked on mobile after tap)
    await speakWithBrowser(text, locale, signal, opts);
  })();

  return { stop, done };
}
