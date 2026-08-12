import { createHash } from "node:crypto";
import {
  canonicalJsonSha256,
  pcmEditorialCandidateFindings,
} from "./pcm-editorial-gap-report.mjs";
import {
  PCM_REUSABLE_PROPOSAL_BINDINGS,
  validatePcmEditorialReusableProposals,
} from "./pcm-editorial-reusable-proposals.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sorted = (values) => [...values].sort((left, right) => left.localeCompare(right, "en"));
const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

const BATCH_BINDINGS = [
  [
    "pcm-public-ui-short-001.json",
    "iat-pcm-editorial-incremental-batch/v1",
    "pcm-public-ui-short-001",
    60,
    "5f5d7e543dda68b7a615161dec55bc5013b6c05171dac8ca193ba1945c721778",
    "b971dc3ff0fdd6ab13d75cbee984b2e3c49ecf8e3e4eb38e3fb91cb88e030a01",
  ],
  [
    "pcm-public-ui-priority-002.json",
    "iat-pcm-editorial-incremental-batch/v2",
    "pcm-public-ui-priority-002",
    100,
    "4599f503a3d068874f2c7912c60de10c6d1b2d005bf9a5acf822c89e9c13e6a2",
    "5f540361fcfcf01b532c31a0dd0718ef484b6764d65d105ac9509391fd099d53",
  ],
  [
    "pcm-public-ui-priority-003.json",
    "iat-pcm-editorial-incremental-batch/v2",
    "pcm-public-ui-priority-003",
    100,
    "0000670d2d82cc2cfa2cb20e0c13d042428124903bde087ce1225ad9d35f13f8",
    "6048cdd8d85a79157f09b514f9364b838ac6de08a45a8c851dc3f037bb3b867c",
  ],
  [
    "pcm-public-ui-priority-004.json",
    "iat-pcm-editorial-incremental-batch/v2",
    "pcm-public-ui-priority-004",
    100,
    "e00783b90ee189dba4d5d0ba2429a80cc25293c1bc57b90e3d89e465aa355cb5",
    "c99b8e217faa1dd7166891d2b1b3c422b764c3e309a2e647258f0e3b9391fc8a",
  ],
  [
    "pcm-public-ui-priority-005.json",
    "iat-pcm-editorial-incremental-batch/v2",
    "pcm-public-ui-priority-005",
    25,
    "afd94dbce172a51a2fe91feaa3fbde9df939962128fe6ffaeda6d7e523543566",
    "22e709ce2c39b3fcfb3a3549471653f7d68823d2f8d3a6c08b7da837bc62f1ab",
  ],
  [
    "pcm-public-ui-priority-006.json",
    "iat-pcm-editorial-incremental-batch/v3",
    "pcm-full-frozen-gap-006",
    100,
    "f105245ab29d93d40f7f73245de5cff276ed8759355a5e82385d491562aa9721",
    "64b79fb04536845336ed08ac9f389c8f81b123aeb59880ca7d2c1a659f1c69b4",
  ],
  [
    "pcm-public-ui-priority-007.json",
    "iat-pcm-editorial-incremental-batch/v3",
    "pcm-full-frozen-gap-007",
    100,
    "d47170cb3c294f74cbc580ed9430981156d8d3597c632a3d77f3a0db653cf648",
    "96e90bde97801689b674f82a0113ee8d5c5cbf81474bf452b63f329b47c62564",
  ],
  [
    "pcm-public-ui-priority-008.json",
    "iat-pcm-editorial-incremental-batch/v3",
    "pcm-full-frozen-gap-008",
    100,
    "428e64c3aa0ec2216f09d4a2655e7c1fcf89ee4fb351739c1fbf362ed4c3dd61",
    "b3ff01954e374b568b08922c2f17056883864ea331f96f64a6617f2e492c0fb1",
  ],
  [
    "pcm-public-ui-priority-009.json",
    "iat-pcm-editorial-incremental-batch/v3",
    "pcm-full-frozen-gap-009",
    100,
    "ab86a328b8d27dea3fb8abafc875a88ab82fbe728a9bc24affd77977f17c1f81",
    "ddee5eb185bbe2f3fe36189770b200d99a8c7293ae0b2aeffd20b8a24140fdfd",
  ],
  [
    "pcm-public-ui-priority-010.json",
    "iat-pcm-editorial-incremental-batch/v3",
    "pcm-full-frozen-gap-010",
    100,
    "ff857b2b4c1c7f1c7a84da36edde41bd732c21fbdb24ea3f5788187ce72ed2af",
    "1766ea7893b463d747d11d62888fefb619793c637dec66680ee5289a3331109a",
  ],
  [
    "pcm-public-ui-priority-011.json",
    "iat-pcm-editorial-incremental-batch/v3",
    "pcm-full-frozen-gap-011",
    100,
    "0ccf74ae642b6ca3d9745c26255a912cb81ad02ca655fd353f06291c851d34eb",
    "b057dfae759af4ee86448bea0a070a7f3bbc3fad1f11818a1b6d75892a11d3bb",
  ],
  [
    "pcm-public-ui-priority-012.json",
    "iat-pcm-editorial-incremental-batch/v3",
    "pcm-full-frozen-gap-012",
    100,
    "718f5d402efeadc7841618af46ad75e39b3f7b712bdc246ad2694e10c568aa8a",
    "4bfd5c281c8fafc7667900237bda4eed4a81256cbcbfb2478b23cd18da4e66b0",
  ],
  [
    "pcm-public-ui-priority-013.json",
    "iat-pcm-editorial-incremental-batch/v3",
    "pcm-full-frozen-gap-013",
    100,
    "3e94ef07d5679bab2714e219c981ad3906c746975f07103a02a5d8e402d8166d",
    "f7a6444b6ad4b6061233aeb2a954aa55391d67b0fefa889b581bca6f8dd2221e",
  ],
  [
    "pcm-public-ui-priority-014.json",
    "iat-pcm-editorial-incremental-batch/v3",
    "pcm-full-frozen-gap-014",
    100,
    "24c8b83613e3f46545e58c8cdaa020e3a662a6ae40bed7539de53a4fcb0fbb75",
    "dd714faf33d95212328c0dbc1fd39826dada0ff24ef3b6d3add307ceb765e05d",
  ],
  [
    "pcm-public-ui-priority-015.json",
    "iat-pcm-editorial-incremental-batch/v3",
    "pcm-full-frozen-gap-015",
    27,
    "cc1e0eaa5417b1fb972d664a6f15b61f4bdf3063b0785658df45144bac33ea9b",
    "80234567e9715a292eec4f064e5988e88f0f1f132badf72470eeff9cb81d0390",
  ],
].map(([
  fileName,
  schema,
  batchId,
  acceptedSourceCount,
  fileSha256,
  canonicalSha256,
], index) => Object.freeze({
  sequence: index + 1,
  fileName,
  schema,
  batchId,
  acceptedSourceCount,
  fileSha256,
  canonicalSha256,
}));

export const PCM_MACHINE_DRAFT_ASSEMBLY_BINDINGS = Object.freeze({
  sourceFreezeBinding: Object.freeze({
    schema: "iat-pcm-source-freeze-evidence/v1",
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
  }),
  historicalGapReportBinding: Object.freeze({
    schema: "iat-pcm-editorial-gap-report/v1",
    canonicalSha256: "87d2f0b91a86d1c44d696ff92ecb1ceea10eff40910664ea5e8c1742e1a9da5f",
    fileSha256: "6932c66e5cd7e8d9883d3a0a42fb91cf8181ca5e2883ebb76826cac0a8e8cf10",
    gateBinding: Object.freeze({
      protectedIntegrityModuleSha256: "fed974cf1ef4a5c6678c87e071beeac517cff051378eb6dec5cf67430bfd27e1",
      pcmQualityModuleSha256: "578dd568376aba801dff61b345a1f464457a4a5e5a482449e4834cfaa2e68e29",
      salvageModuleSha256: "584fe48f553fb7dd4f079119658118b0009c0093a9b96bd0fd6ef87d994efd99",
    }),
  }),
  currentGapReportBinding: PCM_REUSABLE_PROPOSAL_BINDINGS.currentGapReportBinding,
  currentHelperBinding: PCM_REUSABLE_PROPOSAL_BINDINGS.gateBinding,
  reusableProposalBinding: Object.freeze({
    schema: "iat-pcm-editorial-reusable-proposals/v1",
    fileSha256: "28ce1764dab400bf51707380db6dc8aaf103ad439bdfc1eddccceeb7d3a89abc",
    canonicalSha256: "05bf48f15aa6d73ae3a619f1f86d4e32cd111114dd4c009567edfdc8f8b0b767",
    proposalEntriesSha256: "445964687d71d4727ad4fb314b70800ace4b2ab4096739f14118825ad0f994ab",
    repairSourceKeysSha256: "fcda512f35581218d0a0e9d1d1911ce4fc4622ad75db927742dab13ea82b895a",
    sourceCount: 179,
    editorialRepairCount: 31,
  }),
  editorialBatchBindings: Object.freeze(BATCH_BINDINGS),
});

function assertSha256(value, label) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest`);
  }
}

function assertExactBinding(actual, expected, label) {
  if (canonicalJsonSha256(actual) !== canonicalJsonSha256(expected)) {
    throw new Error(`${label} does not match immutable assembly provenance`);
  }
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function assertInventory(inventory) {
  const expected = PCM_MACHINE_DRAFT_ASSEMBLY_BINDINGS.sourceFreezeBinding;
  if (!Array.isArray(inventory?.sources)
    || inventory.sourceCount !== expected.sourceCount
    || inventory.sourceKeysSha256 !== expected.sourceKeysSha256
    || inventory.sources.length !== expected.sourceCount
    || sha256(JSON.stringify(inventory.sources)) !== expected.sourceKeysSha256
    || !sameJson(inventory.sources, sorted(inventory.sources))) {
    throw new Error("PCM machine-draft assembly inventory does not match the immutable source freeze");
  }
}

function validatePartitionInput(sourcePartition, sourcePartitionFileSha256) {
  const expected = PCM_MACHINE_DRAFT_ASSEMBLY_BINDINGS.sourcePartitionBinding;
  assertSha256(sourcePartitionFileSha256, "PCM machine-draft source-partition file digest");
  if (sourcePartitionFileSha256 !== expected.fileSha256
    || sourcePartition?.manifestSchema !== expected.schema
    || sourcePartition?.manifestCanonicalSha256 !== expected.canonicalSha256
    || sourcePartition?.partitionDigests?.partitionBytesSha256 !== expected.partitionBytesSha256
    || sourcePartition?.partitionDigests?.gapSourceKeysSha256 !== expected.gapSourceKeysSha256
    || sourcePartition?.partitionDigests?.reusableSourceKeysSha256 !== expected.reusableSourceKeysSha256
    || sourcePartition?.gapReportBinding?.canonicalSha256
      !== PCM_MACHINE_DRAFT_ASSEMBLY_BINDINGS.historicalGapReportBinding.canonicalSha256
    || sourcePartition?.gapReportBinding?.fileSha256
      !== PCM_MACHINE_DRAFT_ASSEMBLY_BINDINGS.historicalGapReportBinding.fileSha256
    || sourcePartition?.counts?.sourceCount !== 1_491
    || sourcePartition?.counts?.gapSourceCount !== 1_312
    || sourcePartition?.counts?.reusableSourceCount !== 179) {
    throw new Error("PCM machine-draft source partition does not match immutable assembly provenance");
  }
}

function bindingsForPartition(sourcePartition) {
  return {
    schema: sourcePartition.manifestSchema,
    canonicalSha256: sourcePartition.manifestCanonicalSha256,
    partitionBytesSha256: sourcePartition.partitionDigests.partitionBytesSha256,
    gapSourceKeysSha256: sourcePartition.partitionDigests.gapSourceKeysSha256,
    reusableSourceKeysSha256: sourcePartition.partitionDigests.reusableSourceKeysSha256,
  };
}

function validateBatchInputs({
  editorialBatches,
  inventory,
  sourcePartition,
  criticalSources,
  currentGateBinding,
}) {
  const expectedBindings = PCM_MACHINE_DRAFT_ASSEMBLY_BINDINGS.editorialBatchBindings;
  if (!Array.isArray(editorialBatches) || editorialBatches.length !== expectedBindings.length) {
    throw new Error("PCM machine-draft assembly requires the exact 15-batch editorial chain");
  }
  const priorCanonicalDigests = [];
  const priorAcceptedSources = new Set();
  const batchBindings = [];
  const gapProposals = {};
  const gapSet = new Set(sourcePartition.gapSources);
  const criticalSet = new Set(criticalSources);
  for (let index = 0; index < expectedBindings.length; index += 1) {
    const expected = expectedBindings[index];
    const input = editorialBatches[index];
    assertSha256(input?.fileSha256, `PCM editorial batch ${expected.sequence} file digest`);
    if (input.fileName !== expected.fileName
      || input.fileSha256 !== expected.fileSha256
      || input.artifact?.schema !== expected.schema
      || input.artifact?.batchId !== expected.batchId
      || canonicalJsonSha256(input.artifact) !== expected.canonicalSha256) {
      throw new Error(`PCM editorial batch ${expected.sequence} does not match immutable assembly provenance`);
    }
    const artifact = input.artifact;
    if (artifact.locale !== "pcm"
      || artifact.status !== "CURRENT_GATES_PASS_INCREMENTAL_ONLY"
      || artifact.activationReady !== false
      || artifact.sourceFreeze?.sourceCount !== inventory.sourceCount
      || artifact.sourceFreeze?.sourceKeysSha256 !== inventory.sourceKeysSha256
      || artifact.basedOnGapReport?.schema !== sourcePartition.gapReportBinding.schema
      || artifact.basedOnGapReport?.canonicalSha256 !== sourcePartition.gapReportBinding.canonicalSha256
      || artifact.basedOnGapReport?.gapCount !== sourcePartition.counts.gapSourceCount
      || artifact.basedOnGapReport?.reusableProposalCount !== sourcePartition.counts.reusableSourceCount
      || !sameJson(artifact.gateBinding, currentGateBinding)
      || artifact.policy?.canonicalEnglishControls !== true
      || artifact.policy?.directApplicationPermitted !== false
      || artifact.policy?.reviewClaim !== "AI_GENERATED_UNVERIFIED"
      || !Number.isSafeInteger(artifact.policy?.maxSourceLength)
      || artifact.policy.maxSourceLength < 1
      || typeof artifact.proposals !== "object"
      || artifact.proposals === null
      || Array.isArray(artifact.proposals)) {
      throw new Error(`PCM editorial batch ${expected.sequence} contract is not current and non-activating`);
    }
    if (expected.sequence > 1) {
      const partition = artifact.sourcePartitionBinding;
      const expectedPartition = bindingsForPartition(sourcePartition);
      if (!sameJson(partition, expectedPartition)) {
        throw new Error(`PCM editorial batch ${expected.sequence} source-partition binding is invalid`);
      }
    }
    const acceptedSources = sorted(Object.keys(artifact.proposals));
    if (expected.sequence >= 6) {
      const sequence = artifact.sequenceBinding;
      const priorSourceKeys = sorted(priorAcceptedSources);
      const expectedSources = sourcePartition.gapSources
        .filter((source) => !priorAcceptedSources.has(source))
        .slice(0, 100);
      if (artifact.policy.scope !== "FULL_FROZEN_GAP"
        || sequence?.schema !== "iat-pcm-editorial-sequence-binding/v1"
        || sequence.selection !== "NEXT_FROZEN_GAP_AFTER_VALIDATED_PRIOR_BATCHES"
        || sequence.batchSize !== 100
        || sequence.priorBatchCount !== index
        || sequence.priorAcceptedSourceCount !== priorSourceKeys.length
        || sequence.priorBatchChainSha256 !== canonicalJsonSha256(priorCanonicalDigests)
        || sequence.priorSourceKeysSha256 !== canonicalJsonSha256(priorSourceKeys)
        || !sameJson(acceptedSources, expectedSources)) {
        throw new Error(`PCM editorial batch ${expected.sequence} linear sequence binding is invalid`);
      }
    } else if (!criticalSources.every((source) => typeof source === "string" && source)
      || !["HIGH_PRIORITY_SHORT_PUBLIC_UI", "HIGH_PRIORITY_PUBLIC_UI"].includes(artifact.policy.scope)) {
      throw new Error(`PCM editorial batch ${expected.sequence} priority scope is invalid`);
    }
    if (artifact.counts?.attempted !== acceptedSources.length
      || artifact.counts?.accepted !== acceptedSources.length
      || artifact.counts?.rejected !== 0
      || acceptedSources.length !== expected.acceptedSourceCount) {
      throw new Error(`PCM editorial batch ${expected.sequence} count result is not immutable`);
    }
    for (const source of acceptedSources) {
      if (!gapSet.has(source)
        || (expected.sequence < 6 && !criticalSet.has(source))
        || source.length > artifact.policy.maxSourceLength
        || priorAcceptedSources.has(source)) {
        throw new Error(`PCM editorial batch ${expected.sequence} source selection is invalid: ${JSON.stringify(source)}`);
      }
      const translation = artifact.proposals[source];
      const findings = pcmEditorialCandidateFindings(source, translation);
      if (findings.length > 0) {
        throw new Error(`PCM editorial batch ${expected.sequence} has current-gate failures for ${JSON.stringify(source)}`);
      }
      if (Object.hasOwn(gapProposals, source)) {
        throw new Error(`PCM editorial batches duplicate frozen source ${JSON.stringify(source)}`);
      }
      gapProposals[source] = translation;
      priorAcceptedSources.add(source);
    }
    batchBindings.push({
      sequence: expected.sequence,
      fileName: expected.fileName,
      schema: expected.schema,
      batchId: expected.batchId,
      acceptedSourceCount: acceptedSources.length,
      acceptedSourceKeysSha256: sha256(JSON.stringify(acceptedSources)),
      fileSha256: input.fileSha256,
      canonicalSha256: expected.canonicalSha256,
    });
    priorCanonicalDigests.push(expected.canonicalSha256);
  }
  return { batchBindings, gapProposals };
}

export function assemblePcmMachineDraft({
  inventory,
  criticalSources,
  sourceFreezeBinding,
  sourcePartition,
  sourcePartitionFileSha256,
  reusableArtifact,
  reusableArtifactFileSha256,
  currentGateBinding,
  editorialBatches,
}) {
  const bindings = PCM_MACHINE_DRAFT_ASSEMBLY_BINDINGS;
  assertInventory(inventory);
  assertExactBinding(sourceFreezeBinding, bindings.sourceFreezeBinding, "PCM source-freeze binding");
  assertExactBinding(currentGateBinding, bindings.currentHelperBinding, "Current PCM helper binding");
  validatePartitionInput(sourcePartition, sourcePartitionFileSha256);
  assertSha256(reusableArtifactFileSha256, "PCM reusable-proposal file digest");
  if (reusableArtifactFileSha256 !== bindings.reusableProposalBinding.fileSha256) {
    throw new Error("PCM reusable-proposal file does not match immutable assembly provenance");
  }
  const reusableResult = validatePcmEditorialReusableProposals({
    artifact: reusableArtifact,
    sourcePartition,
    sourcePartitionFileSha256,
    currentGateBinding,
  });
  if (reusableResult.artifactCanonicalSha256 !== bindings.reusableProposalBinding.canonicalSha256
    || reusableResult.editorialRepairCount !== bindings.reusableProposalBinding.editorialRepairCount
    || sha256(JSON.stringify(Object.entries(reusableArtifact.proposals)))
      !== bindings.reusableProposalBinding.proposalEntriesSha256
    || sha256(JSON.stringify(Object.keys(reusableArtifact.editorialRepairs)))
      !== bindings.reusableProposalBinding.repairSourceKeysSha256) {
    throw new Error("PCM reusable proposals do not match immutable assembly provenance");
  }

  const { batchBindings, gapProposals } = validateBatchInputs({
    editorialBatches,
    inventory,
    sourcePartition,
    criticalSources,
    currentGateBinding,
  });
  const gapSources = sorted(Object.keys(gapProposals));
  const reusableSources = Object.keys(reusableArtifact.proposals);
  if (!sameJson(gapSources, sourcePartition.gapSources)
    || !sameJson(reusableSources, sourcePartition.reusableSources)) {
    throw new Error("PCM machine-draft proposal sets do not cover the exact committed partition");
  }
  const reusableSet = new Set(reusableSources);
  const overlapSources = gapSources.filter((source) => reusableSet.has(source));
  if (overlapSources.length > 0) {
    throw new Error("PCM machine-draft reusable and gap proposal sets overlap");
  }

  const messages = {};
  const uncoveredSources = [];
  const finalGateFindings = {};
  for (const source of inventory.sources) {
    const translation = reusableSet.has(source)
      ? reusableArtifact.proposals[source]
      : gapProposals[source];
    if (typeof translation !== "string") {
      uncoveredSources.push(source);
      continue;
    }
    const findings = pcmEditorialCandidateFindings(source, translation);
    if (findings.length > 0) finalGateFindings[source] = findings;
    messages[source] = translation;
  }
  const coveredSet = new Set([...reusableSources, ...gapSources]);
  const extraSources = [...coveredSet].filter((source) => !inventory.sources.includes(source));
  if (uncoveredSources.length > 0
    || extraSources.length > 0
    || Object.keys(finalGateFindings).length > 0
    || !sameJson(Object.keys(messages), inventory.sources)) {
    throw new Error("PCM machine-draft assembly is not exact, complete, ordered, and current-gates passing");
  }

  const counters = {
    protectedTokenRepairs: 0,
    editorialMachineDraftOverrides: gapSources.length + reusableResult.editorialRepairCount,
    sourceEquivalentLabelEditorialFallbacks: 0,
  };
  const artifact = {
    schema: "iat-pcm-machine-draft/v2",
    locale: "pcm",
    engine: "LOCAL_MARIAN_MACHINE_DRAFT",
    model: "NITHUB-AI/marian-mt-bbc-en-pcm",
    modelRevision: "99c6ff5290bad2b2cd4ada9fe52151e67adf6058",
    license: "CC-BY-4.0",
    sourceKeysSha256: inventory.sourceKeysSha256,
    sourceCount: inventory.sourceCount,
    ...counters,
    aiGenerated: true,
    verified: false,
    canonicalEnglishControls: true,
    qualityClaim: "UNVERIFIED_MACHINE_DRAFT_BEST_EFFORT",
    messages,
  };
  const artifactSerialized = serialize(artifact);
  const artifactFileSha256 = sha256(artifactSerialized);
  const artifactCanonicalSha256 = canonicalJsonSha256(artifact);
  const messageEntriesSha256 = sha256(JSON.stringify(Object.entries(messages)));

  const proof = {
    schema: "iat-pcm-machine-draft-assembly-proof/v1",
    locale: "pcm",
    status: "DETERMINISTIC_CURRENT_GATES_PASS_NON_ACTIVATING_ASSEMBLY",
    activationReady: false,
    directApplicationPermitted: false,
    runtimeCatalogDependency: false,
    canonicalEnglishControls: true,
    reviewClaim: "AI_GENERATED_UNVERIFIED",
    sourceFreezeBinding: structuredClone(bindings.sourceFreezeBinding),
    sourcePartitionBinding: structuredClone(bindings.sourcePartitionBinding),
    historicalGapReportBinding: structuredClone(bindings.historicalGapReportBinding),
    currentGapReportBinding: structuredClone(bindings.currentGapReportBinding),
    currentHelperBinding: structuredClone(bindings.currentHelperBinding),
    reusableProposalBinding: structuredClone(bindings.reusableProposalBinding),
    editorialBatchBindings: batchBindings,
    assembly: {
      sourceCount: inventory.sourceCount,
      reusableSourceCount: reusableSources.length,
      gapSourceCount: gapSources.length,
      editorialBatchCount: batchBindings.length,
      overlapSourceCount: overlapSources.length,
      uncoveredSourceCount: uncoveredSources.length,
      extraSourceCount: extraSources.length,
      sourceKeysSha256: inventory.sourceKeysSha256,
      reusableSourceKeysSha256: bindings.sourcePartitionBinding.reusableSourceKeysSha256,
      gapSourceKeysSha256: bindings.sourcePartitionBinding.gapSourceKeysSha256,
      messageEntriesSha256,
      counters,
      counterDefinitions: {
        protectedTokenRepairs: "ASSEMBLY_STAGE_PROTECTED_TOKEN_REPAIRS",
        editorialMachineDraftOverrides: "GAP_PROPOSALS_PLUS_REUSABLE_EDITORIAL_REPAIRS",
        sourceEquivalentLabelEditorialFallbacks: "ASSEMBLY_STAGE_SOURCE_EQUIVALENT_FALLBACKS",
      },
    },
    artifactBinding: {
      schema: artifact.schema,
      fileName: "pcm-machine-draft-5baff9-v2.json",
      fileSha256: artifactFileSha256,
      canonicalSha256: artifactCanonicalSha256,
      messageEntriesSha256,
    },
  };
  const proofSerialized = serialize(proof);
  return {
    artifact,
    artifactSerialized,
    proof,
    proofSerialized,
    artifactFileSha256,
    artifactCanonicalSha256,
    proofFileSha256: sha256(proofSerialized),
    proofCanonicalSha256: canonicalJsonSha256(proof),
    messageEntriesSha256,
    sourceCount: inventory.sourceCount,
    reusableSourceCount: reusableSources.length,
    gapSourceCount: gapSources.length,
    editorialBatchCount: batchBindings.length,
    counters,
  };
}

export function validateCommittedPcmMachineDraftAssembly({
  assembly,
  artifactBytes,
  proofBytes,
}) {
  if (!(artifactBytes instanceof Uint8Array) || !(proofBytes instanceof Uint8Array)) {
    throw new Error("Committed PCM machine-draft artifact and proof bytes are required");
  }
  if (artifactBytes.toString("utf8") !== assembly.artifactSerialized) {
    throw new Error("Committed PCM machine-draft artifact is not the deterministic assembly output");
  }
  if (proofBytes.toString("utf8") !== assembly.proofSerialized) {
    throw new Error("Committed PCM machine-draft proof is not the deterministic assembly output");
  }
  return {
    ...assembly,
    artifactFileSha256: sha256(artifactBytes),
    proofFileSha256: sha256(proofBytes),
  };
}

export function serializePcmMachineDraftAssemblyValidation(result) {
  return serialize({
    schema: "iat-pcm-machine-draft-assembly-validation/v1",
    status: "PASS",
    activationReady: false,
    directApplicationPermitted: false,
    sourceCount: result.sourceCount,
    reusableSourceCount: result.reusableSourceCount,
    gapSourceCount: result.gapSourceCount,
    editorialBatchCount: result.editorialBatchCount,
    protectedTokenRepairs: result.counters.protectedTokenRepairs,
    editorialMachineDraftOverrides: result.counters.editorialMachineDraftOverrides,
    sourceEquivalentLabelEditorialFallbacks: result.counters.sourceEquivalentLabelEditorialFallbacks,
    artifactFileSha256: result.artifactFileSha256,
    artifactCanonicalSha256: result.artifactCanonicalSha256,
    proofFileSha256: result.proofFileSha256,
    proofCanonicalSha256: result.proofCanonicalSha256,
  });
}
