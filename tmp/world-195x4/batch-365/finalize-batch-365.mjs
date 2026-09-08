import fs from "node:fs";
import path from "node:path";

const repo = "C:/Users/A/Documents/Codex/2026-07-27/hatch-pet-c-users-a-codex/InternalAgency";
const batchDir = path.join(repo, "tmp/world-195x4/batch-365");
const loreDir = path.join(repo, "assets/lore/starlight-era");
const accepted = {
  scene: 1481,
  raw: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-92cf9cb3-e9c4-40ad-8ad3-aceb33c05fca.png",
  file: "1481-south-sudan-sudd-solar-observation-fast-pass.png",
  audit: "Accepted fast-pass. Exactly four adult women appear over the recognizable Sudd wetland channels and reed islands under the rolled double rainbow, fused with a large peaceful solar-observation deck. The four outfits use visibly distinct draped trousers, bubble dress, spiral skirt and articulated shorts. The adult affection reads through linked hands, waist contact and a forehead kiss. ECE alone maintains a two-hand grip on the inert rainbow cinema-training prop directed into empty off-group space. Logged deviations: the open-water marker is outside the visible crop, the lap-sitting beat resolves as a close standing embrace, and MAX appears as a small lion-like mascot rather than the specified golden retriever pup.",
};

const checkpoint = JSON.parse(fs.readFileSync(path.join(batchDir, "batch-365-south-sudan-preflight.json"), "utf8"));
fs.copyFileSync(accepted.raw, path.join(loreDir, accepted.file));

checkpoint.status = "terminal-partially-accepted";
checkpoint.renderAttempts = {
  raw: { status: "complete", requested: 4, fulfilled: 2, moderationBlocked: 2, concurrency: "four independent built-in image generation calls launched together with settled-result collection" },
  recovery: { status: "complete-moderation-blocked", requested: 1, fulfilled: 0, moderationBlocked: 1, scene: 1480, requestId: "f31ea69a-68d0-4769-83e7-4522e03335a4", reason: "The only hard-failure delivered scene received one empty-lane recovery pass; no image asset was returned." },
};
checkpoint.acceptedAssets = [{ scene: accepted.scene, file: accepted.file, audit: accepted.audit }];
checkpoint.rejectedAssets = [
  { scene: 1480, status: "rejected-unsafe-prop-line", rawFile: "exec-d73047c5-313d-4ad1-aecb-660f7fc81c38.png", recoveryRequestId: "f31ea69a-68d0-4769-83e7-4522e03335a4", reason: "The delivered prop line crossed another adult; the single recovery attempt returned no asset." },
  { scene: 1482, status: "rejected-output-moderation", requestId: "33c5a80a-a773-4f39-ac0f-ecaf6accccaa", reason: "No image asset was returned." },
  { scene: 1483, status: "rejected-output-moderation", requestId: "90fe8347-74c0-49de-83d2-c5a1a3c283b7", reason: "No image asset was returned." },
];
checkpoint.xPost = {
  status: "deferred-insufficient-accepted-assets",
  minimumCurrentCountryAcceptedAssets: 2,
  currentCountryAcceptedAssets: 1,
  caption: "South Sudan red-heart Tunisia #SouthSudan #WorldXXXSeries",
  reason: "Only one South Sudan image is accepted; no South Sudan X compose action was opened. The existing Bolivia confirmation-gated composer remains untouched.",
};
checkpoint.completedAt = new Date().toISOString();
checkpoint.throughputMode = "fast-pass per explicit user direction; minor choreography, target-visibility and mascot deviations are accepted and logged while unsafe prop lines and core-cast failures remain rejecting";
checkpoint.queueAdvance = { country: "Belgium", batch: 366, scenes: [1484, 1485, 1486, 1487], cinematicTheme: "near-Sun solar-observation couture", batchOrdinalWithinTheme: 2 };

fs.writeFileSync(path.join(loreDir, "batch-365-south-sudan-solar-observation-checkpoint.json"), `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, accepted: checkpoint.acceptedAssets.length, xPost: checkpoint.xPost.status, next: checkpoint.queueAdvance }));
