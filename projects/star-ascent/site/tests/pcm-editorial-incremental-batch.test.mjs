import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  auditPcmEditorialIncrementalBatch,
  serializePcmEditorialIncrementalValidation,
  validatePcmEditorialIncrementalBatch,
} from "../scripts/lib/pcm-editorial-incremental-batch.mjs";
import {
  canonicalJsonSha256,
  pcmEditorialCandidateFindings,
  validatePcmSourceFreezeEvidence,
} from "../scripts/lib/pcm-editorial-gap-report.mjs";
import { validatePcmEditorialSourcePartition } from "../scripts/lib/pcm-editorial-source-partition.mjs";

const readJson = (target) => readFile(target, "utf8").then(JSON.parse);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

test("the committed PCM partition proves full coverage and the 785 accepted batch sources form a disjoint gap subset", async () => {
  const [
    batchOne,
    batchTwo,
    batchThree,
    batchFour,
    batchFive,
    batchSix,
    batchSeven,
    batchEight,
    batchNine,
    partitionManifest,
    sourceFreezeEvidenceBytes,
    protectedBytes,
    pcmQualityBytes,
    salvageBytes,
  ] = await Promise.all([
    readJson(new URL("../scripts/data/pcm-editorial-batches/pcm-public-ui-short-001.json", import.meta.url)),
    readJson(new URL("../scripts/data/pcm-editorial-batches/pcm-public-ui-priority-002.json", import.meta.url)),
    readJson(new URL("../scripts/data/pcm-editorial-batches/pcm-public-ui-priority-003.json", import.meta.url)),
    readJson(new URL("../scripts/data/pcm-editorial-batches/pcm-public-ui-priority-004.json", import.meta.url)),
    readJson(new URL("../scripts/data/pcm-editorial-batches/pcm-public-ui-priority-005.json", import.meta.url)),
    readJson(new URL("../scripts/data/pcm-editorial-batches/pcm-public-ui-priority-006.json", import.meta.url)),
    readJson(new URL("../scripts/data/pcm-editorial-batches/pcm-public-ui-priority-007.json", import.meta.url)),
    readJson(new URL("../scripts/data/pcm-editorial-batches/pcm-public-ui-priority-008.json", import.meta.url)),
    readJson(new URL("../scripts/data/pcm-editorial-batches/pcm-public-ui-priority-009.json", import.meta.url)),
    readJson(new URL("../scripts/data/pcm-editorial-source-partition-5baff9.json", import.meta.url)),
    readFile(new URL("../scripts/data/pcm-source-freeze-evidence-5baff9.json", import.meta.url)),
    readFile(new URL("../scripts/lib/i18n-protected-integrity.mjs", import.meta.url)),
    readFile(new URL("../scripts/lib/pcm-machine-draft-quality.mjs", import.meta.url)),
    readFile(new URL("../scripts/lib/pcm-editorial-gap-report.mjs", import.meta.url)),
  ]);
  const frozenSourceEvidence = validatePcmSourceFreezeEvidence({
    evidence: JSON.parse(sourceFreezeEvidenceBytes.toString("utf8")),
    evidenceBytes: sourceFreezeEvidenceBytes,
  });
  const { inventory } = frozenSourceEvidence;
  const criticalSources = frozenSourceEvidence.componentSources.CRITICAL_UI_PRIORITY_VALUES;
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
  const sourceSet = new Set(inventory.sources);
  const criticalSet = new Set(criticalSources);
  const gapSet = new Set(sourcePartition.gapSources);
  const reusableSet = new Set(sourcePartition.reusableSources);
  assert.equal(gapSet.size, 1_312);
  assert.equal(reusableSet.size, 179);
  for (const source of gapSet) assert.ok(!reusableSet.has(source), `partition overlap: ${source}`);
  const union = [...gapSet, ...reusableSet].sort((left, right) => left.localeCompare(right, "en"));
  assert.deepEqual(union, inventory.sources);
  assert.deepEqual(batchOne.counts, { attempted: 60, accepted: 60, rejected: 0 });
  assert.deepEqual(batchTwo.counts, { attempted: 100, accepted: 100, rejected: 0 });
  assert.deepEqual(batchThree.counts, { attempted: 100, accepted: 100, rejected: 0 });
  assert.deepEqual(batchFour.counts, { attempted: 100, accepted: 100, rejected: 0 });
  assert.deepEqual(batchFive.counts, { attempted: 25, accepted: 25, rejected: 0 });
  assert.deepEqual(batchSix.counts, { attempted: 100, accepted: 100, rejected: 0 });
  assert.deepEqual(batchSeven.counts, { attempted: 100, accepted: 100, rejected: 0 });
  assert.deepEqual(batchEight.counts, { attempted: 100, accepted: 100, rejected: 0 });
  assert.deepEqual(batchNine.counts, { attempted: 100, accepted: 100, rejected: 0 });
  assert.equal(batchTwo.sourcePartitionBinding.canonicalSha256, sourcePartition.manifestCanonicalSha256);
  assert.equal(batchThree.sourcePartitionBinding.canonicalSha256, sourcePartition.manifestCanonicalSha256);
  assert.equal(batchFour.sourcePartitionBinding.canonicalSha256, sourcePartition.manifestCanonicalSha256);
  assert.equal(batchFive.sourcePartitionBinding.canonicalSha256, sourcePartition.manifestCanonicalSha256);
  assert.equal(batchSix.sourcePartitionBinding.canonicalSha256, sourcePartition.manifestCanonicalSha256);
  assert.equal(batchSeven.sourcePartitionBinding.canonicalSha256, sourcePartition.manifestCanonicalSha256);
  assert.equal(batchEight.sourcePartitionBinding.canonicalSha256, sourcePartition.manifestCanonicalSha256);
  assert.equal(batchNine.sourcePartitionBinding.canonicalSha256, sourcePartition.manifestCanonicalSha256);
  const priorBatchUnion = new Set([batchOne, batchTwo, batchThree].flatMap((artifact) => Object.keys(artifact.proposals)));
  const expectedBatchFourSources = criticalSources
    .filter((source) => gapSet.has(source) && !priorBatchUnion.has(source))
    .slice(0, 100);
  assert.deepEqual(Object.keys(batchFour.proposals), expectedBatchFourSources);
  const priorBatchFiveUnion = new Set([...priorBatchUnion, ...Object.keys(batchFour.proposals)]);
  const expectedBatchFiveSources = criticalSources
    .filter((source) => gapSet.has(source) && !priorBatchFiveUnion.has(source))
    .slice(0, 100);
  assert.deepEqual(Object.keys(batchFive.proposals), expectedBatchFiveSources);
  const priorArtifacts = [batchOne, batchTwo, batchThree, batchFour, batchFive];
  const fullGapArtifacts = [batchSix, batchSeven, batchEight, batchNine];
  for (const [offset, artifact] of fullGapArtifacts.entries()) {
    const precedingArtifacts = [...priorArtifacts, ...fullGapArtifacts.slice(0, offset)];
    const precedingSourceSet = new Set(precedingArtifacts.flatMap(({ proposals }) => Object.keys(proposals)));
    const expectedSources = sourcePartition.gapSources
      .filter((source) => !precedingSourceSet.has(source))
      .slice(0, 100);
    assert.deepEqual(Object.keys(artifact.proposals), expectedSources);
    const priorSourceKeys = [...precedingSourceSet].sort((left, right) => left.localeCompare(right, "en"));
    assert.deepEqual(artifact.sequenceBinding, {
      schema: "iat-pcm-editorial-sequence-binding/v1",
      selection: "NEXT_FROZEN_GAP_AFTER_VALIDATED_PRIOR_BATCHES",
      batchSize: 100,
      priorBatchCount: precedingArtifacts.length,
      priorAcceptedSourceCount: priorSourceKeys.length,
      priorBatchChainSha256: canonicalJsonSha256(precedingArtifacts.map(canonicalJsonSha256)),
      priorSourceKeysSha256: canonicalJsonSha256(priorSourceKeys),
    });
  }

  const batchUnion = new Set();
  const artifacts = [...priorArtifacts, ...fullGapArtifacts];
  for (const [index, artifact] of artifacts.entries()) {
    assert.deepEqual(artifact.sourceFreeze, {
      sourceCount: inventory.sourceCount,
      sourceKeysSha256: inventory.sourceKeysSha256,
    });
    assert.deepEqual(artifact.gateBinding, currentGateBinding);
    assert.equal(artifact.basedOnGapReport.gapCount, 1_312);
    assert.equal(artifact.basedOnGapReport.reusableProposalCount, 179);
    assert.match(artifact.basedOnGapReport.canonicalSha256, /^[0-9a-f]{64}$/u);
    assert.equal(artifact.activationReady, false);
    assert.equal(artifact.policy.directApplicationPermitted, false);
    const batchValidation = validatePcmEditorialIncrementalBatch({
      artifact,
      inventory,
      sourcePartition,
      criticalSources,
      currentGateBinding,
      priorArtifacts: artifact.schema === "iat-pcm-editorial-incremental-batch/v3"
        ? artifacts.slice(0, index)
        : [],
    });
    assert.deepEqual(
      { attempted: batchValidation.attempted, accepted: batchValidation.accepted, rejected: batchValidation.rejected },
      artifact.counts,
    );
    for (const [source, translation] of Object.entries(artifact.proposals)) {
      assert.ok(!batchUnion.has(source), `duplicate proposal across incremental batches: ${source}`);
      batchUnion.add(source);
      assert.ok(sourceSet.has(source), `missing from source freeze: ${source}`);
      assert.ok(gapSet.has(source), `batch source is not in the committed gap partition: ${source}`);
      assert.ok(!reusableSet.has(source), `batch source is already reusable: ${source}`);
      if (artifact.policy.scope === "FULL_FROZEN_GAP") {
        assert.ok(!criticalSet.has(source), `full frozen-gap source unexpectedly remained critical UI: ${source}`);
      } else {
        assert.ok(criticalSet.has(source), `not critical public UI: ${source}`);
      }
      assert.ok(source.length <= artifact.policy.maxSourceLength, `source exceeds declared copy policy: ${source}`);
      assert.deepEqual(
        pcmEditorialCandidateFindings(source, translation),
        [],
        `candidate failed protected-token, source-equivalence, retention, semantic, Unicode, or symbol gates: ${source}`,
      );
    }
  }
  assert.equal(batchUnion.size, 785);
  assert.equal(gapSet.size - batchUnion.size, 527);
  assert.equal(criticalSources.filter((source) => gapSet.has(source) && !batchUnion.has(source)).length, 0);

  const batchSixInputs = (artifact, overrides = {}) => ({
    artifact,
    inventory,
    sourcePartition,
    criticalSources,
    currentGateBinding,
    priorArtifacts,
    ...overrides,
  });
  const staleSourceFreeze = structuredClone(batchSix);
  staleSourceFreeze.sourceFreeze.sourceKeysSha256 = "0".repeat(64);
  assert.throws(
    () => validatePcmEditorialIncrementalBatch(batchSixInputs(staleSourceFreeze)),
    /current source freeze/u,
  );

  const staleHelper = structuredClone(batchSix);
  staleHelper.gateBinding.pcmQualityModuleSha256 = "0".repeat(64);
  assert.throws(
    () => validatePcmEditorialIncrementalBatch(batchSixInputs(staleHelper)),
    /gate binding is stale/u,
  );

  const stalePartition = structuredClone(batchSix);
  stalePartition.sourcePartitionBinding.gapSourceKeysSha256 = "0".repeat(64);
  assert.throws(
    () => validatePcmEditorialIncrementalBatch(batchSixInputs(stalePartition)),
    /committed source partition/u,
  );

  const staleSequence = structuredClone(batchSix);
  staleSequence.sequenceBinding.priorBatchChainSha256 = "0".repeat(64);
  assert.throws(
    () => validatePcmEditorialIncrementalBatch(batchSixInputs(staleSequence)),
    /sequence binding/u,
  );

  const substitutedScope = structuredClone(batchSix);
  substitutedScope.policy.scope = "HIGH_PRIORITY_PUBLIC_UI";
  assert.throws(
    () => validatePcmEditorialIncrementalBatch(batchSixInputs(substitutedScope)),
    /policy is invalid/u,
  );

  const substitutedBatchId = structuredClone(batchSix);
  substitutedBatchId.batchId = "pcm-public-ui-priority-006";
  assert.throws(
    () => validatePcmEditorialIncrementalBatch(batchSixInputs(substitutedBatchId)),
    /batch ID is not the next sequence number/u,
  );

  const downgradedScope = structuredClone(batchSix);
  downgradedScope.schema = "iat-pcm-editorial-incremental-batch/v2";
  downgradedScope.policy.scope = "HIGH_PRIORITY_PUBLIC_UI";
  delete downgradedScope.sequenceBinding;
  const downgradedAudit = auditPcmEditorialIncrementalBatch(batchSixInputs(downgradedScope));
  assert.equal(downgradedAudit.accepted, 0);
  assert.equal(downgradedAudit.rejected, 100);
  assert.ok(Object.values(downgradedAudit.rejectedProposals).every(({ findings }) => (
    findings.some(({ rule }) => rule === "source-not-critical-public-ui")
  )));

  const replaceFirstSource = (replacementSource, replacementTranslation) => {
    const artifact = structuredClone(batchSix);
    const entries = Object.entries(artifact.proposals);
    entries[0] = [replacementSource, replacementTranslation];
    artifact.proposals = Object.fromEntries(entries);
    return artifact;
  };
  const priorDuplicateSource = Object.keys(batchOne.proposals)[0];
  const duplicatePrior = replaceFirstSource(priorDuplicateSource, batchOne.proposals[priorDuplicateSource]);
  assert.throws(
    () => validatePcmEditorialIncrementalBatch(batchSixInputs(duplicatePrior)),
    /duplicates a validated prior source/u,
  );

  const reusableSource = sourcePartition.reusableSources[0];
  const reusableSubstitution = replaceFirstSource(reusableSource, reusableSource);
  assert.throws(
    () => validatePcmEditorialIncrementalBatch(batchSixInputs(reusableSubstitution)),
    /includes a reusable source/u,
  );

  const nonGapSubstitution = replaceFirstSource("NOT A FROZEN SOURCE", "SOURCE WEY NO DEY FOR FREEZE");
  assert.throws(
    () => validatePcmEditorialIncrementalBatch(batchSixInputs(nonGapSubstitution)),
    /includes a non-gap source/u,
  );

  const outOfOrder = structuredClone(batchSix);
  const reorderedEntries = Object.entries(outOfOrder.proposals);
  [reorderedEntries[0], reorderedEntries[1]] = [reorderedEntries[1], reorderedEntries[0]];
  outOfOrder.proposals = Object.fromEntries(reorderedEntries);
  assert.throws(
    () => validatePcmEditorialIncrementalBatch(batchSixInputs(outOfOrder)),
    /exact deterministic next slice/u,
  );

  const skippedSource = structuredClone(batchSix);
  delete skippedSource.proposals[Object.keys(skippedSource.proposals)[0]];
  assert.throws(
    () => validatePcmEditorialIncrementalBatch(batchSixInputs(skippedSource)),
    /exact deterministic next slice/u,
  );

  assert.throws(
    () => validatePcmEditorialIncrementalBatch(batchSixInputs(batchSix, {
      priorArtifacts: [batchTwo, batchOne, batchThree, batchFour, batchFive],
    })),
    /prior batches are out of sequence/u,
  );

  const overlappingBatchTwo = structuredClone(batchTwo);
  const overlappingEntries = Object.entries(overlappingBatchTwo.proposals);
  overlappingEntries[0] = [priorDuplicateSource, batchOne.proposals[priorDuplicateSource]];
  overlappingBatchTwo.proposals = Object.fromEntries(overlappingEntries);
  assert.throws(
    () => validatePcmEditorialIncrementalBatch(batchSixInputs(batchSix, {
      priorArtifacts: [batchOne, overlappingBatchTwo, batchThree, batchFour, batchFive],
    })),
    /duplicate source across prior batches/u,
  );
});

function fixture() {
  const source = "Open this page";
  const sources = [source];
  const inventory = {
    sources,
    sourceCount: 1,
    sourceKeysSha256: sha256(JSON.stringify(sources)),
  };
  const gapReport = {
    schema: "iat-pcm-editorial-gap-report/v1",
    counts: { gapCount: 1, reusableProposalCount: 0 },
    gaps: [{ source, status: "NO_EXACT_SOURCE_KEY_PROPOSAL" }],
    reusableProposals: {},
  };
  const currentGateBinding = {
    protectedIntegrityModuleSha256: "a".repeat(64),
    pcmQualityModuleSha256: "b".repeat(64),
    salvageModuleSha256: "c".repeat(64),
  };
  const artifact = {
    schema: "iat-pcm-editorial-incremental-batch/v1",
    batchId: "pcm-fixture-001",
    locale: "pcm",
    status: "CURRENT_GATES_PASS_INCREMENTAL_ONLY",
    activationReady: false,
    sourceFreeze: {
      sourceCount: inventory.sourceCount,
      sourceKeysSha256: inventory.sourceKeysSha256,
    },
    basedOnGapReport: {
      schema: gapReport.schema,
      canonicalSha256: canonicalJsonSha256(gapReport),
      gapCount: 1,
      reusableProposalCount: 0,
    },
    gateBinding: structuredClone(currentGateBinding),
    policy: {
      scope: "HIGH_PRIORITY_SHORT_PUBLIC_UI",
      maxSourceLength: 70,
      canonicalEnglishControls: true,
      directApplicationPermitted: false,
      reviewClaim: "AI_GENERATED_UNVERIFIED",
    },
    counts: { attempted: 1, accepted: 1, rejected: 0 },
    proposals: { [source]: "Open dis page." },
  };
  return { artifact, inventory, gapReport, criticalSources: [source], currentGateBinding };
}

function partitionFixture() {
  const inputs = fixture();
  const gapReportCanonicalSha256 = canonicalJsonSha256(inputs.gapReport);
  const sourcePartition = {
    manifestSchema: "iat-pcm-editorial-source-partition/v1",
    manifestCanonicalSha256: "d".repeat(64),
    partitionDigests: {
      partitionBytesSha256: "e".repeat(64),
      gapSourceKeysSha256: "f".repeat(64),
      reusableSourceKeysSha256: "0".repeat(64),
    },
    gapReportBinding: {
      schema: inputs.gapReport.schema,
      canonicalSha256: gapReportCanonicalSha256,
    },
    counts: { sourceCount: 1, gapSourceCount: 1, reusableSourceCount: 0 },
    gapSources: ["Open this page"],
    reusableSources: [],
  };
  inputs.artifact.schema = "iat-pcm-editorial-incremental-batch/v2";
  inputs.artifact.policy.scope = "HIGH_PRIORITY_PUBLIC_UI";
  inputs.artifact.sourcePartitionBinding = {
    schema: sourcePartition.manifestSchema,
    canonicalSha256: sourcePartition.manifestCanonicalSha256,
    ...structuredClone(sourcePartition.partitionDigests),
  };
  delete inputs.gapReport;
  return { ...inputs, sourcePartition };
}

test("incremental validation is deterministic and remains explicitly non-activating", () => {
  const inputs = fixture();
  const first = validatePcmEditorialIncrementalBatch(inputs);
  const second = validatePcmEditorialIncrementalBatch(structuredClone(inputs));
  assert.deepEqual(
    { attempted: first.attempted, accepted: first.accepted, rejected: first.rejected },
    { attempted: 1, accepted: 1, rejected: 0 },
  );
  assert.equal(first.batchCanonicalSha256, second.batchCanonicalSha256);
  assert.equal(serializePcmEditorialIncrementalValidation(first), serializePcmEditorialIncrementalValidation(second));
  assert.match(serializePcmEditorialIncrementalValidation(first), /"activationReady": false/u);
});

test("incremental validation rejects stale bindings, non-gap sources, and unchanged English", () => {
  const staleGate = fixture();
  staleGate.artifact.gateBinding.pcmQualityModuleSha256 = "d".repeat(64);
  assert.throws(() => validatePcmEditorialIncrementalBatch(staleGate), /gate binding is stale/u);

  const staleReport = fixture();
  staleReport.gapReport.gaps = [];
  staleReport.gapReport.counts.gapCount = 0;
  assert.throws(() => validatePcmEditorialIncrementalBatch(staleReport), /bound gap report/u);

  const unchanged = fixture();
  unchanged.artifact.proposals["Open this page"] = "Open this page";
  const audit = auditPcmEditorialIncrementalBatch(unchanged);
  assert.equal(audit.accepted, 0);
  assert.equal(audit.rejected, 1);
  assert.ok(audit.rejectedProposals["Open this page"].findings.some(({ rule }) => rule === "source-equivalent-machine-draft"));
  assert.throws(() => validatePcmEditorialIncrementalBatch(unchanged), /declared counts/u);

  const partitionBound = partitionFixture();
  assert.equal(validatePcmEditorialIncrementalBatch(partitionBound).accepted, 1);
  partitionBound.artifact.sourcePartitionBinding.canonicalSha256 = "1".repeat(64);
  assert.throws(() => validatePcmEditorialIncrementalBatch(partitionBound), /committed source partition/u);

  const reportOnlyV2 = partitionFixture();
  reportOnlyV2.gapReport = fixture().gapReport;
  delete reportOnlyV2.sourcePartition;
  assert.throws(() => validatePcmEditorialIncrementalBatch(reportOnlyV2), /requires the committed source partition/u);
});
