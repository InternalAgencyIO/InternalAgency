import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(".");
const root = path.join(repo, "tmp/world-195x4/batch-382");
const lore = path.join(repo, "assets/lore/starlight-era");
const checkpointPath = path.join(lore, "batch-382-georgia-mars-surface-expedition-checkpoint.json");
const contractPath = path.join(lore, "batch-240-plus-country-glamour-romance-contract.json");
const ledgerPath = path.join(lore, "world-x-publish-ledger.json");
const rawDir = path.join(root, "raw/round-49-four-slot-bank");
const completedAt = new Date().toISOString();

const sha256File = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
const expected = {
  A: "3C28A5039BF32E3062DE0BBDC042918639DD0E9FEB587419C130250CEF4F9332",
  B: "8F5A512DD95272945E8192BA78B54EE8CDB5DE25321D82F4CB49C7707C30457E",
  C: "5AD71ADAF8FFA55B4E30450355BFA44358F65B77E8D408CEDABE2D36C3B0077C",
  D: "303EABD03A3CD3BCED1AB38920648523A0E13B0F152EFEE312EA8DD8F94FC525",
};

const slotAudit = {
  A: {
    accepted: false,
    identity: "pass-exactly-four-distinct-clearly-adult-anchored-women-with-Alia-only-braided-ponytail",
    anatomy: "pass-eight-traceable-human-arms-and-eight-traceable-human-hands-but-hand-role-ownership-fails",
    locationWeather: "pass-recognizable-Batumi-Alphabet-Tower-Ferris-wheel-Black-Sea-palms-and-heavy-straight-rain",
    wardrobe: "partial-Radiance-open-back-knee-hosiery-Ellie-midriff-and-Alia-midriff-read; reject-Alia-neck-connector-and-braids-obstruct-the-required-completely-open-back-and-ECE-circular-badge-like-discs-violate-civilian-no-insignia-styling",
    romance: "reject-the-group-reads-as-an-upright-embrace-not-the-stored-supported-dip-and-ECE-adds-contact-instead-of-keeping-both-hands-on-the-compass",
    radianceResponse: "partial-Radiance-and-ECE-smile-and-meet-each-other-but-the-recorded-up-down-nod-is-not-certifiable",
    partyActivation: "reject-the-A-specific-Radiance-ECE-party-evidence-is-incomplete-and-hand-geometry-changed",
    mascots: "pass-one-tiny-collarless-golden-PAWS-and-one-small-young-golden-MAX-on-one-raised-dry-lounge",
    oddProp: "reject-ECE-does-not-own-two-tall-opposite-compass-handles",
    missionHandling: "reject-Alia-has-two-mission-hands-but-the-trigger-index-is-curled-or-visually-merged-at-the-guard-rather-than-independently-straight-above-and-outside-it",
    missionTargetAxis: "reject-the-black-diamond-paper-is-far-below-the-muzzle-row-and-the-complete-backstop-leaves-only-a-narrow-edge-strip-not-eleven-percent-empty-promenade",
    decisiveRejectionReasons: [
      "ECE abandons the two-handle compass ownership and adds unrolled contact, so the exact eight-hand role graph and stored dip do not pass.",
      "Alia's trigger index is not independently straight above and outside the empty guard.",
      "The paper diamond is substantially below the muzzle axis.",
      "The complete backstop leaves far less than eleven percent empty promenade to the right edge.",
      "Alia's open-back construction and the candidate-specific affirmative evidence are not fully certifiable.",
    ],
  },
  B: {
    accepted: false,
    identity: "pass-exactly-four-distinct-clearly-adult-anchored-women-with-Alia-only-braided-ponytail",
    anatomy: "pass-eight-traceable-human-arms-and-eight-traceable-human-hands-with-two-per-woman",
    locationWeather: "pass-recognizable-Batumi-Alphabet-Tower-Ferris-wheel-Black-Sea-palms-and-heavy-straight-rain",
    wardrobe: "reject-Radiance-has-a-rear-neck-connector-instead-of-an-uninterrupted-open-back-and-Alia-has-visible-shoulder-neck-connectors-instead-of-the-active-strapless-fully-open-back-shell; midriffs-and-hosiery-otherwise-read",
    romance: "reject-Radiance-is-standing-upright-and-uses-two-ECE-torso-contacts-rather-than-one-outer-upper-arm-palm-while-Ellie-does-not-materialize-the-exact-high-back-support",
    radianceResponse: "partial-the-calm-noncelebratory-ECE-gaze-suits-the-stored-pause-but-the-required-splayed-outer-upper-arm-hold-cue-is-not-exact",
    partyActivation: "pass-no-party-celebration-is-visible-for-the-explicit-pause",
    mascots: "pass-one-tiny-collarless-golden-PAWS-and-one-small-young-golden-MAX-on-one-raised-dry-lounge",
    oddProp: "pass-ECE-owns-two-separated-compass-handles-and-the-route-map-is-hands-free",
    missionHandling: "reject-Alia's-trigger-index-enters-or-overlaps-the-guard-instead-of-remaining-independently-straight-above-and-outside-it",
    missionTargetAxis: "reject-the-paper-diamond-is-below-the-muzzle-row-and-the-backstop-sits-at-the-right-edge-without-eleven-percent-empty-reserve",
    decisiveRejectionReasons: [
      "The stored controlled dip and exact three-contact graph are absent.",
      "Radiance and Alia fail their active open-back construction gates, and Alia is not unambiguously strapless.",
      "Alia's trigger index overlaps or enters the guard.",
      "The paper diamond is below the muzzle axis.",
      "The complete backstop leaves no certifiable eleven-percent empty promenade beyond it.",
    ],
  },
  C: {
    accepted: false,
    identity: "pass-exactly-four-distinct-clearly-adult-anchored-women-with-Alia-only-braided-ponytail",
    anatomy: "pass-eight-traceable-human-arms-and-eight-traceable-human-hands-but-compass-and-contact-role-ownership-fails",
    locationWeather: "pass-recognizable-Batumi-Ferris-wheel-Black-Sea-skyline-palms-and-heavy-straight-rain",
    wardrobe: "partial-Radiance-open-back-knee-hosiery-Ellie-midriff-and-Alia-midriff-read; reject-Alia's-neck-connector-and-braids-obstruct-the-active-strapless-fully-open-back-gate",
    romance: "reject-Radiance-holds-a-compass-handle-instead-of-touching-ECE's-outer-upper-arm-and-the-pose-is-an-unsupported-lean-without-the-exact-high-back-support",
    radianceResponse: "partial-Radiance-and-ECE-share-a-warm-gaze-but-the-recorded-nod-and-exact-maintained-ECE-contact-are-not-certifiable",
    partyActivation: "reject-the-C-specific-Radiance-Alia-ECE-willing-evidence-is-incomplete-and-Radiance-changes-the-compass-hand-graph",
    mascots: "pass-one-tiny-collarless-golden-PAWS-and-one-small-young-golden-MAX-on-one-raised-dry-lounge",
    oddProp: "reject-Radiance-borrows-one-compass-handle-so-ECE-is-not-the-exclusive-two-handle-owner",
    missionHandling: "reject-Alia's-trigger-index-is-curled-or-visually-merged-at-the-guard-rather-than-independently-straight-above-and-outside-it",
    missionTargetAxis: "reject-the-paper-diamond-is-far-below-the-muzzle-row-and-the-backstop-leaves-only-a-thin-right-edge-strip",
    decisiveRejectionReasons: [
      "Radiance borrows a compass handle, so ECE's exclusive two-hand odd-prop ownership and the exact third relationship contact fail.",
      "The supported controlled dip and three-contact graph are not exact.",
      "Alia's trigger index is not independently straight above and outside the guard.",
      "The paper diamond is substantially below the muzzle axis.",
      "The complete backstop leaves far less than eleven percent empty promenade beyond it.",
    ],
  },
  D: {
    accepted: false,
    identity: "pass-exactly-four-distinct-clearly-adult-anchored-women-with-Alia-only-braided-ponytail",
    anatomy: "reject-Radiance's-lowered-right-hand-is-discolored-and-malformed-and-the-required-hand-role-graph-is-not-traceable-exactly",
    locationWeather: "pass-recognizable-Batumi-Alphabet-Tower-Ferris-wheel-Black-Sea-palms-and-heavy-straight-rain",
    wardrobe: "partial-Radiance-open-back-and-Alia-midriff-strapless-shell-read; reject-only-one-knee-hosiery-leg-is-clearly-certifiable-Alia's-braids-obstruct-the-open-back-and-ECE-circular-badge-like-discs-violate-the-no-insignia-civilian-style",
    romance: "reject-ECE-uses-both-hands-on-Radiance-instead-of-the-compass-Radiance's-required-ECE-upper-arm-palm-is-absent-and-the-pose-does-not-read-as-the-exact-supported-dip",
    radianceResponse: "partial-Radiance-and-ECE-smile-and-meet-each-other-but-the-recorded-nod-is-not-certifiable",
    partyActivation: "reject-the-D-specific-all-four-party-evidence-is-incomplete-and-the-hand-geometry-changed",
    mascots: "pass-one-tiny-collarless-golden-PAWS-and-one-small-young-golden-MAX-on-one-raised-dry-lounge",
    oddProp: "reject-ECE-abandons-the-two-compass-handles-and-the-pedestal-has-no-certifiable-opposite-handles",
    missionHandling: "reject-Alia's-trigger-index-touches-or-overlaps-the-guard-rather-than-showing-a-full-air-gap-above-and-outside-it",
    missionTargetAxis: "reject-the-paper-diamond-is-far-below-the-muzzle-row-and-the-complete-backstop-leaves-only-a-narrow-edge-strip",
    decisiveRejectionReasons: [
      "Radiance has a malformed discolored lowered hand, failing strict anatomy and hand ownership.",
      "ECE abandons both compass handles and adds unrolled support contacts; the exact dip graph is absent.",
      "Alia's trigger index is not independently separated above and outside the empty guard.",
      "The paper diamond is substantially below the muzzle axis.",
      "The complete backstop leaves far less than eleven percent empty promenade beyond it.",
    ],
  },
};

const rawRecords = [];
const rejectionRecords = [];
for (const slot of Object.keys(expected)) {
  const file = path.join(rawDir, `candidate-${slot}.png`);
  if (!fs.existsSync(file)) throw new Error(`Missing round-49 raw ${file}`);
  const sha256 = sha256File(file);
  if (sha256 !== expected[slot]) throw new Error(`Round-49 candidate ${slot} hash mismatch: ${sha256}`);
  const relative = path.relative(repo, file).replaceAll("\\", "/");
  rawRecords.push({
    scene: 1551,
    round: 49,
    kind: "four-slot-clean-candidate-rejected",
    candidateSlot: slot,
    path: relative,
    sourcePath: {
      A: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-8895728e-3840-4848-9921-f318c0450d8f.png",
      B: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-c87f88e7-7bc5-4e08-b62c-4b154f0154da.png",
      C: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-940364ad-e21e-4c5d-b8c7-cf868555e9c5.png",
      D: "C:/Users/A/.codex/generated_images/019fd625-0bf6-78d2-9fb8-3f3e22c1d086/exec-538ae1f4-30fb-4d53-b354-e5611ee17044.png",
    }[slot],
    sha256,
    dimensions: { width: 941, height: 1672 },
    preserved: true,
  });
  rejectionRecords.push({
    scene: 1551,
    round: 49,
    phase: "four-slot-parallel-bank",
    candidateSlot: slot,
    status: "rejected-strict-visual-audit",
    rawOutput: relative,
    sourceRawOutput: rawRecords.at(-1).sourcePath,
    sha256,
    dimensions: { width: 941, height: 1672 },
    decisiveRejectionReasons: slotAudit[slot].decisiveRejectionReasons,
    recoveryPassConsumedThisRound: false,
  });
}

const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const policy = contract.rapidConsolidatedRenderPolicy;
policy.roundDefinition = "One render pass is one coordinated four-slot candidate bank. Launch exactly four independent image candidates concurrently in one orchestration, allocated only across currently missing or rejected scenes. The complete four-candidate bank counts as one pass regardless of how many slots target the same scene.";
policy.countryRoundCeiling = 2;
policy.countryRoundShape = "Exactly one initial four-slot bank may be followed by at most one consolidated four-slot correction bank. Stop sooner when all four scenes pass; never open a third automatic bank.";
policy.perSceneGenerationCeiling = "A scene may receive at most four clean candidates in a pass. Across one country, automated generation is limited to the two authorized four-slot banks.";
policy.correctionPassCeiling = 1;
policy.capExhaustionRule = "After the second four-slot bank, stop automated image generation. Preserve accepted scenes, keep the same incomplete country active and nonterminal, record and push every unresolved gate, notify the user, and wait for an explicit contract change or an independently accepted asset. Never open another render window, publish early, or advance countries.";
policy.persistentContinuationAuthorization.active = false;
policy.persistentContinuationAuthorization.supersededAt = completedAt;
policy.persistentContinuationAuthorization.supersededBy = "twoBankThroughputPolicy";
policy.persistentContinuationAuthorization.effect = "Superseded. Successive automatic continuation windows are forbidden after the second four-slot bank.";
policy.persistentContinuationAuthorization.wakePolicy = "Superseded. Later guardian wakes inspect and reconcile state but do not open another render bank without an explicit contract change.";
policy.twoBankThroughputPolicy = {
  active: true,
  requestedAt: completedAt,
  userDirective: "make all your edits in 2 passes and move on; never move on without 4 posts ready per country; use less renders; 4 parallel 7/24",
  scope: "Georgia Batch 382 and every later country until explicitly changed",
  passesPerCountry: 2,
  slotsPerPass: 4,
  execution: "Pass one is the initial coordinated bank. Pass two is one holistic correction bank that combines every known defect. Launch all four slots concurrently, preserve every raw, and never rerender an accepted scene.",
  completionGate: "Advancement still requires four accepted current-country scene assets, the narrow checkpoint committed and pushed to the recovery branch, and one publicly verified X status URL.",
  exhaustion: "If fewer than four scenes are accepted after pass two, stop automatic rendering, keep the country active and nonterminal, block X and the next country, and notify the user. A later heartbeat audits state but does not create a third bank.",
};
policy.fixedFourSlotParallelRenderBank.waveCeilingInteraction = "Exactly two four-slot banks per country maximum: one initial bank and one consolidated correction bank. Individual candidates are not separate passes, and no continuation window opens after bank two.";
policy.persistentContinuationAuthorization.currentGeorgiaWindow = {
  sceneNumbers: [1551],
  preservedAcceptedSceneNumbers: [1548, 1549, 1550],
  authorizedWaveNumbers: [48, 49],
  status: "completed-final-two-bank-cap-rejected",
  completedAt,
  acceptedSceneNumbersChanged: false,
  result: "All eight clean candidates from rounds 48 and 49 were preserved and rejected. Round 49 retained four distinct adults, Batumi, heavy rain, mascots, distinct couture, and a complete target assembly, but no slot simultaneously passed exact relationship and compass-hand ownership, the independently straight trigger index, the horizontal paper-target axis, and at least eleven percent empty promenade beyond the complete backstop.",
  unresolvedGates: [
    "restore the exact supported controlled dip with only the three recorded relationship contacts",
    "ECE alone owns both opposite compass handles while Radiance touches only ECE's outer upper arm",
    "one independently readable straight trigger index entirely above and outside the empty guard",
    "black diamond center exactly horizontal with the eye-sights-barrel-muzzle row",
    "one complete backstop followed by at least eleven percent visibly empty promenade",
    "preserve both active open backs, Alia strapless construction, and candidate-specific consent evidence without adding badge-like styling",
  ],
  nextWindow: null,
  additionalAutomatedBanksAllowed: 0,
  automaticRenderingStopped: true,
  explicitContractChangeRequiredForAnotherBank: true,
};
fs.writeFileSync(contractPath, `${JSON.stringify(contract, null, 2)}\n`, "utf8");

const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
checkpoint.rawOutputs = checkpoint.rawOutputs.filter((item) => !(item.round === 49 && item.candidateSlot));
checkpoint.rawOutputs.push(...rawRecords);
checkpoint.rejectedAssets = checkpoint.rejectedAssets.filter((item) => !(item.round === 49 && item.candidateSlot));
checkpoint.rejectedAssets.push(...rejectionRecords);
checkpoint.status = "active-two-bank-render-cap-exhausted-scene-1551-unresolved";
checkpoint.checkpointedAt = completedAt;
checkpoint.contractSha256 = sha256File(contractPath);
checkpoint.terminal = false;
checkpoint.countryCompletionGate = {
  ...checkpoint.countryCompletionGate,
  acceptedSceneCount: 3,
  missingSceneNumbers: [1551],
  gitCheckpointPushed: true,
  queueAdvanceAllowed: false,
  xPublicStatusVerified: false,
  gateSatisfied: false,
};
checkpoint.rapidConsolidatedClosureWindow = {
  ...checkpoint.rapidConsolidatedClosureWindow,
  status: "completed-final-two-bank-cap-rejected-automatic-rendering-stopped",
  currentWave: 49,
  remainingWaves: 0,
  completedAt,
  acceptedSceneNumbersChanged: false,
  nextWindowRounds: [],
  nextWindowStatus: "forbidden-without-explicit-contract-change",
};
const bank = checkpoint.contractAmendments.fixedFourSlotParallelRenderBank;
bank.round49Preparation = {
  ...bank.round49Preparation,
  status: "completed-rejected-strict-visual-audit",
  completedAt,
  rawOutputs: rawRecords,
  slotAudit,
  auditOrder: ["A", "B", "C", "D"],
  acceptedCandidate: null,
  allRejected: true,
  acceptedSceneNumbersChanged: false,
};
bank.completedWindow48And49 = {
  completedAt,
  rounds: [48, 49],
  candidatesGenerated: 8,
  allRawOutputsPreserved: true,
  acceptedCandidate: null,
  acceptedSceneNumbersChanged: false,
  countryRemainsActive: true,
  terminal: false,
  queueAdvanceAllowed: false,
  xPublishAllowed: false,
  additionalRenderThisWakeAllowed: false,
  additionalAutomatedBanksAllowed: 0,
  nextWindowRounds: [],
  nextWindowOpensOn: null,
  automaticRenderingStopped: true,
};
checkpoint.xBacklogAudit = {
  ...checkpoint.xBacklogAudit,
  checkedAt: completedAt,
  signedIn: true,
  sessionState: "live-signed-in-dogramaci-profile-loaded-this-wake",
  eligibleBacklogRemaining: 0,
  pendingPost: null,
  preparedPostQueueCount: 0,
  deferredPostCheckpoint: null,
  reconciliationDecision: "The signed-in live @dogramaci profile and authoritative ledger show no eligible World Series backlog item. Georgia remains publication-blocked at three accepted scenes after rounds 48 and 49, so no upload or country advance occurred.",
};
checkpoint.xPost = {
  ...checkpoint.xPost,
  status: "blocked-active-country-incomplete",
  url: null,
  acceptedCurrentCountryAssets: 3,
  note: "Georgia retains accepted scenes 1548-1550. All four round-49 candidates were preserved and rejected under strict audit. The signed-in live @dogramaci profile is verified and the eligible backlog remains empty. Scene 1551, X publication, Fiji, and every later country remain blocked. The two-bank cap is exhausted, so no third automatic bank may open.",
};
checkpoint.nextWakeAction = {
  country: "Georgia",
  batch: 382,
  action: "hold-Georgia-active-and-audit-for-an-explicit-contract-change-or-an-independently-accepted-scene-1551-asset-without-automatic-rendering",
  preserveAcceptedSceneNumbers: [1548, 1549, 1550],
  sceneNumbers: [1551],
  unresolvedGates: policy.persistentContinuationAuthorization.currentGeorgiaWindow.unresolvedGates,
  laterCountryStartAllowed: false,
  xPublishAllowed: false,
  automaticRenderAllowed: false,
  additionalAutomatedBanksAllowed: 0,
};
checkpoint.latestProgressCheckpoint = {
  status: "committed-and-pushed",
  preparedAt: completedAt,
  branch: "agent/iat-launch-window-recovery-batch-220",
  auditRounds: [48, 49],
  acceptedSceneCount: 3,
  missingSceneNumbers: [1551],
};
fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");

const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
ledger.latestGuardianWakeAudit = {
  ...ledger.latestGuardianWakeAudit,
  status: "clear-no-eligible-backlog-georgia-final-two-bank-cap-closed",
  checkedAt: completedAt,
  liveProfileVerified: true,
  signedInAccount: "@dogramaci",
  pendingPost: null,
  preparedPostQueueCount: 0,
  deferredPostCheckpoint: null,
  eligibleBacklogRemaining: 0,
  activeCountryAudit: { batch: 382, country: "Georgia", acceptedCurrentCountryAssets: 3, required: 4, eligible: false },
  renderWindowAudit: { rounds: [48, 49], candidateCount: 8, acceptedSceneNumbersChanged: false, nextWindowRounds: [], nextWindowStatus: "forbidden-without-explicit-contract-change", additionalAutomatedBanksAllowed: 0 },
  action: "No upload was submitted because the eligible queue is empty and Georgia remains below its authoritative four-accepted-scene gate.",
  duplicatePrevention: "Do not classify unrelated recent account posts as Georgia's required three-attachment publication and do not upload Georgia before scene 1551 is accepted.",
};
fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  status: checkpoint.status,
  completedAt,
  round49AllRejected: true,
  rawHashes: Object.fromEntries(rawRecords.map((item) => [item.candidateSlot, item.sha256])),
  acceptedSceneCount: checkpoint.countryCompletionGate.acceptedSceneCount,
  missingSceneNumbers: checkpoint.countryCompletionGate.missingSceneNumbers,
  terminal: checkpoint.terminal,
  nextWakeAction: checkpoint.nextWakeAction.action,
  additionalRenderThisWakeAllowed: false,
  xBacklogRemaining: ledger.latestGuardianWakeAudit.eligibleBacklogRemaining,
}, null, 2));
