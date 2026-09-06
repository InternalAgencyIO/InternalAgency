import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("tmp/world-195x4/batch-322");
const preflightPath = path.join(root, "batch-322-cabo-verde-preflight.json");
const checkpointPath = path.resolve("assets/lore/starlight-era/batch-322-cabo-verde-relaxed-audit-checkpoint.json");
const checkpoint = JSON.parse(fs.readFileSync(preflightPath, "utf8"));
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase();

const acceptedDefinitions = [
  {
    scene: 1308,
    filename: "1308-cabo-verde-cidade-velha-windstorm-wrist-guidance-recovery.png",
    pass: "single-recovery",
    hardGate: "accepted: exactly four adult women with eight attributable arms and eight hands; ECE alone owns the prop in a safe leftward line to a complete paper target and basalt backstop; Alia visibly provides two-hand behind-the-shoulder forearm and wrist guidance without touching the prop; large complete Cabo Verde motifs appear on all four outfits",
    relaxedSoftGate: "accepted despite the guiding contacts landing slightly higher on ECE's forearms than the exact requested wrist points; ownership, safe line, target, anatomy, identities, secure clothing, footwear, country motifs, and affectionate contact count remain clear",
  },
  {
    scene: 1309,
    filename: "1309-cabo-verde-santo-antao-paul-valley-rain-alia-rainbow-hosiery.png",
    pass: "raw",
    hardGate: "accepted: exactly four adult women with eight attributable arms and eight hands; active hosiery roll places original independent rainbow knee socks on ECE only and transfers sole two-hand prop handling to Alia; Alia sights safely at an empty paper target and basalt backstop; large complete Santo Antao motifs appear across all outfits",
    relaxedSoftGate: "accepted despite rain reaching the foreground floor and minor drift from the exact contact diagram; stable footing, handler, target, hosiery exclusivity, anatomy, identities, secure clothing, footwear, landmark, motifs, and at least three affectionate contacts remain readable",
  },
  {
    scene: 1311,
    filename: "1311-cabo-verde-mindelo-porto-grande-double-rainbow-handoff.png",
    pass: "raw",
    hardGate: "accepted: exactly four adult women with eight attributable arms and eight hands; ECE alone holds the prop in the completed-handoff final sight picture toward a clearly empty open-water marker; the group remains behind the muzzle plane; large complete Sao Vicente and Porto Grande motifs appear across at least three outfits",
    relaxedSoftGate: "accepted despite softer-than-requested emotional distinctions and a compact right-side embrace; all limbs remain owned, the target line is safe, and identities, secure clothing, footwear, country motifs, weather, and affectionate contacts are clear",
  },
];

checkpoint.status = "terminal-partially-accepted-after-single-recovery-pass";
checkpoint.renderAttempts = {
  raw: {
    status: "completed",
    requested: 4,
    fulfilled: 4,
    refusedBeforeAsset: [],
    concurrency: "four independent built-in image generation calls launched together",
  },
  recovery: {
    status: "completed",
    attemptedScenes: [1308, 1310],
    maximumPerBlockedScene: 1,
    furtherRecoveryAllowed: false,
  },
};
checkpoint.acceptancePolicy = {
  hardGates: "identity count, exact arm and hand ownership, resolved handler, active prop use, rolled pose and safe target line, indexed trigger finger, no ammunition or firing, secure opaque clothing, PAWS safety, rainbow-hosiery exclusivity, male eye line, and large complete country motifs",
  relaxedSoftGates: "minor contact-placement drift, subtle emotion drift, weather spill, and compact spacing may pass when every hard gate and the public-safe story remain readable",
};
checkpoint.acceptedAssets = acceptedDefinitions.map((item) => {
  const acceptedPath = path.resolve("assets/lore/starlight-era", item.filename);
  const bytes = fs.readFileSync(acceptedPath);
  return {
    ...item,
    bytes: bytes.length,
    sha256: sha256(bytes),
    acceptedPath: path.relative(process.cwd(), acceptedPath).replaceAll("\\", "/"),
    copiedFromPreservedOriginal: true,
  };
});
checkpoint.rejectedAssets = [
  {
    scene: 1310,
    raw: "tmp/world-195x4/batch-322/raw/1310-raw.png",
    recovery: "tmp/world-195x4/batch-322/recovery/1310-recovery.png",
    status: "terminal-rejected-after-single-recovery-pass",
    reasons: [
      "the raw render placed the four-person group between ECE and the right-side target, creating an unsafe person-crossing line",
      "the recovery moved the target safely to the left and placed the group behind the muzzle plane",
      "the established male's strongest eye line still lands on Alia rather than ECE, failing the binding male-scene relationship gate",
      "tight overlapping hands inside the four-person embrace make the exact ten-hand ownership inventory less certain than the strict male-scene anatomy gate permits",
    ],
  },
];
checkpoint.acceptedCount = checkpoint.acceptedAssets.length;
checkpoint.rejectedCount = checkpoint.rejectedAssets.length;
checkpoint.queueAdvance = {
  eligible: true,
  reason: "three accepted local Cabo Verde assets exist; Batch 322 is terminal after its single recovery pass",
  country: "Brunei",
  batch: 323,
  scenes: [1312, 1313, 1314, 1315],
  themes: [
    "adult nightlife dance-performance couture",
    "adult nightlife dance-performance couture",
    "Paris runway model couture",
    "Paris runway model couture",
  ],
};
checkpoint.xPost = {
  status: "eligible-pending-browser-publication",
  minimumCurrentCountryAcceptedAssets: 2,
  currentCountryAcceptedAssets: checkpoint.acceptedAssets.map((item) => item.filename),
  secondaryCountry: "Maldives",
  caption: checkpoint.xPublishingPlan.captionIfEligible,
  attachmentPlan: [
    "1309-cabo-verde-santo-antao-paul-valley-rain-alia-rainbow-hosiery.png",
    "1311-cabo-verde-mindelo-porto-grande-double-rainbow-handoff.png",
    "1306-maldives-addu-atoll-causeway-command-route.png",
  ],
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ checkpointPath, acceptedCount: checkpoint.acceptedCount, rejectedCount: checkpoint.rejectedCount, xPost: checkpoint.xPost }, null, 2));
