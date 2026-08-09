import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  serializePcmEditorialIncrementalValidation,
  validatePcmEditorialIncrementalBatch,
} from "./lib/pcm-editorial-incremental-batch.mjs";
import { validatePcmSourceFreezeEvidence } from "./lib/pcm-editorial-gap-report.mjs";
import { validatePcmEditorialSourcePartition } from "./lib/pcm-editorial-source-partition.mjs";

const batchPath = process.env.I18N_PCM_EDITORIAL_BATCH_PATH;
if (!batchPath) {
  throw new Error("Set I18N_PCM_EDITORIAL_BATCH_PATH explicitly");
}

const root = new URL("../", import.meta.url);
const urls = {
  sourceFreezeEvidence: new URL("scripts/data/pcm-source-freeze-evidence-5baff9.json", root),
  sourcePartition: new URL("scripts/data/pcm-editorial-source-partition-5baff9.json", root),
  protectedIntegrity: new URL("scripts/lib/i18n-protected-integrity.mjs", root),
  pcmQuality: new URL("scripts/lib/pcm-machine-draft-quality.mjs", root),
  salvage: new URL("scripts/lib/pcm-editorial-gap-report.mjs", root),
};
const priorBatchUrls = [
  "pcm-public-ui-short-001.json",
  "pcm-public-ui-priority-002.json",
  "pcm-public-ui-priority-003.json",
  "pcm-public-ui-priority-004.json",
  "pcm-public-ui-priority-005.json",
  "pcm-public-ui-priority-006.json",
  "pcm-public-ui-priority-007.json",
  "pcm-public-ui-priority-008.json",
  "pcm-public-ui-priority-009.json",
  "pcm-public-ui-priority-010.json",
  "pcm-public-ui-priority-011.json",
].map((fileName) => new URL(`scripts/data/pcm-editorial-batches/${fileName}`, root));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const readJson = async (target, label) => {
  try {
    return JSON.parse(await readFile(target, "utf8"));
  } catch (error) {
    throw new Error(`${label} is unreadable or invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const [
  sourceFreezeEvidenceBytes,
  artifact,
  partitionManifest,
  protectedBytes,
  pcmQualityBytes,
  salvageBytes,
] = await Promise.all([
  readFile(urls.sourceFreezeEvidence),
  readJson(resolve(batchPath), "PCM incremental editorial batch"),
  readJson(urls.sourcePartition, "Committed PCM source partition"),
  readFile(urls.protectedIntegrity),
  readFile(urls.pcmQuality),
  readFile(urls.salvage),
]);

let sourceFreezeEvidence;
try {
  sourceFreezeEvidence = JSON.parse(sourceFreezeEvidenceBytes.toString("utf8"));
} catch (error) {
  throw new Error(
    `PCM source-freeze evidence is invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
  );
}
const frozenSourceEvidence = validatePcmSourceFreezeEvidence({
  evidence: sourceFreezeEvidence,
  evidenceBytes: sourceFreezeEvidenceBytes,
});
const { inventory } = frozenSourceEvidence;
const currentGateBinding = {
  protectedIntegrityModuleSha256: sha256(protectedBytes),
  pcmQualityModuleSha256: sha256(pcmQualityBytes),
  salvageModuleSha256: sha256(salvageBytes),
};
const sourcePartition = validatePcmEditorialSourcePartition({
  manifest: partitionManifest,
  inventory,
  currentGateBinding,
});
const sequenceMatch = artifact.batchId?.match(/^pcm-full-frozen-gap-(\d{3})$/u);
const priorBatchCount = sequenceMatch ? Number(sequenceMatch[1]) - 1 : 0;
if (artifact.schema === "iat-pcm-editorial-incremental-batch/v3"
  && (!sequenceMatch || priorBatchCount < 0 || priorBatchCount > priorBatchUrls.length)) {
  throw new Error("PCM full-frozen-gap batch has no complete committed prior-chain prefix");
}
const priorArtifacts = artifact.schema === "iat-pcm-editorial-incremental-batch/v3"
  ? await Promise.all(
    priorBatchUrls
      .slice(0, priorBatchCount)
      .map((target, index) => readJson(target, `PCM prior batch ${index + 1}`)),
  )
  : [];
const result = validatePcmEditorialIncrementalBatch({
  artifact,
  inventory,
  sourcePartition,
  criticalSources: frozenSourceEvidence.componentSources.CRITICAL_UI_PRIORITY_VALUES,
  currentGateBinding,
  priorArtifacts,
});

process.stdout.write(serializePcmEditorialIncrementalValidation(result));
