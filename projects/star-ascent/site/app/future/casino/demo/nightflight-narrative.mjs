const freezeEntries = (entries) => Object.freeze(entries.map((entry) => Object.freeze(entry)));

export const narrativePolicy = Object.freeze({
  characters: "fictional adults age 25+",
  relationship: "mutual, consensual, playful, and non-explicit",
  mapping: "deterministic game-to-story mapping with no random selection",
});

export const campaignArt = Object.freeze({
  gala: "/future/casino/nightflight/nightflight-gala.png",
  runway: "/future/casino/nightflight/nightflight-runway.png",
  constellation: "/future/casino/nightflight/nightflight-constellation.png",
  launchHero: "/future/casino/nightflight/nightflight-launch-hero-v1.png",
  animeRunway: "/future/casino/nightflight/nightflight-anime-runway-v1.png",
  launchMotion: "/future/casino/nightflight/nightflight-launch-motion-source-v1.png",
});

export const hostProfiles = freezeEntries([
  { name: "Radiance", callSign: "R-01", role: "Flight lead", signal: "Gold-spectrum launch control", tone: "solar", imagePosition: "22% center", tattoo: "Gold scorpion // upper-left thigh cue", minimumAge: 25 },
  { name: "Ellie", callSign: "E-02", role: "Orbit host", signal: "Sapphire navigation channel", tone: "sapphire", imagePosition: "50% center", tattoo: "Star-and-crescent // lower-back cue", minimumAge: 25 },
  { name: "Alia", callSign: "A-03", role: "Night deck host", signal: "Crimson stage telemetry", tone: "crimson", imagePosition: "79% center", tattoo: "Thorned rose // side-ribcage cue", minimumAge: 25 },
]);

const storyEntries = [
  { id: "beat-plinko-launch-hand", gameId: "plinko", leadHost: "Radiance", participants: ["Radiance", "Ellie"], art: "runway", interaction: "Radiance steadies Ellie's launch hand", pawsAction: "PAWS-UP REQUEST" },
  { id: "beat-dice-ribbon", gameId: "dice", leadHost: "Ellie", participants: ["Ellie", "Alia"], art: "gala", interaction: "Ellie passes Alia the sapphire ribbon", pawsAction: "RIBBON CHASE" },
  { id: "beat-roulette-orbit", gameId: "roulette", leadHost: "Alia", participants: ["Alia", "Radiance", "Ellie"], art: "constellation", interaction: "Alia draws both pilots into orbit", pawsAction: "CREW DASH" },
  { id: "beat-mines-mirror", gameId: "mines", leadHost: "Radiance", participants: ["Radiance", "Alia"], art: "runway", interaction: "Radiance and Alia mirror the safe lane", pawsAction: "CONSOLE INSPECTOR" },
  { id: "beat-keno-linked-hands", gameId: "keno", leadHost: "Ellie", participants: ["Ellie", "Radiance", "Alia"], art: "constellation", interaction: "Ellie links hands across the triangle", pawsAction: "PAWS-UP REQUEST" },
  { id: "beat-limbo-whisper", gameId: "limbo", leadHost: "Alia", participants: ["Alia", "Ellie"], art: "gala", interaction: "Alia whispers the target to Ellie", pawsAction: "RIBBON CHASE" },
  { id: "beat-slots-victory-lean", gameId: "slots", leadHost: "Radiance", participants: ["Radiance", "Ellie", "Alia"], art: "constellation", interaction: "Radiance cues a three-way victory lean", pawsAction: "CREW DASH" },
  { id: "beat-baccarat-between", gameId: "baccarat", leadHost: "Ellie", participants: ["Ellie", "Radiance", "Alia"], art: "runway", interaction: "Ellie deals between Radiance and Alia", pawsAction: "LAP COPILOT" },
  { id: "beat-blackjack-reveal", gameId: "blackjack", leadHost: "Alia", participants: ["Alia", "Radiance"], art: "gala", interaction: "Alia locks the reveal with Radiance", pawsAction: "CONSOLE INSPECTOR" },
  { id: "beat-crash-brace", gameId: "crash", leadHost: "Radiance", participants: ["Radiance", "Ellie", "Alia"], art: "runway", interaction: "The trio braces together for cutoff", pawsAction: "CREW DASH" },
].map((entry) => Object.freeze({ ...entry, participants: Object.freeze(entry.participants) }));

export const gameIds = Object.freeze(storyEntries.map(({ gameId }) => gameId));
export const storyByGame = Object.freeze(Object.fromEntries(storyEntries.map((story) => [story.gameId, story])));

export function storyForGame(gameId) {
  if (!Object.hasOwn(storyByGame, gameId)) {
    throw new RangeError(`Unknown Nightflight game: ${String(gameId)}`);
  }
  return storyByGame[gameId];
}
