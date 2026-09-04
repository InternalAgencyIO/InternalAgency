import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

export const IAT_B3_OWNER_INPUT_SCHEMA = "iat-b3-owner-input/v1";
export const IAT_B3_OWNER_INPUT_PROFILE = "PRODUCTION";
export const IAT_B3_OWNER_INPUT_STATUS = "HOLD";
export const IAT_B3_OWNER_CHOICE_FIELD_COUNT = 38;

export const IAT_B3_OWNER_POLICY_SOURCE_BINDING = Object.freeze({
  path: "docs/b3/iat-b3-owner-policy-freeze.v1.json",
  schema: "iat-b3-owner-policy-freeze/v2",
  sha256: "95c508a47f9ccfed8d466851196cf4de0928027bebccc35b5842fb2c77449f06",
  byteLength: 12681,
  status: "BLOCKED",
});

export const IAT_B3_TRANSIT_POLICY_ID = "TREZOR_MODEL_T_CONTROLLED_FULL_SUPPLY_TRANSIT";
export const IAT_B3_TRANSIT_POLICY_REJECTION = "REJECT_ENGINEERING_RECOMMENDATION";
export const IAT_B3_ENTROPY_RISK_ACCEPTANCE =
  "ACCEPT_LAGGED_SLOT_HASH_WITH_FINALIZER_TIMING_INFLUENCE_AND_LIMITED_PROBABILITY_CLAIMS";

const SHA256 = /^[0-9a-f]{64}$/u;
const CANONICAL_DECIMAL = /^(?:0|[1-9][0-9]*)$/u;
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/u;
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_INDEX = new Map([...BASE58_ALPHABET].map((character, index) => [character, index]));
const U64_MAX = 18_446_744_073_709_551_615n;
const COMMUNITY_TOTAL_BASE_UNITS = 500_000_000_000_000_000n;
const COST_CEILING_LAMPORTS = 3_000_000_000n;
const TEST_FIXTURE_PRODUCTION_IDENTITIES = new Set([
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
  ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "Original SPL Token Program ID"],
  ["TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", "Token-2022 program ID"],
  ["BPFLoaderUpgradeab1e11111111111111111111111", "upgradeable loader ID"],
]);

const ARTIFACT_KEYS = Object.freeze([
  "scoringPolicy",
  "followerSnapshotPolicy",
  "prizePolicy",
  "canonicalAccountSet",
  "fundingSourcePolicy",
  "canonicalTransitDestinationManifest",
]);
const AUTHORIZATION_BOOLEAN_KEYS = Object.freeze([
  "canonicalPolicyMutationAuthorized",
  "networkDownloadAuthorized",
  "systemProvisioningAuthorized",
  "keyGenerationAuthorized",
  "modelTSignatureAuthorized",
  "rpcMutationAuthorized",
  "publicDevnetAuthorized",
  "deploymentAuthorized",
  "fundingSpendAuthorized",
  "activationAuthorized",
  "authorityRevocationAuthorized",
  "releaseAuthorized",
  "mainnetExecutionAuthorized",
]);
const TRUTH_KEYS = Object.freeze([
  "chainTruthObserved",
  "mainnetGenesisHashOwnerSupplied",
  "externalEvidenceAccepted",
  "modelTCapabilityObserved",
  "modelTSignatureObserved",
  "executionEvidenceObserved",
  "ownerInputMayCloseEvidenceGates",
]);
const STANDING_PERMISSION_KEYS = Object.freeze([
  "source", "localWslDockerInspection", "offlineDerivedImageCreation",
  "localContainerBuildsAndRehearsal", "policyArtifactDrafting", "cryptographicProof",
  "mayAuthorizeSignaturesOrExternalExecution",
]);

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function canonicalJsonFromSnapshot(value) {
  return JSON.stringify(canonicalize(value));
}

export function canonicalIatB3OwnerInputJson(value) {
  return canonicalJsonFromSnapshot(snapshotPlainJsonData(value, "$canonicalValue"));
}

export function sha256IatB3OwnerInputValue(value) {
  const snapshot = snapshotPlainJsonData(value, "$digestValue");
  return createHash("sha256").update(canonicalJsonFromSnapshot(snapshot)).digest("hex");
}

function inputCore(value) {
  const core = structuredClone(value);
  delete core.inputSha256;
  return core;
}

export function withIatB3OwnerInputSha256(value) {
  const copy = snapshotPlainJsonData(value, "$input");
  copy.inputSha256 = sha256IatB3OwnerInputValue(inputCore(copy));
  return deepFreeze(copy);
}

function fail(path, message) {
  throw new TypeError(`${path}: ${message}`);
}

function assertPlainJsonData(value, path, seen) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) fail(path, "expected canonical finite JSON number");
    return;
  }
  if (typeof value !== "object") fail(path, "expected plain JSON data");
  if (utilTypes.isProxy(value)) fail(path, "proxy objects are rejected");
  if (seen.has(value)) fail(path, "cyclic object graph is rejected");
  seen.add(value);

  const isArray = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (isArray ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
    fail(path, "expected a plain JSON object or array");
  }

  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key === "symbol")) fail(path, "symbol properties are rejected");
  if (isArray) {
    const lengthDescriptor = descriptors.length;
    if (!lengthDescriptor || !("value" in lengthDescriptor) || !Number.isSafeInteger(lengthDescriptor.value)) {
      fail(path, "invalid array length descriptor");
    }
    const elementKeys = keys.filter((key) => key !== "length");
    if (elementKeys.length !== lengthDescriptor.value) fail(path, "sparse or decorated arrays are rejected");
    for (let index = 0; index < lengthDescriptor.value; index += 1) {
      if (!Object.hasOwn(descriptors, String(index))) fail(`${path}[${index}]`, "sparse arrays are rejected");
    }
  }
  for (const key of keys) {
    if (isArray && key === "length") continue;
    const descriptor = descriptors[key];
    if (!("value" in descriptor)) fail(`${path}.${String(key)}`, "accessor properties are rejected");
    if (descriptor.enumerable !== true) fail(`${path}.${String(key)}`, "non-enumerable properties are rejected");
    assertPlainJsonData(descriptor.value, isArray ? `${path}[${key}]` : `${path}.${key}`, seen);
  }
}

function snapshotPlainJsonData(value, path) {
  assertPlainJsonData(value, path, new WeakSet());
  try {
    return structuredClone(value);
  } catch (error) {
    fail(path, `plain JSON snapshot failed (${error instanceof Error ? error.message : String(error)})`);
  }
}

function exactKeys(value, keys, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, "expected object");
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(path, `expected exact keys ${expected.join(",")}; received ${actual.join(",")}`);
  }
}

function nullableEnum(value, allowed, path) {
  if (value !== null && !allowed.includes(value)) fail(path, `expected null or one of ${allowed.join(",")}`);
  return value;
}

function nullableSafeInteger(value, minimum, maximum, path) {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || value < minimum || (maximum !== undefined && value > maximum)) {
    fail(path, `expected null or safe integer ${minimum}..${maximum ?? "unbounded"}`);
  }
  return value;
}

function nullableDecimal(value, { minimum = 1n, maximum = U64_MAX } = {}, path) {
  if (value === null) return null;
  if (typeof value !== "string" || !CANONICAL_DECIMAL.test(value)) {
    fail(path, "expected null or canonical unsigned decimal string");
  }
  const number = BigInt(value);
  if (number < minimum || (maximum !== undefined && number > maximum)) {
    fail(path, `decimal is outside ${minimum}..${maximum ?? "unbounded"}`);
  }
  return number;
}

function encodeBase58(bytes) {
  let value = 0n;
  for (const byte of bytes) value = (value * 256n) + BigInt(byte);
  let encoded = "";
  while (value > 0n) {
    const digit = Number(value % 58n);
    encoded = BASE58_ALPHABET[digit] + encoded;
    value /= 58n;
  }
  let leadingZeroes = 0;
  while (leadingZeroes < bytes.length && bytes[leadingZeroes] === 0) leadingZeroes += 1;
  return "1".repeat(leadingZeroes) + encoded;
}

function decodeBase58(value, path) {
  if (typeof value !== "string" || !BASE58.test(value)) fail(path, "expected canonical base58 public key");
  let decoded = 0n;
  for (const character of value) {
    const digit = BASE58_INDEX.get(character);
    if (digit === undefined) fail(path, "invalid base58 character");
    decoded = (decoded * 58n) + BigInt(digit);
  }
  const body = [];
  while (decoded > 0n) {
    body.unshift(Number(decoded & 0xffn));
    decoded >>= 8n;
  }
  let leadingZeroes = 0;
  while (leadingZeroes < value.length && value[leadingZeroes] === "1") leadingZeroes += 1;
  const bytes = Uint8Array.from([...new Array(leadingZeroes).fill(0), ...body]);
  if (bytes.length !== 32 || encodeBase58(bytes) !== value) fail(path, "expected canonical 32-byte public key");
  return value;
}

function nullablePublicKey(value, path) {
  if (value === null) return null;
  return decodeBase58(value, path);
}

function nullableProductionIdentity(value, path) {
  const identity = nullablePublicKey(value, path);
  if (identity === null) return null;
  const forbidden = FORBIDDEN_PRODUCTION_IDENTITIES.get(identity);
  if (forbidden) fail(path, `${forbidden} cannot be a B3 production identity`);
  if (TEST_FIXTURE_PRODUCTION_IDENTITIES.has(identity)) fail(path, "test-only identity cannot be a B3 production identity");
  return identity;
}

function sensitiveMaterialScan(value, path = "$input") {
  if (Array.isArray(value)) {
    if (value.length === 64 && value.every((item) => Number.isInteger(item) && item >= 0 && item <= 255)) {
      fail(path, "secret material rejected (64-byte keypair array)");
    }
    if ([12, 15, 18, 21, 24].includes(value.length)
      && value.every((item) => typeof item === "string" && /^[a-z]{2,16}$/u.test(item))) {
      fail(path, "secret material rejected (mnemonic-like word array)");
    }
    value.forEach((item, index) => sensitiveMaterialScan(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") {
    if (typeof value !== "string") return;
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/iu.test(value)
      || /\b(?:private[ _-]?key|secret[ _-]?key|seed[ _-]?phrase|recovery[ _-]?phrase|mnemonic|password|passphrase)\b/iu.test(value)
      || /(?:\b[a-z]{3,12}\b[ \t]+){11,23}\b[a-z]{3,12}\b/iu.test(value)) {
      fail(path, "secret material rejected");
    }
    if (/^(?:[A-Za-z]:[\\/]|\\\\|\/home\/|\/mnt\/[a-z]\/|file:\/\/)/iu.test(value)) {
      fail(path, "absolute local path rejected");
    }
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.replace(/[^a-z0-9]/giu, "").toLowerCase();
    if (/(?:privatekey|secretkey|seedphrase|recoveryphrase|mnemonic|password|passphrase|credential|authtoken)/u.test(normalized)) {
      fail(`${path}.${key}`, "secret-bearing field rejected");
    }
    sensitiveMaterialScan(child, `${path}.${key}`);
  }
}

function validateArtifactBinding(value, path) {
  exactKeys(value, ["status", "sha256"], path);
  nullableEnum(value.status, ["UNSPECIFIED", "NOT_YET_BOUND", "EXISTING_SHA256"], `${path}.status`);
  if (value.status === "EXISTING_SHA256") {
    if (typeof value.sha256 !== "string" || !SHA256.test(value.sha256)) fail(`${path}.sha256`, "exact existing binding requires lowercase SHA-256");
  } else if (value.sha256 !== null) {
    fail(`${path}.sha256`, "unbound artifact must keep sha256 null");
  }
}

function validateScope(value) {
  exactKeys(value, [
    "contract", "canonicalOwnerChoiceFieldCount", "ownerChoicesAreCryptographicSignatures",
    "sensitiveMaterialAccepted", "mayAuthorizeExecution",
  ], "scope");
  if (value.contract !== "NONAUTHORIZING_OWNER_POLICY_INPUT_ONLY"
    || value.canonicalOwnerChoiceFieldCount !== IAT_B3_OWNER_CHOICE_FIELD_COUNT
    || value.ownerChoicesAreCryptographicSignatures !== false
    || value.sensitiveMaterialAccepted !== false || value.mayAuthorizeExecution !== false) {
    fail("scope", "non-authorizing scope drifted");
  }
}

function validateSourceBinding(value) {
  exactKeys(value, ["path", "schema", "sha256", "byteLength", "status"], "sourcePolicyBinding");
  if (canonicalIatB3OwnerInputJson(value) !== canonicalIatB3OwnerInputJson(IAT_B3_OWNER_POLICY_SOURCE_BINDING)) {
    fail("sourcePolicyBinding", "canonical owner-policy source binding drifted");
  }
}

function validateStandingPermissions(value) {
  exactKeys(value, STANDING_PERMISSION_KEYS, "standingPermissions");
  if (value.source !== "EXPLICIT_USER_RESPONSE_IN_CURRENT_TASK"
    || value.localWslDockerInspection !== true
    || value.offlineDerivedImageCreation !== true
    || value.localContainerBuildsAndRehearsal !== true
    || value.policyArtifactDrafting !== true
    || value.cryptographicProof !== false
    || value.mayAuthorizeSignaturesOrExternalExecution !== false) {
    fail("standingPermissions", "exact local/offline permission boundary drifted");
  }
}

function validateOwnerChoices(value) {
  exactKeys(value, ["core", "faction", "genesis", "productionIdentity", "authorityPublicKeys", "funding"], "ownerChoices");
  exactKeys(value.core, ["fixedBeneficiary"], "ownerChoices.core");
  nullablePublicKey(value.core.fixedBeneficiary, "ownerChoices.core.fixedBeneficiary");

  exactKeys(value.faction, [
    "sybilPolicy", "weeklyEpochAnchorUnixSeconds", "communityCarveOutBaseUnits",
    "weeklyEmissionBaseUnits", "fundingHorizonWeeks", "unusedBalanceDestination",
    "nftPrizePolicy", "claimExpirySeconds",
  ], "ownerChoices.faction");
  nullableEnum(value.faction.sybilPolicy, [
    "PRESERVED_WALLET_AND_IMMUTABLE_X_BINDING", "AUDITED_ONCHAIN_IDENTITY_COMMITMENT",
  ], "ownerChoices.faction.sybilPolicy");
  nullableSafeInteger(value.faction.weeklyEpochAnchorUnixSeconds, 0, undefined, "ownerChoices.faction.weeklyEpochAnchorUnixSeconds");
  const carveOut = nullableDecimal(
    value.faction.communityCarveOutBaseUnits,
    { maximum: COMMUNITY_TOTAL_BASE_UNITS - 1n },
    "ownerChoices.faction.communityCarveOutBaseUnits",
  );
  const emission = nullableDecimal(value.faction.weeklyEmissionBaseUnits, {}, "ownerChoices.faction.weeklyEmissionBaseUnits");
  nullableSafeInteger(value.faction.fundingHorizonWeeks, 1, undefined, "ownerChoices.faction.fundingHorizonWeeks");
  nullablePublicKey(value.faction.unusedBalanceDestination, "ownerChoices.faction.unusedBalanceDestination");
  nullableEnum(value.faction.nftPrizePolicy, [
    "NFT_PRIZES_DISABLED", "NFT_PRIZES_DEFINED_IN_PRIZE_POLICY",
  ], "ownerChoices.faction.nftPrizePolicy");
  nullableSafeInteger(value.faction.claimExpirySeconds, 1, undefined, "ownerChoices.faction.claimExpirySeconds");
  if (carveOut !== null && emission !== null && value.faction.fundingHorizonWeeks !== null
    && emission * BigInt(value.faction.fundingHorizonWeeks) > carveOut) {
    fail("ownerChoices.faction", "weekly emission multiplied by funding horizon exceeds carve-out");
  }

  exactKeys(value.genesis, [
    "communityOwner", "treasuryBeneficiary", "ecosystemBeneficiary", "coreBeneficiary",
    "liquidityBeneficiary", "factionCarveOutBaseUnits",
  ], "ownerChoices.genesis");
  const genesisKeys = [
    "communityOwner", "treasuryBeneficiary", "ecosystemBeneficiary", "coreBeneficiary", "liquidityBeneficiary",
  ];
  for (const key of genesisKeys) nullablePublicKey(value.genesis[key], `ownerChoices.genesis.${key}`);
  const populatedGenesisKeys = genesisKeys.map((key) => value.genesis[key]).filter((item) => item !== null);
  if (new Set(populatedGenesisKeys).size !== populatedGenesisKeys.length) fail("ownerChoices.genesis", "provided destination public keys must be distinct");
  const genesisCarveOut = nullableDecimal(
    value.genesis.factionCarveOutBaseUnits,
    { maximum: COMMUNITY_TOTAL_BASE_UNITS - 1n },
    "ownerChoices.genesis.factionCarveOutBaseUnits",
  );
  if (value.core.fixedBeneficiary !== null && value.genesis.coreBeneficiary !== null
    && value.core.fixedBeneficiary !== value.genesis.coreBeneficiary) {
    fail("ownerChoices.genesis.coreBeneficiary", "must equal the fixed core beneficiary");
  }
  if (carveOut !== null && genesisCarveOut !== null && carveOut !== genesisCarveOut) {
    fail("ownerChoices.genesis.factionCarveOutBaseUnits", "must equal faction community carve-out");
  }

  exactKeys(value.productionIdentity, [
    "publicKeyDisposition", "lawProgramId", "economyProgramId", "canonicalMint",
    "clusterIdentityPolicy", "entropyLagSlots", "entropyRiskAcceptance",
  ], "ownerChoices.productionIdentity");
  nullableEnum(value.productionIdentity.publicKeyDisposition, [
    "UNSPECIFIED", "PUBLIC_KEYS_PROVIDED", "PUBLIC_KEYS_DEFERRED",
  ], "ownerChoices.productionIdentity.publicKeyDisposition");
  const identityKeys = ["lawProgramId", "economyProgramId", "canonicalMint"];
  for (const key of identityKeys) {
    nullableProductionIdentity(value.productionIdentity[key], `ownerChoices.productionIdentity.${key}`);
  }
  const populatedIdentityKeys = identityKeys.map((key) => value.productionIdentity[key]).filter((item) => item !== null);
  if (new Set(populatedIdentityKeys).size !== populatedIdentityKeys.length) fail("ownerChoices.productionIdentity", "provided production identities must be pairwise distinct");
  if (value.productionIdentity.publicKeyDisposition === "PUBLIC_KEYS_PROVIDED" && populatedIdentityKeys.length !== 3) {
    fail("ownerChoices.productionIdentity", "PUBLIC_KEYS_PROVIDED requires all three public identities");
  }
  if (value.productionIdentity.publicKeyDisposition !== "PUBLIC_KEYS_PROVIDED" && populatedIdentityKeys.length !== 0) {
    fail("ownerChoices.productionIdentity", "deferred or unspecified identity mode must keep public identities null");
  }
  nullableEnum(value.productionIdentity.clusterIdentityPolicy, [
    "SAME_LAW_ECONOMY_AND_MINT_IDS_ACROSS_CLUSTERS",
    "SAME_PROGRAM_IDS_DISTINCT_MINT_PER_CLUSTER",
    "DISTINCT_PROGRAM_AND_MINT_IDS_PER_CLUSTER",
  ], "ownerChoices.productionIdentity.clusterIdentityPolicy");
  nullableSafeInteger(value.productionIdentity.entropyLagSlots, 1, 512, "ownerChoices.productionIdentity.entropyLagSlots");
  nullableEnum(value.productionIdentity.entropyRiskAcceptance, [
    IAT_B3_ENTROPY_RISK_ACCEPTANCE,
  ], "ownerChoices.productionIdentity.entropyRiskAcceptance");

  exactKeys(value.authorityPublicKeys, [
    "ceremonySignerPublicKey", "lawUpgradeAuthorityPublicKey", "economyUpgradeAuthorityPublicKey", "payerPublicKey",
  ], "ownerChoices.authorityPublicKeys");
  for (const key of Object.keys(value.authorityPublicKeys)) {
    nullablePublicKey(value.authorityPublicKeys[key], `ownerChoices.authorityPublicKeys.${key}`);
  }

  exactKeys(value.funding, ["ceremonyFloorLamports"], "ownerChoices.funding");
  nullableDecimal(value.funding.ceremonyFloorLamports, { minimum: COST_CEILING_LAMPORTS }, "ownerChoices.funding.ceremonyFloorLamports");
}

function validateTransitPolicy(value) {
  exactKeys(value, ["selectedPolicyId", "ownerPublicKey"], "transitPolicy");
  nullableEnum(value.selectedPolicyId, [IAT_B3_TRANSIT_POLICY_ID, IAT_B3_TRANSIT_POLICY_REJECTION], "transitPolicy.selectedPolicyId");
  nullablePublicKey(value.ownerPublicKey, "transitPolicy.ownerPublicKey");
  if (value.selectedPolicyId === IAT_B3_TRANSIT_POLICY_REJECTION && value.ownerPublicKey !== null) {
    fail("transitPolicy.ownerPublicKey", "rejected engineering policy must not bind a transit owner");
  }
}

function validateAuthorizationBoundary(value) {
  exactKeys(value, [...AUTHORIZATION_BOOLEAN_KEYS, "mainnetStatus"], "authorizationBoundary");
  for (const key of AUTHORIZATION_BOOLEAN_KEYS) {
    if (value[key] !== false) fail(`authorizationBoundary.${key}`, "owner input cannot authorize actions");
  }
  if (value.mainnetStatus !== "HOLD") fail("authorizationBoundary.mainnetStatus", "must remain HOLD");
}

function validateTruth(value) {
  exactKeys(value, TRUTH_KEYS, "truth");
  for (const key of TRUTH_KEYS) {
    if (value[key] !== false) fail(`truth.${key}`, "unobserved or nonauthorizing truth must remain false");
  }
}

function addMissing(blockers, condition, path) {
  if (!condition) blockers.push(`OWNER_INPUT_REQUIRED:${path}`);
}

function completionBlockers(input) {
  const blockers = [];
  addMissing(blockers, input.inputSha256 !== null, "inputSha256");
  addMissing(blockers, input.acceptSourceLockedDefaults === true, "acceptSourceLockedDefaults");
  for (const key of ARTIFACT_KEYS) {
    addMissing(blockers, input.policyArtifacts[key].status === "EXISTING_SHA256", `policyArtifacts.${key}`);
  }
  const owner = input.ownerChoices;
  addMissing(blockers, owner.core.fixedBeneficiary !== null, "ownerChoices.core.fixedBeneficiary");
  for (const key of Object.keys(owner.faction)) addMissing(blockers, owner.faction[key] !== null, `ownerChoices.faction.${key}`);
  for (const key of Object.keys(owner.genesis)) addMissing(blockers, owner.genesis[key] !== null, `ownerChoices.genesis.${key}`);
  addMissing(blockers, owner.productionIdentity.publicKeyDisposition === "PUBLIC_KEYS_PROVIDED", "ownerChoices.productionIdentity.publicKeyDisposition");
  for (const key of ["lawProgramId", "economyProgramId", "canonicalMint", "clusterIdentityPolicy", "entropyLagSlots", "entropyRiskAcceptance"]) {
    addMissing(blockers, owner.productionIdentity[key] !== null, `ownerChoices.productionIdentity.${key}`);
  }
  for (const key of Object.keys(owner.authorityPublicKeys)) {
    addMissing(blockers, owner.authorityPublicKeys[key] !== null, `ownerChoices.authorityPublicKeys.${key}`);
  }
  addMissing(blockers, owner.funding.ceremonyFloorLamports !== null, "ownerChoices.funding.ceremonyFloorLamports");
  addMissing(blockers, input.transitPolicy.selectedPolicyId === IAT_B3_TRANSIT_POLICY_ID, "transitPolicy.selectedPolicyId");
  addMissing(blockers, input.transitPolicy.ownerPublicKey !== null, "transitPolicy.ownerPublicKey");
  if (input.transitPolicy.selectedPolicyId === IAT_B3_TRANSIT_POLICY_REJECTION) {
    blockers.push("OWNER_REJECTED_ENGINEERING_TRANSIT_RECOMMENDATION:HOLD_FOR_NEW_POLICY");
  }
  return blockers;
}

function artifactSha(input, key) {
  return input.policyArtifacts[key].status === "EXISTING_SHA256" ? input.policyArtifacts[key].sha256 : null;
}

function materializeIatB3CanonicalOwnerChoiceCandidateFromSnapshot(input) {
  const accepted = input.acceptSourceLockedDefaults === true;
  const owner = input.ownerChoices;
  const candidate = {
    LIVE_ESTATE_CANONICAL_MINT_DECISION: {
      liveEstateAssertion: "NO_LIVE_ESTATE_MINT",
      candidateMint: null,
      candidateTokenProgramId: null,
      canonicalMintDecision: "NEW_TOKEN_2022_FROM_INCEPTION",
      duplicateSupplyRetirementPolicy: "NOT_APPLICABLE",
    },
    CORE_CUSTODY_POLICY_ADAPTER: {
      acceptFrozenScope: accepted ? true : null,
      releasePolicy: accepted && owner.core.fixedBeneficiary !== null ? {
        authorizationModel: "PROGRAM_ENFORCED_V2_SCHEDULE_TO_FIXED_BENEFICIARY",
        fixedBeneficiary: owner.core.fixedBeneficiary,
        currentOpenDailyLawRequired: true,
        sameDayReconciliationRequired: true,
        ordinaryWalletEndsAttribution: true,
        discretionaryBypassPermitted: false,
      } : null,
    },
    FACTION_ECONOMICS_FUNDING: {
      scoringPolicySha256: artifactSha(input, "scoringPolicy"),
      sybilPolicy: owner.faction.sybilPolicy,
      weeklyEpochAnchorUnixSeconds: owner.faction.weeklyEpochAnchorUnixSeconds,
      tieRule: accepted ? "ONE_ROLL_NO_REROLL_EXACT_UNIFORM" : null,
      communityCarveOutBaseUnits: owner.faction.communityCarveOutBaseUnits,
      weeklyEmissionBaseUnits: owner.faction.weeklyEmissionBaseUnits,
      fundingHorizonWeeks: owner.faction.fundingHorizonWeeks,
      unusedBalanceDestination: owner.faction.unusedBalanceDestination,
      followerSnapshotPolicySha256: artifactSha(input, "followerSnapshotPolicy"),
      prizePolicySha256: artifactSha(input, "prizePolicy"),
      nftPrizePolicy: owner.faction.nftPrizePolicy,
      claimExpirySeconds: owner.faction.claimExpirySeconds,
    },
    CONFIG_GENESIS_PHASE_CODEC: {
      acceptExactBootstrapPolicy: accepted ? true : null,
      canonicalAccountSetSha256: artifactSha(input, "canonicalAccountSet"),
      bootstrapReplayPolicy: accepted ? "REJECT_REENTRY_AND_ROLLBACK" : null,
      preActivationCoreCapPolicy: accepted ? "VACUOUS_ONLY_UNTIL_ATOMIC_ACTIVATION" : null,
    },
    GENESIS_ALLOCATIONS_CONSERVATION: {
      communityOwner: owner.genesis.communityOwner,
      treasuryBeneficiary: owner.genesis.treasuryBeneficiary,
      ecosystemBeneficiary: owner.genesis.ecosystemBeneficiary,
      coreBeneficiary: owner.genesis.coreBeneficiary,
      liquidityBeneficiary: owner.genesis.liquidityBeneficiary,
      factionCarveOutBaseUnits: owner.genesis.factionCarveOutBaseUnits,
      coreDestinationPolicy: accepted ? "CANONICAL_CORE_CUSTODY" : null,
      programVaultDestinationPolicy: accepted ? "DERIVE_FROM_FROZEN_ECONOMY_ID_AND_MINT" : null,
    },
    PRODUCTION_IDENTITY_INPUT_FREEZE: {
      lawProgramId: owner.productionIdentity.lawProgramId,
      economyProgramId: owner.productionIdentity.economyProgramId,
      canonicalMint: owner.productionIdentity.canonicalMint,
      clusterIdentityPolicy: owner.productionIdentity.clusterIdentityPolicy,
      entropyLagSlots: owner.productionIdentity.entropyLagSlots,
      entropyRiskAcceptance: owner.productionIdentity.entropyRiskAcceptance,
      metadataPolicy: accepted ? "NO_MINT_METADATA_EXTENSION_IMMUTABLE_EXTERNAL_RECORD" : null,
      acceptCanonicalSeedTable: accepted ? true : null,
    },
    B3_COST_CEREMONY_FUNDING: {
      payerPublicKey: owner.authorityPublicKeys.payerPublicKey,
      fundingSourcePolicySha256: artifactSha(input, "fundingSourcePolicy"),
      ceremonyFloorLamports: owner.funding.ceremonyFloorLamports,
      overCeilingDisposition: accepted ? "REQUIRE_NEW_EXACT_OWNER_CEILING_NEVER_CUT_FEATURES" : null,
    },
  };
  return deepFreeze(candidate);
}

export function materializeIatB3CanonicalOwnerChoiceCandidate(input) {
  return materializeIatB3CanonicalOwnerChoiceCandidateFromSnapshot(
    snapshotPlainJsonData(input, "$input"),
  );
}

function countCanonicalOwnerChoiceFields(candidate) {
  return [
    "CORE_CUSTODY_POLICY_ADAPTER", "FACTION_ECONOMICS_FUNDING", "CONFIG_GENESIS_PHASE_CODEC",
    "GENESIS_ALLOCATIONS_CONSERVATION", "PRODUCTION_IDENTITY_INPUT_FREEZE", "B3_COST_CEREMONY_FUNDING",
  ].reduce((count, key) => count + Object.keys(candidate[key]).length, 0);
}

export function validateIatB3OwnerInput(input) {
  const snapshot = snapshotPlainJsonData(input, "$input");
  return validateIatB3OwnerInputSnapshot(snapshot);
}

function validateIatB3OwnerInputSnapshot(input) {
  sensitiveMaterialScan(input);
  exactKeys(input, [
    "$schema", "schema", "profile", "status", "inputSha256", "scope", "sourcePolicyBinding",
    "standingPermissions", "acceptSourceLockedDefaults", "policyArtifacts", "ownerChoices", "transitPolicy",
    "authorizationBoundary", "truth",
  ], "$input");
  if (input.$schema !== "./iat-b3-owner-input.v1.schema.json" || input.schema !== IAT_B3_OWNER_INPUT_SCHEMA
    || input.profile !== IAT_B3_OWNER_INPUT_PROFILE || input.status !== IAT_B3_OWNER_INPUT_STATUS) {
    fail("$input", "schema, profile, or HOLD status drifted");
  }
  if (input.inputSha256 !== null) {
    if (typeof input.inputSha256 !== "string" || !SHA256.test(input.inputSha256)
      || input.inputSha256 !== sha256IatB3OwnerInputValue(inputCore(input))) {
      fail("inputSha256", "owner input digest mismatch");
    }
  }
  validateScope(input.scope);
  validateSourceBinding(input.sourcePolicyBinding);
  validateStandingPermissions(input.standingPermissions);
  nullableEnum(input.acceptSourceLockedDefaults, [true], "acceptSourceLockedDefaults");
  exactKeys(input.policyArtifacts, ARTIFACT_KEYS, "policyArtifacts");
  for (const key of ARTIFACT_KEYS) validateArtifactBinding(input.policyArtifacts[key], `policyArtifacts.${key}`);
  validateOwnerChoices(input.ownerChoices);
  validateTransitPolicy(input.transitPolicy);
  validateAuthorizationBoundary(input.authorizationBoundary);
  validateTruth(input.truth);

  const canonicalOwnerChoiceCandidate = materializeIatB3CanonicalOwnerChoiceCandidateFromSnapshot(input);
  const count = countCanonicalOwnerChoiceFields(canonicalOwnerChoiceCandidate);
  if (count !== IAT_B3_OWNER_CHOICE_FIELD_COUNT) fail("ownerChoices", `materialized field count ${count} != 38`);
  const blockers = completionBlockers(input);
  const complete = blockers.length === 0;
  const productionAuthorityCandidate = deepFreeze({
    lawProgramId: input.ownerChoices.productionIdentity.lawProgramId,
    economyProgramId: input.ownerChoices.productionIdentity.economyProgramId,
    canonicalMint: input.ownerChoices.productionIdentity.canonicalMint,
    mainnetGenesisHash: null,
    mainnetGenesisHashEvidenceDisposition: "TWO_SOURCE_BOUND_ENDPOINT_RECEIPTS_REQUIRED",
    ceremonySignerPublicKey: input.ownerChoices.authorityPublicKeys.ceremonySignerPublicKey,
    lawUpgradeAuthorityPublicKey: input.ownerChoices.authorityPublicKeys.lawUpgradeAuthorityPublicKey,
    economyUpgradeAuthorityPublicKey: input.ownerChoices.authorityPublicKeys.economyUpgradeAuthorityPublicKey,
    payerPublicKey: input.ownerChoices.authorityPublicKeys.payerPublicKey,
  });
  const transitCandidate = deepFreeze({
    ownerSelectedPolicyId: input.transitPolicy.selectedPolicyId === IAT_B3_TRANSIT_POLICY_ID
      ? IAT_B3_TRANSIT_POLICY_ID : null,
    recommendationRejected: input.transitPolicy.selectedPolicyId === IAT_B3_TRANSIT_POLICY_REJECTION,
    transitOwnerPublicKey: input.transitPolicy.ownerPublicKey,
    canonicalDestinationManifestSha256: artifactSha(input, "canonicalTransitDestinationManifest"),
    signedAcceptance: null,
    trezorModelTConfirmationObserved: false,
    signatureVerified: false,
  });
  return deepFreeze({
    valid: true,
    schema: IAT_B3_OWNER_INPUT_SCHEMA,
    status: "HOLD",
    ownerSelectionsComplete: complete,
    canonicalOwnerChoiceFieldCount: count,
    canonicalOwnerChoiceCandidate,
    productionAuthorityCandidate,
    transitCandidate,
    blockers,
    authorizationBoundary: structuredClone(input.authorizationBoundary),
    inputSha256: input.inputSha256 ?? sha256IatB3OwnerInputValue(inputCore(input)),
    inputDigestEmbedded: input.inputSha256 !== null,
    inputDigestDisposition: input.inputSha256 === null
      ? "UNBOUND_STRUCTURAL_DRAFT"
      : "EMBEDDED_CANONICAL_DIGEST_VERIFIED_NONAUTHORIZING",
    structuralDraft: input.inputSha256 === null,
    ownerSelectionsAreCryptographicSignatures: false,
    executionAuthorized: false,
    publicDevnetAuthorized: false,
    releaseAuthorized: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: "HOLD",
  });
}

export function parseIatB3OwnerInputJson(text, label = "owner input") {
  if (typeof text !== "string") throw new TypeError(`${label}: JSON source must be a string`);
  let index = 0;
  const whitespace = /[\t\n\r ]/u;
  const skipWhitespace = () => {
    while (index < text.length && whitespace.test(text[index])) index += 1;
  };
  const syntaxFail = (message) => {
    throw new SyntaxError(`${label}: ${message} at byte ${index}`);
  };
  const parseStringToken = () => {
    if (text[index] !== "\"") syntaxFail("expected JSON string");
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
        if (character < " ") syntaxFail("unescaped control character");
        index += 1;
      }
    }
    syntaxFail("unterminated JSON string");
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
        if (text[index] !== ":") syntaxFail("expected colon");
        index += 1;
        parseValue(`${path}.${key}`);
        skipWhitespace();
        if (text[index] === "}") {
          index += 1;
          return;
        }
        if (text[index] !== ",") syntaxFail("expected comma or closing brace");
        index += 1;
      }
      syntaxFail("unterminated JSON object");
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
        if (text[index] !== ",") syntaxFail("expected comma or closing bracket");
        index += 1;
      }
      syntaxFail("unterminated JSON array");
    }
    if (text[index] === "\"") {
      parseStringToken();
      return;
    }
    const start = index;
    while (index < text.length && !/[\t\n\r ,\]}]/u.test(text[index])) index += 1;
    if (start === index) syntaxFail("expected JSON value");
    JSON.parse(text.slice(start, index));
  };
  skipWhitespace();
  parseValue("$root");
  skipWhitespace();
  if (index !== text.length) syntaxFail("unexpected trailing data");
  return JSON.parse(text);
}

export function parseAndValidateIatB3OwnerInputJson(text, label = "owner input") {
  return validateIatB3OwnerInput(parseIatB3OwnerInputJson(text, label));
}
