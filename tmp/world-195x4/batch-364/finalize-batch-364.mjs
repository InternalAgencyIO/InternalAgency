import fs from "node:fs";
import path from "node:path";

const repo = "C:/Users/A/Documents/Codex/2026-07-27/hatch-pet-c-users-a-codex/InternalAgency";
const batchDir = path.join(repo, "tmp/world-195x4/batch-364");
const loreDir = path.join(repo, "assets/lore/starlight-era");
const assets = [
  { scene: 1477, raw: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-43386da5-1361-470e-81e6-408117580a19.png", file: "1477-tunisia-sidi-bou-said-lunar-lander-fast-pass.png", audit: "Accepted fast-pass. Exactly five adults appear against a recognizable Sidi Bou Said white-and-blue cliff village and Gulf horizon fused with a large fictional lunar lander. The four women use visibly distinct bubble dress, tailored trousers, spiral skirt and articulated shorts. The male is added without replacing a woman, wears the required fitted short-sleeve top and black jeans, and keeps his strongest eye line toward ECE. ECE alone maintains a two-hand grip on the inert rainbow cinema-training prop directed into empty off-group space. Logged deviations: the route target is outside the visible crop, the slow-dance chain resolves as a linked-hand affection line, and MAX appears as a small white dog rather than a golden retriever pup while PAWS reads as a kitten." },
  { scene: 1478, raw: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-d854782d-fc96-4e5f-9d99-a70aa0671111.png", file: "1478-tunisia-el-jem-lunar-crater-habitat-fast-pass.png", audit: "Accepted fast-pass. Exactly four adult women appear with El Jem's monumental stacked amphitheatre arcades sharing the foreground with a peaceful fictional lunar crater habitat. Distinct jumpsuit, pannier-tunic, truss coat and high-low shield silhouettes are visible. The adult affection reads through a stable seated embrace, cheek kiss, linked hands and protective face contact. ECE alone holds the inert rainbow cinema-training prop in a stable two-hand grip toward the clearly empty paper silhouette target and complete backstop. PAWS and MAX appear together, with MAX rendered as a golden retriever and PAWS as a small kitten." },
];

const checkpoint = JSON.parse(fs.readFileSync(path.join(batchDir, "batch-364-tunisia-preflight.json"), "utf8"));
for (const asset of assets) fs.copyFileSync(asset.raw, path.join(loreDir, asset.file));

checkpoint.status = "terminal-partially-accepted";
checkpoint.renderAttempts = {
  raw: { status: "complete", requested: 4, fulfilled: 2, moderationBlocked: 2, concurrency: "four independent built-in image generation calls launched together with settled-result collection" },
  recovery: { status: "not-used", reason: "Two usable fast-pass assets were preserved; throughput mode advances without retrying output-moderation blocks." },
};
checkpoint.acceptedAssets = assets.map(({ scene, file, audit }) => ({ scene, file, audit }));
checkpoint.rejectedAssets = [
  { scene: 1476, status: "rejected-output-moderation", requestId: "f4aa6e42-d7af-973a-a049-4ed7f6bddf86", reason: "No image asset was returned." },
  { scene: 1479, status: "rejected-output-moderation", requestId: "b8facc70-1162-4be4-afff-9b37f9959643", reason: "No image asset was returned." },
];
checkpoint.xPost = {
  status: "eligible-queued-behind-bolivia-confirmation",
  minimumCurrentCountryAcceptedAssets: 2,
  currentCountryAcceptedAssets: 2,
  caption: "Tunisia red-heart Bolivia #Tunisia #WorldXXXSeries",
  plannedAttachments: [assets[0].file, assets[1].file, "1472-bolivia-la-paz-illimani-lunar-habitat-fast-pass.png"],
  reason: "Tunisia is eligible, but the signed-in X composer is already holding the exact Bolivia post at its confirmation gate and must not be overwritten or duplicated.",
};
checkpoint.completedAt = new Date().toISOString();
checkpoint.throughputMode = "fast-pass per explicit user direction; minor choreography, target-visibility and mascot deviations are accepted and logged while hard safety and core-cast failures remain rejecting";
checkpoint.queueAdvance = { country: "South Sudan", batch: 365, scenes: [1480, 1481, 1482, 1483], cinematicTheme: "near-Sun solar-observation couture", batchOrdinalWithinTheme: 1 };

fs.writeFileSync(path.join(loreDir, "batch-364-tunisia-moon-expedition-checkpoint.json"), `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, accepted: checkpoint.acceptedAssets.length, xPost: checkpoint.xPost.status, next: checkpoint.queueAdvance }));
