import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { validatePcmSourceFreezeEvidence } from "./lib/pcm-editorial-gap-report.mjs";
import {
  serializePcmEditorialReusableProposalValidation,
  validatePcmEditorialReusableProposals,
} from "./lib/pcm-editorial-reusable-proposals.mjs";
import { validatePcmEditorialSourcePartition } from "./lib/pcm-editorial-source-partition.mjs";

const root = new URL("../", import.meta.url);
const urls = {
  artifact: new URL("scripts/data/pcm-editorial-reusable-proposals-5baff9.json", root),
  sourceFreezeEvidence: new URL("scripts/data/pcm-source-freeze-evidence-5baff9.json", root),
  sourcePartition: new URL("scripts/data/pcm-editorial-source-partition-5baff9.json", root),
  protectedIntegrity: new URL("scripts/lib/i18n-protected-integrity.mjs", root),
  pcmQuality: new URL("scripts/lib/pcm-machine-draft-quality.mjs", root),
  salvage: new URL("scripts/lib/pcm-editorial-gap-report.mjs", root),
};
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const parseJson = (bytes, label) => {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`${label} is invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const [
  artifactBytes,
  sourceFreezeEvidenceBytes,
  sourcePartitionBytes,
  protectedBytes,
  pcmQualityBytes,
  salvageBytes,
] = await Promise.all([
  readFile(urls.artifact),
  readFile(urls.sourceFreezeEvidence),
  readFile(urls.sourcePartition),
  readFile(urls.protectedIntegrity),
  readFile(urls.pcmQuality),
  readFile(urls.salvage),
]);
const currentGateBinding = {
  protectedIntegrityModuleSha256: sha256(protectedBytes),
  pcmQualityModuleSha256: sha256(pcmQualityBytes),
  salvageModuleSha256: sha256(salvageBytes),
};
const frozen = validatePcmSourceFreezeEvidence({
  evidence: parseJson(sourceFreezeEvidenceBytes, "PCM source-freeze evidence"),
  evidenceBytes: sourceFreezeEvidenceBytes,
});
const sourcePartition = validatePcmEditorialSourcePartition({
  manifest: parseJson(sourcePartitionBytes, "PCM source partition"),
  inventory: frozen.inventory,
  currentGateBinding,
});
const result = validatePcmEditorialReusableProposals({
  artifact: parseJson(artifactBytes, "PCM reusable-proposal artifact"),
  sourcePartition,
  sourcePartitionFileSha256: sha256(sourcePartitionBytes),
  currentGateBinding,
});

process.stdout.write(serializePcmEditorialReusableProposalValidation(result));
