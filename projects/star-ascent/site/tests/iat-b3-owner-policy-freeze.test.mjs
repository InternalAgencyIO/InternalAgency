import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  OWNER_POLICY_FREEZE_MAINNET_STATUS,
  OWNER_POLICY_FREEZE_SCHEMA,
  OWNER_POLICY_NODE_IDS,
  isCanonicalOwnerPolicyPublicKey,
  loadB3OwnerPolicyFreezeManifest,
  parseB3OwnerPolicyFreezeJson,
  validateB3OwnerPolicyFreezeManifest,
} from "../scripts/validate-iat-b3-owner-policy-freeze.mjs";
import {
  IAT_B3_MAINNET_GENESIS_HASH,
  TOKEN_2022_PROGRAM_ID,
  observeIatB3LiveEstateMainnet,
} from "../scripts/observe-iat-b3-live-estate-mainnet.mjs";
import {
  NATIVE_LOADER_ID,
  TOKEN_2022_LAST_UPGRADE,
  TOKEN_2022_OFFICIAL_RELEASE,
  UPGRADEABLE_LOADER_ID,
  ZK_ELGAMAL_NATIVE_PROGRAM_NAME,
  ZK_ELGAMAL_PROOF_PROGRAM_ID,
  observeIatB3StandardProgramsMainnet,
} from "../scripts/observe-iat-b3-standard-programs-mainnet.mjs";

const SITE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const MANIFEST_PATH = fileURLToPath(new URL("../docs/b3/iat-b3-owner-policy-freeze.v1.json", import.meta.url));
const SCHEMA_PATH = fileURLToPath(new URL("../docs/b3/iat-b3-owner-policy-freeze.v1.schema.json", import.meta.url));
const CLI_PATH = fileURLToPath(new URL("../scripts/validate-iat-b3-owner-policy-freeze.mjs", import.meta.url));
const STANDARD_PROGRAM_SOURCE_EQUIVALENCE_EVIDENCE_PATH = fileURLToPath(
  new URL(
    "../docs/b3/evidence/iat-b3-standard-program-mainnet-source-equivalence-20260811T040023Z.json",
    import.meta.url,
  ),
);

function canonicalManifest() {
  return loadB3OwnerPolicyFreezeManifest(MANIFEST_PATH);
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function encodeBase58(bytes) {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let magnitude = 0n;
  for (const byte of bytes) magnitude = (magnitude << 8n) + BigInt(byte);
  let encoded = "";
  while (magnitude > 0n) {
    encoded = alphabet[Number(magnitude % 58n)] + encoded;
    magnitude /= 58n;
  }
  let leadingZeroes = 0;
  while (leadingZeroes < bytes.length && bytes[leadingZeroes] === 0) leadingZeroes += 1;
  return "1".repeat(leadingZeroes) + encoded;
}

function decodeBase58(value) {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let magnitude = 0n;
  for (const character of value) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) throw new Error("invalid Base58 fixture");
    magnitude = (magnitude * 58n) + BigInt(digit);
  }
  const bytes = [];
  while (magnitude > 0n) {
    bytes.unshift(Number(magnitude & 0xffn));
    magnitude >>= 8n;
  }
  let leadingZeroes = 0;
  while (leadingZeroes < value.length && value[leadingZeroes] === "1") leadingZeroes += 1;
  return Uint8Array.from([...new Array(leadingZeroes).fill(0), ...bytes]);
}

const TEST_TOKEN_RELEASE_ARTIFACT = Buffer.alloc(256, 0xa5);
TEST_TOKEN_RELEASE_ARTIFACT.set(Buffer.from(TOKEN_2022_OFFICIAL_RELEASE.embeddedTag, "ascii"), 8);
TEST_TOKEN_RELEASE_ARTIFACT.set(Buffer.from(TOKEN_2022_OFFICIAL_RELEASE.embeddedSourceUrl, "ascii"), 64);
const TEST_TOKEN_RELEASE_BINDING = Object.freeze({
  ...TOKEN_2022_OFFICIAL_RELEASE,
  buildArtifactBytes: TEST_TOKEN_RELEASE_ARTIFACT.length,
  buildArtifactSha256: createHash("sha256").update(TEST_TOKEN_RELEASE_ARTIFACT).digest("hex"),
  deployedCapacityBytes: 320,
  loaderPaddingBytes: 64,
});
const TEST_TOKEN_DEPLOYED_BYTES = Buffer.concat([TEST_TOKEN_RELEASE_ARTIFACT, Buffer.alloc(64)]);

function fixturePublicKey(seed) {
  const bytes = Uint8Array.from({ length: 32 }, (_, index) => (seed + (index * 17)) % 256);
  return encodeBase58(bytes);
}

function fillAllOwnerChoices(manifest) {
  const nodes = manifest.nodes;
  Object.assign(nodes.LIVE_ESTATE_CANONICAL_MINT_DECISION.ownerChoices, {
    liveEstateAssertion: "NO_LIVE_ESTATE_MINT",
    candidateMint: null,
    candidateTokenProgramId: null,
    canonicalMintDecision: "NEW_TOKEN_2022_FROM_INCEPTION",
    duplicateSupplyRetirementPolicy: "NOT_APPLICABLE",
  });
  Object.assign(nodes.CORE_CUSTODY_POLICY_ADAPTER.ownerChoices, {
    acceptFrozenScope: true,
    releasePolicy: {
      authorizationModel: "PROGRAM_ENFORCED_V2_SCHEDULE_TO_FIXED_BENEFICIARY",
      fixedBeneficiary: fixturePublicKey(1),
      currentOpenDailyLawRequired: true,
      sameDayReconciliationRequired: true,
      ordinaryWalletEndsAttribution: true,
      discretionaryBypassPermitted: false,
    },
  });
  Object.assign(nodes.FACTION_ECONOMICS_FUNDING.ownerChoices, {
    scoringPolicySha256: "a".repeat(64),
    sybilPolicy: "PRESERVED_WALLET_AND_IMMUTABLE_X_BINDING",
    weeklyEpochAnchorUnixSeconds: 0,
    tieRule: "ONE_ROLL_NO_REROLL_EXACT_UNIFORM",
    communityCarveOutBaseUnits: "1000000000000000",
    weeklyEmissionBaseUnits: "1000000000000",
    fundingHorizonWeeks: 52,
    unusedBalanceDestination: fixturePublicKey(2),
    followerSnapshotPolicySha256: "b".repeat(64),
    prizePolicySha256: "c".repeat(64),
    nftPrizePolicy: "NFT_PRIZES_DISABLED",
    claimExpirySeconds: 604800,
  });
  Object.assign(nodes.CONFIG_GENESIS_PHASE_CODEC.ownerChoices, {
    acceptExactBootstrapPolicy: true,
    canonicalAccountSetSha256: "d".repeat(64),
    bootstrapReplayPolicy: "REJECT_REENTRY_AND_ROLLBACK",
    preActivationCoreCapPolicy: "VACUOUS_ONLY_UNTIL_ATOMIC_ACTIVATION",
  });
  Object.assign(nodes.GENESIS_ALLOCATIONS_CONSERVATION.ownerChoices, {
    communityOwner: fixturePublicKey(3),
    treasuryBeneficiary: fixturePublicKey(4),
    ecosystemBeneficiary: fixturePublicKey(5),
    coreBeneficiary: fixturePublicKey(1),
    liquidityBeneficiary: fixturePublicKey(6),
    factionCarveOutBaseUnits: "1000000000000000",
    coreDestinationPolicy: "CANONICAL_CORE_CUSTODY",
    programVaultDestinationPolicy: "DERIVE_FROM_FROZEN_ECONOMY_ID_AND_MINT",
  });
  Object.assign(nodes.PRODUCTION_IDENTITY_INPUT_FREEZE.ownerChoices, {
    lawProgramId: fixturePublicKey(7),
    economyProgramId: fixturePublicKey(8),
    canonicalMint: fixturePublicKey(9),
    clusterIdentityPolicy: "DISTINCT_PROGRAM_AND_MINT_IDS_PER_CLUSTER",
    entropyLagSlots: 150,
    entropyRiskAcceptance: "ACCEPT_LAGGED_SLOT_HASH_WITH_FINALIZER_TIMING_INFLUENCE_AND_LIMITED_PROBABILITY_CLAIMS",
    metadataPolicy: "NO_MINT_METADATA_EXTENSION_IMMUTABLE_EXTERNAL_RECORD",
    acceptCanonicalSeedTable: true,
  });
  Object.assign(nodes.B3_COST_CEREMONY_FUNDING.ownerChoices, {
    payerPublicKey: fixturePublicKey(10),
    fundingSourcePolicySha256: "e".repeat(64),
    ceremonyFloorLamports: "3000000000",
    overCeilingDisposition: "REQUIRE_NEW_EXACT_OWNER_CEILING_NEVER_CUT_FEATURES",
  });
  return manifest;
}

function assertTerminalHold(result) {
  for (const key of [
    "ownerAcceptanceVerified",
    "ownerIdentityAuthenticated",
    "externalEvidenceVerified",
    "engineeringEvidenceVerified",
    "chainTruthVerified",
    "binaryEvidenceVerified",
    "genesisConservationVerified",
    "ceremonyFundingVerified",
    "devnetAuthorized",
    "devnetRehearsalComplete",
    "activationReady",
    "releaseAuthorized",
    "mainnetExecutionAuthorized",
  ]) assert.equal(result[key], false, key);
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.mainnetStatus, "HOLD");
}

test("canonical owner-policy intake is valid, incomplete, nonactivating, and ordered", () => {
  const manifest = canonicalManifest();
  const result = validateB3OwnerPolicyFreezeManifest(manifest);
  assert.equal(OWNER_POLICY_FREEZE_SCHEMA, "iat-b3-owner-policy-freeze/v2");
  assert.equal(OWNER_POLICY_FREEZE_MAINNET_STATUS, "HOLD");
  assert.equal(result.valid, true, result.violations.join("\n"));
  assert.equal(result.profile, "PRODUCTION");
  assert.equal(result.ownerChoicesStructurallyComplete, false);
  assert.equal(result.safeDecisionOrderSatisfied, false);
  assert.deepEqual(Object.keys(result.nodeChoiceState), OWNER_POLICY_NODE_IDS);
  assert.deepEqual(result.nodeChoiceState.LIVE_ESTATE_CANONICAL_MINT_DECISION, {
    structurallyComplete: true,
    eligibleInSafeOrder: true,
  });
  assert.equal(result.blockers.length, 6);
  assert.deepEqual(
    manifest.nodes.CONFIG_GENESIS_PHASE_CODEC.evidenceRequirements.external,
    ["SOURCE_BOUND_AUTOMATED_BOOTSTRAP_AND_ACTIVATION_POLICY_DIRECT_EVIDENCE_PACKET"],
  );
  assert.deepEqual(
    manifest.nodes.LIVE_ESTATE_CANONICAL_MINT_DECISION.evidenceRequirements.external,
    [
      "SOURCE_BOUND_AUTOMATED_LIVE_ESTATE_INVENTORY",
      "CANDIDATE_MINT_CHAIN_STATE_AND_AUTHORITY_SNAPSHOT",
      "CANONICAL_SUPPLY_RECONCILIATION",
    ],
  );
  assert.deepEqual(
    manifest.nodes.CORE_CUSTODY_POLICY_ADAPTER.evidenceRequirements.external,
    [
      "SOURCE_BOUND_AUTOMATED_CUSTODY_AND_RELEASE_POLICY_DIRECT_EVIDENCE",
      "CORE_BENEFICIARY_PUBLIC_KEY_CONTROL_ATTESTATION",
    ],
  );
  assert.deepEqual(
    manifest.nodes.FACTION_ECONOMICS_FUNDING.evidenceRequirements.external,
    [
      "AUTHENTICATED_SCORING_AND_FOLLOWER_DATA_PROVIDERS",
      "SOURCE_BOUND_AUTOMATED_SYBIL_AND_PRIZE_POLICY_DIRECT_EVIDENCE",
      "ACCOUNTABLE_COMMUNITY_CARVE_OUT_FUNDING_SOURCE",
    ],
  );
  assert.ok(
    manifest.nodes.GENESIS_ALLOCATIONS_CONSERVATION.evidenceRequirements.external.includes(
      "SOURCE_BOUND_AUTOMATED_GENESIS_MANIFEST_CONSERVATION_EVIDENCE",
    ),
  );
  assert.ok(
    manifest.nodes.PRODUCTION_IDENTITY_INPUT_FREEZE.evidenceRequirements.external.includes(
      "TWO_SOURCE_BOUND_AUTOMATED_MAINNET_GENESIS_HASH_ENDPOINT_RECEIPTS",
    ),
  );
  assert.ok(
    manifest.nodes.PRODUCTION_IDENTITY_INPUT_FREEZE.evidenceRequirements.external.includes(
      "SOURCE_BOUND_AUTOMATED_DAILY_LAW_ENTROPY_RISK_MEASUREMENT",
    ),
  );
  assert.ok(
    manifest.nodes.PRODUCTION_IDENTITY_INPUT_FREEZE.evidenceRequirements.engineering.includes(
      "SOURCE_BOUND_AUTOMATED_BINARY_HASH_TO_PROGRAM_ID_BINDINGS",
    ),
  );
  assert.ok(
    manifest.nodes.B3_COST_CEREMONY_FUNDING.evidenceRequirements.external.includes(
      "TWO_SOURCE_BOUND_AUTOMATED_PAYER_BALANCE_ENDPOINT_RECEIPTS",
    ),
  );
  assert.deepEqual(
    {
      nonSignatureEvidenceRequiresAutomatedSourceBoundDirectEvidence:
        manifest.invariants.nonSignatureEvidenceRequiresAutomatedSourceBoundDirectEvidence,
      humanReviewPrerequisitePermitted: manifest.invariants.humanReviewPrerequisitePermitted,
      trezorModelTPhysicalConfirmationIsSoleHumanGateForActualSignatures:
        manifest.invariants.trezorModelTPhysicalConfirmationIsSoleHumanGateForActualSignatures,
      unobservedClaimsRemainHold: manifest.invariants.unobservedClaimsRemainHold,
    },
    {
      nonSignatureEvidenceRequiresAutomatedSourceBoundDirectEvidence: true,
      humanReviewPrerequisitePermitted: false,
      trezorModelTPhysicalConfirmationIsSoleHumanGateForActualSignatures: true,
      unobservedClaimsRemainHold: true,
    },
  );
  assert.deepEqual(manifest.evidenceBoundary, {
    acceptsExternalEvidence: false,
    acceptsEngineeringEvidence: false,
    selfAttestationIsExternalProof: false,
    automatedDirectEvidenceMayCloseNonSignaturePredicates: true,
    humanReviewerRequired: false,
    noSelfAttestation: true,
    modelTRequiredOnlyForActualCryptographicSignatures: true,
    unobservedEvidenceDisposition: "HOLD",
    evidenceVerificationOutOfScope: true,
  });
  assert.equal(JSON.stringify(manifest).includes("INDEPENDENT_BOOTSTRAP_AND_ACTIVATION_POLICY_ACCEPTANCE"), false);
  assert.equal(JSON.stringify(manifest).includes("INDEPENDENT_"), false);
  assert.equal(JSON.stringify(manifest).includes("REVIEWED_BINARY_HASH_TO_PROGRAM_ID_BINDINGS"), false);
  assert.equal(manifest.nodes.CONFIG_GENESIS_PHASE_CODEC.ownerChoices.acceptExactBootstrapPolicy, null);
  assert.equal(manifest.nodes.PRODUCTION_IDENTITY_INPUT_FREEZE.ownerChoices.entropyRiskAcceptance, null);
  assertTerminalHold(result);
});

test("legacy human-review authorization predicates and policy drift fail closed", () => {
  const legacyPredicate = canonicalManifest();
  legacyPredicate.nodes.LIVE_ESTATE_CANONICAL_MINT_DECISION.evidenceRequirements.external[0] =
    "INDEPENDENT_LIVE_ESTATE_INVENTORY";
  let result = validateB3OwnerPolicyFreezeManifest(legacyPredicate);
  assert.equal(result.valid, false);
  assert.match(result.violations.join("\n"), /evidenceRequirements/iu);
  assertTerminalHold(result);

  const humanGate = canonicalManifest();
  humanGate.evidenceBoundary.humanReviewerRequired = true;
  result = validateB3OwnerPolicyFreezeManifest(humanGate);
  assert.equal(result.valid, false);
  assert.match(result.violations.join("\n"), /evidenceBoundary/iu);
  assertTerminalHold(result);

  const expandedModelTGate = canonicalManifest();
  expandedModelTGate.evidenceBoundary.modelTRequiredOnlyForActualCryptographicSignatures = false;
  result = validateB3OwnerPolicyFreezeManifest(expandedModelTGate);
  assert.equal(result.valid, false);
  assert.match(result.violations.join("\n"), /evidenceBoundary/iu);
  assertTerminalHold(result);
});

test("plain data remains valid when callers make its data descriptors immutable", () => {
  const result = validateB3OwnerPolicyFreezeManifest(deepFreeze(canonicalManifest()));
  assert.equal(result.valid, true, result.violations.join("\n"));
  assertTerminalHold(result);
});

test("all seven owner choices can be structurally complete without proving or authorizing anything", () => {
  const result = validateB3OwnerPolicyFreezeManifest(fillAllOwnerChoices(canonicalManifest()));
  assert.equal(result.valid, true, result.violations.join("\n"));
  assert.equal(result.ownerChoicesStructurallyComplete, true);
  assert.equal(result.safeDecisionOrderSatisfied, true);
  assert.equal(result.blockers.length, 0);
  for (const state of Object.values(result.nodeChoiceState)) {
    assert.deepEqual(state, { structurallyComplete: true, eligibleInSafeOrder: true });
  }
  assertTerminalHold(result);
});

test("an entropy lag cannot complete identity choices without explicit timing-risk acceptance", () => {
  const manifest = fillAllOwnerChoices(canonicalManifest());
  manifest.nodes.PRODUCTION_IDENTITY_INPUT_FREEZE.ownerChoices.entropyRiskAcceptance = null;
  const result = validateB3OwnerPolicyFreezeManifest(manifest);
  assert.equal(result.valid, true, result.violations.join("\n"));
  assert.equal(result.nodeChoiceState.PRODUCTION_IDENTITY_INPUT_FREEZE.structurallyComplete, false);
  assert.equal(result.ownerChoicesStructurallyComplete, false);
  assertTerminalHold(result);
});

test("entropy timing-risk acceptance is a closed enum and cannot overclaim unbiased probability", () => {
  const manifest = fillAllOwnerChoices(canonicalManifest());
  manifest.nodes.PRODUCTION_IDENTITY_INPUT_FREEZE.ownerChoices.entropyRiskAcceptance = "ACCEPT_EXACT_UNBIASED_6667_PROBABILITY";
  const result = validateB3OwnerPolicyFreezeManifest(manifest);
  assert.equal(result.valid, false);
  assert.match(result.violations.join("\n"), /entropyRiskAcceptance: expected one of .* or null/iu);
  assertTerminalHold(result);
});

test("safe order withholds downstream eligibility even when a later choice is complete", () => {
  const manifest = canonicalManifest();
  Object.assign(manifest.nodes.B3_COST_CEREMONY_FUNDING.ownerChoices, {
    payerPublicKey: fixturePublicKey(10),
    fundingSourcePolicySha256: "e".repeat(64),
    ceremonyFloorLamports: "3000000000",
    overCeilingDisposition: "REQUIRE_NEW_EXACT_OWNER_CEILING_NEVER_CUT_FEATURES",
  });
  const result = validateB3OwnerPolicyFreezeManifest(manifest);
  assert.equal(result.valid, true, result.violations.join("\n"));
  assert.equal(result.nodeChoiceState.B3_COST_CEREMONY_FUNDING.structurallyComplete, true);
  assert.equal(result.nodeChoiceState.B3_COST_CEREMONY_FUNDING.eligibleInSafeOrder, false);
  assertTerminalHold(result);
});

test("a public owner-acceptance reference remains unverified self-attestation", () => {
  const manifest = fillAllOwnerChoices(canonicalManifest());
  manifest.ownerAcceptance = {
    decisionArtifactSha256: "f".repeat(64),
    signerPublicKey: fixturePublicKey(11),
    detachedSignatureBase64: `${"A".repeat(86)}==`,
    signedAtUtc: "2026-08-10T00:00:00Z",
  };
  const result = validateB3OwnerPolicyFreezeManifest(manifest);
  assert.equal(result.valid, true, result.violations.join("\n"));
  assert.equal(result.ownerAcceptanceReferencePresent, true);
  assert.equal(result.ownerAcceptanceVerified, false);
  assert.equal(result.ownerIdentityAuthenticated, false);
  assert.equal(result.externalEvidenceVerified, false);
  assertTerminalHold(result);
});

test("a present owner-acceptance reference must be complete, public, and canonically encoded", () => {
  const reference = () => ({
    decisionArtifactSha256: "f".repeat(64),
    signerPublicKey: fixturePublicKey(11),
    detachedSignatureBase64: `${"A".repeat(86)}==`,
    signedAtUtc: "2026-08-10T00:00:00Z",
  });
  for (const mutate of [
    (value) => { value.decisionArtifactSha256 = null; },
    (value) => { value.signerPublicKey = null; },
    (value) => { value.detachedSignatureBase64 = `${"/".repeat(86)}==`; },
    (value) => { value.signedAtUtc = "2026-02-31T00:00:00Z"; },
  ]) {
    const manifest = canonicalManifest();
    manifest.ownerAcceptance = reference();
    mutate(manifest.ownerAcceptance);
    const result = validateB3OwnerPolicyFreezeManifest(manifest);
    assert.equal(result.valid, false);
    assert.equal(result.ownerAcceptanceVerified, false);
    assert.equal(result.externalEvidenceVerified, false);
    assertTerminalHold(result);
  }
});

test("live-Estate choices fail closed on contradictory migration or adoption combinations", () => {
  const migration = canonicalManifest();
  Object.assign(migration.nodes.LIVE_ESTATE_CANONICAL_MINT_DECISION.ownerChoices, {
    liveEstateAssertion: "LIVE_ESTATE_MINT_IDENTIFIED",
    candidateMint: fixturePublicKey(12),
    candidateTokenProgramId: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
    canonicalMintDecision: "MIGRATE_ORIGINAL_SPL_TO_TOKEN_2022",
    duplicateSupplyRetirementPolicy: "NOT_APPLICABLE",
  });
  let result = validateB3OwnerPolicyFreezeManifest(migration);
  assert.equal(result.valid, false);
  assert.match(result.violations.join("\n"), /migration requires the Original SPL Token program|source supply reconciliation/u);

  const noEstate = canonicalManifest();
  Object.assign(noEstate.nodes.LIVE_ESTATE_CANONICAL_MINT_DECISION.ownerChoices, {
    liveEstateAssertion: "NO_LIVE_ESTATE_MINT",
    candidateMint: fixturePublicKey(12),
    candidateTokenProgramId: null,
    canonicalMintDecision: "NEW_TOKEN_2022_FROM_INCEPTION",
    duplicateSupplyRetirementPolicy: "NOT_APPLICABLE",
  });
  result = validateB3OwnerPolicyFreezeManifest(noEstate);
  assert.equal(result.valid, false);
  assert.match(result.violations.join("\n"), /requires null candidate mint/u);
});

test("cross-node economics and custody choices must reconcile exactly", () => {
  const carveOut = fillAllOwnerChoices(canonicalManifest());
  carveOut.nodes.GENESIS_ALLOCATIONS_CONSERVATION.ownerChoices.factionCarveOutBaseUnits = "999";
  let result = validateB3OwnerPolicyFreezeManifest(carveOut);
  assert.equal(result.valid, false);
  assert.match(result.violations.join("\n"), /must equal the frozen faction carve-out/u);

  const beneficiary = fillAllOwnerChoices(canonicalManifest());
  beneficiary.nodes.GENESIS_ALLOCATIONS_CONSERVATION.ownerChoices.coreBeneficiary = fixturePublicKey(13);
  result = validateB3OwnerPolicyFreezeManifest(beneficiary);
  assert.equal(result.valid, false);
  assert.match(result.violations.join("\n"), /fixed core-custody release beneficiary/u);

  const insolvent = fillAllOwnerChoices(canonicalManifest());
  insolvent.nodes.FACTION_ECONOMICS_FUNDING.ownerChoices.weeklyEmissionBaseUnits = "1000000000000000";
  result = validateB3OwnerPolicyFreezeManifest(insolvent);
  assert.equal(result.valid, false);
  assert.match(result.violations.join("\n"), /exceeds the fixed carve-out/u);
});

test("identity and ceremony fields reject fixtures, collisions, and an underfunded floor", () => {
  const fixture = fillAllOwnerChoices(canonicalManifest());
  fixture.nodes.PRODUCTION_IDENTITY_INPUT_FREEZE.ownerChoices.lawProgramId = "29dv8e1WcjL4w6a7HDaHbUfXrF12yiJiVcKQ1qgeT3rF";
  let result = validateB3OwnerPolicyFreezeManifest(fixture);
  assert.equal(result.valid, false);
  assert.match(result.violations.join("\n"), /test-only identity/u);

  const builtin = fillAllOwnerChoices(canonicalManifest());
  builtin.nodes.PRODUCTION_IDENTITY_INPUT_FREEZE.ownerChoices.lawProgramId = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
  result = validateB3OwnerPolicyFreezeManifest(builtin);
  assert.equal(result.valid, false);
  assert.match(result.violations.join("\n"), /Token-2022 program ID cannot be a B3 production identity/u);

  const collision = fillAllOwnerChoices(canonicalManifest());
  collision.nodes.PRODUCTION_IDENTITY_INPUT_FREEZE.ownerChoices.canonicalMint = collision.nodes.PRODUCTION_IDENTITY_INPUT_FREEZE.ownerChoices.economyProgramId;
  result = validateB3OwnerPolicyFreezeManifest(collision);
  assert.equal(result.valid, false);
  assert.match(result.violations.join("\n"), /must be distinct/u);

  const floor = fillAllOwnerChoices(canonicalManifest());
  floor.nodes.B3_COST_CEREMONY_FUNDING.ownerChoices.ceremonyFloorLamports = "2999999999";
  result = validateB3OwnerPolicyFreezeManifest(floor);
  assert.equal(result.valid, false);
  assert.match(result.violations.join("\n"), /at least the frozen 3 SOL/u);
});

test("evidence, authorization, graph completion, and feature-cut promotion are immutable false", () => {
  for (const mutate of [
    (manifest) => { manifest.evidenceBoundary.acceptsExternalEvidence = true; },
    (manifest) => { manifest.evidenceBoundary.selfAttestationIsExternalProof = true; },
    (manifest) => { manifest.assurance.chainTruthVerified = true; },
    (manifest) => { manifest.assurance.devnetAuthorized = true; },
    (manifest) => { manifest.assurance.activationReady = true; },
    (manifest) => { manifest.assurance.releaseAuthorized = true; },
    (manifest) => { manifest.assurance.mainnetExecutionAuthorized = true; },
    (manifest) => { manifest.assurance.mainnetStatus = "GO"; },
    (manifest) => { manifest.invariants.graphCompletionPermitted = true; },
    (manifest) => { manifest.invariants.v2FeatureCutsPermitted = true; },
    (manifest) => { manifest.invariants.dailyLawWeakeningPermitted = true; },
  ]) {
    const manifest = canonicalManifest();
    mutate(manifest);
    const result = validateB3OwnerPolicyFreezeManifest(manifest);
    assert.equal(result.valid, false);
    assertTerminalHold(result);
  }
});

test("evidence payloads and secret-bearing fields are outside the intake contract", () => {
  const evidence = canonicalManifest();
  evidence.nodes.LIVE_ESTATE_CANONICAL_MINT_DECISION.evidenceRequirements.externalProof = "self-attested";
  let result = validateB3OwnerPolicyFreezeManifest(evidence);
  assert.equal(result.valid, false);
  assert.match(result.violations.join("\n"), /keys must be exactly external, engineering|requirement inventories/u);

  const secretField = canonicalManifest();
  secretField.nodes.B3_COST_CEREMONY_FUNDING.ownerChoices.privateKey = [1, 2, 3];
  result = validateB3OwnerPolicyFreezeManifest(secretField);
  assert.equal(result.valid, false);
  assert.match(result.violations.join("\n"), /secret-bearing fields are forbidden|keys must be exactly/u);

  const pem = canonicalManifest();
  pem.ownerAcceptance = {
    decisionArtifactSha256: "f".repeat(64),
    signerPublicKey: fixturePublicKey(11),
    detachedSignatureBase64: "-----BEGIN PRIVATE KEY-----",
    signedAtUtc: "2026-08-10T00:00:00Z",
  };
  result = validateB3OwnerPolicyFreezeManifest(pem);
  assert.equal(result.valid, false);
  assert.match(result.violations.join("\n"), /secret or private-key material is forbidden/u);
});

test("plain but structurally hostile node payloads fail closed without throwing", () => {
  for (const id of OWNER_POLICY_NODE_IDS) {
    const manifest = canonicalManifest();
    manifest.nodes[id].ownerChoices = null;
    const result = validateB3OwnerPolicyFreezeManifest(manifest);
    assert.equal(result.valid, false, id);
    assert.match(result.violations.join("\n"), /ownerChoices: expected object/u);
    assertTerminalHold(result);
  }

  const overflow = canonicalManifest();
  overflow.nodes.B3_COST_CEREMONY_FUNDING.ownerChoices.ceremonyFloorLamports = "18446744073709551616";
  const result = validateB3OwnerPolicyFreezeManifest(overflow);
  assert.equal(result.valid, false);
  assert.match(result.violations.join("\n"), /exceeds the Solana u64 range/u);
});

test("descriptor-safe traversal rejects hostile JavaScript values without invoking getters", () => {
  let getterCalls = 0;
  const getter = canonicalManifest();
  Object.defineProperty(getter, "status", {
    enumerable: true,
    configurable: true,
    get() {
      getterCalls += 1;
      throw new Error("must not run");
    },
  });
  const getterResult = validateB3OwnerPolicyFreezeManifest(getter);
  assert.equal(getterResult.valid, false);
  assert.equal(getterCalls, 0);
  assert.match(getterResult.violations.join("\n"), /own data property/u);

  const cases = [
    () => { const value = canonicalManifest(); Object.setPrototypeOf(value, { hostile: true }); return value; },
    () => { const value = canonicalManifest(); Object.setPrototypeOf(value, null); return value; },
    () => { const value = canonicalManifest(); Object.setPrototypeOf(value.scope.nodeIds, Object.create(Array.prototype)); return value; },
    () => { const value = canonicalManifest(); Object.setPrototypeOf(value.scope.nodeIds, null); return value; },
    () => { const value = canonicalManifest(); value[Symbol("hostile")] = true; return value; },
    () => { const value = canonicalManifest(); Object.defineProperty(value, "hidden", { value: true, enumerable: false }); return value; },
    () => { const value = canonicalManifest(); delete value.scope.nodeIds[1]; return value; },
    () => { const value = canonicalManifest(); value.scope.nodeIds.extra = true; return value; },
    () => { const value = canonicalManifest(); value.nodes.LIVE_ESTATE_CANONICAL_MINT_DECISION.ownerChoices.loop = value; return value; },
    () => { const value = canonicalManifest(); value.nodes.CORE_CUSTODY_POLICY_ADAPTER.ownerChoices = value.nodes.LIVE_ESTATE_CANONICAL_MINT_DECISION.ownerChoices; return value; },
    () => { const value = canonicalManifest(); value.decisionOrder[0].stage = Number.NaN; return value; },
    () => { const value = canonicalManifest(); value.decisionOrder[0].stage = Number.POSITIVE_INFINITY; return value; },
    () => { const value = canonicalManifest(); value.decisionOrder[0].stage = Number.MAX_SAFE_INTEGER + 1; return value; },
    () => { const value = canonicalManifest(); value.decisionOrder[0].stage = -0; return value; },
    () => { const value = canonicalManifest(); value.decisionOrder[0].stage = 1n; return value; },
    () => { const value = canonicalManifest(); value.decisionOrder[0].stage = undefined; return value; },
    () => { const value = canonicalManifest(); value.decisionOrder[0].stage = () => 1; return value; },
    () => { const value = canonicalManifest(); value.status = "\ud800"; return value; },
    () => { const value = canonicalManifest(); value.status = "\udc00"; return value; },
  ];
  for (const createValue of cases) {
    const result = validateB3OwnerPolicyFreezeManifest(createValue());
    assert.equal(result.valid, false, JSON.stringify(result));
    assertTerminalHold(result);
  }
});

test("strict JSON parser rejects duplicate top-level, nested, and decoded member names", () => {
  assert.throws(
    () => parseB3OwnerPolicyFreezeJson('{"schema":"first","schema":"second"}', "duplicate-top"),
    /duplicate JSON member \$root\.schema/u,
  );
  assert.throws(
    () => parseB3OwnerPolicyFreezeJson('{"outer":{"choice":1,"choice":2}}', "duplicate-nested"),
    /duplicate JSON member \$root\.outer\.choice/u,
  );
  assert.throws(
    () => parseB3OwnerPolicyFreezeJson('{"a":1,"\\u0061":2}', "duplicate-decoded"),
    /duplicate JSON member \$root\.a/u,
  );

  const temporaryDirectory = mkdtempSync(join(tmpdir(), "iat-b3-owner-policy-"));
  try {
    for (const [name, source, pattern] of [
      ["top.json", '{"schema":"first","schema":"second"}', /duplicate JSON member \$root\.schema/u],
      ["nested.json", '{"outer":{"choice":1,"choice":2}}', /duplicate JSON member \$root\.outer\.choice/u],
    ]) {
      const path = join(temporaryDirectory, name);
      writeFileSync(path, source, "utf8");
      const cli = spawnSync(process.execPath, [CLI_PATH, "--manifest", path], {
        cwd: SITE_ROOT,
        encoding: "utf8",
        windowsHide: true,
      });
      assert.equal(cli.status, 1, cli.stderr || cli.stdout);
      assert.match(cli.stderr, pattern);
    }
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("schema is strict at every variable object and is canonically linked", () => {
  const manifest = canonicalManifest();
  const schema = parseB3OwnerPolicyFreezeJson(readFileSync(SCHEMA_PATH, "utf8"), "owner-policy-schema");
  assert.equal(manifest.$schema, "./iat-b3-owner-policy-freeze.v1.schema.json");
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.nodes.additionalProperties, false);
  for (const node of Object.values(schema.properties.nodes.properties)) assert.equal(node.additionalProperties, false);
  for (const name of ["liveChoices", "coreChoices", "factionChoices", "configChoices", "genesisChoices", "identityChoices", "costChoices"]) {
    assert.equal(schema.$defs[name].additionalProperties, false, name);
  }
  assert.equal(schema.properties.ownerAcceptance.anyOf[1].additionalProperties, false);
});

test("CLI accepts the canonical HOLD packet and fails closed when completeness is required", () => {
  const ordinary = spawnSync(process.execPath, [CLI_PATH], { cwd: SITE_ROOT, encoding: "utf8", windowsHide: true });
  assert.equal(ordinary.status, 0, ordinary.stderr || ordinary.stdout);
  const output = JSON.parse(ordinary.stdout);
  assert.equal(output.valid, true);
  assert.equal(output.ownerChoicesStructurallyComplete, false);
  assertTerminalHold(output);

  const required = spawnSync(process.execPath, [CLI_PATH, "--require-owner-choices-complete"], {
    cwd: SITE_ROOT,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(required.status, 2, required.stderr || required.stdout);
  assert.equal(JSON.parse(required.stdout).mainnetStatus, "HOLD");
});

test("public-key helper accepts exact 32-byte encodings only", () => {
  assert.equal(isCanonicalOwnerPolicyPublicKey(fixturePublicKey(20)), true);
  assert.equal(isCanonicalOwnerPolicyPublicKey("1111111111111111111111111111111"), false);
  assert.equal(isCanonicalOwnerPolicyPublicKey("not-a-base58-key"), false);
});

test("live-estate observation is finalized, read-only, and cannot complete the owner decision", async () => {
  const candidateMint = fixturePublicKey(41);
  const calls = [];
  const mintData = Buffer.alloc(82, 7);
  const rpcCall = async (method, params, id) => {
    calls.push({ method, params, id });
    if (method === "getGenesisHash") return IAT_B3_MAINNET_GENESIS_HASH;
    if (method === "getSlot") return 400_000_000;
    if (method === "getAccountInfo") {
      return {
        context: { slot: 400_000_001 },
        value: {
          data: [mintData.toString("base64"), "base64"],
          executable: false,
          lamports: 1_461_600,
          owner: TOKEN_2022_PROGRAM_ID,
        },
      };
    }
    if (method === "getTokenSupply") {
      return { context: { slot: 400_000_002 }, value: { amount: "1000000000000000000", decimals: 9 } };
    }
    throw new Error(`unexpected method ${method}`);
  };

  const result = await observeIatB3LiveEstateMainnet({
    candidateMint,
    rpcCall,
    observedAtUtc: "2026-08-11T00:00:00.000Z",
  });
  assert.deepEqual(calls.map(({ method, id }) => [method, id]), [
    ["getGenesisHash", 1],
    ["getSlot", 2],
    ["getAccountInfo", 3],
    ["getTokenSupply", 4],
  ]);
  assert.deepEqual(calls[2].params, [
    candidateMint,
    { encoding: "base64", commitment: "finalized", minContextSlot: 400_000_000 },
  ]);
  assert.deepEqual(calls[3].params, [candidateMint, { commitment: "finalized", minContextSlot: 400_000_001 }]);
  assert.equal(result.candidateAccount.recognizedTokenProgram, "TOKEN_2022");
  assert.equal(result.candidateAccount.dataLength, 82);
  assert.equal(result.candidateAccount.supplyBaseUnits, "1000000000000000000");
  assert.equal(result.candidateAccount.accountContextSlot, 400_000_001);
  assert.equal(result.candidateAccount.tokenSupplyContextSlot, 400_000_002);
  assert.equal(result.ownerAssertionAccepted, false);
  assert.equal(result.liveEstateDecisionComplete, false);
  assert.equal(result.publicNetworkWrites, false);
  assert.equal(result.mainnetExecutionAuthorized, false);
  assert.equal(result.mainnetStatus, "HOLD");
});

test("live-estate observation reports missing input without inferring that no estate exists", async () => {
  const calls = [];
  const result = await observeIatB3LiveEstateMainnet({
    rpcCall: async (method) => {
      calls.push(method);
      if (method === "getGenesisHash") return IAT_B3_MAINNET_GENESIS_HASH;
      if (method === "getSlot") return 400_000_001;
      throw new Error(`unexpected method ${method}`);
    },
    observedAtUtc: "2026-08-11T00:01:00.000Z",
  });
  assert.deepEqual(calls, ["getGenesisHash", "getSlot"]);
  assert.equal(result.result, "NO_CANDIDATE_SUPPLIED");
  assert.equal(result.candidateObservationComplete, false);
  assert.equal(result.blocker, "OWNER_MUST_SUPPLY_A_CANDIDATE_MINT_OR_SIGN_NO_LIVE_ESTATE_ASSERTION");
  assert.equal(result.liveEstateDecisionComplete, false);
  assert.equal(result.mainnetStatus, "HOLD");
});

test("live-estate observation fails closed on malformed keys, wrong networks, and unbound RPC slots", async () => {
  let calls = 0;
  await assert.rejects(
    observeIatB3LiveEstateMainnet({ candidateMint: "not-a-key", rpcCall: async () => { calls += 1; } }),
    /canonical 32-byte Base58 public key/u,
  );
  assert.equal(calls, 0);

  await assert.rejects(
    observeIatB3LiveEstateMainnet({
      rpcCall: async (method) => method === "getGenesisHash" ? "wrong-network" : 1,
    }),
    /Mainnet genesis mismatch/u,
  );

  await assert.rejects(
    observeIatB3LiveEstateMainnet({
      candidateMint: fixturePublicKey(42),
      rpcCall: async (method) => {
        if (method === "getGenesisHash") return IAT_B3_MAINNET_GENESIS_HASH;
        if (method === "getSlot") return 400_000_002;
        if (method === "getAccountInfo") return { context: { slot: 400_000_001 }, value: null };
        throw new Error(`unexpected method ${method}`);
      },
    }),
    /preceded the finalized observation boundary/u,
  );
});

test("standard-program observation pins finalized Token-2022 bytes and the native ZK program without authorizing release", async () => {
  const programDataKey = decodeBase58(TOKEN_2022_LAST_UPGRADE.programDataAddress);
  const upgradeAuthority = decodeBase58(TOKEN_2022_LAST_UPGRADE.authority);
  const tokenProgramState = Buffer.alloc(36);
  tokenProgramState.writeUInt32LE(2, 0);
  tokenProgramState.set(programDataKey, 4);
  const tokenProgramData = Buffer.alloc(45 + TEST_TOKEN_DEPLOYED_BYTES.length);
  tokenProgramData.writeUInt32LE(3, 0);
  tokenProgramData.writeBigUInt64LE(427_147_035n, 4);
  tokenProgramData[12] = 1;
  tokenProgramData.set(upgradeAuthority, 13);
  tokenProgramData.set(TEST_TOKEN_DEPLOYED_BYTES, 45);
  const calls = [];
  const rpcCall = async (method, params, id) => {
    calls.push({ method, params, id });
    if (method === "getGenesisHash") return IAT_B3_MAINNET_GENESIS_HASH;
    if (method === "getSlot") return 438_000_000;
    if (method === "getMultipleAccounts") {
      return {
        context: { slot: 438_000_001 },
        value: [
          { data: [tokenProgramState.toString("base64"), "base64"], executable: true, owner: UPGRADEABLE_LOADER_ID },
          {
            data: [Buffer.from(ZK_ELGAMAL_NATIVE_PROGRAM_NAME, "ascii").toString("base64"), "base64"],
            executable: true,
            owner: NATIVE_LOADER_ID,
          },
        ],
      };
    }
    if (method === "getAccountInfo") {
      return {
        context: { slot: 438_000_002 },
        value: { data: [tokenProgramData.toString("base64"), "base64"], executable: false, owner: UPGRADEABLE_LOADER_ID },
      };
    }
    if (method === "getSignaturesForAddress") {
      return [{
        signature: TOKEN_2022_LAST_UPGRADE.signature,
        slot: TOKEN_2022_LAST_UPGRADE.slot,
        blockTime: TOKEN_2022_LAST_UPGRADE.blockTime,
        err: null,
        confirmationStatus: "finalized",
      }];
    }
    if (method === "getTransaction") {
      return {
        slot: TOKEN_2022_LAST_UPGRADE.slot,
        blockTime: TOKEN_2022_LAST_UPGRADE.blockTime,
        meta: {
          err: null,
          logMessages: [`Upgraded program ${TOKEN_2022_PROGRAM_ID}`],
          innerInstructions: [{ instructions: [
            {
              program: "bpf-upgradeable-loader",
              programId: UPGRADEABLE_LOADER_ID,
              parsed: { type: "upgrade", info: {
                programAccount: TOKEN_2022_PROGRAM_ID,
                programDataAccount: TOKEN_2022_LAST_UPGRADE.programDataAddress,
                bufferAccount: TOKEN_2022_LAST_UPGRADE.bufferAccount,
                authority: TOKEN_2022_LAST_UPGRADE.authority,
                spillAccount: TOKEN_2022_LAST_UPGRADE.spillAccount,
              } },
            },
            { programId: TOKEN_2022_LAST_UPGRADE.executionTrackerProgram },
          ] }],
        },
        transaction: {
          signatures: [TOKEN_2022_LAST_UPGRADE.signature],
          message: { instructions: [{ programId: TOKEN_2022_LAST_UPGRADE.executorProgram }] },
        },
      };
    }
    throw new Error(`unexpected method ${method}`);
  };

  const result = await observeIatB3StandardProgramsMainnet({
    rpcCall,
    observedAtUtc: "2026-08-11T02:00:00.000Z",
    releaseBinding: TEST_TOKEN_RELEASE_BINDING,
  });
  assert.deepEqual(calls.map(({ method, id }) => [method, id]), [
    ["getGenesisHash", 1],
    ["getSlot", 2],
    ["getMultipleAccounts", 3],
    ["getAccountInfo", 4],
    ["getSignaturesForAddress", 5],
    ["getTransaction", 6],
  ]);
  assert.deepEqual(calls[2].params[0], [TOKEN_2022_PROGRAM_ID, ZK_ELGAMAL_PROOF_PROGRAM_ID]);
  assert.equal(result.token2022.deploymentSlot, 427_147_035);
  assert.equal(result.token2022.programBytes, TEST_TOKEN_DEPLOYED_BYTES.length);
  assert.equal(result.token2022.immutable, false);
  assert.equal(result.token2022.lastUpgrade.finalizedProvenanceVerified, true);
  assert.equal(result.token2022.releaseIdentity.embeddedTag, "program@v11.0.0");
  assert.equal(result.token2022.releaseIdentity.taggedSourceCommit, "9bc02757f600ffe754746708a8a072bcd49d1260");
  assert.equal(result.token2022.releaseIdentity.embeddedReleaseMarkersVerified, true);
  assert.equal(result.token2022.releaseIdentity.exactSourceBytesRebuiltAndMatched, true);
  assert.equal(result.token2022.releaseIdentity.zeroLoaderPaddingVerified, true);
  assert.equal(result.token2022.releaseIdentity.productionBinding, false);
  assert.equal(result.zkElgamalProof.immutable, true);
  assert.equal(result.standardProgramSnapshotComplete, true);
  assert.equal(result.sourceReleaseBindingComplete, false);
  assert.equal(result.exactSourceCommit, null);
  assert.equal(result.token2022ImmutableBytecodeVerified, false);
  assert.equal(result.hostCompatibilityComplete, false);
  assert.equal(result.mainnetExecutionAuthorized, false);
  assert.equal(result.mainnetStatus, "HOLD");
});

test("standard-program observation rejects substituted loaders, native bytes, and stale ProgramData", async () => {
  const tokenProgramState = Buffer.alloc(36);
  tokenProgramState.writeUInt32LE(2, 0);
  tokenProgramState.set(decodeBase58(TOKEN_2022_LAST_UPGRADE.programDataAddress), 4);
  const validPrograms = {
    context: { slot: 438_000_001 },
    value: [
      { data: [tokenProgramState.toString("base64"), "base64"], executable: true, owner: UPGRADEABLE_LOADER_ID },
      {
        data: [Buffer.from(ZK_ELGAMAL_NATIVE_PROGRAM_NAME, "ascii").toString("base64"), "base64"],
        executable: true,
        owner: NATIVE_LOADER_ID,
      },
    ],
  };
  const baseRpc = (
    mutatePrograms,
    programDataSlot = 438_000_002,
    mutateHistory = (history) => history,
    mutateTransaction = (transaction) => transaction,
    mutateProgramData = (bytes) => bytes,
  ) => async (method) => {
    if (method === "getGenesisHash") return IAT_B3_MAINNET_GENESIS_HASH;
    if (method === "getSlot") return 438_000_000;
    if (method === "getMultipleAccounts") return mutatePrograms(structuredClone(validPrograms));
    if (method === "getAccountInfo") {
      const bytes = Buffer.alloc(45 + TEST_TOKEN_DEPLOYED_BYTES.length);
      bytes.writeUInt32LE(3, 0);
      bytes.writeBigUInt64LE(427_147_035n, 4);
      bytes[12] = 1;
      bytes.set(decodeBase58(TOKEN_2022_LAST_UPGRADE.authority), 13);
      bytes.set(TEST_TOKEN_DEPLOYED_BYTES, 45);
      mutateProgramData(bytes);
      return {
        context: { slot: programDataSlot },
        value: { data: [bytes.toString("base64"), "base64"], executable: false, owner: UPGRADEABLE_LOADER_ID },
      };
    }
    if (method === "getSignaturesForAddress") {
      return mutateHistory([{ ...TOKEN_2022_LAST_UPGRADE, err: null, confirmationStatus: "finalized" }]);
    }
    if (method === "getTransaction") {
      return mutateTransaction({
        slot: TOKEN_2022_LAST_UPGRADE.slot,
        blockTime: TOKEN_2022_LAST_UPGRADE.blockTime,
        meta: {
          err: null,
          logMessages: [`Upgraded program ${TOKEN_2022_PROGRAM_ID}`],
          innerInstructions: [{ instructions: [
            {
              program: "bpf-upgradeable-loader",
              programId: UPGRADEABLE_LOADER_ID,
              parsed: { type: "upgrade", info: {
                programAccount: TOKEN_2022_PROGRAM_ID,
                programDataAccount: TOKEN_2022_LAST_UPGRADE.programDataAddress,
                bufferAccount: TOKEN_2022_LAST_UPGRADE.bufferAccount,
                authority: TOKEN_2022_LAST_UPGRADE.authority,
                spillAccount: TOKEN_2022_LAST_UPGRADE.spillAccount,
              } },
            },
            { programId: TOKEN_2022_LAST_UPGRADE.executionTrackerProgram },
          ] }],
        },
        transaction: {
          signatures: [TOKEN_2022_LAST_UPGRADE.signature],
          message: { instructions: [{ programId: TOKEN_2022_LAST_UPGRADE.executorProgram }] },
        },
      });
    }
    throw new Error(`unexpected method ${method}`);
  };

  await assert.rejects(
    observeIatB3StandardProgramsMainnet({
      rpcCall: baseRpc((programs) => { programs.value[0].owner = NATIVE_LOADER_ID; return programs; }),
      releaseBinding: TEST_TOKEN_RELEASE_BINDING,
    }),
    /Token-2022 program account/u,
  );
  await assert.rejects(
    observeIatB3StandardProgramsMainnet({
      rpcCall: baseRpc((programs) => { programs.value[1].data[0] = Buffer.from("substitute").toString("base64"); return programs; }),
      releaseBinding: TEST_TOKEN_RELEASE_BINDING,
    }),
    /ZK ElGamal proof program/u,
  );
  await assert.rejects(
    observeIatB3StandardProgramsMainnet({
      rpcCall: baseRpc((programs) => programs, 438_000_000),
      releaseBinding: TEST_TOKEN_RELEASE_BINDING,
    }),
    /ProgramData observation preceded/u,
  );
  await assert.rejects(
    observeIatB3StandardProgramsMainnet({
      rpcCall: baseRpc(
        (programs) => programs,
        438_000_002,
        (history) => { history[0].signature = "substituted"; return history; },
      ),
      releaseBinding: TEST_TOKEN_RELEASE_BINDING,
    }),
    /newest ProgramData history/u,
  );
  await assert.rejects(
    observeIatB3StandardProgramsMainnet({
      rpcCall: baseRpc(
        (programs) => programs,
        438_000_002,
        (history) => history,
        (transaction) => {
          transaction.meta.innerInstructions[0].instructions[0].parsed.info.authority = "substituted";
          return transaction;
        },
      ),
      releaseBinding: TEST_TOKEN_RELEASE_BINDING,
    }),
    /finalized upgrade transaction/u,
  );
  await assert.rejects(
    observeIatB3StandardProgramsMainnet({
      rpcCall: baseRpc(
        (programs) => programs,
        438_000_002,
        (history) => history,
        (transaction) => transaction,
        (bytes) => { bytes[53] ^= 0xff; return bytes; },
      ),
      releaseBinding: TEST_TOKEN_RELEASE_BINDING,
    }),
    /official release identity markers/u,
  );
  for (const mutateProgramData of [
    (bytes) => { bytes[45 + 200] ^= 0xff; return bytes; },
    (bytes) => { bytes[bytes.length - 1] = 1; return bytes; },
  ]) {
    await assert.rejects(
      observeIatB3StandardProgramsMainnet({
        rpcCall: baseRpc(
          (programs) => programs,
          438_000_002,
          (history) => history,
          (transaction) => transaction,
          mutateProgramData,
        ),
        releaseBinding: TEST_TOKEN_RELEASE_BINDING,
      }),
      /exact-toolchain build plus zero Loader padding/u,
    );
  }
});

test("standard-program source-equivalence evidence is source-bound, reproducible, and nonauthorizing", () => {
  const evidence = JSON.parse(readFileSync(STANDARD_PROGRAM_SOURCE_EQUIVALENCE_EVIDENCE_PATH, "utf8"));
  const observerPath = join(SITE_ROOT, evidence.sourceBinding.observerPath);
  const observerSha256 = createHash("sha256").update(readFileSync(observerPath)).digest("hex");

  assert.equal(evidence.schema, "iat-b3-standard-program-mainnet-source-equivalence-evidence/v1");
  assert.equal(evidence.sourceBinding.gitHead, "bfe3c188b86c233998665962c6a3c8f8822ca3cd");
  assert.equal(observerSha256, evidence.sourceBinding.observerSha256);
  assert.equal(evidence.network, "mainnet-beta");
  assert.equal(evidence.genesisHash, IAT_B3_MAINNET_GENESIS_HASH);
  assert.equal(evidence.token2022.programId, TOKEN_2022_PROGRAM_ID);
  assert.equal(evidence.token2022.programBytes, TOKEN_2022_OFFICIAL_RELEASE.deployedCapacityBytes);
  assert.equal(evidence.token2022.releaseIdentity.buildArtifactBytes, TOKEN_2022_OFFICIAL_RELEASE.buildArtifactBytes);
  assert.equal(
    evidence.token2022.releaseIdentity.buildArtifactSha256,
    TOKEN_2022_OFFICIAL_RELEASE.buildArtifactSha256,
  );
  assert.equal(evidence.token2022.releaseIdentity.taggedSourceCommit, TOKEN_2022_OFFICIAL_RELEASE.taggedSourceCommit);
  assert.equal(evidence.token2022.releaseIdentity.repeatedCleanBuilds, 2);
  assert.equal(evidence.token2022.releaseIdentity.exactSourceBytesRebuiltAndMatched, true);
  assert.equal(evidence.token2022.releaseIdentity.zeroLoaderPaddingVerified, true);
  assert.equal(evidence.sourceReleaseBindingComplete, true);
  assert.equal(evidence.reproducibleOfficialBuildMatched, true);
  assert.equal(evidence.token2022.immutable, false);
  assert.equal(evidence.rpcObservationAuthenticated, false);
  assert.equal(evidence.token2022ImmutableBytecodeVerified, false);
  assert.equal(evidence.hostCompatibilityComplete, false);
  assert.equal(evidence.publicNetworkWrites, false);
  assert.equal(evidence.activationReady, false);
  assert.equal(evidence.mainnetExecutionAuthorized, false);
  assert.equal(evidence.mainnetStatus, "HOLD");
  assert.equal(
    evidence.blocker,
    "TOKEN_2022_CEREMONY_TIME_REATTESTATION_REMAINS_REQUIRED_BECAUSE_PROGRAM_IS_UPGRADEABLE",
  );
});
