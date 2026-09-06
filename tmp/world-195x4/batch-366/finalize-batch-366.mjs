import fs from "node:fs";
import path from "node:path";

const repo = "C:/Users/A/Documents/Codex/2026-07-27/hatch-pet-c-users-a-codex/InternalAgency";
const batchDir = path.join(repo, "tmp/world-195x4/batch-366");
const loreDir = path.join(repo, "assets/lore/starlight-era");
const assets = [
  { scene: 1484, raw: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-d3ab4816-e440-4c15-aa9c-0b31b91ba9c8.png", file: "1484-belgium-brussels-solar-observation-recovery-fast-pass.png", audit: "Accepted recovery fast-pass. Exactly four adult women appear against the complete Brussels Grand Place guildhall facades and Town Hall spire fused with peaceful solar-observation architecture. Alia alone uses a stable two-hand grip on the inert rainbow cinema-training prop toward a clearly empty marker in a cordoned water lane, with every other adult behind and left of the line. Exactly one woman wears opaque rainbow hosiery and the four outfits remain visibly distinct. Logged deviations: the controlled dip resolves as close linked-hand affection, and the chromatic telescope is partly supported by its folded stand rather than fully integrated into ECE's two-hand romance action." },
  { scene: 1487, raw: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-98e4ad90-b05d-457b-b595-a81abaa4726b.png", file: "1487-belgium-dinant-solar-observation-fast-pass.png", audit: "Accepted fast-pass. Exactly five adults appear with the Meuse bend, Dinant riverfront, bridge, church silhouette and Citadel cliff under the rolled aurora, fused with a peaceful solar-imaging deck. The four women use distinct cape dress, trouser suit, peplum skirt and thermal culotte constructions. The male is added without replacing a woman, wears the required fitted short-sleeve top and black jeans, and keeps his strongest eye line toward ECE. ECE alone directs the inert rainbow cinema-training prop into empty off-group space. Alia visibly owns the gyroscopic hard-shell suitcase. Logged deviations: the seated embrace resolves as a standing pursuit chain, the route target is outside the visible crop, and PAWS plus MAX render as two small dogs rather than the specified kitten and golden retriever pup." },
];

const checkpoint = JSON.parse(fs.readFileSync(path.join(batchDir, "batch-366-belgium-preflight.json"), "utf8"));
for (const asset of assets) fs.copyFileSync(asset.raw, path.join(loreDir, asset.file));

checkpoint.status = "terminal-partially-accepted";
checkpoint.renderAttempts = {
  raw: { status: "complete", requested: 4, fulfilled: 2, moderationBlocked: 2, concurrency: "four independent built-in image generation calls launched together with settled-result collection" },
  recovery: { status: "complete-accepted", requested: 1, fulfilled: 1, moderationBlocked: 0, scene: 1484, reason: "The only hard-failure raw output received one empty-lane recovery pass and cleared the safety gate." },
};
checkpoint.acceptedAssets = assets.map(({ scene, file, audit }) => ({ scene, file, audit }));
checkpoint.rejectedAssets = [
  { scene: 1484, status: "rejected-raw-unsafe-prop-line-recovered", rawFile: "exec-d3bb80d1-8aab-48b8-b316-d76e2c622300.png", reason: "The raw prop line crossed the group; its single recovery output was accepted instead." },
  { scene: 1485, status: "rejected-output-moderation", requestId: "abbb44b7-c023-4aeb-97dc-1be3548187b0", reason: "No image asset was returned." },
  { scene: 1486, status: "rejected-output-moderation", requestId: "0a94c1be-03e2-4a49-a3d4-a11f6e34b372", reason: "No image asset was returned." },
];
checkpoint.xPost = {
  status: "eligible-queued-behind-bolivia-confirmation",
  minimumCurrentCountryAcceptedAssets: 2,
  currentCountryAcceptedAssets: 2,
  caption: "Belgium red-heart South Sudan #Belgium",
  plannedAttachments: [assets[0].file, assets[1].file, "1481-south-sudan-sudd-solar-observation-fast-pass.png"],
  reason: "Belgium is eligible, but the signed-in X composer is already holding the exact Bolivia post at its confirmation gate and must not be overwritten or duplicated.",
};
checkpoint.completedAt = new Date().toISOString();
checkpoint.throughputMode = "fast-pass per explicit user direction; minor choreography, target-visibility, odd-prop and mascot deviations are accepted and logged while unsafe prop lines and core-cast failures remain rejecting";
checkpoint.queueAdvance = { country: "Haiti", batch: 367, scenes: [1488, 1489, 1490, 1491], cinematicTheme: "deep-sea submersible couture", batchOrdinalWithinTheme: 1 };

fs.writeFileSync(path.join(loreDir, "batch-366-belgium-solar-observation-checkpoint.json"), `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, accepted: checkpoint.acceptedAssets.length, xPost: checkpoint.xPost.status, next: checkpoint.queueAdvance }));
