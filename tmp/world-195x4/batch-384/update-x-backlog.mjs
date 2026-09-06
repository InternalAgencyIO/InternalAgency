import fs from "node:fs";

const file = "assets/lore/starlight-era/world-x-publish-ledger.json";
const ledger = JSON.parse(fs.readFileSync(file, "utf8"));
ledger.continuousDrainPolicy.activeCountryRule = "From Batch 382 onward, publish only after all four current-country scenes are accepted. A 4/4 country without a live-verified public status remains in the eligible X backlog, but browser or session unavailability does not block bounded render-queue advancement after its archive, ledgers, checkpoint, explicit Git push, and remote SHA are verified. Never mark it published or remove it from backlog without its verified public URL.";
ledger.continuousDrainPolicy.duplicatePrevention = "Reconcile the signed-in @dogramaci profile before every upload. A latest-four-only timeline view is not proof that an older candidate is absent; preserve every such country as live-unverified and do not upload until exact-caption and media reconciliation is possible or its existing public URL is found.";
ledger.latestGuardianWakeAudit = {
  status: "three-eligible-country-posts-live-unverified-browser-unavailable",
  checkedAt: "2026-08-13T14:02:00.000Z",
  account: "@dogramaci",
  liveProfileVerified: false,
  signedInAccount: null,
  pendingPost: null,
  preparedPostQueueCount: 0,
  deferredPostCheckpoint: null,
  eligibleBacklogRemaining: 3,
  checkpointAudit: {
    batchRange: [382, 384],
    eligibleWithNoRecordedUrlCount: 3,
    eligibleWithNoRecordedUrl: [
      {batch:382,country:"Georgia",checkpoint:"assets/lore/starlight-era/batch-382-georgia-mars-surface-expedition-checkpoint.json",acceptedCurrentCountryAssets:4,required:4,eligible:true,caption:"Georgia ❤️ Honduras #Georgia #InternalAgency",recordedUrl:null,liveState:"unverified-no-fresh-duplicate-proof"},
      {batch:383,country:"Fiji",checkpoint:"assets/lore/starlight-era/batch-383-fiji-moon-surface-expedition-checkpoint.json",acceptedCurrentCountryAssets:4,required:4,eligible:true,caption:"Fiji ❤️ Georgia #Fiji #InternalAgency",recordedUrl:null,liveState:"unverified-no-fresh-duplicate-proof"},
      {batch:384,country:"Comoros",checkpoint:"assets/lore/starlight-era/batch-384-comoros-moon-surface-expedition-checkpoint.json",acceptedCurrentCountryAssets:4,required:4,eligible:true,caption:"Comoros ❤️ Fiji #Comoros",recordedUrl:null,liveState:"unverified-no-fresh-duplicate-proof"}
    ]
  },
  activeCountryAudit: {batch:384,country:"Comoros",acceptedCurrentCountryAssets:4,required:4,eligible:true},
  latestVisibleAccountStatuses: [],
  action: "Browser access was unavailable. No composer opened, no media uploaded, and no Post click occurred; all three locally eligible countries remain live-unreconciled.",
  duplicatePrevention: "Do not reserve, upload, append a posts entry, or write a checkpoint URL until signed-in @dogramaci reconciliation proves absence or returns the existing public status URL. The latest-four window is insufficient evidence for older posts."
};
fs.writeFileSync(file, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
