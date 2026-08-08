import { canonicalJsonSha256, pcmEditorialCandidateFindings } from "./pcm-editorial-gap-report.mjs";

const TOP_LEVEL_FIELDS_V1 = [
  "activationReady",
  "basedOnGapReport",
  "batchId",
  "counts",
  "gateBinding",
  "locale",
  "policy",
  "proposals",
  "schema",
  "sourceFreeze",
  "status",
];
const TOP_LEVEL_FIELDS_V2 = [...TOP_LEVEL_FIELDS_V1, "sourcePartitionBinding"];
const TOP_LEVEL_FIELDS_V3 = [...TOP_LEVEL_FIELDS_V2, "sequenceBinding"];
const SOURCE_FREEZE_FIELDS = ["sourceCount", "sourceKeysSha256"];
const GAP_REPORT_FIELDS = ["canonicalSha256", "gapCount", "reusableProposalCount", "schema"];
const SOURCE_PARTITION_FIELDS = [
  "canonicalSha256",
  "gapSourceKeysSha256",
  "partitionBytesSha256",
  "reusableSourceKeysSha256",
  "schema",
];
const SEQUENCE_BINDING_FIELDS = [
  "batchSize",
  "priorAcceptedSourceCount",
  "priorBatchChainSha256",
  "priorBatchCount",
  "priorSourceKeysSha256",
  "schema",
  "selection",
];
const GATE_BINDING_FIELDS = [
  "pcmQualityModuleSha256",
  "protectedIntegrityModuleSha256",
  "salvageModuleSha256",
];
const POLICY_FIELDS = [
  "canonicalEnglishControls",
  "directApplicationPermitted",
  "maxSourceLength",
  "reviewClaim",
  "scope",
];
const COUNT_FIELDS = ["accepted", "attempted", "rejected"];
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const FULL_FROZEN_GAP_BATCH_SIZE = 100;
const FULL_FROZEN_GAP_SCOPE = "FULL_FROZEN_GAP";
const FULL_FROZEN_GAP_SELECTION = "NEXT_FROZEN_GAP_AFTER_VALIDATED_PRIOR_BATCHES";

const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const sortedKeys = (value) => Object.keys(value).sort((left, right) => left.localeCompare(right, "en"));

function assertExactFields(value, expected, label) {
  if (!isRecord(value)
    || JSON.stringify(sortedKeys(value)) !== JSON.stringify([...expected].sort((left, right) => left.localeCompare(right, "en")))) {
    throw new Error(`${label} has missing or unexpected fields`);
  }
}

function assertSha256(value, label) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest`);
  }
}

function assertSafeCount(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer`);
}

export function auditPcmEditorialIncrementalBatch({
  artifact,
  inventory,
  gapReport,
  sourcePartition,
  criticalSources,
  currentGateBinding,
  priorArtifacts = [],
}) {
  const isV1 = artifact?.schema === "iat-pcm-editorial-incremental-batch/v1";
  const isV2 = artifact?.schema === "iat-pcm-editorial-incremental-batch/v2";
  const isV3 = artifact?.schema === "iat-pcm-editorial-incremental-batch/v3";
  if (!isV1 && !isV2 && !isV3) throw new Error("PCM incremental batch schema or locale is invalid");
  assertExactFields(
    artifact,
    isV3 ? TOP_LEVEL_FIELDS_V3 : isV2 ? TOP_LEVEL_FIELDS_V2 : TOP_LEVEL_FIELDS_V1,
    "PCM incremental batch",
  );
  assertExactFields(artifact.sourceFreeze, SOURCE_FREEZE_FIELDS, "PCM incremental source freeze");
  assertExactFields(artifact.basedOnGapReport, GAP_REPORT_FIELDS, "PCM incremental gap-report binding");
  if (isV2 || isV3) {
    assertExactFields(artifact.sourcePartitionBinding, SOURCE_PARTITION_FIELDS, "PCM incremental source-partition binding");
  }
  if (isV3) assertExactFields(artifact.sequenceBinding, SEQUENCE_BINDING_FIELDS, "PCM incremental sequence binding");
  assertExactFields(artifact.gateBinding, GATE_BINDING_FIELDS, "PCM incremental gate binding");
  assertExactFields(artifact.policy, POLICY_FIELDS, "PCM incremental policy");
  assertExactFields(artifact.counts, COUNT_FIELDS, "PCM incremental counts");

  if (artifact.locale !== "pcm") {
    throw new Error("PCM incremental batch schema or locale is invalid");
  }
  if (typeof artifact.batchId !== "string" || !/^[a-z0-9-]{8,80}$/u.test(artifact.batchId)) {
    throw new Error("PCM incremental batch ID is invalid");
  }
  if (artifact.status !== "CURRENT_GATES_PASS_INCREMENTAL_ONLY" || artifact.activationReady !== false) {
    throw new Error("PCM incremental batch must remain non-activating and current-gates-only");
  }
  const expectedScope = isV3
    ? FULL_FROZEN_GAP_SCOPE
    : isV2
      ? "HIGH_PRIORITY_PUBLIC_UI"
      : "HIGH_PRIORITY_SHORT_PUBLIC_UI";
  if (artifact.policy.scope !== expectedScope
    || artifact.policy.canonicalEnglishControls !== true
    || artifact.policy.directApplicationPermitted !== false
    || artifact.policy.reviewClaim !== "AI_GENERATED_UNVERIFIED"
    || !Number.isSafeInteger(artifact.policy.maxSourceLength)
    || artifact.policy.maxSourceLength < 1) {
    throw new Error("PCM incremental batch policy is invalid");
  }
  if (!isRecord(artifact.proposals)) throw new Error("PCM incremental proposals must be an object");
  const hasGapReport = isRecord(gapReport) && Array.isArray(gapReport.gaps);
  const hasSourcePartition = isRecord(sourcePartition)
    && Array.isArray(sourcePartition.gapSources)
    && Array.isArray(sourcePartition.reusableSources)
    && isRecord(sourcePartition.gapReportBinding)
    && isRecord(sourcePartition.counts);
  if (!Array.isArray(inventory?.sources) || Number(hasGapReport) + Number(hasSourcePartition) !== 1) {
    throw new Error("PCM incremental validation inputs are malformed");
  }
  if ((isV2 || isV3) && !hasSourcePartition) {
    throw new Error(`PCM incremental ${isV3 ? "v3" : "v2"} batch requires the committed source partition`);
  }
  if (!Array.isArray(criticalSources) || criticalSources.some((source) => typeof source !== "string" || !source)) {
    throw new Error("PCM incremental critical source inventory is malformed");
  }
  assertExactFields(currentGateBinding, GATE_BINDING_FIELDS, "Current PCM gate binding");
  for (const [field, digest] of Object.entries(artifact.gateBinding)) {
    assertSha256(digest, `PCM incremental gate binding ${field}`);
    if (digest !== currentGateBinding[field]) throw new Error(`PCM incremental gate binding is stale: ${field}`);
  }
  assertSha256(artifact.sourceFreeze.sourceKeysSha256, "PCM incremental source freeze digest");
  assertSha256(artifact.basedOnGapReport.canonicalSha256, "PCM incremental gap-report digest");
  if (isV2 || isV3) {
    for (const [field, digest] of Object.entries(artifact.sourcePartitionBinding).filter(([field]) => field !== "schema")) {
      assertSha256(digest, `PCM incremental source-partition binding ${field}`);
    }
    if (artifact.sourcePartitionBinding.schema !== sourcePartition.manifestSchema
      || artifact.sourcePartitionBinding.canonicalSha256 !== sourcePartition.manifestCanonicalSha256
      || artifact.sourcePartitionBinding.partitionBytesSha256 !== sourcePartition.partitionDigests.partitionBytesSha256
      || artifact.sourcePartitionBinding.gapSourceKeysSha256 !== sourcePartition.partitionDigests.gapSourceKeysSha256
      || artifact.sourcePartitionBinding.reusableSourceKeysSha256 !== sourcePartition.partitionDigests.reusableSourceKeysSha256) {
      throw new Error("PCM incremental batch does not match the committed source partition");
    }
  }
  if (artifact.sourceFreeze.sourceCount !== inventory.sourceCount
    || artifact.sourceFreeze.sourceKeysSha256 !== inventory.sourceKeysSha256) {
    throw new Error("PCM incremental batch does not match the current source freeze");
  }
  const boundGapReport = hasGapReport
    ? {
      schema: gapReport.schema,
      canonicalSha256: canonicalJsonSha256(gapReport),
      gapCount: gapReport.counts?.gapCount,
      reusableProposalCount: gapReport.counts?.reusableProposalCount,
    }
    : {
      schema: sourcePartition.gapReportBinding.schema,
      canonicalSha256: sourcePartition.gapReportBinding.canonicalSha256,
      gapCount: sourcePartition.counts.gapSourceCount,
      reusableProposalCount: sourcePartition.counts.reusableSourceCount,
    };
  if (artifact.basedOnGapReport.schema !== boundGapReport.schema
    || artifact.basedOnGapReport.canonicalSha256 !== boundGapReport.canonicalSha256
    || artifact.basedOnGapReport.gapCount !== boundGapReport.gapCount
    || artifact.basedOnGapReport.reusableProposalCount !== boundGapReport.reusableProposalCount) {
    throw new Error("PCM incremental batch does not match the bound gap report");
  }
  for (const field of COUNT_FIELDS) assertSafeCount(artifact.counts[field], `PCM incremental count ${field}`);

  let fullFrozenGapPriorSources;
  if (isV3) {
    if (!Array.isArray(priorArtifacts)) throw new Error("PCM full-frozen-gap prior batches are malformed");
    const binding = artifact.sequenceBinding;
    if (binding.schema !== "iat-pcm-editorial-sequence-binding/v1"
      || binding.selection !== FULL_FROZEN_GAP_SELECTION
      || binding.batchSize !== FULL_FROZEN_GAP_BATCH_SIZE) {
      throw new Error("PCM full-frozen-gap sequence policy is invalid");
    }
    assertSafeCount(binding.priorBatchCount, "PCM full-frozen-gap prior batch count");
    assertSafeCount(binding.priorAcceptedSourceCount, "PCM full-frozen-gap prior accepted-source count");
    assertSha256(binding.priorBatchChainSha256, "PCM full-frozen-gap prior batch-chain digest");
    assertSha256(binding.priorSourceKeysSha256, "PCM full-frozen-gap prior source-key digest");
    if (binding.priorBatchCount !== priorArtifacts.length) {
      throw new Error("PCM full-frozen-gap prior batch count does not match validation inputs");
    }

    const currentSequenceMatch = artifact.batchId.match(/^pcm-full-frozen-gap-(\d{3})$/u);
    if (!currentSequenceMatch || Number(currentSequenceMatch[1]) !== priorArtifacts.length + 1) {
      throw new Error("PCM full-frozen-gap batch ID is not the next sequence number");
    }
    const priorBatchIds = new Set();
    const priorBatchDigests = [];
    fullFrozenGapPriorSources = new Set();
    for (let index = 0; index < priorArtifacts.length; index += 1) {
      const priorArtifact = priorArtifacts[index];
      const priorSequenceMatch = priorArtifact?.batchId?.match(/-(\d{3})$/u);
      if (!priorSequenceMatch || Number(priorSequenceMatch[1]) !== index + 1) {
        throw new Error("PCM full-frozen-gap prior batches are out of sequence");
      }
      if (priorBatchIds.has(priorArtifact.batchId)) {
        throw new Error(`PCM full-frozen-gap duplicate prior batch ID: ${priorArtifact.batchId}`);
      }
      priorBatchIds.add(priorArtifact.batchId);
      const priorResult = validatePcmEditorialIncrementalBatch({
        artifact: priorArtifact,
        inventory,
        gapReport,
        sourcePartition,
        criticalSources,
        currentGateBinding,
        priorArtifacts: priorArtifacts.slice(0, index),
      });
      priorBatchDigests.push(priorResult.batchCanonicalSha256);
      for (const source of Object.keys(priorResult.acceptedProposals)) {
        if (fullFrozenGapPriorSources.has(source)) {
          throw new Error(`PCM full-frozen-gap duplicate source across prior batches: ${source}`);
        }
        fullFrozenGapPriorSources.add(source);
      }
    }
    const priorSourceKeys = [...fullFrozenGapPriorSources]
      .sort((left, right) => left.localeCompare(right, "en"));
    if (binding.priorAcceptedSourceCount !== priorSourceKeys.length
      || binding.priorBatchChainSha256 !== canonicalJsonSha256(priorBatchDigests)
      || binding.priorSourceKeysSha256 !== canonicalJsonSha256(priorSourceKeys)) {
      throw new Error("PCM full-frozen-gap sequence binding does not match validated prior batches");
    }
  }

  const inventorySet = new Set(inventory.sources);
  const criticalSet = new Set(criticalSources);
  const gapSet = new Set(hasGapReport ? gapReport.gaps.map(({ source }) => source) : sourcePartition.gapSources);
  const reusableSet = new Set(
    hasGapReport ? Object.keys(gapReport.reusableProposals ?? {}) : sourcePartition.reusableSources,
  );
  if (isV3) {
    const proposalSources = Object.keys(artifact.proposals);
    for (const source of proposalSources) {
      if (fullFrozenGapPriorSources.has(source)) {
        throw new Error(`PCM full-frozen-gap batch duplicates a validated prior source: ${source}`);
      }
      if (reusableSet.has(source)) {
        throw new Error(`PCM full-frozen-gap batch includes a reusable source: ${source}`);
      }
      if (!gapSet.has(source)) {
        throw new Error(`PCM full-frozen-gap batch includes a non-gap source: ${source}`);
      }
    }
    const expectedSources = sourcePartition.gapSources
      .filter((source) => !fullFrozenGapPriorSources.has(source))
      .slice(0, FULL_FROZEN_GAP_BATCH_SIZE);
    if (expectedSources.length === 0) throw new Error("PCM full-frozen-gap partition has no remaining gaps");
    if (JSON.stringify(proposalSources) !== JSON.stringify(expectedSources)) {
      throw new Error("PCM full-frozen-gap proposals are not the exact deterministic next slice");
    }
  }
  const accepted = {};
  const rejected = {};
  for (const source of sortedKeys(artifact.proposals)) {
    const translation = artifact.proposals[source];
    const structuralFindings = [];
    if (!inventorySet.has(source)) structuralFindings.push({ rule: "source-not-in-current-freeze" });
    if (!gapSet.has(source)) structuralFindings.push({ rule: "source-not-in-bound-gap-report" });
    if (reusableSet.has(source)) structuralFindings.push({ rule: "source-already-reusable" });
    if (!isV3 && !criticalSet.has(source)) structuralFindings.push({ rule: "source-not-critical-public-ui" });
    if (source.length > artifact.policy.maxSourceLength) {
      structuralFindings.push({
        rule: "source-exceeds-batch-length-limit",
        sourceLength: source.length,
        maxSourceLength: artifact.policy.maxSourceLength,
      });
    }
    const findings = [...structuralFindings, ...pcmEditorialCandidateFindings(source, translation)];
    if (findings.length > 0) rejected[source] = { translation, findings };
    else accepted[source] = translation;
  }

  const attempted = Object.keys(artifact.proposals).length;
  const result = {
    attempted,
    accepted: Object.keys(accepted).length,
    rejected: Object.keys(rejected).length,
    acceptedProposals: accepted,
    rejectedProposals: rejected,
    batchCanonicalSha256: canonicalJsonSha256(artifact),
  };
  if (attempted !== result.accepted + result.rejected) {
    throw new Error("PCM incremental batch accounting invariant failed");
  }
  return result;
}

export function validatePcmEditorialIncrementalBatch(inputs) {
  const result = auditPcmEditorialIncrementalBatch(inputs);
  const { artifact } = inputs;
  if (artifact.counts.attempted !== result.attempted
    || artifact.counts.accepted !== result.accepted
    || artifact.counts.rejected !== result.rejected) {
    throw new Error("PCM incremental batch declared counts do not match current validation");
  }
  if (result.rejected > 0) {
    throw new Error(`PCM incremental batch rejected ${result.rejected} of ${result.attempted} proposals`);
  }
  return result;
}

export function serializePcmEditorialIncrementalValidation(result) {
  return `${JSON.stringify({
    schema: "iat-pcm-editorial-incremental-validation/v1",
    status: result.rejected === 0 ? "PASS" : "FAIL",
    activationReady: false,
    attempted: result.attempted,
    accepted: result.accepted,
    rejected: result.rejected,
    batchCanonicalSha256: result.batchCanonicalSha256,
    rejectedProposals: result.rejectedProposals,
  }, null, 2)}\n`;
}
