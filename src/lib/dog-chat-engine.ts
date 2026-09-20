/**
 * Dooogs! dog-chat engine — domain chatbot best practices (2026):
 * Intent → retrieve breed/topic knowledge → grounded reply (LLM or composed)
 * → speakable text (no markdown) → suggestions.
 *
 * Cascaded voice path lives in the UI: STT → this engine → TTS.
 */

import { isWeakDogReply } from "@/lib/dog-expert";
import {
  getBreedKnowledgeSnippet,
  offlineDogReply,
} from "@/lib/dog-offline";
import { apiUrl } from "@/lib/api-url";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type DogChatTurn = {
  reply: string;
  suggestions: string[];
  source: string;
  breedId?: string | null;
  topic?: string | null;
};

/** True only for real continuations — NOT "tell me about X" / "what about Labs". */
export function isSoftFollowUp(text: string, namedBreedInMessage: boolean): boolean {
  if (namedBreedInMessage) return false;
  const t = text.trim().toLowerCase();
  return (
    /^(tell me more|more(?:\s+please)?|and then|what about (?:that|them|it|him|her)\b|how about (?:that|them|it)\b|go on|continue|another angle)/i.test(
      t
    ) ||
    /^(dis-moi plus|encore|et (?:ensuite|après)|autre angle|continue)/i.test(t) ||
    /^(training tips|diet|foods?|éducation|alimentation|toilettage|grooming|apartment|appart)\b/i.test(
      t
    )
  );
}

export function detectTopic(
  text: string
): "training" | "food" | "health" | "grooming" | "apartment" | "choose" | "toxic" | null {
  const t = text.toLowerCase();
  if (/toxic|chocolat|xylitol|grape|raisin|onion|oignon|poison|never eat|ne jamais/.test(t))
    return "toxic";
  if (/train|éduc|puppy|chiot|leash|laisse|bark|aboie|obedi|sociali/.test(t)) return "training";
  if (/food|diet|feed|eat|kibble|croquette|aliment|friandise|treat/.test(t)) return "food";
  if (/groom|toilet|coat|poil|shed|mue|brush/.test(t)) return "grooming";
  if (/apart|appartement|flat|condo|small space|petit espace/.test(t)) return "apartment";
  if (/health|santé|vet|véto|hip|dysplas|allerg/.test(t)) return "health";
  if (/choose|choisir|which breed|quelle race|best dog|bon chien|first dog|premier/.test(t))
    return "choose";
  return null;
}

/**
 * One conversational turn for Dooogs!.
 * Prefer live Worker AI when it returns grounded content; otherwise compose from KB.
 */
export async function runDogChatTurn(
  userText: string,
  locale: "en" | "fr",
  history: ChatMessage[],
  opts?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<DogChatTurn> {
  const text = userText.trim();
  const nextMessages: ChatMessage[] = [
    ...history,
    { role: "user", content: text },
  ];
  const timeoutMs = opts?.timeoutMs ?? 12_000;
  const snippet = getBreedKnowledgeSnippet(text, locale);
  const topic = detectTopic(text);

  let reply = "";
  let suggestions: string[] = [];
  let source = "offline";
  let fromLiveAi = false;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const onOuter = () => ctrl.abort();
    opts?.signal?.addEventListener("abort", onOuter);
    try {
      const res = await fetch(apiUrl("/api/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          locale,
          // Help the worker ground answers (RAG-lite)
          context: snippet || undefined,
          topic: topic || undefined,
        }),
        signal: ctrl.signal,
      });
      if (res.ok) {
        const data = (await res.json()) as {
          reply?: string;
          suggestions?: string[];
          source?: string;
        };
        reply = data.reply?.trim() || "";
        suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
        source = data.source || "worker";
        fromLiveAi = Boolean(
          reply && data.source && !String(data.source).startsWith("offline")
        );
      }
    } finally {
      clearTimeout(timer);
      opts?.signal?.removeEventListener("abort", onOuter);
    }
  } catch {
    /* offline compose */
  }

  if (!fromLiveAi || !reply || isWeakDogReply(text, reply)) {
    const offline = offlineDogReply(text, locale, nextMessages);
    if (
      !reply ||
      !fromLiveAi ||
      isWeakDogReply(text, reply) ||
      offline.reply.length > reply.length + 40
    ) {
      reply = offline.reply;
      suggestions = offline.suggestions;
      source = fromLiveAi ? "offline_override" : "offline_kb";
    }
  }

  if (!suggestions.length) {
    suggestions =
      locale === "fr"
        ? ["Éducation", "Alimentation", "Autre race"]
        : ["Training tips", "Diet & foods", "Another breed"];
  }

  return { reply, suggestions, source, topic };
}
