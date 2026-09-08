import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("tmp/world-195x4/batch-296");
const preflightPath = path.join(root, "batch-296-slovakia-preflight.json");
const contractPath = path.resolve("assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json");
const checkpointPath = path.resolve("assets/lore/starlight-era/batch-296-slovakia-recovery-checkpoint.json");
const checkpoint = JSON.parse(fs.readFileSync(preflightPath, "utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase();
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

const allPairs = [
  ...checkpoint.rollAudit.primaryRollPairs,
  ...checkpoint.rollAudit.hosierySelectorPairs
];
const mismatches = allPairs.filter(([key, value]) => fnv1a(key) % 100 !== value);
if (mismatches.length !== 0) throw new Error(`Roll mismatch: ${JSON.stringify(mismatches)}`);
const contractSha256 = sha256(fs.readFileSync(contractPath));
if (contractSha256 !== checkpoint.contractSha256) {
  throw new Error(`Contract drift: ${checkpoint.contractSha256} -> ${contractSha256}`);
}

checkpoint.status = "blocked-no-accepted-assets";
checkpoint.terminalAt = new Date().toISOString();
checkpoint.rollAudit.mismatchCount = mismatches.length;
checkpoint.renderAttempts.recovery = {
  status: "complete-audited-no-accepted-assets",
  maximumPerBlockedScene: 1,
  strategy: "One fresh public-safe generation per scene with shallow-arc staging, visible separated hands, an empty lateral downrange lane, and the handler's index finger laid flat high on the outer frame above an unobscured trigger guard.",
  results: {
    "1204": {
      status: "rejected-terminal",
      source: "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086\\exec-5bd54a46-00c6-4168-8f52-eafbb87db713.png",
      audit: [
        "ECE's index finger still appears inside or pressed against the trigger guard rather than visibly straight high along the outer frame.",
        "Ellie's triggered strapless architecture and Alia's recorded cropped outfit are not materialized on their anchored identities.",
        "Several affectionate hands differ from the recorded recovery inventory, so exactly eight continuously traceable hands cannot be certified.",
        "Bratislava Castle, thunderstorm, four faces, country motifs, secure hems, complete footwear, and lateral empty muzzle lane are otherwise readable."
      ]
    },
    "1205": {
      status: "rejected-terminal",
      source: "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086\\exec-28950307-f7a1-4c43-8c68-031da18ba1e9.png",
      audit: [
        "ECE's index finger remains curled through or against the trigger guard.",
        "Radiance's and Ellie's triggered complete open backs are not visible in the frontal composition.",
        "The linked-hand and shoulder-contact plan is simplified but still does not fully match the recorded eight-hand inventory.",
        "Spis Castle, dramatic dust wall, four identities, belly-button triggers, large castle motifs, complete footwear, and empty lateral muzzle lane are otherwise readable."
      ]
    },
    "1206": {
      status: "rejected-terminal",
      source: "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086\\exec-ed92136d-4d4a-43dc-b1c0-6c663db28b36.png",
      audit: [
        "ECE's index finger still cannot be certified straight outside the trigger guard.",
        "The male's strongest sustained eye line remains toward Alia instead of his wife ECE.",
        "At least one hand is hidden or reassigned in the central five-person cluster, so exactly ten visible traceable hands cannot be certified.",
        "The four-woman romance square remains secondary to the male-Alia contact instead of reading clearly across the full cast.",
        "High Tatras, lake mist, five adult identities, male wardrobe, large motifs, major wardrobe rolls, and complete footwear are otherwise strong."
      ]
    },
    "1207": {
      status: "rejected-terminal",
      source: "C:\\Users\\A\\.codex\\generated_images\\019fd625-0bf6-78d2-9fb8-3f3e22c1d086\\exec-cb9b9b3e-7f18-42c5-98a7-0382da494eea.png",
      audit: [
        "ECE's index finger appears inside or pressed against the trigger guard.",
        "Ellie's triggered strapless cropped architecture is assigned to another identity while Ellie wears a covered white romper, and Alia receives an untriggered midriff.",
        "The recovery hand inventory is not fully materialized, so exactly eight traceable hands cannot be certified.",
        "Modra majolica, fujara, vineyard display, snow flurries, four identities, large culture motifs, complete footwear, and empty side lane are otherwise readable."
      ]
    }
  }
};
checkpoint.acceptedAssets = [];
checkpoint.shorteningVariants = {
  status: "not-created-no-accepted-assets",
  originalsPreserved: true,
  files: []
};
checkpoint.xPublishing = {
  eligibility: "deferred-insufficient-accepted-assets",
  minimumAcceptedCurrentCountryImages: 2,
  plannedCaption: "Slovakia red heart Slovenia #Slovakia #WorldXXXSeries",
  plannedOptionalTags: ["#WorldXXXSeries"],
  status: "deferred-insufficient-accepted-assets",
  acceptedCurrentCountryImages: 0,
  reason: "Batch 296 has fewer than two accepted current-country images, so no X compose or publish action is allowed."
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  checkpointPath,
  status: checkpoint.status,
  acceptedAssets: checkpoint.acceptedAssets.length,
  recoveryStatus: checkpoint.renderAttempts.recovery.status,
  xStatus: checkpoint.xPublishing.status,
  nextQueueCountry: checkpoint.nextQueueCountry,
  contractSha256,
  primaryPairCount: checkpoint.rollAudit.primaryPairCount,
  hosierySelectorPairCount: checkpoint.rollAudit.hosierySelectorPairCount,
  mismatchCount: checkpoint.rollAudit.mismatchCount
}, null, 2));
