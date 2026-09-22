/**
 * Dooogs! dog-chat engine — domain chatbot best practices (2026):
 * Intent → retrieve breed/topic knowledge → grounded reply (LLM or composed)
 * → speakable text (no markdown) → suggestions.
 *
 * Cascade for GitHub Pages:
 * 1) Local / tunneled Ollama (free, when available)
 * 2) Free cloud LLM (Pollinations — no key)
 * 3) Cloudflare Worker (Workers AI / configured Ollama)
 * 4) Offline dog knowledge base
 */

import { isWeakDogReply } from "@/lib/dog-expert";
import {
  getBreedKnowledgeSnippet,
  offlineDogReply,
} from "@/lib/dog-offline";
import { apiUrl } from "@/lib/api-url";
import { tryBrowserOllama } from "@/lib/browser-ollama";
import { chatWithFreeLlm } from "@/lib/free-llm";

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
 * Prefer live AI when grounded; otherwise compose from the dog KB.
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
  const timeoutMs = opts?.timeoutMs ?? 28_000;
  const snippet = getBreedKnowledgeSnippet(text, locale);
  const topic = detectTopic(text);

  let reply = "";
  let suggestions: string[] = [];
  let source = "offline";
  let fromLiveAi = false;

  // 1) Ollama (local or public tunnel) — free Llama-class models
  try {
    const ollama = await tryBrowserOllama(nextMessages, locale);
    if (ollama?.reply && !isWeakDogReply(text, ollama.reply)) {
      return {
        reply: ollama.reply,
        suggestions: ollama.suggestions,
        source: ollama.source,
        topic,
      };
    }
    if (ollama?.reply) {
      reply = ollama.reply;
      suggestions = ollama.suggestions;
      source = ollama.source;
      fromLiveAi = true;
    }
  } catch {
    /* next */
  }

  // 2) Free cloud LLM (works on GitHub Pages with no keys)
  if (!fromLiveAi || isWeakDogReply(text, reply)) {
    try {
      const free = await chatWithFreeLlm(nextMessages, locale, {
        signal: opts?.signal,
        timeoutMs: Math.min(timeoutMs, 28_000),
        context: snippet || undefined,
      });
      if (free?.reply && !isWeakDogReply(text, free.reply)) {
        return {
          reply: free.reply,
          suggestions: free.suggestions,
          source: free.source,
          topic,
        };
      }
      if (free?.reply) {
        reply = free.reply;
        suggestions = free.suggestions;
        source = free.source;
        fromLiveAi = true;
      }
    } catch {
      /* next */
    }
  }

  // 3) Cloudflare Worker (Workers AI / configured Ollama)
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Math.min(timeoutMs, 14_000));
    const onOuter = () => ctrl.abort();
    opts?.signal?.addEventListener("abort", onOuter);
    try {
      const res = await fetch(apiUrl("/api/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          locale,
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
        const workerReply = data.reply?.trim() || "";
        const workerSource = data.source || "worker";
        const workerLive = Boolean(
          workerReply && data.source && !String(data.source).startsWith("offline")
        );
        if (workerLive && workerReply && !isWeakDogReply(text, workerReply)) {
          return {
            reply: workerReply,
            suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
            source: workerSource,
            topic,
          };
        }
        if (workerReply && (!reply || workerReply.length > reply.length)) {
          reply = workerReply;
          suggestions = Array.isArray(data.suggestions) ? data.suggestions : suggestions;
          source = workerSource;
          fromLiveAi = workerLive || fromLiveAi;
        }
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
