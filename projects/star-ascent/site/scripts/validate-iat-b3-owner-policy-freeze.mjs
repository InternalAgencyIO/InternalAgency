#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const OWNER_POLICY_FREEZE_SCHEMA = "iat-b3-owner-policy-freeze/v1";
export const OWNER_POLICY_FREEZE_MAINNET_STATUS = "HOLD";

const DEFAULT_MANIFEST_PATH = fileURLToPath(new URL(
  "../docs/b3/iat-b3-owner-policy-freeze.v1.json",
  import.meta.url,
));

export const OWNER_POLICY_NODE_IDS = Object.freeze([
  "LIVE_ESTATE_CANONICAL_MINT_DECISION",
  "CORE_CUSTODY_POLICY_ADAPTER",
  "FACTION_ECONOMICS_FUNDING",
  "CONFIG_GENESIS_PHASE_CODEC",
  "GENESIS_ALLOCATIONS_CONSERVATION",
  "PRODUCTION_IDENTITY_INPUT_FREEZE",
  "B3_COST_CEREMONY_FUNDING",
]);

const TOP_LEVEL_KEYS = Object.freeze([
  "$schema",
  "schema",
  "profile",
  "status",
  "scope",
  "decisionOrder",
  "invariants",
  "nodes",
  "ownerAcceptance",
  "evidenceBoundary",
  "assurance",
]);

const EXPECTED_SCOPE = Object.freeze({
  contract: "NON_ACTIVATING_OWNER_POLICY_INTAKE_ONLY",
  nodeIds: OWNER_POLICY_NODE_IDS,
  doesNotCertify: Object.freeze([
    "OWNER_IDENTITY_OR_SIGNATURE_AUTHENTICITY",
    "CHAIN_TRUTH_OR_LIVE_ESTATE_STATE",
    "REVIEWED_BINARY_OR_DEPLOYED_BYTES",
    "GENESIS_CONSERVATION_OR_FUNDING",
    "DEVNET_REHEARSAL_OR_ACTIVATION",
    "RELEASE_OR_MAINNET_AUTHORIZATION",
  ]),
});

const EXPECTED_DECISION_ORDER = Object.freeze([
  Object.freeze({ stage: 1, mode: "SERIAL", nodeIds: Object.freeze([OWNER_POLICY_NODE_IDS[0]]) }),
  Object.freeze({ stage: 2, mode: "PARALLEL", nodeIds: Object.freeze([OWNER_POLICY_NODE_IDS[1], OWNER_POLICY_NODE_IDS[2]]) }),
  Object.freeze({ stage: 3, mode: "SERIAL", nodeIds: Object.freeze([OWNER_POLICY_NODE_IDS[3]]) }),
  Object.freeze({ stage: 4, mode: "SERIAL", nodeIds: Object.freeze([OWNER_POLICY_NODE_IDS[4]]) }),
  Object.freeze({ stage: 5, mode: "SERIAL", nodeIds: Object.freeze([OWNER_POLICY_NODE_IDS[5]]) }),
  Object.freeze({ stage: 6, mode: "SERIAL", nodeIds: Object.freeze([OWNER_POLICY_NODE_IDS[6]]) }),
]);

const EXPECTED_INVARIANTS = Object.freeze({
  v2DefaultDisposition: "KEEP",
  v2FeatureCutsPermitted: false,
  dailyLawWeakeningPermitted: false,
  runtimeMutationPermitted: false,
  secretsPermitted: false,
  ownerChoicesAreExternalProof: false,
  ownerAcceptanceReferenceIsExternalProof: false,
  graphCompletionPermitted: false,
});

const EXPECTED_EVIDENCE_BOUNDARY = Object.freeze({
  acceptsExternalEvidence: false,
  acceptsEngineeringEvidence: false,
  selfAttestationIsExternalProof: false,
  evidenceVerificationOutOfScope: true,
});

const EXPECTED_ASSURANCE = Object.freeze({
  chainTruthVerified: false,
  binaryEvidenceVerified: false,
  genesisConservationVerified: false,
  ceremonyFundingVerified: false,
  ownerAcceptanceVerified: false,
  devnetAuthorized: false,
  devnetRehearsalComplete: false,
  activationReady: false,
  releaseAuthorized: false,
  mainnetExecutionAuthorized: false,
  mainnetStatus: "HOLD",
});

const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const ORIGINAL_SPL_TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const U64_MAX = 18446744073709551615n;
const COMMUNITY_TOTAL_BASE_UNITS = 500000000000000000n;
const COST_CEILING_LAMPORTS = 3000000000n;
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_INDEX = new Map([...BASE58_ALPHABET].map((character, index) => [character, BigInt(index)]));
const SHA256 = /^[0-9a-f]{64}$/u;
const CANONICAL_DECIMAL = /^(?:0|[1-9][0-9]*)$/u;
const RFC3339_UTC = /^(?:[0-9]{4})-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]Z$/u;
const ED25519_SIGNATURE_BASE64 = /^(?:[A-Za-z0-9+/]{86}==)$/u;
const SECRET_MATERIAL = /-----BEGIN [^-\r\n]*PRIVATE KEY-----|(?:mnemonic|seed phrase|private key|secret key)\s*[:=]/iu;

const TEST_FIXTURE_IDENTITIES = new Set([
  "29dv8e1WcjL4w6a7HDaHbUfXrF12yiJiVcKQ1qgeT3rF",
  "2xfTrFbdiJtncBaCWoVK5yvgn9XT4UYZCWKGiQDqR3ij",
  "3uXbrU7mzV3xZT5Jcz4BAEjNCNUGVNA32DeTXirDsiEd",
  "4zEL9HZwTFoanu5RbmGspF5a6uqVGP99xkJxToZoq3Pw",
]);

const FORBIDDEN_PRODUCTION_IDENTITIES = new Map([
  ["62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj", "retained V2 program ID"],
  ["6c725SoXTRThCVgEFrG6q2f3GKLR5m3A7dv7Gf11hNrq", "disposable local Daily Law program ID"],
  ["GLb6VMiKEhRRfYnD1p3a3iCAR3kgtRr8qdHxEHAzbdDU", "disposable stake-ingress economy fixture ID"],
  ["DAQCmCpqSgTn7J2MWmiPNZvJwasEESabaSy7VR4qUy4F", "disposable stake-ingress hook fixture ID"],
  ["11111111111111111111111111111111", "System Program ID"],
  [ORIGINAL_SPL_TOKEN_PROGRAM_ID, "Original SPL Token Program ID"],
  [TOKEN_2022_PROGRAM_ID, "Token-2022 program ID"],
  ["BPFLoaderUpgradeab1e11111111111111111111111", "upgradeable loader ID"],
]);

const FACTIONS = Object.freeze([
  Object.freeze({ id: "radiance", displayLabel: "Radiance" }),
  Object.freeze({ id: "ellie", displayLabel: "Ellie" }),
  Object.freeze({ id: "alia", displayLabel: "Alia" }),
  Object.freeze({ id: "ece", displayLabel: "Ece" }),
  Object.freeze({ id: "boss", displayLabel: "the boss" }),
]);

const SEED_ROLES = Object.freeze([
  "lawState", "extraAccountMetas", "economyConfig", "vaultAuthority", "laneState",
  "laneToken", "stakeToken", "stakeIngress", "coreReward", "agency", "agencyOwnerIndex",
  "eligibility", "position", "round", "factionConfig", "factionAllegiance", "factionWeek",
  "factionScore", "factionRewardVault", "factionRewardManifest", "factionFollowerSnapshot",
  "factionClaim",
]);

const ALLOCATIONS = Object.freeze([
  Object.freeze({ lane: "community", totalBaseUnits: "500000000000000000", genesisUnlockedBaseUnits: "500000000000000000", cliffWeek: 0, linearEndWeek: 0 }),
  Object.freeze({ lane: "treasury", totalBaseUnits: "200000000000000000", genesisUnlockedBaseUnits: "50000000000000000", cliffWeek: 52, linearEndWeek: 208 }),
  Object.freeze({ lane: "ecosystem", totalBaseUnits: "150000000000000000", genesisUnlockedBaseUnits: "37500000000000000", cliffWeek: 26, linearEndWeek: 104 }),
  Object.freeze({ lane: "core", totalBaseUnits: "100000000000000000", genesisUnlockedBaseUnits: "0", cliffWeek: 26, linearEndWeek: 104 }),
  Object.freeze({ lane: "liquidity", totalBaseUnits: "50000000000000000", genesisUnlockedBaseUnits: "12500000000000000", cliffWeek: 26, linearEndWeek: 104 }),
]);

const NODE_SPECS = Object.freeze({
  LIVE_ESTATE_CANONICAL_MINT_DECISION: Object.freeze({
    dependencies: Object.freeze([]),
    frozenConstraints: Object.freeze({
      canonicalAssetModel: "SINGLE_HOOKED_TOKEN_2022_MINT",
      originalSplDisposition: "MIGRATION_SOURCE_ONLY_IF_LIVE",
      duplicateCanonicalSupplyPermitted: false,
    }),
    ownerChoiceKeys: Object.freeze(["liveEstateAssertion", "candidateMint", "candidateTokenProgramId", "canonicalMintDecision", "duplicateSupplyRetirementPolicy"]),
    external: Object.freeze(["INDEPENDENT_LIVE_ESTATE_INVENTORY", "CANDIDATE_MINT_CHAIN_STATE_AND_AUTHORITY_SNAPSHOT", "CANONICAL_SUPPLY_RECONCILIATION"]),
    engineering: Object.freeze(["TOKEN_PROGRAM_AND_EXTENSION_COMPATIBILITY_REPORT", "MIGRATION_OR_NEW_MINT_REHEARSAL"]),
  }),
  CORE_CUSTODY_POLICY_ADAPTER: Object.freeze({
    dependencies: Object.freeze(["LIVE_ESTATE_CANONICAL_MINT_DECISION"]),
    frozenConstraints: Object.freeze({
      liveSupplyDefinition: "CANONICAL_TOKEN_2022_MINT_SUPPLY_AFTER_PRIOR_BURNS",
      custodyScope: "PROGRAM_ORIGINATED_CORE_PRINCIPAL_AND_REWARDS_ONLY",
      burnFormula: "CEIL_MAX_ZERO_10C_MINUS_S_OVER_9",
      delegatePermitted: false,
      releaseOrdering: "CURRENT_OPEN_DAILY_LAW_AND_SAME_DAY_RECONCILIATION_ATOMICALLY_REQUIRED",
    }),
    ownerChoiceKeys: Object.freeze(["acceptFrozenScope", "releasePolicy"]),
    external: Object.freeze(["INDEPENDENT_CUSTODY_AND_RELEASE_POLICY_ACCEPTANCE", "CORE_BENEFICIARY_PUBLIC_KEY_CONTROL_ATTESTATION"]),
    engineering: Object.freeze(["NATIVE_CORE_CUSTODY_ADAPTER_AND_CPI_EVIDENCE", "BURN_STALE_DAY_DEPOSIT_RACE_AND_LOCKDOWN_REHEARSAL"]),
  }),
  FACTION_ECONOMICS_FUNDING: Object.freeze({
    dependencies: Object.freeze(["LIVE_ESTATE_CANONICAL_MINT_DECISION"]),
    frozenConstraints: Object.freeze({
      factions: FACTIONS,
      leadersHaveProtocolAuthority: false,
      allegianceCooldownSeconds: 86400,
      allWritesRequireCurrentDailyLaw: true,
      rewardPriority: "AFTER_STANDARD_AND_X_BEFORE_CORE",
      debtLeapfrogOrPartialFundingPermitted: false,
    }),
    ownerChoiceKeys: Object.freeze(["scoringPolicySha256", "sybilPolicy", "weeklyEpochAnchorUnixSeconds", "tieRule", "communityCarveOutBaseUnits", "weeklyEmissionBaseUnits", "fundingHorizonWeeks", "unusedBalanceDestination", "followerSnapshotPolicySha256", "prizePolicySha256", "nftPrizePolicy", "claimExpirySeconds"]),
    external: Object.freeze(["AUTHENTICATED_SCORING_AND_FOLLOWER_DATA_PROVIDERS", "INDEPENDENT_SYBIL_AND_PRIZE_POLICY_REVIEW", "ACCOUNTABLE_COMMUNITY_CARVE_OUT_FUNDING_SOURCE"]),
    engineering: Object.freeze(["NATIVE_FACTION_CODEC_AND_WRITE_HANDLERS", "SOLVENCY_CONSERVATION_TIE_REPLAY_AND_LOCKDOWN_REHEARSAL"]),
  }),
  CONFIG_GENESIS_PHASE_CODEC: Object.freeze({
    dependencies: Object.freeze(["CORE_CUSTODY_POLICY_ADAPTER", "FACTION_ECONOMICS_FUNDING"]),
    frozenConstraints: Object.freeze({
      phaseOrder: Object.freeze(["UNINITIALIZED", "GENESIS_STAGING", "ACTIVE"]),
      stagingAllowedWrites: Object.freeze(["CREATE_CANONICAL_ACCOUNT", "FUND_CANONICAL_VAULT"]),
      stagingForbiddenWrites: Object.freeze(["RELEASE", "REWARD", "FACTION", "POSITION", "ELIGIBILITY", "RESERVATION", "WITHDRAWAL", "CLAIM"]),
      publicEconomicWritesBeforeActivationPermitted: false,
      activationTransition: "ONE_WAY_ATOMIC_AND_DISABLING_STAGING_WRITES",
    }),
    ownerChoiceKeys: Object.freeze(["acceptExactBootstrapPolicy", "canonicalAccountSetSha256", "bootstrapReplayPolicy", "preActivationCoreCapPolicy"]),
    external: Object.freeze(["INDEPENDENT_BOOTSTRAP_AND_ACTIVATION_POLICY_ACCEPTANCE"]),
    engineering: Object.freeze(["CONFIG_AND_GENESIS_PHASE_CODEC_BYTES", "PREACTIVATION_REJECTION_REENTRY_ROLLBACK_AND_ATOMIC_ACTIVATION_TESTS"]),
  }),
  GENESIS_ALLOCATIONS_CONSERVATION: Object.freeze({
    dependencies: Object.freeze(["CONFIG_GENESIS_PHASE_CODEC"]),
    frozenConstraints: Object.freeze({
      fixedSupplyBaseUnits: "1000000000000000000",
      allocations: ALLOCATIONS,
      rewardLaneOrder: Object.freeze(["treasury", "ecosystem", "liquidity"]),
    }),
    ownerChoiceKeys: Object.freeze(["communityOwner", "treasuryBeneficiary", "ecosystemBeneficiary", "coreBeneficiary", "liquidityBeneficiary", "factionCarveOutBaseUnits", "coreDestinationPolicy", "programVaultDestinationPolicy"]),
    external: Object.freeze(["BENEFICIARY_PUBLIC_KEY_CONTROL_ATTESTATIONS", "INDEPENDENT_GENESIS_MANIFEST_ACCEPTANCE"]),
    engineering: Object.freeze(["EXACT_ALLOCATION_AND_VESTING_VECTORS", "GENESIS_CONSERVATION_AND_CANONICAL_DESTINATION_PROOF"]),
  }),
  PRODUCTION_IDENTITY_INPUT_FREEZE: Object.freeze({
    dependencies: Object.freeze(["GENESIS_ALLOCATIONS_CONSERVATION"]),
    frozenConstraints: Object.freeze({
      lawDomainSeparator: "IAT_B3_SOLANA_DAILY_LAW_V1",
      canonicalClusterScope: "MAINNET_BETA_ONLY",
      seedRoles: SEED_ROLES,
      tokenProgramId: TOKEN_2022_PROGRAM_ID,
      decimals: 9,
      fixedSupplyBaseUnits: "1000000000000000000",
      extensionsOrdered: Object.freeze(["ConfidentialTransferMint", "TransferHook"]),
      additionalExtensionsPermitted: false,
      terminalMintFreezeHookAndConfidentialAuthoritiesNull: true,
      auditorPermanentDelegateAndMintCloseAbsent: true,
    }),
    ownerChoiceKeys: Object.freeze(["lawProgramId", "economyProgramId", "canonicalMint", "clusterIdentityPolicy", "entropyLagSlots", "metadataPolicy", "acceptCanonicalSeedTable"]),
    external: Object.freeze(["INDEPENDENT_MAINNET_GENESIS_HASH_OBSERVATIONS", "PUBLIC_IDENTITY_GENERATION_AND_OWNER_ACCEPTANCE"]),
    engineering: Object.freeze(["REVIEWED_BINARY_HASH_TO_PROGRAM_ID_BINDINGS", "PDA_DERIVATION_EXTENSION_AND_NULL_AUTHORITY_EVIDENCE"]),
  }),
  B3_COST_CEREMONY_FUNDING: Object.freeze({
    dependencies: Object.freeze(["PRODUCTION_IDENTITY_INPUT_FREEZE"]),
    frozenConstraints: Object.freeze({
      aggregateFreshPayerPeakCeilingLamports: "3000000000",
      featureCutsPermittedToMeetCeiling: false,
      costCategories: Object.freeze(["PROGRAM_DEPLOYMENT", "PROGRAM_DATA_RENT", "MINT_AND_EXTENSION_STATE", "GENESIS_ACCOUNTS", "TRANSACTION_FEES"]),
    }),
    ownerChoiceKeys: Object.freeze(["payerPublicKey", "fundingSourcePolicySha256", "ceremonyFloorLamports", "overCeilingDisposition"]),
    external: Object.freeze(["ACCOUNTABLE_NON_SECRET_FUNDING_SOURCE_APPROVAL", "INDEPENDENT_PAYER_BALANCE_OBSERVATION"]),
    engineering: Object.freeze(["EXACT_FRESH_PAYER_COST_MEASUREMENT", "FEE_RENT_BUFFER_AND_RECOVERY_RECONCILIATION"]),
  }),
});

function equalArray(left, right) {
  return Array.isArray(left)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasLoneSurrogate(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) return true;
  }
  return false;
}

function canonicalJsonTree(value, path, violations, ancestors = new Set(), observed = new Set()) {
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "string") {
    if (hasLoneSurrogate(value)) {
      violations.push(`${path}: lone Unicode surrogate is forbidden`);
      return false;
    }
    return true;
  }
  if (typeof value === "number") {
    const valid = Number.isSafeInteger(value) && !Object.is(value, -0);
    if (!valid) violations.push(`${path}: expected a finite safe JSON integer other than negative zero`);
    return valid;
  }
  if (typeof value !== "object") {
    violations.push(`${path}: expected canonical JSON data`);
    return false;
  }
  if (ancestors.has(value)) {
    violations.push(`${path}: contains a cycle`);
    return false;
  }
  if (observed.has(value)) {
    violations.push(`${path}: shared object aliases are forbidden`);
    return false;
  }
  ancestors.add(value);
  observed.add(value);
  let valid = true;
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) {
        violations.push(`${path}: expected the canonical Array prototype`);
        valid = false;
      }
      const expectedKeys = [...Array.from({ length: value.length }, (_, index) => String(index)), "length"];
      const actualKeys = Reflect.ownKeys(value);
      if (!equalArray(actualKeys, expectedKeys)) {
        violations.push(`${path}: expected a dense undecorated JSON array`);
        valid = false;
      }
      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
      if (!lengthDescriptor
        || !("value" in lengthDescriptor)
        || lengthDescriptor.value !== value.length
        || lengthDescriptor.enumerable !== false
        || lengthDescriptor.configurable !== false) {
        violations.push(`${path}.length: expected the canonical array length data property`);
        valid = false;
      }
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor
          || !("value" in descriptor)
          || descriptor.enumerable !== true) {
          violations.push(`${path}[${index}]: expected a canonical enumerable own data property`);
          valid = false;
        } else {
          valid = canonicalJsonTree(descriptor.value, `${path}[${index}]`, violations, ancestors, observed) && valid;
        }
      }
    } else {
      if (Object.getPrototypeOf(value) !== Object.prototype) {
        violations.push(`${path}: expected the canonical Object prototype`);
        valid = false;
      }
      for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== "string") {
          violations.push(`${path}: symbol properties are forbidden`);
          valid = false;
          continue;
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor
          || !("value" in descriptor)
          || descriptor.enumerable !== true) {
          violations.push(`${path}.${key}: expected a canonical enumerable own data property`);
          valid = false;
        } else {
          valid = canonicalJsonTree(descriptor.value, `${path}.${key}`, violations, ancestors, observed) && valid;
        }
      }
    }
  } catch (error) {
    violations.push(`${path}: object introspection failed (${error.message})`);
    valid = false;
  }
  ancestors.delete(value);
  return valid;
}

function exactKeys(value, expected, path, violations) {
  if (!isObject(value)) {
    violations.push(`${path}: expected object`);
    return false;
  }
  const keys = Object.keys(value);
  if (!equalArray(keys, expected)) {
    violations.push(`${path}: keys must be exactly ${expected.join(", ")}`);
    return false;
  }
  return true;
}

function exactJson(value, expected) {
  return JSON.stringify(value) === JSON.stringify(expected);
}

function validateExactObject(value, expected, path, violations) {
  const keys = Object.keys(expected);
  if (!exactKeys(value, keys, path, violations)) return false;
  if (!exactJson(value, expected)) {
    violations.push(`${path}: canonical values or ordering drifted`);
    return false;
  }
  return true;
}

function validateNullableEnum(value, allowed, path, violations) {
  if (value === null) return false;
  if (!allowed.includes(value)) {
    violations.push(`${path}: expected one of ${allowed.join(", ")} or null`);
    return false;
  }
  return true;
}

function validateNullableTrue(value, path, violations) {
  if (value === null) return false;
  if (value !== true) {
    violations.push(`${path}: only explicit true or null is permitted`);
    return false;
  }
  return true;
}

function validateNullableSha256(value, path, violations) {
  if (value === null) return false;
  if (typeof value !== "string" || !SHA256.test(value)) {
    violations.push(`${path}: expected a lowercase SHA-256 digest or null`);
    return false;
  }
  return true;
}

function parseCanonicalDecimal(value, path, violations, { positive = false } = {}) {
  if (value === null) return null;
  if (typeof value !== "string" || !CANONICAL_DECIMAL.test(value)) {
    violations.push(`${path}: expected a canonical unsigned decimal string or null`);
    return null;
  }
  const parsed = BigInt(value);
  if (parsed > U64_MAX) {
    violations.push(`${path}: amount exceeds the Solana u64 range`);
    return null;
  }
  if (positive && parsed === 0n) {
    violations.push(`${path}: expected a positive decimal amount`);
    return null;
  }
  return parsed;
}

function decodeBase58(value) {
  if (typeof value !== "string" || value.length < 32 || value.length > 44) return null;
  let magnitude = 0n;
  for (const character of value) {
    const digit = BASE58_INDEX.get(character);
    if (digit === undefined) return null;
    magnitude = (magnitude * 58n) + digit;
  }
  const bytes = [];
  while (magnitude > 0n) {
    bytes.push(Number(magnitude & 0xffn));
    magnitude >>= 8n;
  }
  bytes.reverse();
  let leadingZeroes = 0;
  while (leadingZeroes < value.length && value[leadingZeroes] === "1") leadingZeroes += 1;
  return Uint8Array.from([...new Array(leadingZeroes).fill(0), ...bytes]);
}

export function isCanonicalOwnerPolicyPublicKey(value) {
  return decodeBase58(value)?.length === 32;
}

function validateNullablePublicKey(value, path, violations, { productionIdentity = false } = {}) {
  if (value === null) return false;
  if (!isCanonicalOwnerPolicyPublicKey(value)) {
    violations.push(`${path}: expected a canonical Base58 value decoding to 32 bytes or null`);
    return false;
  }
  if (productionIdentity) {
    const forbidden = FORBIDDEN_PRODUCTION_IDENTITIES.get(value);
    if (forbidden) violations.push(`${path}: ${forbidden} cannot be a B3 production identity`);
    if (TEST_FIXTURE_IDENTITIES.has(value)) violations.push(`${path}: test-only identity cannot be a B3 production identity`);
    return !forbidden && !TEST_FIXTURE_IDENTITIES.has(value);
  }
  return true;
}

function scanSecretMaterial(value, path, violations) {
  if (typeof value === "string") {
    if (SECRET_MATERIAL.test(value)) violations.push(`${path}: secret or private-key material is forbidden`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanSecretMaterial(item, `${path}[${index}]`, violations));
  } else if (isObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (/^(?:mnemonic|password|privateKey|secret|secretKey|seedPhrase)$/iu.test(key)) {
        violations.push(`${path}.${key}: secret-bearing fields are forbidden`);
      }
      scanSecretMaterial(item, `${path}.${key}`, violations);
    }
  }
}

function validateLiveChoices(choices, violations) {
  const path = "nodes.LIVE_ESTATE_CANONICAL_MINT_DECISION.ownerChoices";
  if (!exactKeys(choices, NODE_SPECS.LIVE_ESTATE_CANONICAL_MINT_DECISION.ownerChoiceKeys, path, violations)) return false;
  const assertionSet = validateNullableEnum(choices.liveEstateAssertion, ["NO_LIVE_ESTATE_MINT", "LIVE_ESTATE_MINT_IDENTIFIED"], `${path}.liveEstateAssertion`, violations);
  const candidateSet = validateNullablePublicKey(choices.candidateMint, `${path}.candidateMint`, violations);
  const programSet = validateNullableEnum(choices.candidateTokenProgramId, [ORIGINAL_SPL_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID], `${path}.candidateTokenProgramId`, violations);
  const decisionSet = validateNullableEnum(choices.canonicalMintDecision, ["NEW_TOKEN_2022_FROM_INCEPTION", "MIGRATE_ORIGINAL_SPL_TO_TOKEN_2022", "ADOPT_EXISTING_COMPATIBLE_TOKEN_2022", "REPLACE_LIVE_MINT_WITH_NEW_TOKEN_2022"], `${path}.canonicalMintDecision`, violations);
  const retirementSet = validateNullableEnum(choices.duplicateSupplyRetirementPolicy, ["NOT_APPLICABLE", "SUPPLY_RECONCILED_SOURCE_NONCANONICAL"], `${path}.duplicateSupplyRetirementPolicy`, violations);
  if (choices.liveEstateAssertion === "NO_LIVE_ESTATE_MINT") {
    if (choices.candidateMint !== null || choices.candidateTokenProgramId !== null) {
      violations.push(`${path}: NO_LIVE_ESTATE_MINT requires null candidate mint and token program`);
    }
    if (choices.canonicalMintDecision !== null && choices.canonicalMintDecision !== "NEW_TOKEN_2022_FROM_INCEPTION") {
      violations.push(`${path}.canonicalMintDecision: no live Estate requires NEW_TOKEN_2022_FROM_INCEPTION`);
    }
    if (choices.duplicateSupplyRetirementPolicy !== null && choices.duplicateSupplyRetirementPolicy !== "NOT_APPLICABLE") {
      violations.push(`${path}.duplicateSupplyRetirementPolicy: no live Estate requires NOT_APPLICABLE`);
    }
    return assertionSet && decisionSet && retirementSet;
  }
  if (choices.liveEstateAssertion === "LIVE_ESTATE_MINT_IDENTIFIED") {
    if (choices.canonicalMintDecision === "NEW_TOKEN_2022_FROM_INCEPTION") {
      violations.push(`${path}.canonicalMintDecision: a live Estate cannot use the no-estate inception decision`);
    }
    if (choices.canonicalMintDecision === "MIGRATE_ORIGINAL_SPL_TO_TOKEN_2022" && choices.candidateTokenProgramId !== null && choices.candidateTokenProgramId !== ORIGINAL_SPL_TOKEN_PROGRAM_ID) {
      violations.push(`${path}.candidateTokenProgramId: migration requires the Original SPL Token program`);
    }
    if (choices.canonicalMintDecision === "ADOPT_EXISTING_COMPATIBLE_TOKEN_2022" && choices.candidateTokenProgramId !== null && choices.candidateTokenProgramId !== TOKEN_2022_PROGRAM_ID) {
      violations.push(`${path}.candidateTokenProgramId: adoption requires the Token-2022 program`);
    }
    if (["MIGRATE_ORIGINAL_SPL_TO_TOKEN_2022", "REPLACE_LIVE_MINT_WITH_NEW_TOKEN_2022"].includes(choices.canonicalMintDecision)
      && choices.duplicateSupplyRetirementPolicy !== null
      && choices.duplicateSupplyRetirementPolicy !== "SUPPLY_RECONCILED_SOURCE_NONCANONICAL") {
      violations.push(`${path}.duplicateSupplyRetirementPolicy: migration or replacement requires source supply reconciliation`);
    }
    if (choices.canonicalMintDecision === "ADOPT_EXISTING_COMPATIBLE_TOKEN_2022"
      && choices.duplicateSupplyRetirementPolicy !== null
      && choices.duplicateSupplyRetirementPolicy !== "NOT_APPLICABLE") {
      violations.push(`${path}.duplicateSupplyRetirementPolicy: adoption requires NOT_APPLICABLE`);
    }
    return assertionSet && candidateSet && programSet && decisionSet && retirementSet;
  }
  return false;
}

function validateCoreChoices(choices, violations) {
  const path = "nodes.CORE_CUSTODY_POLICY_ADAPTER.ownerChoices";
  if (!exactKeys(choices, NODE_SPECS.CORE_CUSTODY_POLICY_ADAPTER.ownerChoiceKeys, path, violations)) return false;
  const accepted = validateNullableTrue(choices.acceptFrozenScope, `${path}.acceptFrozenScope`, violations);
  if (choices.releasePolicy === null) return false;
  const releaseKeys = ["authorizationModel", "fixedBeneficiary", "currentOpenDailyLawRequired", "sameDayReconciliationRequired", "ordinaryWalletEndsAttribution", "discretionaryBypassPermitted"];
  if (!exactKeys(choices.releasePolicy, releaseKeys, `${path}.releasePolicy`, violations)) return false;
  let valid = true;
  if (choices.releasePolicy.authorizationModel !== "PROGRAM_ENFORCED_V2_SCHEDULE_TO_FIXED_BENEFICIARY") {
    violations.push(`${path}.releasePolicy.authorizationModel: unsupported or discretionary release model`);
    valid = false;
  }
  if (choices.releasePolicy.fixedBeneficiary === null) {
    violations.push(`${path}.releasePolicy.fixedBeneficiary: a non-null release policy requires a public key`);
    valid = false;
  } else {
    valid = validateNullablePublicKey(choices.releasePolicy.fixedBeneficiary, `${path}.releasePolicy.fixedBeneficiary`, violations) && valid;
  }
  for (const key of ["currentOpenDailyLawRequired", "sameDayReconciliationRequired", "ordinaryWalletEndsAttribution"]) {
    if (choices.releasePolicy[key] !== true) {
      violations.push(`${path}.releasePolicy.${key}: must be true`);
      valid = false;
    }
  }
  if (choices.releasePolicy.discretionaryBypassPermitted !== false) {
    violations.push(`${path}.releasePolicy.discretionaryBypassPermitted: must be false`);
    valid = false;
  }
  return accepted && valid;
}

function validateFactionChoices(choices, violations) {
  const path = "nodes.FACTION_ECONOMICS_FUNDING.ownerChoices";
  if (!exactKeys(choices, NODE_SPECS.FACTION_ECONOMICS_FUNDING.ownerChoiceKeys, path, violations)) return false;
  const values = [
    validateNullableSha256(choices.scoringPolicySha256, `${path}.scoringPolicySha256`, violations),
    validateNullableEnum(choices.sybilPolicy, ["PRESERVED_WALLET_AND_IMMUTABLE_X_BINDING", "AUDITED_ONCHAIN_IDENTITY_COMMITMENT"], `${path}.sybilPolicy`, violations),
    validateNullableEnum(choices.tieRule, ["ONE_ROLL_NO_REROLL_EXACT_UNIFORM"], `${path}.tieRule`, violations),
    validateNullablePublicKey(choices.unusedBalanceDestination, `${path}.unusedBalanceDestination`, violations),
    validateNullableSha256(choices.followerSnapshotPolicySha256, `${path}.followerSnapshotPolicySha256`, violations),
    validateNullableSha256(choices.prizePolicySha256, `${path}.prizePolicySha256`, violations),
    validateNullableEnum(choices.nftPrizePolicy, ["NFT_PRIZES_DISABLED", "NFT_PRIZES_DEFINED_IN_PRIZE_POLICY"], `${path}.nftPrizePolicy`, violations),
  ];
  for (const [key, minimum] of [["weeklyEpochAnchorUnixSeconds", 0], ["fundingHorizonWeeks", 1], ["claimExpirySeconds", 1]]) {
    const value = choices[key];
    if (value === null) values.push(false);
    else if (!Number.isSafeInteger(value) || value < minimum) {
      violations.push(`${path}.${key}: expected a safe integer >= ${minimum} or null`);
      values.push(false);
    } else values.push(true);
  }
  const carveOut = parseCanonicalDecimal(choices.communityCarveOutBaseUnits, `${path}.communityCarveOutBaseUnits`, violations, { positive: true });
  const emission = parseCanonicalDecimal(choices.weeklyEmissionBaseUnits, `${path}.weeklyEmissionBaseUnits`, violations, { positive: true });
  values.push(carveOut !== null, emission !== null);
  if (carveOut !== null && carveOut >= COMMUNITY_TOTAL_BASE_UNITS) {
    violations.push(`${path}.communityCarveOutBaseUnits: must be smaller than the preserved community lane`);
  }
  if (carveOut !== null && emission !== null && Number.isSafeInteger(choices.fundingHorizonWeeks)) {
    if ((emission * BigInt(choices.fundingHorizonWeeks)) > carveOut) {
      violations.push(`${path}: weekly emission multiplied by funding horizon exceeds the fixed carve-out`);
    }
  }
  return values.every(Boolean) && carveOut < COMMUNITY_TOTAL_BASE_UNITS
    && (emission * BigInt(choices.fundingHorizonWeeks)) <= carveOut;
}

function validateConfigChoices(choices, violations) {
  const path = "nodes.CONFIG_GENESIS_PHASE_CODEC.ownerChoices";
  if (!exactKeys(choices, NODE_SPECS.CONFIG_GENESIS_PHASE_CODEC.ownerChoiceKeys, path, violations)) return false;
  return [
    validateNullableTrue(choices.acceptExactBootstrapPolicy, `${path}.acceptExactBootstrapPolicy`, violations),
    validateNullableSha256(choices.canonicalAccountSetSha256, `${path}.canonicalAccountSetSha256`, violations),
    validateNullableEnum(choices.bootstrapReplayPolicy, ["REJECT_REENTRY_AND_ROLLBACK"], `${path}.bootstrapReplayPolicy`, violations),
    validateNullableEnum(choices.preActivationCoreCapPolicy, ["VACUOUS_ONLY_UNTIL_ATOMIC_ACTIVATION"], `${path}.preActivationCoreCapPolicy`, violations),
  ].every(Boolean);
}

function validateGenesisChoices(choices, factionChoices, coreChoices, violations) {
  const path = "nodes.GENESIS_ALLOCATIONS_CONSERVATION.ownerChoices";
  if (!exactKeys(choices, NODE_SPECS.GENESIS_ALLOCATIONS_CONSERVATION.ownerChoiceKeys, path, violations)) return false;
  const addressKeys = ["communityOwner", "treasuryBeneficiary", "ecosystemBeneficiary", "coreBeneficiary", "liquidityBeneficiary"];
  const addressesComplete = addressKeys.map((key) => validateNullablePublicKey(choices[key], `${path}.${key}`, violations)).every(Boolean);
  const populatedAddresses = addressKeys.map((key) => choices[key]).filter((value) => value !== null);
  if (new Set(populatedAddresses).size !== populatedAddresses.length) {
    violations.push(`${path}: the five owner/beneficiary public keys must be distinct`);
  }
  const carveOut = parseCanonicalDecimal(choices.factionCarveOutBaseUnits, `${path}.factionCarveOutBaseUnits`, violations, { positive: true });
  if (carveOut !== null && carveOut >= COMMUNITY_TOTAL_BASE_UNITS) {
    violations.push(`${path}.factionCarveOutBaseUnits: must be smaller than the community allocation`);
  }
  if (carveOut !== null && factionChoices.communityCarveOutBaseUnits !== null
    && choices.factionCarveOutBaseUnits !== factionChoices.communityCarveOutBaseUnits) {
    violations.push(`${path}.factionCarveOutBaseUnits: must equal the frozen faction carve-out`);
  }
  if (choices.coreBeneficiary !== null
    && coreChoices.releasePolicy !== null
    && choices.coreBeneficiary !== coreChoices.releasePolicy.fixedBeneficiary) {
    violations.push(`${path}.coreBeneficiary: must equal the fixed core-custody release beneficiary`);
  }
  const corePolicy = validateNullableEnum(choices.coreDestinationPolicy, ["CANONICAL_CORE_CUSTODY"], `${path}.coreDestinationPolicy`, violations);
  const vaultPolicy = validateNullableEnum(choices.programVaultDestinationPolicy, ["DERIVE_FROM_FROZEN_ECONOMY_ID_AND_MINT"], `${path}.programVaultDestinationPolicy`, violations);
  return addressesComplete
    && new Set(populatedAddresses).size === addressKeys.length
    && carveOut !== null
    && carveOut < COMMUNITY_TOTAL_BASE_UNITS
    && factionChoices.communityCarveOutBaseUnits === choices.factionCarveOutBaseUnits
    && coreChoices.releasePolicy !== null
    && coreChoices.releasePolicy.fixedBeneficiary === choices.coreBeneficiary
    && corePolicy
    && vaultPolicy;
}

function validateIdentityChoices(choices, liveChoices, violations) {
  const path = "nodes.PRODUCTION_IDENTITY_INPUT_FREEZE.ownerChoices";
  if (!exactKeys(choices, NODE_SPECS.PRODUCTION_IDENTITY_INPUT_FREEZE.ownerChoiceKeys, path, violations)) return false;
  const identityKeys = ["lawProgramId", "economyProgramId", "canonicalMint"];
  const identitiesComplete = identityKeys.map((key) => validateNullablePublicKey(choices[key], `${path}.${key}`, violations, { productionIdentity: true })).every(Boolean);
  const populated = identityKeys.map((key) => choices[key]).filter((value) => value !== null);
  if (new Set(populated).size !== populated.length) violations.push(`${path}: law, economy, and mint identities must be distinct`);
  const cluster = validateNullableEnum(choices.clusterIdentityPolicy, ["SAME_LAW_ECONOMY_AND_MINT_IDS_ACROSS_CLUSTERS", "SAME_PROGRAM_IDS_DISTINCT_MINT_PER_CLUSTER", "DISTINCT_PROGRAM_AND_MINT_IDS_PER_CLUSTER"], `${path}.clusterIdentityPolicy`, violations);
  let entropy = false;
  if (choices.entropyLagSlots === null) entropy = false;
  else if (!Number.isSafeInteger(choices.entropyLagSlots) || choices.entropyLagSlots < 1 || choices.entropyLagSlots > 512) {
    violations.push(`${path}.entropyLagSlots: expected an integer from 1 through 512 or null`);
  } else entropy = true;
  const metadata = validateNullableEnum(choices.metadataPolicy, ["NO_MINT_METADATA_EXTENSION_IMMUTABLE_EXTERNAL_RECORD"], `${path}.metadataPolicy`, violations);
  const seeds = validateNullableTrue(choices.acceptCanonicalSeedTable, `${path}.acceptCanonicalSeedTable`, violations);
  if (liveChoices.canonicalMintDecision === "ADOPT_EXISTING_COMPATIBLE_TOKEN_2022"
    && choices.canonicalMint !== null
    && liveChoices.candidateMint !== null
    && choices.canonicalMint !== liveChoices.candidateMint) {
    violations.push(`${path}.canonicalMint: adoption must use the identified live Estate mint`);
  }
  if (["MIGRATE_ORIGINAL_SPL_TO_TOKEN_2022", "REPLACE_LIVE_MINT_WITH_NEW_TOKEN_2022"].includes(liveChoices.canonicalMintDecision)
    && choices.canonicalMint !== null
    && liveChoices.candidateMint !== null
    && choices.canonicalMint === liveChoices.candidateMint) {
    violations.push(`${path}.canonicalMint: migration or replacement requires a distinct Token-2022 mint`);
  }
  return identitiesComplete && new Set(populated).size === identityKeys.length && cluster && entropy && metadata && seeds;
}

function validateCostChoices(choices, violations) {
  const path = "nodes.B3_COST_CEREMONY_FUNDING.ownerChoices";
  if (!exactKeys(choices, NODE_SPECS.B3_COST_CEREMONY_FUNDING.ownerChoiceKeys, path, violations)) return false;
  const payer = validateNullablePublicKey(choices.payerPublicKey, `${path}.payerPublicKey`, violations);
  const policy = validateNullableSha256(choices.fundingSourcePolicySha256, `${path}.fundingSourcePolicySha256`, violations);
  const floor = parseCanonicalDecimal(choices.ceremonyFloorLamports, `${path}.ceremonyFloorLamports`, violations, { positive: true });
  if (floor !== null && floor < COST_CEILING_LAMPORTS) {
    violations.push(`${path}.ceremonyFloorLamports: must cover at least the frozen 3 SOL peak ceiling`);
  }
  const disposition = validateNullableEnum(choices.overCeilingDisposition, ["REQUIRE_NEW_EXACT_OWNER_CEILING_NEVER_CUT_FEATURES"], `${path}.overCeilingDisposition`, violations);
  return payer && policy && floor !== null && floor >= COST_CEILING_LAMPORTS && disposition;
}

function validateOwnerAcceptance(value, violations) {
  if (value === null) return false;
  const path = "ownerAcceptance";
  if (!exactKeys(value, ["decisionArtifactSha256", "signerPublicKey", "detachedSignatureBase64", "signedAtUtc"], path, violations)) return true;
  if (value.decisionArtifactSha256 === null) {
    violations.push(`${path}.decisionArtifactSha256: a present reference requires a public digest`);
  } else validateNullableSha256(value.decisionArtifactSha256, `${path}.decisionArtifactSha256`, violations);
  if (value.signerPublicKey === null) {
    violations.push(`${path}.signerPublicKey: a present reference requires a public signer key`);
  } else validateNullablePublicKey(value.signerPublicKey, `${path}.signerPublicKey`, violations);
  const signatureBytes = typeof value.detachedSignatureBase64 === "string"
    ? Buffer.from(value.detachedSignatureBase64, "base64")
    : null;
  if (typeof value.detachedSignatureBase64 !== "string"
    || !ED25519_SIGNATURE_BASE64.test(value.detachedSignatureBase64)
    || signatureBytes.length !== 64
    || signatureBytes.toString("base64") !== value.detachedSignatureBase64) {
    violations.push(`${path}.detachedSignatureBase64: expected a public 64-byte detached signature encoded as canonical Base64`);
  }
  if (typeof value.signedAtUtc !== "string" || !RFC3339_UTC.test(value.signedAtUtc)
    || Number.isNaN(Date.parse(value.signedAtUtc))
    || new Date(value.signedAtUtc).toISOString().replace(".000Z", "Z") !== value.signedAtUtc) {
    violations.push(`${path}.signedAtUtc: expected a valid whole-second RFC 3339 UTC timestamp`);
  }
  return true;
}

function validateNodeEnvelope(nodes, violations) {
  if (!exactKeys(nodes, OWNER_POLICY_NODE_IDS, "nodes", violations)) return false;
  let valid = true;
  for (const id of OWNER_POLICY_NODE_IDS) {
    const node = nodes[id];
    const path = `nodes.${id}`;
    if (!exactKeys(node, ["dependencies", "frozenConstraints", "ownerChoices", "evidenceRequirements"], path, violations)) {
      valid = false;
      continue;
    }
    const spec = NODE_SPECS[id];
    if (!exactKeys(node.ownerChoices, spec.ownerChoiceKeys, `${path}.ownerChoices`, violations)) valid = false;
    if (!exactJson(node.dependencies, spec.dependencies)) {
      violations.push(`${path}.dependencies: safe decision dependencies drifted`);
      valid = false;
    }
    if (!validateExactObject(node.frozenConstraints, spec.frozenConstraints, `${path}.frozenConstraints`, violations)) valid = false;
    if (!exactKeys(node.evidenceRequirements, ["external", "engineering"], `${path}.evidenceRequirements`, violations)
      || !exactJson(node.evidenceRequirements.external, spec.external)
      || !exactJson(node.evidenceRequirements.engineering, spec.engineering)) {
      violations.push(`${path}.evidenceRequirements: owner choices must remain separate from the exact external and engineering requirement inventories`);
      valid = false;
    }
  }
  return valid;
}

function buildResult({ violations, nodeCompleteness = {}, ownerAcceptanceReferencePresent = false }) {
  const valid = violations.length === 0;
  const eligibleInSafeOrder = {};
  for (const stage of EXPECTED_DECISION_ORDER) {
    for (const id of stage.nodeIds) {
      eligibleInSafeOrder[id] = Boolean(nodeCompleteness[id]
        && NODE_SPECS[id].dependencies.every((dependency) => eligibleInSafeOrder[dependency]));
    }
  }
  const ownerChoicesStructurallyComplete = valid
    && OWNER_POLICY_NODE_IDS.every((id) => eligibleInSafeOrder[id]);
  const blockers = OWNER_POLICY_NODE_IDS
    .filter((id) => !eligibleInSafeOrder[id])
    .map((id) => `${id}: owner choice fields remain incomplete or await an earlier safe-order choice`);
  return {
    valid,
    profile: valid ? "PRODUCTION" : null,
    status: "BLOCKED",
    ownerChoicesStructurallyComplete,
    safeDecisionOrderSatisfied: ownerChoicesStructurallyComplete,
    nodeChoiceState: Object.fromEntries(OWNER_POLICY_NODE_IDS.map((id) => [id, {
      structurallyComplete: valid && Boolean(nodeCompleteness[id]),
      eligibleInSafeOrder: valid && Boolean(eligibleInSafeOrder[id]),
    }])),
    ownerAcceptanceReferencePresent: valid && ownerAcceptanceReferencePresent,
    ownerAcceptanceVerified: false,
    ownerIdentityAuthenticated: false,
    externalEvidenceVerified: false,
    engineeringEvidenceVerified: false,
    chainTruthVerified: false,
    binaryEvidenceVerified: false,
    genesisConservationVerified: false,
    ceremonyFundingVerified: false,
    devnetAuthorized: false,
    devnetRehearsalComplete: false,
    activationReady: false,
    releaseAuthorized: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: OWNER_POLICY_FREEZE_MAINNET_STATUS,
    blockers: Object.freeze(blockers),
    violations: Object.freeze([...violations]),
  };
}

export function validateB3OwnerPolicyFreezeManifest(manifest) {
  const violations = [];
  let canonical = false;
  try {
    canonical = canonicalJsonTree(manifest, "manifest", violations);
  } catch (error) {
    violations.push(`manifest: descriptor-safe traversal failed (${error.message})`);
  }
  if (!canonical) return buildResult({ violations });
  scanSecretMaterial(manifest, "manifest", violations);
  if (!exactKeys(manifest, TOP_LEVEL_KEYS, "manifest", violations)) {
    return buildResult({ violations });
  }
  if (manifest.$schema !== "./iat-b3-owner-policy-freeze.v1.schema.json"
    || manifest.schema !== OWNER_POLICY_FREEZE_SCHEMA
    || manifest.profile !== "PRODUCTION"
    || manifest.status !== "BLOCKED") {
    violations.push("manifest: expected the canonical local schema, PRODUCTION profile, and BLOCKED status");
  }
  validateExactObject(manifest.scope, EXPECTED_SCOPE, "scope", violations);
  if (!exactJson(manifest.decisionOrder, EXPECTED_DECISION_ORDER)) {
    violations.push("decisionOrder: expected the exact six-stage serial/parallel safe decision order");
  }
  validateExactObject(manifest.invariants, EXPECTED_INVARIANTS, "invariants", violations);
  const envelopesValid = validateNodeEnvelope(manifest.nodes, violations);
  validateExactObject(manifest.evidenceBoundary, EXPECTED_EVIDENCE_BOUNDARY, "evidenceBoundary", violations);
  validateExactObject(manifest.assurance, EXPECTED_ASSURANCE, "assurance", violations);
  const ownerAcceptanceReferencePresent = validateOwnerAcceptance(manifest.ownerAcceptance, violations);
  const nodeCompleteness = {};
  if (envelopesValid) {
    const nodes = manifest.nodes;
    nodeCompleteness.LIVE_ESTATE_CANONICAL_MINT_DECISION = validateLiveChoices(nodes.LIVE_ESTATE_CANONICAL_MINT_DECISION.ownerChoices, violations);
    nodeCompleteness.CORE_CUSTODY_POLICY_ADAPTER = validateCoreChoices(nodes.CORE_CUSTODY_POLICY_ADAPTER.ownerChoices, violations);
    nodeCompleteness.FACTION_ECONOMICS_FUNDING = validateFactionChoices(nodes.FACTION_ECONOMICS_FUNDING.ownerChoices, violations);
    nodeCompleteness.CONFIG_GENESIS_PHASE_CODEC = validateConfigChoices(nodes.CONFIG_GENESIS_PHASE_CODEC.ownerChoices, violations);
    nodeCompleteness.GENESIS_ALLOCATIONS_CONSERVATION = validateGenesisChoices(
      nodes.GENESIS_ALLOCATIONS_CONSERVATION.ownerChoices,
      nodes.FACTION_ECONOMICS_FUNDING.ownerChoices,
      nodes.CORE_CUSTODY_POLICY_ADAPTER.ownerChoices,
      violations,
    );
    nodeCompleteness.PRODUCTION_IDENTITY_INPUT_FREEZE = validateIdentityChoices(nodes.PRODUCTION_IDENTITY_INPUT_FREEZE.ownerChoices, nodes.LIVE_ESTATE_CANONICAL_MINT_DECISION.ownerChoices, violations);
    nodeCompleteness.B3_COST_CEREMONY_FUNDING = validateCostChoices(nodes.B3_COST_CEREMONY_FUNDING.ownerChoices, violations);
  }
  return buildResult({ violations, nodeCompleteness, ownerAcceptanceReferencePresent });
}

export function parseB3OwnerPolicyFreezeJson(text, label = "manifest") {
  if (typeof text !== "string") throw new TypeError(`${label}: JSON source must be a string`);
  let index = 0;
  const whitespace = /[\t\n\r ]/u;
  const skipWhitespace = () => {
    while (index < text.length && whitespace.test(text[index])) index += 1;
  };
  const fail = (message) => {
    throw new SyntaxError(`${label}: ${message} at byte ${index}`);
  };
  const parseStringToken = () => {
    if (text[index] !== "\"") fail("expected JSON string");
    const start = index;
    index += 1;
    while (index < text.length) {
      const character = text[index];
      if (character === "\"") {
        index += 1;
        return JSON.parse(text.slice(start, index));
      }
      if (character === "\\") index += 2;
      else {
        if (character < " ") fail("unescaped control character");
        index += 1;
      }
    }
    fail("unterminated JSON string");
  };
  const parseValue = (path) => {
    skipWhitespace();
    if (text[index] === "{") {
      index += 1;
      skipWhitespace();
      const keys = new Set();
      if (text[index] === "}") {
        index += 1;
        return;
      }
      while (index < text.length) {
        skipWhitespace();
        const key = parseStringToken();
        if (keys.has(key)) throw new SyntaxError(`${label}: duplicate JSON member ${path}.${key}`);
        keys.add(key);
        skipWhitespace();
        if (text[index] !== ":") fail("expected colon");
        index += 1;
        parseValue(`${path}.${key}`);
        skipWhitespace();
        if (text[index] === "}") {
          index += 1;
          return;
        }
        if (text[index] !== ",") fail("expected comma or closing brace");
        index += 1;
      }
      fail("unterminated JSON object");
    }
    if (text[index] === "[") {
      index += 1;
      skipWhitespace();
      if (text[index] === "]") {
        index += 1;
        return;
      }
      let item = 0;
      while (index < text.length) {
        parseValue(`${path}[${item}]`);
        item += 1;
        skipWhitespace();
        if (text[index] === "]") {
          index += 1;
          return;
        }
        if (text[index] !== ",") fail("expected comma or closing bracket");
        index += 1;
      }
      fail("unterminated JSON array");
    }
    if (text[index] === "\"") {
      parseStringToken();
      return;
    }
    const start = index;
    while (index < text.length && !/[\t\n\r ,\]}]/u.test(text[index])) index += 1;
    if (start === index) fail("expected JSON value");
    JSON.parse(text.slice(start, index));
  };
  skipWhitespace();
  parseValue("$root");
  skipWhitespace();
  if (index !== text.length) fail("unexpected trailing data");
  return JSON.parse(text);
}

export function loadB3OwnerPolicyFreezeManifest(path = DEFAULT_MANIFEST_PATH) {
  const resolved = resolve(path);
  return parseB3OwnerPolicyFreezeJson(readFileSync(resolved, "utf8"), resolved);
}

function parseCli(argv) {
  const result = { manifestPath: DEFAULT_MANIFEST_PATH, requireOwnerChoicesComplete: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--manifest") {
      if (!argv[index + 1]) throw new Error("--manifest requires a path");
      result.manifestPath = resolve(argv[index + 1]);
      index += 1;
    } else if (argument === "--require-owner-choices-complete") {
      result.requireOwnerChoicesComplete = true;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  return result;
}

function main() {
  let cli;
  let manifest;
  try {
    cli = parseCli(process.argv.slice(2));
    manifest = loadB3OwnerPolicyFreezeManifest(cli.manifestPath);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  const result = validateB3OwnerPolicyFreezeManifest(manifest);
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exitCode = 1;
  else if (cli.requireOwnerChoicesComplete && !result.ownerChoicesStructurallyComplete) process.exitCode = 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
