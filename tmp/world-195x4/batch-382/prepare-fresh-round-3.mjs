import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const checkpointPath = path.join(
  repo,
  "assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json",
);
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));

const scenes = [1548, 1550, 1551];
const corrections = {
  1548: `FRESH ROUND 3 DECISIVE CORRECTION. Preserve the successful moving slow-dance chain, Tbilisi geography, hard hail, MAX-only state, all four distinct outfits, emotions, cuts, and exactly eight traceable hands from the prior prompt. Fix the safety lane only. ECE stands at far right and faces still farther right on a dry terrace. Place a CLOSED transparent-panel cinema-training lane immediately to ECE's right, never over the river. Inside that lane, place one shallow transparent blue water basin holding one clearly empty floating paper route marker. Put one thick sand catch wall immediately behind that marker. The full uninterrupted horizontal line must read in this order: orange-plugged inert replica muzzle, empty floating route marker, thick sand catch wall. The muzzle visibly points directly into the center of the marker and wall. Keep every person, MAX, landmark, and occupied object behind the muzzle plane. The river and city remain behind the people, not downrange. ECE's trigger finger is straight outside the guard. No ambiguity, firing, ammunition, magazine, threat, or camera-facing muzzle.`,
  1550: `FRESH ROUND 3 DECISIVE CORRECTION. Preserve Sighnaghi, the aurora, exactly five adults, the stable fully clothed lap-sitting choice, the established adult male, three soft air-filled geometric weather balloons, the safe right-facing empty water-marker lane, all stored rolls, and all outfit fingerprints. Fix the exact ten-hand ownership graph only. Spread the five torsos with visible air gaps and place every hand against contrasting open background. Radiance owns exactly two hands and both hold the three-piece balloon pack. Alia owns exactly two hands: one clearly touches Radiance's shoulder and one clearly links with Ellie's hand. Ellie owns exactly two hands: one clearly links with Alia and the other clearly touches Alia's shoulder. ECE owns exactly two hands and both remain separated on the inert replica. The male owns exactly two hands: one clearly touches ECE's upper arm and one clearly touches ECE's waist, while his strongest sustained eye line stays on ECE. Show all ten shoulders, elbows, wrists, and hands continuously traceable. Do not add, hide, fuse, borrow, or redirect any contact.`,
  1551: `FRESH ROUND 3 DECISIVE CORRECTION. Preserve real Batumi Boulevard, heavy rain, exactly one tiny collarless golden kitten PAWS plus one distinct small young golden retriever puppy MAX, Radiance's opaque rainbow knee socks, ECE's oversized magnetic compass table, Alia's truly strapless open-back copper look, the safe right-facing paper-target lane, all stored rolls, and all outfit fingerprints. Fix the exact eight-hand controlled-dip graph only. Open the dip and separate all torsos with visible air gaps. Ellie owns exactly two hands and both support Radiance: one hand clearly at Radiance's waist and one hand clearly spread across Radiance's upper back, both fully visible against contrasting fabric. Radiance owns exactly two hands: one clearly on Ellie's shoulder and one clearly on ECE's shoulder. ECE owns exactly two hands and both remain visibly separated on the compass table, with no hand touching Radiance. Alia owns exactly two hands and both remain visibly separated on the inert replica. Show all eight shoulders, elbows, wrists, and hands continuously traceable. Do not add, hide, fuse, borrow, or redirect any contact.`,
};

const requiredByScene = {
  1548: [
    "Weather roll 53 = hailstorm with suspended ice and hard backlight",
    "Mascot roll 41 is MAX only",
    "Hard-love roll 74",
    "Exactly eight visible arms and eight visible hands",
    "muzzle, empty floating route marker, thick sand catch wall",
  ],
  1550: [
    "Weather roll 88 = rare aurora sky",
    "Male selector is active in this scene only",
    "Hard-love roll 1",
    "Exactly ten visible arms and ten visible hands",
    "three soft air-filled geometric balloons",
  ],
  1551: [
    "Weather roll 35 = heavy rain curtain",
    "Mascot roll 15 is PAWS plus MAX",
    "Hard-love roll 40",
    "Exactly eight visible arms and eight visible hands",
    "oversized magnetic compass table",
  ],
};

const promptAudit = {};
for (const scene of scenes) {
  const plan = checkpoint.scenePlans[String(scene)];
  const priorPrompt = plan.freshRound2Recovery?.prompt;
  if (!priorPrompt) {
    throw new Error(`Missing complete prior prompt for scene ${scene}`);
  }

  const base = priorPrompt
    .replaceAll("TARGETED RECOVERY, FRESH ROUND 2", "PRESERVE SUCCESSFUL ROUND 2 CORRECTIONS")
    .replaceAll("fresh render round 2", "fresh render round 3");
  const prompt = `${corrections[scene]}\n\n${base}`;

  for (const required of requiredByScene[scene]) {
    if (!prompt.includes(required)) {
      throw new Error(`Scene ${scene} prompt is missing required materialization: ${required}`);
    }
  }

  const outputPath = path.join(root, `scene-${scene}-fresh-round-3-prompt.txt`);
  fs.writeFileSync(outputPath, prompt, "utf8");
  const sha256 = crypto.createHash("sha256").update(prompt).digest("hex").toUpperCase();
  const relativePath = path.relative(repo, outputPath).replaceAll("\\", "/");
  promptAudit[scene] = {
    path: relativePath,
    sha256,
    chars: prompt.length,
    storedRollsChanged: false,
    freshRound: 3,
    sourcePrompt: plan.freshRound2Recovery.path,
    decisiveCorrections: [corrections[scene]],
  };
  plan.freshRound3 = { ...promptAudit[scene], prompt };
}

const preparedAt = new Date().toISOString();
checkpoint.status = "active-four-scene-gate-fresh-round-3-materialized";
checkpoint.checkpointedAt = preparedAt;
checkpoint.terminal = false;
checkpoint.countryCompletionGate = {
  ...checkpoint.countryCompletionGate,
  acceptedSceneCount: 1,
  missingSceneNumbers: scenes,
  gitCheckpointPushed: true,
  xPublicStatusVerified: false,
  queueAdvanceAllowed: false,
  gateSatisfied: false,
};
checkpoint.renderAttempts.freshRound3 = {
  status: "materialized-pending-launch",
  preparedAt,
  sceneNumbers: scenes,
  preservedAcceptedSceneNumbers: [1549],
  concurrency: "three independent built-in image generation calls with all-settled result capture",
  maximumRecoveryPassesPerBlockedScene: 1,
  promptAudit,
  storedRollsChanged: false,
};
checkpoint.xBacklogAudit = {
  ...checkpoint.xBacklogAudit,
  checkedAt: preparedAt,
  account: "@dogramaci",
  signedIn: true,
  eligibleBacklogRemaining: 0,
  latestVisibleSeriesStatus: {
    country: "Honduras",
    url: "https://x.com/dogramaci/status/2087088543499768003",
    attachments: 3,
    liveVerified: true,
  },
  reconciliationDecision: "No eligible unposted backlog item and no duplicate upload required before Georgia completion.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete-not-skipped";
checkpoint.xPost.url = null;
checkpoint.nextQueueStatus = "locked-on-Georgia-until-four-accepted-git-pushed-and-X-live-verified";
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "launch-fresh-round-3-missing-scenes-only",
  preserveAcceptedSceneNumbers: [1549],
  sceneNumbers: scenes,
  laterCountryStartAllowed: false,
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify(promptAudit, null, 2));
