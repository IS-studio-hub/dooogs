/**
 * Dooogs! chat + TTS proxy for GitHub Pages (static host has no Node API routes).
 * Secrets: OPENAI_API_KEY (required), OPENAI_CHAT_MODEL (optional).
 */

const ALLOWED_ORIGINS = [
  "https://is-studio-hub.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

function corsHeaders(req) {
  const origin = req.headers.get("Origin") || "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(req, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(req) },
  });
}

function dogExpertSystemPrompt(locale) {
  if (locale === "fr") {
    return `Tu es Dooogs!, une experte mondiale des chiens et des races canines. Tu parles comme une guide chaleureuse, intelligente et naturelle (tu es aussi un caniche virtuel sympathique, sans en faire trop).

MISSION
- Répondre avec une expertise profonde sur TOUTES les races reconnues (FCI, AKC, Kennel Club, etc.) et les types de chiens dans le monde.
- Couvrir quand c’est pertinent: histoire et origines, pays/régions où la race est courante, comportement et personnalité, alimentation et précautions alimentaires, forces et faiblesses, défis courants, style de vie idéal, besoins d’exercice, éducation, sociabilité, toilettage, santé typique, et où en apprendre / en voir davantage (clubs, expos, sources fiables).
- Mémoriser le fil de la conversation et répondre aux questions de suivi sans forcer l’utilisateur à se répéter.
- Si la question n’est PAS sur les chiens: répondre avec intelligence et bienveillance, puis ramener naturellement vers les chiens quand c’est possible. Ne jamais être sèche ni moralisatrice.

STYLE
- Français naturel, clair, conversationnel. Phrases courtes à moyennes. Pas de listes markdown lourdes sauf si vraiment utile.
- Tu peux utiliser <br> pour les sauts de ligne. Pas de markdown (#, **, bullets -).
- Réponses complètes mais digeste: environ 80–180 mots sauf si l’utilisateur demande plus de détail.
- Termine parfois par une question douce pour continuer, sans être insistante.

SORTIE
- Réponds UNIQUEMENT avec le texte à afficher/dire à l’utilisateur (HTML léger <br> OK). Pas de préambule JSON.`;
  }
  return `You are Dooogs!, a world-class expert on dogs and dog breeds. You speak like a warm, intelligent, natural guide (you’re also a friendly virtual poodle — light touch, never cartoonish).

MISSION
- Answer with deep expertise on ALL recognized breeds worldwide (FCI, AKC, The Kennel Club, and others) and dog types in general.
- Cover when relevant: history and origin, where the breed is most common, behavior and personality, favorite foods and dietary considerations (including toxic foods), strengths and weaknesses, common challenges, ideal lifestyle, exercise needs, training style, social behavior, grooming, typical health notes, and where to learn more or see the breed (clubs, shows, reputable sources).
- Remember conversation context and handle follow-ups naturally without making the user repeat themselves.
- If the question is NOT about dogs: answer smartly and sensitively, then gently steer back toward dogs when it fits. Never be curt or preachy.

STYLE
- Natural, clear conversational English. Short-to-medium sentences. Avoid heavy markdown lists unless truly helpful.
- You may use <br> for line breaks. No markdown headings, bold markers, or "- " bullets.
- Complete but digestible answers: roughly 80–180 words unless the user asks for more depth.
- Occasionally end with a soft follow-up question — never pushy.

OUTPUT
- Reply ONLY with the user-facing text (light <br> HTML OK). No JSON preamble.`;
}

function suggestionSystemExtra(locale) {
  return locale === "fr"
    ? `Après ta réponse, sur une NOUVELLE ligne exactement comme ceci (obligatoire):
SUGGESTIONS: suggestion 1 | suggestion 2 | suggestion 3
Les suggestions sont de courtes suites de conversation (max 6 mots chacune), liées au sujet.`
    : `After your answer, on a NEW line exactly like this (required):
SUGGESTIONS: suggestion 1 | suggestion 2 | suggestion 3
Suggestions are short follow-ups (max 6 words each), relevant to the topic.`;
}

function parseReplyAndSuggestions(raw) {
  const marker = /(?:^|\n)\s*SUGGESTIONS:\s*(.+)\s*$/i;
  const match = raw.match(marker);
  if (!match) return { reply: raw.trim(), suggestions: [] };
  const suggestions = match[1]
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
  return { reply: raw.replace(marker, "").trim(), suggestions };
}

function offlineDogReply(userText, locale) {
  const t = (userText || "").toLowerCase();
  const breeds = [
    {
      keys: ["poodle", "caniche"],
      en: "Poodles are brilliant, athletic water dogs with curly low-shed coats that need regular grooming.<br><br>Want training tips, diet notes, or another breed?",
      fr: "Les caniches sont des chiens d’eau brillants au poil bouclé peu sujet à la mue.<br><br>Tu veux éducation, alimentation, ou une autre race?",
    },
    {
      keys: ["labrador", "lab "],
      en: "Labrador Retrievers are friendly, food-motivated gundogs who need daily exercise and training.<br><br>Want diet tips or another breed next?",
      fr: "Le Labrador est amical, motivé par la nourriture, et a besoin d’exercice quotidien.",
    },
  ];
  for (const b of breeds) {
    if (b.keys.some((k) => t.includes(k))) {
      return {
        reply: locale === "fr" ? b.fr : b.en,
        suggestions:
          locale === "fr"
            ? ["Éducation", "Alimentation", "Autre race"]
            : ["Training tips", "Diet & foods", "Another breed"],
      };
    }
  }
  return {
    reply:
      locale === "fr"
        ? "Je suis Dooogs! — parle-moi d’une race, d’éducation, d’alimentation ou de comportement, et je t’aide."
        : "I’m Dooogs! — ask about a breed, training, food, or behavior and I’ll help.",
    suggestions:
      locale === "fr"
        ? ["Caniche", "Aliments toxiques", "Choisir une race"]
        : ["Poodles", "Toxic foods", "Help me choose"],
  };
}

async function handleChat(req, env) {
  let body;
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "invalid_json" }, 400);
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
      role: m.role,
      content: m.content.replace(/\s+/g, " ").trim().slice(0, 4000),
    }))
    .slice(-24);

  if (!cleaned.length || cleaned[cleaned.length - 1]?.role !== "user") {
    return json(req, { error: "need_user_message" }, 400);
  }

  const lastUser = cleaned[cleaned.length - 1].content;
  const key = (env.OPENAI_API_KEY || "").trim();
  if (!key) {
    const offline = offlineDogReply(lastUser, locale);
    return json(req, { ...offline, source: "offline" });
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
        model: (env.OPENAI_CHAT_MODEL || "gpt-4o").trim(),
        temperature: 0.55,
        max_tokens: 1100,
        messages: [{ role: "system", content: system }, ...cleaned],
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      const offline = offlineDogReply(lastUser, locale);
      return json(req, {
        ...offline,
        source: "offline_fallback",
        upstreamStatus: upstream.status,
        detail: detail.slice(0, 200),
      });
    }

    const data = await upstream.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || "";
    if (!raw) {
      const offline = offlineDogReply(lastUser, locale);
      return json(req, { ...offline, source: "offline_empty" });
    }

    const { reply, suggestions } = parseReplyAndSuggestions(raw);
    return json(req, {
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
    const offline = offlineDogReply(lastUser, locale);
    return json(req, { ...offline, source: "offline_error" });
  }
}

async function handleTts(req, env) {
  const key = (env.OPENAI_API_KEY || "").trim();
  if (!key) {
    return json(req, { error: "missing_openai_key" }, 501);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "invalid_json" }, 400);
  }

  const text = (body.text ?? "").replace(/\s+/g, " ").trim().slice(0, 4000);
  if (!text) return json(req, { error: "empty_text" }, 400);

  const locale = body.locale === "fr" ? "fr" : "en";
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
    return json(
      req,
      { error: "tts_upstream", status: upstream.status, detail: detail.slice(0, 300) },
      502
    );
  }

  const audio = await upstream.arrayBuffer();
  return new Response(audio, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=3600",
      ...corsHeaders(req),
    },
  });
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(req) });
    }

    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (req.method === "GET" && (path === "/" || path === "/health")) {
      return json(req, { ok: true, service: "dooogs-api" });
    }

    if (req.method === "POST" && (path === "/api/chat" || path === "/chat")) {
      return handleChat(req, env);
    }
    if (req.method === "POST" && (path === "/api/tts" || path === "/tts")) {
      return handleTts(req, env);
    }

    return json(req, { error: "not_found", path }, 404);
  },
};
