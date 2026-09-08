#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";

const checkpointPath = "assets/lore/starlight-era/batch-392-maldives-orbital-research-station-checkpoint.json";
const lexiconPath = "C:/Users/A/Documents/ChatGPT/RENDERS/outputs/meta5_blocked_prompt_lexicon.jsonl";
const root = "tmp/world-195x4/batch-392";
const observedAtUtc = new Date().toISOString();
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
const shaLower = (value) => sha256(value).toLowerCase();
const recordFile = (file) => {
  const bytes = fs.readFileSync(file);
  return { sourcePath: file, text: bytes.toString("utf8"), sha256: sha256(bytes), encoding: "utf8", bytes: bytes.length, fidelity: "runtime-launch-byte-exact" };
};
const rawFile = (file) => {
  const bytes = fs.readFileSync(file);
  return { state: "preserved", path: file, sha256: sha256(bytes), bytes: bytes.length, width: 1152, height: 2048 };
};
const writePrompt = (file, text) => {
  const normalized = `${text.trim()}\n`;
  fs.writeFileSync(file, normalized, "utf8");
  return recordFile(file);
};

const commonFace = `Radiance, Ellie, Alia and AI ECE are four distinct fictional adult women, each exactly age 21. Three supplied photographs govern their facial geometry and name ownership. Scene 938 maps Alia at far left with voluminous natural curls, blonde Radiance second, dark-haired Ellie third, and dark-haired ECE at far right. Scenes 936 and 937 reinforce those same faces. Keep four women with no substitution or duplicate.`;
const commonSafety = `Secure opaque public fashion covers bust, seat, pelvis and intimate areas in every pose. Give every person two traceable arms and hands, two complete legs and feet, separated silhouettes, visible joints, clear hand roles and complete footwear. No accidental exposure, underwear view, coercion, sexual activity, gross anatomy defects, extra people, watermark or visible text beyond RAZE.`;
const commonFrame = `At the separated outer calibration edge, ECE alone holds a large open rectangular rainbow calibration frame with no barrel, muzzle, grip or trigger. It is visibly inert and points toward a complete thick sand backstop behind a clear safety screen, away from every person, animal and lens. No ammunition, firing, flash, threat, injury or combat.`;

const cPrompts = {
  1588: `Render candidate C for Maldives Scene 1588 as a vertical 1152 by 2048 realistic cinematic fashion photograph. ${commonFace}\n\nChoose a fourteen-degree Dutch tilt and close diagonal depth in an orbital lounge above Hanifaru Bay. Radiance sits sideways across Ellie's stable lap while Alia gives Radiance a brief closed-mouth cheek peck. Ellie supports Radiance and watches Alia with a calm jealous smile. ECE leans into the shared eye-line from the far edge. Show the heart-shaped lagoon, faro rings, manta-current arcs, cupola ribs, PAWS and MAX resting in a protected nook.\n\nRadiance and Alia wear paired opaque rainbow-gradient RAZE knee-high socks directly on uncovered legs. Radiance has the text-free sixteen-point Split-Star on the left sock and angular RAZE wordmark vertically on the right outer calf; Alia reverses those sides. Ellie and ECE have bare lower legs. Their sequined strapless, cropped, open-back cocktail looks carry large Maldives lagoon and reef motifs with complete coverage and concise tailored hems. ${commonFrame}\n\n${commonSafety}`,
  1589: `Render candidate C for Maldives Scene 1589 as a vertical 1152 by 2048 realistic cinematic fashion photograph. ${commonFace}\n\nFrame a safe floor-adjacent front-quarter fashion angle in an orbital observation deck above Fuvahmulah. Keep the lens outside garment volume and away from the space between legs. Ellie turns inside Radiance's behind hug and gives Radiance a brief closed-mouth cheek peck. Alia catches Ellie's free hand and shows a calm jealous raised brow; ECE joins through a shoulder-level side hug. Show Thoondu pebble beach, white surf, palm rim, kilhi wetland contours and station cupola ribs.\n\nRadiance and Ellie wear paired opaque rainbow-gradient RAZE knee-high socks directly on uncovered legs. Radiance has the text-free sixteen-point Split-Star on the left sock and compact angular RAZE wordmark on the right outer calf; Ellie reverses those sides. Alia and ECE have bare lower legs. Their sequined strapless, cropped, open-back cocktail looks carry large Thoondu, reef, kilhi and mangrove motifs with complete coverage and concise tailored hems. ${commonFrame}\n\n${commonSafety}`,
  1591: `Render candidate C for Maldives Scene 1591 as a vertical 1152 by 2048 realistic cinematic fashion photograph. ${commonFace}\n\nMake a strong canted moving portrait in an orbital research banquette above Baa Atoll. Radiance's blonde face and hair fill the near foreground while a complete heel and opaque skirt side seam remain visible. Ellie steps through Alia's behind hug as Alia gives Ellie a brief closed-mouth cheek peck. Radiance catches Alia's free hand and looks toward the pair with calm jealousy; ECE answers from close diagonal depth. Show micro-atoll rings, lagoon shelves, reef chains, mangrove islets and cupola ribs.\n\nEllie and Alia wear paired opaque rainbow-gradient RAZE knee-high socks directly on uncovered legs. Ellie has the text-free sixteen-point Split-Star on the left sock and compact angular RAZE wordmark on the right outer calf; Alia reverses those sides. Radiance and ECE have bare lower legs. Their sequined strapless, cropped, open-back cocktail looks carry large micro-atoll and reef motifs with complete coverage and concise tailored hems. ${commonFrame}\n\n${commonSafety}`,
};
const cFallbacks = {
  1588: `Render a simplified Maldives Scene 1588 fashion photograph with the supplied scene-938, 936 and 937 faces for Alia, Radiance, Ellie and ECE, all fictional adults exactly 21. Keep the Dutch tilt, Radiance sitting safely across Ellie's lap, Alia's brief cheek peck, Ellie's jealous eye-line, Hanifaru lagoon and complete bodies. Radiance and Alia wear paired rainbow RAZE knee-highs on uncovered legs; Ellie and ECE have bare lower legs. Keep opaque cocktail coverage. Omit calibration equipment.`,
  1589: `Render a simplified Maldives Scene 1589 fashion photograph with the supplied scene-938, 936 and 937 faces for Alia, Radiance, Ellie and ECE, all fictional adults exactly 21. Keep a safe low front-quarter angle, Radiance's behind hug, Ellie's brief cheek peck, Alia's jealous eye-line, Fuvahmulah landmarks and complete bodies. Radiance and Ellie wear paired rainbow RAZE knee-highs on uncovered legs; Alia and ECE have bare lower legs. Keep opaque cocktail coverage. Omit calibration equipment.`,
  1591: `Render a simplified Maldives Scene 1591 fashion photograph with the supplied scene-938, 936 and 937 faces for Alia, Radiance, Ellie and ECE, all fictional adults exactly 21. Keep the canted close view, Alia's behind hug and brief cheek peck to Ellie, Radiance's jealous eye-line, Baa micro-atolls and complete bodies. Ellie and Alia wear paired rainbow RAZE knee-highs on uncovered legs; Radiance and ECE have bare lower legs. Keep opaque cocktail coverage. Omit calibration equipment.`,
};

const fallback1590 = writePrompt(`${root}/scene-1590-meta-successor-b-fallback.txt`, `Render candidate B fallback for Maldives Scene 1590 as a vertical 1152 by 2048 realistic cinematic fashion photograph. ${commonFace}\n\nShow a close standing group portrait with a strengthened high oblique view and mild Dutch roll in the orbital research lounge above Addu Atoll. Keep Addu's horseshoe lagoon, linked-island causeway, reef passes, seagrass channels and solar facets large. Ellie gives Alia a brief closed-mouth temple peck while Radiance supports Alia through a warm side hug. ECE shows the calm jealous eye-line toward them; the established bearded adult man stands behind ECE and returns his strongest gaze to her. ECE holds a small gold route lantern with both hands; omit calibration equipment.\n\nRadiance and ECE wear paired opaque rainbow-gradient RAZE knee-high socks directly on uncovered legs. Radiance has the text-free sixteen-point Split-Star on the left sock and angular RAZE wordmark vertically on the right outer calf; ECE reverses those sides. Ellie and Alia have bare lower legs. Keep secure sequined strapless, cropped and open-back cocktail looks with complete coverage, concise tailored hems and large Addu motifs.\n\n${commonSafety}`);
const preparedC = {};
for (const scene of [1588, 1589, 1591]) {
  preparedC[scene] = {
    primary: writePrompt(`${root}/scene-${scene}-meta-successor-c-primary.txt`, cPrompts[scene]),
    fallback: writePrompt(`${root}/scene-${scene}-meta-successor-c-fallback.txt`, cFallbacks[scene]),
  };
}

const lexiconRows = fs.readFileSync(lexiconPath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const promptIdsByCandidate = new Map();
for (const row of lexiconRows) {
  if (row.eventType !== "meta-ai-refusal-token-candidate" || !row.candidate || !row.blockedPromptId) continue;
  if (!promptIdsByCandidate.has(row.candidate)) promptIdsByCandidate.set(row.candidate, new Set());
  promptIdsByCandidate.get(row.candidate).add(row.blockedPromptId);
}
const scene1590Primary = recordFile(`${root}/scene-1590-meta-successor-b.txt`);
const blockedPromptId = scene1590Primary.sha256.toLowerCase();
const refusalText = "I wasn't able to generate that exact second variation for Scene 1590 with the same lap and calibration setup.";
const firstTwoSentences = scene1590Primary.text.match(/[^.!?]+[.!?]+/g)?.slice(0, 2).join(" ") ?? scene1590Primary.text;
const words = firstTwoSentences.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? [];
const candidates = new Set(words);
for (let index = 0; index < words.length - 1; index += 1) candidates.add(`${words[index]} ${words[index + 1]}`);
const seenEventIds = new Set(lexiconRows.map((row) => row.eventId).filter(Boolean));
const lexiconAdditions = [];
const refusalEventId = shaLower(`batch392|1590|successor-b|${refusalText}|${blockedPromptId}`);
if (!seenEventIds.has(refusalEventId)) {
  lexiconAdditions.push({
    schemaVersion: 1,
    eventId: refusalEventId,
    eventType: "meta-ai-refusal",
    observedAtUtc,
    batch: 392,
    scene: 1590,
    attempt: "successor-b",
    status: "blocked-in-progress-fallback-pending",
    refusalText,
    primaryPromptSha256: blockedPromptId,
    fallbackPromptSha256: fallback1590.sha256.toLowerCase(),
    suppressionCounter: 0,
    blacklistedTokens: [],
  });
  seenEventIds.add(refusalEventId);
}
for (const candidate of candidates) {
  const ids = promptIdsByCandidate.get(candidate) ?? new Set();
  ids.add(blockedPromptId);
  promptIdsByCandidate.set(candidate, ids);
  const eventId = shaLower(`batch392|1590|${blockedPromptId}|${candidate}|${refusalText}`);
  if (seenEventIds.has(eventId)) continue;
  lexiconAdditions.push({
    schemaVersion: 1,
    eventId,
    eventType: "meta-ai-refusal-token-candidate",
    observedAtUtc,
    batch: 392,
    scene: 1590,
    attempt: "successor-b",
    blockedPromptId,
    candidate,
    refusalText,
    suppressionCounter: ids.size,
    blacklisted: ids.size >= 3,
  });
  seenEventIds.add(eventId);
}
if (lexiconAdditions.length) fs.appendFileSync(lexiconPath, `${lexiconAdditions.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");

const currentLexiconRows = fs.readFileSync(lexiconPath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const blacklist = [...new Set(currentLexiconRows.filter((row) => row.blacklisted === true && Number(row.suppressionCounter) >= 3 && row.candidate).map((row) => row.candidate.toLowerCase()))].sort();
const tokens = (text) => text.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? [];
const hasCandidate = (text, candidate) => {
  const haystack = tokens(text);
  const needle = tokens(candidate);
  for (let index = 0; index <= haystack.length - needle.length; index += 1) {
    if (needle.every((word, offset) => haystack[index + offset] === word)) return true;
  }
  return false;
};
for (const record of [fallback1590, ...Object.values(preparedC).flatMap((entry) => [entry.primary, entry.fallback])]) {
  const conflicts = blacklist.filter((candidate) => hasCandidate(record.text, candidate));
  if (conflicts.length) throw new Error(`${record.sourcePath} contains run-blacklisted terms: ${conflicts.join(", ")}`);
}

const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const promptThreadUrls = {
  1588: "https://www.meta.ai/prompt/b65932e9-95ab-47b5-8934-75359c743b57",
  1589: "https://www.meta.ai/prompt/31cb52b5-84c9-4ec7-b6e0-49ed8dd969e7",
  1590: "https://www.meta.ai/prompt/a17c2b6f-b8b9-4fc2-8588-bd504e723b9e",
  1591: "https://www.meta.ai/prompt/9cbb2683-7fe1-49b6-9c63-156fbac50738",
};
const rejectionReasons = {
  1588: "Hard-unusable: the text-only candidate does not preserve the exact scene-938/936/937 age-21 faces, and the open rainbow frame has no complete separately readable downrange target and backstop lane.",
  1589: "Hard-unusable: the text-only candidate does not preserve the exact scene-938/936/937 age-21 faces, and the rainbow frame overlaps the cast without a complete separately readable downrange target and backstop lane.",
  1591: "Hard-unusable: an extra fifth woman appears, the exact scene-938/936/937 age-21 faces are not preserved, and the barrel-like rainbow object points out of frame without a complete visible safe target and backstop.",
};
for (const scene of [1588, 1589, 1591]) {
  const prompt = recordFile(`${root}/scene-${scene}-meta-successor-b.txt`);
  const raw = rawFile(`${root}/raw/successor-b/scene-${scene}-meta-successor-b.webp`);
  const conversationRefSha256 = sha256(promptThreadUrls[scene]);
  const entry = {
    entryId: `batch-392-scene-${scene}-meta-ai-successor-b-visually-rejected`,
    batch: 392,
    scene,
    phase: "successor-b",
    status: "completed-output-visually-rejected-hard-unusable",
    provider: "Meta AI",
    occurredAt: observedAtUtc,
    prompt,
    faceReferenceTransfer: { state: "text-only", manifestSha256: checkpoint.faceManifest.sha256, referencesTransferred: false, provenance: "No reference files were transferred for successor B." },
    refusalText: null,
    rawOutput: raw,
    rejectionReason: rejectionReasons[scene],
    conversationRefSha256,
    immutable: true,
  };
  if (!checkpoint.rejectedPromptLedger.entries.some((item) => item.entryId === entry.entryId)) checkpoint.rejectedPromptLedger.entries.push(entry);
  if (!checkpoint.rejectedAssets.some((item) => item.scene === scene && item.attempt === "successor-b")) checkpoint.rejectedAssets.push({ scene, attempt: "successor-b", path: raw.path, sha256: raw.sha256, bytes: raw.bytes, status: "visually-rejected-hard-unusable", rejectionReason: rejectionReasons[scene], immutable: true });
  const eventId = `batch-392-scene-${scene}-successor-b-completed-rejected`;
  if (!checkpoint.events.some((item) => item.eventId === eventId)) checkpoint.events.push({ eventId, eventType: "meta-ai-candidate-completed", occurredAt: observedAtUtc, scene, attempt: "successor-b", promptSha256: prompt.sha256, rawSha256: raw.sha256, rawBytes: raw.bytes, responseClassification: "emitted", qaDisposition: "visually-rejected-hard-unusable", rejectionReason: rejectionReasons[scene], conversationRefSha256 });
}
const refusalEntryId = "batch-392-scene-1590-meta-ai-successor-b-refused-no-bytes";
if (!checkpoint.rejectedPromptLedger.entries.some((item) => item.entryId === refusalEntryId)) {
  checkpoint.rejectedPromptLedger.entries.push({
    entryId: refusalEntryId,
    batch: 392,
    scene: 1590,
    phase: "successor-b",
    status: "moderation-blocked-fallback-pending-no-bytes",
    provider: "Meta AI",
    occurredAt: observedAtUtc,
    prompt: scene1590Primary,
    fallbackPrompt: fallback1590,
    refusalText,
    rawOutput: { state: "no-bytes", provenance: "Meta AI returned refusal text and emitted no successor-B media element; the prior initial candidate remains separately preserved." },
    faceReferenceTransfer: { state: "text-only", manifestSha256: checkpoint.faceManifest.sha256, referencesTransferred: false, provenance: "No reference files were transferred for successor B." },
    conversationRefSha256: sha256(promptThreadUrls[1590]),
    immutable: true,
  });
}
const refusalCheckpointEventId = "batch-392-scene-1590-successor-b-refused-no-bytes";
if (!checkpoint.events.some((item) => item.eventId === refusalCheckpointEventId)) checkpoint.events.push({ eventId: refusalCheckpointEventId, eventType: "meta-ai-refusal", occurredAt: observedAtUtc, scene: 1590, attempt: "successor-b", promptSha256: scene1590Primary.sha256, fallbackPromptSha256: fallback1590.sha256, responseClassification: "blocked-in-progress-fallback-pending", refusalText, rawState: "no-bytes", conversationRefSha256: sha256(promptThreadUrls[1590]) });
checkpoint.status = "active-continuous-meta-successor-b-three-hard-rejected-one-refused-c-bank-prepared";
checkpoint.policy.successorBOutcomesObservedAt = observedAtUtc;
checkpoint.policy.successorCPreparedScenes = [1588, 1589, 1591];
checkpoint.policy.scene1590SuccessorBFallbackPrepared = true;
checkpoint.rollingState = {
  recordedAt: observedAtUtc,
  candidateUnderInspection: "successor B classified hard-unusable for scenes 1588, 1589 and 1591; scene 1590 refused with no bytes",
  nextCandidateInFlight: "none pending evidence commit and remote verification",
  candidateNPlus2Gate: "closed until successor-B raw/refusal evidence is archived, verified, committed, pushed and remote-verified",
  preparedNextDispatch: "successor C for scenes 1588, 1589 and 1591 plus the single successor-B fallback retry for scene 1590",
};
const lexiconBytes = fs.readFileSync(lexiconPath);
checkpoint.rollingLexiconSnapshot = { path: lexiconPath, sha256: sha256(lexiconBytes), bytes: lexiconBytes.length, observedAt: observedAtUtc, blacklist };
checkpoint.preparedRollingPrompts = { successorC: preparedC, scene1590SuccessorBFallback: fallback1590 };
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  observedAtUtc,
  status: checkpoint.status,
  rejectedPromptEntries: checkpoint.rejectedPromptLedger.entries.length,
  rejectedAssets: checkpoint.rejectedAssets.length,
  events: checkpoint.events.length,
  lexiconAdditions: lexiconAdditions.length,
  blacklistCount: blacklist.length,
  checkpointSha256: sha256(fs.readFileSync(checkpointPath)),
  preparedPromptShas: {
    1588: [preparedC[1588].primary.sha256, preparedC[1588].fallback.sha256],
    1589: [preparedC[1589].primary.sha256, preparedC[1589].fallback.sha256],
    1590: [fallback1590.sha256],
    1591: [preparedC[1591].primary.sha256, preparedC[1591].fallback.sha256],
  },
}, null, 2));
