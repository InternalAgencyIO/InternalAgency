import { createHash } from "node:crypto";
import {
  canonicalJsonSha256,
  pcmEditorialCandidateFindings,
} from "./pcm-editorial-gap-report.mjs";

const TOP_LEVEL_FIELDS = [
  "activationReady",
  "artifactId",
  "baselineCandidates",
  "counts",
  "currentGapReportBinding",
  "editorialRepairs",
  "gateBinding",
  "locale",
  "policy",
  "proposals",
  "schema",
  "sourceFreeze",
  "sourcePartitionBinding",
  "staleProposalArtifactBinding",
  "status",
];
const SOURCE_FREEZE_FIELDS = [
  "evidenceCanonicalSha256",
  "evidenceFileSha256",
  "sourceCount",
  "sourceKeysSha256",
];
const SOURCE_PARTITION_FIELDS = [
  "canonicalSha256",
  "fileSha256",
  "gapSourceKeysSha256",
  "historicalGapReportCanonicalSha256",
  "partitionBytesSha256",
  "reusableSourceKeysSha256",
  "schema",
];
const STALE_ARTIFACT_FIELDS = [
  "canonicalSha256",
  "fileSha256",
  "machineDraftSha256",
  "model",
  "modelRevision",
  "schema",
  "sourceCount",
  "sourceKeysSha256",
];
const CURRENT_REPORT_FIELDS = [
  "canonicalSha256",
  "gapCount",
  "missingExactKeyProposalCount",
  "proposalArtifactCanonicalSha256",
  "rejectedExactKeyProposalCount",
  "reusableCandidateProposalsCanonicalSha256",
  "reusableProposalCount",
  "schema",
  "serializedSha256",
  "sourceCount",
];
const GATE_BINDING_FIELDS = [
  "pcmQualityModuleSha256",
  "protectedIntegrityModuleSha256",
  "salvageModuleSha256",
];
const POLICY_FIELDS = [
  "canonicalEnglishControls",
  "directApplicationPermitted",
  "reviewClaim",
  "runtimeCatalogDependency",
  "scope",
  "selection",
];
const COUNT_FIELDS = [
  "accepted",
  "attempted",
  "baselineCandidateCount",
  "editorialRepairCount",
  "proposalCount",
  "rejected",
  "sourceCount",
];
const REPAIR_FIELDS = ["priorTranslationSha256", "reason", "repairedTranslationSha256"];
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const ALLOWED_REPAIR_REASONS = new Set([
  "COMPOSITION_ACCURACY",
  "NEGATION_AND_STATUS_PRECISION",
  "SEMANTIC_PRECISION",
  "TECHNICAL_PRECISION",
]);

export const PCM_REUSABLE_PROPOSAL_BINDINGS = Object.freeze({
  sourceFreeze: Object.freeze({
    sourceCount: 1_491,
    sourceKeysSha256: "5baff9a147d6390100a976e2d77b860ec0225db92f05ebb0d6361ac2c8981004",
    evidenceCanonicalSha256: "991dbd6670f96d8e39e8ffbc0ff155e10e7790b90bc38e263253074550b46f3f",
    evidenceFileSha256: "ed8b33a06e77245db7497752f02db4938ded1a3e498b37fdebe0acb55ae2c5c3",
  }),
  sourcePartitionBinding: Object.freeze({
    schema: "iat-pcm-editorial-source-partition/v1",
    canonicalSha256: "e79de0eafbde98a5ac06a162e6f66ad754e39bfe9462e924ec557c3174585de8",
    fileSha256: "b8377c1251627529eb2a00af0978fd1a8742ef05d84e79c54356f3c133b6ef2c",
    partitionBytesSha256: "3511fb255e30ae2d2b52c40b097b7eccb7bf84e0ce99744dc81121ce70dafcfe",
    gapSourceKeysSha256: "b137920d83f75d7096ef716894170b3ea6cc85b7a2cb680d365b4138113be3f8",
    reusableSourceKeysSha256: "d519ff5844ec9d8be78f05692508a80812146d511c5a67ea90d49f324ec74f82",
    historicalGapReportCanonicalSha256: "87d2f0b91a86d1c44d696ff92ecb1ceea10eff40910664ea5e8c1742e1a9da5f",
  }),
  staleProposalArtifactBinding: Object.freeze({
    schema: "iat-pcm-editorial-proposals/v1",
    fileSha256: "ed5b2ac078a6df671a10a3c91fb3166efd2b660f6260e906b71a2bedf7df40a0",
    canonicalSha256: "b5958bbf0ffa0bb0d3a0ff667381d7903f51d738f916cb62d29595fc6538505a",
    machineDraftSha256: "b3d914114c8b77be4f667e8ad1dc4c3e957e5d2acc252aa00c2089109dfbbc48",
    sourceKeysSha256: "c3c9ca311b3cc4503a8c29fde9d6e63ed12b2e8e4c798b0b415f2d5c5f3ace23",
    sourceCount: 1_491,
    model: "NITHUB-AI/marian-mt-bbc-en-pcm",
    modelRevision: "99c6ff5290bad2b2cd4ada9fe52151e67adf6058",
  }),
  currentGapReportBinding: Object.freeze({
    schema: "iat-pcm-editorial-gap-report/v1",
    canonicalSha256: "3a22471238e2096b39d26aeac7fa76720110abe74cc680f1971d5c29070b05bf",
    serializedSha256: "9ce5bbc8aded7563eabbb1e79e02a8473d0e1755c2330765771c56fb0a9c5896",
    sourceCount: 1_491,
    gapCount: 1_312,
    reusableProposalCount: 179,
    rejectedExactKeyProposalCount: 617,
    missingExactKeyProposalCount: 695,
    proposalArtifactCanonicalSha256: "b5958bbf0ffa0bb0d3a0ff667381d7903f51d738f916cb62d29595fc6538505a",
    reusableCandidateProposalsCanonicalSha256: "8ac4388788f0e2bfb26ee67a4bdef609a30656fa9e7b691b7002749964aeb858",
  }),
  gateBinding: Object.freeze({
    protectedIntegrityModuleSha256: "fed974cf1ef4a5c6678c87e071beeac517cff051378eb6dec5cf67430bfd27e1",
    pcmQualityModuleSha256: "6c19e96dc891343e968e2f20824fdd54b681f8876273bb0c7b70d9fdee6c7be3",
    salvageModuleSha256: "81f5406f5c796a7d09273c61fe8216a04f55ac701bcb9efb12c3202de8a777ae",
  }),
});

const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const sortedKeys = (value) => Object.keys(value).sort((left, right) => left.localeCompare(right, "en"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

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

function assertExactBinding(actual, expected, fields, label) {
  assertExactFields(actual, fields, label);
  for (const field of fields) {
    if (field.toLocaleLowerCase("en").includes("sha256")) assertSha256(actual[field], `${label} ${field}`);
    if (actual[field] !== expected[field]) throw new Error(`${label} does not match immutable provenance: ${field}`);
  }
}

export function validatePcmEditorialReusableProposals({
  artifact,
  sourcePartition,
  sourcePartitionFileSha256,
  currentGateBinding,
}) {
  assertExactFields(artifact, TOP_LEVEL_FIELDS, "PCM reusable-proposal artifact");
  assertExactBinding(
    artifact.sourceFreeze,
    PCM_REUSABLE_PROPOSAL_BINDINGS.sourceFreeze,
    SOURCE_FREEZE_FIELDS,
    "PCM reusable source freeze",
  );
  assertExactBinding(
    artifact.sourcePartitionBinding,
    PCM_REUSABLE_PROPOSAL_BINDINGS.sourcePartitionBinding,
    SOURCE_PARTITION_FIELDS,
    "PCM reusable source partition binding",
  );
  assertSha256(sourcePartitionFileSha256, "PCM reusable source partition file SHA-256");
  if (sourcePartitionFileSha256 !== artifact.sourcePartitionBinding.fileSha256) {
    throw new Error("PCM reusable source partition bytes do not match immutable provenance");
  }
  assertExactBinding(
    artifact.staleProposalArtifactBinding,
    PCM_REUSABLE_PROPOSAL_BINDINGS.staleProposalArtifactBinding,
    STALE_ARTIFACT_FIELDS,
    "PCM reusable stale-artifact binding",
  );
  assertExactBinding(
    artifact.currentGapReportBinding,
    PCM_REUSABLE_PROPOSAL_BINDINGS.currentGapReportBinding,
    CURRENT_REPORT_FIELDS,
    "PCM reusable current-gap-report binding",
  );
  assertExactBinding(
    artifact.gateBinding,
    PCM_REUSABLE_PROPOSAL_BINDINGS.gateBinding,
    GATE_BINDING_FIELDS,
    "PCM reusable gate binding",
  );
  assertExactBinding(
    currentGateBinding,
    PCM_REUSABLE_PROPOSAL_BINDINGS.gateBinding,
    GATE_BINDING_FIELDS,
    "Current PCM reusable gate binding",
  );
  assertExactFields(artifact.policy, POLICY_FIELDS, "PCM reusable policy");
  assertExactFields(artifact.counts, COUNT_FIELDS, "PCM reusable counts");

  if (artifact.schema !== "iat-pcm-editorial-reusable-proposals/v1"
    || artifact.artifactId !== "pcm-reusable-proposals-5baff9-v1"
    || artifact.locale !== "pcm") {
    throw new Error("PCM reusable-proposal schema, ID, or locale is invalid");
  }
  if (artifact.status !== "CURRENT_GATES_PASS_REUSABLE_ONLY" || artifact.activationReady !== false) {
    throw new Error("PCM reusable proposals must remain current-gates-only and non-activating");
  }
  if (artifact.policy.scope !== "EXACT_COMMITTED_REUSABLE_SET"
    || artifact.policy.selection !== "CURRENT_GATE_PASS_FROM_BOUND_STALE_ARTIFACT"
    || artifact.policy.canonicalEnglishControls !== true
    || artifact.policy.directApplicationPermitted !== false
    || artifact.policy.runtimeCatalogDependency !== false
    || artifact.policy.reviewClaim !== "AI_GENERATED_UNVERIFIED") {
    throw new Error("PCM reusable-proposal policy is invalid");
  }
  if (!isRecord(artifact.baselineCandidates)
    || !isRecord(artifact.proposals)
    || !isRecord(artifact.editorialRepairs)) {
    throw new Error("PCM reusable proposal payloads must be objects");
  }
  if (!Array.isArray(sourcePartition?.reusableSources)
    || !Array.isArray(sourcePartition?.gapSources)
    || !isRecord(sourcePartition?.counts)
    || !isRecord(sourcePartition?.partitionDigests)) {
    throw new Error("PCM reusable source-partition validation is malformed");
  }
  const expectedPartition = PCM_REUSABLE_PROPOSAL_BINDINGS.sourcePartitionBinding;
  if (sourcePartition.manifestSchema !== expectedPartition.schema
    || sourcePartition.manifestCanonicalSha256 !== expectedPartition.canonicalSha256
    || sourcePartition.sourceFreeze.sourceCount !== artifact.sourceFreeze.sourceCount
    || sourcePartition.sourceFreeze.sourceKeysSha256 !== artifact.sourceFreeze.sourceKeysSha256
    || sourcePartition.counts.reusableSourceCount !== 179
    || sourcePartition.counts.gapSourceCount !== 1_312
    || sourcePartition.partitionDigests.partitionBytesSha256 !== expectedPartition.partitionBytesSha256
    || sourcePartition.partitionDigests.gapSourceKeysSha256 !== expectedPartition.gapSourceKeysSha256
    || sourcePartition.partitionDigests.reusableSourceKeysSha256 !== expectedPartition.reusableSourceKeysSha256
    || sourcePartition.gapReportBinding.canonicalSha256 !== expectedPartition.historicalGapReportCanonicalSha256) {
    throw new Error("PCM reusable proposals do not match the validated committed source partition");
  }

  for (const field of COUNT_FIELDS) assertSafeCount(artifact.counts[field], `PCM reusable count ${field}`);
  const baselineSources = Object.keys(artifact.baselineCandidates);
  const proposalSources = Object.keys(artifact.proposals);
  const repairSources = Object.keys(artifact.editorialRepairs);
  const expectedSources = sourcePartition.reusableSources;
  if (JSON.stringify(baselineSources) !== JSON.stringify(expectedSources)
    || JSON.stringify(proposalSources) !== JSON.stringify(expectedSources)) {
    throw new Error("PCM reusable proposals are not the exact ordered committed reusable set");
  }
  const gapSet = new Set(sourcePartition.gapSources);
  if (proposalSources.some((source) => gapSet.has(source))) {
    throw new Error("PCM reusable proposal overlaps the committed gap set");
  }
  if (canonicalJsonSha256(artifact.baselineCandidates)
    !== artifact.currentGapReportBinding.reusableCandidateProposalsCanonicalSha256) {
    throw new Error("PCM reusable baseline candidates do not match the current regenerated gap report");
  }

  const baselineFindings = {};
  const proposalFindings = {};
  const changedSources = [];
  for (const source of expectedSources) {
    const baseline = artifact.baselineCandidates[source];
    const proposal = artifact.proposals[source];
    const baselineFailure = pcmEditorialCandidateFindings(source, baseline);
    const proposalFailure = pcmEditorialCandidateFindings(source, proposal);
    if (baselineFailure.length > 0) baselineFindings[source] = baselineFailure;
    if (proposalFailure.length > 0) proposalFindings[source] = proposalFailure;
    if (baseline !== proposal) changedSources.push(source);
  }
  if (Object.keys(baselineFindings).length > 0) {
    throw new Error(`PCM reusable baseline rejected ${Object.keys(baselineFindings).length} current-gate candidates`);
  }
  if (Object.keys(proposalFindings).length > 0) {
    throw new Error(`PCM reusable proposals rejected ${Object.keys(proposalFindings).length} current-gate candidates`);
  }
  if (JSON.stringify(repairSources) !== JSON.stringify(changedSources)) {
    throw new Error("PCM reusable repair ledger does not exactly match changed proposals");
  }
  for (const source of repairSources) {
    const repair = artifact.editorialRepairs[source];
    assertExactFields(repair, REPAIR_FIELDS, `PCM reusable repair ${JSON.stringify(source)}`);
    assertSha256(repair.priorTranslationSha256, `PCM reusable prior translation ${JSON.stringify(source)}`);
    assertSha256(repair.repairedTranslationSha256, `PCM reusable repaired translation ${JSON.stringify(source)}`);
    if (!ALLOWED_REPAIR_REASONS.has(repair.reason)
      || repair.priorTranslationSha256 !== sha256(artifact.baselineCandidates[source])
      || repair.repairedTranslationSha256 !== sha256(artifact.proposals[source])
      || repair.priorTranslationSha256 === repair.repairedTranslationSha256) {
      throw new Error(`PCM reusable repair binding is invalid for ${JSON.stringify(source)}`);
    }
  }

  const expectedCounts = {
    sourceCount: 179,
    baselineCandidateCount: 179,
    proposalCount: 179,
    editorialRepairCount: changedSources.length,
    attempted: 179,
    accepted: 179,
    rejected: 0,
  };
  for (const [field, expected] of Object.entries(expectedCounts)) {
    if (artifact.counts[field] !== expected) {
      throw new Error(`PCM reusable count ${field}=${artifact.counts[field]} does not match ${expected}`);
    }
  }

  return {
    attempted: 179,
    accepted: 179,
    rejected: 0,
    editorialRepairCount: changedSources.length,
    sourceKeysSha256: expectedPartition.reusableSourceKeysSha256,
    artifactCanonicalSha256: canonicalJsonSha256(artifact),
    baselineFindings,
    proposalFindings,
  };
}

export function serializePcmEditorialReusableProposalValidation(result) {
  return `${JSON.stringify({
    schema: "iat-pcm-editorial-reusable-proposal-validation/v1",
    status: result.rejected === 0 ? "PASS" : "FAIL",
    activationReady: false,
    attempted: result.attempted,
    accepted: result.accepted,
    rejected: result.rejected,
    editorialRepairCount: result.editorialRepairCount,
    sourceKeysSha256: result.sourceKeysSha256,
    artifactCanonicalSha256: result.artifactCanonicalSha256,
  }, null, 2)}\n`;
}
