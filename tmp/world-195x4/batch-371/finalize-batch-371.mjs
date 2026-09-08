import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const generated = "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086";
const preflightPath = path.join(root, "tmp/world-195x4/batch-371/batch-371-cuba-preflight.json");
const checkpointPath = path.join(root, "assets/lore/starlight-era/batch-371-cuba-orbital-research-station-checkpoint.json");
const accepted = [
  {
    scene: 1504,
    source: `${generated}/exec-63f58010-524e-4fc0-ad41-a48ee59303af.png`,
    file: "1504-cuba-havana-orbital-research-station-recovery.png",
    decision: "accepted-recovery",
    audit: {
      coreCast: "Exactly four clearly adult core women are present; Alia retains the braided anchor.",
      anatomy: "No glaring extra whole person or limb is visible; eight owned arms and hands read plausibly.",
      missionProp: "ECE alone uses a visible two-hand side-profile grip toward an empty paper target and complete sand backstop, away from every person and the camera.",
      romance: "Radiance, Ellie and Alia form a clear linked-hand, waist and shoulder contact triangle fully behind the muzzle corridor.",
      themeLocation: "Havana Malecón, lighthouse, storm, cupola, solar truss and orbital garments form one immediate foreground composition.",
      deviations: ["The close partner-turn hard beat resolves as a stationary linked embrace.", "Country motifs rely partly on architectural image panels rather than entirely dimensional appliques."]
    }
  },
  {
    scene: 1507,
    source: `${generated}/exec-22e6c8ef-cbd3-44ae-a3db-7b441039f323.png`,
    file: "1507-cuba-santiago-bay-orbital-research-station-fast-pass.png",
    decision: "accepted-fast-pass",
    audit: {
      coreCast: "Exactly four clearly adult core women are present; Alia retains the braided anchor.",
      anatomy: "No glaring extra whole person or limb is visible; eight owned arms and hands read plausibly.",
      missionProp: "ECE alone uses a two-hand grip toward a visible empty paper target and complete earthen backstop, away from every person and the camera.",
      romance: "Radiance and Ellie visibly link forearms while Alia claims ECE's shoulder, creating an interrupted four-way choice.",
      themeLocation: "Santiago Bay, mountain-backed city, blue-hour rainbow, orbital modules and distinct research-station couture read together.",
      deviations: ["Rolled MAX-only mascot is absent.", "The pulled-away protective hard beat resolves as a standing contact chain."]
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
    fulfilled: 2,
    moderationBlocked: 2,
    concurrency: "four independent built-in image generation calls launched together"
  },
  recovery: {
    status: "complete",
    attemptedScenes: [1504],
    acceptedScenes: [1504],
    maximumPerBlockedScene: 1,
    reason: "The raw Havana render used a one-hand prop grip; one exact two-hand side-profile recovery passed."
  }
};
checkpoint.acceptedAssets = accepted.map(({ source, ...asset }) => ({ ...asset, sourceRaw: source }));
checkpoint.rejectedAssets = [
  {
    scene: 1505,
    status: "terminal-renderer-output-moderation-block",
    requestId: "bfe6fcf7-8b12-4e55-913d-feaf33289362",
    reason: "The image service rejected the output before an auditable asset was delivered."
  },
  {
    scene: 1506,
    status: "terminal-renderer-output-moderation-block",
    requestId: "ebb7c771-e611-41de-8685-8584e139a0c0",
    reason: "The image service rejected the output before an auditable asset was delivered."
  },
  {
    scene: 1504,
    status: "rejected-raw-replaced-by-accepted-recovery",
    sourceRaw: `${generated}/exec-f4670933-75cc-43d4-81a7-e87f75302eca.png`,
    reason: "The raw render showed ECE holding the mission prop one-handed instead of the required two-hand ownership."
  }
];
checkpoint.xPost = {
  status: "eligible-queued-behind-confirmation-gated-bolivia-composer",
  minimumCurrentCountryAcceptedAssets: 2,
  acceptedCurrentCountryAssets: 2,
  caption: "Cuba red-heart United Arab Emirates #Cuba #WorldXXXSeries",
  attachmentPlan: [
    "1504-cuba-havana-orbital-research-station-recovery.png",
    "1507-cuba-santiago-bay-orbital-research-station-fast-pass.png",
    "1500-united-arab-emirates-dubai-polar-airship-fast-pass.png"
  ],
  reason: "An earlier exact Bolivia post remains staged in the signed-in X composer behind a required final-post confirmation. The composer was not overwritten or duplicated."
};
checkpoint.queueAdvance = {
  country: "Czechia",
  batch: 372,
  scenes: [1508, 1509, 1510, 1511],
  cinematicTheme: "orbital research-station couture",
  batchOrdinalWithinTheme: 2
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(JSON.stringify({ checkpointPath, accepted: accepted.map((asset) => asset.file), status: checkpoint.status }, null, 2));
