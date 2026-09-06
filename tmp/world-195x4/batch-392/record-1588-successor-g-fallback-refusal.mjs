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
const primaryRefusal = "I wasn't able to create that exact portrait for country sequence 1588 this time — the combination of open-terrain lap seating with no bench and the close cheek peck is pushing into an area I can't render as described.";
const fallbackRefusal = "I wasn't able to create that exact canted portrait on open TRAPPIST-1 e ground with the lap seating as described.";
const sourceImageShas = [
  "4161C9A5A8F745DF3A976112B6CA539E210DFA4E88E7873760E5CD0FF3F58FF6",
  "0F330D7FF46E226340E5C94261752E73A22B895891E83B72EB8445E4618FCEEB",
  "BA256D750840F38C67E737FAB64BF646E606761DE71AEC9E5374AA0324B1EED1",
];
const observedAtUtc = new Date().toISOString();

const existingLexiconText = readFileSync(lexiconPath, "utf8");
const lexiconRows = existingLexiconText.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const counters = new Map();
for (const row of lexiconRows) {
  if (!row.candidate) continue;
  const key = row.candidate.toLowerCase();
  counters.set(key, Math.max(counters.get(key) ?? 0, row.suppressionCounter ?? 0));
}
const firstTwoSentences = (fallback.text.match(/[^.!?]+[.!?]?/g) ?? []).slice(0, 2).join(" ").trim();
const tokens = firstTwoSentences.toLowerCase().match(/[a-z0-9#-]+/g) ?? [];
const candidates = [...new Set([...tokens, ...tokens.slice(0, -1).map((token, index) => `${token} ${tokens[index + 1]}`)])];
const eventBase = `batch-392|scene-1588|successor-g-fallback-surface|${fallback.sha256}|${observedAtUtc}`;
const appended = [{
  schemaVersion: 1,
  eventId: sha256(`${eventBase}|terminal-refusal`).toLowerCase(),
  eventType: "meta-ai-terminal-fallback-refusal",
  observedAtUtc,
  batch: 392,
  scene: 1588,
  attempt: "successor-g-fallback-surface",
  blockedPromptId: fallback.sha256.toLowerCase(),
  primaryPromptPath: primary.path,
  primaryPromptSha256: primary.sha256,
  primaryExactPromptText: primary.text,
  primaryRefusalText: primaryRefusal,
  fallbackPromptPath: fallback.path,
  fallbackPromptSha256: fallback.sha256,
  fallbackExactPromptText: fallback.text,
  refusalText: fallbackRefusal,
  rawProvenance: "no-media-emitted",
  immutable: true,
}];
for (const candidate of candidates) {
  const suppressionCounter = (counters.get(candidate) ?? 0) + 1;
  counters.set(candidate, suppressionCounter);
  appended.push({
    schemaVersion: 1,
    eventId: sha256(`${eventBase}|candidate|${candidate}`).toLowerCase(),
    eventType: "meta-ai-refusal-token-candidate",
    observedAtUtc,
    batch: 392,
    scene: 1588,
    attempt: "successor-g-fallback-surface",
    blockedPromptId: fallback.sha256.toLowerCase(),
    candidate,
    refusalText: fallbackRefusal,
    suppressionCounter,
    blacklisted: suppressionCounter >= 3,
  });
}
writeFileSync(lexiconPath, `${existingLexiconText.trimEnd()}\n${appended.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
const blacklistSnapshotSha256 = sha256(readFileSync(lexiconPath));

const checkpoint = JSON.parse(readFileSync(checkpointPath, "utf8"));
checkpoint.metaDispatches ??= [];
checkpoint.events ??= [];
checkpoint.rejectedPromptLedger ??= { entries: [] };
checkpoint.rejectedPromptLedger.entries ??= [];
addUnique(checkpoint.metaDispatches, "eventId", {
  eventId: "batch-392-scene-1588-successor-g-fallback-surface-reference-dispatched",
  batch: 392,
  scene: 1588,
  provider: "Meta AI",
  phase: "successor-g-fallback-surface",
  sentAtUtc: "2026-08-20T13:13:22.008Z",
  immediateResponseObservedAtUtc: "2026-08-20T13:13:22.100Z",
  prompt: fallback,
  primaryPrompt: primary,
  blacklistSnapshotSha256,
  referenceImageShas: sourceImageShas,
  referenceUploadOrder: [938, 936, 937],
  referenceTransferState: "transferred-and-visible-in-composer-before-send",
  immediateResponseText: "I'm clarifying the user's visual goal and organizing the subject, style, composition, and format into a clear",
  responseClassification: "provider-refusal-terminal",
  finalResponseText: fallbackRefusal,
  rawState: "no-bytes-terminal",
  immutable: true,
});
addUnique(checkpoint.events, "eventId", {
  eventId: "batch-392-scene-1588-successor-g-fallback-surface-terminal-refusal",
  batch: 392,
  scene: 1588,
  provider: "Meta AI",
  phase: "successor-g-fallback-surface",
  observedAtUtc,
  promptSha256: fallback.sha256,
  referenceImageShas: sourceImageShas,
  responseText: fallbackRefusal,
  refusalText: fallbackRefusal,
  raw: { state: "no-bytes", path: null, sha256: null, bytes: 0 },
  qaDisposition: "provider-refusal-candidate-fallback-cap-exhausted",
  immutable: true,
});
addUnique(checkpoint.rejectedPromptLedger.entries, "entryId", {
  entryId: "batch-392-scene-1588-meta-ai-successor-g-fallback-surface-refusal",
  batch: 392,
  scene: 1588,
  phase: "successor-g-fallback-surface",
  status: "provider-refusal-no-bytes-candidate-cap-exhausted",
  provider: "Meta AI",
  occurredAt: observedAtUtc,
  sentAtUtc: "2026-08-20T13:13:22.008Z",
  prompt: fallback,
  primaryPrompt: primary,
  blacklistSnapshotSha256,
  faceReferenceTransfer: { state: "transferred-and-visible-before-dispatch", referencesTransferred: true, sourceImageShas },
  responseText: fallbackRefusal,
  refusalText: fallbackRefusal,
  rawOutput: { state: "no-bytes", path: null, sha256: null, bytes: 0 },
  qaDisposition: "provider-refusal-candidate-fallback-cap-exhausted",
  rejectionReason: "Meta AI refused the single fallback because the open-ground lap seating remained incompatible. Candidate G is capped. The provider suggested a standing close group for a later independently prepared candidate after archive and remote parity.",
  finalSelectedSha256: null,
  immutable: true,
});
checkpoint.status = "active-continuous-meta-scene-1588-successor-g-cap-exhausted-awaiting-archive-and-remote-parity";
checkpoint.activeMetaLanes.candidateInFlight = "none; successor-G primary plus fallback both refused with no media";
checkpoint.activeMetaLanes.candidateUnderInspection = "scene 1588 successor-G terminal refusal evidence complete";
checkpoint.activeMetaLanes.candidateNPlus2Gate = "closed until successor-G refusal evidence is archived and remotely verified";
checkpoint.rollingState.recordedAt = observedAtUtc;
checkpoint.rollingState.nextCandidateInFlight = "none until candidate-G refusal evidence reaches remote parity";
checkpoint.rollingState.candidateNPlus2Gate = "closed pending ledger, archive, commit, explicit push and remote verification";
writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ observedAtUtc, primarySha256: primary.sha256, fallbackSha256: fallback.sha256, appendedLexiconRows: appended.length, blacklistSnapshotSha256, blacklistCount: [...counters.values()].filter((count) => count >= 3).length }, null, 2));
