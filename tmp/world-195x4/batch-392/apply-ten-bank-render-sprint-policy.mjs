import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const contractPath = "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json";
const checkpointPath = "assets/lore/starlight-era/batch-392-maldives-orbital-research-station-checkpoint.json";
const requestedAt = "2026-08-20T15:07:00.000Z";
const sha256 = (value) => createHash("sha256").update(value).digest("hex").toUpperCase();

const contract = JSON.parse(readFileSync(contractPath, "utf8"));
const rolling = contract.rapidConsolidatedRenderPolicy.metaAiContinuousRollingRenderPolicy;
rolling.tenBankRenderSprintPolicy = {
  active: true,
  requestedAt,
  userDirective: "Keep renders running and use ten quick four tab banks before the deeper comparison and final selection.",
  scope: "Applies prospectively to each authoritative active country after all prior country closure gates pass. It never reopens a resolved scene or country.",
  sprintSize: {
    fourTabBanksMaximumBeforeDeepComparison: 10,
    promptsPerBank: 4,
    persistentTabs: 4,
    imagesRequestedPerPrompt: 1,
    maximumRequestedImagesPerFullSprint: 40
  },
  dispatchPriority: "Render first. As soon as a lane output arrives, capture provider text and download its raw file, hash it, append the minimum occurrence envelope, then dispatch the next prepared prompt in that same lane without waiting for unrelated lanes or deep aesthetic scoring.",
  immediateEvidenceGate: "Before the next prompt in a lane, preserve exact primary and fallback text, prompt hash, reference hashes, UTC, response or refusal text, raw bytes and SHA-256 or explicit no-bytes provenance, dimensions when media exists, and a technical validity state. Never overwrite or omit an output.",
  deferredQaRule: "Defer detailed face, anatomy, mission, wardrobe, camera, love, RAZE, mascot and comparative aesthetic scoring until the sprint reaches ten completed four tab banks, Meta stops, or a clearly sufficient evidence pool exists and the user changes direction. Completed files may remain downloaded-pending-deep-qa during the sprint.",
  selectionBarrier: "No candidate becomes canonical and nothing is published, queued forward, committed or pushed as a selection until every sprint occurrence is fully classified, all rejection and failure evidence is appended, the archive collector and both ledger verifiers pass, and Git and LFS parity are complete.",
  safetyRule: "Prompts remain clearly adult, public safe and moderation compatible. Never use bypass tactics. Never select unsafe, cloned, corrupt or grossly malformed media. Meta account, moderation, rate and availability limits remain authoritative.",
  noFillerRule: "A scene is unresolved throughout its scheduled sprint. Once deep comparison resolves it, stop that scene and never create filler. Already running outputs are preserved as superseded unused.",
  supersedesProspectively: [
    "the one successor maximum for downloaded pending deep QA during an active ten bank sprint",
    "the requirement to perform deep visual QA before every second successor"
  ],
  doesNotSupersede: [
    "immediate raw download and hash before lane reuse",
    "append only occurrence evidence",
    "provider moderation and rate limits",
    "hard safety and identity gates before selection",
    "archive ledger Git and LFS parity before acceptance publication or queue advance",
    "the bounded ChatGPT clothing finalization after Meta source selection"
  ]
};
rolling.dispatchRule = "During an active ten bank sprint, reuse exactly four persistent Meta tabs. Each tab requests one distinct image. Download, hash and append the minimum occurrence envelope immediately, then dispatch the next prepared prompt in that lane. Perform deep comparative QA after up to ten completed four tab banks. Outside a sprint, use the normal evidence first rolling rule.";
rolling.evidenceFirstDispatchGate = "During an active ten bank sprint, raw bytes or explicit no-bytes provenance plus exact prompt, response, UTC, reference hashes and technical validity must exist before that lane is reused. Deep aesthetic QA may wait for the sprint comparison barrier.";
rolling.rejectionCatchUpGate = "Before any selection, acceptance, publication, queue advance, commit or push, fully classify every sprint occurrence and append every rejection, refusal, upload failure, block, zero-byte, corrupt, unused and superseded outcome. Never leave evidence behind.";

writeFileSync(contractPath, `${JSON.stringify(contract, null, 2)}\n`);
const contractSha256 = sha256(readFileSync(contractPath));

const checkpoint = JSON.parse(readFileSync(checkpointPath, "utf8"));
checkpoint.contractSha256 = contractSha256;
checkpoint.policy.tenBankRenderSprintPolicy = {
  active: true,
  requestedAt,
  appliesFrom: "next authoritative Meta sprint after Maldives Batch 392 closure",
  banksBeforeDeepComparison: 10,
  fourConcurrentTabs: true,
  immediateDownloadAndHash: true,
  detailedQaDeferredUntilSprintBarrier: true,
  noAcceptanceBeforeFullClassificationAndParity: true
};
const eventId = "batch-392-ten-bank-render-sprint-policy-activated-prospectively";
const event = {
  eventId,
  batch: 392,
  scene: null,
  provider: "user-policy",
  phase: "render-throughput-policy-change",
  observedAtUtc: requestedAt,
  disposition: "prospective-ten-bank-four-tab-sprint",
  detail: "The next active country uses up to ten fast four tab render banks with immediate per-output download, hash and minimum occurrence evidence. Deep comparative QA follows the sprint. Full classification and archive, ledger, Git and LFS parity remain mandatory before selection or publication.",
  maldivesMetaSourcesRemainResolved: true,
  noMaldivesFillerAuthorized: true,
  immutable: true
};
const existingEventIndex = checkpoint.events.findIndex((item) => item.eventId === eventId);
if (existingEventIndex === -1) checkpoint.events.push(event);
else checkpoint.events[existingEventIndex] = event;
writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);

console.log(JSON.stringify({ contractSha256, eventId, nextSprintBanks: 10, tabs: 4 }, null, 2));
