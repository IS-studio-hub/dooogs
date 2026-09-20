/**
 * Dooogs! chat API for GitHub Pages.
 * Uses Cloudflare Workers AI (Llama 3.3 70B) — free, no OpenAI key.
 * Optional: set OLLAMA_BASE_URL secret to proxy a public Ollama host instead.
 */

const ALLOWED_ORIGINS = [
  "https://is-studio-hub.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const WORKERS_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

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
- Répondre UNIQUEMENT dans l’univers des chiens: races (FCI, AKC, Kennel Club, etc.), histoire, caractère, alimentation (y compris toxiques), éducation, toilettage, santé typique, sport canin, voyage avec un chien, choix de race, clubs/expos.
- Mémoriser le fil et gérer les suivis sans faire répéter l’utilisateur.

HORS SUJET (OBLIGATOIRE)
- Si le message n’est pas vraiment sur les chiens: ne développe PAS le sujet (pas de tutoriel, pas d’actualité générale, pas de conseils hors chiens).
- Accroche-toi au sujet en 1 phrase légère ou une image amusante, puis bascule tout de suite vers un angle CHIENS lié (métaphore, anecdote de race, friandise, promenade, caractère…).
- Exemples de ponts: cuisine → aliments toxiques / friandises; voyage → avion/voiture avec un chien; sport → agility/canicross; films → chiens célèbres au cinéma; météo → races et climat; tech → colliers GPS / éducation; romance → races “câlines”; travail → chiens d’assistance/police.
- INTERDIT de dire (ou d’insinuer): “je ne parle que de chiens”, “hors sujet”, “je suis limitée aux chiens”, “revenons aux chiens parce que c’est mon rôle”. Le pivot doit paraître naturel et curieux, jamais policé.

STYLE
- Français naturel, clair, conversationnel. Phrases courtes à moyennes.
- Tu peux utiliser <br> pour les sauts de ligne. Pas de markdown (#, **, bullets -).
- Environ 80–180 mots sauf demande de plus de détail.
- Termine souvent par une question douce liée aux chiens.

SORTIE
- Réponds UNIQUEMENT avec le texte à afficher/dire (HTML léger <br> OK). Pas de préambule JSON.`;
  }
  return `You are Dooogs!, a world-class expert on dogs and dog breeds. You speak like a warm, intelligent, natural guide (you’re also a friendly virtual poodle — light touch, never cartoonish).

MISSION
- Stay ONLY in the dog world: breeds worldwide (FCI, AKC, The Kennel Club, etc.), history, personality, food (including toxic foods), training, grooming, typical health notes, dog sports, traveling with dogs, choosing a breed, clubs/shows.
- Remember conversation context and handle follow-ups without making the user repeat themselves.

OFF-TOPIC (REQUIRED)
- If the message isn’t really about dogs: do NOT develop that topic (no general tutorials, news explainers, or non-dog advice).
- Hook the user’s subject in one light line or playful image, then immediately pivot into a related DOG angle (breed metaphor, treat tip, walk vibe, famous dog, training parallel…).
- Bridge examples: cooking → toxic foods / safe treats; travel → flying or road-tripping with a dog; sports → agility/canicross; movies → famous film dogs; weather → breeds and climate; tech → GPS collars / training tools; romance → cuddly companion breeds; work → service/police dogs.
- NEVER say or imply: “I only talk about dogs”, “that’s off-topic”, “I’m limited to dogs”, “let’s get back to dogs because that’s my job”. The pivot must feel natural and curious — never policed.

STYLE
- Natural, clear conversational English. Short-to-medium sentences.
- You may use <br> for line breaks. No markdown headings, bold markers, or "- " bullets.
- Roughly 80–180 words unless the user asks for more depth.
- Often end with a soft dog-related follow-up question.

OUTPUT
- Reply ONLY with the user-facing text (light <br> HTML OK). No JSON preamble.`;
}

function suggestionSystemExtra(locale) {
  return locale === "fr"
    ? `Après ta réponse, sur une NOUVELLE ligne exactement comme ceci (obligatoire):
SUGGESTIONS: suggestion 1 | suggestion 2 | suggestion 3
Les suggestions sont de courtes suites LIÉES AUX CHIENS (max 6 mots chacune), même si le message de départ n’en parlait pas.`
    : `After your answer, on a NEW line exactly like this (required):
SUGGESTIONS: suggestion 1 | suggestion 2 | suggestion 3
Suggestions are short DOG-related follow-ups (max 6 words each), even if the user’s message wasn’t about dogs.`;
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
    { keys: ["poodle", "caniche"], en: "Poodles (Standard, Mini, Toy) are brilliant athletic water dogs with curly low-shed coats that need regular grooming. German water-dog roots, beloved in France; common in Europe and North America. Train with brain games; never chocolate, grapes, xylitol, or onions.", fr: "Les caniches sont des chiens d’eau brillants au poil bouclé peu sujet à la mue, qui demandent un toilettage régulier. Racines allemandes, très aimés en France." },
    { keys: ["labrador", "lab "], en: "Labrador Retrievers are friendly, food-motivated gundogs from Newfoundland’s St. John’s dogs, refined in Britain. High energy, soft mouths, daily walks and training. Watch weight; never chocolate, grapes, xylitol, or cooked bones.", fr: "Le Labrador est un chien de rapport amical, motivé par la nourriture, avec beaucoup d’énergie et besoin d’éducation." },
    { keys: ["german shepherd", "berger allemand", "gsd"], en: "German Shepherds are loyal versatile working dogs — herding roots, police and sport roles. Need structure, training, and serious exercise. Socialize early; avoid toxic human foods.", fr: "Le berger allemand est un chien de travail loyal et polyvalent qui a besoin de structure et d’exercice." },
    { keys: ["golden retriever", "golden"], en: "Golden Retrievers are warm eager gundogs from 19th-century Scotland. Grooming, exercise, and a job (therapy, field, sports). Watch ears and weight; never chocolate, grapes, xylitol, or onions.", fr: "Le Golden Retriever est un chien de rapport chaleureux, gueule douce, très proche des humains." },
    { keys: ["french bulldog", "frenchie", "bouledogue"], en: "French Bulldogs are compact apartment-friendly companions with bat ears. Mind heat and breathing; moderate walks; harnesses; avoid obesity and toxic foods.", fr: "Le bouledogue français est un compagnon compact — attention chaleur et respiration." },
    { keys: ["beagle"], en: "Beagles are merry scent hounds — nose-driven and vocal. Need sniff walks and secure fencing. Food-motivated; watch weight. No chocolate, grapes, or xylitol.", fr: "Le Beagle est un chien courant joyeux, mené par le nez, avec sa voix typique." },
    { keys: ["border collie", "border"], en: "Border Collies are elite herding athletes with intense focus. Need a real job (herding, agility, advanced training) or they invent chaos.", fr: "Le Border Collie est un athlète de troupeau — il lui faut un vrai job." },
    { keys: ["dachshund", "teckel", "doxie"], en: "Dachshunds are bold long-backed badger dogs. Protect the back (ramps, no big jumps). Short walks plus sniff games; watch weight.", fr: "Le teckel est audacieux et bas — protège le dos, évite les grands sauts." },
    { keys: ["husky", "siberian"], en: "Siberian Huskies are endurance sled dogs — athletic, independent, vocal. Need serious exercise and secure fencing; dislike extreme heat.", fr: "Le Husky sibérien est un chien de traîneau d’endurance — beaucoup d’exercice et clôture solide." },
    { keys: ["shiba"], en: "Shiba Inu are compact Japanese spitz — bold, clean, independent. Early socialization and leash manners; seasonal heavy shed; escape artists.", fr: "Le Shiba Inu est un spitz japonais compact — socialisation et laisse tôt." },
    { keys: ["corgi", "pembroke", "cardigan"], en: "Corgis are short-legged Welsh herders with big personalities. Watch weight (long backs); mental work plus walks.", fr: "Le Corgi est un chien de troupeau bas sur pattes — attention au poids." },
    { keys: ["rottweiler", "rott"], en: "Rottweilers are powerful working dogs from Rottweil, Germany. Need early socialization, clear leadership, and exercise with responsible ownership.", fr: "Le Rottweiler est un chien de travail puissant — socialisation précoce et cadre clair." },
    { keys: ["australian shepherd", "aussie"], en: "Australian Shepherds are energetic US ranch herders (despite the name). Need a job — agility, herding, advanced training.", fr: "L’Australian Shepherd est un chien de troupeau énergique qui a besoin d’un job." },
    { keys: ["boxer"], en: "Boxers are bouncy loyal working dogs with a square muzzle. Daily exercise and training; short coats feel cold and heat.", fr: "Le Boxer est joueur et loyal — exercice et éducation quotidiens." },
    { keys: ["yorkshire", "yorkie"], en: "Yorkshire Terriers are tiny confident toy terriers. Dental care, coat upkeep, gentle handling; never chocolate or xylitol.", fr: "Le Yorkshire est un toy terrier confiant — soins dentaires et toilettage." },
    { keys: ["akita"], en: "Akitas are large dignified Japanese spitz dogs. Experienced handling, socialization, and space; thick seasonal coat.", fr: "L’Akita est un grand spitz japonais digne — main experte et socialisation." },
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
  if (/toxic|chocolat|xylitol|grape|raisin|onion|oignon|poison|aliment.*tox/.test(t)) {
    return {
      reply:
        locale === "fr"
          ? "Jamais: chocolat, xylitol, raisin, oignon, ail, avocat, alcool, café, os cuits. En cas d’ingestion, appelle un véto vite."
          : "Never: chocolate, xylitol, grapes/raisins, onions, garlic, avocado, alcohol, caffeine, cooked bones. Call a vet fast if ingested.",
      suggestions:
        locale === "fr" ? ["Friandises sûres", "Choisir une race"] : ["Safe treats", "Choosing a breed"],
    };
  }
  if (/train|éduc|puppy|chiot|leash|laisse|bark|aboie/.test(t)) {
    return {
      reply:
        locale === "fr"
          ? "Éducation: sessions courtes positives, laisse douce, socialisation, routine. Dis-moi l’âge et la race pour affiner."
          : "Training: short positive sessions, soft leash manners, socialization, routine. Tell me age + breed to tailor tips.",
      suggestions:
        locale === "fr" ? ["Socialisation", "Propreté"] : ["Socialization", "House training"],
    };
  }
  if (/choose|choisir|which breed|quelle race|apart|appartement|family|famille/.test(t)) {
    return {
      reply:
        locale === "fr"
          ? "Pour choisir: énergie, toilettage, taille, expérience, enfants, temps. Décris ton quotidien et je propose 3 pistes."
          : "To choose: energy, grooming, size, experience, kids, time. Describe your day and I’ll suggest 3 fits.",
      suggestions:
        locale === "fr" ? ["Appartement", "Premier chien"] : ["Apartment life", "First dog"],
    };
  }

  const doggy =
    /dog|chien|breed|race|puppy|chiot|canine|groom|toilet|train|éduc|walk|promenade|bark|aboie|leash|laisse|vet|véto|kibble|croquette|toxic|chocolat|xylitol|akc|fci/.test(
      t
    );
  if (!doggy) {
    let reply;
    if (/cook|recipe|food|dinner|cuisine|dîner|pizza|coffee|café/.test(t)) {
      reply =
        locale === "fr"
          ? "Ça sent bon d’ici! Petite pensée canidé: chocolat, xylitol, raisin et oignon restent hors gamelle. Tu veux des friandises sûres, ou une race gourmande type Labrador?"
          : "That smells amazing from here! Quick paw-note: chocolate, xylitol, grapes, and onions stay out of the bowl. Want safe treats, or a food-motivated breed like the Labrador?";
    } else if (/travel|flight|avion|trip|voyage|hotel|vacance/.test(t)) {
      reply =
        locale === "fr"
          ? "Les valises donnent des papillons — aux chiens aussi. Tu pars avec un compagnon, ou tu veux des races plutôt globetrotteuses?"
          : "Suitcases give butterflies — dogs get them too. Traveling with a pup, or curious which breeds handle adventures best?";
    } else if (/movie|film|netflix|series|série|cinema|cinéma/.test(t)) {
      reply =
        locale === "fr"
          ? "Bon film! Ça me rappelle Lassie ou Hachi… Tu veux des races “stars”, ou une vraie fiche race?"
          : "Movie night vibes! Makes me think of Lassie or Hachi… Want famous film-dog breeds, or a real breed deep-dive?";
    } else if (/sport|gym|run|foot|soccer|basket|workout|sportif/.test(t)) {
      reply =
        locale === "fr"
          ? "Cette énergie mériterait un partenaire d’agility! Border Collie, ou plutôt sieste après deux balles?"
          : "That energy deserves an agility buddy! Border Collie athlete, or a nap-after-two-balls companion?";
    } else {
      reply =
        locale === "fr"
          ? "Hmm, ça ouvre plein d’images — quel chien collerait à cette vibe: sportif, câlin d’appart, ou cœur de maison?"
          : "Hmm, that paints a picture — which dog matches that vibe: curious athlete, apartment cuddler, or heart-of-the-home?";
    }
    return {
      reply,
      suggestions:
        locale === "fr"
          ? ["Races populaires", "Choisir une race", "Éducation chiot"]
          : ["Popular breeds", "Choosing a breed", "Puppy training"],
    };
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

function defaultSuggestions(locale) {
  return locale === "fr"
    ? ["En savoir plus", "Autre race", "Éducation"]
    : ["Tell me more", "Another breed", "Training tips"];
}

async function chatViaOllama(cleaned, locale, env) {
  const base = (env.OLLAMA_BASE_URL || "").trim().replace(/\/+$/, "");
  if (!base) return null;

  const model = (env.OLLAMA_CHAT_MODEL || "llama3.1:8b").trim();
  const system = `${dogExpertSystemPrompt(locale)}\n\n${suggestionSystemExtra(locale)}`;
  const upstream = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.55,
      max_tokens: 1100,
      messages: [{ role: "system", content: system }, ...cleaned],
    }),
  });
  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    throw new Error(`ollama_${upstream.status}:${detail.slice(0, 120)}`);
  }
  const data = await upstream.json();
  const raw = data.choices?.[0]?.message?.content?.trim() || "";
  if (!raw) throw new Error("ollama_empty");
  const parsed = parseReplyAndSuggestions(raw);
  return {
    reply: parsed.reply,
    suggestions: parsed.suggestions.length ? parsed.suggestions : defaultSuggestions(locale),
    source: `ollama:${model}`,
  };
}

async function chatViaWorkersAI(cleaned, locale, env) {
  if (!env.AI) throw new Error("workers_ai_missing");

  const system = `${dogExpertSystemPrompt(locale)}\n\n${suggestionSystemExtra(locale)}`;
  const result = await env.AI.run(WORKERS_AI_MODEL, {
    messages: [{ role: "system", content: system }, ...cleaned],
    max_tokens: 1100,
    temperature: 0.55,
  });

  const raw =
    (typeof result === "string" ? result : result?.response || result?.result?.response || "")
      .toString()
      .trim();
  if (!raw) throw new Error("workers_ai_empty");

  const parsed = parseReplyAndSuggestions(raw);
  return {
    reply: parsed.reply,
    suggestions: parsed.suggestions.length ? parsed.suggestions : defaultSuggestions(locale),
    source: `workers-ai:${WORKERS_AI_MODEL}`,
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

  try {
    const ollama = await chatViaOllama(cleaned, locale, env);
    if (ollama) return json(req, ollama);

    const ai = await chatViaWorkersAI(cleaned, locale, env);
    return json(req, ai);
  } catch (err) {
    const offline = offlineDogReply(lastUser, locale);
    return json(req, {
      ...offline,
      source: "offline_fallback",
      detail: err instanceof Error ? err.message.slice(0, 200) : "chat_failed",
    });
  }
}

async function handleTts(req) {
  return json(
    req,
    {
      error: "tts_browser_only",
      hint: "Voice uses the free browser speech engine — no API key needed.",
    },
    501
  );
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(req) });
    }

    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (req.method === "GET" && (path === "/" || path === "/health")) {
      return json(req, {
        ok: true,
        service: "dooogs-api",
        chat: env.OLLAMA_BASE_URL ? "ollama" : "workers-ai",
        model: env.OLLAMA_BASE_URL
          ? env.OLLAMA_CHAT_MODEL || "llama3.1:8b"
          : WORKERS_AI_MODEL,
      });
    }

    if (req.method === "POST" && (path === "/api/chat" || path === "/chat")) {
      return handleChat(req, env);
    }
    if (req.method === "POST" && (path === "/api/tts" || path === "/tts")) {
      return handleTts(req);
    }

    return json(req, { error: "not_found", path }, 404);
  },
};
