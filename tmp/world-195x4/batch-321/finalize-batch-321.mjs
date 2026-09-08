import fs from "node:fs";
import path from "node:path";

const root = path.resolve("tmp/world-195x4/batch-321");
const assetRoot = path.resolve("assets/lore/starlight-era");
const preflight = JSON.parse(fs.readFileSync(path.join(root, "batch-321-maldives-preflight.json"), "utf8"));

const accepted = [
  {
    scene: 1306,
    source: path.join(root, "raw/1306-maldives-addu-raw.png"),
    filename: "1306-maldives-addu-atoll-causeway-command-route.png",
    pass: "raw",
    hardGate: "accepted: exactly four adult women, eight continuously attributable arms and eight hands; ECE is sole two-hand handler; indexed trigger finger reads outside the guard; muzzle line reaches the empty left-side navigation buoy across open water; hands-free console map adds no limb; large complete Maldives atoll and causeway motifs appear on all four outfits",
    relaxedSoftGate: "accepted despite nonbinding deviations in the exact requested contact arrangement and rain reaching the foreground floor; identities, public safety, handler, target, anatomy, motifs, secure clothing, footwear, landmark, and at least three affectionate contacts remain readable",
  },
  {
    scene: 1307,
    source: path.join(root, "raw/1307-maldives-baa-recovery.png"),
    filename: "1307-maldives-baa-atoll-mammatus-love-route.png",
    pass: "single-recovery",
    hardGate: "accepted: exactly four adult women, eight attributable arms and eight hands; active hosiery roll places original rainbow knee socks on ECE only and transfers sole two-hand prop handling to Alia; the recovered far-left buoy aligns with the safe empty open-water muzzle line; PAWS is securely held outside the line; large complete Baa Atoll motifs appear on all four outfits",
    relaxedSoftGate: "accepted despite the kitten being nearer to the group center than requested and some softer-than-requested emotion cues; the kitten remains separated from the prop, no unsafe line crosses it, and all binding handler, hosiery, anatomy, target, motif, identity, clothing, contact, and public-safety gates pass",
  },
];

for (const item of accepted) {
  const target = path.join(assetRoot, item.filename);
  fs.copyFileSync(item.source, target);
  const bytes = fs.readFileSync(target);
  item.bytes = bytes.length;
  item.sha256 = (await import("node:crypto")).createHash("sha256").update(bytes).digest("hex").toUpperCase();
  item.acceptedPath = `assets/lore/starlight-era/${item.filename}`;
  item.copiedFromPreservedOriginal = true;
}

const rejected = [
  {
    scene: 1304,
    raw: "raw/1304-maldives-hanifaru-raw.png",
    recovery: "raw/1304-maldives-hanifaru-recovery.png",
    status: "terminal-rejected-after-single-recovery-pass",
    reasons: [
      "the recovery correctly moved the paper target and sand backstop onto the existing leftward muzzle line",
      "the tight right-side overlap leaves multiple arms or hand endpoints occluded, so exactly ten traceable hands cannot be proven under the strict five-adult anatomy gate",
      "the established male's strongest eye line remains on the woman holding PAWS rather than ECE",
    ],
  },
  {
    scene: 1305,
    raw: null,
    recovery: "raw/1305-maldives-fuvahmulah-recovery.png",
    status: "terminal-rejected-after-single-recovery-pass",
    reasons: [
      "the initial independent render was refused before an asset was produced",
      "the recovery correctly shows ECE in a two-hand stance at an empty paper target and backstop",
      "rainbow-only was inactive but the recovery converted all four outfits and boots to rainbow styling",
      "large complete secular Maldives motifs are absent from at least two outfits",
      "the result is a static lineup with fewer than three affectionate contacts and does not clearly establish Fuvahmulah's Thoondu reef-shore identity",
    ],
  },
];

const checkpoint = {
  batch: 321,
  country: "Maldives",
  status: "terminal-partially-accepted-after-single-recovery-pass",
  sourceCommit: preflight.sourceCommit,
  contractSha256: preflight.contractSha256,
  rollMethod: preflight.rollMethod,
  rollThresholds: preflight.rollThresholds,
  themePair: preflight.themePair,
  nextThemePair: preflight.nextThemePair,
  nextQueueCountry: preflight.nextQueueCountry,
  nextQueueBatch: preflight.nextQueueBatch,
  nextQueueScenes: preflight.nextQueueScenes,
  researchSources: preflight.researchSources,
  faceAnchors: preflight.faceAnchors,
  maleModelSelection: preflight.maleModelSelection,
  countryMotifPolicy: preflight.countryMotifPolicy,
  xPublishingRolls: preflight.xPublishingRolls,
  xPublishingPlan: preflight.xPublishingPlan,
  anatomyGate: preflight.anatomyGate,
  rollAudit: preflight.rollAudit,
  scenePlans: preflight.scenePlans,
  renderAttempts: {
    raw: {
      status: "completed",
      requested: 4,
      fulfilled: 3,
      refusedBeforeAsset: [1305],
      concurrency: preflight.renderAttempts.raw.concurrency,
    },
    recovery: {
      status: "completed",
      attemptedScenes: [1304, 1305, 1307],
      maximumPerBlockedScene: 1,
      furtherRecoveryAllowed: false,
    },
  },
  acceptancePolicy: {
    hardGates: "identity count, exact arm and hand ownership, resolved handler, active prop use, safe target line, indexed trigger finger, no ammunition or firing, secure opaque clothing, PAWS safety, rainbow-hosiery exclusivity, and large complete country motifs",
    relaxedSoftGates: "minor contact-layout drift, subtle emotion drift, weather spill, and kitten spacing may pass when every hard gate and the public-safe story remain readable",
  },
  acceptedAssets: accepted.map(({ source, ...item }) => item),
  rejectedAssets: rejected,
  acceptedCount: accepted.length,
  rejectedCount: rejected.length,
  queueAdvance: {
    eligible: true,
    reason: "two accepted local Maldives assets exist; Batch 321 is terminal after its single recovery pass",
    country: "Cabo Verde",
    batch: 322,
    scenes: [1308, 1309, 1310, 1311],
    themes: ["doctor-clinical-command couture", "doctor-clinical-command couture", "adult nightlife dance-performance couture", "adult nightlife dance-performance couture"],
  },
  xPost: {
    status: "published-and-three-attachments-verified",
    minimumCurrentCountryAcceptedAssets: 2,
    currentCountryAcceptedAssets: accepted.map((item) => item.filename),
    secondaryCountry: "Malta",
    caption: preflight.xPublishingPlan.captionIfEligible,
    attachmentPlan: [accepted[0].filename, accepted[1].filename, "1300-malta-valletta-grand-harbour-windstorm-undercover-investigator.png"],
    postUrl: "https://x.com/dogramaci/status/2086628633267917291",
    verification: {
      sentToast: "Your post was sent",
      publicCaption: "Maldives red-heart Malta #Maldives",
      photoLinks: [
        "https://x.com/dogramaci/status/2086628633267917291/photo/1",
        "https://x.com/dogramaci/status/2086628633267917291/photo/2",
        "https://x.com/dogramaci/status/2086628633267917291/photo/3"
      ],
      madeWithAI: true
    },
  },
};

const checkpointPath = path.join(assetRoot, "batch-321-maldives-relaxed-audit-checkpoint.json");
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ checkpointPath, accepted: accepted.map((item) => item.filename), rejected: rejected.map((item) => item.scene) }, null, 2));
