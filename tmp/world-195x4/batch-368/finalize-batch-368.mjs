import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const preflightPath = path.join(root, "tmp/world-195x4/batch-368/batch-368-jordan-preflight.json");
const checkpointPath = path.join(root, "assets/lore/starlight-era/batch-368-jordan-deep-sea-submersible-checkpoint.json");
const generated = "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086";
const accepted = [
  {
    scene: 1492,
    source: `${generated}/exec-3c3af19a-fb76-4683-8ae7-1ff013f88e6b.png`,
    file: "1492-jordan-amman-citadel-deep-sea-submersible-fast-pass.png",
    audit: {
      coreCast: "Exactly four clearly adult core women are present; Alia retains the braided anchor.",
      anatomy: "No glaring extra whole person or limb is visible; eight owned arms and hands read plausibly.",
      missionProp: "ECE alone uses a two-hand grip directed away from every person and the camera toward empty water.",
      romance: "The three-woman contact chain has aligned eye lines and reads before the isolated mission beat.",
      themeLocation: "Amman Citadel columns, limestone hill city, meteor shower and pressure-shell couture are immediate reads.",
      deviations: ["MAX reads as a larger young retriever and PAWS as a larger cat than rolled.", "The seated-embrace hard beat resolves as a standing contact chain."]
    }
  },
  {
    scene: 1494,
    source: `${generated}/exec-daf6b154-85a7-4733-8424-4140260fad27.png`,
    file: "1494-jordan-wadi-rum-deep-sea-submersible-male-fast-pass.png",
    audit: {
      coreCast: "All four core adult women and the established adult male are present; Alia retains the braided anchor.",
      anatomy: "No glaring extra whole person or limb is visible; ten adult arms and hands read plausibly.",
      missionProp: "Alia alone uses a two-hand grip toward the clearly empty cordoned water marker, away from every person and the camera.",
      romance: "The male, Ellie and Radiance form a protected infidelity-drama cluster with multiple contacts while ECE remains visibly engaged.",
      themeLocation: "Wadi Rum sandstone arch, storm, research portal and deep-sea structural couture form one foreground composition.",
      deviations: ["PAWS and MAX read as larger gray-cat and cream-dog variants.", "ECE's chainless sculpture rests across her lap rather than driving the romance beat.", "The selected hard-love movement resolves as a protective standing and kneeling cluster."]
    }
  },
  {
    scene: 1495,
    source: `${generated}/exec-f3da2882-8288-4df3-8e5d-a80c5c33110d.png`,
    file: "1495-jordan-aqaba-deep-sea-submersible-recovery.png",
    audit: {
      coreCast: "Exactly four clearly adult core women are present; Alia retains the braided anchor.",
      anatomy: "No glaring extra whole person or limb is visible; eight owned arms and hands read plausibly.",
      missionProp: "ECE is isolated at far left in full side profile with a two-hand grip toward a visible empty paper target and complete thick backstop; the other women remain fully behind the line.",
      romance: "The three-woman Aqaba group shows a clear affectionate choice through face, waist and hand contact.",
      themeLocation: "Aqaba gulf, mountain wall, peaceful research dome and pressure-module couture remain large and coherent.",
      deviations: ["The partner-turn hard beat resolves as a stationary three-person affection event."]
    }
  }
];

const checkpoint = JSON.parse(fs.readFileSync(preflightPath, "utf8"));
for (const asset of accepted) fs.copyFileSync(asset.source, path.join(root, "assets/lore/starlight-era", asset.file));

checkpoint.status = "terminal-partially-accepted";
checkpoint.completedAt = new Date().toISOString();
checkpoint.throughputMode = {
  active: true,
  policy: "Fast-pass acceptance preserves structurally safe usable renders while recording minor visual deviations; hard safety, explicit-content, missing-core-character, and glaring extra-person or extra-limb failures remain terminal rejects."
};
checkpoint.renderAttempts = {
  raw: {
    status: "complete",
    requested: 4,
    fulfilled: 3,
    moderationBlocked: 1,
    concurrency: "four independent built-in image generation calls launched together"
  },
  recovery: {
    status: "complete",
    attemptedScenes: [1495],
    acceptedScenes: [1495],
    maximumPerBlockedScene: 1,
    reason: "Scene 1495 raw output placed the muzzle line too close to the camera and omitted the rolled paper target; one side-profile target-corridor recovery passed."
  }
};
checkpoint.acceptedAssets = accepted.map(({ source, ...asset }) => ({ ...asset, sourceRaw: source, decision: asset.scene === 1495 ? "accepted-recovery" : "accepted-fast-pass" }));
checkpoint.rejectedAssets = [
  {
    scene: 1493,
    status: "terminal-renderer-output-moderation-block",
    reason: "The image service rejected the output before an auditable asset was delivered."
  },
  {
    scene: 1495,
    status: "rejected-raw-replaced-by-accepted-recovery",
    sourceRaw: `${generated}/exec-d90f0f7f-0708-4f9f-9482-746f130ae0b5.png`,
    reason: "The raw muzzle line read too close to the camera and the rolled paper target and complete backstop were absent."
  }
];
checkpoint.xPost = {
  status: "eligible-queued-behind-confirmation-gated-bolivia-composer",
  minimumCurrentCountryAcceptedAssets: 2,
  acceptedCurrentCountryAssets: 3,
  caption: "Jordan red-heart Haiti #Jordan",
  attachmentPlan: [
    "1492-jordan-amman-citadel-deep-sea-submersible-fast-pass.png",
    "1494-jordan-wadi-rum-deep-sea-submersible-male-fast-pass.png",
    "1491-haiti-ile-a-vache-deep-sea-submersible-fast-pass.png"
  ],
  reason: "An earlier exact Bolivia post remains staged in the signed-in X composer behind a required final-post confirmation. The composer was not overwritten or duplicated."
};
checkpoint.queueAdvance = {
  country: "Dominican Republic",
  batch: 369,
  scenes: [1496, 1497, 1498, 1499],
  cinematicTheme: "polar airship couture",
  batchOrdinalWithinTheme: 1
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(JSON.stringify({ checkpointPath, accepted: accepted.map((asset) => asset.file), status: checkpoint.status }, null, 2));
