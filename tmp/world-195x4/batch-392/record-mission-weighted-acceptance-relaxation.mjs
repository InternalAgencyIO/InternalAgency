import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const checkpointPath = "assets/lore/starlight-era/batch-392-maldives-orbital-research-station-checkpoint.json";
const contractPath = "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json";
const changedAtUtc = "2026-08-20T14:34:38.2414477Z";
const sha256 = (value) => createHash("sha256").update(value).digest("hex").toUpperCase();
const checkpoint = JSON.parse(readFileSync(checkpointPath, "utf8"));
checkpoint.contractSha256 = sha256(readFileSync(contractPath));
checkpoint.policy ??= {};
checkpoint.policy.missionWeightedAcceptanceRelaxation = {
  active: true,
  requestedAt: changedAtUtc,
  hardGates: [
    "clearly adult public-safe opaque presentation",
    "four recognizable anchored identities without cloning or merging",
    "valid noncorrupt media",
    "no gross anatomy corruption",
    "harmless prop and mascot handling"
  ],
  qualityTargetsOnly: [
    "knee-high versus boot construction",
    "exact two-wearer RAZE legwear split",
    "locked exterior versus attractive habitat interior",
    "exact RAZE logo geometry and sides",
    "exact camera roll and contact count",
    "exact jealousy choreography and country microdetails"
  ],
  selectionRule: "Accept the strongest compelling hard-safe face-safe image that fits the general fashion and love mission. RAZE boots and attractive indoor habitat scenes are acceptable. Preserve the already-running overlap, then select and move on."
};
checkpoint.events ??= [];
const event = {
  eventId: "batch-392-mission-weighted-acceptance-relaxation-activated",
  batch: 392,
  scene: 1588,
  provider: "user-policy",
  phase: "acceptance-policy-change",
  observedAtUtc: changedAtUtc,
  disposition: "prospective-acceptance-relaxation",
  detail: "RAZE boots and attractive indoor habitat scenes now remain acceptable when the quartet face anchors are strong and the image fits the general public-safe fashion and relationship mission. Safety, identity, gross anatomy, valid media, prop safety and mascot safety remain hard gates.",
  selectedSourceUnchanged: true,
  selectedMetaSha256: "3057271142914A4B78E3AB54942E80D6165151554696E4B7902E9BC87C19C80D",
  archiveHistoryPreserved: true,
  immutable: true
};
const index = checkpoint.events.findIndex((entry) => entry.eventId === event.eventId);
if (index >= 0) checkpoint.events[index] = event;
else checkpoint.events.push(event);
checkpoint.status = "active-scene-1588-selected-under-mission-weighted-acceptance-awaiting-archive-push-and-bounded-chatgpt-refinement";
writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(JSON.stringify({ contractSha256: checkpoint.contractSha256, selectedSourceUnchanged: true }, null, 2));
