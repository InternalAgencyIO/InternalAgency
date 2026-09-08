import fs from "node:fs";
import path from "node:path";

const campaignPath = path.resolve("assets/lore/starlight-era/world-195x4-campaign.json");
const scenePlanPath = path.resolve("tmp/world-195x4/batch-212/scene-plan.json");
const checkpointPath = path.resolve("tmp/world-195x4/batch-212/runtime-checkpoint.json");
const updatedAt = "2026-08-05T10:35:00.000Z";
const rejected868 = {
  scene: 868,
  attempt: 4,
  asset: "tmp/world-195x4/batch-212/foundations/868-democratic-republic-of-the-congo-kinshasa-foundation-v4.png",
  bytes: 2211014,
  sha256: "515f82fe12f7e6f204769f8b5f79688b9609475b4802c6787e4ba08ce4144936",
  reason: "Rejected: PAWS is elongated, airborne rather than standing on planted hind paws, far above baby-kitten scale, and stripe-heavy."
};
const accepted871 = {
  asset: "tmp/world-195x4/batch-212/foundations/871-democratic-republic-of-the-congo-kisangani-foundation-v4.png",
  bytes: 2351851,
  sha256: "918bc1371d7f7baa0c84c1dfb7ccd1bed8ac778a4abb7b0ff206c59df76e4c61"
};
const prompt = `Fresh independent clean foundation from the approved identity references only. Make a wide vertical full-length evening photograph from several meters away on an open Pool Malebo deck, with the flat Congo River and Kinshasa waterfront behind the subjects and a thin distant Brazzaville shore; no bridge, console, table or furniture. Exactly three clearly adult fictional women stand in one shallow spaced row, fully visible head to toe with all six separate shoes on open floor. Blonde Radiance stands at left as STAR RAZE captain, short dark-bob Ellie stands center as first officer, and dark-auburn-curled Alia stands right as cabin host. Each holds one small palm-sized glowing navigation disk above the waist; the cobalt, copper and pearl disks visibly align into one completed river route. Use distinct knee-length secure opaque evening command dresses in cobalt, deep navy and warm red with restrained gold Congo River wave seams. Radiance angles three-quarter toward camera so a fine metallic route-line seam and fixed geometric lacing remain on her fully opaque rear garment panel. Ellie has one angular wrist cuff. Alia has two separate wrist cuffs with no connector and one tailored metallic waist belt; her hands remain apart and free. At the outside edge of Radiance's left white pump, show exactly one palm-sized two-month-old female NY11 golden British Shorthair PAWS at true shoe scale. PAWS has a very compact round baby body, oversized round baby face, huge green eyes, two tiny rounded ears, four very short legs, one short tail, clean paws and plush luminous cream-honey-apricot-gold fur with subtle cinnamon-gold tipping and no dark bands. Both hind paws are firmly planted together on the floor. PAWS briefly raises both forepaws toward Radiance, but her entire upright body remains no taller than the length of Radiance's white pump and her paws reach only ankle height. Radiance looks directly down at PAWS with a warm answering smile while keeping her hands visible. Preserve three clean natural faces, readable natural hands, complete anatomy, all six unobstructed shoes, the open river location and the completed handheld route. No face decoration, extra person, second animal, readable text, logo, literal flag, official or sacred emblem, politics, real airline, weapon, watermark or transparent fabric.`;

function matchingClose(source, openIndex) {
  const open = source[openIndex];
  const close = open === "{" ? "}" : open === "[" ? "]" : null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === open) depth += 1;
    else if (char === close && --depth === 0) return index;
  }
  throw new Error(`Unclosed value at ${openIndex}`);
}

function replaceTopLevelValue(source, key, value) {
  const marker = `\n  "${key}": `;
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Missing top-level key ${key}`);
  const start = markerIndex + marker.length;
  const end = matchingClose(source, start) + 1;
  const replacement = JSON.stringify(value, null, 2).replaceAll("\n", "\n  ");
  return source.slice(0, start) + replacement + source.slice(end);
}

const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
if (checkpoint.status !== "two-accepted-two-clean-restarts-attempt-4-active") throw new Error("Unexpected checkpoint state");
checkpoint.updatedAt = updatedAt;
checkpoint.status = "three-accepted-one-clean-restart-attempt-5-active";
checkpoint.attemptLog.push({
  attempt: 4,
  stage: "two open-floor fresh clean foundations",
  outcome: "scene 871 accepted and frozen; scene 868 rejected by PAWS growth, action and coat gates",
  acceptedScenes: [871],
  rejectedScenes: [868]
});
checkpoint.rejectedCandidates.push({ ...rejected868, published: false });
const lane871 = checkpoint.lanes.find((lane) => lane.scene === 871);
lane871.status = "accepted-frozen";
lane871.lastValidStage = "clean-foundation";
lane871.lastValidAsset = accepted871.asset;
lane871.candidateAsset = accepted871.asset;
lane871.candidateBytes = accepted871.bytes;
lane871.candidateSha256 = accepted871.sha256;
lane871.acceptedBytes = accepted871.bytes;
lane871.acceptedSha256 = accepted871.sha256;
lane871.blocker = null;
lane871.nextStage = "complete";
const lane868 = checkpoint.lanes.find((lane) => lane.scene === 868);
lane868.status = "active-clean-restart-attempt-5";
lane868.attempts = 5;
lane868.blocker = rejected868.reason;
lane868.candidateAsset = rejected868.asset;
lane868.candidateBytes = rejected868.bytes;
lane868.candidateSha256 = rejected868.sha256;
lane868.safeRecoveryMethod = "Fresh independent furniture-free foundation using a wide shot and shoe-scale PAWS with both hind paws planted; rejected candidate is not an edit source.";
lane868.exactPromptAttempt5 = prompt;
lane868.nextStage = "await-clean-foundation-v5";

let campaignRaw = fs.readFileSync(campaignPath, "utf8");
const campaign = JSON.parse(campaignRaw);
const batch = campaign.plannedBatches.find((item) => item.batch === 212);
const oldBatchText = JSON.stringify(batch);
batch.status = "partial-three-accepted-one-clean-restart-attempt-5-active";
const scene871 = batch.scenes.find((scene) => scene.number === 871);
scene871.status = "foundation-accepted-frozen";
scene871.renderState.status = "foundation-accepted-frozen";
scene871.renderState.lastValidStage = "clean-foundation";
scene871.renderState.lastValidAsset = accepted871.asset;
scene871.renderState.acceptedBytes = accepted871.bytes;
scene871.renderState.acceptedSha256 = accepted871.sha256;
scene871.renderState.blocker = null;
scene871.renderState.stages.foundation = "passed";
scene871.renderState.stages.validation = "passed";
scene871.renderState.detailProgress.completed = [...scene871.renderState.foundationPlan.triggeredDetails];
scene871.renderState.detailProgress.remaining = [];
const scene868 = batch.scenes.find((scene) => scene.number === 868);
scene868.status = "clean-restart-attempt-5-active";
scene868.renderState.status = "clean-restart-attempt-5-active";
scene868.renderState.attempts = 5;
scene868.renderState.blocker = rejected868.reason;
scene868.renderState.rejectedCandidates.push({ attempt: 4, asset: rejected868.asset, bytes: rejected868.bytes, sha256: rejected868.sha256, reason: rejected868.reason });
scene868.renderState.safeRecoveryMethod = "Fresh independent furniture-free foundation using a wide shot and shoe-scale PAWS with both hind paws planted; rejected candidate is not an edit source.";
scene868.renderState.retryPrompts.push({ attempt: 5, prompt });
scene868.renderState.stages.validation = "failed-attempt-4";
campaignRaw = campaignRaw.replace(oldBatchText, JSON.stringify(batch));
campaignRaw = replaceTopLevelValue(campaignRaw, "activeRenderCheckpoint", {
  ...campaign.activeRenderCheckpoint,
  status: "three-accepted-one-clean-restart-attempt-5-active",
  updatedAt,
  acceptedFoundationCount: 3,
  acceptedFoundationHashes: [
    ...campaign.activeRenderCheckpoint.acceptedFoundationHashes,
    { number: 871, sha256: accepted871.sha256 }
  ],
  rejectedCandidates: [
    ...campaign.activeRenderCheckpoint.rejectedCandidates,
    { number: 868, attempt: 4, sha256: rejected868.sha256, reason: rejected868.reason }
  ],
  nextAction: "Scenes 869, 870 and 871 are frozen. Attempt 5 is active only for scene 868 using shoe-scale PAWS and furniture-free staging."
});
JSON.parse(campaignRaw);

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
fs.writeFileSync(scenePlanPath, `${JSON.stringify(batch, null, 2)}\n`, "utf8");
fs.writeFileSync(campaignPath, campaignRaw, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, accepted: [869, 870, 871], active: [868] }, null, 2));
