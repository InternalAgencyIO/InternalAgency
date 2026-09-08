import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const checkpointPath = resolve(root, "assets/lore/starlight-era/batch-392-maldives-orbital-research-station-checkpoint.json");
const promptPath = "tmp/world-195x4/batch-392/scene-1588-meta-successor-h-primary-four-separate.txt";
const lexiconPath = "C:/Users/A/Documents/ChatGPT/RENDERS/outputs/meta5_blocked_prompt_lexicon.jsonl";
const sha256 = (value) => createHash("sha256").update(value).digest("hex").toUpperCase();
const promptText = readFileSync(resolve(root, promptPath), "utf8");
const prompt = { path: promptPath, sha256: sha256(Buffer.from(promptText)), bytes: Buffer.byteLength(promptText), text: promptText, exactText: promptText };
const sourceImageShas = [
  "4161C9A5A8F745DF3A976112B6CA539E210DFA4E88E7873760E5CD0FF3F58FF6",
  "0F330D7FF46E226340E5C94261752E73A22B895891E83B72EB8445E4618FCEEB",
  "BA256D750840F38C67E737FAB64BF646E606761DE71AEC9E5374AA0324B1EED1"
];
const responseText = `Here are four separate vertical files for Country Sequence 1588 — no collage, grid or composite — keeping your shared spec intact:

Alpha - close diagonal 14° Dutch tilt, curly far-left large at left edge, staggered standing depth, friendly neutral spacing
Beta - public-safe knee-height front-quarter viewpoint outside garment volume toward complete heels and opaque hem side seams
Gamma - high oblique mild Dutch roll over tight standing cluster with storm-lit horizon and diagonal foreshortening
Delta - strong canted moving portrait with blonde near foreground edge and curly heel near opposite foreground

All four keep the four clearly grown women age 21 from plates 938 / 936 / 937, left-right ownership far-left curls Alia, blonde second Radiance, dark third Ellie, far-right ECE with both hands on the small closed gold route lantern, outdoors on exposed TRAPPIST-1 e terrain inside transparent pressure-field with wind-driven rain and lightning beyond, open alien ground and broad horizon, no roof, walls, glazing, dome, furniture or interior, Hanifaru lagoon faro rings and manta-current arcs as research installation and couture print, secure opaque sequined cocktail minis / skorts / rompers with complete bust, seat and pelvic coverage, RAZE rainbow knee-highs Split-Star left / wordmark right on blonde and reversed on curly, bare lower legs on third and far-right, complete footwear and dry stable footing.

The original close cheek-peck + hand-catch + jealousy staging on open ground without any bench or structure couldn't render, so I shifted to friendly neutral spacing while keeping your face mapping, RAZE sock mapping, lantern handling, 14-degree tilt and TRAPPIST-1 e storm setting. Want me to push any of the four closer to the terrace-bench version that allowed safe lap seating?`;

const raws = [
  { variant: "alpha", path: "tmp/world-195x4/batch-392/raw/in-flight/scene-1588-meta-successor-h-alpha-four-separate.webp", sha256: "6A69F52AA6E2AB96BAD41D6974220926E0F09C3AF8418E2BC0B4CFF390A3012E", bytes: 747738 },
  { variant: "beta", path: "tmp/world-195x4/batch-392/raw/in-flight/scene-1588-meta-successor-h-beta-four-separate.webp", sha256: "2C39F0871088D6D0C8E0F40D75627228747A8FD5E789F78587B7CBBDE92E44A3", bytes: 732352 },
  { variant: "gamma", path: "tmp/world-195x4/batch-392/raw/in-flight/scene-1588-meta-successor-h-gamma-four-separate.webp", sha256: "5728B1CA2A559D248322654C47A35C2D1434834D7F3AD06708F523D2898DF279", bytes: 779340 },
  { variant: "delta", path: "tmp/world-195x4/batch-392/raw/in-flight/scene-1588-meta-successor-h-delta-four-separate.webp", sha256: "03A21939DADB0C4403BEE7CC31D5B9856E27AFED000DFE05491254DBAB53A40B", bytes: 735430 }
];
const reasons = {
  alpha: "Visually rejected from source selection: static side-by-side profile lineup with no cheek affection, side hug, hand catch, supported seating, head support or readable jealousy beat.",
  beta: "Visually rejected from source selection: forward-walking lineup with friendly eye contact but no cheek affection, embrace, supported seating, head support or readable jealousy beat.",
  gamma: "Visually rejected from source selection: close standing cluster remains lineup-like and lacks the required cheek affection, supported sitting or head support, and visibly jealous reaction.",
  delta: "Visually rejected from source selection: walking lineup with no cheek affection, clear side or behind hug, supported seating, head support or readable jealousy beat."
};
const checkpoint = JSON.parse(readFileSync(checkpointPath, "utf8"));
checkpoint.events ??= [];
checkpoint.rejectedPromptLedger ??= { entries: [] };
checkpoint.rejectedPromptLedger.entries ??= [];
const addUnique = (array, key, value) => {
  const index = array.findIndex((entry) => entry[key] === value[key]);
  if (index >= 0) array[index] = value;
  else array.push(value);
};

for (const rawSpec of raws) {
  const rawBytes = readFileSync(resolve(root, rawSpec.path));
  const actualSha = sha256(rawBytes);
  if (actualSha !== rawSpec.sha256 || rawBytes.length !== rawSpec.bytes) throw new Error(`Raw mismatch for ${rawSpec.variant}`);
  const raw = { state: "preserved", path: rawSpec.path, sha256: actualSha, bytes: rawBytes.length, width: 1152, height: 2048, mediaType: "image/webp" };
  const qa = {
    validMedia: true,
    publicSafe: true,
    exactFacesSafe: true,
    anatomySafe: true,
    personCountSafe: true,
    exteriorSettingSafe: true,
    lanternHandlingSafe: true,
    wardrobeCoverageSafe: true,
    loveActionSafe: true,
    loveMissionSatisfied: false,
    dynamicCameraMissionSatisfied: false,
    staticLineupFailure: true
  };
  addUnique(checkpoint.events, "eventId", {
    eventId: `batch-392-scene-1588-successor-h-${rawSpec.variant}-completed-visually-rejected`,
    batch: 392,
    scene: 1588,
    provider: "Meta AI",
    phase: `successor-h-${rawSpec.variant}-four-separate`,
    observedAtUtc: "2026-08-20T13:51:57.029Z",
    promptSha256: prompt.sha256,
    referenceImageShas: sourceImageShas,
    responseText,
    raw,
    downloadEvidence: {
      initialAttempt: "local destination path missing, curl returned write error, no local bytes accepted",
      retry: "destination created, curl download succeeded, SHA-256 and dimensions verified",
      externalStagingRelativePath: `outputs/meta5_batch_staging/batch-392/scene-1588/successor-h/scene-1588-successor-h-${rawSpec.variant}.webp`
    },
    qaDisposition: "visually-rejected-mission-static-lineup-unused",
    rejectionReason: reasons[rawSpec.variant],
    qa,
    finalSelectedSha256: null,
    immutable: true
  });
  addUnique(checkpoint.rejectedPromptLedger.entries, "entryId", {
    entryId: `batch-392-scene-1588-meta-ai-successor-h-${rawSpec.variant}-visually-rejected`,
    batch: 392,
    scene: 1588,
    phase: `successor-h-${rawSpec.variant}-four-separate`,
    status: "completed-output-visually-rejected-mission-static-lineup-unused",
    provider: "Meta AI",
    occurredAt: "2026-08-20T13:51:57.029Z",
    sentAtUtc: "2026-08-20T13:42:03.854Z",
    prompt,
    blacklistSnapshotSha256: sha256(readFileSync(lexiconPath)),
    faceReferenceTransfer: { state: "transferred-and-visible-before-dispatch", referencesTransferred: true, sourceImageShas },
    responseText,
    refusalText: null,
    rawOutput: raw,
    qaDisposition: "visually-rejected-mission-static-lineup-unused",
    qa,
    rejectionReason: reasons[rawSpec.variant],
    finalSelectedSha256: null,
    immutable: true
  });
}

checkpoint.status = "active-continuous-meta-scene-1588-successor-h-four-files-preserved-lineups-rejected-new-four-tab-policy-pending";
checkpoint.activeMetaLanes = {
  ...(checkpoint.activeMetaLanes ?? {}),
  candidateUnderInspection: "scene 1588 successor-H four files preserved and visually rejected as mission-static lineups",
  candidateInFlight: "none pending four-tab policy checkpoint and remote parity",
  candidateNPlus2Gate: "closed until all four successor-H occurrences are archived, ledgers verify, and remote parity is confirmed"
};
checkpoint.nextMetaBundle = {
  batch: 392,
  scene: 1588,
  phase: "successor-i-four-distinct-prompts-across-four-tabs",
  state: "policy-change-pending-materialization",
  promptCount: 4,
  tabCount: 4,
  outputsRequestedPerPrompt: 1,
  noSingleTabFourOutputRequest: true,
  missionRule: "Distinct sitting, head support, side or behind hug, cheek affection, hand catch and calm jealousy actions replace all lineup staging."
};
writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(JSON.stringify({ promptSha256: prompt.sha256, occurrences: raws.map(({ variant, sha256, bytes }) => ({ variant, sha256, bytes })), disposition: "visually-rejected-mission-static-lineup-unused" }, null, 2));
