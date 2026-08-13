import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const preflightPath = path.resolve("tmp/world-195x4/batch-324/batch-324-belize-preflight.json");
const checkpointPath = path.resolve("assets/lore/starlight-era/batch-324-belize-relaxed-audit-checkpoint.json");
const checkpoint = JSON.parse(fs.readFileSync(preflightPath, "utf8"));
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase();

const acceptedSpecs = [
  {
    scene: 1316,
    filename: "1316-belize-city-swing-bridge-double-rainbow-paper-target-recovery.png",
    pass: "single-recovery",
    hardGate: "accepted: exactly four mature adult women with eight attributable arms and eight hands; ECE alone uses a realistic two-hand grip in a safe leftward line to the visible paper target and complete timber-and-sand backstop; the other women remain behind the muzzle plane; large complete Swing Bridge, Haulover Creek, and Belize coast motifs appear across all outfits",
    relaxedSoftGate: "accepted despite foreground rain reflections after the double-rainbow roll and a compact three-woman embrace; identities, secure clothing, footwear, target, prop ownership, indexed trigger finger, hand ownership, landmark, motifs, and affectionate contact count remain clear",
  },
  {
    scene: 1318,
    filename: "1318-belize-cockscomb-blue-hour-paws-paper-target-recovery.png",
    pass: "single-recovery",
    hardGate: "accepted: exactly four mature adult women with eight attributable arms and eight hands; ECE alone uses a realistic two-hand grip toward the visible paper target and complete earth backstop; Ellie securely holds PAWS far behind the muzzle plane; large complete Cockscomb ridge, Maya Mountains, creek, waterfall, and forest motifs appear across all outfits",
    relaxedSoftGate: "accepted despite the affectionate trio clustering closely and minor drift from the exact contact diagram; every hand remains owned, PAWS is safe, and identities, clothing, footwear, target, handler, landmark, motifs, and public-safe story are clear",
  },
  {
    scene: 1319,
    filename: "1319-belize-placencia-rain-alia-rainbow-hosiery-paper-target.png",
    pass: "raw",
    hardGate: "accepted: exactly four mature adult women with eight attributable arms and eight hands; active hosiery places the Belize-palette rainbow gradient on Radiance only and transfers sole two-hand prop handling to Alia; Alia sights safely at the visible paper target and complete backstop; large complete Placencia coast, lagoon, boardwalk, and route motifs appear across the outfits",
    relaxedSoftGate: "accepted despite rain reaching the nonslip foreground and softer emotion distinctions; handler transfer, hosiery exclusivity, anatomy, identities, target, safe line, secure clothing, footwear, landmark, motifs, and affectionate contacts remain readable",
  },
];

checkpoint.status = "terminal-partially-accepted-after-single-recovery-pass";
checkpoint.renderAttempts = {
  raw: {
    status: "completed-with-one-output-moderation-block",
    requested: 4,
    fulfilled: 3,
    fulfilledScenes: [1317, 1318, 1319],
    blockedBeforeAssetScenes: [1316],
    concurrency: "four independent built-in image generation calls launched together",
    rendererSafetyRequestId: "068ae28e-315b-47e4-9337-fcac8958ba6c",
  },
  recovery: {
    status: "completed",
    attemptedScenes: [1316, 1317, 1318],
    fulfilled: 3,
    maximumPerBlockedScene: 1,
    furtherRecoveryAllowed: false,
  },
};
checkpoint.acceptancePolicy = {
  hardGates: "identity count, exact arm and hand ownership, resolved handler, active prop use, rolled pose and safe target line, indexed trigger finger, no ammunition or firing, secure opaque clothing, PAWS safety, rainbow-hosiery exclusivity, male eye line, and large complete country motifs",
  relaxedSoftGates: "minor contact-placement drift, subtle emotion drift, weather spill, and compact spacing may pass when every hard gate and the public-safe story remain readable",
};
checkpoint.acceptedAssets = acceptedSpecs.map((spec) => {
  const acceptedPath = path.resolve("assets/lore/starlight-era", spec.filename);
  const acceptedBytes = fs.readFileSync(acceptedPath);
  return {
    ...spec,
    bytes: acceptedBytes.length,
    sha256: sha256(acceptedBytes),
    acceptedPath: path.relative(process.cwd(), acceptedPath).replaceAll("\\", "/"),
    copiedFromPreservedOriginal: true,
  };
});
checkpoint.rejectedAssets = [{
  scene: 1317,
  raw: "tmp/world-195x4/batch-324/raw/1317-raw.png",
  recovery: "tmp/world-195x4/batch-324/recovery/1317-recovery.png",
  status: "terminal-rejected-after-single-recovery-pass",
  reasons: [
    "the raw render correctly included five adults, ECE sole handling, PAWS, the Great Blue Hole, and a safe open-water line",
    "the raw male's strongest eye line landed on Ellie rather than ECE",
    "the single recovery preserved ten attributable hands, PAWS safety, sole ECE handling, and the empty open-water line",
    "the recovery male's strongest eye line landed on Radiance rather than ECE, so the binding male-scene relationship gate still fails",
  ],
}];
checkpoint.acceptedCount = 3;
checkpoint.rejectedCount = 1;
checkpoint.queueAdvance = {
  eligible: true,
  reason: "three accepted local Belize assets exist and Batch 324 is terminal after its single recovery pass",
  country: "Bahamas",
  batch: 325,
  scenes: [1320, 1321, 1322, 1323],
  themes: [
    "cleaner and service couture",
    "cleaner and service couture",
    "cinematic covert-agent crew couture",
    "cinematic covert-agent crew couture",
  ],
};
checkpoint.xPost = {
  status: "eligible-awaiting-publication",
  minimumCurrentCountryAcceptedAssets: 2,
  currentCountryAcceptedAssets: checkpoint.acceptedAssets.map((asset) => asset.filename),
  currentCountryAcceptedCount: checkpoint.acceptedCount,
  secondaryCountry: "Brunei",
  caption: checkpoint.xPublishingPlan.captionIfEligible,
  attachmentPlan: [
    "1316-belize-city-swing-bridge-double-rainbow-paper-target-recovery.png",
    "1319-belize-placencia-rain-alia-rainbow-hosiery-paper-target.png",
    "1312-brunei-kampong-ayer-ash-sunset-paws-wrist-guidance.png",
  ],
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ checkpointPath, status: checkpoint.status, acceptedCount: checkpoint.acceptedCount, rejectedCount: checkpoint.rejectedCount, xPost: checkpoint.xPost, queueAdvance: checkpoint.queueAdvance }, null, 2));
