type Msg = { role: "user" | "assistant"; content: string };

type OfflineResult = {
  reply: string;
  suggestions: string[];
};

const BREEDS: Record<
  string,
  { en: string; fr: string; keys: string[] }
> = {
  poodle: {
    keys: ["poodle", "caniche"],
    en: `Poodles (Standard, Miniature, Toy) are brilliant, athletic water dogs with curly low-shed coats that need regular grooming.<br><br>History traces to German water retrieving (Pudel ≈ “to splash”), later beloved in France. They’re common across Europe and North America.<br><br>Personality: eager, trainable, people-oriented. They thrive with daily exercise and brain games. Avoid fatty table scraps; never chocolate, grapes, xylitol, or onions.<br><br>See more at AKC Poodle pages, Poodle Club of America events, and local specialty shows.`,
    fr: `Les caniches (Standard, Nain, Toy) sont des chiens d’eau brillants et sportifs, au poil bouclé peu sujet à la mue, qui demandent un toilettage régulier.<br><br>Histoire liée au rapport à l’eau en Allemagne (Pudel), puis très aimés en France. Courants en Europe et en Amérique du Nord.<br><br>Caractère: vif, éducable, proche des humains. Besoin d’exercice et de jeux mentaux. Évite les restes gras; jamais chocolat, raisin, xylitol ou oignon.<br><br>Pour en voir plus: fiches AKC, clubs de race, expositions spécialisées.`,
  },
  labrador: {
    keys: ["labrador", "lab "],
    en: `Labrador Retrievers are friendly, food-motivated gundogs with a water-loving double coat and an otter tail.<br><br>They descend from Newfoundland’s St. John’s water dogs, refined in Britain for retrieving. They’re among the world’s most common family and service dogs.<br><br>Expect high energy, soft mouths, and a need for training plus daily walks. Watch weight — Labs love food. Never chocolate, grapes, xylitol, or cooked bones.<br><br>See them at hunt tests, field trials, dock diving, and Labrador club events.`,
    fr: `Le Labrador est un chien de rapport amical, motivé par la nourriture, avec un poil double aimant l’eau et une queue en loutre.<br><br>Il descend des chiens d’eau de St. John’s (Terre-Neuve), affiné en Grande-Bretagne. Parmi les chiens de famille et d’assistance les plus répandus.<br><br>Beaucoup d’énergie, gueule douce, besoin d’éducation et de marches. Attention au poids. Jamais chocolat, raisin, xylitol ou os cuits.<br><br>À voir: field trials, dock diving, clubs Labrador.`,
  },
  shepherd: {
    keys: ["german shepherd", "berger allemand", "gsd"],
    en: `German Shepherds are loyal, versatile working dogs — herding roots with huge roles in police, sport, and service work.<br><br>Standardized in Germany by Max von Stephanitz around 1899; now common worldwide.<br><br>They need structure, training, and serious mental + physical exercise. Socialize early. Diet should match activity; avoid toxic human foods (chocolate, xylitol, grapes).<br><br>See GSD club trials, IPO/IGP sport, herding demos, and AKC specialty shows.`,
    fr: `Le berger allemand est un chien de travail loyal et polyvalent — racines de troupeau, rôles en police, sport et assistance.<br><br>Standardisé en Allemagne par Max von Stephanitz vers 1899; répandu dans le monde.<br><br>Il lui faut structure, éducation, exercice physique et mental. Socialise tôt. Alimentation adaptée à l’activité; évite chocolat, xylitol, raisin.<br><br>À voir: clubs GSD, sport IPO/IGP, démos de troupeau, expos.`,
  },
  golden: {
    keys: ["golden retriever", "golden"],
    en: `Golden Retrievers are warm, eager gundogs with soft mouths and people-loving hearts.<br><br>Bred in 19th-century Scotland for waterfowl retrieving; popular across the UK, North America, and beyond.<br><br>They need grooming, exercise, and jobs (therapy, field, sports). Watch ears and weight. Never chocolate, grapes, xylitol, or onions.<br><br>Find them at hunt tests, obedience, therapy demos, and Golden Retriever club events.`,
    fr: `Le Golden Retriever est un chien de rapport chaleureux, gueule douce, très proche des humains.<br><br>Développé en Écosse au XIXe pour la sauvagine; populaire au Royaume-Uni, en Amérique du Nord et ailleurs.<br><br>Toilettage, exercice et « job » (thérapie, field, sports). Attention oreilles et poids. Jamais chocolat, raisin, xylitol, oignon.<br><br>Hunt tests, obéissance, clubs Golden.`,
  },
  frenchie: {
    keys: ["french bulldog", "frenchie", "bouledogue français", "bouledogue francais"],
    en: `French Bulldogs are compact companion dogs with bat ears and big personalities — apartment-friendly, not marathon runners.<br><br>Toy bulldogs from England became Paris café companions in the 1800s; now globally popular.<br><br>Mind heat and breathing (brachycephalic). Keep walks moderate; use harnesses. Avoid obesity and toxic foods.<br><br>See companion shows and French Bulldog club gatherings; choose health-tested breeders.`,
    fr: `Le bouledogue français est un compagnon compact aux oreilles de chauve-souris — idéal en appart, pas fait pour le marathon.<br><br>Des toy bulldogs anglais sont devenus mascottes des cafés parisiens au XIXe; très populaires aujourd’hui.<br><br>Attention chaleur et respiration. Marches modérées, harnais. Évite surpoids et aliments toxiques.<br><br>Expos compagnons et clubs; choisis des éleveurs qui testent la santé.`,
  },
  beagle: {
    keys: ["beagle"],
    en: `Beagles are merry scent hounds — nose-driven, curious, and vocal with that classic bay.<br><br>British hare-hunting roots; common as pets and detection dogs worldwide.<br><br>They need sniff walks and secure fencing. Food-motivated and prone to weight gain. No chocolate, grapes, or xylitol.<br><br>See hound shows, pack events, scent work, and National Beagle Club resources.`,
    fr: `Le Beagle est un chien courant joyeux — mené par le nez, curieux, avec sa voix typique.<br><br>Racines de chasse au lièvre en Grande-Bretagne; compagnon et chien de détection dans le monde.<br><br>Balades « snif », jardin sécurisé. Motivé par la nourriture, attention au poids. Pas de chocolat, raisin, xylitol.<br><br>Expos Hound, meutes, clubs Beagle.`,
  },
  collie: {
    keys: ["border collie", "border"],
    en: `Border Collies are elite herding athletes — intense focus, stare, and drive.<br><br>Bred on the England–Scotland border for sheep; famous in trials and dog sports worldwide.<br><br>They need a real job (herding, agility, advanced training). Under-exercised Collies invent chaos. Balanced diet for high activity; avoid toxic human foods.<br><br>Watch sheepdog trials, herding clinics, and Border Collie club events.`,
    fr: `Le Border Collie est un athlète de troupeau — focus intense, regard, drive.<br><br>Élevé à la frontière anglo-écossaise; célèbre en concours et sports canins.<br><br>Il lui faut un vrai job (troupeau, agility, éducation avancée). Sans ça: chaos créatif. Alimentation d’athlète; évite aliments toxiques.<br><br>Sheepdog trials, stages de conduite, clubs Border Collie.`,
  },
  dachshund: {
    keys: ["dachshund", "teckel", "wiener", "doxie"],
    en: `Dachshunds are bold badger dogs in a long, low frame — curious and courageous.<br><br>German earth-dog history (“Dachs” + “Hund”); popular companions worldwide in smooth, long, and wire coats.<br><br>Protect the back (ramps, no big jumps). Short walks plus sniff games. Watch weight. Never toxic foods like chocolate or xylitol.<br><br>See earthdog tests, dachshund specialties, and club meetups.`,
    fr: `Le teckel est un chasseur de blaireau audacieux, long et bas — curieux et courageux.<br><br>Histoire allemande de chien de terrier; compagnon mondial (poil ras, long, dur).<br><br>Protège le dos (rampes, pas de grands sauts). Petites marches + jeux de nez. Attention poids. Jamais chocolat ou xylitol.<br><br>Tests earthdog, spécialités teckel, clubs.`,
  },
};

function detectBreed(text: string): keyof typeof BREEDS | null {
  const t = text.toLowerCase();
  for (const [id, meta] of Object.entries(BREEDS)) {
    if (meta.keys.some((k) => t.includes(k))) return id as keyof typeof BREEDS;
  }
  return null;
}

function isOffTopic(text: string): boolean {
  const t = text.toLowerCase();
  const doggy =
    /dog|chien|breed|race|puppy|chiot|canine|labrador|poodle|caniche|shepherd|berger|beagle|collie|teckel|dachshund|golden|frenchie|bouledogue|akc|fci|groom|toilet|train|éduc|walk|promenade|bark|aboie|leash|laisse|vet|véto|kibble|croquette|toxic|chocolat|xylitol/.test(
      t
    );
  return !doggy;
}

export function offlineDogReply(
  userText: string,
  locale: "en" | "fr",
  _history: Msg[]
): OfflineResult {
  const breed = detectBreed(userText);
  if (breed) {
    const entry = BREEDS[breed];
    return {
      reply: locale === "fr" ? entry.fr : entry.en,
      suggestions:
        locale === "fr"
          ? ["Éducation", "Alimentation", "Autre race"]
          : ["Training tips", "Diet & foods", "Another breed"],
    };
  }

  if (
    /cook|recipe|dinner|tonight|cuisine|dîner|recette|souper/i.test(userText)
  ) {
    return {
      reply:
        locale === "fr"
          ? `Bonne question cuisine! Pour ce soir, vise quelque chose de simple — grillades, pâtes, ou un wok de légumes.<br><br>Et côté chiens: garde chocolat, xylitol (édulcorant), raisin, oignon, ail et avocat loin de la gamelle. Les restes gras peuvent aussi déranger leur estomac.<br><br>Tu veux que je te parle d’alimentation adaptée à une race en particulier?`
          : `Great cooking question! Tonight, keep it simple — a sheet-pan dinner, pasta, or a quick stir-fry works on busy evenings.<br><br>Dog tie-in: keep chocolate, xylitol (sweetener), grapes, onions, garlic, and avocado away from pups. Fatty leftovers can upset stomachs too.<br><br>Want breed-specific feeding tips next?`,
      suggestions:
        locale === "fr"
          ? ["Aliments toxiques", "Races et croquettes", "Caniche"]
          : ["Toxic foods list", "Breed diet tips", "Poodles"],
    };
  }

  if (isOffTopic(userText)) {
    return {
      reply:
        locale === "fr"
          ? `Je peux en parler un instant — et avec plaisir. Mon vrai terrain de jeu, ce sont les chiens: races, histoires, caractère, éducation, soins.<br><br>Dis-moi ce qui t’intéresse le plus (une race, un comportement, l’alimentation…) et on creuse ensemble.`
          : `Happy to chat about that for a moment. My deepest expertise is dogs — breeds worldwide, history, personality, training, and care.<br><br>Tell me what you’d love to explore (a breed, a behavior, feeding…) and we’ll dig in.`,
      suggestions:
        locale === "fr"
          ? ["Races populaires", "Choisir une race", "Éducation chiot"]
          : ["Popular breeds", "Choosing a breed", "Puppy training"],
    };
  }

  return {
    reply:
      locale === "fr"
        ? `Je suis Ginny, guide races & chiens du monde entier: origines, caractère, mode de vie, alimentation, éducation, toilettage, et où en voir davantage.<br><br>Pose-moi une race (ex. caniche, labrador) ou une question précise — je reste dans le fil de notre conversation.`
        : `I’m Ginny, your guide to dogs and breeds worldwide — origins, personality, lifestyle, diet, training, grooming, and where to see more.<br><br>Ask about any breed (poodle, labrador…) or a specific question — I’ll keep our conversation in context.`,
    suggestions:
      locale === "fr"
        ? ["Caniche", "Labrador", "Comment choisir"]
        : ["Poodles", "Labradors", "How to choose"],
  };
}
