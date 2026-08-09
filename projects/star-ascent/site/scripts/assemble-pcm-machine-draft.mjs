import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { validatePcmSourceFreezeEvidence } from "./lib/pcm-editorial-gap-report.mjs";
import {
  assemblePcmMachineDraft,
  PCM_MACHINE_DRAFT_ASSEMBLY_BINDINGS,
  serializePcmMachineDraftAssemblyValidation,
  validateCommittedPcmMachineDraftAssembly,
} from "./lib/pcm-machine-draft-assembler.mjs";
import { validatePcmEditorialSourcePartition } from "./lib/pcm-editorial-source-partition.mjs";

const root = new URL("../", import.meta.url);
const url = (path) => new URL(path, root);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const parseJson = (bytes, label) => {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`${label} is invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const batchUrls = PCM_MACHINE_DRAFT_ASSEMBLY_BINDINGS.editorialBatchBindings.map(({ fileName }) => (
  url(`scripts/data/pcm-editorial-batches/${fileName}`)
));
const [
  sourceFreezeEvidenceBytes,
  sourcePartitionBytes,
  reusableArtifactBytes,
  protectedIntegrityBytes,
  pcmQualityBytes,
  salvageBytes,
  artifactBytes,
  proofBytes,
  batchBytes,
] = await Promise.all([
  readFile(url("scripts/data/pcm-source-freeze-evidence-5baff9.json")),
  readFile(url("scripts/data/pcm-editorial-source-partition-5baff9.json")),
  readFile(url("scripts/data/pcm-editorial-reusable-proposals-5baff9.json")),
  readFile(url("scripts/lib/i18n-protected-integrity.mjs")),
  readFile(url("scripts/lib/pcm-machine-draft-quality.mjs")),
  readFile(url("scripts/lib/pcm-editorial-gap-report.mjs")),
  readFile(url("scripts/data/pcm-machine-draft-5baff9-v2.json")),
  readFile(url("scripts/data/pcm-machine-draft-assembly-proof-5baff9.json")),
  Promise.all(batchUrls.map((target) => readFile(target))),
]);
const currentGateBinding = {
  protectedIntegrityModuleSha256: sha256(protectedIntegrityBytes),
  pcmQualityModuleSha256: sha256(pcmQualityBytes),
  salvageModuleSha256: sha256(salvageBytes),
};
const frozen = validatePcmSourceFreezeEvidence({
  evidence: parseJson(sourceFreezeEvidenceBytes, "PCM source-freeze evidence"),
  evidenceBytes: sourceFreezeEvidenceBytes,
});
const sourcePartition = validatePcmEditorialSourcePartition({
  manifest: parseJson(sourcePartitionBytes, "PCM editorial source partition"),
  inventory: frozen.inventory,
  currentGateBinding,
});
const editorialBatches = batchBytes.map((bytes, index) => ({
  fileName: PCM_MACHINE_DRAFT_ASSEMBLY_BINDINGS.editorialBatchBindings[index].fileName,
  fileSha256: sha256(bytes),
  artifact: parseJson(bytes, `PCM editorial batch ${index + 1}`),
}));
const assembly = assemblePcmMachineDraft({
  inventory: frozen.inventory,
  criticalSources: frozen.componentSources.CRITICAL_UI_PRIORITY_VALUES,
  sourceFreezeBinding: {
    schema: PCM_MACHINE_DRAFT_ASSEMBLY_BINDINGS.sourceFreezeBinding.schema,
    sourceCount: frozen.inventory.sourceCount,
    sourceKeysSha256: frozen.inventory.sourceKeysSha256,
    evidenceCanonicalSha256: frozen.binding.evidenceCanonicalSha256,
    evidenceFileSha256: frozen.binding.evidenceFileSha256,
  },
  sourcePartition,
  sourcePartitionFileSha256: sha256(sourcePartitionBytes),
  reusableArtifact: parseJson(reusableArtifactBytes, "PCM reusable-proposal artifact"),
  reusableArtifactFileSha256: sha256(reusableArtifactBytes),
  currentGateBinding,
  editorialBatches,
});
const result = validateCommittedPcmMachineDraftAssembly({ assembly, artifactBytes, proofBytes });

process.stdout.write(serializePcmMachineDraftAssemblyValidation(result));
