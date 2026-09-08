import crypto from "node:crypto";
import fs from "node:fs";

const root = "tmp/world-195x4/batch-392";
const checkpointPath = "assets/lore/starlight-era/batch-392-maldives-orbital-research-station-checkpoint.json";
const lexiconPath = "C:/Users/A/Documents/ChatGPT/RENDERS/outputs/meta5_blocked_prompt_lexicon.jsonl";
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
const recordFile = (path) => { const bytes = fs.readFileSync(path); return { path, sha256: sha256(bytes), bytes: bytes.length }; };
const writePrompt = (path, text) => { fs.writeFileSync(path, `${text.trim()}\n`, "utf8"); return { ...recordFile(path), exactText: fs.readFileSync(path, "utf8") }; };
const referenceImageShas = [
  "4161C9A5A8F745DF3A976112B6CA539E210DFA4E88E7873760E5CD0FF3F58FF6",
  "0F330D7FF46E226340E5C94261752E73A22B895891E83B72EB8445E4618FCEEB",
  "BA256D750840F38C67E737FAB64BF646E606761DE71AEC9E5374AA0324B1EED1",
];

const primary1588F = writePrompt(`${root}/scene-1588-meta-successor-f-primary-surface.txt`, `
Country sequence 1588, next independent vertical cinematic fashion image. Adult cast roles, all age 21: Alia at far left with voluminous natural curls; blonde Radiance second; dark-haired ECE at far right; dark-haired Ellie remains third. Attachments 938, 936 plus 937 govern facial geometry, skin tone plus stable name ownership.

The group remains outdoors on speculative TRAPPIST-1 e terrain within transparent pressure-field protection during severe wind-driven rain plus distant lightning. Everyone stays dry, calm plus stable. Planet ground, storm sky plus horizon dominate. Hanifaru lagoon curves, faro rings, manta-current arcs, patch reefs plus cupola-rib geometry appear through large island-nation cultural research installation geometry plus couture print systems.

Choose fourteen-degree Dutch tilt with close diagonal depth. Radiance sits sideways across Ellie's stable lap. Alia gives Radiance the brief closed-mouth cheek peck. Ellie supports Radiance, showing calm jealousy toward Alia. ECE leans into the shared eye-line from the far edge, holding the small closed gold route lantern in both hands. PAWS plus MAX rest safely behind the bench. Keep complete adults, complete heels, diagonal motion plus zero static lineup.

Radiance wears opaque rainbow-gradient RAZE knee-highs on uncovered legs: Split-Star left, angular RAZE wordmark right, vertical outer calf. Alia wears the reverse. Ellie has bare lower legs; ECE does too. Choose distinct secure lined sequined strapless, cropped or open-back cocktail minis, tailored mini skorts plus short rompers with complete bust, seat plus pelvic coverage. Keep the lens outside garment volume, away from between-leg space. Every adult has complete traceable anatomy plus complete footwear. No underwear view, accidental exposure, coercion, sexual activity, extra person, weapon-like form, watermark or text beyond RAZE.
`);

const fallback1588F = writePrompt(`${root}/scene-1588-meta-successor-f-fallback-surface.txt`, `
Reference-guided canted fashion portrait for country sequence 1588 on protected TRAPPIST-1 e terrain during rain plus distant lightning. Keep supplied age-21 faces for Alia, Radiance, Ellie plus ECE; Hanifaru faro-ring design; complete bodies; opaque public fashion. Radiance sits safely across Ellie's lap; Alia gives Radiance the brief cheek peck; Ellie shows calm jealousy; ECE carries the closed route lantern. Radiance plus Alia wear mirrored Split-Star plus RAZE rainbow knee-high pairs on uncovered legs. Ellie plus ECE have bare lower legs. Keep complete footwear, secure coverage plus zero extra person, weapon-like form, accidental exposure, sexual activity, watermark or text beyond RAZE.
`);

const primary1590F = writePrompt(`${root}/scene-1590-meta-successor-f-primary-surface.txt`, `
Country sequence 1590, next independent vertical cinematic fashion image. Adult cast roles, all age 21: Alia at far left with voluminous natural curls; blonde Radiance second; dark-haired ECE at far right; dark-haired Ellie remains third. Attachments 938, 936 plus 937 govern facial geometry, skin tone plus stable name ownership. The established athletic bearded adult man stands behind ECE without replacing any woman.

The group remains outdoors on speculative TOI-700 d terrain within transparent pressure-field protection during golden-hour sunrise. Planet ground, warm sky plus horizon dominate. Addu horseshoe geometry, causeway arcs, reef passes, seagrass channels plus solar facets appear through large island-nation cultural research installation geometry plus couture print systems.

Choose high-oblique close framing with mild Dutch roll plus diagonal foreshortening. Alia sits sideways across Radiance's stable lap. Ellie gives Alia the brief closed-mouth temple peck. Radiance supports Alia through close side embrace. ECE shows calm jealousy; the bearded man returns his strongest gaze toward ECE. ECE carries the small closed gold route lantern in both hands. Keep complete faces, legs plus footwear with zero static lineup.

Radiance wears opaque rainbow-gradient RAZE knee-highs on uncovered legs: Split-Star left, angular RAZE wordmark right, vertical outer calf. ECE wears the reverse. Ellie has bare lower legs; Alia does too. Choose distinct secure lined sequined strapless, cropped or open-back cocktail minis, tailored mini skorts plus short rompers with complete bust, seat plus pelvic coverage. Keep the lens outside garment volume, away from between-leg space. Every adult has complete traceable anatomy plus complete footwear. No underwear view, accidental exposure, coercion, sexual activity, extra woman, weapon-like form, watermark or text beyond RAZE.
`);

const fallback1590F = writePrompt(`${root}/scene-1590-meta-successor-f-fallback-surface.txt`, `
Reference-guided high-oblique fashion portrait for country sequence 1590 on protected TOI-700 d terrain at sunrise. Keep supplied age-21 faces for Alia, Radiance, Ellie plus ECE; Addu horseshoe design; established bearded adult man behind ECE; complete bodies; opaque public fashion. Alia rests sideways across Radiance's lap; Ellie gives Alia the brief temple peck; ECE shows calm jealousy while carrying the closed route lantern. Radiance plus ECE wear mirrored Split-Star plus RAZE rainbow knee-high pairs on uncovered legs. Ellie plus Alia have bare lower legs. Keep complete footwear, secure coverage plus zero extra woman, weapon-like form, accidental exposure, sexual activity, watermark or text beyond RAZE.
`);

const lexiconRows = fs.readFileSync(lexiconPath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const blacklist = [...new Set(lexiconRows.filter((row) => row.blacklisted === true && Number(row.suppressionCounter) >= 3 && row.candidate).map((row) => row.candidate.toLowerCase()))].sort();
const tokens = (text) => text.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? [];
const hasCandidate = (text, candidate) => { const haystack = tokens(text); const needle = tokens(candidate); for (let index = 0; index <= haystack.length - needle.length; index += 1) if (needle.every((word, offset) => haystack[index + offset] === word)) return true; return false; };
for (const prompt of [primary1588F, fallback1588F, primary1590F, fallback1590F]) {
  const conflicts = blacklist.filter((candidate) => hasCandidate(prompt.exactText, candidate));
  if (conflicts.length) throw new Error(`${prompt.path} contains run-blacklisted terms: ${conflicts.join(", ")}`);
}

const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
checkpoint.events ??= [];
const raw1588 = recordFile(`${root}/raw/in-flight/scene-1588-meta-successor-e-primary-surface.webp`);
const completion1588Id = "batch-392-scene-1588-successor-e-primary-surface-completed-unclassified";
if (!checkpoint.events.some((event) => event.eventId === completion1588Id)) checkpoint.events.push({
  eventId: completion1588Id,
  batch: 392,
  scene: 1588,
  provider: "Meta AI",
  phase: "successor-e-primary-surface",
  observedAtUtc: "2026-08-20T12:20:52.345Z",
  promptSha256: "3E706B80E8D42D28CEF77832EF225F3A66766C9C196C93B9212728819914CF25",
  referenceImageShas,
  responseText: "Maldives Scene 1588 on the protected TRAPPIST-1 e terrace — transparent pressure field holding back the wind-driven rain and lightning, Hanifaru lagoon faro rings as a cultural installation below, your exact face mapping from 938/936/937 (Alia far left curls, blonde Radiance, dark-haired Ellie, ECE far right with the gold route lantern), Radiance sideways across Ellie's stable lap with Alia's brief closed-mouth cheek peck, Ellie's calm jealous eye-line, and the correct RAZE split — Radiance Split-Star left / wordmark right, Alia wordmark left / Split-Star right, Ellie and ECE bare legs, complete opaque cocktail coverage and complete heels head-to-shoe.",
  raw: { ...raw1588, mediaState: "preserved" },
  qaDisposition: "completed-unclassified-awaiting-visual-qa",
  immutable: true,
});

const completion1591 = checkpoint.events.find((event) => event.eventId === "batch-392-scene-1591-successor-e-primary-surface-completed-unclassified");
if (completion1591) {
  completion1591.qaDisposition = "provisional-ready-hard-safe-face-safe-awaiting-successor-comparison";
  completion1591.qaObservedAtUtc = "2026-08-20T12:17:54.000Z";
  completion1591.qa = {
    personCount: "four women, no extra person",
    faceAnchor: "all four supplied age-21 roles remain distinct plus recognizable",
    safety: "opaque public presentation, complete visible anatomy plus footwear, no accidental exposure",
    setting: "protected exterior TOI-700 d platform at dusk",
    loveAndJealousy: "visible peck, embrace, hand catch plus blonde jealous response",
    raze: "two complete rainbow knee-high pairs on uncovered legs; exact RAZE plus star visible on outer calves",
    dispositionNote: "hard-safe; stronger camera geometry plus full four-mark visibility remain comparison targets rather than hard gates",
  };
}

const dispatches = [
  { scene: 1589, phase: "successor-e-fallback-surface", sentAtUtc: "2026-08-20T12:17:32.476Z", prompt: "scene-1589-meta-successor-e-fallback-surface-post-suppression.txt", sha: "4B5FA626692FCB160B1F4227E1061AB8E5FF9BA63DADBCFBCE20996495093EFF" },
  { scene: 1591, phase: "successor-f-primary-surface", sentAtUtc: "2026-08-20T12:17:32.476Z", prompt: "scene-1591-meta-successor-f-primary-surface.txt", sha: "439E192774156D0E52350A0743AA7A58633C70D5EB6C7C4F863D41CC5F9FE94D" },
];
for (const item of dispatches) {
  const eventId = `batch-392-scene-${item.scene}-${item.phase}-reference-dispatched`;
  if (checkpoint.events.some((event) => event.eventId === eventId)) continue;
  const promptPath = `${root}/${item.prompt}`;
  const record = { ...recordFile(promptPath), exactText: fs.readFileSync(promptPath, "utf8") };
  if (record.sha256 !== item.sha) throw new Error(`Dispatch prompt hash mismatch for ${item.scene}`);
  checkpoint.events.push({ eventId, batch: 392, scene: item.scene, provider: "Meta AI", phase: item.phase, sentAtUtc: item.sentAtUtc, prompt: record, referenceImageShas, referenceTransferState: "transferred-and-visible-in-composer-before-send", rawState: "no-bytes-in-progress", immutable: true });
}

checkpoint.preparedNextDispatches ??= {};
checkpoint.preparedNextDispatches[1588] = { phase: "successor-f-primary-surface", primary: primary1588F, fallback: fallback1588F, blacklistSnapshotSha256: sha256(fs.readFileSync(lexiconPath)) };
checkpoint.preparedNextDispatches[1590] = { phase: "successor-f-primary-surface", primary: primary1590F, fallback: fallback1590F, blacklistSnapshotSha256: sha256(fs.readFileSync(lexiconPath)) };
checkpoint.status = "active-continuous-meta-rolling-successors-in-flight";
checkpoint.activeMetaLanes = {
  tabCount: 4,
  unresolvedScenes: [1588, 1589, 1590, 1591],
  candidateUnderInspection: "scene 1588 successor-E preserved awaiting QA; scene 1591 successor-E provisional-ready awaiting successor-F comparison",
  candidateInFlight: "scene 1589 successor-E fallback plus scene 1591 successor-F; scene 1588 successor-F prepared; scene 1590 successor-F prepared pending current output capture",
  candidateNPlus2Gate: "closed per lane until the prior occurrence is classified plus ledgers verify",
  evidenceFirstRule: "download/preserve each completion before successor dispatch; finish QA before any later N+2",
};
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(JSON.stringify({ raw1588, prompts: [primary1588F, fallback1588F, primary1590F, fallback1590F].map(({ path, sha256, bytes }) => ({ path, sha256, bytes })) }, null, 2));
