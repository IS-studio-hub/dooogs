"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/lisa-types";

type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: { results: { [i: number]: { [j: number]: { transcript: string }; isFinal: boolean } } }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getSpeechRecognition(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function GinnyAskBar({
  locale,
  disabled,
  listening,
  onListeningChange,
  onSubmit,
  placeholder,
}: {
  locale: Locale;
  disabled?: boolean;
  listening: boolean;
  onListeningChange: (v: boolean) => void;
  onSubmit: (text: string, meta?: { fromMic?: boolean }) => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const recRef = useRef<SpeechRec | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  function stopListening() {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    onListeningChange(false);
  }

  function startListening() {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      onSubmit(
        locale === "fr"
          ? "(Le micro n’est pas supporté sur ce navigateur — tape ta question.)"
          : "(Microphone isn’t supported in this browser — please type your question.)"
      );
      return;
    }
    const rec = new Ctor();
    rec.lang = locale === "fr" ? "fr-FR" : "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (ev) => {
      let finalText = "";
      let interim = "";
      const results = ev.results;
      for (let i = 0; i < (results as unknown as { length: number }).length; i++) {
        const row = results[i];
        const piece = row?.[0]?.transcript ?? "";
        if (row?.isFinal) finalText += piece;
        else interim += piece;
      }
      const next = (finalText || interim).trim();
      if (next) setValue(next);
      if (finalText.trim()) {
        const text = finalText.trim();
        setValue(text);
        stopListening();
        onSubmit(text, { fromMic: true });
        setValue("");
      }
    };
    rec.onerror = () => stopListening();
    rec.onend = () => {
      onListeningChange(false);
      recRef.current = null;
    };
    recRef.current = rec;
    onListeningChange(true);
    try {
      rec.start();
    } catch {
      stopListening();
    }
  }

  function toggleMic() {
    if (disabled) return;
    if (listening) stopListening();
    else startListening();
  }

  function send() {
    const text = value.trim();
    if (!text || disabled) return;
    onSubmit(text);
    setValue("");
    inputRef.current?.focus();
  }

  return (
    <form
      className="c-ginny-ask"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <div className={clsx("c-ginny-ask_field", listening && "-listening")}>
        <input
          ref={inputRef}
          type="text"
          className="c-ginny-ask_input"
          value={value}
          disabled={disabled}
          placeholder={
            placeholder ||
            (locale === "fr"
              ? "Demande n’importe quoi sur les chiens…"
              : "Ask anything about dogs…")
          }
          onChange={(e) => setValue(e.target.value)}
          aria-label={locale === "fr" ? "Ta question" : "Your question"}
        />
        <button
          type="button"
          className={clsx("c-ginny-ask_mic", listening && "-on")}
          aria-label={
            listening
              ? locale === "fr"
                ? "Arrêter l’enregistrement"
                : "Stop recording"
              : locale === "fr"
                ? "Parler"
                : "Speak"
          }
          disabled={disabled}
          onClick={toggleMic}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {listening ? (
              <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" />
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
        <button
          type="submit"
          className="c-ginny-ask_send"
          aria-label={locale === "fr" ? "Envoyer" : "Send"}
          disabled={disabled || !value.trim()}
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
      </div>
    </form>
  );
}
