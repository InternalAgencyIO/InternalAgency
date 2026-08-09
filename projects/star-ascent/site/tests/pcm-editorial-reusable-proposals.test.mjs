import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validatePcmSourceFreezeEvidence } from "../scripts/lib/pcm-editorial-gap-report.mjs";
import {
  PCM_REUSABLE_PROPOSAL_BINDINGS,
  serializePcmEditorialReusableProposalValidation,
  validatePcmEditorialReusableProposals,
} from "../scripts/lib/pcm-editorial-reusable-proposals.mjs";
import { validatePcmEditorialSourcePartition } from "../scripts/lib/pcm-editorial-source-partition.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const readJson = (target) => readFile(target, "utf8").then(JSON.parse);

async function fixture() {
  const [
    artifact,
    sourceFreezeEvidenceBytes,
    sourcePartitionBytes,
    protectedBytes,
    pcmQualityBytes,
    salvageBytes,
  ] = await Promise.all([
    readJson(new URL("../scripts/data/pcm-editorial-reusable-proposals-5baff9.json", import.meta.url)),
    readFile(new URL("../scripts/data/pcm-source-freeze-evidence-5baff9.json", import.meta.url)),
    readFile(new URL("../scripts/data/pcm-editorial-source-partition-5baff9.json", import.meta.url)),
    readFile(new URL("../scripts/lib/i18n-protected-integrity.mjs", import.meta.url)),
    readFile(new URL("../scripts/lib/pcm-machine-draft-quality.mjs", import.meta.url)),
    readFile(new URL("../scripts/lib/pcm-editorial-gap-report.mjs", import.meta.url)),
  ]);
  const currentGateBinding = {
    protectedIntegrityModuleSha256: sha256(protectedBytes),
    pcmQualityModuleSha256: sha256(pcmQualityBytes),
    salvageModuleSha256: sha256(salvageBytes),
  };
  const frozen = validatePcmSourceFreezeEvidence({
    evidence: JSON.parse(sourceFreezeEvidenceBytes.toString("utf8")),
    evidenceBytes: sourceFreezeEvidenceBytes,
  });
  const sourcePartition = validatePcmEditorialSourcePartition({
    manifest: JSON.parse(sourcePartitionBytes.toString("utf8")),
    inventory: frozen.inventory,
    currentGateBinding,
  });
  return {
    artifact,
    currentGateBinding,
    sourcePartition,
    sourcePartitionFileSha256: sha256(sourcePartitionBytes),
  };
}

test("the committed reusable artifact covers the exact 179-source set and remains non-activating", async () => {
  const inputs = await fixture();
  const result = validatePcmEditorialReusableProposals(inputs);
  assert.deepEqual(
    {
      attempted: result.attempted,
      accepted: result.accepted,
      rejected: result.rejected,
      editorialRepairCount: result.editorialRepairCount,
    },
    { attempted: 179, accepted: 179, rejected: 0, editorialRepairCount: 31 },
  );
  assert.equal(result.sourceKeysSha256, "d519ff5844ec9d8be78f05692508a80812146d511c5a67ea90d49f324ec74f82");
  assert.equal(result.artifactCanonicalSha256, "05bf48f15aa6d73ae3a619f1f86d4e32cd111114dd4c009567edfdc8f8b0b767");
  assert.deepEqual(Object.keys(inputs.artifact.proposals), inputs.sourcePartition.reusableSources);
  assert.deepEqual(Object.keys(inputs.artifact.baselineCandidates), inputs.sourcePartition.reusableSources);
  assert.equal(
    sha256(JSON.stringify(Object.keys(inputs.artifact.editorialRepairs))),
    "fcda512f35581218d0a0e9d1d1911ce4fc4622ad75db927742dab13ea82b895a",
  );
  assert.equal(
    sha256(JSON.stringify(Object.entries(inputs.artifact.baselineCandidates))),
    "a706704395d1590dfa32a84f41cb92ab4157fbc397c230bfa338d0eb2337a189",
  );
  assert.equal(
    sha256(JSON.stringify(Object.entries(inputs.artifact.proposals))),
    "445964687d71d4727ad4fb314b70800ace4b2ab4096739f14118825ad0f994ab",
  );
  const gapSet = new Set(inputs.sourcePartition.gapSources);
  assert.ok(Object.keys(inputs.artifact.proposals).every((source) => !gapSet.has(source)));
  assert.equal(inputs.artifact.activationReady, false);
  assert.equal(inputs.artifact.policy.directApplicationPermitted, false);
  assert.equal(inputs.artifact.policy.runtimeCatalogDependency, false);
  assert.equal(inputs.artifact.policy.reviewClaim, "AI_GENERATED_UNVERIFIED");
  assert.equal(
    inputs.artifact.sourcePartitionBinding.historicalGapReportCanonicalSha256,
    "87d2f0b91a86d1c44d696ff92ecb1ceea10eff40910664ea5e8c1742e1a9da5f",
  );
  assert.equal(
    inputs.artifact.currentGapReportBinding.canonicalSha256,
    "3a22471238e2096b39d26aeac7fa76720110abe74cc680f1971d5c29070b05bf",
  );
  assert.notEqual(
    inputs.artifact.sourcePartitionBinding.historicalGapReportCanonicalSha256,
    inputs.artifact.currentGapReportBinding.canonicalSha256,
  );
});

test("reusable validation and serialization are deterministic", async () => {
  const inputs = await fixture();
  const first = validatePcmEditorialReusableProposals(inputs);
  const second = validatePcmEditorialReusableProposals(structuredClone(inputs));
  assert.equal(first.artifactCanonicalSha256, second.artifactCanonicalSha256);
  assert.equal(
    serializePcmEditorialReusableProposalValidation(first),
    serializePcmEditorialReusableProposalValidation(second),
  );
  assert.match(serializePcmEditorialReusableProposalValidation(first), /"activationReady": false/u);
});

test("reusable validation rejects provenance, membership, translation, repair, and count tampering", async () => {
  const inputs = await fixture();
  const probes = [];

  const extraField = structuredClone(inputs);
  extraField.artifact.unreviewed = true;
  probes.push([extraField, /missing or unexpected fields/u]);

  const activating = structuredClone(inputs);
  activating.artifact.activationReady = true;
  probes.push([activating, /non-activating/u]);

  const directApplication = structuredClone(inputs);
  directApplication.artifact.policy.directApplicationPermitted = true;
  probes.push([directApplication, /policy is invalid/u]);

  const staleArtifactDrift = structuredClone(inputs);
  staleArtifactDrift.artifact.staleProposalArtifactBinding.fileSha256 = "0".repeat(64);
  probes.push([staleArtifactDrift, /immutable provenance/u]);

  const reportConflation = structuredClone(inputs);
  reportConflation.artifact.currentGapReportBinding.canonicalSha256 = (
    reportConflation.artifact.sourcePartitionBinding.historicalGapReportCanonicalSha256
  );
  probes.push([reportConflation, /immutable provenance/u]);

  const gateDrift = structuredClone(inputs);
  gateDrift.currentGateBinding.pcmQualityModuleSha256 = "1".repeat(64);
  probes.push([gateDrift, /immutable provenance/u]);

  const partitionBytesDrift = structuredClone(inputs);
  partitionBytesDrift.sourcePartitionFileSha256 = "3".repeat(64);
  probes.push([partitionBytesDrift, /partition bytes do not match immutable provenance/u]);

  const baselineDrift = structuredClone(inputs);
  const firstSource = Object.keys(baselineDrift.artifact.baselineCandidates)[0];
  baselineDrift.artifact.baselineCandidates[firstSource] = `${baselineDrift.artifact.baselineCandidates[firstSource]} EXTRA`;
  probes.push([baselineDrift, /regenerated gap report/u]);

  const outOfOrder = structuredClone(inputs);
  const proposalEntries = Object.entries(outOfOrder.artifact.proposals);
  [proposalEntries[0], proposalEntries[1]] = [proposalEntries[1], proposalEntries[0]];
  outOfOrder.artifact.proposals = Object.fromEntries(proposalEntries);
  probes.push([outOfOrder, /exact ordered committed reusable set/u]);

  const rejectedTranslation = structuredClone(inputs);
  rejectedTranslation.artifact.proposals[firstSource] = firstSource;
  probes.push([rejectedTranslation, /rejected 1 current-gate candidates/u]);

  const missingRepair = structuredClone(inputs);
  delete missingRepair.artifact.editorialRepairs[Object.keys(missingRepair.artifact.editorialRepairs)[0]];
  probes.push([missingRepair, /repair ledger/u]);

  const repairHashDrift = structuredClone(inputs);
  repairHashDrift.artifact.editorialRepairs[Object.keys(repairHashDrift.artifact.editorialRepairs)[0]]
    .repairedTranslationSha256 = "2".repeat(64);
  probes.push([repairHashDrift, /repair binding is invalid/u]);

  const countDrift = structuredClone(inputs);
  countDrift.artifact.counts.editorialRepairCount -= 1;
  probes.push([countDrift, /does not match/u]);

  for (const [probe, expected] of probes) {
    assert.throws(() => validatePcmEditorialReusableProposals(probe), expected);
  }
});

test("the reusable proof closure has no runtime catalogs, external I/O, or activation path", async () => {
  const [library, cli] = await Promise.all([
    readFile(new URL("../scripts/lib/pcm-editorial-reusable-proposals.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/validate-pcm-editorial-reusable-proposals.mjs", import.meta.url), "utf8"),
  ]);
  const source = `${library}\n${cli}`;
  assert.doesNotMatch(
    source,
    /messages\.json|pending-visible-source|critical-ui-overrides|activate-machine-draft-locales|apply-i18n-editorial-overrides|compile-i18n-assets/u,
  );
  assert.doesNotMatch(
    source,
    /\b(?:fetch|WebSocket|EventSource)\b|node:(?:http|https|net|tls|dgram|child_process)|\b(?:writeFile|appendFile|unlink|rename|mkdir|rm|createWriteStream)\b/u,
  );
  assert.deepEqual(
    PCM_REUSABLE_PROPOSAL_BINDINGS.gateBinding,
    (await fixture()).currentGateBinding,
  );
});
