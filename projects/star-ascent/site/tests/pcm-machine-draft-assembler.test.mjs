import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validatePcmSourceFreezeEvidence } from "../scripts/lib/pcm-editorial-gap-report.mjs";
import {
  assemblePcmMachineDraft,
  PCM_MACHINE_DRAFT_ASSEMBLY_BINDINGS,
  serializePcmMachineDraftAssemblyValidation,
  validateCommittedPcmMachineDraftAssembly,
} from "../scripts/lib/pcm-machine-draft-assembler.mjs";
import { validatePcmEditorialSourcePartition } from "../scripts/lib/pcm-editorial-source-partition.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const siteUrl = new URL("../", import.meta.url);
const url = (path) => new URL(path, siteUrl);

async function fixture() {
  const batchBindings = PCM_MACHINE_DRAFT_ASSEMBLY_BINDINGS.editorialBatchBindings;
  const [
    freezeBytes,
    partitionBytes,
    reusableBytes,
    protectedBytes,
    qualityBytes,
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
    Promise.all(batchBindings.map(({ fileName }) => (
      readFile(url(`scripts/data/pcm-editorial-batches/${fileName}`))
    ))),
  ]);
  const currentGateBinding = {
    protectedIntegrityModuleSha256: sha256(protectedBytes),
    pcmQualityModuleSha256: sha256(qualityBytes),
    salvageModuleSha256: sha256(salvageBytes),
  };
  const frozen = validatePcmSourceFreezeEvidence({
    evidence: JSON.parse(freezeBytes.toString("utf8")),
    evidenceBytes: freezeBytes,
  });
  const sourcePartition = validatePcmEditorialSourcePartition({
    manifest: JSON.parse(partitionBytes.toString("utf8")),
    inventory: frozen.inventory,
    currentGateBinding,
  });
  return {
    inputs: {
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
      sourcePartitionFileSha256: sha256(partitionBytes),
      reusableArtifact: JSON.parse(reusableBytes.toString("utf8")),
      reusableArtifactFileSha256: sha256(reusableBytes),
      currentGateBinding,
      editorialBatches: batchBytes.map((bytes, index) => ({
        fileName: batchBindings[index].fileName,
        fileSha256: sha256(bytes),
        artifact: JSON.parse(bytes.toString("utf8")),
      })),
    },
    artifactBytes,
    proofBytes,
  };
}

test("the committed v2 draft is the exact non-activating 179 plus 1,312 assembly", async () => {
  const { inputs, artifactBytes, proofBytes } = await fixture();
  const assembly = assemblePcmMachineDraft(inputs);
  const result = validateCommittedPcmMachineDraftAssembly({ assembly, artifactBytes, proofBytes });
  assert.deepEqual(
    {
      sourceCount: result.sourceCount,
      reusableSourceCount: result.reusableSourceCount,
      gapSourceCount: result.gapSourceCount,
      editorialBatchCount: result.editorialBatchCount,
      counters: result.counters,
    },
    {
      sourceCount: 1_491,
      reusableSourceCount: 179,
      gapSourceCount: 1_312,
      editorialBatchCount: 15,
      counters: {
        protectedTokenRepairs: 0,
        editorialMachineDraftOverrides: 1_343,
        sourceEquivalentLabelEditorialFallbacks: 0,
      },
    },
  );
  assert.equal(result.artifactFileSha256, "b8db39ae2b58314d11be382658075bd7a58b0e5b3b412896775baa73773d8fdc");
  assert.equal(result.artifactCanonicalSha256, "85605497b0e2f5c2cf5167858a56878ba5578d7588cabb769dddbab76ceea2f6");
  assert.equal(result.proofFileSha256, "78c01f4b00a3888d6d3a48a852c67d1b61a19199131dc9e605b31838d151030a");
  assert.equal(result.proofCanonicalSha256, "eb5003579eac39973453b5ea4d683e857f85d9d1157658b340ff60775b815c2f");
  assert.equal(result.messageEntriesSha256, "6dcf8451a2dd9bbf3f578eb470ac78775752d66aaa9f5cb94463cd78b9c6d557");
  assert.equal(result.artifact.verified, false);
  assert.equal(result.artifact.canonicalEnglishControls, true);
  assert.equal(result.proof.activationReady, false);
  assert.equal(result.proof.directApplicationPermitted, false);
  assert.equal(result.proof.runtimeCatalogDependency, false);
  assert.equal(result.proof.reviewClaim, "AI_GENERATED_UNVERIFIED");
  assert.equal(
    result.proof.historicalGapReportBinding.gateBinding.pcmQualityModuleSha256,
    "578dd568376aba801dff61b345a1f464457a4a5e5a482449e4834cfaa2e68e29",
  );
  assert.equal(
    result.proof.currentHelperBinding.pcmQualityModuleSha256,
    "6c19e96dc891343e968e2f20824fdd54b681f8876273bb0c7b70d9fdee6c7be3",
  );
  assert.notDeepEqual(
    result.proof.historicalGapReportBinding.gateBinding,
    result.proof.currentHelperBinding,
  );
});
test("PCM full-draft assembly and validation serialization are deterministic", async () => {
  const { inputs } = await fixture();
  const first = assemblePcmMachineDraft(inputs);
  const second = assemblePcmMachineDraft(structuredClone(inputs));
  assert.equal(first.artifactSerialized, second.artifactSerialized);
  assert.equal(first.proofSerialized, second.proofSerialized);
  assert.equal(first.artifactFileSha256, second.artifactFileSha256);
  assert.equal(first.proofFileSha256, second.proofFileSha256);
  assert.equal(
    serializePcmMachineDraftAssemblyValidation(first),
    serializePcmMachineDraftAssemblyValidation(second),
  );
});

test("assembly rejects helper, partition, reusable, batch, output, and proof tampering", async () => {
  const { inputs, artifactBytes, proofBytes } = await fixture();
  const probes = [];

  const helperDrift = structuredClone(inputs);
  helperDrift.currentGateBinding.salvageModuleSha256 = "0".repeat(64);
  probes.push([helperDrift, /helper binding/u]);

  const partitionBytesDrift = structuredClone(inputs);
  partitionBytesDrift.sourcePartitionFileSha256 = "1".repeat(64);
  probes.push([partitionBytesDrift, /source partition/u]);

  const reusableBytesDrift = structuredClone(inputs);
  reusableBytesDrift.reusableArtifactFileSha256 = "2".repeat(64);
  probes.push([reusableBytesDrift, /reusable-proposal file/u]);

  const batchBytesDrift = structuredClone(inputs);
  batchBytesDrift.editorialBatches[12].fileSha256 = "3".repeat(64);
  probes.push([batchBytesDrift, /batch 13/u]);

  const missingBatch = structuredClone(inputs);
  missingBatch.editorialBatches.pop();
  probes.push([missingBatch, /exact 15-batch/u]);

  for (const [probe, expected] of probes) {
    assert.throws(() => assemblePcmMachineDraft(probe), expected);
  }

  const assembly = assemblePcmMachineDraft(inputs);
  const artifactDrift = Buffer.from(artifactBytes);
  artifactDrift[artifactDrift.length - 2] ^= 1;
  assert.throws(
    () => validateCommittedPcmMachineDraftAssembly({ assembly, artifactBytes: artifactDrift, proofBytes }),
    /artifact is not the deterministic assembly output/u,
  );
  const proofDrift = Buffer.from(proofBytes);
  proofDrift[proofDrift.length - 2] ^= 1;
  assert.throws(
    () => validateCommittedPcmMachineDraftAssembly({ assembly, artifactBytes, proofBytes: proofDrift }),
    /proof is not the deterministic assembly output/u,
  );
});

test("the assembler closure has no runtime catalog, activation, external I/O, or write path", async () => {
  const [library, cli] = await Promise.all([
    readFile(url("scripts/lib/pcm-machine-draft-assembler.mjs"), "utf8"),
    readFile(url("scripts/assemble-pcm-machine-draft.mjs"), "utf8"),
  ]);
  const source = `${library}\n${cli}`;
  assert.doesNotMatch(
    source,
    /app\/i18n\/(?:messages|pending-visible-source|critical-ui-source)|activate-machine-draft-locales|apply-i18n-editorial-overrides|compile-i18n-assets/u,
  );
  assert.doesNotMatch(
    source,
    /\b(?:fetch|WebSocket|EventSource)\b|node:(?:http|https|net|tls|dgram|child_process)|\b(?:writeFile|appendFile|unlink|rename|mkdir|rm|createWriteStream)\b/u,
  );
  assert.equal(PCM_MACHINE_DRAFT_ASSEMBLY_BINDINGS.editorialBatchBindings.length, 15);
  assert.equal(
    PCM_MACHINE_DRAFT_ASSEMBLY_BINDINGS.editorialBatchBindings
      .reduce((total, binding) => total + binding.acceptedSourceCount, 0),
    1_312,
  );
});
