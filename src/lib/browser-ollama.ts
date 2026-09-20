/**
 * Prefer free local Ollama from the browser when the visitor has it running.
 * Requires Ollama CORS: OLLAMA_ORIGINS="*" (or your site origin).
 */
import {
  dogExpertSystemPrompt,
  parseReplyAndSuggestions,
  suggestionSystemExtra,
} from "@/lib/dog-expert";

const DEFAULT_BASE = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "llama3.1:8b";

type Msg = { role: "user" | "assistant"; content: string };

export type BrowserOllamaResult = {
  reply: string;
  suggestions: string[];
  source: string;
} | null;

export async function tryBrowserOllama(
  messages: Msg[],
  locale: "en" | "fr"
): Promise<BrowserOllamaResult> {
  if (typeof window === "undefined") return null;

  const base = (
    process.env.NEXT_PUBLIC_OLLAMA_BASE_URL || DEFAULT_BASE
  ).replace(/\/+$/, "");
  const model = process.env.NEXT_PUBLIC_OLLAMA_CHAT_MODEL || DEFAULT_MODEL;
  const system = `${dogExpertSystemPrompt(locale)}\n\n${suggestionSystemExtra(locale)}`;

  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 90_000);

  try {
    const res = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.55,
        max_tokens: 1100,
        messages: [{ role: "system", content: system }, ...messages],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content?.trim() || "";
    if (!raw) return null;
    const { reply, suggestions } = parseReplyAndSuggestions(raw);
    return {
      reply,
      suggestions:
        suggestions.length > 0
          ? suggestions
          : locale === "fr"
            ? ["En savoir plus", "Autre race", "Éducation"]
            : ["Tell me more", "Another breed", "Training tips"],
      source: `browser-ollama:${model}`,
    };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}
