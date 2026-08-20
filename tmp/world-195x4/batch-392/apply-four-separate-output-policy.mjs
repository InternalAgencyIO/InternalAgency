import fs from "node:fs";
import crypto from "node:crypto";

const checkpointPath = "assets/lore/starlight-era/batch-392-maldives-orbital-research-station-checkpoint.json";
const contractPath = "assets/lore/starlight-era/batch-240-plus-country-glamour-romance-contract.json";
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const contractBytes = fs.readFileSync(contractPath);
const contract = JSON.parse(contractBytes.toString("utf8"));
const policy = contract.rapidConsolidatedRenderPolicy?.metaAiContinuousRollingRenderPolicy?.fourSeparatePictureBundlePolicy;

if (!policy?.active || policy.requestedOutputsPerPrompt !== 4) {
  throw new Error("Authoritative four-output Meta bundle policy is missing or inactive");
}

checkpoint.contractSha256 = crypto.createHash("sha256").update(contractBytes).digest("hex").toUpperCase();
checkpoint.status = "active-continuous-meta-scene-1588-successor-g-cap-exhausted-four-output-policy-recorded-awaiting-archive-and-remote-parity";
checkpoint.metaFourSeparatePictureBundlePolicy = {
  ...policy,
  firstApplicableDispatch: {
    batch: 392,
    scene: 1588,
    phase: "successor-h-four-separate-picture-bundle"
  },
  localAccessibilityRule: "Every returned file remains content-addressed in the generated-media archive and discoverable through one sanitized manifest row per occurrence, regardless of acceptance or use."
};
checkpoint.activeMetaLanes = {
  ...(checkpoint.activeMetaLanes ?? {}),
  candidateNPlus2Gate: "closed until successor-G refusal evidence and the four-output bundle policy are archived, pushed, and remotely verified",
  candidateUnit: "one Meta prompt bundle requesting four separate pictures",
  requestedOutputsPerCandidate: 4,
  preserveEveryReturnedFileBeforeQa: true
};
checkpoint.nextMetaBundle = {
  batch: 392,
  scene: 1588,
  phase: "successor-h-four-separate-picture-bundle",
  state: "policy-authorized-prompts-not-yet-materialized",
  requestedSeparateFiles: 4,
  numberedDetailedVariantsRequired: 4,
  collageGridContactSheetMosaicForbidden: true,
  sourceSelectionRule: "Choose the strongest passing returned file while preserving every returned file and its independent occurrence evidence.",
  providerShortfallRule: "Preserve what arrives and record any shortfall or combined image form without claiming missing outputs existed."
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
console.log(JSON.stringify({ checkpointPath, contractSha256: checkpoint.contractSha256, policy: checkpoint.metaFourSeparatePictureBundlePolicy }, null, 2));
