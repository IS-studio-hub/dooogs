"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/lisa-types";
import { apiUrl } from "@/lib/api-url";
import { unlockDooogsAudio } from "@/lib/dooogs-voice";

type BrowserRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((ev: {
    results: {
      [i: number]: { [j: number]: { transcript: string }; isFinal: boolean };
    };
  }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/aac",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

function getSpeechRecognitionCtor(): (new () => BrowserRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => BrowserRec;
    webkitSpeechRecognition?: new () => BrowserRec;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

let sttAvailableCache: boolean | null = null;

async function probeSttAvailable(): Promise<boolean> {
  if (sttAvailableCache !== null) return sttAvailableCache;
  try {
    // Tiny empty probe — 404/405/502 means Whisper route isn’t live
    const res = await fetch(apiUrl("/api/stt"), {
      method: "OPTIONS",
    });
    // OPTIONS should 204 if worker is updated; older workers may 404
    sttAvailableCache = res.ok || res.status === 204;
  } catch {
    sttAvailableCache = false;
  }
  return sttAvailableCache;
}

export function DooogsAskBar({
  locale,
  disabled,
  listening,
  onListeningChange,
  onSubmit,
  onNotice,
  placeholder,
}: {
  locale: Locale;
  disabled?: boolean;
  listening: boolean;
  onListeningChange: (v: boolean) => void;
  onSubmit: (text: string, meta?: { fromMic?: boolean }) => void;
  onNotice?: (message: string) => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef("");
  const mediaRef = useRef<MediaRecorder | null>(null);
  const browserRecRef = useRef<BrowserRec | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const maxTimerRef = useRef<number | null>(null);
  const submittedRef = useRef(false);
  const hasText = value.trim().length > 0;
  const busy = Boolean(disabled || transcribing);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    return () => {
      teardownRecorder();
      try {
        browserRecRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function notice(msg: string) {
    onNotice?.(msg);
  }

  function teardownRecorder() {
    if (maxTimerRef.current) {
      window.clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    try {
      mediaRef.current?.stop();
    } catch {
      /* ignore */
    }
    mediaRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    chunksRef.current = [];
  }

  async function transcribeBlob(blob: Blob): Promise<string | null> {
    const form = new FormData();
    const ext =
      blob.type.includes("mp4") || blob.type.includes("aac") ? "m4a" : "webm";
    form.append("audio", blob, `dooogs-mic.${ext}`);
    form.append("locale", locale);

    const res = await fetch(apiUrl("/api/stt"), {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      sttAvailableCache = false;
      return null;
    }
    sttAvailableCache = true;
    const data = (await res.json()) as { text?: string };
    return data.text?.trim() || null;
  }

  async function finishRecording(blob: Blob | null) {
    teardownRecorder();
    onListeningChange(false);

    if (!blob || blob.size < 800) {
      notice(
        locale === "fr"
          ? "Je n’ai rien entendu — réessaie ou tape ta question."
          : "I didn’t catch that — try again or type your question."
      );
      return;
    }

    setTranscribing(true);
    try {
      const text = await transcribeBlob(blob);
      if (!text) {
        notice(
          locale === "fr"
            ? "Je n’ai pas compris — réessaie ou tape ta question."
            : "Couldn’t understand that — try again or type your question."
        );
        return;
      }
      setValue(text);
      onSubmit(text, { fromMic: true });
      setValue("");
    } catch {
      notice(
        locale === "fr"
          ? "Micro en erreur — tape ta question."
          : "Mic error — please type your question."
      );
    } finally {
      setTranscribing(false);
    }
  }

  function startWebSpeech() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return false;

    submittedRef.current = false;
    const rec = new Ctor();
    rec.lang = locale === "fr" ? "fr-FR" : "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onresult = (ev) => {
      let finalText = "";
      let interim = "";
      const len = (ev.results as unknown as { length: number }).length;
      for (let i = 0; i < len; i++) {
        const row = ev.results[i];
        const piece = row?.[0]?.transcript ?? "";
        if (row?.isFinal) finalText += piece;
        else interim += piece;
      }
      const next = (finalText || interim).trim();
      if (next) setValue(next);
      if (finalText.trim() && !submittedRef.current) {
        submittedRef.current = true;
        browserRecRef.current = null;
        onListeningChange(false);
        const text = finalText.trim();
        setValue(text);
        onSubmit(text, { fromMic: true });
        setValue("");
      }
    };

    rec.onerror = (ev) => {
      browserRecRef.current = null;
      onListeningChange(false);
      const err = ev?.error || "";
      if (err === "not-allowed" || err === "service-not-allowed") {
        notice(
          locale === "fr"
            ? "Autorise le micro dans le navigateur, ou tape ta question."
            : "Allow microphone access, or type your question."
        );
      } else if (err === "no-speech") {
        notice(
          locale === "fr"
            ? "Je n’ai rien entendu — réessaie."
            : "I didn’t hear anything — try again."
        );
      } else if (err === "network") {
        notice(
          locale === "fr"
            ? "Réseau micro indisponible — tape ta question."
            : "Mic network error — please type your question."
        );
      } else if (err && err !== "aborted") {
        notice(
          locale === "fr"
            ? "Micro en erreur — tape ta question."
            : "Mic error — please type your question."
        );
      }
    };

    rec.onend = () => {
      browserRecRef.current = null;
      onListeningChange(false);
      const draft = valueRef.current.trim();
      if (!submittedRef.current && draft) {
        submittedRef.current = true;
        onSubmit(draft, { fromMic: true });
        setValue("");
      }
    };

    browserRecRef.current = rec;
    onListeningChange(true);
    try {
      rec.start();
      return true;
    } catch {
      browserRecRef.current = null;
      onListeningChange(false);
      return false;
    }
  }

  async function startMediaRecorder() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }
    if (typeof MediaRecorder === "undefined") return false;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    streamRef.current = stream;
    const mime = pickRecorderMime();
    const recorder = mime
      ? new MediaRecorder(stream, { mimeType: mime })
      : new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    recorder.onstop = () => {
      const type = recorder.mimeType || mime || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      void finishRecording(blob);
    };
    recorder.onerror = () => {
      teardownRecorder();
      onListeningChange(false);
      notice(
        locale === "fr"
          ? "Erreur micro — tape ta question."
          : "Mic error — please type your question."
      );
    };
    mediaRef.current = recorder;
    recorder.start(250);
    onListeningChange(true);
    maxTimerRef.current = window.setTimeout(() => {
      if (mediaRef.current?.state === "recording") {
        try {
          mediaRef.current.stop();
        } catch {
          /* ignore */
        }
      }
    }, 12_000);
    return true;
  }

  async function startListening() {
    unlockDooogsAudio();

    // 1) Prefer browser speech recognition when available (works without Worker STT)
    if (getSpeechRecognitionCtor()) {
      if (startWebSpeech()) return;
    }

    // 2) MediaRecorder + Whisper when STT is live (needed on iOS Safari)
    const sttOk = await probeSttAvailable();
    if (sttOk) {
      try {
        if (await startMediaRecorder()) return;
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          notice(
            locale === "fr"
              ? "Autorise le micro dans le navigateur, ou tape ta question."
              : "Allow microphone access, or type your question."
          );
          return;
        }
      }
    }

    notice(
      locale === "fr"
        ? "Micro non supporté ici — tape ta question."
        : "Microphone not supported here — please type your question."
    );
  }

  function stopListening() {
    if (browserRecRef.current) {
      const draft = valueRef.current.trim();
      try {
        browserRecRef.current.stop();
      } catch {
        try {
          browserRecRef.current.abort();
        } catch {
          /* ignore */
        }
      }
      browserRecRef.current = null;
      onListeningChange(false);
      if (draft && !submittedRef.current) {
        submittedRef.current = true;
        onSubmit(draft, { fromMic: true });
        setValue("");
      }
      return;
    }
    if (maxTimerRef.current) {
      window.clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    const rec = mediaRef.current;
    if (rec && rec.state === "recording") {
      try {
        rec.stop();
      } catch {
        teardownRecorder();
        onListeningChange(false);
      }
    } else {
      teardownRecorder();
      onListeningChange(false);
    }
  }

  function toggleMic() {
    if (busy) return;
    if (listening) stopListening();
    else void startListening();
  }

  function send() {
    const text = value.trim();
    if (!text || busy) return;
    unlockDooogsAudio();
    if (listening) stopListening();
    onSubmit(text);
    setValue("");
    inputRef.current?.focus();
  }

  return (
    <form
      className="c-dooogs-ask"
      onSubmit={(e) => {
        e.preventDefault();
        if (hasText) send();
      }}
    >
      <div
        className={clsx(
          "c-dooogs-ask_field",
          listening && "-listening",
          transcribing && "-transcribing"
        )}
      >
        <input
          ref={inputRef}
          type="text"
          className="c-dooogs-ask_input"
          value={value}
          disabled={busy}
          placeholder={
            transcribing
              ? locale === "fr"
                ? "Je t’écoute…"
                : "Hearing you…"
              : listening
                ? locale === "fr"
                  ? "Parle… appuie pour envoyer"
                  : "Speak… tap to send"
                : placeholder ||
                  (locale === "fr"
                    ? "Demande n’importe quoi sur les chiens…"
                    : "Ask anything about dogs…")
          }
          onChange={(e) => {
            const next = e.target.value;
            if (next.trim() && listening) stopListening();
            setValue(next);
          }}
          aria-label={locale === "fr" ? "Ta question" : "Your question"}
        />
        {hasText && !listening ? (
          <button
            type="submit"
            className="c-dooogs-ask_action -send"
            aria-label={locale === "fr" ? "Envoyer" : "Send"}
            disabled={busy}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 12h12M13 6l6 6-6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            className={clsx("c-dooogs-ask_action -mic", listening && "-on")}
            aria-label={
              listening
                ? locale === "fr"
                  ? "Arrêter et envoyer"
                  : "Stop and send"
                : locale === "fr"
                  ? "Parler"
                  : "Speak"
            }
            disabled={busy}
            onClick={toggleMic}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {listening ? (
                <rect
                  x="7"
                  y="7"
                  width="10"
                  height="10"
                  rx="1.5"
                  fill="currentColor"
                />
              ) : (
                <>
                  <path
                    d="M12 3a3 3 0 0 0-3 3v6a3 3 0 1 0 6 0V6a3 3 0 0 0-3-3z"
                    fill="currentColor"
                  />
                  <path
                    d="M5 11a7 7 0 0 0 14 0M12 18v3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </>
              )}
            </svg>
          </button>
        )}
      </div>
    </form>
  );
}
