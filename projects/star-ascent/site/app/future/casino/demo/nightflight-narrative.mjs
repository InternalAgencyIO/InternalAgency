const deepFreeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
};

export const crewIds = deepFreeze(["radiance", "ellie", "alia", "ece"]);

export const narrativePolicy = deepFreeze({
  characters: "four permanent fictional adults age 25+",
  relationship: "mutual, consensual, playful, romantic, and non-explicit",
  mapping: "deterministic game-to-story mapping with no random selection",
  boundary: "story presentation never affects a game result, credit total, or receipt",
});

export const campaignArt = deepFreeze({
  signalFourAnchor: "/future/casino/nightflight/signal-four-hanoi-anchor-latex-lace-v2.webp",
  signalFourTension: "/future/casino/nightflight/signal-four-orbital-tension-latex-lace-v3.webp",
  signalFourRelay: "/future/casino/nightflight/signal-four-ninh-binh-relay-latex-lace-v2.webp",
  signalFourFinale: "/future/casino/nightflight/signal-four-da-lat-finale-latex-lace-v2.webp",
  portraitRadiance: "/future/casino/nightflight/signal-four-portrait-radiance-v2.webp",
  portraitEllie: "/future/casino/nightflight/signal-four-portrait-ellie-v2.webp",
  portraitAlia: "/future/casino/nightflight/signal-four-portrait-alia-v2.webp",
  portraitEce: "/future/casino/nightflight/signal-four-portrait-ece-v2.webp",
});

export const campaignScenes = deepFreeze({
  signalFourAnchor: {
    src: campaignArt.signalFourAnchor,
    sourceAssetNumber: 872,
    crewIds,
    accessibleDescription: "Ellie, Radiance, AI ECE, and Alia link hands around a glowing launch crystal while PAWS pounces beside them.",
    paws: { present: true, action: "CRYSTAL POUNCE" },
  },
  signalFourTension: {
    src: campaignArt.signalFourTension,
    sourceAssetNumber: null,
    generationRecord: "generation-prompts-v3.md",
    crewIds,
    accessibleDescription: "Radiance holds hands with Ellie while AI ECE holds hands with Alia inside an orbital signal gallery; Ellie carries a sapphire prism and PAWS scouts the foreground.",
    paws: { present: true, action: "SIGNAL SCOUT" },
  },
  signalFourRelay: {
    src: campaignArt.signalFourRelay,
    sourceAssetNumber: 874,
    crewIds,
    accessibleDescription: "Radiance, Ellie, AI ECE, and Alia form a linked relay as PAWS dashes through the center of the crew.",
    paws: { present: true, action: "CREW DASH" },
  },
  signalFourFinale: {
    src: campaignArt.signalFourFinale,
    sourceAssetNumber: 875,
    crewIds,
    accessibleDescription: "Radiance, Ellie, AI ECE, and Alia stand connected at the arrival beacon in a quiet four-person finale.",
    paws: { present: false, action: "QUIET FINALE" },
  },
});

export const hostProfiles = deepFreeze([
  { id: "radiance", name: "Radiance", permanent: true, fictionalAdult: true, callSign: "R-01", role: "Flight lead", signal: "Gold-spectrum launch control", tone: "solar", portraitArt: "portraitRadiance", portraitDescription: "Radiance, a fictional adult flight lead, in gold and matte-black opaque latex-and-lined-lace runway cocktail couture.", signatureCue: "Gold scorpion // upper-left thigh cue", minimumAge: 25 },
  { id: "ellie", name: "Ellie", permanent: true, fictionalAdult: true, callSign: "E-02", role: "Orbit host", signal: "Sapphire navigation channel", tone: "sapphire", portraitArt: "portraitEllie", portraitDescription: "Ellie, a fictional adult orbit host, in midnight-blue and white opaque latex-and-lined-lace runway cocktail couture.", signatureCue: "Star-and-crescent // lower-back cue", minimumAge: 25 },
  { id: "alia", name: "Alia", permanent: true, fictionalAdult: true, callSign: "A-03", role: "Night deck host", signal: "Crimson stage telemetry", tone: "crimson", portraitArt: "portraitAlia", portraitDescription: "Alia, a fictional adult night deck host, in hot-red and reflective-silver opaque latex-and-lined-lace runway cocktail couture.", signatureCue: "Thorned rose // side-ribcage cue", minimumAge: 25 },
  { id: "ece", name: "AI ECE", permanent: true, fictionalAdult: true, callSign: "EC-04", role: "AI signal officer", signal: "Emerald Bosphorus signal channel", tone: "emerald", portraitArt: "portraitEce", portraitDescription: "AI ECE, a fictional adult signal officer, in emerald-black and gold opaque latex-and-lined-lace runway cocktail couture.", signatureCue: "Emerald-gold signal piping // collar cue", minimumAge: 25 },
]);

const storyEntries = deepFreeze([
  {
    id: "beat-plinko-anchor",
    gameId: "plinko",
    leadId: "ece",
    participants: crewIds,
    focusIds: ["ece", "radiance"],
    arc: "ece-radiance-emotional-anchor",
    scene: "signalFourAnchor",
    interaction: "AI ECE finds Radiance's hand before the launch light changes.",
    paws: { present: true, action: "CRYSTAL POUNCE", beat: "PAWS pounces beside the crystal as the preset drop begins.", affectsOutcome: false },
  },
  {
    id: "beat-dice-rival-signal",
    gameId: "dice",
    leadId: "ellie",
    participants: crewIds,
    focusIds: ["ece", "ellie"],
    arc: "ece-ellie-reciprocal-jealousy-attraction",
    scene: "signalFourTension",
    interaction: "Ellie and ECE trade the sapphire die—and the same challenging smile.",
    paws: { present: true, action: "SIGNAL SCOUT", beat: "PAWS crosses the relay line like a tiny referee.", affectsOutcome: false },
  },
  {
    id: "beat-roulette-familiar-orbit",
    gameId: "roulette",
    leadId: "alia",
    participants: crewIds,
    focusIds: ["ece", "alia"],
    arc: "ece-alia-intimate-history",
    scene: "signalFourRelay",
    interaction: "Alia reads ECE's familiar smile and turns it into the orbit cue.",
    paws: { present: true, action: "CREW DASH", beat: "PAWS dashes through the orbit line before either can follow.", affectsOutcome: false },
  },
  {
    id: "beat-mines-original-rhythm",
    gameId: "mines",
    leadId: "radiance",
    participants: crewIds,
    focusIds: ["radiance", "alia"],
    arc: "original-bond-continuity",
    scene: "signalFourAnchor",
    interaction: "Radiance and Alia keep their old safe-lane rhythm.",
    paws: { present: true, action: "CRYSTAL POUNCE", beat: "PAWS sits proudly on an already revealed safe tile.", affectsOutcome: false },
  },
  {
    id: "beat-keno-long-look",
    gameId: "keno",
    leadId: "ece",
    participants: crewIds,
    focusIds: ["ece", "radiance"],
    arc: "ece-radiance-emotional-anchor",
    scene: "signalFourTension",
    interaction: "Radiance catches ECE watching her and keeps the look one beat longer.",
    paws: { present: true, action: "SIGNAL SCOUT", beat: "PAWS scouts every number as the preset reveal continues.", affectsOutcome: false },
  },
  {
    id: "beat-limbo-shared-line",
    gameId: "limbo",
    leadId: "ellie",
    participants: crewIds,
    focusIds: ["ece", "ellie"],
    arc: "ece-ellie-reciprocal-jealousy-attraction",
    scene: "signalFourRelay",
    interaction: "Ellie and ECE lower the line together, neither giving up Radiance's attention.",
    paws: { present: true, action: "CREW DASH", beat: "PAWS clears the line first and looks unimpressed.", affectsOutcome: false },
  },
  {
    id: "beat-slots-known-timing",
    gameId: "slots",
    leadId: "alia",
    participants: crewIds,
    focusIds: ["ece", "alia"],
    arc: "ece-alia-intimate-history",
    scene: "signalFourAnchor",
    interaction: "Alia leans into ECE's familiar timing for the reveal.",
    paws: { present: true, action: "CRYSTAL POUNCE", beat: "PAWS steals center frame as the reels stop.", affectsOutcome: false },
  },
  {
    id: "beat-baccarat-old-deal",
    gameId: "baccarat",
    leadId: "radiance",
    participants: crewIds,
    focusIds: ["radiance", "ellie"],
    arc: "original-bond-continuity",
    scene: "signalFourTension",
    interaction: "Radiance and Ellie keep the old deal rhythm while ECE reads every glance.",
    paws: { present: true, action: "SIGNAL SCOUT", beat: "PAWS crosses the table edge as the preset hands turn.", affectsOutcome: false },
  },
  {
    id: "beat-blackjack-original-three",
    gameId: "blackjack",
    leadId: "ellie",
    participants: crewIds,
    focusIds: ["radiance", "ellie", "alia"],
    arc: "founding-bond-continuity",
    scene: "signalFourRelay",
    interaction: "Radiance, Ellie, and Alia lock the reveal in their original rhythm; ECE answers with a grin.",
    paws: { present: true, action: "CREW DASH", beat: "PAWS crosses the table just before the cards turn.", affectsOutcome: false },
  },
  {
    id: "beat-crash-four-point-brace",
    gameId: "crash",
    leadId: "ece",
    participants: crewIds,
    focusIds: crewIds,
    arc: "quartet-connected-finale",
    scene: "signalFourFinale",
    interaction: "All four brace together; ECE reaches Radiance first and Alia closes the chain.",
    paws: { present: false, action: "QUIET FINALE", beat: "PAWS is offscreen for one quiet arrival beat.", affectsOutcome: false },
  },
]);

export const gameIds = deepFreeze(storyEntries.map(({ gameId }) => gameId));
export const storyByGame = deepFreeze(Object.fromEntries(storyEntries.map((story) => [story.gameId, story])));
export const hostById = deepFreeze(Object.fromEntries(hostProfiles.map((host) => [host.id, host])));

export function hostForId(hostId) {
  if (!Object.hasOwn(hostById, hostId)) throw new RangeError(`Unknown Nightflight host: ${String(hostId)}`);
  return hostById[hostId];
}

export function storyForGame(gameId) {
  if (!Object.hasOwn(storyByGame, gameId)) throw new RangeError(`Unknown Nightflight game: ${String(gameId)}`);
  return storyByGame[gameId];
}
