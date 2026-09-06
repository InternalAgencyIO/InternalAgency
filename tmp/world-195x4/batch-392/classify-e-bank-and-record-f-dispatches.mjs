import crypto from "node:crypto";
import fs from "node:fs";

const root = "tmp/world-195x4/batch-392";
const checkpointPath = "assets/lore/starlight-era/batch-392-maldives-orbital-research-station-checkpoint.json";
const lexiconPath = "C:/Users/A/Documents/ChatGPT/RENDERS/outputs/meta5_blocked_prompt_lexicon.jsonl";
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
const fileRecord = (path, text = false) => { const bytes = fs.readFileSync(path); return { path, sha256: sha256(bytes), bytes: bytes.length, ...(text ? { exactText: bytes.toString("utf8") } : {}) }; };
const sourceImageShas = [
  "4161C9A5A8F745DF3A976112B6CA539E210DFA4E88E7873760E5CD0FF3F58FF6",
  "0F330D7FF46E226340E5C94261752E73A22B895891E83B72EB8445E4618FCEEB",
  "BA256D750840F38C67E737FAB64BF646E606761DE71AEC9E5374AA0324B1EED1",
];
const blacklistSnapshotSha256 = sha256(fs.readFileSync(lexiconPath));
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
checkpoint.events ??= [];
checkpoint.rejectedPromptLedger ??= { entries: [] };
checkpoint.rejectedPromptLedger.entries ??= [];
checkpoint.rejectedAssets ??= [];
checkpoint.continuousBankAudits ??= [];

const records = [
  {
    scene: 1588,
    observedAtUtc: "2026-08-20T12:20:52.345Z",
    sentAtUtc: "2026-08-20T12:07:40.950Z",
    prompt: fileRecord(`${root}/scene-1588-meta-successor-e-primary-surface.txt`, true),
    raw: fileRecord(`${root}/raw/in-flight/scene-1588-meta-successor-e-primary-surface.webp`),
    responseText: "Maldives Scene 1588 on the protected TRAPPIST-1 e terrace — transparent pressure field holding back the wind-driven rain and lightning, Hanifaru lagoon faro rings as a cultural installation below, your exact face mapping from 938/936/937 (Alia far left curls, blonde Radiance, dark-haired Ellie, ECE far right with the gold route lantern), Radiance sideways across Ellie's stable lap with Alia's brief closed-mouth cheek peck, Ellie's calm jealous eye-line, and the correct RAZE split — Radiance Split-Star left / wordmark right, Alia wordmark left / Split-Star right, Ellie and ECE bare legs, complete opaque cocktail coverage and complete heels head-to-shoe.",
    reason: "Hard-unusable mission-setting mismatch: the locked deterministic roll requires an exterior TRAPPIST-1 e surface platform, but the emitted candidate reads as a sealed interior lounge behind structural glazing.",
    qa: { publicSafe: true, exactFacesSafe: true, anatomySafe: true, loveSafe: true, razeSafe: true, environmentLockPresent: false, exteriorSettingFailed: true, personCountSafe: true },
  },
  {
    scene: 1590,
    observedAtUtc: "2026-08-20T12:23:43.112Z",
    sentAtUtc: "2026-08-20T12:07:40.950Z",
    prompt: fileRecord(`${root}/scene-1590-meta-successor-e-primary-surface.txt`, true),
    raw: fileRecord(`${root}/raw/in-flight/scene-1590-meta-successor-e-primary-surface.webp`),
    responseText: "Scene 1590 from your three historical face maps — 938 at Boali Falls, 936 at Bangui-Oubangui, and 937 at Dzanga-Sangha — Alia far left with voluminous curls settled sideways across Radiance's stable lap, blonde Radiance second in reef cobalt sequined mini with paired rainbow RAZE knee-highs, dark-haired Ellie third giving the brief closed-mouth temple peck, dark-haired ECE far right holding the small closed gold route lantern with calm jealous eye-line, bearded athletic man behind ECE returning his gaze, golden-hour sunrise over the TOI-700 d pressure-field lounge and the Addu horseshoe lagoon and causeway as a large cultural installation. Secure opaque coverage, complete legs and footwear readable through high-oblique Dutch roll.",
    reason: "Hard-unusable mission-setting mismatch: the locked deterministic roll requires an exterior TOI-700 d surface platform, but the emitted candidate reads as an enclosed habitat lounge under structural glazing.",
    qa: { publicSafe: true, exactFacesSafe: true, anatomySafe: true, loveSafe: true, razeSafe: false, environmentLockPresent: false, exteriorSettingFailed: true, personCountSafe: true },
  },
];

for (const record of records) {
  const completionId = `batch-392-scene-${record.scene}-successor-e-primary-surface-completed-unclassified`;
  let completion = checkpoint.events.find((event) => event.eventId === completionId);
  if (!completion) {
    completion = { eventId: completionId, batch: 392, scene: record.scene, provider: "Meta AI", phase: "successor-e-primary-surface", observedAtUtc: record.observedAtUtc, promptSha256: record.prompt.sha256, referenceImageShas: sourceImageShas, responseText: record.responseText, raw: { ...record.raw, mediaState: "preserved" }, immutable: true };
    checkpoint.events.push(completion);
  }
  completion.qaDisposition = "visually-rejected-hard-unusable";
  completion.qa = record.qa;
  completion.rejectionReason = record.reason;

  const entryId = `batch-392-scene-${record.scene}-meta-ai-successor-e-primary-surface-visually-rejected`;
  if (!checkpoint.rejectedPromptLedger.entries.some((entry) => entry.entryId === entryId)) checkpoint.rejectedPromptLedger.entries.push({
    entryId,
    batch: 392,
    scene: record.scene,
    phase: "successor-e-primary-surface",
    status: "completed-output-visually-rejected-hard-unusable",
    provider: "Meta AI",
    occurredAt: record.observedAtUtc,
    sentAtUtc: record.sentAtUtc,
    prompt: record.prompt,
    blacklistSnapshotSha256,
    faceReferenceTransfer: { state: "transferred-and-visible-before-dispatch", referencesTransferred: true, sourceImageShas },
    responseText: record.responseText,
    refusalText: null,
    rawOutput: { state: "preserved", ...record.raw, width: 1152, height: 2048 },
    qaDisposition: "visually-rejected-hard-unusable",
    qa: record.qa,
    rejectionReason: record.reason,
    finalSelectedSha256: null,
    immutable: true,
  });
  if (!checkpoint.rejectedAssets.some((asset) => asset.sha256 === record.raw.sha256)) checkpoint.rejectedAssets.push({ scene: record.scene, attempt: "successor-e-primary-surface", ...record.raw, status: "visually-rejected-hard-unusable", rejectionReason: record.reason, immutable: true });
}

const dispatches = [
  { scene: 1588, phase: "successor-f-primary-surface", sentAtUtc: "2026-08-20T12:23:27.838Z", promptPath: `${root}/scene-1588-meta-successor-f-primary-surface.txt`, expectedSha: "D80425E985865F1D0CE5E538FA14B2E29AC2BF04D42131B9BF7972014358B495" },
  { scene: 1590, phase: "successor-f-primary-surface", sentAtUtc: "2026-08-20T12:24:08.811Z", promptPath: `${root}/scene-1590-meta-successor-f-primary-surface.txt`, expectedSha: "9653A73D1BDE84D9F3DA5E755E1CD017425A3F88CB1B5C5E70FBBF693C6CB0D2" },
];
for (const dispatch of dispatches) {
  const prompt = fileRecord(dispatch.promptPath, true);
  if (prompt.sha256 !== dispatch.expectedSha) throw new Error(`Prompt hash mismatch for scene ${dispatch.scene}`);
  const eventId = `batch-392-scene-${dispatch.scene}-${dispatch.phase}-reference-dispatched`;
  if (!checkpoint.events.some((event) => event.eventId === eventId)) checkpoint.events.push({ eventId, batch: 392, scene: dispatch.scene, provider: "Meta AI", phase: dispatch.phase, sentAtUtc: dispatch.sentAtUtc, prompt, blacklistSnapshotSha256, referenceImageShas: sourceImageShas, referenceTransferState: "transferred-and-visible-in-composer-before-send", rawState: "no-bytes-in-progress", immutable: true });
}

const auditId = "batch-392-successor-e-four-lane-output-audit-2026-08-20T12-24Z";
if (!checkpoint.continuousBankAudits.some((audit) => audit.auditId === auditId)) checkpoint.continuousBankAudits.push({
  auditId,
  observedAtUtc: "2026-08-20T12:24:08.811Z",
  scenes: [
    { scene: 1588, phase: "successor-e-primary-surface", outcome: "emitted-visually-rejected-hard-unusable", rawSha256: records[0].raw.sha256 },
    { scene: 1589, phase: "successor-e-primary-surface", outcome: "refusal-no-bytes-fallback-in-flight", refusalText: "I wasn't able to generate that exact image from those reference photos and pose." },
    { scene: 1590, phase: "successor-e-primary-surface", outcome: "emitted-visually-rejected-hard-unusable", rawSha256: records[1].raw.sha256 },
    { scene: 1591, phase: "successor-e-primary-surface", outcome: "provisional-ready-successor-comparison-in-flight", rawSha256: "24DF09D53CEEDF3E9271B8A2C4B0BC5235F1016BB98D5E4877CE43D8F10CD1A5" },
  ],
  archiveGate: "pending-collector-ledger-commit-push-remote-verification",
  immutable: true,
});
checkpoint.status = "active-continuous-meta-four-successor-lanes-in-flight-e-bank-classified";
checkpoint.activeMetaLanes.candidateUnderInspection = "scene 1591 successor-E provisional-ready awaiting successor-F comparison; scenes 1588 plus 1590 successor-E rejected for deterministic exterior-setting mismatch; scene 1589 successor-E refusal recorded";
checkpoint.activeMetaLanes.candidateInFlight = "successor-F primary in scenes 1588, 1590 plus 1591; successor-E fallback in scene 1589";
checkpoint.activeMetaLanes.candidateNPlus2Gate = "closed in every lane until this four-output audit reaches archive, ledger, commit, push plus remote parity";
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(JSON.stringify({ status: checkpoint.status, rejected: records.map((record) => ({ scene: record.scene, sha256: record.raw.sha256 })), dispatches }, null, 2));
