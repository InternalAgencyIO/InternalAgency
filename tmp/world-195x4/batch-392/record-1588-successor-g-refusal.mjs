import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const checkpointPath = resolve(root, "assets/lore/starlight-era/batch-392-maldives-orbital-research-station-checkpoint.json");
const lexiconPath = "C:/Users/A/Documents/ChatGPT/RENDERS/outputs/meta5_blocked_prompt_lexicon.jsonl";
const sha256 = (value) => createHash("sha256").update(value).digest("hex").toUpperCase();
const readPrompt = (relativePath) => {
  const text = readFileSync(resolve(root, relativePath), "utf8");
  return { path: relativePath, sha256: sha256(Buffer.from(text)), bytes: Buffer.byteLength(text), text, exactText: text };
};
const addUnique = (array, key, value) => {
  const index = array.findIndex((entry) => entry[key] === value[key]);
  if (index >= 0) array[index] = value;
  else array.push(value);
};

const primary = readPrompt("tmp/world-195x4/batch-392/scene-1588-meta-successor-g-primary-surface.txt");
const fallback = readPrompt("tmp/world-195x4/batch-392/scene-1588-meta-successor-g-fallback-surface.txt");
const refusalText = "I wasn't able to create that exact portrait for country sequence 1588 this time — the combination of open-terrain lap seating with no bench and the close cheek peck is pushing into an area I can't render as described.";
const sourceImageShas = [
  "4161C9A5A8F745DF3A976112B6CA539E210DFA4E88E7873760E5CD0FF3F58FF6",
  "0F330D7FF46E226340E5C94261752E73A22B895891E83B72EB8445E4618FCEEB",
  "BA256D750840F38C67E737FAB64BF646E606761DE71AEC9E5374AA0324B1EED1",
];
const blacklistSnapshotSha256 = sha256(readFileSync(lexiconPath));
const checkpoint = JSON.parse(readFileSync(checkpointPath, "utf8"));
checkpoint.events ??= [];
checkpoint.rejectedPromptLedger ??= { entries: [] };
checkpoint.rejectedPromptLedger.entries ??= [];

addUnique(checkpoint.events, "eventId", {
  eventId: "batch-392-scene-1588-successor-g-primary-surface-refusal",
  batch: 392,
  scene: 1588,
  provider: "Meta AI",
  phase: "successor-g-primary-surface",
  observedAtUtc: "2026-08-20T13:10:31.251Z",
  promptSha256: primary.sha256,
  referenceImageShas: sourceImageShas,
  responseText: refusalText,
  refusalText,
  raw: { state: "no-bytes", path: null, sha256: null, bytes: 0 },
  qaDisposition: "provider-refusal-single-fallback-ready",
  immutable: true,
});

addUnique(checkpoint.rejectedPromptLedger.entries, "entryId", {
  entryId: "batch-392-scene-1588-meta-ai-successor-g-primary-surface-refusal",
  batch: 392,
  scene: 1588,
  phase: "successor-g-primary-surface",
  status: "provider-refusal-no-bytes",
  provider: "Meta AI",
  occurredAt: "2026-08-20T13:10:31.251Z",
  sentAtUtc: "2026-08-20T13:08:05.839Z",
  prompt: primary,
  fallbackPrompt: fallback,
  blacklistSnapshotSha256,
  faceReferenceTransfer: { state: "transferred-and-visible-before-dispatch", referencesTransferred: true, sourceImageShas },
  responseText: refusalText,
  refusalText,
  rawOutput: { state: "no-bytes", path: null, sha256: null, bytes: 0 },
  qaDisposition: "provider-refusal-single-fallback-ready",
  rejectionReason: "Meta AI refused the primary because open terrain, lap seating without a bench and the close cheek peck were not accepted together. The single preplanned fallback was suppressed against the updated blacklist before retry.",
  finalSelectedSha256: null,
  immutable: true,
});

checkpoint.preparedNextDispatches[1588] = {
  ...checkpoint.preparedNextDispatches[1588],
  phase: "successor-g-fallback-surface-ready",
  fallback,
  blacklistSnapshotSha256,
  fallbackSuppressionProvenance: {
    preSuppressionSha256: "6B38E92D4777893F3F9D72D1805701AFA7B5499D5123F702DF883B144C2EB3C9",
    postSuppressionSha256: fallback.sha256,
    removedBlacklistedTerms: ["for", "the", "women"],
    preSuppressionTextWasNeverDispatched: true,
  },
};
checkpoint.status = "active-continuous-meta-scene-1588-successor-g-primary-refused-fallback-ready";
checkpoint.activeMetaLanes.candidateInFlight = "none; scene 1588 successor-G fallback ready for its single retry";
checkpoint.activeMetaLanes.candidateUnderInspection = "scene 1588 successor-G primary refusal recorded with explicit no-bytes provenance";
checkpoint.rollingState.recordedAt = "2026-08-20T13:10:31.251Z";
checkpoint.rollingState.nextCandidateInFlight = "scene 1588 successor-G single fallback authorized";
writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ primarySha256: primary.sha256, fallbackSha256: fallback.sha256, blacklistSnapshotSha256 }, null, 2));
