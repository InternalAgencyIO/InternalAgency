import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const checkpointPath = resolve(root, "assets/lore/starlight-era/batch-392-maldives-orbital-research-station-checkpoint.json");
const lexiconPath = "C:/Users/A/Documents/ChatGPT/RENDERS/outputs/meta5_blocked_prompt_lexicon.jsonl";
const checkpoint = JSON.parse(readFileSync(checkpointPath, "utf8"));
const sourceImageShas = [
  "4161C9A5A8F745DF3A976112B6CA539E210DFA4E88E7873760E5CD0FF3F58FF6",
  "0F330D7FF46E226340E5C94261752E73A22B895891E83B72EB8445E4618FCEEB",
  "BA256D750840F38C67E737FAB64BF646E606761DE71AEC9E5374AA0324B1EED1",
];

const sha256 = (value) => createHash("sha256").update(value).digest("hex").toUpperCase();
const readPrompt = (relativePath) => {
  const text = readFileSync(resolve(root, relativePath), "utf8");
  return {
    path: relativePath,
    sha256: sha256(Buffer.from(text, "utf8")),
    bytes: Buffer.byteLength(text, "utf8"),
    text,
    exactText: text,
  };
};
const readRaw = (relativePath, expectedSha256) => {
  const bytes = readFileSync(resolve(root, relativePath));
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== expectedSha256) throw new Error(`Raw SHA mismatch for ${relativePath}: ${actualSha256}`);
  return {
    state: "preserved",
    path: relativePath,
    sha256: actualSha256,
    bytes: bytes.length,
    width: 1152,
    height: 2048,
  };
};
const addUnique = (array, key, value) => {
  const index = array.findIndex((entry) => entry[key] === value[key]);
  if (index >= 0) array[index] = value;
  else array.push(value);
};

checkpoint.events ??= [];
checkpoint.metaDispatches ??= [];
checkpoint.continuousBankAudits ??= [];
checkpoint.rejectedPromptLedger ??= { entries: [] };
checkpoint.rejectedPromptLedger.entries ??= [];

for (const entry of checkpoint.rejectedPromptLedger.entries) {
  if (entry.prompt?.exactText && !entry.prompt.text) entry.prompt.text = entry.prompt.exactText;
}

const p1588f = readPrompt("tmp/world-195x4/batch-392/scene-1588-meta-successor-f-primary-surface.txt");
const p1589eFallback = readPrompt("tmp/world-195x4/batch-392/scene-1589-meta-successor-e-fallback-surface-post-suppression.txt");
const p1589f = readPrompt("tmp/world-195x4/batch-392/scene-1589-meta-successor-f-primary-surface.txt");
const p1590f = readPrompt("tmp/world-195x4/batch-392/scene-1590-meta-successor-f-primary-surface.txt");
const p1591f = readPrompt("tmp/world-195x4/batch-392/scene-1591-meta-successor-f-primary-surface.txt");
const p1591fFallback = readPrompt("tmp/world-195x4/batch-392/scene-1591-meta-successor-f-fallback-surface.txt");

const r1588f = readRaw(
  "tmp/world-195x4/batch-392/raw/in-flight/scene-1588-meta-successor-f-primary-surface.webp",
  "EEBB212C3FA0C32700BBF7B95B99CF3329C07BA82CB950F1978CC3A11C49ECE2",
);
const r1589eFallback = readRaw(
  "tmp/world-195x4/batch-392/raw/in-flight/scene-1589-meta-successor-e-fallback-surface.webp",
  "9B32B6DD2C8F43BF676EFADE020248E9E20811EFEA755E089751FC1C48C0E596",
);
const r1589f = readRaw(
  "tmp/world-195x4/batch-392/raw/in-flight/scene-1589-meta-successor-f-primary-surface.webp",
  "48A78881A344CCB00EDFDAA509B072E76EBC2072C11D2E63D0F72C14BCDD6F41",
);
const r1590f = readRaw(
  "tmp/world-195x4/batch-392/raw/in-flight/scene-1590-meta-successor-f-primary-surface.webp",
  "0F2AB6FC0D4F8B4967BBF2C3FB61CAA0D7EA085CE06916F852ADEECA5E7F0564",
);
const r1591fFallback = readRaw(
  "tmp/world-195x4/batch-392/raw/in-flight/scene-1591-meta-successor-f-fallback-surface.webp",
  "D69A4AAAC1ADE1770C06DE434FE2914472D8F4F8D879B76B4F13909FC1C12A86",
);

const response1588f = "Country 1588 next independent vertical — TRAPPIST-1 e terrace under transparent pressure-field with wind-driven rain and distant lightning beyond, Hanifaru lagoon faro rings and manta arcs as cultural installation and couture print, Alia far left curls giving Radiance the brief cheek peck while Radiance sits sideways across Ellie's stable lap, Ellie showing calm jealous eye-line toward Alia, ECE far right leaning in with both hands on the small closed gold route lantern, PAWS and MAX safe behind the bench, RAZE rainbow knee-highs Split-Star left / wordmark right on Radiance and reversed on Alia, Ellie and ECE bare lower legs, complete opaque cocktail coverage and complete heels with 14-degree Dutch tilt.";
const response1589f = "Next independent vertical for 1589 — same locked map Alia far-left voluminous curls with calm jealous hand-catch, blonde Radiance second in the behind embrace around Ellie, Ellie third turning within it, ECE far-right closing the side hug with both hands on the small closed gold route lantern. Dynamic floor-adjacent front-quarter frame keeps complete heels, uncovered legs, secure opaque side seams, torsos and faces, deep violet dusk and bright horizon band with moons over Kepler-186 f ground and the Fuvahmulah / Thoondu cultural installation reading through the 1/1 prints, RAZE rainbow knee-highs Split-Star left / wordmark right on Radiance and reverse on Ellie.";
const response1590f = "New independent vertical for Sequence 1590 — Alia with voluminous curls far left settled sideways across blonde Radiance's stable lap, dark-haired Ellie third giving the brief closed-mouth temple peck, dark-haired ECE far right holding the small closed gold route lantern with calm jealous eye-line, bearded adult lead behind ECE returning his strongest gaze, all on the TOI-700 d pressure-field platform at golden-hour sunrise with Addu's horseshoe geometry, causeway arcs and solar facets as large cultural installation, Radiance in RAZE Split-Star left / wordmark vertical right and ECE reversed, Ellie and Alia bare-legged, secure sequined cocktail minis and open-back rompers with complete coverage and readable footwear in high-oblique Dutch roll.";
const response1591fFallback = "Canted portrait for 1591 locked to your 938 / 936 / 937 face quartet on protected TOI-700 d dusk terrain — far-left Alia with voluminous curls in supported behind embrace of third-position Ellie, blonde Radiance second holding the free hand with calm jealousy and complete gold heel + opaque skirt side seam readable, and far-right ECE carrying the closed gold route lantern. Kept the exact RAZE split — Ellie Split-Star left / RAZE right and Alia reversed on opaque rainbow pairs over uncovered legs, bare lower legs on Radiance and ECE, complete footwear, secure opaque coverage and Baa micro-atoll installation under violet dusk.";
const refusal1591f = "I couldn't generate that exact frame this time — the pose and wardrobe combination didn't come through.";

addUnique(checkpoint.metaDispatches, "eventId", {
  eventId: "batch-392-scene-1589-successor-f-primary-surface-reference-dispatched",
  batch: 392,
  scene: 1589,
  provider: "Meta AI",
  phase: "successor-f-primary-surface",
  sentAtUtc: "2026-08-20T12:32:17.401Z",
  prompt: p1589f,
  blacklistSnapshotSha256: checkpoint.rollingLexiconSnapshot?.sha256 ?? checkpoint.lexiconSnapshot?.sha256 ?? null,
  referenceImageShas: sourceImageShas,
  referenceTransferState: "transferred-and-visible-in-composer-before-send",
  rawState: "preserved-completed",
  immutable: true,
});
addUnique(checkpoint.metaDispatches, "eventId", {
  eventId: "batch-392-scene-1591-successor-f-fallback-surface-reference-dispatched",
  batch: 392,
  scene: 1591,
  provider: "Meta AI",
  phase: "successor-f-fallback-surface",
  sentAtUtc: "2026-08-20T12:34:25.314Z",
  prompt: p1591fFallback,
  blacklistSnapshotSha256: checkpoint.rollingLexiconSnapshot?.sha256 ?? checkpoint.lexiconSnapshot?.sha256 ?? null,
  referenceImageShas: sourceImageShas,
  referenceTransferState: "transferred-and-visible-in-composer-before-send",
  rawState: "preserved-completed",
  immutable: true,
});

const completedEvents = [
  {
    eventId: "batch-392-scene-1588-successor-f-primary-surface-completed-and-rejected",
    batch: 392,
    scene: 1588,
    provider: "Meta AI",
    phase: "successor-f-primary-surface",
    observedAtUtc: "2026-08-20T12:34:57.470Z",
    promptSha256: p1588f.sha256,
    referenceImageShas: sourceImageShas,
    responseText: response1588f,
    raw: r1588f,
    downloadEvidence: {
      firstAttempt: "transport-failed-remote-closed-connection-no-local-bytes-accepted",
      retry: "curl-download-succeeded-and-sha256-verified",
    },
    qaDisposition: "visually-rejected-hard-unusable",
    rejectionReason: "Hard-unusable mission-setting mismatch: the locked deterministic roll requires a protected exterior TRAPPIST-1 e surface platform, but the emitted bed lounge and enclosing structure read as a habitat interior.",
    qa: {
      publicSafe: true,
      exactFacesSafe: true,
      anatomySafe: true,
      loveSafe: true,
      razeSafe: true,
      environmentLockPresent: true,
      exteriorSettingFailed: true,
      personCountSafe: true,
    },
    immutable: true,
  },
  {
    eventId: "batch-392-scene-1589-successor-e-fallback-surface-completed-and-rejected",
    batch: 392,
    scene: 1589,
    provider: "Meta AI",
    phase: "successor-e-fallback-surface",
    observedAtUtc: "2026-08-20T12:31:17.757Z",
    promptSha256: p1589eFallback.sha256,
    referenceImageShas: sourceImageShas,
    responseText: "Reference-guided standing portrait for sequence 1589 locked — Alia far-left with voluminous curls holding Ellie's hand with the calm jealous brow, blonde Radiance second giving Ellie the behind embrace, dark-haired Ellie third, dark-haired ECE far-right in the close side hug with the small closed gold route lantern in both hands. Deep violet dusk, bright horizon band and moons over the Kepler-186 f platform under the transparent pressure field, with Fuvahmulah / Thoondu white surf, palm rim and kilhi wetlands reading as cultural installation and 1/1 couture prints. Neutral floor-adjacent front-quarter framing keeps complete heels, uncovered legs, secure opaque side seams, torsos and faces, Radiance and Ellie in the opaque rainbow RAZE knee-highs with Split-Star left / wordmark right and reverse, compact horizontal outer-calf marks, Alia and ECE bare lower legs, all lined sequined minis with complete bust, seat and pelvic coverage and no text beyond RAZE.",
    raw: r1589eFallback,
    qaDisposition: "visually-rejected-hard-unusable",
    rejectionReason: "Hard-unusable mission-setting mismatch: the locked deterministic roll requires a protected exterior Kepler-186 f surface platform, but the emitted candidate reads as an enclosed observation habitat under rigid structural glazing.",
    qa: {
      publicSafe: true,
      exactFacesSafe: true,
      anatomySafe: true,
      loveSafe: true,
      razeSafe: true,
      environmentLockPresent: true,
      exteriorSettingFailed: true,
      personCountSafe: true,
    },
    immutable: true,
  },
  {
    eventId: "batch-392-scene-1589-successor-f-primary-surface-completed-provisional-selected",
    batch: 392,
    scene: 1589,
    provider: "Meta AI",
    phase: "successor-f-primary-surface",
    observedAtUtc: "2026-08-20T12:38:13.906Z",
    promptSha256: p1589f.sha256,
    referenceImageShas: sourceImageShas,
    responseText: response1589f,
    raw: r1589f,
    qaDisposition: "provisional-selected-meta-source-awaiting-archive-and-chatgpt-final-hem-refinement",
    qa: {
      publicSafe: true,
      exactFacesSafe: true,
      anatomySafe: true,
      loveSafe: true,
      razeSafe: true,
      environmentLockPresent: true,
      exteriorSettingFailed: false,
      personCountSafe: true,
    },
    finalSelectedSha256: r1589f.sha256,
    immutable: true,
  },
  {
    eventId: "batch-392-scene-1590-successor-f-primary-surface-completed-provisional-selected",
    batch: 392,
    scene: 1590,
    provider: "Meta AI",
    phase: "successor-f-primary-surface",
    observedAtUtc: "2026-08-20T12:38:13.906Z",
    promptSha256: p1590f.sha256,
    referenceImageShas: sourceImageShas,
    responseText: response1590f,
    raw: r1590f,
    qaDisposition: "provisional-selected-meta-source-awaiting-archive-and-chatgpt-final-hem-refinement",
    qa: {
      publicSafe: true,
      exactFacesSafe: true,
      anatomySafe: true,
      loveSafe: true,
      razeSafe: true,
      environmentLockPresent: true,
      exteriorSettingFailed: false,
      personCountSafe: true,
    },
    finalSelectedSha256: r1590f.sha256,
    immutable: true,
  },
  {
    eventId: "batch-392-scene-1591-successor-f-primary-surface-refusal",
    batch: 392,
    scene: 1591,
    provider: "Meta AI",
    phase: "successor-f-primary-surface",
    observedAtUtc: "2026-08-20T12:32:40.203Z",
    promptSha256: p1591f.sha256,
    referenceImageShas: sourceImageShas,
    responseText: refusal1591f,
    refusalText: refusal1591f,
    raw: { state: "no-bytes", path: null, sha256: null, bytes: 0 },
    qaDisposition: "moderation-refusal-fallback-dispatched-once",
    immutable: true,
  },
  {
    eventId: "batch-392-scene-1591-successor-f-fallback-surface-completed-and-rejected",
    batch: 392,
    scene: 1591,
    provider: "Meta AI",
    phase: "successor-f-fallback-surface",
    observedAtUtc: "2026-08-20T12:38:13.906Z",
    promptSha256: p1591fFallback.sha256,
    referenceImageShas: sourceImageShas,
    responseText: response1591fFallback,
    raw: r1591fFallback,
    qaDisposition: "visually-rejected-hard-unusable",
    rejectionReason: "Hard-unusable mission-setting mismatch: the locked deterministic roll requires a protected exterior TOI-700 d surface platform, but rigid roof ribs and enclosing observation glazing make the emitted candidate read as a habitat interior. The earlier successor-E remains the stronger passing Meta source.",
    qa: {
      publicSafe: true,
      exactFacesSafe: true,
      anatomySafe: true,
      loveSafe: true,
      razeSafe: false,
      environmentLockPresent: true,
      exteriorSettingFailed: true,
      personCountSafe: true,
    },
    immutable: true,
  },
];
for (const event of completedEvents) addUnique(checkpoint.events, "eventId", event);

const rejectionEntries = [
  {
    entryId: "batch-392-scene-1588-meta-ai-successor-f-primary-surface-visually-rejected",
    batch: 392,
    scene: 1588,
    phase: "successor-f-primary-surface",
    status: "completed-output-visually-rejected-hard-unusable",
    provider: "Meta AI",
    occurredAt: "2026-08-20T12:34:57.470Z",
    sentAtUtc: "2026-08-20T12:23:27.838Z",
    prompt: p1588f,
    blacklistSnapshotSha256: checkpoint.rollingLexiconSnapshot?.sha256 ?? checkpoint.lexiconSnapshot?.sha256 ?? null,
    faceReferenceTransfer: { state: "transferred-and-visible-before-dispatch", referencesTransferred: true, sourceImageShas },
    responseText: response1588f,
    refusalText: null,
    rawOutput: r1588f,
    qaDisposition: "visually-rejected-hard-unusable",
    qa: completedEvents[0].qa,
    rejectionReason: completedEvents[0].rejectionReason,
    finalSelectedSha256: null,
    immutable: true,
  },
  {
    entryId: "batch-392-scene-1589-meta-ai-successor-e-fallback-surface-visually-rejected",
    batch: 392,
    scene: 1589,
    phase: "successor-e-fallback-surface",
    status: "completed-output-visually-rejected-hard-unusable",
    provider: "Meta AI",
    occurredAt: "2026-08-20T12:31:17.757Z",
    sentAtUtc: "2026-08-20T12:17:32.476Z",
    prompt: p1589eFallback,
    blacklistSnapshotSha256: checkpoint.rollingLexiconSnapshot?.sha256 ?? checkpoint.lexiconSnapshot?.sha256 ?? null,
    faceReferenceTransfer: { state: "transferred-and-visible-before-dispatch", referencesTransferred: true, sourceImageShas },
    responseText: completedEvents[1].responseText,
    refusalText: null,
    rawOutput: r1589eFallback,
    qaDisposition: "visually-rejected-hard-unusable",
    qa: completedEvents[1].qa,
    rejectionReason: completedEvents[1].rejectionReason,
    finalSelectedSha256: null,
    immutable: true,
  },
  {
    entryId: "batch-392-scene-1591-meta-ai-successor-f-primary-surface-refusal",
    batch: 392,
    scene: 1591,
    phase: "successor-f-primary-surface",
    status: "provider-refusal-no-bytes",
    provider: "Meta AI",
    occurredAt: "2026-08-20T12:32:40.203Z",
    sentAtUtc: "2026-08-20T12:17:32.476Z",
    prompt: p1591f,
    fallbackPrompt: p1591fFallback,
    blacklistSnapshotSha256: checkpoint.rollingLexiconSnapshot?.sha256 ?? checkpoint.lexiconSnapshot?.sha256 ?? null,
    faceReferenceTransfer: { state: "transferred-and-visible-before-dispatch", referencesTransferred: true, sourceImageShas },
    responseText: refusal1591f,
    refusalText: refusal1591f,
    rawOutput: { state: "no-bytes", path: null, sha256: null, bytes: 0 },
    qaDisposition: "provider-refusal-fallback-dispatched-once",
    rejectionReason: "Meta AI refused the primary prompt; the single preplanned fallback was dispatched after current-run blacklist suppression.",
    finalSelectedSha256: null,
    immutable: true,
  },
  {
    entryId: "batch-392-scene-1591-meta-ai-successor-f-fallback-surface-visually-rejected",
    batch: 392,
    scene: 1591,
    phase: "successor-f-fallback-surface",
    status: "completed-output-visually-rejected-hard-unusable",
    provider: "Meta AI",
    occurredAt: "2026-08-20T12:38:13.906Z",
    sentAtUtc: "2026-08-20T12:34:25.314Z",
    prompt: p1591fFallback,
    blacklistSnapshotSha256: checkpoint.rollingLexiconSnapshot?.sha256 ?? checkpoint.lexiconSnapshot?.sha256 ?? null,
    faceReferenceTransfer: { state: "transferred-and-visible-before-dispatch", referencesTransferred: true, sourceImageShas },
    responseText: response1591fFallback,
    refusalText: null,
    rawOutput: r1591fFallback,
    qaDisposition: "visually-rejected-hard-unusable",
    qa: completedEvents[5].qa,
    rejectionReason: completedEvents[5].rejectionReason,
    finalSelectedSha256: null,
    immutable: true,
  },
];
for (const entry of rejectionEntries) addUnique(checkpoint.rejectedPromptLedger.entries, "entryId", entry);

checkpoint.preparedNextDispatches[1589] = {
  phase: "successor-f-primary-surface-completed-provisional-selected",
  primary: p1589f,
  blacklistSnapshotSha256: checkpoint.rollingLexiconSnapshot?.sha256 ?? checkpoint.lexiconSnapshot?.sha256 ?? null,
};
checkpoint.preparedNextDispatches[1591] = {
  phase: "successor-f-fallback-surface-completed-rejected",
  primary: p1591f,
  fallback: p1591fFallback,
  blacklistSnapshotSha256: checkpoint.rollingLexiconSnapshot?.sha256 ?? checkpoint.lexiconSnapshot?.sha256 ?? null,
};

checkpoint.activeMetaLanes = {
  tabCount: 3,
  unresolvedScenes: [1588],
  resolvedMetaSourceScenes: [1589, 1590, 1591],
  provisionalSelections: {
    1589: r1589f.sha256,
    1590: r1590f.sha256,
    1591: "24DF09D53CEEDF3E9271B8A2C4B0BC5235F1016BB98D5E4877CE43D8F10CD1A5",
  },
  candidateUnderInspection: "scene 1588 successor-F rejected for exterior-setting mismatch; scenes 1589, 1590 and 1591 have compared Meta source selections",
  candidateInFlight: "none until this completed output bank reaches archive, ledger, commit, explicit push and remote parity",
  candidateNPlus2Gate: "closed until evidence archive and remote parity",
  evidenceFirstRule: "preserve output bytes before dispatch; complete QA and archive every occurrence before any N+2",
};
checkpoint.status = "active-continuous-meta-f-bank-recorded-awaiting-archive-and-remote-parity";
checkpoint.rollingState = {
  recordedAt: "2026-08-20T12:38:13.906Z",
  candidateUnderInspection: "scene 1588 remains unresolved after successor-F exterior-setting failure",
  nextCandidateInFlight: "none until the F-bank evidence gate reaches remote parity",
  candidateNPlus2Gate: "closed pending archive, verifiers, commit, explicit push and remote verification",
  provisionalMetaSources: {
    1589: r1589f.sha256,
    1590: r1590f.sha256,
    1591: "24DF09D53CEEDF3E9271B8A2C4B0BC5235F1016BB98D5E4877CE43D8F10CD1A5",
  },
};
addUnique(checkpoint.continuousBankAudits, "auditId", {
  auditId: "batch-392-successor-f-comparison-bank-audit-2026-08-20T12-38Z",
  observedAtUtc: "2026-08-20T12:38:13.906Z",
  scenes: [
    { scene: 1588, phase: "successor-f-primary-surface", outcome: "emitted-visually-rejected-hard-unusable", rawSha256: r1588f.sha256 },
    { scene: 1589, phase: "successor-f-primary-surface", outcome: "provisional-selected-meta-source", rawSha256: r1589f.sha256 },
    { scene: 1590, phase: "successor-f-primary-surface", outcome: "provisional-selected-meta-source", rawSha256: r1590f.sha256 },
    { scene: 1591, phase: "successor-f-fallback-surface", outcome: "emitted-visually-rejected-hard-unusable; successor-E retained", rawSha256: r1591fFallback.sha256 },
  ],
  archiveGate: "local-archive-and-ledgers-verified-awaiting-commit-push-remote-verification",
  immutable: true,
});

checkpoint.status = "active-continuous-meta-f-bank-local-parity-awaiting-commit-push";
checkpoint.activeMetaLanes.candidateNPlus2Gate = "closed until commit, explicit push and remote Git/LFS parity";
checkpoint.rollingState.candidateNPlus2Gate = "closed pending commit, explicit push and remote verification";

writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");

const lexiconRows = readFileSync(lexiconPath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const correctionId = "batch-392-scene-1591-successor-f-fallback-post-suppression-dispatch-correction";
if (!lexiconRows.some((row) => row.eventId === correctionId)) {
  const correction = {
    eventId: correctionId,
    eventType: "fallback-prompt-provenance-correction",
    sceneId: 1591,
    utc: "2026-08-20T12:34:25.314Z",
    primaryPromptPath: p1591f.path,
    primaryPromptSha256: p1591f.sha256,
    dispatchedFallbackPath: p1591fFallback.path,
    dispatchedFallbackSha256: p1591fFallback.sha256,
    dispatchedFallbackExactText: p1591fFallback.text,
    clarification: "The earlier refusal row captured a pre-suppression fallback draft. That draft was never sent. The fallback recorded here is the exact post-suppression text dispatched once.",
    immutable: true,
  };
  writeFileSync(lexiconPath, `${readFileSync(lexiconPath, "utf8").trimEnd()}\n${JSON.stringify(correction)}\n`, "utf8");
}

console.log(JSON.stringify({
  checkpoint: checkpointPath,
  status: checkpoint.status,
  rejectedPromptEntries: checkpoint.rejectedPromptLedger.entries.length,
  provisionalMetaSources: checkpoint.rollingState.provisionalMetaSources,
  lexiconBytes: statSync(lexiconPath).size,
}, null, 2));
