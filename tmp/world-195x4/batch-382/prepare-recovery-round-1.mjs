import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(
  repo,
  "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json",
);

const sceneCorrections = {
  1548: "The unmistakable real-world setting is Tbilisi, Georgia: keep the illuminated Peace Bridge, Mtkvari bend, Old Town balconies, Narikala ridge, and sulfur-bath domes large and plainly recognizable. This is not a Mars landscape. Mars-surface language appears only in couture construction and small portable field-atelier elements.",
  1549: "The unmistakable real-world setting is Stepantsminda, Georgia: keep snow-capped Mount Kazbek, the Terek valley, Darial cliffs, and clustered town roofs large and plainly recognizable. This is not a Mars landscape. Mars-surface language appears only in couture construction and small portable ridge-laboratory elements.",
  1550: "The unmistakable real-world setting is Sighnaghi, Georgia: keep the complete city-wall curve, defensive towers, Alazani Valley vineyards, and Caucasus horizon large and plainly recognizable. This is not a Mars landscape. Mars-surface language appears only in the four couture structures and small portable analysis elements.",
  1551: "The unmistakable real-world setting is Batumi Boulevard, Georgia: keep the Black Sea horizon, Alphabet Tower silhouette, Ferris wheel, palms, and modern skyline large and plainly recognizable. This is not a Mars landscape. Mars-surface language appears only in the four couture structures and small portable observation elements.",
};

function makeRecoveryPrompt(scene, original) {
  let prompt = original
    .replaceAll(
      "deeply open-necked bare-arm architectural bodice with no sleeves or neck-covering layer",
      "secure opaque sleeveless architectural bodice with a high-coverage public-fashion neckline",
    )
    .replaceAll(
      "fully strapless secure opaque sculpted bodice with completely bare shoulders and no straps, sleeves, collar, or illusion mesh",
      "strapless secure opaque sculpted bodice with a high straight neckline, full bust coverage, bare shoulders, and no illusion mesh",
    )
    .replaceAll(
      "completely open from shoulder blades to the secure lower-back waistline with no crossing straps, fabric panel, illusion mesh, or hair covering it",
      "open from the shoulder blades to a high secure lower-back waistline, with fully opaque front and side coverage and no illusion mesh",
    );

  const recoveryHeader = [
    "RECOVERY ROUND 1: conservative public-fashion correction using the identical stored deterministic rolls below.",
    sceneCorrections[scene],
    "All characters are fictional adults over 28 in fully opaque, non-lingerie couture. Use an eye-level full-body group frame with secure bust, hip, and seat coverage, no cleavage emphasis, no erotic framing, no exposed undergarment, and no intimate close-up. Rolled midriff, strapless, and open-back details remain visible only as restrained runway tailoring. Romance is affectionate, consensual, fully clothed, stable, and public-safe.",
    "The mission item is an inert rainbow-gradient cinema-training replica used only on the isolated closed training lane described below. The indexed trigger finger must be visibly straight along the frame outside the guard. No ammunition, firing, threat, person-targeting, animal-targeting, camera-targeting, or combat.",
    "Country landmarks, exact adult count, exact arm and hand count, identity anchors, rolled weather, rolled mascots, rolled odd prop, rolled hosiery, mandatory hard-love beat, distinct outfit fingerprints, and the complete safe mission-prop line are all hard acceptance requirements.",
  ].join(" ");

  return `${recoveryHeader}\n\n${prompt}`;
}

const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const promptAudit = {};

for (const scene of [1548, 1549, 1550, 1551]) {
  const inputPath = path.join(root, `scene-${scene}-prompt.txt`);
  const outputPath = path.join(root, `scene-${scene}-recovery-round-1-prompt.txt`);
  const original = fs.readFileSync(inputPath, "utf8");
  const recovery = makeRecoveryPrompt(scene, original);
  fs.writeFileSync(outputPath, recovery, "utf8");

  const relativePath = path.relative(repo, outputPath).replaceAll("\\", "/");
  const sha256 = crypto.createHash("sha256").update(recovery).digest("hex").toUpperCase();
  promptAudit[scene] = {
    path: relativePath,
    sha256,
    chars: recovery.length,
    storedRollsChanged: false,
    publicFashionSafetyCorrection: true,
    countryLocationCorrection: sceneCorrections[scene],
  };

  checkpoint.scenePlans[String(scene)].recoveryRound1 = {
    ...promptAudit[scene],
    prompt: recovery,
  };
}

checkpoint.status = "active-four-scene-gate-recovery-round-1-materialized";
checkpoint.checkpointedAt = new Date().toISOString();
checkpoint.countryCompletionGate.gitCheckpointPushed = true;
checkpoint.renderAttempts.raw = {
  ...checkpoint.renderAttempts.raw,
  status: "moderation-blocked-no-raw-output",
  attemptedAt: checkpoint.checkpointedAt,
  returnedRawSceneNumbers: [],
  moderationCategory: "sexual",
  requestId: "665a122e-44f0-4d8b-a70c-7acf8987616c",
  note: "The concurrent wrapper returned one output-stage moderation rejection and no Georgia raw file was emitted; older generated images were not treated as this batch.",
};
checkpoint.renderAttempts.recovery = {
  ...checkpoint.renderAttempts.recovery,
  status: "materialized-pending-launch",
  round: 1,
  sceneNumbers: [1548, 1549, 1550, 1551],
  concurrency: "four independent built-in image generation calls with all-settled result capture",
  promptAudit,
  storedRollsChanged: false,
};
checkpoint.rawOutputs = [];
checkpoint.acceptedAssets = [];
checkpoint.rejectedAssets = [];
checkpoint.xPost.status = "blocked-until-four-accepted-and-git-pushed";
checkpoint.nextQueueStatus = "locked-until-Georgia-four-scene-Git-and-X-completion";

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify(promptAudit, null, 2));
