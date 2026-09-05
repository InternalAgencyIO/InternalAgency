import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  IAT_B3_ENTROPY_RISK_ACCEPTANCE,
  IAT_B3_OWNER_CHOICE_FIELD_COUNT,
  IAT_B3_OWNER_INPUT_SCHEMA,
  IAT_B3_TRANSIT_POLICY_ID,
  IAT_B3_TRANSIT_POLICY_REJECTION,
  parseAndValidateIatB3OwnerInputJson,
  parseIatB3OwnerInputJson,
  validateIatB3OwnerInput,
  withIatB3OwnerInputSha256,
} from "../scripts/lib/iat-b3-owner-input.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const TEMPLATE_PATH = fileURLToPath(new URL(
  "../docs/b3/iat-b3-owner-input.template.v1.json",
  import.meta.url,
));
const SCHEMA_PATH = fileURLToPath(new URL(
  "../docs/b3/iat-b3-owner-input.v1.schema.json",
  import.meta.url,
));
const TEMPLATE_TEXT = readFileSync(TEMPLATE_PATH, "utf8");
const template = () => {
  const value = JSON.parse(TEMPLATE_TEXT);
  value.inputSha256 = null;
  return value;
};

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58(bytes) {
  let value = 0n;
  for (const byte of bytes) value = (value * 256n) + BigInt(byte);
  let encoded = "";
  while (value > 0n) {
    encoded = ALPHABET[Number(value % 58n)] + encoded;
    value /= 58n;
  }
  let zeroes = 0;
  while (zeroes < bytes.length && bytes[zeroes] === 0) zeroes += 1;
  return "1".repeat(zeroes) + encoded;
}

function publicKey(index) {
  const bytes = new Uint8Array(32);
  bytes[0] = 128 + index;
  bytes[30] = index;
  bytes[31] = index + 1;
  return base58(bytes);
}

function completedInput() {
  const input = template();
  input.inputSha256 = null;
  const artifacts = Object.keys(input.policyArtifacts);
  artifacts.forEach((key, index) => {
    input.policyArtifacts[key] = {
      status: "EXISTING_SHA256",
      sha256: (index + 1).toString(16).padStart(64, "0"),
    };
  });
  input.ownerChoices.core.fixedBeneficiary = publicKey(1);
  Object.assign(input.ownerChoices.faction, {
    sybilPolicy: "PRESERVED_WALLET_AND_IMMUTABLE_X_BINDING",
    weeklyEpochAnchorUnixSeconds: 0,
    communityCarveOutBaseUnits: "1000000000000000",
    weeklyEmissionBaseUnits: "1000000000000",
    fundingHorizonWeeks: 52,
    unusedBalanceDestination: publicKey(2),
    nftPrizePolicy: "NFT_PRIZES_DISABLED",
    claimExpirySeconds: 604800,
  });
  Object.assign(input.ownerChoices.genesis, {
    communityOwner: publicKey(3),
    treasuryBeneficiary: publicKey(4),
    ecosystemBeneficiary: publicKey(5),
    coreBeneficiary: publicKey(1),
    liquidityBeneficiary: publicKey(6),
    factionCarveOutBaseUnits: "1000000000000000",
  });
  Object.assign(input.ownerChoices.productionIdentity, {
    publicKeyDisposition: "PUBLIC_KEYS_PROVIDED",
    lawProgramId: publicKey(7),
    economyProgramId: publicKey(8),
    canonicalMint: publicKey(9),
    clusterIdentityPolicy: "DISTINCT_PROGRAM_AND_MINT_IDS_PER_CLUSTER",
    entropyLagSlots: 150,
    entropyRiskAcceptance: IAT_B3_ENTROPY_RISK_ACCEPTANCE,
  });
  Object.assign(input.ownerChoices.authorityPublicKeys, {
    ceremonySignerPublicKey: publicKey(10),
    lawUpgradeAuthorityPublicKey: publicKey(11),
    economyUpgradeAuthorityPublicKey: publicKey(12),
    payerPublicKey: publicKey(13),
  });
  input.ownerChoices.funding.ceremonyFloorLamports = "3000000000";
  input.transitPolicy.ownerPublicKey = publicKey(14);
  return input;
}

test("owner input schema and response-bound template are strict JSON", () => {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  const input = parseIatB3OwnerInputJson(TEMPLATE_TEXT, "template");
  assert.equal(schema.$id, IAT_B3_OWNER_INPUT_SCHEMA);
  assert.equal(schema.additionalProperties, false);
  assert.equal(input.schema, IAT_B3_OWNER_INPUT_SCHEMA);
  assert.equal(input.scope.canonicalOwnerChoiceFieldCount, IAT_B3_OWNER_CHOICE_FIELD_COUNT);
  assert.equal(input.acceptSourceLockedDefaults, true);
  assert.equal(input.ownerChoices.productionIdentity.publicKeyDisposition, "PUBLIC_KEYS_DEFERRED");
  assert.equal(input.ownerChoices.productionIdentity.entropyLagSlots, null);
  assert.equal(input.transitPolicy.selectedPolicyId, IAT_B3_TRANSIT_POLICY_ID);
});

test("template binds only exact local/offline permissions and remains incomplete HOLD", () => {
  const result = parseAndValidateIatB3OwnerInputJson(TEMPLATE_TEXT, "template");
  assert.equal(result.valid, true);
  assert.equal(result.status, "HOLD");
  assert.equal(result.ownerSelectionsComplete, false);
  assert.equal(result.structuralDraft, false);
  assert.equal(result.inputDigestDisposition, "EMBEDDED_CANONICAL_DIGEST_VERIFIED_NONAUTHORIZING");
  assert.equal(result.canonicalOwnerChoiceFieldCount, 38);
  assert.equal(result.executionAuthorized, false);
  assert.equal(result.publicDevnetAuthorized, false);
  assert.equal(result.releaseAuthorized, false);
  assert.equal(result.mainnetExecutionAuthorized, false);
  assert.equal(result.mainnetStatus, "HOLD");
  assert.equal(result.canonicalOwnerChoiceCandidate.CORE_CUSTODY_POLICY_ADAPTER.acceptFrozenScope, true);
  assert.equal(result.canonicalOwnerChoiceCandidate.PRODUCTION_IDENTITY_INPUT_FREEZE.entropyLagSlots, null);
  assert.equal(result.transitCandidate.ownerSelectedPolicyId, IAT_B3_TRANSIT_POLICY_ID);
  assert.equal(result.transitCandidate.transitOwnerPublicKey, null);
  assert.equal(result.transitCandidate.signedAcceptance, null);
  assert.equal(result.transitCandidate.signatureVerified, false);
  assert.ok(result.blockers.includes("OWNER_INPUT_REQUIRED:policyArtifacts.scoringPolicy"));
  assert.ok(result.blockers.includes("OWNER_INPUT_REQUIRED:ownerChoices.core.fixedBeneficiary"));
  assert.ok(result.blockers.includes("OWNER_INPUT_REQUIRED:ownerChoices.productionIdentity.entropyLagSlots"));
  assert.ok(result.blockers.includes("OWNER_INPUT_REQUIRED:transitPolicy.ownerPublicKey"));
});

test("complete choices materialize exactly 38 canonical fields without authorization", () => {
  const input = withIatB3OwnerInputSha256(completedInput());
  const result = validateIatB3OwnerInput(input);
  assert.equal(result.ownerSelectionsComplete, true);
  assert.deepEqual(result.blockers, []);
  assert.equal(result.canonicalOwnerChoiceFieldCount, 38);
  assert.equal(result.canonicalOwnerChoiceCandidate.CORE_CUSTODY_POLICY_ADAPTER.releasePolicy.fixedBeneficiary, publicKey(1));
  assert.equal(result.canonicalOwnerChoiceCandidate.FACTION_ECONOMICS_FUNDING.tieRule, "ONE_ROLL_NO_REROLL_EXACT_UNIFORM");
  assert.equal(result.canonicalOwnerChoiceCandidate.CONFIG_GENESIS_PHASE_CODEC.bootstrapReplayPolicy, "REJECT_REENTRY_AND_ROLLBACK");
  assert.equal(result.canonicalOwnerChoiceCandidate.GENESIS_ALLOCATIONS_CONSERVATION.coreDestinationPolicy, "CANONICAL_CORE_CUSTODY");
  assert.equal(result.canonicalOwnerChoiceCandidate.PRODUCTION_IDENTITY_INPUT_FREEZE.metadataPolicy, "NO_MINT_METADATA_EXTENSION_IMMUTABLE_EXTERNAL_RECORD");
  assert.equal(result.canonicalOwnerChoiceCandidate.B3_COST_CEREMONY_FUNDING.overCeilingDisposition, "REQUIRE_NEW_EXACT_OWNER_CEILING_NEVER_CUT_FEATURES");
  assert.equal(result.productionAuthorityCandidate.mainnetGenesisHash, null);
  assert.equal(result.productionAuthorityCandidate.mainnetGenesisHashEvidenceDisposition, "TWO_SOURCE_BOUND_ENDPOINT_RECEIPTS_REQUIRED");
  assert.equal(result.transitCandidate.trezorModelTConfirmationObserved, false);
  assert.equal(result.authorizationBoundary.mainnetExecutionAuthorized, false);
});

test("null input digest is an explicit incomplete structural draft", () => {
  const result = validateIatB3OwnerInput(completedInput());
  assert.equal(result.valid, true);
  assert.equal(result.status, "HOLD");
  assert.equal(result.ownerSelectionsComplete, false);
  assert.equal(result.structuralDraft, true);
  assert.equal(result.inputDigestEmbedded, false);
  assert.equal(result.inputDigestDisposition, "UNBOUND_STRUCTURAL_DRAFT");
  assert.ok(result.blockers.includes("OWNER_INPUT_REQUIRED:inputSha256"));
  assert.equal(result.executionAuthorized, false);
  assert.equal(result.publicDevnetAuthorized, false);
  assert.equal(result.mainnetExecutionAuthorized, false);
});

test("embedded canonical digest is accepted and drift is rejected", () => {
  const bound = withIatB3OwnerInputSha256(completedInput());
  assert.equal(validateIatB3OwnerInput(bound).inputDigestEmbedded, true);
  const drifted = structuredClone(bound);
  drifted.ownerChoices.faction.claimExpirySeconds += 1;
  assert.throws(() => validateIatB3OwnerInput(drifted), /input digest mismatch/iu);
});

test("duplicate JSON members are rejected before interpretation", () => {
  const duplicate = TEMPLATE_TEXT.replace(
    '"schema": "iat-b3-owner-input/v1",',
    '"schema": "iat-b3-owner-input/v1",\n  "schema": "iat-b3-owner-input/v1",',
  );
  assert.throws(() => parseIatB3OwnerInputJson(duplicate), /duplicate JSON member/iu);
});

test("object API rejects accessors and proxies before semantic validation", () => {
  const accessor = template();
  let getterReads = 0;
  Object.defineProperty(accessor.authorizationBoundary, "publicDevnetAuthorized", {
    enumerable: true,
    configurable: true,
    get() {
      getterReads += 1;
      return false;
    },
  });
  assert.throws(() => validateIatB3OwnerInput(accessor), /accessor properties are rejected/iu);
  assert.equal(getterReads, 0);

  let proxyReads = 0;
  const proxy = new Proxy(template(), {
    get(target, property, receiver) {
      proxyReads += 1;
      return Reflect.get(target, property, receiver);
    },
  });
  assert.throws(() => validateIatB3OwnerInput(proxy), /proxy objects are rejected/iu);
  assert.equal(proxyReads, 0);

  const nested = template();
  nested.ownerChoices = new Proxy(nested.ownerChoices, {});
  assert.throws(() => withIatB3OwnerInputSha256(nested), /proxy objects are rejected/iu);
});

test("source-policy binding and exact object keys fail closed", () => {
  const sourceDrift = template();
  sourceDrift.sourcePolicyBinding.byteLength += 1;
  assert.throws(() => validateIatB3OwnerInput(sourceDrift), /source binding drifted/iu);
  const extra = template();
  extra.ownerChoices.core.note = "benign";
  assert.throws(() => validateIatB3OwnerInput(extra), /expected exact keys/iu);
});

test("secret fields, PEM, mnemonic phrases, keypair arrays, and local paths are rejected", () => {
  const privateField = template();
  privateField.ownerChoices.core.privateKey = new Array(64).fill(7);
  assert.throws(() => validateIatB3OwnerInput(privateField), /secret/iu);

  const pem = template();
  pem.ownerChoices.core.fixedBeneficiary = "-----BEGIN PRIVATE KEY-----";
  assert.throws(() => validateIatB3OwnerInput(pem), /secret/iu);

  const mnemonic = template();
  mnemonic.ownerChoices.core.fixedBeneficiary = "alpha bravo cedar delta ember forest garden harbor island jungle kernel lunar";
  assert.throws(() => validateIatB3OwnerInput(mnemonic), /secret/iu);

  const keypair = template();
  keypair.ownerChoices.core.fixedBeneficiary = new Array(64).fill(1);
  assert.throws(() => validateIatB3OwnerInput(keypair), /keypair/iu);

  const path = template();
  path.ownerChoices.core.fixedBeneficiary = "C:\\Users\\operator\\secret.json";
  assert.throws(() => validateIatB3OwnerInput(path), /absolute local path/iu);
});

test("every sensitive or external authorization promotion is rejected", () => {
  const input = template();
  for (const key of Object.keys(input.authorizationBoundary)) {
    if (key === "mainnetStatus") continue;
    const promoted = structuredClone(input);
    promoted.authorizationBoundary[key] = true;
    assert.throws(
      () => validateIatB3OwnerInput(promoted),
      /cannot authorize actions/iu,
      key,
    );
  }
  const mainnet = structuredClone(input);
  mainnet.authorizationBoundary.mainnetStatus = "GO";
  assert.throws(() => validateIatB3OwnerInput(mainnet), /must remain HOLD/iu);
});

test("local standing permissions cannot be relabeled as signatures or external execution", () => {
  const input = template();
  const external = structuredClone(input);
  external.standingPermissions.mayAuthorizeSignaturesOrExternalExecution = true;
  assert.throws(() => validateIatB3OwnerInput(external), /permission boundary drifted/iu);
  const proof = structuredClone(input);
  proof.standingPermissions.cryptographicProof = true;
  assert.throws(() => validateIatB3OwnerInput(proof), /permission boundary drifted/iu);
});

test("unobserved truth cannot be promoted", () => {
  const input = template();
  for (const key of Object.keys(input.truth)) {
    const promoted = structuredClone(input);
    promoted.truth[key] = true;
    assert.throws(() => validateIatB3OwnerInput(promoted), /must remain false/iu, key);
  }
});

test("cross-field conservation and identity relations fail closed", () => {
  const duplicateDestination = completedInput();
  duplicateDestination.ownerChoices.genesis.liquidityBeneficiary = duplicateDestination.ownerChoices.genesis.communityOwner;
  assert.throws(() => validateIatB3OwnerInput(duplicateDestination), /must be distinct/iu);

  const coreMismatch = completedInput();
  coreMismatch.ownerChoices.genesis.coreBeneficiary = publicKey(15);
  assert.throws(() => validateIatB3OwnerInput(coreMismatch), /fixed core beneficiary/iu);

  const carveOutMismatch = completedInput();
  carveOutMismatch.ownerChoices.genesis.factionCarveOutBaseUnits = "999";
  assert.throws(() => validateIatB3OwnerInput(carveOutMismatch), /must equal faction community carve-out/iu);

  const insolvent = completedInput();
  insolvent.ownerChoices.faction.weeklyEmissionBaseUnits = "1000000000000000";
  insolvent.ownerChoices.faction.fundingHorizonWeeks = 2;
  assert.throws(() => validateIatB3OwnerInput(insolvent), /exceeds carve-out/iu);

  const duplicateIdentity = completedInput();
  duplicateIdentity.ownerChoices.productionIdentity.economyProgramId = duplicateIdentity.ownerChoices.productionIdentity.lawProgramId;
  assert.throws(() => validateIatB3OwnerInput(duplicateIdentity), /pairwise distinct/iu);

  const lowFloor = completedInput();
  lowFloor.ownerChoices.funding.ceremonyFloorLamports = "2999999999";
  assert.throws(() => validateIatB3OwnerInput(lowFloor), /outside 3000000000/iu);

  const overflowingFloor = completedInput();
  overflowingFloor.ownerChoices.funding.ceremonyFloorLamports = "18446744073709551616";
  assert.throws(() => validateIatB3OwnerInput(overflowingFloor), /18446744073709551615/iu);

  const systemIdentity = completedInput();
  systemIdentity.ownerChoices.productionIdentity.lawProgramId = "11111111111111111111111111111111";
  assert.throws(() => validateIatB3OwnerInput(systemIdentity), /System Program ID/iu);

  const testIdentity = completedInput();
  testIdentity.ownerChoices.productionIdentity.canonicalMint = "29dv8e1WcjL4w6a7HDaHbUfXrF12yiJiVcKQ1qgeT3rF";
  assert.throws(() => validateIatB3OwnerInput(testIdentity), /test-only identity/iu);
});

test("deferred identities, unbound artifacts, and rejected transit stay HOLD", () => {
  const deferredWithKey = template();
  deferredWithKey.ownerChoices.productionIdentity.lawProgramId = publicKey(1);
  assert.throws(() => validateIatB3OwnerInput(deferredWithKey), /must keep public identities null/iu);

  const falseArtifact = template();
  falseArtifact.policyArtifacts.scoringPolicy.sha256 = "a".repeat(64);
  assert.throws(() => validateIatB3OwnerInput(falseArtifact), /must keep sha256 null/iu);

  const rejected = template();
  rejected.transitPolicy.selectedPolicyId = IAT_B3_TRANSIT_POLICY_REJECTION;
  const result = validateIatB3OwnerInput(rejected);
  assert.equal(result.ownerSelectionsComplete, false);
  assert.equal(result.transitCandidate.recommendationRejected, true);
  assert.equal(result.transitCandidate.ownerSelectedPolicyId, null);
  assert.ok(result.blockers.includes("OWNER_REJECTED_ENGINEERING_TRANSIT_RECOMMENDATION:HOLD_FOR_NEW_POLICY"));
});

test("no test mutates files or grants runtime authority", () => {
  const result = validateIatB3OwnerInput(template());
  assert.equal(ROOT.endsWith("site\\") || ROOT.endsWith("site/"), true);
  assert.equal(result.ownerSelectionsAreCryptographicSignatures, false);
  assert.equal(result.executionAuthorized, false);
  assert.equal(result.publicDevnetAuthorized, false);
  assert.equal(result.releaseAuthorized, false);
  assert.equal(result.mainnetExecutionAuthorized, false);
});
