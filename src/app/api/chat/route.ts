import { NextResponse } from "next/server";
import {
  dogExpertSystemPrompt,
  parseReplyAndSuggestions,
  suggestionSystemExtra,
} from "@/lib/dog-expert";
import { offlineDogReply } from "@/lib/dog-offline";

export const runtime = "nodejs";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type Body = {
  messages?: ChatMessage[];
  locale?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const locale = body.locale === "fr" ? "fr" : "en";
  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const cleaned = incoming
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim()
    )
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content.replace(/\s+/g, " ").trim().slice(0, 4000),
    }))
    .slice(-24);

  if (!cleaned.length || cleaned[cleaned.length - 1]?.role !== "user") {
    return NextResponse.json({ error: "need_user_message" }, { status: 400 });
  }

  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    const lastUser = cleaned[cleaned.length - 1]!.content;
    const offline = offlineDogReply(lastUser, locale, cleaned);
    return NextResponse.json({
      reply: offline.reply,
      suggestions: offline.suggestions,
      source: "offline",
    });
  }

  const system = `${dogExpertSystemPrompt(locale)}\n\n${suggestionSystemExtra(locale)}`;

  try {
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o",
        temperature: 0.55,
        max_tokens: 1100,
        messages: [{ role: "system", content: system }, ...cleaned],
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      const lastUser = cleaned[cleaned.length - 1]!.content;
      const offline = offlineDogReply(lastUser, locale, cleaned);
      return NextResponse.json({
        reply: offline.reply,
        suggestions: offline.suggestions,
        source: "offline_fallback",
        upstreamStatus: upstream.status,
        detail: detail.slice(0, 200),
      });
    }

    const data = (await upstream.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content?.trim() || "";
    if (!raw) {
      const lastUser = cleaned[cleaned.length - 1]!.content;
      const offline = offlineDogReply(lastUser, locale, cleaned);
      return NextResponse.json({
        reply: offline.reply,
        suggestions: offline.suggestions,
        source: "offline_empty",
      });
    }

    const { reply, suggestions } = parseReplyAndSuggestions(raw);
    return NextResponse.json({
      reply,
      suggestions:
        suggestions.length > 0
          ? suggestions
          : locale === "fr"
            ? ["En savoir plus", "Autre race", "Éducation"]
            : ["Tell me more", "Another breed", "Training tips"],
      source: "openai",
    });
  } catch {
    const lastUser = cleaned[cleaned.length - 1]!.content;
    const offline = offlineDogReply(lastUser, locale, cleaned);
    return NextResponse.json({
      reply: offline.reply,
      suggestions: offline.suggestions,
      source: "offline_error",
    });
  }
}
