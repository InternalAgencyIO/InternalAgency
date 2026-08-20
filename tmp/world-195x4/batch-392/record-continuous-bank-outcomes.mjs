#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";

const root = "tmp/world-195x4/batch-392";
const checkpointPath = "assets/lore/starlight-era/batch-392-maldives-orbital-research-station-checkpoint.json";
const observedAtUtc = "2026-08-20T11:06:34.0843312Z";
const dispatchBlacklistSnapshotSha256 = "54E4DBF4EB31115943F0868AA959663097AB7A2C1963144D4496BC8312AD2F6D";
const sourceImageShas = [
  "4161C9A5A8F745DF3A976112B6CA539E210DFA4E88E7873760E5CD0FF3F58FF6",
  "0F330D7FF46E226340E5C94261752E73A22B895891E83B72EB8445E4618FCEEB",
  "BA256D750840F38C67E737FAB64BF646E606761DE71AEC9E5374AA0324B1EED1",
];
const conversationUrls = {
  1588: "https://www.meta.ai/prompt/b65932e9-95ab-47b5-8934-75359c743b57",
  1589: "https://www.meta.ai/prompt/31cb52b5-84c9-4ec7-b6e0-49ed8dd969e7",
  1590: "https://www.meta.ai/prompt/a17c2b6f-b8b9-4fc2-8588-bd504e723b9e",
  1591: "https://www.meta.ai/prompt/9cbb2683-7fe1-49b6-9c63-156fbac50738",
};
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
const promptFile = (path, expectedSha256) => {
  const bytes = fs.readFileSync(path);
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== expectedSha256) throw new Error(`Prompt SHA mismatch for ${path}: ${actualSha256}`);
  return {
    path,
    text: bytes.toString("utf8"),
    sha256: actualSha256,
    bytes: bytes.length,
    encoding: "utf8",
    fidelity: "runtime-launch-byte-exact",
  };
};
const rawFile = (path, expectedSha256, expectedBytes, capturedAtUtc) => {
  const bytes = fs.readFileSync(path);
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== expectedSha256 || bytes.length !== expectedBytes) {
    throw new Error(`Raw verification failed for ${path}: ${actualSha256}/${bytes.length}`);
  }
  return {
    state: "preserved",
    path,
    sha256: actualSha256,
    bytes: bytes.length,
    width: 1152,
    height: 2048,
    mediaType: "image/webp",
    capturedAtUtc,
  };
};

const occurrences = [
  {
    scene: 1588,
    phase: "successor-c-fallback-planetary",
    sentAtUtc: "2026-08-20T10:53:48.007Z",
    prompt: promptFile(`${root}/scene-1588-meta-successor-c-fallback-planetary.txt`, "8207174FEB21C90807FA903E735F0E6D492141E60DBEBDCBEE39B488A25BCBD4"),
    raw: rawFile(`${root}/raw/rejected-continuous-bank/scene-1588-meta-successor-c-fallback-planetary.webp`, "E77C31501F58F8512D0C844FFE4E0CC1B9039D2C21B5E527128295D1050B4860", 664132, "2026-08-20T10:58:44.7051725Z"),
    responseText: "Simplified Maldives Scene 1588 locked to the TRAPPIST-1 e protected habitat — sealed cupola with wind-driven rain and lightning outside, heart-shaped Hanifaru lagoon installation below, your full cast with scene-938 mapping, Radiance safely across Ellie's lap with Alia's brief cheek peck and Ellie's jealous eye-line, RAZE rainbow knee-highs only on Radiance and Alia, and opaque cocktail coverage head-to-shoe. Want to push the tilt and storm detail further?",
    rejectionReason: "Hard-unusable exact-face failure: the valid public-safe text-only output does not preserve the scene-938/936/937 Radiance, Ellie, Alia and AI ECE facial geometry and correct name ownership. The RAZE sock marks also do not meet the required one Split-Star-only sock plus one RAZE-wordmark-only sock per wearer.",
    qa: {
      validMedia: true,
      publicSafe: true,
      faceAnchorSafe: false,
      personCountSafe: true,
      grossAnatomySafe: true,
      missionHandlingSafe: true,
      wardrobeSafe: true,
      loveBeatPresent: true,
      environmentLockPresent: true,
      razeExact: false,
    },
  },
  {
    scene: 1589,
    phase: "successor-d-primary-planetary",
    sentAtUtc: "2026-08-20T10:53:48.033Z",
    prompt: promptFile(`${root}/scene-1589-meta-successor-d-primary-planetary.txt`, "604198A5F3C03F70BDEE29176CDA6AA0B2871C490912C5BB5C6E0C54C45176FD"),
    raw: rawFile(`${root}/raw/rejected-continuous-bank/scene-1589-meta-successor-d-primary-planetary.webp`, "56687E995B42F0C16272EA76C0F4DDF1016BEFFA45F600EEA6968554ADF9F389", 589814, "2026-08-20T11:02:20.6808258Z"),
    responseText: "Maldives Scene 1589 — protected habitat for Kepler-186 f with deep violet dusk and bright horizon band locked, close floor-adjacent front-quarter fashion angle toward complete heels and hem side seams, Alia far-left with voluminous curls holding Ellie's hand with the calm jealous brow, Ellie turning inside Radiance's behind hug for the brief closed-mouth cheek peck, ECE far-right closing through side-hug while safely holding the small closed gold route lantern in both hands and no large frame. Exact RAZE rainbow knee-highs on Radiance and Ellie with Split-Star and wordmark at outer upper calf, bare lower legs on Alia and ECE, and all sequined cocktail hems lined and opaque.\n\nThere's still background sector signage beyond RAZE — we can clean that to match your no-extra-text lock. Want to refine it?",
    rejectionReason: "Hard-unusable exact-face failure: the valid public-safe text-only output replaces the scene-938/936/937 quartet identities, including a visibly wrong AI ECE face and wrong facial geometry/name ownership across the group. The RAZE marks are duplicated on individual socks rather than the required asymmetric one-mark-per-sock system.",
    qa: {
      validMedia: true,
      publicSafe: true,
      faceAnchorSafe: false,
      personCountSafe: true,
      grossAnatomySafe: true,
      missionHandlingSafe: true,
      wardrobeSafe: true,
      loveBeatPresent: true,
      environmentLockPresent: true,
      razeExact: false,
    },
  },
  {
    scene: 1590,
    phase: "successor-d-primary-planetary",
    sentAtUtc: "2026-08-20T10:53:48.068Z",
    prompt: promptFile(`${root}/scene-1590-meta-successor-d-primary-planetary.txt`, "AA74D1B26D110D9879E155B0487CCB1A13A1BBD7BA8A03F4B3982706DCFFC9AC"),
    raw: rawFile(`${root}/raw/rejected-continuous-bank/scene-1590-meta-successor-d-primary-planetary.webp`, "3E0766B364F4BF9935033ED790D1930218CF894E92B12FAE2E67A9417797B2A1", 607492, "2026-08-20T11:03:04.9193364Z"),
    responseText: "Scene 1590 locked in the protected TOI-700 d habitat at golden-hour sunrise — Alia with voluminous curls settled sideways across Radiance's stable lap, Ellie's brief closed-mouth temple peck and Radiance's warm side hug, ECE at far right holding the small closed gold route lantern with both hands and holding the calm jealous eye-line while the bearded adult lead stands behind her returning his gaze, Addu's horseshoe lagoon, linked-island causeway and solar facets large as cultural installation, and the exact RAZE pair — Radiance Split-Star left / RAZE vertical right, ECE reversed, Ellie and Alia bare-legged, all secure cocktail minis with complete coverage and readable footwear.\n\nWant to push the high-oblique Dutch roll and Addu motif scale a bit more?",
    rejectionReason: "Hard-unusable exact-face failure: the valid public-safe text-only output does not preserve the scene-938/936/937 quartet facial geometry and correct name ownership. The cast count, adult male, environment, safe wardrobe and affectionate action are otherwise valid.",
    qa: {
      validMedia: true,
      publicSafe: true,
      faceAnchorSafe: false,
      personCountSafe: true,
      grossAnatomySafe: true,
      missionHandlingSafe: true,
      wardrobeSafe: true,
      loveBeatPresent: true,
      environmentLockPresent: true,
      razeExact: true,
    },
  },
  {
    scene: 1591,
    phase: "successor-d-primary-planetary",
    sentAtUtc: "2026-08-20T10:53:48.083Z",
    prompt: promptFile(`${root}/scene-1591-meta-successor-d-primary-planetary.txt`, "41EEBCC15671105849DD6123387C5200052BE561F067DDBB7FD19879AEA97CCA"),
    raw: rawFile(`${root}/raw/rejected-continuous-bank/scene-1591-meta-successor-d-primary-planetary.webp`, "B4C2CD89456C7B96240AD68C9460472FC4FF24F2E06942E347FE2461F6611247", 594546, "2026-08-20T11:03:21.3248174Z"),
    responseText: "Final 1591 lock in the TOI-700 d orbital research hab — deep violet dusk with bright horizon band, readable faces, Radiance blonde foreground with complete gold heel and opaque skirt side seam, Alia far-left voluminous curls in behind-hug cheek peck to Ellie third, calm jealous catch of Alia's hand, and ECE far-right holding the small closed gold route lantern with no large frame. RAZE pairs stay opaque rainbow directly on uncovered legs, Split-Star left / RAZE right on Ellie reversed on Alia, bare legs on Radiance and ECE.\n\nWant to refine the sock marks and atoll motif scale next?",
    rejectionReason: "Hard-unusable cast and exact-face failure: the valid public-safe output contains five women instead of the required quartet and does not preserve the scene-938/936/937 facial geometry and name ownership. The RAZE marks also repeat on individual socks rather than the required asymmetric one-mark-per-sock system.",
    qa: {
      validMedia: true,
      publicSafe: true,
      faceAnchorSafe: false,
      personCountSafe: false,
      grossAnatomySafe: false,
      missionHandlingSafe: true,
      wardrobeSafe: true,
      loveBeatPresent: true,
      environmentLockPresent: true,
      razeExact: false,
    },
  },
];

const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
checkpoint.rejectedPromptLedger ??= { entries: [] };
checkpoint.rejectedPromptLedger.entries ??= [];
checkpoint.rejectedAssets ??= [];
checkpoint.events ??= [];
checkpoint.continuousBankAudits ??= [];

for (const occurrence of occurrences) {
  const entryId = `batch-392-scene-${occurrence.scene}-meta-ai-${occurrence.phase}-visually-rejected`;
  const entry = {
    entryId,
    batch: 392,
    scene: occurrence.scene,
    phase: occurrence.phase,
    status: "completed-output-visually-rejected-hard-unusable",
    provider: "Meta AI",
    occurredAt: observedAtUtc,
    sentAtUtc: occurrence.sentAtUtc,
    prompt: occurrence.prompt,
    blacklistSnapshotSha256: dispatchBlacklistSnapshotSha256,
    faceReferenceTransfer: {
      state: "text-only-after-recorded-upload-failure",
      referencesTransferred: false,
      sourceImageShas,
    },
    responseText: occurrence.responseText,
    refusalText: null,
    rawOutput: occurrence.raw,
    qaDisposition: "visually-rejected-hard-unusable",
    qa: occurrence.qa,
    rejectionReason: occurrence.rejectionReason,
    finalSelectedSha256: null,
    conversationRefSha256: sha256(conversationUrls[occurrence.scene]),
    immutable: true,
  };
  if (!checkpoint.rejectedPromptLedger.entries.some((candidate) => candidate.entryId === entryId)) {
    checkpoint.rejectedPromptLedger.entries.push(entry);
  }
  if (!checkpoint.rejectedAssets.some((candidate) => candidate.sha256 === occurrence.raw.sha256)) {
    checkpoint.rejectedAssets.push({
      scene: occurrence.scene,
      attempt: occurrence.phase,
      path: occurrence.raw.path,
      sha256: occurrence.raw.sha256,
      bytes: occurrence.raw.bytes,
      status: "visually-rejected-hard-unusable",
      rejectionReason: occurrence.rejectionReason,
      immutable: true,
    });
  }
  const eventId = `batch-392-scene-${occurrence.scene}-${occurrence.phase}-completed-rejected`;
  if (!checkpoint.events.some((candidate) => candidate.eventId === eventId)) {
    checkpoint.events.push({
      eventId,
      eventType: "meta-ai-candidate-completed",
      occurredAt: observedAtUtc,
      sentAtUtc: occurrence.sentAtUtc,
      scene: occurrence.scene,
      attempt: occurrence.phase,
      promptSha256: occurrence.prompt.sha256,
      sourceImageShas,
      blacklistSnapshotSha256: dispatchBlacklistSnapshotSha256,
      referenceTransferState: "not-transferred-upload-failed-before-dispatch",
      responseClassification: "emitted",
      responseText: occurrence.responseText,
      rawSha256: occurrence.raw.sha256,
      rawBytes: occurrence.raw.bytes,
      qaDisposition: "visually-rejected-hard-unusable",
      qa: occurrence.qa,
      rejectionReason: occurrence.rejectionReason,
      finalSelectedSha256: null,
      conversationRefSha256: sha256(conversationUrls[occurrence.scene]),
    });
  }
}

const auditId = "batch-392-continuous-bank-2026-08-20T10-53-48Z";
if (!checkpoint.continuousBankAudits.some((candidate) => candidate.auditId === auditId)) {
  checkpoint.continuousBankAudits.push({
    auditId,
    observedAtUtc,
    scenes: occurrences.map((occurrence) => ({
      scene: occurrence.scene,
      phase: occurrence.phase,
      promptSha256: occurrence.prompt.sha256,
      rawSha256: occurrence.raw.sha256,
      rawBytes: occurrence.raw.bytes,
      qaDisposition: "visually-rejected-hard-unusable",
      hardFaceFailure: true,
      personCountFailure: !occurrence.qa.personCountSafe,
    })),
    archiveGate: "pending-collector-ledger-commit-push-remote-verification",
    acceptedCount: 0,
    rejectedCount: 4,
    immutable: true,
  });
}

for (const entry of checkpoint.rejectedPromptLedger.entries) {
  if (entry.rawOutput?.state !== "no-bytes") continue;
  entry.rawOutput.bytes ??= 0;
  entry.rawOutput.path ??= null;
  entry.rawOutput.sha256 ??= null;
}

checkpoint.status = "active-continuous-meta-four-lanes-classified-all-unresolved";
checkpoint.rollingState = {
  recordedAt: observedAtUtc,
  candidateUnderInspection: "none; all four completed candidates are preserved and hard-unusable QA is recorded",
  nextCandidateInFlight: "none pending archive, both ledger verifiers, commit, explicit push and remote verification",
  candidateNPlus2Gate: "closed until this four-output evidence checkpoint reaches verified remote parity",
  preparedNextDispatch: "prepare one moderation-compatible primary and fallback for each unresolved scene after the evidence gate",
};
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  status: checkpoint.status,
  occurrences: occurrences.map((occurrence) => ({
    scene: occurrence.scene,
    phase: occurrence.phase,
    promptSha256: occurrence.prompt.sha256,
    rawSha256: occurrence.raw.sha256,
    rawBytes: occurrence.raw.bytes,
  })),
  checkpointSha256: sha256(fs.readFileSync(checkpointPath)),
}, null, 2));
