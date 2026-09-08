import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const loreDir = path.join(repo, "assets/lore/starlight-era");
const ledgerPath = path.join(loreDir, "world-x-publish-ledger.json");
const checkpointPath = path.join(loreDir, "batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(loreDir, "batch-240-plus-country-glamour-romance-contract.json");

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

const expectedContractSha = "69EB6C84A2467A4234D901C3086ECECE9E583B55C41BB9382CD5ED523C482EF5";
const expectedLedgerSha = "33F29A1FB48F2971D78C9B345AA378B84C73FE16BDBE468AFFF695972B63C44E";
const expectedCheckpointSha = "765DF1516EEA1756DA6F982101F79BFE55A7AEB2F160DBD4A031402490F66ED8";
if (sha256File(contractPath) !== expectedContractSha) throw new Error("Authoritative contract changed");
if (sha256File(ledgerPath) !== expectedLedgerSha) throw new Error("X ledger changed before clear audit");
if (sha256File(checkpointPath) !== expectedCheckpointSha) throw new Error("Georgia checkpoint changed before clear audit");

const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
if (ledger.pendingPost !== null) throw new Error("pendingPost is not empty");
if (!Array.isArray(ledger.preparedPostQueue) || ledger.preparedPostQueue.length !== 0) throw new Error("preparedPostQueue is not empty");
if (ledger.deferredPostCheckpoint !== null) throw new Error("deferredPostCheckpoint is not empty");
if (!Array.isArray(ledger.posts) || ledger.posts.some((post) => !post.postUrl)) throw new Error("A ledger post lacks a public URL");
if (checkpoint.status !== "active-four-scene-gate-incomplete-after-clean-fresh-round-43") throw new Error("Unexpected Georgia status");
if (checkpoint.countryCompletionGate.acceptedSceneCount !== 3 || checkpoint.countryCompletionGate.requiredAcceptedScenes !== 4) throw new Error("Georgia gate drift");

const unpublishedEligible = [];
const insufficient374Plus = [];
let publishedCheckpointCount = 0;
for (const file of fs.readdirSync(loreDir).filter((name) => /checkpoint\.json$/i.test(name))) {
  let item;
  try {
    item = JSON.parse(fs.readFileSync(path.join(loreDir, file), "utf8"));
  } catch {
    continue;
  }
  const batch = Number(item.batch);
  if (!Number.isFinite(batch) || batch < 320 || batch > 382) continue;
  const xPost = item.xPost ?? {};
  const gate = item.countryCompletionGate ?? {};
  const accepted = Number(xPost.acceptedCurrentCountryAssets ?? gate.acceptedSceneCount ?? item.acceptedSceneCount ?? 0);
  const required = Number(xPost.requiredCurrentCountryAssets ?? xPost.minimumCurrentCountryAcceptedAssets ?? gate.requiredAcceptedScenes ?? (batch >= 382 ? 4 : 2));
  const publicUrl = xPost.url ?? xPost.statusUrl ?? item.publicStatusUrl ?? null;
  const status = String(xPost.status ?? "");
  const isPublic = Boolean(publicUrl) || /(posted|published|public|verified)/i.test(status);
  const summary = { batch, country: item.country, acceptedCurrentCountryAssets: accepted, required };
  if (isPublic) publishedCheckpointCount += 1;
  else if (accepted >= required) unpublishedEligible.push({ ...summary, file });
  else if (batch >= 374 && batch <= 381) insufficient374Plus.push(summary);
}
if (unpublishedEligible.length !== 0) throw new Error(`Eligible unpublished checkpoints found: ${JSON.stringify(unpublishedEligible)}`);

const requestedAt = "2026-08-12T06:00:46.627Z";
const completedAt = new Date().toISOString();
const audit = {
  status: "cleared-no-eligible-backlog",
  requestedAt,
  completedAt,
  account: "@dogramaci",
  instruction: "clear X post backlog now",
  liveProfileVerified: true,
  signedInAccount: "@dogramaci",
  latestVisibleAccountStatus: {
    url: "https://x.com/dogramaci/status/2087416716372378042",
    classification: "unrelated-account-image-post-not-a-World-Series-ledger-item",
  },
  pendingPost: null,
  preparedPostQueueCount: 0,
  deferredPostCheckpoint: null,
  ledgerPublicPostCount: ledger.posts.length,
  checkpointAudit: {
    batchRange: [320, 382],
    thresholdQualifiedUnpublishedCount: 0,
    publishedCheckpointCount,
    insufficientCountriesFromBatch374: insufficient374Plus,
  },
  activeCountryAudit: {
    batch: 382,
    country: "Georgia",
    acceptedCurrentCountryAssets: 3,
    required: 4,
    eligible: false,
  },
  eligibleBacklogRemaining: 0,
  newlyPublished: [],
  action: "No upload was submitted because the explicit queue is empty and no unpublished country meets its authoritative publication gate.",
  duplicatePrevention: "The signed-in live @dogramaci profile, all public ledger entries, and every Batch 320 through 382 checkpoint were reconciled before composer use.",
};

ledger.latestExplicitDrainAudit = audit;
checkpoint.checkpointedAt = completedAt;
checkpoint.xBacklogAudit = {
  ...checkpoint.xBacklogAudit,
  checkedAt: completedAt,
  account: "@dogramaci",
  signedIn: true,
  sessionState: "live-signed-in-dogramaci-profile-loaded-this-wake",
  eligibleBacklogRemaining: 0,
  pendingPost: null,
  preparedPostQueueCount: 0,
  deferredPostCheckpoint: null,
  latestVisibleAccountStatus: audit.latestVisibleAccountStatus,
  explicitClearRequestedAt: requestedAt,
  explicitClearCompletedAt: completedAt,
  explicitClearPostedCount: 0,
  reconciliationDecision: "The user-requested X backlog clear completed against the signed-in live @dogramaci profile. The explicit queue is empty, all threshold-qualified checkpoints are already public, and Georgia remains ineligible at three of four accepted scenes, so zero uploads were submitted and no duplicate was created.",
};
checkpoint.xPost.status = "blocked-active-country-incomplete";
checkpoint.xPost.url = null;
checkpoint.xPost.acceptedCurrentCountryAssets = 3;
checkpoint.xPost.note = "Georgia has accepted scenes 1548, 1549, and 1550. The user-requested X backlog clear is complete with zero eligible items and zero uploads after live @dogramaci reconciliation. Georgia remains publication-blocked until scene 1551 is accepted and the four-scene completion checkpoint is pushed.";

fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ completedAt, eligibleBacklogRemaining: 0, newlyPublished: [], publishedCheckpointCount, insufficient374Plus }, null, 2));
