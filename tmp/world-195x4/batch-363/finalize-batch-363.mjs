import fs from "node:fs";
import path from "node:path";

const repo = "C:/Users/A/Documents/Codex/2026-07-27/hatch-pet-c-users-a-codex/InternalAgency";
const batchDir = path.join(repo, "tmp/world-195x4/batch-363");
const loreDir = path.join(repo, "assets/lore/starlight-era");
const assets = [
  { scene: 1472, raw: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-04ed957b-7de2-4c2a-a9a2-1b25dc9b2719.png", file: "1472-bolivia-la-paz-illimani-lunar-habitat-fast-pass.png", audit: "Accepted fast-pass. Exactly four adult women appear against a recognizable La Paz basin, cable-car network and Illimani skyline with large fictional lunar hardware. The four outfits have visibly different tunic-shorts, trousers, fan skirt and crescent-romper constructions. ECE alone holds the inert rainbow cinema-training prop down and away from all people. Logged deviations: romance resolves as linked hands and close rival eye lines instead of the complete controlled dip, the visible target board is not aligned with the lowered prop, and the two mascots render as small dogs rather than PAWS the kitten and MAX the golden retriever pup." },
  { scene: 1473, raw: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-82a25078-c9ad-4f08-9a67-4f035349ecba.png", file: "1473-bolivia-salar-uyuni-lunar-lander-fast-pass.png", audit: "Accepted fast-pass. Exactly five adults appear on the recognizable Salar de Uyuni polygon plain under the rolled mammatus ceiling, with the established male added without replacing a woman. The four women wear distinct spiral skirt, crystal dress, balloon-trouser and articulated-short constructions. ECE alone maintains a stable two-hand grip toward a clearly empty route marker, with no person or camera in the line. The male keeps his fitted short-sleeve top, black jeans and strongest eye line toward ECE. Logged deviation: the close partner dance resolves as a restrained linked-hand affection chain." },
  { scene: 1474, raw: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-41c63aed-bf9e-4cb2-bef7-9eb3f8cf9331.png", file: "1474-bolivia-titicaca-lunar-crater-habitat-fast-pass.png", audit: "Accepted fast-pass. Exactly four adult women appear with Lake Titicaca, layered islands and mountain ridges sharing the foreground with a fictional lunar geology deck. Distinct jumpsuit, pannier dress, foil skirt and high-low shield silhouettes are visible. The adult romance reads through a waist hold, cheek kiss and open-hand invitation. ECE alone uses a two-hand grip and directs the inert rainbow cinema-training prop into empty off-group space. Logged deviations: the empty water marker is outside the visible crop, the seated-embrace beat resolves standing, and PAWS plus MAX render as two small dogs rather than the specified kitten and golden retriever pup." },
  { scene: 1475, raw: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-da82814d-47c4-4817-8a46-f0935b142154.png", file: "1475-bolivia-sucre-lunar-observatory-fast-pass.png", audit: "Accepted fast-pass. Exactly four adult women appear on a recognizable Sucre rooftop with the white city, red roofs and layered hills fused with fictional lunar observatory architecture. The quartet uses visibly distinct trouser, dome-dress, peplum-skirt and culotte constructions. The three-person pursuit reads through two separate forearm catches and a protective shoulder contact. ECE alone directs the inert rainbow cinema-training prop toward the clearly empty paper silhouette target and complete backstop, away from every person and camera." },
];

const checkpoint = JSON.parse(fs.readFileSync(path.join(batchDir, "batch-363-bolivia-preflight.json"), "utf8"));
for (const asset of assets) fs.copyFileSync(asset.raw, path.join(loreDir, asset.file));

checkpoint.status = "terminal-accepted";
checkpoint.renderAttempts = {
  raw: { status: "complete", requested: 4, fulfilled: 4, moderationBlocked: 0, concurrency: "four independent built-in image generation calls launched together with settled-result collection" },
  recovery: { status: "not-used", reason: "All four delivered outputs passed the fast-pass hard safety and core-cast gates." },
};
checkpoint.acceptedAssets = assets.map(({ scene, file, audit }) => ({ scene, file, audit }));
checkpoint.rejectedAssets = [];
checkpoint.xPost = {
  status: "eligible-awaiting-signed-in-browser-confirmation",
  minimumCurrentCountryAcceptedAssets: 2,
  currentCountryAcceptedAssets: 4,
  caption: "Bolivia red-heart Burundi #Bolivia #InternalAgency",
  plannedAttachments: [assets[0].file, assets[1].file, "1468-burundi-bujumbura-tanganyika-mars-habitat-fast-pass.png"],
  reason: "Bolivia has sufficient accepted assets. The exact composer may be prepared after the git push; final browser publication remains serialized and confirmation-gated.",
};
checkpoint.completedAt = new Date().toISOString();
checkpoint.throughputMode = "fast-pass per explicit user direction; minor choreography, target-visibility and mascot deviations are accepted and logged while hard safety and core-cast failures remain rejecting";
checkpoint.queueAdvance = { country: "Tunisia", batch: 364, scenes: [1476, 1477, 1478, 1479], cinematicTheme: "Moon-surface expedition couture", batchOrdinalWithinTheme: 2 };

fs.writeFileSync(path.join(loreDir, "batch-363-bolivia-moon-expedition-checkpoint.json"), `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: checkpoint.status, accepted: checkpoint.acceptedAssets.length, xPost: checkpoint.xPost.status, next: checkpoint.queueAdvance }));
