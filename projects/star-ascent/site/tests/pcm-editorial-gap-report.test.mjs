import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PCM_SOURCE_FREEZE,
  buildPcmEditorialGapReport,
  pcmEditorialCandidateFindings,
  serializePcmEditorialGapReport,
  validatePcmSourceFreezeEvidence,
  validateStaleEditorialProposalArtifact,
} from "../scripts/lib/pcm-editorial-gap-report.mjs";

const digest = "a".repeat(64);
const gitRevision = "99c6ff5290bad2b2cd4ada9fe52151e67adf6058";
const gateBinding = {
  protectedIntegrityModuleSha256: "c".repeat(64),
  pcmQualityModuleSha256: "d".repeat(64),
  salvageModuleSha256: "e".repeat(64),
};

function fixtureArtifact({ proposals, acceptedCurrent = {}, legitimateIdentical = {} }) {
  const proposalReasons = Object.fromEntries(Object.keys(proposals).map((source) => [source, ["fixture-rewrite"]]));
  const legitimateRecords = Object.values(legitimateIdentical);
  return {
    schema: "iat-pcm-editorial-proposals/v1",
    locale: "pcm",
    basedOn: {
      schema: "iat-pcm-machine-draft/v1",
      sha256: digest,
      sourceKeysSha256: digest,
      sourceCount: Object.keys(proposals).length + Object.keys(acceptedCurrent).length,
      model: "NITHUB-AI/marian-mt-bbc-en-pcm",
      modelRevision: gitRevision,
    },
    method: "Machine editorial fixture",
    qualityClaim: "UNVERIFIED_MACHINE_DRAFT_BEST_EFFORT",
    integrityPolicy: {
      protectedAndExactTokens: "required",
      unicodeSymbols: "required",
      sourceEquivalentIdentities: "no implicit exceptions",
    },
    counts: {
      sourceMessagesReviewed: Object.keys(proposals).length + Object.keys(acceptedCurrent).length,
      exactDiWrappers: 0,
      highEnglishRetentionReviewed: 0,
      suspiciousSemanticOutputsReviewed: 0,
      protectedOrIdentifierIdentitiesAccepted: legitimateRecords.filter((record) => !record.requiresScopedSourceEquivalentException).length,
      legitimateLoanwordIdentitiesProposed: legitimateRecords.filter((record) => record.requiresScopedSourceEquivalentException).length,
      translatedOrRewrittenProposals: Object.entries(proposals).filter(([source, translation]) => source !== translation).length,
      acceptedCurrentWithoutChange: Object.keys(acceptedCurrent).length,
      proposals: Object.keys(proposals).length,
      legitimateIdenticalClassifications: Object.keys(legitimateIdentical).length,
    },
    proposals,
    proposalReasons,
    legitimateIdentical,
    acceptedCurrent,
    status: "STALE_SOURCE_BOUND_NOT_FOR_DIRECT_APPLICATION",
    supersessionNote: "Reuse only after current source and gate validation.",
    reviewClaim: "AI_GENERATED_UNVERIFIED_CANONICAL_ENGLISH_CONTROLS",
  };
}

test("immutable PCM source evidence remains bound to the frozen 1,491-source set", async () => {
  const evidenceBytes = await readFile(
    new URL("../scripts/data/pcm-source-freeze-evidence-5baff9.json", import.meta.url),
  );
  const { inventory, policy } = validatePcmSourceFreezeEvidence({
    evidence: JSON.parse(evidenceBytes.toString("utf8")),
    evidenceBytes,
  });
  assert.equal(inventory.sourceCount, PCM_SOURCE_FREEZE.sourceCount);
  assert.equal(inventory.sourceKeysSha256, PCM_SOURCE_FREEZE.sourceKeysSha256);
  assert.equal(policy.runtimeCatalogDependency, false);
  assert.equal(policy.translationClaim, "NONE");
});

test("salvage imports only exact-key proposals that pass every current fail-closed gate", () => {
  const sources = [
    "Keep moving.",
    "Open this page",
    "This result is public, but the program is not active.",
  ].sort((left, right) => left.localeCompare(right, "en"));
  const proposals = {
    "Old retired source": "Old retired source don retire.",
    "Open this page": "Open this page",
    "This result is public, but the program is not active.": "Dis result dey public, but di program no dey active.",
  };
  const artifact = fixtureArtifact({
    proposals,
    acceptedCurrent: {
      "Historical accepted source": { current: "Historical current", classification: "fixture" },
    },
  });
  const expectedSourceFreeze = {
    sourceCount: sources.length,
    sourceKeysSha256: createHash("sha256").update(JSON.stringify(sources)).digest("hex"),
  };
  const report = buildPcmEditorialGapReport({
    inventory: { sources, ...expectedSourceFreeze },
    proposalArtifact: artifact,
    gateBinding,
    expectedSourceFreeze,
  });
  assert.deepEqual(Object.keys(report.reusableProposals), ["This result is public, but the program is not active."]);
  assert.equal(report.counts.exactKeyCandidateCount, 2);
  assert.equal(report.counts.reusableProposalCount, 1);
  assert.equal(report.counts.rejectedExactKeyProposalCount, 1);
  assert.equal(report.counts.missingExactKeyProposalCount, 1);
  assert.equal(report.counts.ignoredStaleProposalKeyCount, 1);
  assert.equal(report.counts.gapCount, 2);
  assert.deepEqual(report.ignoredStaleProposalKeys, ["Old retired source"]);
  assert.ok(report.gaps.find(({ source }) => source === "Open this page").findings.some(({ rule }) => rule === "source-equivalent-machine-draft"));
  assert.equal(report.gaps.find(({ source }) => source === "Keep moving.").status, "NO_EXACT_SOURCE_KEY_PROPOSAL");
  assert.equal(report.activationReady, false);
});

test("candidate QA fails closed on retained English, protected-token drift, and known corruption", () => {
  const retention = pcmEditorialCandidateFindings(
    "A complete operational rehearsal is evidence but does not approve public launch.",
    "A complete operational rehearsal na evidence but does not approve public launch.",
  );
  assert.ok(retention.some(({ rule }) => rule === "english-source-retention"));
  assert.ok(pcmEditorialCandidateFindings("Use IAT on Solana.", "Use token on Solana.").some(({ rule }) => rule === "protected-term-multiset"));
  assert.ok(pcmEditorialCandidateFindings("Use simulated credits.", "Use bungalow credits.").some(({ rule }) => rule === "introduced-bungalow"));
});

test("artifact contract and report serialization are deterministic and reject tampering", () => {
  const proposals = { "Open this page": "Open dis page." };
  const artifact = fixtureArtifact({ proposals });
  validateStaleEditorialProposalArtifact(artifact);
  const sources = ["Open this page"];
  const expectedSourceFreeze = {
    sourceCount: 1,
    sourceKeysSha256: createHash("sha256").update(JSON.stringify(sources)).digest("hex"),
  };
  const build = () => buildPcmEditorialGapReport({
    inventory: { sources, ...expectedSourceFreeze },
    proposalArtifact: structuredClone(artifact),
    gateBinding: structuredClone(gateBinding),
    expectedSourceFreeze,
  });
  assert.equal(serializePcmEditorialGapReport(build()), serializePcmEditorialGapReport(build()));
  const tampered = structuredClone(artifact);
  tampered.proposalReasons = {};
  assert.throws(() => validateStaleEditorialProposalArtifact(tampered), /source-keyed reason list/u);
  assert.throws(
    () => buildPcmEditorialGapReport({
      inventory: { sources, sourceCount: 1, sourceKeysSha256: digest },
      proposalArtifact: artifact,
      gateBinding,
      expectedSourceFreeze,
    }),
    /source freeze mismatch/u,
  );
});
