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

/** Make reply text sound more natural when spoken aloud. */
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

/**
 * Must run inside a user gesture (tap sound, send, mic).
 * Unlocks HTMLAudio for later async TTS replies (critical on iOS).
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
}

export function isDooogsAudioUnlocked(): boolean {
  return audioUnlocked;
}

type SpeakHandles = {
  stop: () => void;
  done: Promise<void>;
};

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
    opts?.onEnd?.();
    return false;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function fetchTtsBlob(
  text: string,
  locale: Locale,
  signal: AbortSignal
): Promise<Blob | null> {
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
}

/**
 * Speak Dooogs! replies with the shared Worker TTS MP3 only —
 * same voice on every device. No browser speechSynthesis fallback.
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
    opts?.onEnd?.();
  };

  const done = (async () => {
    if (!text || signal.stopped) return;

    let played = false;
    for (let attempt = 0; attempt < 2 && !signal.stopped && !played; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise((r) => window.setTimeout(r, 280));
        }
        const blob = await fetchTtsBlob(text, locale, abort.signal);
        if (!blob || signal.stopped) continue;
        played = await speakWithSharedMp3(blob, signal, opts);
      } catch {
        /* retry */
      }
    }

    if (!played && !signal.stopped) {
      opts?.onError?.();
      opts?.onEnd?.();
    }
  })();

  return { stop, done };
}
