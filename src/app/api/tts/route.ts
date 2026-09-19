import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Body = {
  text?: string;
  locale?: string;
};

/**
 * Ginny spoken dialog — OpenAI TTS (human-like).
 * Set OPENAI_API_KEY in .env.local to enable.
 */
export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      { error: "missing_openai_key", hint: "Add OPENAI_API_KEY to .env.local" },
      { status: 501 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const text = (body.text ?? "").replace(/\s+/g, " ").trim().slice(0, 4000);
  if (!text) {
    return NextResponse.json({ error: "empty_text" }, { status: 400 });
  }

  const locale = body.locale === "fr" ? "fr" : "en";
  // nova / shimmer read as warm, natural female voices
  const voice = locale === "fr" ? "nova" : "shimmer";

  const upstream = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1-hd",
      voice,
      input: text,
      response_format: "mp3",
      speed: 1.0,
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: "tts_upstream", status: upstream.status, detail: detail.slice(0, 300) },
      { status: 502 }
    );
  }

  const audio = await upstream.arrayBuffer();
  return new NextResponse(audio, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
