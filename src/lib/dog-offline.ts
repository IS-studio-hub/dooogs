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
  husky: {
    keys: ["husky", "siberian"],
    en: `Siberian Huskies are endurance sled dogs — athletic, independent, and famously vocal.<br><br>Bred by the Chukchi people of Siberia; now popular worldwide as active companions.<br><br>They need serious exercise, secure fencing, and mental work. Thick coats dislike extreme heat. Never toxic human foods.<br><br>See sled demos, husky club events, and Nordic breed shows.`,
    fr: `Le Husky sibérien est un chien de traîneau d’endurance — athlétique, indépendant, très expressif.<br><br>Sélectionné par les Tchouktches en Sibérie; compagnon actif dans le monde.<br><br>Beaucoup d’exercice, clôture solide, stimulation mentale. Attention à la chaleur. Jamais d’aliments toxiques.<br><br>Démos de traîneau, clubs husky, expos nordiques.`,
  },
  shiba: {
    keys: ["shiba", "shiba inu"],
    en: `Shiba Inu are compact Japanese spitz dogs — bold, clean, and often cat-like independent.<br><br>Ancient Japan hunting roots; now a global companion icon.<br><br>Early socialization and leash manners matter. They shed (“blowing coat”). Watch escape artists. Avoid toxic foods.<br><br>See Japanese breed clubs, companion shows, and Shiba specialty events.`,
    fr: `Le Shiba Inu est un spitz japonais compact — audacieux, propre, parfois indépendant comme un chat.<br><br>Racines de chasse au Japon; compagnon mondial.<br><br>Socialisation et laisse tôt. Mue saisonnière. Attention aux fugues. Évite aliments toxiques.<br><br>Clubs japonais, expos compagnons, spécialités Shiba.`,
  },
  bulldog: {
    keys: ["english bulldog", "bulldog"],
    en: `English Bulldogs are sturdy companion dogs with a distinctive pushed-in face and easygoing vibe indoors.<br><br>British history from bull-baiting to gentle family icons.<br><br>Mind heat, breathing, and weight. Short walks; avoid overexertion. Choose health-focused breeders. No toxic table foods.<br><br>See bulldog clubs and companion specialty shows.`,
    fr: `Le Bulldog anglais est un compagnon solide au museau court, calme à la maison.<br><br>Histoire britannique, d’abord combat puis famille.<br><br>Attention chaleur, respiration et poids. Petites marches. Éleveurs sérieux sur la santé. Pas d’aliments toxiques.<br><br>Clubs bulldog et expos compagnons.`,
  },
  yorkie: {
    keys: ["yorkshire", "yorkie"],
    en: `Yorkshire Terriers are tiny, confident toy terriers with a silky coat and big-dog attitude.<br><br>19th-century England (textile mills); now worldwide lap and show companions.<br><br>Dental care, gentle handling, and coat upkeep matter. Watch stairs and bigger dogs. Never chocolate or xylitol.<br><br>See toy group shows and Yorkie club events.`,
    fr: `Le Yorkshire est un toy terrier confiant, poil soyeux, caractère bien trempé.<br><br>Angleterre du XIXe (usines textiles); compagnon mondial.<br><br>Soins dentaires, manipulation douce, toilettage. Attention escaliers. Jamais chocolat ou xylitol.<br><br>Expos toy et clubs Yorkie.`,
  },
  boxer: {
    keys: ["boxer"],
    en: `Boxers are bouncy working dogs — playful, loyal, and expressive with that square muzzle.<br><br>German roots (Bullensbeisser crosses); popular family and service dogs worldwide.<br><br>They need training and daily exercise. Short coats feel cold; watch heat too. No toxic human foods.<br><br>See obedience, agility, and Boxer club specialties.`,
    fr: `Le Boxer est un chien de travail joueur et loyal, museau carré très expressif.<br><br>Racines allemandes; famille et service dans le monde.<br><br>Éducation et exercice quotidiens. Poil court: froid et chaleur. Pas d’aliments toxiques.<br><br>Obéissance, agility, clubs Boxer.`,
  },
  rottweiler: {
    keys: ["rottweiler", "rott"],
    en: `Rottweilers are powerful, confident working dogs — historically drovers and guardians.<br><br>From Rottweil, Germany; now worldwide for family, sport, and protection work with proper training.<br><br>Need early socialization, clear leadership, and exercise. Responsible ownership matters. Avoid toxic foods.<br><br>See working trials, IGP sport, and Rottweiler club events.`,
    fr: `Le Rottweiler est un chien de travail puissant et sûr de lui — bouvier et gardien.<br><br>De Rottweil (Allemagne); famille, sport et protection avec une bonne éducation.<br><br>Socialisation précoce, cadre clair, exercice. Responsabilité de l’humain. Évite aliments toxiques.<br><br>Trials, sport IGP, clubs Rottweiler.`,
  },
  australian: {
    keys: ["australian shepherd", "aussie"],
    en: `Australian Shepherds are energetic herding dogs — bright, agile, and often patterned with merle coats.<br><br>Despite the name, developed in the US for ranch work; popular in dog sports worldwide.<br><br>They need a job (agility, herding, advanced training). Underworked Aussies invent trouble. No toxic foods.<br><br>See herding trials, agility, and Aussie club events.`,
    fr: `L’Australian Shepherd est un chien de troupeau énergique — vif, agile, souvent merle.<br><br>Malgré le nom, développé aux USA pour les ranchs; star des sports canins.<br><br>Il lui faut un job (agility, troupeau, éducation). Sans ça: bêtises. Pas d’aliments toxiques.<br><br>Trials, agility, clubs Aussie.`,
  },
  corgi: {
    keys: ["corgi", "pembroke", "cardigan"],
    en: `Corgis (Pembroke & Cardigan) are short-legged herding dogs — bold, bright, and big on personality.<br><br>Welsh cattle dogs; Pembroke famously linked to British royalty; popular worldwide.<br><br>Watch weight (long backs). Mental work plus walks. Never toxic foods like chocolate or xylitol.<br><br>See herding events, companion shows, and corgi club meetups.`,
    fr: `Le Corgi (Pembroke & Cardigan) est un chien de troupeau bas sur pattes — audacieux et malin.<br><br>Bouvier gallois; le Pembroke lié à la royauté britannique; populaire partout.<br><br>Attention au poids (dos long). Marches + stimulation. Jamais chocolat ou xylitol.<br><br>Troupeau, expos, clubs corgi.`,
  },
  maltese: {
    keys: ["maltese"],
    en: `Maltese are tiny companion dogs with flowing white coats and affectionate temperaments.<br><br>Ancient Mediterranean lapdog history; beloved show and companion dogs worldwide.<br><br>Daily coat care, dental health, and gentle exercise. Avoid rough play with big dogs. No toxic foods.<br><br>See toy shows and Maltese club specialties.`,
    fr: `Le Bichon maltais est un tout petit compagnon au long poil blanc, très affectueux.<br><br>Histoire méditerranéenne ancienne; expos et compagnonnage mondiaux.<br><br>Toilettage, dents, exercice doux. Évite jeux brutaux. Pas d’aliments toxiques.<br><br>Expos toy et clubs maltais.`,
  },
  akita: {
    keys: ["akita"],
    en: `Akitas are large Japanese spitz dogs — dignified, loyal, and powerful.<br><br>From northern Japan; symbols of loyalty (Hachikō). Two related types: Japanese Akita and American Akita lines.<br><br>Need experienced handling, socialization, and space. Thick coat; seasonal shed. Avoid toxic foods.<br><br>See Akita clubs, companion specialties, and cultural breed events.`,
    fr: `L’Akita est un grand spitz japonais — digne, loyal, puissant.<br><br>Nord du Japon; symbole de loyauté (Hachikō). Lignes japonaise et américaine.<br><br>Main experte, socialisation, espace. Poil dense, mue. Évite aliments toxiques.<br><br>Clubs Akita et expos.`,
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
    /dog|chien|breed|race|puppy|chiot|canine|labrador|poodle|caniche|shepherd|berger|beagle|collie|teckel|dachshund|golden|frenchie|bouledogue|husky|shiba|bulldog|yorkie|yorkshire|boxer|rott|aussie|australian|corgi|maltese|akita|akc|fci|groom|toilet|train|éduc|walk|promenade|bark|aboie|leash|laisse|vet|véto|kibble|croquette|toxic|chocolat|xylitol/.test(
      t
    );
  return !doggy;
}

export function offlineDogReply(
  userText: string,
  locale: "en" | "fr",
  history?: Msg[]
): OfflineResult {
  void history;
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

  if (/toxic|chocolat|xylitol|grape|raisin|onion|oignon|poison|danger.*food|aliment.*tox/i.test(userText)) {
    return {
      reply:
        locale === "fr"
          ? `Aliments à ne jamais donner: chocolat, xylitol (chewing-gum / certains beurres de cacahuète), raisin et raisins secs, oignon, ail, avocat, alcool, café/thé, et os cuits qui se splinter.<br><br>En cas d’ingestion, contacte un véto ou un centre antipoison animal rapidement — ne fais pas vomir sans avis.<br><br>Tu veux des idées de friandises sûres ou des conseils pour une race?`
          : `Never feed: chocolate, xylitol (gum / some peanut butters), grapes and raisins, onions, garlic, avocado, alcohol, caffeine, and cooked bones that splinter.<br><br>If your dog eats something risky, call a vet or pet poison hotline fast — don’t induce vomiting unless told to.<br><br>Want safe treat ideas or breed feeding tips next?`,
      suggestions:
        locale === "fr"
          ? ["Friandises sûres", "Choisir une race", "Éducation"]
          : ["Safe treats", "Choosing a breed", "Training tips"],
    };
  }

  if (/train|éduc|puppy|chiot|leash|laisse|bark|aboie|obedi/i.test(userText)) {
    return {
      reply:
        locale === "fr"
          ? `Éducation: courtes sessions positives (récompense), laisse douce, socialisation variée, et une routine claire. Les chiots ont besoin de pauses — fatigue ≠ désobéissance.<br><br>Pour les aboiements: cherche la cause (ennui, alerte, demande) avant de corriger.<br><br>Dis-moi l’âge et la race (ou le problème précis) et on affine.`
          : `Training basics: short positive sessions, soft leash manners, varied socialization, and a clear routine. Puppies need naps — tired isn’t “stubborn.”<br><br>For barking: find the why (boredom, alarm, asking) before correcting.<br><br>Tell me age + breed (or the exact snag) and we’ll tailor it.`,
      suggestions:
        locale === "fr"
          ? ["Socialisation", "Propreté", "Caniche"]
          : ["Socialization", "House training", "Poodles"],
    };
  }

  if (/choose|choisir|which breed|quelle race|best dog|bon chien|apart|appartement|family|famille/i.test(userText)) {
    return {
      reply:
        locale === "fr"
          ? `Pour choisir: énergie (sportif vs calme), poil/toilettage, taille, expérience, enfants, et temps dispo. Appart → souvent compagnons moins “endurance”; maison + jardin → plus d’options actives.<br><br>Évite d’acheter sur un coup de cœur Instagram — parle à des clubs de race et des éleveurs qui testent la santé.<br><br>Décris ton quotidien (ville/campagne, heures hors maison, enfants) et je te propose 3 pistes.`
          : `To choose well: energy level, coat/grooming, size, your experience, kids, and time. Apartments often suit lower-endurance companions; house + yard opens more athletic options.<br><br>Skip impulse Instagram buys — talk to breed clubs and health-testing breeders.<br><br>Describe your day (city/country, hours away, kids) and I’ll suggest 3 fits.`,
      suggestions:
        locale === "fr"
          ? ["Appartement", "Famille avec enfants", "Premier chien"]
          : ["Apartment life", "Family with kids", "First dog"],
    };
  }

  if (isOffTopic(userText)) {
    const t = userText.toLowerCase();
    let reply: string;
    if (/cook|recipe|food|dinner|cuisine|dîner|recette|pizza|coffee|café/i.test(t)) {
      reply =
        locale === "fr"
          ? `Ça sent bon d’ici! Pendant que tu mijotes, petite pensée canidé: chocolat, xylitol, raisin et oignon restent hors gamelle — même une bouchée “sympa” peut mal finir.<br><br>Tu veux une liste de friandises sûres, ou on parle d’une race gourmande type Labrador?`
          : `That smells amazing from here! While you’re in the kitchen, a quick paw-note: chocolate, xylitol, grapes, and onions stay out of the bowl — even a “tiny taste” can go wrong.<br><br>Want a safe-treat list, or shall we geek out on a food-motivated breed like the Labrador?`;
    } else if (/travel|flight|avion|trip|voyage|hotel|vacance/i.test(t)) {
      reply =
        locale === "fr"
          ? `Les valises, ça donne des papillons — et aux chiens aussi. Certaines races voyagent zen en voiture; d’autres stressent en cabine.<br><br>Tu pars avec un compagnon à quatre pattes, ou tu veux des races plutôt “globetrotteuses”?`
          : `Suitcases give butterflies — dogs get them too. Some breeds are road-trip zen; others melt down in a cabin.<br><br>Traveling with a pup, or curious which breeds handle adventures best?`;
    } else if (/movie|film|netflix|series|série|cinema|cinéma/i.test(t)) {
      reply =
        locale === "fr"
          ? `Bon film en vue! Ça me rappelle Lassie, Hachi, ou le Border Collie trop intelligent des pubs…<br><br>Tu préfères les races “stars de cinéma”, ou une vraie fiche race pour ce soir?`
          : `Movie night vibes! Makes me think of Lassie, Hachi, or those too-smart Border Collies in commercials…<br><br>Want famous film-dog breeds, or a real breed deep-dive for tonight?`;
    } else if (/sport|gym|run|foot|soccer|basket|workout|sportif/i.test(t)) {
      reply =
        locale === "fr"
          ? `Cette énergie mériterait un partenaire de canicross ou d’agility! Les Border Collies et les Malinois vivent pour ça — d’autres préfèrent la sieste après deux jets de balle.<br><br>Tu cherches une race sportive, ou des idées d’exercices pour ton chien?`
          : `That energy deserves a canicross or agility buddy! Border Collies and Malinois live for it — others are done after two tennis balls.<br><br>Looking for a sporty breed, or workout ideas for a dog you already love?`;
    } else if (/weather|rain|snow|hot|cold|météo|pluie|neige|chaud|froid/i.test(t)) {
      reply =
        locale === "fr"
          ? `Selon le ciel, certaines races rayonnent — Huskies dans le froid, lévriers qui fondent dès qu’il fait trop chaud.<br><br>Tu adaptes les promenades à la météo, ou tu veux des races faites pour ton climat?`
          : `Weather picks favorites — Huskies glow in the cold; sighthounds wilt when it spikes hot.<br><br>Tweaking walks for the forecast, or hunting breeds built for your climate?`;
    } else if (/work|job|office|bureau|meeting|réunion|career|travail/i.test(t)) {
      reply =
        locale === "fr"
          ? `Journée chargée… les chiens d’assistance et de détection bossent aussi, avec un focus impressionnant.<br><br>Tu veux des races “bureau-friendly”, ou des histoires de chiens au travail?`
          : `Busy day… service and detection dogs clock in too, with wild focus.<br><br>Curious about office-friendly breeds, or dogs with real jobs?`;
    } else {
      reply =
        locale === "fr"
          ? `Hmm, ça ouvre plein d’images — et ça me fait penser à quel chien collerait à cette vibe.<br><br>Si c’était une race: plutôt curieuse et sportive, câline d’appart, ou garde du cœur à la maison? Dis-moi et on creuse.`
          : `Hmm, that paints a picture — and it makes me wonder which dog would match that vibe.<br><br>If it were a breed: curious athlete, apartment cuddler, or loyal heart-of-the-home? Tell me and we’ll dig in.`;
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
        ? `Je suis Dooogs!, guide races & chiens du monde entier: origines, caractère, mode de vie, alimentation, éducation, toilettage, et où en voir davantage.<br><br>Pose-moi une race (ex. caniche, labrador) ou une question précise — je reste dans le fil de notre conversation.`
        : `I’m Dooogs!, your guide to dogs and breeds worldwide — origins, personality, lifestyle, diet, training, grooming, and where to see more.<br><br>Ask about any breed (poodle, labrador…) or a specific question — I’ll keep our conversation in context.`,
    suggestions:
      locale === "fr"
        ? ["Caniche", "Labrador", "Comment choisir"]
        : ["Poodles", "Labradors", "How to choose"],
  };
}
