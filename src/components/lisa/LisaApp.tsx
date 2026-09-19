"use client";

import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  pickDialog,
  resolveChoices,
  type LisaChoice,
  type LisaContent,
  type LisaModel,
  type Locale,
} from "@/lib/lisa-types";
import { speakGinny } from "@/lib/ginny-voice";
import { withBase } from "@/lib/base-path";
import { offlineDogReply } from "@/lib/dog-offline";
import { GinnyAskBar } from "./GinnyAskBar";
import { LisaDialog } from "./LisaDialog";
import { LisaMedia } from "./LisaMedia";

type HistoryEntry = {
  id: string;
  dialogHtml: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function LisaApp({
  content,
  locale,
}: {
  content: LisaContent;
  locale: Locale;
}) {
  const [stepId, setStepId] = useState("intro");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [dialogHtml, setDialogHtml] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [typingDone, setTypingDone] = useState(false);
  const [muted, setMuted] = useState(true);
  const [model, setModel] = useState<LisaModel>({});
  const [toast, setToast] = useState<string | null>(null);
  const [documentTitle, setDocumentTitle] = useState("Ginny");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<string[] | null>(null);
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const voiceStopRef = useRef<(() => void) | null>(null);
  const autoTimer = useRef<number | null>(null);
  const typingLock = useRef(false);
  const dialogHtmlRef = useRef("");
  const stepIdRef = useRef(stepId);
  const askingRef = useRef(false);

  const step = content[stepId];

  const scriptChoices = useMemo(
    () => resolveChoices(step?.choices, model),
    [step, model]
  );

  const choices: LisaChoice[] = useMemo(() => {
    if (aiSuggestions?.length) {
      return aiSuggestions.map((label) => ({
        label,
        modelUpdate: { key: "ask", value: label },
      }));
    }
    return scriptChoices;
  }, [aiSuggestions, scriptChoices]);

  const media = useMemo(() => step?.media ?? [], [step?.media]);
  const isCompact = Boolean(step?.isCompact) || thinking;
  const progress = Math.min(
    0.95,
    (step?.progress ?? 0.2) + chatMessages.filter((m) => m.role === "user").length * 0.06
  );

  const [stickyMedia, setStickyMedia] = useState(media);

  useEffect(() => {
    dialogHtmlRef.current = dialogHtml;
  }, [dialogHtml]);

  useEffect(() => {
    stepIdRef.current = stepId;
  }, [stepId]);

  useEffect(() => {
    if (!media.length) return;
    const pick = media[Math.floor(Math.random() * media.length)]!;
    setStickyMedia([pick]);
  }, [media]);

  const displayMedia = stickyMedia;

  const clearAuto = () => {
    if (autoTimer.current) {
      window.clearTimeout(autoTimer.current);
      autoTimer.current = null;
    }
  };

  const showAssistantReply = useCallback(
    (html: string, opts?: { pushPrior?: boolean }) => {
      clearAuto();
      typingLock.current = false;
      if (opts?.pushPrior !== false && dialogHtmlRef.current) {
        setHistory((h) => [
          ...h,
          { id: stepIdRef.current, dialogHtml: dialogHtmlRef.current },
        ]);
      }
      setStepId("chat");
      setDialogHtml(html);
      setTypingDone(false);
      setExpanded(false);
      setDocumentTitle("Ginny");
    },
    []
  );

  const askDog = useCallback(
    async (userText: string, opts?: { fromMic?: boolean }) => {
      const text = userText.trim();
      if (!text || askingRef.current) return;
      // Ignore mic capability notices as real questions
      if (text.startsWith("(") && text.endsWith(")")) {
        setToast(text.replace(/^\(|\)$/g, ""));
        window.setTimeout(() => setToast(null), 3200);
        return;
      }

      askingRef.current = true;
      setThinking(true);
      setExpanded(true);
      if (opts?.fromMic) setMuted(false);

      const nextMessages: ChatMessage[] = [
        ...chatMessages,
        { role: "user", content: text },
      ];
      setChatMessages(nextMessages);

      // Park current line in history, show thinking
      if (dialogHtmlRef.current) {
        setHistory((h) => [
          ...h,
          { id: stepIdRef.current, dialogHtml: dialogHtmlRef.current },
        ]);
      }
      const thinkingLine =
        locale === "fr"
          ? "Je réfléchis… une seconde."
          : "Thinking… one second.";
      setStepId("chat");
      setDialogHtml(thinkingLine);
      setTypingDone(false);
      setExpanded(false);

      try {
        const res = await fetch(withBase("/api/chat"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: nextMessages, locale }),
        });
        let reply = "";
        let suggestions: string[] | null = null;
        if (res.ok) {
          const data = (await res.json()) as {
            reply?: string;
            suggestions?: string[];
          };
          reply = data.reply?.trim() || "";
          if (Array.isArray(data.suggestions) && data.suggestions.length) {
            suggestions = data.suggestions;
          }
        }
        if (!reply) {
          const offline = offlineDogReply(text, locale, nextMessages);
          reply = offline.reply;
          suggestions = offline.suggestions;
        }
        setChatMessages((m) => [...m, { role: "assistant", content: reply }]);
        setAiSuggestions(suggestions);
        // Thinking line is current — replace in place (prior reply already archived)
        showAssistantReply(reply, { pushPrior: false });
      } catch {
        const offline = offlineDogReply(text, locale, nextMessages);
        setChatMessages((m) => [
          ...m,
          { role: "assistant", content: offline.reply },
        ]);
        setAiSuggestions(offline.suggestions);
        showAssistantReply(offline.reply, { pushPrior: false });
      } finally {
        setThinking(false);
        askingRef.current = false;
      }
    },
    [chatMessages, locale, showAssistantReply]
  );

  const goTo = useCallback(
    (nextId: string, opts?: { pushHistory?: boolean; modelPatch?: LisaModel }) => {
      const next = content[nextId];
      if (!next) return;
      clearAuto();
      typingLock.current = false;
      setHistory((h) => {
        if (opts?.pushHistory === false) return h;
        if (!dialogHtml) return h;
        return [...h, { id: stepId, dialogHtml }];
      });
      if (opts?.modelPatch) {
        setModel((m) => ({ ...m, ...opts.modelPatch }));
      }
      setStepId(nextId);
      const html = next.dialog?.list ? pickDialog(next.dialog.list) : "";
      setDialogHtml(html);
      setTypingDone(false);
      setExpanded(false);
      if (nextId === "chat") setDocumentTitle("Ginny");
      else setDocumentTitle("Ginny");
    },
    [content, dialogHtml, stepId]
  );

  useEffect(() => {
    const intro = content.intro;
    if (!intro) return;
    setDialogHtml(intro.dialog?.list ? pickDialog(intro.dialog.list) : "");
  }, [content]);

  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.35;
    if (!muted) {
      void audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  }, [muted]);

  // Ginny speaks each dialog line when sound is on (skip the brief thinking line if muted stays on — still speak when unmuted)
  useEffect(() => {
    voiceStopRef.current?.();
    voiceStopRef.current = null;
    if (muted || !dialogHtml || thinking) return;

    const ambient = audioRef.current;
    const { stop } = speakGinny(dialogHtml, locale, {
      onStart: () => {
        if (ambient) ambient.volume = 0.12;
      },
      onEnd: () => {
        if (ambient && !muted) ambient.volume = 0.35;
      },
    });
    voiceStopRef.current = stop;
    return () => {
      stop();
      voiceStopRef.current = null;
      if (ambient && !muted) ambient.volume = 0.35;
    };
  }, [dialogHtml, muted, locale, thinking]);

  const onTypingComplete = useCallback(() => {
    if (typingLock.current) return;
    typingLock.current = true;
    setTypingDone(true);
    setExpanded(true);

    if (step?.next && stepId !== "chat" && !thinking) {
      const delay = 1200;
      clearAuto();
      autoTimer.current = window.setTimeout(() => {
        goTo(step.next!);
      }, delay);
    }
  }, [step, stepId, thinking, goTo]);

  function handleChoice(choice: LisaChoice) {
    if (choice.clickToCopy) {
      void navigator.clipboard.writeText(choice.clickToCopy.toCopy);
      setToast(choice.clickToCopy.confirmation);
      window.setTimeout(() => setToast(null), 2200);
      return;
    }
    if (choice.href) {
      window.open(choice.href, "_blank", "noopener,noreferrer");
      return;
    }
    if (choice.emit === "form-retry") {
      setChatMessages([]);
      setAiSuggestions(null);
      goTo("chat", { pushHistory: false });
      setHistory([]);
      return;
    }

    const ask =
      (choice.modelUpdate?.key === "ask" && choice.modelUpdate.value) ||
      (!choice.target ? choice.label.replace(/<[^>]+>/g, "") : null);

    if (ask) {
      void askDog(ask);
      return;
    }

    const patch: LisaModel = {};
    if (choice.modelUpdate) {
      patch[choice.modelUpdate.key] =
        choice.modelUpdate.value ?? choice.label.replace(/<[^>]+>/g, "");
    }
    if (choice.target) goTo(choice.target, { modelPatch: patch });
    else if (Object.keys(patch).length) setModel((m) => ({ ...m, ...patch }));
  }

  function handleBack() {
    clearAuto();
    setHistory((h) => {
      if (!h.length) {
        goTo("chat", { pushHistory: false });
        return [];
      }
      const prev = h[h.length - 1];
      const rest = h.slice(0, -1);
      setStepId(prev.id);
      setDialogHtml(prev.dialogHtml);
      setTypingDone(true);
      setExpanded(true);
      return rest;
    });
  }

  function handleSheetClick() {
    if (!typingDone) {
      onTypingComplete();
      return;
    }
    if (step?.next && stepId !== "chat" && !thinking) {
      goTo(step.next);
    }
  }

  function handleAskSubmit(text: string, meta?: { fromMic?: boolean }) {
    void askDog(text, { fromMic: Boolean(meta?.fromMic) });
  }

  if (!step) {
    return <div className="c-lisa">Missing step.</div>;
  }

  const showAskBar = stepId === "chat" || chatMessages.length > 0;

  return (
    <div
      className={clsx("c-lisa", isCompact && "is-compact")}
      style={{ ["--progress" as string]: String(progress) }}
    >
      <audio ref={audioRef} src={withBase("/assets/lisa/fx/ambient.mp3")} loop preload="auto" />

      <LisaMedia
        media={displayMedia}
        muted={muted}
        clip={typingDone && !thinking ? "idle" : "talk"}
      />

      <div className="c-lisa_main" onClick={handleSheetClick}>
        <div className={clsx("c-lisa_step", "c-lisa-step", expanded && "-expanded")}>
          {history.length > 0 ? (
            <button
              type="button"
              className="c-lisa-step_previous"
              aria-label={history[history.length - 1]?.dialogHtml.replace(/<[^>]+>/g, "")}
              onClick={(e) => {
                e.stopPropagation();
                handleBack();
              }}
              dangerouslySetInnerHTML={{
                __html: history[history.length - 1]?.dialogHtml ?? "",
              }}
            />
          ) : null}

          <LisaDialog
            key={`${stepId}-${dialogHtml.slice(0, 40)}-${chatMessages.length}`}
            html={dialogHtml}
            showCursor={!typingDone}
            onComplete={onTypingComplete}
          />

          <div className="c-lisa-step_content" onClick={(e) => e.stopPropagation()}>
            {choices.length > 0 && !thinking ? (
              <div className="c-lisa-step_choices">
                {choices.map((choice) => (
                  <button
                    key={choice.label}
                    type="button"
                    className="c-lisa_button -primary c-lisa-step_choice"
                    onClick={() => handleChoice(choice)}
                    dangerouslySetInnerHTML={{ __html: choice.label }}
                  />
                ))}
              </div>
            ) : null}

            {showAskBar ? (
              <GinnyAskBar
                locale={locale}
                disabled={thinking || !typingDone}
                listening={listening}
                onListeningChange={setListening}
                onSubmit={handleAskSubmit}
              />
            ) : null}

            {thinking ? <span className="c-lisa_loading" /> : null}
          </div>
        </div>
      </div>

      {history.length > 0 || stepId !== "intro" ? (
        <button
          type="button"
          className="c-lisa_back"
          aria-label={locale === "fr" ? "Retour" : "Back"}
          onClick={handleBack}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M9.5 7.5A5.5 5.5 0 1 1 7 16.2"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M9 4.5v4H5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : null}

      <button
        type="button"
        className={clsx("c-lisa_sound", muted && "-muted")}
        aria-label={locale === "fr" ? "Son / voix de Ginny" : "Sound / Ginny’s voice"}
        onClick={() => setMuted((m) => !m)}
      >
        <span className="c-lisa_sound-icon -on" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M4 9v6h3l5 4V5L7 9H4zm11.5 3a3.5 3.5 0 0 0-1.5-2.9v5.8a3.5 3.5 0 0 0 1.5-2.9zm-1.5-7v1.5a6.5 6.5 0 0 1 0 11v1.5a8 8 0 0 0 0-14z" />
          </svg>
        </span>
        <span className="c-lisa_sound-icon -off" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M4 9v6h3l5 4V5L7 9H4zm12.5 1.5 1.8-1.8 1.4 1.4-1.8 1.8 1.8 1.8-1.4 1.4-1.8-1.8-1.8 1.8-1.4-1.4 1.8-1.8-1.8-1.8 1.4-1.4 1.8 1.8z" />
          </svg>
        </span>
      </button>

      <div className="c-lisa_progress" aria-hidden="true" />

      {toast ? <div className="c-lisa_toast">{toast}</div> : null}
    </div>
  );
}
