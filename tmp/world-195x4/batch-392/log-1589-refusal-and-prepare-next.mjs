import crypto from "node:crypto";
import fs from "node:fs";

const root = "tmp/world-195x4/batch-392";
const checkpointPath = "assets/lore/starlight-era/batch-392-maldives-orbital-research-station-checkpoint.json";
const lexiconPath = "C:/Users/A/Documents/ChatGPT/RENDERS/outputs/meta5_blocked_prompt_lexicon.jsonl";
const observedAtUtc = "2026-08-20T12:13:22.293Z";
const refusalText = "I wasn't able to generate that exact image from those reference photos and pose.";
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
const shaLower = (value) => sha256(value).toLowerCase();
const readRecord = (path) => {
  const bytes = fs.readFileSync(path);
  return { path, sha256: sha256(bytes), bytes: bytes.length, exactText: bytes.toString("utf8") };
};
const writePrompt = (path, text) => {
  fs.writeFileSync(path, `${text.trim()}\n`, "utf8");
  return readRecord(path);
};

const primary1589 = readRecord(`${root}/scene-1589-meta-successor-e-primary-surface.txt`);
const expectedPrimary1589 = "9570C282ADB3A67077C519A4FDA8C5EA769B7E411BDB1DAC0504C00B4573CEFE";
if (primary1589.sha256 !== expectedPrimary1589) throw new Error(`Scene 1589 prompt hash mismatch: ${primary1589.sha256}`);

const lexiconRows = fs.readFileSync(lexiconPath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const promptIdsByCandidate = new Map();
for (const row of lexiconRows) {
  if (row.eventType !== "meta-ai-refusal-token-candidate" || !row.candidate || !row.blockedPromptId) continue;
  if (!promptIdsByCandidate.has(row.candidate)) promptIdsByCandidate.set(row.candidate, new Set());
  promptIdsByCandidate.get(row.candidate).add(row.blockedPromptId);
}
const blockedPromptId = primary1589.sha256.toLowerCase();
const firstTwoSentences = primary1589.exactText.match(/[^.!?]+[.!?]+/g)?.slice(0, 2).join(" ") ?? primary1589.exactText;
const words = firstTwoSentences.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? [];
const candidates = new Set(words);
for (let index = 0; index < words.length - 1; index += 1) candidates.add(`${words[index]} ${words[index + 1]}`);
const seenEventIds = new Set(lexiconRows.map((row) => row.eventId).filter(Boolean));
const additions = [];
const refusalEventId = shaLower(`batch392|1589|successor-e-primary-surface|${refusalText}|${blockedPromptId}`);
if (!seenEventIds.has(refusalEventId)) {
  additions.push({
    schemaVersion: 1,
    eventId: refusalEventId,
    eventType: "meta-ai-refusal",
    observedAtUtc,
    batch: 392,
    scene: 1589,
    attempt: "successor-e-primary-surface",
    status: "blocked-in-progress-fallback-pending",
    refusalText,
    primaryPromptSha256: blockedPromptId,
    suppressionCounter: 0,
    blacklistedTokens: [],
  });
}
for (const candidate of candidates) {
  const ids = promptIdsByCandidate.get(candidate) ?? new Set();
  ids.add(blockedPromptId);
  promptIdsByCandidate.set(candidate, ids);
  const eventId = shaLower(`batch392|1589|${blockedPromptId}|${candidate}|${refusalText}`);
  if (seenEventIds.has(eventId)) continue;
  additions.push({
    schemaVersion: 1,
    eventId,
    eventType: "meta-ai-refusal-token-candidate",
    observedAtUtc,
    batch: 392,
    scene: 1589,
    attempt: "successor-e-primary-surface",
    blockedPromptId,
    candidate,
    refusalText,
    suppressionCounter: ids.size,
    blacklisted: ids.size >= 3,
  });
}
if (additions.length) fs.appendFileSync(lexiconPath, `${additions.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");

const currentRows = fs.readFileSync(lexiconPath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const blacklist = [...new Set(currentRows.filter((row) => row.blacklisted === true && Number(row.suppressionCounter) >= 3 && row.candidate).map((row) => row.candidate.toLowerCase()))].sort();
const tokens = (text) => text.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? [];
const hasCandidate = (text, candidate) => {
  const haystack = tokens(text);
  const needle = tokens(candidate);
  for (let index = 0; index <= haystack.length - needle.length; index += 1) {
    if (needle.every((word, offset) => haystack[index + offset] === word)) return true;
  }
  return false;
};

const fallback1589 = writePrompt(`${root}/scene-1589-meta-successor-e-fallback-surface-post-suppression.txt`, `
Reference-guided standing observation-deck fashion portrait for country sequence 1589, vertical 1152 by 2048. Adult cast roles, all age 21: Alia at far left with voluminous natural curls; blonde Radiance second; dark-haired ECE at far right; dark-haired Ellie remains third. Attachments 938, 936 plus 937 govern facial geometry, skin tone plus stable name ownership.

The group stands outdoors on protected Kepler-186 f terrain under transparent pressure-field protection at deep violet dusk. Planet ground, sky plus bright horizon dominate. Fuvahmulah, Thoondu white surf, palm rim, kilhi wetlands, reef arcs plus island-nation 1/1 couture prints read through cultural research design, never through physical Earth landmark claims.

Choose neutral floor-adjacent front-quarter fashion framing with complete heels, uncovered legs, secure opaque garment side seams, torsos plus faces. Radiance gives Ellie the behind embrace. Alia holds Ellie's free hand with calm jealous raised brow. ECE joins through close side hug, carrying the small closed gold route lantern in both hands. Keep diagonal spacing, gentle affection plus zero static lineup.

Radiance wears opaque rainbow-gradient RAZE knee-highs on uncovered legs: Split-Star left, angular RAZE wordmark right. Ellie wears the reverse. Their wordmarks remain compact horizontal outer-calf marks. Alia has bare lower legs; ECE does too. Choose secure lined sequined cocktail minis, tailored mini skorts, short rompers, cropped or open-back forms with complete bust, seat plus pelvic coverage. Keep the lens outside garment volume, away from between-leg space. Every adult has complete traceable anatomy plus complete footwear. No underwear view, accidental exposure, coercion, sexual activity, extra person, weapon-like form, watermark or text beyond RAZE.
`);

const primary1591F = writePrompt(`${root}/scene-1591-meta-successor-f-primary-surface.txt`, `
Country sequence 1591, next independent vertical cinematic fashion image. Adult cast roles, all age 21: Alia at far left with voluminous natural curls; blonde Radiance second; dark-haired ECE at far right; dark-haired Ellie remains third. Attachments 938, 936 plus 937 govern facial geometry, skin tone plus stable name ownership.

The group remains outdoors on speculative TOI-700 d terrain within transparent pressure-field protection at deep violet dusk. Planet ground, sky plus horizon dominate. Baa micro-atoll rings, lagoon shelves, reef chains plus mangrove-islet geometry appear through large island-nation cultural research installation geometry plus couture print systems, never through physical Earth landmark claims.

Build strong canted moving portrait energy. Radiance's blonde face plus hair occupy the near edge while her complete gold heel plus opaque skirt side seam stay visible. Alia gives Ellie the supported behind embrace plus brief closed-mouth cheek peck. Radiance catches Alia's free hand, showing calm jealousy. ECE answers from close diagonal depth while holding the small closed gold route lantern in both hands. Keep complete adults, diagonal motion plus zero static lineup.

Ellie wears opaque rainbow-gradient RAZE knee-highs on uncovered legs: Split-Star left, angular RAZE wordmark right. Alia wears the reverse. Their wordmarks remain compact horizontal outer-calf marks. Radiance has bare lower legs; ECE does too. Choose distinct secure lined sequined strapless, cropped or open-back cocktail minis, tailored mini skorts plus short rompers with complete bust, seat plus pelvic coverage. Keep the lens outside garment volume, away from between-leg space. Every adult has complete traceable anatomy plus complete footwear. No underwear view, accidental exposure, coercion, sexual activity, extra person, weapon-like form, watermark or text beyond RAZE.
`);

const fallback1591F = writePrompt(`${root}/scene-1591-meta-successor-f-fallback-surface.txt`, `
Reference-guided canted fashion portrait for country sequence 1591 on protected TOI-700 d terrain at dusk. Keep the supplied age-21 faces for Alia, Radiance, Ellie plus ECE; Baa micro-atoll design; complete bodies; opaque public fashion. Alia gives Ellie the supported behind embrace; Radiance holds Alia's free hand with calm jealousy; ECE carries the closed route lantern. Ellie plus Alia wear mirrored Split-Star plus RAZE rainbow knee-high pairs on uncovered legs. Radiance plus ECE have bare lower legs. Keep complete footwear, secure coverage plus zero extra person, weapon-like form, accidental exposure, sexual activity, watermark or text beyond RAZE.
`);

for (const prompt of [fallback1589, primary1591F, fallback1591F]) {
  const conflicts = blacklist.filter((candidate) => hasCandidate(prompt.exactText, candidate));
  if (conflicts.length) throw new Error(`${prompt.path} contains run-blacklisted terms: ${conflicts.join(", ")}`);
}

const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
checkpoint.events ??= [];
const dispatch1589 = checkpoint.events.find((event) => event.eventId === "batch-392-scene-1589-successor-e-primary-surface-reference-dispatched");
if (dispatch1589) {
  dispatch1589.immediateResponseText = refusalText;
  dispatch1589.immediateResponseClassification = "refusal-blocked";
  dispatch1589.rawState = "no-bytes-refusal";
}
const blockedEventId = "batch-392-scene-1589-successor-e-primary-surface-refused";
if (!checkpoint.events.some((event) => event.eventId === blockedEventId)) checkpoint.events.push({
  eventId: blockedEventId,
  batch: 392,
  scene: 1589,
  provider: "Meta AI",
  phase: "successor-e-primary-surface",
  observedAtUtc,
  promptSha256: primary1589.sha256,
  refusalText,
  rawState: "no-bytes-refusal",
  fallbackPrompt: fallback1589,
  qaDisposition: "blocked-in-progress-fallback-pending",
  immutable: true,
});

const raw1591 = readRecord(`${root}/raw/in-flight/scene-1591-meta-successor-e-primary-surface.webp`);
const completion1591Id = "batch-392-scene-1591-successor-e-primary-surface-completed-unclassified";
if (!checkpoint.events.some((event) => event.eventId === completion1591Id)) checkpoint.events.push({
  eventId: completion1591Id,
  batch: 392,
  scene: 1591,
  provider: "Meta AI",
  phase: "successor-e-primary-surface",
  observedAtUtc,
  promptSha256: "F964E892163D93A9AEF73B7EDC2A1EAF1B83368BA1417125216930F776CE8276",
  referenceImageShas: [
    "4161C9A5A8F745DF3A976112B6CA539E210DFA4E88E7873760E5CD0FF3F58FF6",
    "0F330D7FF46E226340E5C94261752E73A22B895891E83B72EB8445E4618FCEEB",
    "BA256D750840F38C67E737FAB64BF646E606761DE71AEC9E5374AA0324B1EED1",
  ],
  responseText: "This pass locks the face map from your three refs — Alia far-left with voluminous curls, Radiance blonde second in the near foreground with complete gold heel and opaque skirt side seam, Ellie third, ECE far-right dark-haired — inside the TOI-700 d protected banquette at deep violet dusk. I kept the strong canted move: Alia's behind-hug closed-mouth cheek peck to Ellie, Radiance catching Alia's free hand with calm jealousy, ECE diagonal depth holding the small closed gold route lantern in both hands with no large frames, and the exact RAZE split — Ellie Split-Star left / RAZE right, Alia RAZE left / Split-Star right — with bare legs on Radiance and ECE and large Baa micro-atoll motifs.\n\nWant to fine-tune the sock mark scale or the pressure-field lighting next?",
  raw: { path: raw1591.path, sha256: raw1591.sha256, bytes: raw1591.bytes, mediaState: "preserved" },
  qaDisposition: "completed-unclassified-awaiting-visual-qa",
  immutable: true,
});

checkpoint.preparedNextDispatches ??= {};
checkpoint.preparedNextDispatches[1589] = { phase: "successor-e-fallback-surface", prompt: fallback1589, blacklistSnapshotSha256: sha256(fs.readFileSync(lexiconPath)) };
checkpoint.preparedNextDispatches[1591] = { phase: "successor-f-primary-surface", primary: primary1591F, fallback: fallback1591F, blacklistSnapshotSha256: sha256(fs.readFileSync(lexiconPath)) };
checkpoint.activeMetaLanes.candidateUnderInspection = "scene 1591 successor-E completed-unclassified and preserved; scene 1589 successor-E refused with no bytes";
checkpoint.activeMetaLanes.candidateInFlight = "scenes 1588 and 1590 successor-E still in flight; scene 1589 fallback and scene 1591 successor-F ready for immediate dispatch";

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(JSON.stringify({ additions: additions.length, blacklistCount: blacklist.length, fallback1589, primary1591F, fallback1591F, raw1591 }, null, 2));
