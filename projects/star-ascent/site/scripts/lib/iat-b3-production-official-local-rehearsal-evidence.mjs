import { createHash, createPublicKey, verify as verifyEd25519 } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { getExtraAccountMetaAddress, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

import {
  COMBINED_LAW_BUILD_RECEIPT_SCHEMA,
  validateCombinedLawBuildReceipt,
} from "../run-iat-b3-combined-law-reproducible-build.mjs";
import {
  ECONOMY_BUILD_RECEIPT_SCHEMA,
  validateEconomyBuildReceipt,
} from "../run-iat-b3-economy-reproducible-build.mjs";
import {
  PRODUCTION_IDENTITY_AUTHORITY_EVIDENCE_SCHEMA,
  validateProductionIdentityAuthorityEvidenceManifest,
} from "../validate-iat-b3-production-identity-authority-evidence.mjs";
import { parseIdentityFreezeJson } from "../validate-iat-b3-identity-freeze.mjs";
import {
  buildIatB3ProductionLocalRehearsalPlanPacket,
  validateIatB3ProductionLocalRehearsalPlan,
} from "../validate-iat-b3-production-local-rehearsal-plan.mjs";
import {
  IAT_B3_PRODUCTION_EXPECTED_DISPOSITIONS_SHA256,
  IAT_B3_UPGRADEABLE_LOADER_PROGRAM_ID,
} from "./iat-b3-production-local-rehearsal-contract.mjs";
import { decodeIatB3ProductionFixtureState } from "./iat-b3-production-loopback-adapter.mjs";

export const IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_SOURCE_SCHEMA =
  "iat-b3-production-official-local-rehearsal-source-contract/v1";
export const IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_FIXTURE_INPUT_SCHEMA =
  "iat-b3-production-official-local-rehearsal-fixture-input/v1";
export const IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_FIXTURE_PACK_SCHEMA =
  "iat-b3-production-official-local-rehearsal-fixture-pack/v1";
export const IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_EXECUTION_INPUT_SCHEMA =
  "iat-b3-production-official-local-rehearsal-execution-input/v1";
export const IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_EXECUTION_RECEIPT_SCHEMA =
  "iat-b3-production-official-local-rehearsal-execution-receipt/v1";
export const IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_CHECKPOINT =
  "21ad639a3a68d2352dcf53ba6097089f0418d236";
export const IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_STATUS = "HOLD_SOURCE_ONLY";
export const IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_TEST_STATUS = "HOLD_TEST_INJECTED";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const AUTHORITY_PACKET_PATH = resolve(
  ROOT,
  "docs/b3/iat-b3-production-identity-authority-evidence.v1.json",
);
const HEX_SHA256 = /^[0-9a-f]{64}$/u;
const HEX_SHA1 = /^[0-9a-f]{40}$/u;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const ZERO_SHA256 = "0".repeat(64);
const ZERO_SHA1 = "0".repeat(40);
const UPGRADEABLE_LOADER = new PublicKey(IAT_B3_UPGRADEABLE_LOADER_PROGRAM_ID);
const NATIVE_LOADER_PROGRAM_ID = "NativeLoader1111111111111111111111111111111";
const ZK_ELGAMAL_PROOF_PROGRAM_ID = "ZkE1Gama1Proof11111111111111111111111111111";
const EXACT_ROLLBACK_OPCODES = Object.freeze([5, 6, 7, 9, 10]);
const PROVENANCE_SOURCE = "DEFAULT_SOURCE_VALIDATED";
const PROVENANCE_TEST = "TEST_INJECTED";
const ALLOWED_TEST_DEPENDENCIES = Object.freeze([
  "decodeFixture",
  "validateEconomyReceipt",
  "validateLawReceipt",
]);
const BUILD_ENVIRONMENT_KEYS = Object.freeze([
  "IAT_B3_PRODUCTION_LAW_PROGRAM_ID",
  "IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID",
  "IAT_B3_PRODUCTION_CANONICAL_MINT",
  "IAT_B3_PRODUCTION_MAINNET_GENESIS_HASH",
]);
const LAW_BUILD_ENVIRONMENT_KEYS = Object.freeze(BUILD_ENVIRONMENT_KEYS.slice(0, 3));
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const TRANSFER_HOOK_EXECUTE_DISCRIMINATOR = Buffer.from("692565c54bfb661a", "hex");
const TOKEN_DECIMALS = 9;
const ELIGIBILITY_ACCOUNT_LEN = 96n;
const POSITION_ACCOUNT_LEN = 176n;
const EXACT_ORDINAL_IDS = Object.freeze(Array.from({ length: 15 }, (_, opcode) => `ORDINAL_${opcode}`));
const EXACT_OPCODE9_IDS = Object.freeze([
  "OPCODE9_TREASURY_ACTIVE",
  "OPCODE9_ECOSYSTEM_ACTIVE",
  "OPCODE9_LIQUIDITY_ACTIVE",
  "OPCODE9_CORE_TEAM_HOLD",
  "OPCODE9_COMMUNITY_INVALID",
  "OPCODE9_UNKNOWN_INVALID",
]);
const ACTIVE_DISPOSITION = "ACTIVE_EXPECTED_SUCCESS";
const DUAL_GENESIS_NEGATIVE_DISPOSITION = "DAILY_LAW_REJECTED_LOCAL_DOMAIN";
const DUAL_GENESIS_POSITIVE_DISPOSITION = "COMPILED_DOMAIN_ACCEPTED_CCC_DISABLED";
const CCC_DISABLED_CODE = 0xe50a;
const DAILY_LAW_REJECTED_CODE = 0xe503;
const PACK_TRUTH = deepFreeze({
  all15OrdinalCasesDefined: true,
  opcode9FullConditionalCasesDefined: true,
  fiveRollbackAndRetryRowsDefined: true,
  dualGenesisSignedEvidenceRequired: true,
  exactIdentityManifestAndEnvironmentBound: true,
  allFixturesValidatedBeforeSignerLoad: true,
  sharedInfrastructureSourceDerived: true,
  deterministicSerializedSharedStateChainRequired: true,
  signerKeysRead: false,
  executionObserved: false,
  officialComplete: false,
  activationAuthorized: false,
  mainnetStatus: "HOLD",
});
const PACK_BLOCKERS = Object.freeze([
  "NO_VALIDATOR_OR_RPC_OBSERVATIONS_ACCEPTED_BY_SOURCE_ONLY_PACKER",
  "NO_SIGNER_BYTES_READ",
  "17_STAGE_AUTHORITY_CEREMONY_PENDING",
  "OFFICIAL_COMPLETE_CATEGORICALLY_UNAVAILABLE",
]);
const RECEIPT_TRUTH = deepFreeze({
  ordinalObservationCount: 15,
  opcode9ConditionalObservationCount: 6,
  rollbackAndRetryObservationCount: 5,
  dualGenesisFullTransactionObservationCount: 2,
  legacyTransactionMessageAndEd25519SignaturesValidated: true,
  sourceDerivedLogsAndExactInnerCpiValidated: true,
  operationSpecificCodecStateTransitionsValidated: true,
  exactAccountSnapshotsAndLandedFeeNormalizationValidated: true,
  deterministicSharedInfrastructureStateChainValidated: true,
  runtimeProvenanceAuthenticated: false,
  officialComplete: false,
  activationAuthorized: false,
  mainnetStatus: "HOLD",
});
const RECEIPT_BLOCKERS = Object.freeze([
  "SOURCE_ONLY_VALIDATOR_CANNOT_AUTHENTICATE_RPC_OR_VALIDATOR_PROVENANCE",
  "EXECUTION_NOT_PERFORMED_BY_THIS_CONTRACT",
  "17_STAGE_AUTHORITY_CEREMONY_PENDING",
  "OFFICIAL_COMPLETE_CATEGORICALLY_UNAVAILABLE",
]);
const CHECKPOINT_PLAN_CORE_SHA256 = "52dd090e38bf9b448a6250e16903b26a524ef2e7d4098fcab282c7d6363f146a";
const CHECKPOINT_TRANSACTION_MAP_SHA256 = "1d151922b7187c6e93ae13abac3c82ce4c0b56f9987baedc265d357cd7411a07";
const CHECKPOINT_ACCOUNT_MAP_SHA256 = "4a8d714d69d52b3ad885e74f4ad64a9ab47d6c960b5dbf8c7af56feb7b25c0a0";
const CHECKPOINT_AUTHORITY_EVIDENCE_SHA256 = "94fc32f1380843ec31b2d94077061d7e788114d346d71f7c3a1001f2fcd980c5";
const INSTRUCTION_PAYLOADS = deepFreeze([
  { opcode: 0, fields: [] },
  { opcode: 1, fields: [{ name: "lane", type: "u8", offset: 16 }] },
  { opcode: 2, fields: [] },
  { opcode: 3, fields: [] },
  { opcode: 4, fields: [] },
  { opcode: 5, fields: [
    { name: "role", type: "u8", offset: 16 },
    { name: "agency_index", type: "option_u32", tagOffset: 17, valueOffset: 20 },
  ] },
  { opcode: 6, fields: [
    { name: "position_id", type: "u64", offset: 16 },
    { name: "principal", type: "u64", offset: 24 },
  ] },
  { opcode: 7, fields: [{ name: "week", type: "u64", offset: 16 }] },
  { opcode: 8, fields: [{ name: "ordinal", type: "u64", offset: 16 }] },
  { opcode: 9, fields: [{ name: "lane", type: "u8", offset: 16 }] },
  { opcode: 10, fields: [] },
  { opcode: 11, fields: [] },
  { opcode: 12, fields: [{ name: "week", type: "u64", offset: 16 }] },
  { opcode: 13, fields: [] },
  { opcode: 14, fields: [] },
]);

const fail = (code) => {
  throw new Error(`INVALID_IAT_B3_OFFICIAL_LOCAL_REHEARSAL_${code}`);
};

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export const canonicalIatB3ProductionOfficialRehearsalJson = (value) =>
  JSON.stringify(canonicalize(value));

export const sha256IatB3ProductionOfficialRehearsalValue = (value) =>
  sha256(Buffer.from(canonicalIatB3ProductionOfficialRehearsalJson(value), "utf8"));

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value, keys) {
  return isPlainObject(value)
    && canonicalIatB3ProductionOfficialRehearsalJson(Object.keys(value).sort())
      === canonicalIatB3ProductionOfficialRehearsalJson([...keys].sort());
}

function assertHex(value, pattern, code) {
  if (typeof value !== "string" || !pattern.test(value)
    || value === (pattern === HEX_SHA1 ? ZERO_SHA1 : ZERO_SHA256)) fail(code);
}

function publicKey(value, code = "PUBLIC_KEY") {
  try {
    const key = new PublicKey(value);
    if (key.toBase58() !== value) fail(code);
    return key;
  } catch {
    fail(code);
  }
}

function canonicalBase64(value, code, { allowEmpty = true } = {}) {
  if (typeof value !== "string" || !BASE64.test(value)) fail(code);
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value || (!allowEmpty && bytes.length === 0)) fail(code);
  return bytes;
}

function digestCore(value, digestKey) {
  const core = { ...value };
  delete core[digestKey];
  return sha256IatB3ProductionOfficialRehearsalValue(core);
}

function expectedErrorCode(disposition) {
  if (disposition.disposition === ACTIVE_DISPOSITION) return null;
  if (!Number.isSafeInteger(disposition.expectedErrorCode)) fail("DISPOSITION_ERROR_CODE");
  return disposition.expectedErrorCode;
}

function readAuthorityPacket() {
  const bytes = readFileSync(AUTHORITY_PACKET_PATH);
  return { bytes, value: JSON.parse(bytes.toString("utf8")) };
}

function validatePendingAuthorityPacket(packet) {
  validateProductionIdentityAuthorityEvidenceManifest(packet);
  const journal = packet.phaseCDeployedSeal?.journal;
  if (packet.schema !== PRODUCTION_IDENTITY_AUTHORITY_EVIDENCE_SCHEMA
    || packet.status !== "PENDING"
    || packet.authorizationBoundary?.mainnetStatus !== "HOLD"
    || packet.authorizationBoundary?.activationAuthorized !== false
    || !Array.isArray(journal)
    || journal.length !== 17
    || journal.some((entry, index) => entry.ordinal !== index + 1 || entry.status !== "PENDING")) {
    fail("AUTHORITY_CEREMONY_NOT_PENDING_17_STAGE_HOLD");
  }
  const activation = journal.find((entry) => entry.ordinal === 16
    && entry.step === "ACTIVATE_ONLY_IF_CURRENT_DAY_OPEN");
  if (!activation || activation.status !== "PENDING") fail("ACTIVATION_NOT_HOLD");
}

function sourceCase(caseValue, kind) {
  const disposition = kind === "ORDINAL" && caseValue.opcode === 9
    ? ACTIVE_DISPOSITION : caseValue.expectedDisposition;
  const normalized = {
    disposition,
    expectedErrorCode: caseValue.expectedNumericErrorCode,
  };
  const errorCode = expectedErrorCode(normalized);
  return {
    id: kind === "ORDINAL" ? `ORDINAL_${caseValue.opcode}` : `OPCODE9_${caseValue.id}`,
    kind,
    opcode: caseValue.opcode,
    operation: caseValue.operation ?? "claim_lane_principal",
    variant: caseValue.variant,
    lane: caseValue.lane ?? caseValue.payloadPlan?.lane ?? null,
    disposition,
    expectedErrorCode: errorCode,
    lawOnlyNoEffect: caseValue.requiredNoEffectBeyondFeePayer === true,
  };
}

export function buildIatB3ProductionOfficialRehearsalSourceContract() {
  const plan = buildIatB3ProductionLocalRehearsalPlanPacket();
  validateIatB3ProductionLocalRehearsalPlan(plan);
  const authority = readAuthorityPacket();
  validatePendingAuthorityPacket(authority.value);
  if (plan.planCoreSha256 !== CHECKPOINT_PLAN_CORE_SHA256
    || plan.productionTransactionMap.canonicalMapSha256 !== CHECKPOINT_TRANSACTION_MAP_SHA256
    || plan.productionTransactionMap.operationAccountMapSha256 !== CHECKPOINT_ACCOUNT_MAP_SHA256
    || sha256(authority.bytes) !== CHECKPOINT_AUTHORITY_EVIDENCE_SHA256
    || plan.expectedDispositions.ordinalCases.length !== 15
    || plan.expectedDispositions.opcode9ConditionalCases.length !== 6
    || canonicalIatB3ProductionOfficialRehearsalJson(plan.rollbackPlan.exactActiveOpcodes)
      !== canonicalIatB3ProductionOfficialRehearsalJson(EXACT_ROLLBACK_OPCODES)
    || plan.rollbackPlan.forcedFailureOpcode !== 12) {
    fail("SOURCE_PLAN_SHAPE");
  }
  const ordinalCases = plan.expectedDispositions.ordinalCases.map((value) =>
    sourceCase(value, "ORDINAL"));
  const opcode9ConditionalCases = plan.expectedDispositions.opcode9ConditionalCases.map((value) =>
    sourceCase(value, "OPCODE9_CONDITIONAL"));
  if (canonicalIatB3ProductionOfficialRehearsalJson(ordinalCases.map(({ id }) => id))
      !== canonicalIatB3ProductionOfficialRehearsalJson(EXACT_ORDINAL_IDS)
    || canonicalIatB3ProductionOfficialRehearsalJson(opcode9ConditionalCases.map(({ id }) => id))
      !== canonicalIatB3ProductionOfficialRehearsalJson(EXACT_OPCODE9_IDS)) {
    fail("SOURCE_CASE_IDS");
  }
  const core = {
    schema: IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_SOURCE_SCHEMA,
    status: IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_STATUS,
    checkpointHeadSha: IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_CHECKPOINT,
    localRehearsalPlanCoreSha256: plan.planCoreSha256,
    sourceBindingsSha256: sha256IatB3ProductionOfficialRehearsalValue(plan.sourceBindings),
    transactionMap: {
      schema: plan.productionTransactionMap.schema,
      canonicalMapSha256: plan.productionTransactionMap.canonicalMapSha256,
      operationAccountMapSha256: plan.productionTransactionMap.operationAccountMapSha256,
      operationAccountMap: plan.productionTransactionMap.operationAccountMap,
    },
    instructionAbi: {
      magicAscii: "IATB3EC1",
      version: 1,
      exactByteLength: 32,
      payloads: INSTRUCTION_PAYLOADS,
    },
    codecs: plan.codecPlan,
    fixtureRoles: plan.fixturePlan.roles,
    fixtureRolePlanSha256: plan.fixturePlan.fixtureRolePlanSha256,
    expectedDispositionsSha256: IAT_B3_PRODUCTION_EXPECTED_DISPOSITIONS_SHA256,
    ordinalCases,
    opcode9ConditionalCases,
    rollbackRows: plan.rollbackPlan.probes,
    executionOrder: plan.fixturePlan.isolation.exactExecutionOrder,
    buildReceiptSchemas: {
      law: COMBINED_LAW_BUILD_RECEIPT_SCHEMA,
      economy: ECONOMY_BUILD_RECEIPT_SCHEMA,
    },
    authorityEvidence: {
      schema: authority.value.schema,
      sha256: sha256(authority.bytes),
      byteLength: authority.bytes.length,
      status: authority.value.status,
      mainnetStatus: authority.value.authorizationBoundary.mainnetStatus,
      journalStageCount: authority.value.phaseCDeployedSeal.journal.length,
      everyStagePending: true,
      activationStatus: "PENDING",
    },
    safety: {
      authorizesRpc: false,
      authorizesKeyRead: false,
      authorizesSigning: false,
      authorizesSend: false,
      authorizesBuild: false,
      authorizesDeploy: false,
      authorizesStatusPromotion: false,
      officialCompleteAccepted: false,
      mainnetStatus: "HOLD",
    },
    blockers: [
      ...plan.blockers,
      "EXACT_CHECKPOINT_MUST_BE_REOBSERVED_AT_RUNTIME",
      "17_STAGE_AUTHORITY_CEREMONY_PENDING",
      "SOURCE_ONLY_EVIDENCE_CANNOT_AUTHENTICATE_RUNTIME_PROVENANCE",
      "OFFICIAL_COMPLETE_CATEGORICALLY_UNAVAILABLE",
    ],
  };
  return deepFreeze({ ...core, sourceContractSha256: sha256IatB3ProductionOfficialRehearsalValue(core) });
}

export function validateIatB3ProductionOfficialRehearsalSourceContract(contract) {
  const expected = buildIatB3ProductionOfficialRehearsalSourceContract();
  if (canonicalIatB3ProductionOfficialRehearsalJson(contract)
    !== canonicalIatB3ProductionOfficialRehearsalJson(expected)) fail("SOURCE_CONTRACT");
  return contract;
}

const IDENTITY_KEYS = Object.freeze([
  "identityManifestSha256",
  "ownerPolicySha256",
  "environmentBindingSha256",
  "lawProgramId",
  "economyProgramId",
  "canonicalMint",
  "dailyLawState",
  "lawUpgradeAuthority",
  "economyUpgradeAuthority",
  "compiledLawDomainGenesisHash",
]);

function validateIdentities(identities) {
  if (!exactKeys(identities, IDENTITY_KEYS)) fail("IDENTITY_KEYS");
  for (const key of ["identityManifestSha256", "ownerPolicySha256", "environmentBindingSha256"])
    assertHex(identities[key], HEX_SHA256, `IDENTITY_${key}`);
  for (const key of [
    "lawProgramId", "economyProgramId", "canonicalMint", "dailyLawState",
    "lawUpgradeAuthority", "economyUpgradeAuthority", "compiledLawDomainGenesisHash",
  ]) publicKey(identities[key], `IDENTITY_${key}`);
  const distinct = [
    identities.lawProgramId,
    identities.economyProgramId,
    identities.canonicalMint,
    identities.dailyLawState,
  ];
  if (new Set(distinct).size !== distinct.length) fail("IDENTITY_COLLISION");
}

const IDENTITY_EVIDENCE_KEYS = Object.freeze([
  "manifestBytesBase64",
  "manifestByteLength",
  "manifestSha256",
  "fourFieldEnvironment",
  "fourFieldEnvironmentSha256",
  "lawEnvironmentSha256",
]);

function validateIdentityEvidence(evidence, identities) {
  if (!exactKeys(evidence, IDENTITY_EVIDENCE_KEYS)
    || !Number.isSafeInteger(evidence.manifestByteLength)
    || evidence.manifestByteLength <= 0
    || !exactKeys(evidence.fourFieldEnvironment, BUILD_ENVIRONMENT_KEYS)) {
    fail("IDENTITY_EVIDENCE_KEYS");
  }
  const manifestBytes = canonicalBase64(
    evidence.manifestBytesBase64,
    "IDENTITY_MANIFEST_BYTES",
    { allowEmpty: false },
  );
  assertHex(evidence.manifestSha256, HEX_SHA256, "IDENTITY_MANIFEST_SHA256");
  assertHex(
    evidence.fourFieldEnvironmentSha256,
    HEX_SHA256,
    "IDENTITY_ENVIRONMENT_SHA256",
  );
  assertHex(evidence.lawEnvironmentSha256, HEX_SHA256, "IDENTITY_LAW_ENVIRONMENT_SHA256");
  let manifest;
  try {
    manifest = parseIdentityFreezeJson(
      manifestBytes.toString("utf8"),
      "official-local-rehearsal identity manifest",
    );
  } catch {
    fail("IDENTITY_MANIFEST_STRICT_JSON");
  }
  const environment = evidence.fourFieldEnvironment;
  const expectedEnvironment = {
    IAT_B3_PRODUCTION_LAW_PROGRAM_ID: identities.lawProgramId,
    IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID: identities.economyProgramId,
    IAT_B3_PRODUCTION_CANONICAL_MINT: identities.canonicalMint,
    IAT_B3_PRODUCTION_MAINNET_GENESIS_HASH: identities.compiledLawDomainGenesisHash,
  };
  const lawEnvironment = Object.fromEntries(
    LAW_BUILD_ENVIRONMENT_KEYS.map((key) => [key, environment[key]]),
  );
  if (evidence.manifestByteLength !== manifestBytes.length
    || evidence.manifestSha256 !== sha256(manifestBytes)
    || evidence.manifestSha256 !== identities.identityManifestSha256
    || canonicalIatB3ProductionOfficialRehearsalJson(environment)
      !== canonicalIatB3ProductionOfficialRehearsalJson(expectedEnvironment)
    || new Set(Object.values(environment)).size !== 4
    || evidence.fourFieldEnvironmentSha256
      !== sha256IatB3ProductionOfficialRehearsalValue(environment)
    || evidence.fourFieldEnvironmentSha256 !== identities.environmentBindingSha256
    || evidence.lawEnvironmentSha256
      !== sha256IatB3ProductionOfficialRehearsalValue(lawEnvironment)
    || manifest?.identities?.lawProgramId !== identities.lawProgramId
    || manifest?.identities?.economyProgramId !== identities.economyProgramId
    || manifest?.identities?.canonicalMint !== identities.canonicalMint
    || manifest?.networkBinding?.genesisHash !== identities.compiledLawDomainGenesisHash) {
    fail("IDENTITY_MANIFEST_ENVIRONMENT_BINDING");
  }
  for (const value of Object.values(environment)) publicKey(value, "IDENTITY_ENVIRONMENT_VALUE");
  return deepFreeze({ ...evidence, fourFieldEnvironment: { ...environment } });
}

function validateGenesisDomains(domains, identities) {
  if (!exactKeys(domains, [
    "validatorGenesisHash",
    "compiledLawDomainGenesisHash",
    "negativeLocalDomainGenesisHash",
    "validatorClaimedAsMainnet",
    "negativeExpectedEconomyErrorCode",
    "positiveExpectedDailyLawAcceptance",
  ])) fail("GENESIS_DOMAIN_KEYS");
  for (const key of [
    "validatorGenesisHash", "compiledLawDomainGenesisHash", "negativeLocalDomainGenesisHash",
  ]) publicKey(domains[key], `GENESIS_${key}`);
  if (domains.compiledLawDomainGenesisHash !== identities.compiledLawDomainGenesisHash
    || domains.validatorGenesisHash === domains.compiledLawDomainGenesisHash
    || domains.negativeLocalDomainGenesisHash !== domains.validatorGenesisHash
    || domains.validatorClaimedAsMainnet !== false
    || domains.negativeExpectedEconomyErrorCode !== 0xe503
    || domains.positiveExpectedDailyLawAcceptance !== true) fail("GENESIS_DOMAIN_SEPARATION");
}

function validateArtifact(kind, artifact, receipt) {
  if (!exactKeys(artifact, ["fileName", "bytesBase64", "byteLength", "sha256"])) {
    fail(`${kind}_ARTIFACT_KEYS`);
  }
  const bytes = canonicalBase64(artifact.bytesBase64, `${kind}_ARTIFACT_BYTES`, { allowEmpty: false });
  assertHex(artifact.sha256, HEX_SHA256, `${kind}_ARTIFACT_SHA256`);
  if (artifact.byteLength !== bytes.length || artifact.sha256 !== sha256(bytes)
    || receipt.artifact.fileName !== artifact.fileName
    || receipt.artifact.byteLength !== artifact.byteLength
    || receipt.artifact.sha256 !== artifact.sha256
    || receipt.artifact.identicalBytes !== true
    || receipt.artifact.preservedArtifactSha256 !== artifact.sha256
    || receipt.artifact.preservedArtifactByteLength !== artifact.byteLength) {
    fail(`${kind}_ARTIFACT_RECEIPT_BINDING`);
  }
  return bytes;
}

function decodeUpgradeableProgramAccount(dataBase64, expectedProgramData) {
  const bytes = canonicalBase64(dataBase64, "PROGRAM_ACCOUNT_DATA");
  if (bytes.length !== 36 || bytes.readUInt32LE(0) !== 2
    || new PublicKey(bytes.subarray(4, 36)).toBase58() !== expectedProgramData) {
    fail("PROGRAM_ACCOUNT_CODEC");
  }
  return bytes;
}

function decodeUpgradeableProgramData(dataBase64, authority, artifactBytes) {
  const bytes = canonicalBase64(dataBase64, "PROGRAMDATA_ACCOUNT_DATA", { allowEmpty: false });
  if (bytes.length !== 45 + artifactBytes.length || bytes.readUInt32LE(0) !== 3
    || bytes[12] !== 1 || new PublicKey(bytes.subarray(13, 45)).toBase58() !== authority
    || !bytes.subarray(45).equals(artifactBytes)) fail("PROGRAMDATA_CODEC_OR_ELF");
  return bytes;
}

function validateDeployment(kind, deployment, identities, artifactBytes) {
  if (!exactKeys(deployment, ["program", "programData"])) fail(`${kind}_DEPLOYMENT_KEYS`);
  const programId = identities[`${kind.toLowerCase()}ProgramId`];
  const authority = identities[`${kind.toLowerCase()}UpgradeAuthority`];
  if (!exactKeys(deployment.program, [
    "pubkey", "owner", "executable", "lamports", "rentEpoch", "dataBase64",
  ]) || !exactKeys(deployment.programData, [
    "pubkey", "owner", "executable", "lamports", "rentEpoch", "dataBase64",
  ])) fail(`${kind}_DEPLOYMENT_ACCOUNT_KEYS`);
  const expectedProgramData = PublicKey.findProgramAddressSync(
    [publicKey(programId).toBuffer()],
    UPGRADEABLE_LOADER,
  )[0].toBase58();
  if (deployment.program.pubkey !== programId
    || deployment.program.owner !== IAT_B3_UPGRADEABLE_LOADER_PROGRAM_ID
    || deployment.program.executable !== true
    || deployment.programData.pubkey !== expectedProgramData
    || deployment.programData.owner !== IAT_B3_UPGRADEABLE_LOADER_PROGRAM_ID
    || deployment.programData.executable !== false
    || !Number.isSafeInteger(deployment.program.lamports) || deployment.program.lamports < 0
    || !Number.isSafeInteger(deployment.programData.lamports) || deployment.programData.lamports < 0
    || !Number.isSafeInteger(deployment.program.rentEpoch) || deployment.program.rentEpoch < 0
    || !Number.isSafeInteger(deployment.programData.rentEpoch) || deployment.programData.rentEpoch < 0) {
    fail(`${kind}_DEPLOYMENT_BINDING`);
  }
  const programBytes = decodeUpgradeableProgramAccount(
    deployment.program.dataBase64,
    expectedProgramData,
  );
  const programDataBytes = decodeUpgradeableProgramData(
    deployment.programData.dataBase64,
    authority,
    artifactBytes,
  );
  return {
    programId,
    programDataAddress: expectedProgramData,
    programAccountSha256: sha256(programBytes),
    programDataAccountSha256: sha256(programDataBytes),
    deployedElfSha256: sha256(artifactBytes),
  };
}

const PRODUCTION_EVIDENCE_KEYS = Object.freeze([
  "buildReceipts",
  "artifacts",
  "deployments",
]);

function validateProductionEvidence(
  evidence,
  identities,
  identityEvidence,
  declaredHeadSha,
  { validateDefaultReceipts = true } = {},
) {
  if (!exactKeys(evidence, PRODUCTION_EVIDENCE_KEYS)
    || !exactKeys(evidence.buildReceipts, ["law", "economy"])
    || !exactKeys(evidence.artifacts, ["law", "economy"])
    || !exactKeys(evidence.deployments, ["law", "economy"])) {
    fail("PRODUCTION_EVIDENCE_KEYS");
  }
  if (validateDefaultReceipts) {
    validateCombinedLawBuildReceipt(evidence.buildReceipts.law);
    validateEconomyBuildReceipt(evidence.buildReceipts.economy);
  }
  if (evidence.buildReceipts.law.schema !== COMBINED_LAW_BUILD_RECEIPT_SCHEMA
    || evidence.buildReceipts.economy.schema !== ECONOMY_BUILD_RECEIPT_SCHEMA
    || evidence.buildReceipts.law.source.declaredHeadSha !== declaredHeadSha
    || evidence.buildReceipts.economy.source.declaredHeadSha !== declaredHeadSha
    || evidence.buildReceipts.law.identityBinding.manifestSha256
      !== identities.identityManifestSha256
    || evidence.buildReceipts.economy.identityBinding.manifestSha256
      !== identities.identityManifestSha256
    || evidence.buildReceipts.economy.identityBinding.ownerPolicySha256
      !== identities.ownerPolicySha256
    || evidence.buildReceipts.law.identityBinding.environmentBindingSha256
      !== identityEvidence.lawEnvironmentSha256
    || evidence.buildReceipts.economy.identityBinding.environmentBindingSha256
      !== identityEvidence.fourFieldEnvironmentSha256) {
    fail("BUILD_RECEIPT_IDENTITY_OR_HEAD");
  }
  const lawArtifact = validateArtifact(
    "LAW",
    evidence.artifacts.law,
    evidence.buildReceipts.law,
  );
  const economyArtifact = validateArtifact(
    "ECONOMY",
    evidence.artifacts.economy,
    evidence.buildReceipts.economy,
  );
  const deployments = {
    law: validateDeployment("LAW", evidence.deployments.law, identities, lawArtifact),
    economy: validateDeployment(
      "ECONOMY",
      evidence.deployments.economy,
      identities,
      economyArtifact,
    ),
  };
  return {
    buildReceiptBindings: {
      law: sha256IatB3ProductionOfficialRehearsalValue(evidence.buildReceipts.law),
      economy: sha256IatB3ProductionOfficialRehearsalValue(evidence.buildReceipts.economy),
    },
    artifactBindings: {
      law: {
        fileName: evidence.artifacts.law.fileName,
        byteLength: lawArtifact.length,
        sha256: sha256(lawArtifact),
      },
      economy: {
        fileName: evidence.artifacts.economy.fileName,
        byteLength: economyArtifact.length,
        sha256: sha256(economyArtifact),
      },
    },
    deployments,
  };
}

function rolePlanFor(contract, role) {
  const value = contract.fixtureRoles.find((entry) => entry.role === role);
  if (!value) fail("FIXTURE_ROLE_UNKNOWN");
  return value;
}

function validatePdaBinding(pda, pubkeyValue) {
  if (pda === null) return null;
  if (!exactKeys(pda, ["programId", "seedsBase64", "bump"]) || !Array.isArray(pda.seedsBase64)
    || pda.seedsBase64.length === 0 || !Number.isInteger(pda.bump)
    || pda.bump < 0 || pda.bump > 255) fail("PDA_KEYS");
  const seeds = pda.seedsBase64.map((seed) => {
    const bytes = canonicalBase64(seed, "PDA_SEED", { allowEmpty: false });
    if (bytes.length > 32) fail("PDA_SEED_LENGTH");
    return bytes;
  });
  const [derived, bump] = PublicKey.findProgramAddressSync(seeds, publicKey(pda.programId));
  if (derived.toBase58() !== pubkeyValue || bump !== pda.bump) fail("PDA_DERIVATION");
  return { programId: pda.programId, seedsBase64: [...pda.seedsBase64], bump };
}

const FIXTURE_KEYS = Object.freeze([
  "id", "purpose", "role", "codec", "pubkey", "owner", "executable", "lamports",
  "rentEpoch", "dataBase64", "dataSha256", "decodedState", "decodedStateSha256", "pda",
]);

function assertDecodedFixtureInvariants(fixture, decoded, identities, genesisDomains) {
  const configPda = derivedEconomyPda(identities, "config", identities.canonicalMint);
  if (fixture.codec === "LAW_STATE_V1") {
    const expectedDomain = fixture.purpose === "NEGATIVE_LOCAL_DOMAIN"
      ? genesisDomains?.negativeLocalDomainGenesisHash
      : identities.compiledLawDomainGenesisHash;
    if (decoded.mint !== identities.canonicalMint
      || decoded.compiledLawDomainGenesisHash !== expectedDomain
      || !exactKeys(decoded.decision, [
        "locked", "localDay", "entropySlot", "ancestorSlotHash", "drawCounter",
        "drawBucket", "chanceNumerator", "chanceDenominator",
      ])
      || decoded.decision.locked !== false
      || !HEX_SHA256.test(decoded.decision.ancestorSlotHash)
      || decoded.decision.ancestorSlotHash === ZERO_SHA256
      || !Number.isInteger(decoded.decision.drawBucket)
      || decoded.decision.drawBucket < 0
      || !Number.isInteger(decoded.decision.chanceNumerator)
      || !Number.isInteger(decoded.decision.chanceDenominator)
      || decoded.decision.chanceNumerator > decoded.decision.chanceDenominator
      || decoded.decision.chanceDenominator <= 0) fail("LAW_FIXTURE_DOMAIN_OR_OPEN_DECISION");
  } else if (fixture.codec === "ECONOMY_CONFIG_V1") {
    if (decoded.mint !== identities.canonicalMint
      || decoded.tokenProgram !== TOKEN_2022_PROGRAM_ID.toBase58()
      || fixture.pubkey !== configPda) fail("CONFIG_FIXTURE_IDENTITY");
  } else if (fixture.codec === "ECONOMY_POSITION_V1") {
    let positionId;
    try {
      positionId = BigInt(decoded.positionId);
    } catch {
      fail("POSITION_FIXTURE_ID");
    }
    if (positionId < 0n || positionId > (1n << 64n) - 1n) fail("POSITION_FIXTURE_ID");
    const positionIdBytes = Buffer.alloc(8);
    positionIdBytes.writeBigUInt64LE(positionId);
    if (decoded.config !== configPda || fixture.pubkey !== derivedEconomyPda(
      identities,
      "position",
      configPda,
      decoded.owner,
      positionIdBytes,
    )) fail("POSITION_FIXTURE_PDA");
  } else if (fixture.codec === "ECONOMY_LANE_V1") {
    if (decoded.config !== configPda || ![1, 2, 3, 4].includes(decoded.lane)
      || fixture.pubkey !== derivedEconomyPda(
        identities,
        "lane",
        configPda,
        Buffer.from([decoded.lane]),
      ) || decoded.tokenAccount !== derivedEconomyPda(
        identities,
        "lane-token",
        configPda,
        Buffer.from([decoded.lane]),
      )) fail("LANE_FIXTURE_PDA");
  } else if (fixture.codec === "ECONOMY_ELIGIBILITY_V1") {
    if (decoded.config !== configPda || fixture.pubkey !== derivedEconomyPda(
      identities,
      "eligibility",
      configPda,
      decoded.wallet,
    )) fail("ELIGIBILITY_FIXTURE_PDA");
  } else if (fixture.codec === "TOKEN_2022_MINT" && fixture.pubkey !== identities.canonicalMint) {
    fail("MINT_FIXTURE_IDENTITY");
  } else if (fixture.codec === "TOKEN_2022_ACCOUNT" && decoded.mint !== identities.canonicalMint) {
    fail("TOKEN_FIXTURE_MINT");
  }
}

export function validateAndPackIatB3ProductionConcreteFixture(
  fixture,
  {
    sourceContract,
    identities,
    genesisDomains = null,
    decodeFixture = decodeIatB3ProductionFixtureState,
  } = {},
) {
  if (!exactKeys(fixture, FIXTURE_KEYS) || typeof fixture.id !== "string" || fixture.id.length === 0
    || typeof fixture.purpose !== "string" || fixture.purpose.length === 0
    || typeof fixture.role !== "string" || fixture.role.length === 0) fail("FIXTURE_KEYS");
  const rolePlan = rolePlanFor(sourceContract, fixture.role);
  if (!rolePlan.codecAlternatives.includes(fixture.codec)) fail("FIXTURE_CODEC_ROLE");
  publicKey(fixture.pubkey, "FIXTURE_PUBLIC_KEY");
  publicKey(fixture.owner, "FIXTURE_OWNER");
  if (typeof fixture.executable !== "boolean"
    || !Number.isSafeInteger(fixture.lamports) || fixture.lamports < 0
    || !Number.isSafeInteger(fixture.rentEpoch) || fixture.rentEpoch < 0) fail("FIXTURE_ACCOUNT_FIELDS");
  const bytes = canonicalBase64(fixture.dataBase64, "FIXTURE_DATA");
  assertHex(fixture.dataSha256, HEX_SHA256, "FIXTURE_DATA_SHA256");
  assertHex(fixture.decodedStateSha256, HEX_SHA256, "FIXTURE_DECODED_SHA256");
  if (fixture.dataSha256 !== sha256(bytes)) fail("FIXTURE_DATA_HASH");
  const decoded = decodeFixture({
    codec: fixture.codec,
    pubkey: fixture.pubkey,
    owner: fixture.owner,
    dataBase64: fixture.dataBase64,
  });
  if (canonicalIatB3ProductionOfficialRehearsalJson(decoded)
      !== canonicalIatB3ProductionOfficialRehearsalJson(fixture.decodedState)
    || fixture.decodedStateSha256 !== sha256IatB3ProductionOfficialRehearsalValue(decoded)) {
    fail("FIXTURE_DECODED_BINDING");
  }
  const ownerRules = {
    LAW_PROGRAM: identities.lawProgramId,
    ECONOMY_PROGRAM: identities.economyProgramId,
    TOKEN_2022_PROGRAM: TOKEN_2022_PROGRAM_ID.toBase58(),
    SYSTEM_PROGRAM: SystemProgram.programId.toBase58(),
    NATIVE_LOADER: NATIVE_LOADER_PROGRAM_ID,
    BPF_UPGRADEABLE_LOADER: IAT_B3_UPGRADEABLE_LOADER_PROGRAM_ID,
  };
  const exactOwner = rolePlan.ownerRule === "ECONOMY_PROGRAM_OR_SYSTEM_VACANT_BY_CASE"
    ? fixture.codec === "SYSTEM_VACANT"
      ? SystemProgram.programId.toBase58() : identities.economyProgramId
    : ownerRules[rolePlan.ownerRule];
  if (exactOwner && fixture.owner !== exactOwner) fail("FIXTURE_OWNER_RULE");
  assertDecodedFixtureInvariants(fixture, decoded, identities, genesisDomains);
  const pda = validatePdaBinding(fixture.pda, fixture.pubkey);
  return deepFreeze({
    ...fixture,
    dataLength: bytes.length,
    pda,
  });
}

function operationVariant(contract, opcode, variant) {
  const operation = contract.transactionMap.operationAccountMap.find((entry) => entry.opcode === opcode);
  const result = operation?.variants.find((entry) => entry.variant === variant);
  if (!result) fail("CASE_VARIANT");
  return result;
}

const CASE_KEYS = Object.freeze([
  "id", "opcode", "variant", "lane", "instructionDataBase64", "accounts", "signerRoles",
  "expected",
]);
const EXPECTED_KEYS = Object.freeze([
  "disposition", "errorCode", "logs", "innerCpi", "beforeStateSetSha256",
  "afterStateSetSha256", "terminalStateSetSha256", "feePayerOnlyNoEffect",
]);

function validateInnerCpi(innerCpi) {
  if (!Array.isArray(innerCpi) || innerCpi.some((entry) => !exactKeys(entry, [
    "instructionIndex", "stackHeight", "programId", "accounts", "dataBase64",
  ]) || !Number.isSafeInteger(entry.instructionIndex) || entry.instructionIndex < 0
    || !Number.isSafeInteger(entry.stackHeight) || entry.stackHeight < 2
    || (() => { try { publicKey(entry.programId); return false; } catch { return true; } })()
    || !Array.isArray(entry.accounts) || entry.accounts.some((key) => {
      try { publicKey(key); return false; } catch { return true; }
    }) || !canonicalBase64(entry.dataBase64, "INNER_CPI_DATA"))) fail("INNER_CPI");
}

function accountPubkeysForRoles(accountBindings, roles, code) {
  const byRole = new Map(accountBindings.map((binding) => [binding.role, binding.pubkey]));
  return roles.map((role) => {
    const value = byRole.get(role);
    if (!value) fail(code);
    return value;
  });
}

function validateTransferCheckedData(dataBase64) {
  const data = canonicalBase64(dataBase64, "TOKEN_TRANSFER_CHECKED_DATA", { allowEmpty: false });
  if (data.length !== 10 || data[0] !== 12 || data[9] !== TOKEN_DECIMALS
    || data.readBigUInt64LE(1) === 0n) fail("TOKEN_TRANSFER_CHECKED_DATA");
  return data.readBigUInt64LE(1);
}

function validateApproveCheckedCpi(entry, accountBindings, roles, expectedAmount, instructionIndex) {
  const data = canonicalBase64(entry.dataBase64, "TOKEN_APPROVE_CHECKED_DATA", {
    allowEmpty: false,
  });
  const expectedAccounts = accountPubkeysForRoles(
    accountBindings,
    roles,
    "TOKEN_APPROVE_CHECKED_ROLES",
  );
  if (entry.instructionIndex !== instructionIndex || entry.stackHeight !== 2
    || entry.programId !== TOKEN_2022_PROGRAM_ID.toBase58()
    || canonicalIatB3ProductionOfficialRehearsalJson(entry.accounts)
      !== canonicalIatB3ProductionOfficialRehearsalJson(expectedAccounts)
    || data.length !== 10 || data[0] !== 13 || data[9] !== TOKEN_DECIMALS
    || data.readBigUInt64LE(1) !== expectedAmount || expectedAmount === 0n) {
    fail("TOKEN_APPROVE_CHECKED_CPI");
  }
}

function validateHookExecuteData(dataBase64, amount) {
  const data = canonicalBase64(dataBase64, "HOOK_EXECUTE_DATA", { allowEmpty: false });
  if (data.length !== 16
    || !data.subarray(0, 8).equals(TRANSFER_HOOK_EXECUTE_DISCRIMINATOR)
    || data.readBigUInt64LE(8) !== amount) {
    fail("HOOK_EXECUTE_DATA");
  }
}

function transferRoleGroups(opcode) {
  if (opcode === 6) return [[
    "owner_tokens", "mint", "stake_tokens", "ingress_authority",
    "daily_law_state", "transfer_hook_validation", "transfer_hook_program",
  ]];
  if (opcode === 7) return ["treasury_tokens", "ecosystem_tokens", "liquidity_tokens"]
    .map((source) => [
      source, "mint", "destination_tokens", "vault_authority",
      "daily_law_state", "transfer_hook_validation", "transfer_hook_program",
    ]);
  if (opcode === 9) return [[
    "lane_tokens", "mint", "destination_tokens", "vault_authority",
    "daily_law_state", "transfer_hook_validation", "transfer_hook_program",
  ]];
  if (opcode === 10) return [[
    "stake_tokens", "mint", "destination_tokens", "vault_authority",
    "daily_law_state", "transfer_hook_validation", "transfer_hook_program",
  ]];
  return [];
}

function validateSystemCreateCpi(
  entry,
  accountBindings,
  identities,
  payerRole,
  targetRole,
  expectedSpace,
  instructionIndex = 0,
) {
  const expectedAccounts = accountPubkeysForRoles(
    accountBindings,
    [payerRole, targetRole],
    "SYSTEM_CREATE_ACCOUNT_ROLES",
  );
  const data = canonicalBase64(entry.dataBase64, "SYSTEM_CREATE_ACCOUNT_DATA", {
    allowEmpty: false,
  });
  if (entry.instructionIndex !== instructionIndex
    || entry.programId !== SystemProgram.programId.toBase58()
    || entry.stackHeight !== 2
    || canonicalIatB3ProductionOfficialRehearsalJson(entry.accounts)
      !== canonicalIatB3ProductionOfficialRehearsalJson(expectedAccounts)
    || data.length !== 52 || data.readUInt32LE(0) !== 0
    || data.readBigUInt64LE(4) === 0n
    || data.readBigUInt64LE(12) !== expectedSpace
    || !data.subarray(20, 52).equals(publicKey(identities.economyProgramId).toBuffer())) {
    fail("SYSTEM_CREATE_ACCOUNT_CPI");
  }
}

function validateSystemTransferCpi(entry, accountBindings, payerRole, targetRole, instructionIndex) {
  const data = canonicalBase64(entry.dataBase64, "SYSTEM_TRANSFER_DATA", { allowEmpty: false });
  if (entry.instructionIndex !== instructionIndex || entry.stackHeight !== 2
    || entry.programId !== SystemProgram.programId.toBase58()
    || canonicalIatB3ProductionOfficialRehearsalJson(entry.accounts)
      !== canonicalIatB3ProductionOfficialRehearsalJson(accountPubkeysForRoles(
        accountBindings,
        [payerRole, targetRole],
        "SYSTEM_TRANSFER_ROLES",
      ))
    || data.length !== 12 || data.readUInt32LE(0) !== 2
    || data.readBigUInt64LE(4) === 0n) fail("SYSTEM_TRANSFER_CPI");
  return data.readBigUInt64LE(4);
}

function validateSystemAllocateCpi(entry, accountBindings, targetRole, expectedSpace, instructionIndex) {
  const data = canonicalBase64(entry.dataBase64, "SYSTEM_ALLOCATE_DATA", { allowEmpty: false });
  if (entry.instructionIndex !== instructionIndex || entry.stackHeight !== 2
    || entry.programId !== SystemProgram.programId.toBase58()
    || canonicalIatB3ProductionOfficialRehearsalJson(entry.accounts)
      !== canonicalIatB3ProductionOfficialRehearsalJson(accountPubkeysForRoles(
        accountBindings,
        [targetRole],
        "SYSTEM_ALLOCATE_ROLES",
      ))
    || data.length !== 12 || data.readUInt32LE(0) !== 8
    || data.readBigUInt64LE(4) !== expectedSpace) fail("SYSTEM_ALLOCATE_CPI");
}

function validateSystemAssignCpi(entry, accountBindings, identities, targetRole, instructionIndex) {
  const data = canonicalBase64(entry.dataBase64, "SYSTEM_ASSIGN_DATA", { allowEmpty: false });
  if (entry.instructionIndex !== instructionIndex || entry.stackHeight !== 2
    || entry.programId !== SystemProgram.programId.toBase58()
    || canonicalIatB3ProductionOfficialRehearsalJson(entry.accounts)
      !== canonicalIatB3ProductionOfficialRehearsalJson(accountPubkeysForRoles(
        accountBindings,
        [targetRole],
        "SYSTEM_ASSIGN_ROLES",
      ))
    || data.length !== 36 || data.readUInt32LE(0) !== 1
    || !data.subarray(4).equals(publicKey(identities.economyProgramId).toBuffer())) {
    fail("SYSTEM_ASSIGN_CPI");
  }
}

function fixtureForBindingRole(fixtures, accountBindings, role) {
  const binding = accountBindings.find((entry) => entry.role === role);
  const fixture = binding && fixtures.find((entry) => entry.id === binding.fixtureId);
  if (!binding || !fixture || binding.pubkey !== fixture.pubkey) fail("CPI_FIXTURE_BINDING");
  return fixture;
}

function validateAccountLifecycleCpi(
  entries,
  accountBindings,
  fixtures,
  identities,
  payerRole,
  targetRole,
  expectedSpace,
  expectedInitializedCodec,
  instructionIndex,
) {
  const target = fixtureForBindingRole(fixtures, accountBindings, targetRole);
  if (target.codec === expectedInitializedCodec) {
    if (entries.length !== 0) fail("LIFECYCLE_EXISTING_UNEXPECTED_CPI");
    return { variant: "EXISTING", fundingLamports: 0n };
  }
  if (target.codec !== "SYSTEM_VACANT" || target.owner !== SystemProgram.programId.toBase58()
    || Buffer.from(target.dataBase64, "base64").length !== 0) fail("LIFECYCLE_TARGET_STATE");
  if (target.lamports === 0) {
    if (entries.length !== 1 || entries[0].instructionIndex !== instructionIndex) {
      fail("LIFECYCLE_CREATE_CPI_COUNT");
    }
    validateSystemCreateCpi(
      entries[0],
      accountBindings,
      identities,
      payerRole,
      targetRole,
      expectedSpace,
      instructionIndex,
    );
    return {
      variant: "CREATE",
      fundingLamports: canonicalBase64(entries[0].dataBase64, "SYSTEM_CREATE_AMOUNT")
        .readBigUInt64LE(4),
    };
  }
  if (![2, 3].includes(entries.length)) fail("LIFECYCLE_PREFUNDED_CPI_COUNT");
  let cursor = 0;
  let fundingLamports = 0n;
  if (entries.length === 3) {
    fundingLamports = validateSystemTransferCpi(
      entries[cursor],
      accountBindings,
      payerRole,
      targetRole,
      instructionIndex,
    );
    cursor += 1;
  }
  validateSystemAllocateCpi(
    entries[cursor],
    accountBindings,
    targetRole,
    expectedSpace,
    instructionIndex,
  );
  validateSystemAssignCpi(
    entries[cursor + 1],
    accountBindings,
    identities,
    targetRole,
    instructionIndex,
  );
  return { variant: fundingLamports === 0n ? "PREFUNDED" : "PREFUNDED_TOP_UP", fundingLamports };
}

function validateTokenHookPair(token, hook, roles, accountBindings, identities, instructionIndex) {
  const tokenAccounts = accountPubkeysForRoles(
    accountBindings,
    roles,
    "TOKEN_TRANSFER_ACCOUNT_ROLES",
  );
  const hookAccounts = [
    tokenAccounts[0], tokenAccounts[1], tokenAccounts[2], tokenAccounts[3],
    tokenAccounts[5], tokenAccounts[4],
  ];
  const amount = validateTransferCheckedData(token.dataBase64);
  if (token.instructionIndex !== instructionIndex || token.stackHeight !== 2
    || token.programId !== TOKEN_2022_PROGRAM_ID.toBase58()
    || canonicalIatB3ProductionOfficialRehearsalJson(token.accounts)
      !== canonicalIatB3ProductionOfficialRehearsalJson(tokenAccounts)
    || hook.instructionIndex !== instructionIndex || hook.stackHeight !== 3
    || hook.programId !== identities.lawProgramId
    || canonicalIatB3ProductionOfficialRehearsalJson(hook.accounts)
      !== canonicalIatB3ProductionOfficialRehearsalJson(hookAccounts)) {
    fail("TOKEN_HOOK_CPI_SOURCE_BINDING");
  }
  validateHookExecuteData(hook.dataBase64, amount);
  return amount;
}

function validateSourceDerivedInnerCpi(
  innerCpi,
  opcode,
  accountBindings,
  identities,
  fixtures,
  instruction,
  instructionIndex = 0,
) {
  validateInnerCpi(innerCpi);
  if (opcode === 5) {
    return validateAccountLifecycleCpi(
      innerCpi,
      accountBindings,
      fixtures,
      identities,
      "admin",
      "eligibility",
      ELIGIBILITY_ACCOUNT_LEN,
      "ECONOMY_ELIGIBILITY_V1",
      instructionIndex,
    );
  }
  const groups = transferRoleGroups(opcode);
  if (groups.length === 0) {
    if (innerCpi.length !== 0) fail("UNEXPECTED_INNER_CPI");
    return { transferAmounts: [] };
  }
  if (opcode === 6) {
    const principal = instruction.readBigUInt64LE(24);
    if (principal === 0n || innerCpi.length < 3) fail("OPEN_POSITION_PRINCIPAL_OR_CPI");
    validateApproveCheckedCpi(
      innerCpi[0],
      accountBindings,
      ["owner_tokens", "mint", "ingress_authority", "owner"],
      principal,
      instructionIndex,
    );
    const amount = validateTokenHookPair(
      innerCpi[1],
      innerCpi[2],
      groups[0],
      accountBindings,
      identities,
      instructionIndex,
    );
    if (amount !== principal) fail("OPEN_POSITION_TRANSFER_PRINCIPAL");
    let cursor = 3;
    const priorDelegate = accountBindings.find(({ role }) => role === "prior_delegate");
    if (priorDelegate) {
      const ownerTokens = fixtureForBindingRole(fixtures, accountBindings, "owner_tokens");
      const delegatedAmount = BigInt(ownerTokens.decodedState.delegatedAmount);
      if (ownerTokens.decodedState.delegate !== priorDelegate.pubkey || delegatedAmount === 0n) {
        fail("OPEN_POSITION_PRIOR_DELEGATE_STATE");
      }
      validateApproveCheckedCpi(
        innerCpi[cursor],
        accountBindings,
        ["owner_tokens", "mint", "prior_delegate", "owner"],
        delegatedAmount,
        instructionIndex,
      );
      cursor += 1;
    } else if (fixtureForBindingRole(fixtures, accountBindings, "owner_tokens")
      .decodedState.delegate !== null) {
      fail("OPEN_POSITION_DELEGATE_RESTORE_META_MISSING");
    }
    const lifecycle = validateAccountLifecycleCpi(
      innerCpi.slice(cursor),
      accountBindings,
      fixtures,
      identities,
      "owner",
      "position",
      POSITION_ACCOUNT_LEN,
      "ECONOMY_POSITION_V1",
      instructionIndex,
    );
    return { transferAmounts: [principal], lifecycle };
  }
  if (innerCpi.length % 2 !== 0 || innerCpi.length === 0) fail("TOKEN_HOOK_CPI_COUNT");
  const transferAmounts = [];
  let previousGroup = -1;
  for (let cursor = 0; cursor < innerCpi.length; cursor += 2) {
    let matchedGroup = -1;
    for (let groupIndex = previousGroup + 1; groupIndex < groups.length; groupIndex += 1) {
      const expectedFirst = accountPubkeysForRoles(
        accountBindings,
        groups[groupIndex],
        "TOKEN_TRANSFER_ACCOUNT_ROLES",
      )[0];
      if (innerCpi[cursor].accounts[0] === expectedFirst) {
        matchedGroup = groupIndex;
        break;
      }
    }
    if (matchedGroup < 0) fail("TOKEN_HOOK_LANE_ORDER");
    const amount = validateTokenHookPair(
      innerCpi[cursor],
      innerCpi[cursor + 1],
      groups[matchedGroup],
      accountBindings,
      identities,
      instructionIndex,
    );
    transferAmounts.push({ groupIndex: matchedGroup, amount });
    previousGroup = matchedGroup;
  }
  if ((opcode === 9 || opcode === 10) && transferAmounts.length !== 1) {
    fail("SINGLE_TRANSFER_CPI_COUNT");
  }
  return { transferAmounts };
}

function expectedProgramBoundaryLogs(identities, outcomes, innerCpi) {
  const result = [];
  for (let instructionIndex = 0; instructionIndex < outcomes.length; instructionIndex += 1) {
    result.push(`Program ${identities.economyProgramId} invoke [1]`);
    const stack = [];
    for (const entry of innerCpi.filter((value) => value.instructionIndex === instructionIndex)) {
      while (stack.length > 0 && stack.at(-1).stackHeight >= entry.stackHeight) {
        result.push(`Program ${stack.pop().programId} success`);
      }
      result.push(`Program ${entry.programId} invoke [${entry.stackHeight}]`);
      stack.push(entry);
    }
    while (stack.length > 0) result.push(`Program ${stack.pop().programId} success`);
    const { errorCode } = outcomes[instructionIndex];
    result.push(errorCode === null
      ? `Program ${identities.economyProgramId} success`
      : `Program ${identities.economyProgramId} failed: custom program error: 0x${errorCode.toString(16)}`);
  }
  return result;
}

function validateSourceDerivedLogs(logs, identities, outcomes, innerCpi) {
  if (!Array.isArray(logs) || logs.some((line) => typeof line !== "string")) fail("CASE_LOGS");
  const boundary = /^(?:Program) ([1-9A-HJ-NP-Za-km-z]+) (?:invoke \[([0-9]+)\]|success|failed:.*)$/u;
  const observedBoundary = logs.filter((line) => boundary.test(line));
  const expectedBoundary = expectedProgramBoundaryLogs(identities, outcomes, innerCpi);
  if (canonicalIatB3ProductionOfficialRehearsalJson(observedBoundary)
    !== canonicalIatB3ProductionOfficialRehearsalJson(expectedBoundary)) fail("CASE_LOG_ENVELOPE");
}

function assertExactInstructionAbi(instruction, opcode, lane) {
  if (instruction.length !== 32 || instruction.subarray(0, 8).toString("ascii") !== "IATB3EC1"
    || instruction[8] !== 1 || instruction[9] !== opcode
    || instruction.subarray(10, 16).some((byte) => byte !== 0)) fail("INSTRUCTION_ABI");
  const allowed = new Set();
  const payload = INSTRUCTION_PAYLOADS.find((entry) => entry.opcode === opcode);
  if (!payload) fail("INSTRUCTION_OPCODE");
  for (const field of payload.fields) {
    if (field.type === "u8") allowed.add(field.offset);
    else if (field.type === "u64") {
      for (let index = field.offset; index < field.offset + 8; index += 1) allowed.add(index);
    } else if (field.type === "option_u32") {
      allowed.add(field.tagOffset);
      for (let index = field.valueOffset; index < field.valueOffset + 4; index += 1) allowed.add(index);
      if (![0, 1].includes(instruction[field.tagOffset])
        || (instruction[field.tagOffset] === 0
          && instruction.subarray(field.valueOffset, field.valueOffset + 4)
            .some((byte) => byte !== 0))) fail("INSTRUCTION_OPTION_U32");
    }
  }
  for (let index = 16; index < 32; index += 1) {
    if (!allowed.has(index) && instruction[index] !== 0) fail("INSTRUCTION_RESERVED_BYTES");
  }
  if (opcode === 9 && instruction[16] !== lane) fail("INSTRUCTION_LANE");
}

function validateExpected(
  expected,
  sourceCaseValue,
  opcode,
  accountBindings,
  identities,
  fixtures,
  instruction,
) {
  if (!exactKeys(expected, EXPECTED_KEYS)
    || expected.disposition !== sourceCaseValue.disposition
    || expected.errorCode !== sourceCaseValue.expectedErrorCode
    || expected.feePayerOnlyNoEffect !== (sourceCaseValue.disposition !== ACTIVE_DISPOSITION)) {
    fail("CASE_EXPECTED");
  }
  for (const key of ["beforeStateSetSha256", "afterStateSetSha256", "terminalStateSetSha256"])
    assertHex(expected[key], HEX_SHA256, `CASE_${key}`);
  validateSourceDerivedLogs(
    expected.logs,
    identities,
    [{ errorCode: expected.errorCode }],
    expected.innerCpi,
  );
  validateSourceDerivedInnerCpi(
    expected.innerCpi,
    sourceCaseValue.disposition === ACTIVE_DISPOSITION ? opcode : -1,
    accountBindings,
    identities,
    fixtures,
    instruction,
  );
}

function derivedEconomyPda(identities, seed, ...parts) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(seed, "utf8"), ...parts.map((part) => Buffer.isBuffer(part)
      ? part : publicKey(part).toBuffer())],
    publicKey(identities.economyProgramId),
  )[0].toBase58();
}

function deriveSourceSharedInfrastructure(sourceContract, identities, signerPlan) {
  const config = derivedEconomyPda(identities, "config", identities.canonicalMint);
  const entries = new Map();
  const add = (pubkeyValue, role, kind) => {
    publicKey(pubkeyValue, "SHARED_INFRASTRUCTURE_PUBLIC_KEY");
    const current = entries.get(pubkeyValue) ?? { pubkey: pubkeyValue, roles: new Set(), kinds: new Set() };
    current.roles.add(role);
    current.kinds.add(kind);
    entries.set(pubkeyValue, current);
  };
  const fixedBindings = {
    dailyLawState: identities.dailyLawState,
    canonicalMint: identities.canonicalMint,
    token2022Program: TOKEN_2022_PROGRAM_ID.toBase58(),
    systemProgram: SystemProgram.programId.toBase58(),
    zkElgamalProofProgram: ZK_ELGAMAL_PROOF_PROGRAM_ID,
    lawProgram: identities.lawProgramId,
    hookValidationPda: getExtraAccountMetaAddress(
      publicKey(identities.canonicalMint),
      publicKey(identities.lawProgramId),
    ).toBase58(),
    stakeIngressPda: derivedEconomyPda(identities, "stake-ingress", config),
  };
  for (const operation of sourceContract.transactionMap.operationAccountMap) {
    for (const variant of operation.variants) {
      for (const meta of variant.orderedMetas) {
        if (fixedBindings[meta.binding]) add(fixedBindings[meta.binding], meta.role, "R06_FIXED_BINDING");
        if (meta.role === "config") add(config, meta.role, "R06_CONFIG_PDA");
      }
    }
  }
  for (const [role, seed, lane] of [
    ["vault_authority", "vault-authority", null],
    ["stake_tokens", "stake-token", null],
    ["ingress_authority", "stake-ingress", null],
    ["treasury", "lane", 1],
    ["treasury_tokens", "lane-token", 1],
    ["ecosystem", "lane", 2],
    ["ecosystem_tokens", "lane-token", 2],
    ["liquidity", "lane", 4],
    ["liquidity_tokens", "lane-token", 4],
  ]) {
    const address = lane === null
      ? derivedEconomyPda(identities, seed, config)
      : derivedEconomyPda(identities, seed, config, Buffer.from([lane]));
    add(address, role, "R06_STATIC_PDA_ROLE");
  }
  for (const { lane } of sourceContract.opcode9ConditionalCases
    .filter(({ disposition }) => disposition === ACTIVE_DISPOSITION)) {
    add(
      derivedEconomyPda(identities, "lane", config, Buffer.from([lane])),
      "lane_state",
      "R06_ACTIVE_LANE_PDA",
    );
    add(
      derivedEconomyPda(identities, "lane-token", config, Buffer.from([lane])),
      "lane_tokens",
      "R06_ACTIVE_LANE_TOKEN_PDA",
    );
  }
  const sourceSignerRoles = new Set(sourceContract.transactionMap.operationAccountMap
    .flatMap(({ variants }) => variants)
    .flatMap(({ orderedMetas }) => orderedMetas)
    .filter(({ isSigner }) => isSigner)
    .map(({ role }) => role));
  for (const { role, pubkey: pubkeyValue } of signerPlan.roles) {
    if (!sourceSignerRoles.has(role)) fail("SHARED_SIGNER_ROLE_NOT_R06");
    add(pubkeyValue, role, "R06_SIGNER_ROLE");
    if (role === "owner") {
      add(
        derivedEconomyPda(identities, "eligibility", config, pubkeyValue),
        "eligibility",
        "R06_OWNER_DERIVED_ELIGIBILITY_PDA",
      );
    }
  }
  add(signerPlan.feePayerPubkey, "fee_payer", "EXPLICIT_SIGNER_PLAN_FEE_PAYER");
  add(identities.economyProgramId, "economy_program", "R06_OUTER_PROGRAM");
  const writableRoles = new Set(sourceContract.transactionMap.operationAccountMap
    .flatMap(({ variants }) => variants)
    .flatMap(({ orderedMetas }) => orderedMetas)
    .filter(({ isWritable }) => isWritable)
    .map(({ role }) => role));
  return new Map([...entries].map(([pubkeyValue, value]) => [pubkeyValue, deepFreeze({
    pubkey: pubkeyValue,
    roles: [...value.roles].sort(),
    kinds: [...value.kinds].sort(),
    access: value.roles.has("fee_payer") || [...value.roles].some((role) => writableRoles.has(role))
      ? "SERIALIZED_WRITABLE_CHAIN" : "READONLY_BYTE_IDENTICAL",
  })]));
}

function serializedSharedInfrastructure(sourceContract, identities, signerPlan) {
  return [...deriveSourceSharedInfrastructure(sourceContract, identities, signerPlan).values()]
    .sort((left, right) => left.pubkey.localeCompare(right.pubkey));
}

function sharedRoleApproved(entry, binding, caseValue) {
  if (entry.roles.includes(binding.role)) return true;
  const policy = caseValue.opcode === 6
    ? caseValue.accountBindings.find(({ role }) => role === "owner")
    : null;
  return binding.role === "prior_delegate"
    && caseValue.variant === "RESTORE_DELEGATE"
    && policy?.pubkey === binding.pubkey
    && entry.roles.includes("owner");
}

function validateCaseNamespaceAliases(
  operationCases,
  opcode9ConditionalCases,
  rollbackRows,
  fixtures,
  sharedInfrastructure,
) {
  const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  const firstNamespaceByPubkey = new Map();
  const sharedRawByPubkey = new Map();
  const cases = [
    ...operationCases,
    ...opcode9ConditionalCases,
    ...rollbackRows.map(({ activeCase }) => activeCase),
  ];
  for (const caseValue of cases) {
    const namespace = caseValue.id;
    const withinCase = new Map();
    for (const binding of caseValue.accountBindings) {
      const fixture = fixtureById.get(binding.fixtureId);
      if (!fixture || fixture.pubkey !== binding.pubkey) fail("CASE_NAMESPACE_FIXTURE");
      const shared = sharedInfrastructure.get(binding.pubkey);
      const previousBinding = withinCase.get(binding.pubkey);
      if (previousBinding) {
        const roles = [previousBinding.role, binding.role].sort();
        const approvedPriorDelegateAlias = caseValue.opcode === 6
          && caseValue.variant === "RESTORE_DELEGATE"
          && canonicalIatB3ProductionOfficialRehearsalJson(roles)
            === canonicalIatB3ProductionOfficialRehearsalJson(["owner", "prior_delegate"]);
        if (!approvedPriorDelegateAlias) fail("INTRA_CASE_ACCOUNT_ALIAS");
      }
      withinCase.set(binding.pubkey, previousBinding ?? binding);
      const firstNamespace = firstNamespaceByPubkey.get(binding.pubkey);
      if (firstNamespace && firstNamespace !== namespace && !shared) {
        fail("NONSHARED_PUBKEY_CROSS_PURPOSE_ALIAS");
      }
      firstNamespaceByPubkey.set(binding.pubkey, firstNamespace ?? namespace);
      if (!shared) continue;
      if (!sharedRoleApproved(shared, binding, caseValue)) fail("SHARED_ROLE_NOT_SOURCE_DERIVED");
      const raw = snapshotAccountFromFixture(fixture);
      const previous = sharedRawByPubkey.get(binding.pubkey);
      if (previous && !exactSnapshotAccount(previous, raw)) fail("SHARED_FIXTURE_RAW_STATE_DRIFT");
      sharedRawByPubkey.set(binding.pubkey, previous ?? raw);
    }
  }
}

function assertExactAccountBindings(accountBindings, variant, identities, opcode, instruction) {
  const byRole = new Map(accountBindings.map((account) => [account.role, account]));
  const config = byRole.get("config")?.pubkey;
  for (let index = 0; index < variant.orderedMetas.length; index += 1) {
    const meta = variant.orderedMetas[index];
    const actual = accountBindings[index].pubkey;
    let expected = null;
    if (meta.binding === "dailyLawState") expected = identities.dailyLawState;
    else if (meta.binding === "canonicalMint") expected = identities.canonicalMint;
    else if (meta.binding === "token2022Program") expected = TOKEN_2022_PROGRAM_ID.toBase58();
    else if (meta.binding === "systemProgram") expected = SystemProgram.programId.toBase58();
    else if (meta.binding === "zkElgamalProofProgram") expected = ZK_ELGAMAL_PROOF_PROGRAM_ID;
    else if (meta.binding === "lawProgram") expected = identities.lawProgramId;
    else if (meta.binding === "hookValidationPda") {
      expected = getExtraAccountMetaAddress(
        publicKey(identities.canonicalMint),
        publicKey(identities.lawProgramId),
      ).toBase58();
    } else if (meta.binding === "stakeIngressPda") {
      if (!config) fail("STAKE_INGRESS_WITHOUT_CONFIG");
      expected = PublicKey.findProgramAddressSync(
        [Buffer.from("stake-ingress", "utf8"), publicKey(config).toBuffer()],
        publicKey(identities.economyProgramId),
      )[0].toBase58();
    }
    if (expected !== null && actual !== expected) fail("CASE_FIXED_ACCOUNT_BINDING");
  }
  if (config && config !== derivedEconomyPda(identities, "config", identities.canonicalMint)) {
    fail("CONFIG_PDA_BINDING");
  }
  const derivedRoles = [
    ["vault_authority", "vault-authority", config],
    ["stake_tokens", "stake-token", config],
    ["ingress_authority", "stake-ingress", config],
    ["treasury", "lane", config, Buffer.from([1])],
    ["treasury_tokens", "lane-token", config, Buffer.from([1])],
    ["ecosystem", "lane", config, Buffer.from([2])],
    ["ecosystem_tokens", "lane-token", config, Buffer.from([2])],
    ["liquidity", "lane", config, Buffer.from([4])],
    ["liquidity_tokens", "lane-token", config, Buffer.from([4])],
  ];
  for (const [role, seed, ...parts] of derivedRoles) {
    if (byRole.has(role) && (!config
      || byRole.get(role).pubkey !== derivedEconomyPda(identities, seed, ...parts))) {
      fail("DERIVED_ACCOUNT_BINDING");
    }
  }
  if (byRole.has("lane_state") || byRole.has("lane_tokens")) {
    const lane = instruction[16];
    if (!config
      || (byRole.has("lane_state") && byRole.get("lane_state").pubkey
        !== derivedEconomyPda(identities, "lane", config, Buffer.from([lane])))
      || (byRole.has("lane_tokens") && byRole.get("lane_tokens").pubkey
        !== derivedEconomyPda(identities, "lane-token", config, Buffer.from([lane])))) {
      fail("LANE_PDA_BINDING");
    }
  }
  if (byRole.has("eligibility")) {
    const operator = opcode === 5 ? byRole.get("wallet")?.pubkey : byRole.get("owner")?.pubkey;
    if (!config || !operator || byRole.get("eligibility").pubkey
      !== derivedEconomyPda(identities, "eligibility", config, operator)) {
      fail("ELIGIBILITY_PDA_BINDING");
    }
  }
  if (opcode === 6 && byRole.has("position")) {
    const positionId = instruction.subarray(16, 24);
    const owner = byRole.get("owner")?.pubkey;
    if (!config || !owner || byRole.get("position").pubkey
      !== derivedEconomyPda(identities, "position", config, owner, positionId)) {
      fail("POSITION_PDA_BINDING");
    }
  }
}

function validateCase(caseValue, sourceCaseValue, fixtures, sourceContract, identities) {
  const approvedOpenDelegateVariant = sourceCaseValue.opcode === 6
    && sourceCaseValue.variant === "BASE" && caseValue?.variant === "RESTORE_DELEGATE";
  if (!exactKeys(caseValue, CASE_KEYS) || caseValue.id !== sourceCaseValue.id
    || caseValue.opcode !== sourceCaseValue.opcode
    || (caseValue.variant !== sourceCaseValue.variant && !approvedOpenDelegateVariant)
    || caseValue.lane !== sourceCaseValue.lane || !Array.isArray(caseValue.accounts)
    || !Array.isArray(caseValue.signerRoles)) fail("CASE_KEYS");
  const instruction = canonicalBase64(caseValue.instructionDataBase64, "INSTRUCTION_DATA", {
    allowEmpty: false,
  });
  assertExactInstructionAbi(instruction, caseValue.opcode, caseValue.lane);
  const variant = operationVariant(sourceContract, caseValue.opcode, caseValue.variant);
  if (caseValue.accounts.length !== variant.orderedMetas.length) fail("CASE_META_COUNT");
  const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  const accountBindings = caseValue.accounts.map((account, index) => {
    if (!exactKeys(account, ["role", "fixtureId", "isSigner", "isWritable", "executable"])) {
      fail("CASE_ACCOUNT_KEYS");
    }
    const expectedMeta = variant.orderedMetas[index];
    const fixture = fixtureById.get(account.fixtureId);
    if (!fixture || fixture.role !== account.role
      || account.role !== expectedMeta.role || account.isSigner !== expectedMeta.isSigner
      || account.isWritable !== expectedMeta.isWritable
      || account.executable !== expectedMeta.executable
      || fixture.executable !== expectedMeta.executable) fail("CASE_ACCOUNT_META_BINDING");
    return { ...account, pubkey: fixture.pubkey };
  });
  const expectedSignerRoles = variant.orderedMetas.filter(({ isSigner }) => isSigner)
    .map(({ role }) => role);
  if (canonicalIatB3ProductionOfficialRehearsalJson(caseValue.signerRoles)
    !== canonicalIatB3ProductionOfficialRehearsalJson(expectedSignerRoles)) fail("CASE_SIGNERS");
  assertExactAccountBindings(
    accountBindings,
    variant,
    identities,
    caseValue.opcode,
    instruction,
  );
  validateExpected(
    caseValue.expected,
    sourceCaseValue,
    caseValue.opcode,
    accountBindings,
    identities,
    fixtures,
    instruction,
  );
  return deepFreeze({
    ...caseValue,
    instructionDataSha256: sha256(instruction),
    accountBindings,
    logsSha256: sha256IatB3ProductionOfficialRehearsalValue(caseValue.expected.logs),
    innerCpiSha256: sha256IatB3ProductionOfficialRehearsalValue(caseValue.expected.innerCpi),
  });
}

function validateDualGenesisCases(value, fixtures, sourceContract, identities) {
  if (!exactKeys(value, ["negativeLocalDomain", "positiveCompiledDomain"])) {
    fail("DUAL_GENESIS_CASE_KEYS");
  }
  const definitions = [
    {
      key: "negativeLocalDomain",
      id: "DUAL_GENESIS_LOCAL_DOMAIN_REJECTED",
      disposition: DUAL_GENESIS_NEGATIVE_DISPOSITION,
      errorCode: DAILY_LAW_REJECTED_CODE,
      purpose: "NEGATIVE_LOCAL_DOMAIN",
    },
    {
      key: "positiveCompiledDomain",
      id: "DUAL_GENESIS_COMPILED_DOMAIN_ACCEPTED",
      disposition: DUAL_GENESIS_POSITIVE_DISPOSITION,
      errorCode: CCC_DISABLED_CODE,
      purpose: null,
    },
  ];
  return deepFreeze(Object.fromEntries(definitions.map((definition) => {
    const candidate = value[definition.key];
    const packed = exactKeys(candidate, [
      ...CASE_KEYS,
      "instructionDataSha256", "accountBindings", "logsSha256", "innerCpiSha256",
    ]);
    const raw = packed
      ? Object.fromEntries(CASE_KEYS.map((key) => [key, candidate[key]]))
      : candidate;
    const validated = validateCase(raw, {
      id: definition.id,
      opcode: 12,
      variant: "CCC_DISABLED",
      lane: null,
      disposition: definition.disposition,
      expectedErrorCode: definition.errorCode,
    }, fixtures, sourceContract, identities);
    const lawBinding = validated.accountBindings.find(({ role }) => role === "daily_law_state");
    const lawFixture = fixtures.find(({ id }) => id === lawBinding?.fixtureId);
    const isNegative = lawFixture?.purpose === "NEGATIVE_LOCAL_DOMAIN";
    if (!lawFixture || isNegative !== (definition.purpose === "NEGATIVE_LOCAL_DOMAIN")) {
      fail("DUAL_GENESIS_CASE_LAW_FIXTURE");
    }
    if (packed && (candidate.instructionDataSha256 !== validated.instructionDataSha256
      || candidate.logsSha256 !== validated.logsSha256
      || candidate.innerCpiSha256 !== validated.innerCpiSha256
      || canonicalIatB3ProductionOfficialRehearsalJson(candidate.accountBindings)
        !== canonicalIatB3ProductionOfficialRehearsalJson(validated.accountBindings))) {
      fail("PACKED_DUAL_GENESIS_CASE_BINDING");
    }
    return [definition.key, packed ? candidate : validated];
  })));
}

function mutableFixtureIds(caseValue, sharedInfrastructure) {
  return new Set(caseValue.accountBindings
    .filter(({ isWritable, isSigner, pubkey: pubkeyValue }) =>
      isWritable && !isSigner && !sharedInfrastructure.has(pubkeyValue))
    .map(({ fixtureId }) => fixtureId));
}

function deriveIsolationRows(
  operationCases,
  opcode9ConditionalCases,
  rollbackRows,
  fixtures,
  sharedInfrastructure,
) {
  const isolationCases = [
    ...operationCases.filter(({ expected }) => expected.disposition === ACTIVE_DISPOSITION),
    ...opcode9ConditionalCases.filter(({ expected }) => expected.disposition === ACTIVE_DISPOSITION),
  ];
  const packedFixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  const assertPurposeSpecific = (caseValue, ledgerNamespace) => {
    for (const fixtureId of mutableFixtureIds(caseValue, sharedInfrastructure)) {
      if (packedFixtureById.get(fixtureId)?.purpose !== ledgerNamespace) {
        fail("MUTABLE_FIXTURE_NOT_PURPOSE_SPECIFIC");
      }
    }
  };
  for (const caseValue of isolationCases) assertPurposeSpecific(caseValue, caseValue.id);
  for (const row of rollbackRows) assertPurposeSpecific(row.activeCase, row.activeCase.id);
  return [
    ...isolationCases.map((caseValue) => ({
      id: caseValue.id,
      ledgerNamespace: caseValue.id,
      mutableFixtureIds: [...mutableFixtureIds(caseValue, sharedInfrastructure)].sort(),
      mutablePubkeys: [...mutableFixtureIds(caseValue, sharedInfrastructure)]
        .map((fixtureId) => packedFixtureById.get(fixtureId).pubkey).sort(),
      beforeStateSetSha256: caseValue.expected.beforeStateSetSha256,
      terminalStateSetSha256: caseValue.expected.terminalStateSetSha256,
    })),
    ...rollbackRows.map((row) => ({
      id: row.id,
      ledgerNamespace: row.activeCase.id,
      mutableFixtureIds: row.mutableFixtureIds,
      mutablePubkeys: row.mutableFixtureIds
        .map((fixtureId) => packedFixtureById.get(fixtureId).pubkey).sort(),
      beforeStateSetSha256: row.atomicExpected.beforeStateSetSha256,
      terminalStateSetSha256: row.retryExpected.terminalStateSetSha256,
    })),
  ];
}

export function validateIatB3ProductionMutableFixtureIsolation(rows) {
  if (!Array.isArray(rows)) fail("ISOLATION_ROWS");
  const seenFixtureIds = new Map();
  const seenPubkeys = new Map();
  const namespaces = new Set();
  for (const row of rows) {
    if (!exactKeys(row, [
      "id", "ledgerNamespace", "mutableFixtureIds", "mutablePubkeys",
      "beforeStateSetSha256", "terminalStateSetSha256",
    ])
      || typeof row.id !== "string" || row.id.length === 0 || !Array.isArray(row.mutableFixtureIds)
      || typeof row.ledgerNamespace !== "string" || row.ledgerNamespace.length === 0
      || namespaces.has(row.ledgerNamespace)
      || !Array.isArray(row.mutablePubkeys)
      || new Set(row.mutableFixtureIds).size !== row.mutableFixtureIds.length
      || new Set(row.mutablePubkeys).size !== row.mutablePubkeys.length
      || row.mutablePubkeys.length !== row.mutableFixtureIds.length) fail("ISOLATION_ROW");
    namespaces.add(row.ledgerNamespace);
    assertHex(row.beforeStateSetSha256, HEX_SHA256, "ISOLATION_BEFORE");
    assertHex(row.terminalStateSetSha256, HEX_SHA256, "ISOLATION_TERMINAL");
    for (const fixtureId of row.mutableFixtureIds) {
      if (seenFixtureIds.has(fixtureId)) fail("MUTABLE_FIXTURE_ALIAS");
      seenFixtureIds.set(fixtureId, row.id);
    }
    for (const pubkeyValue of row.mutablePubkeys) {
      publicKey(pubkeyValue, "MUTABLE_FIXTURE_PUBLIC_KEY");
      if (seenPubkeys.has(pubkeyValue)) fail("MUTABLE_PUBKEY_CROSS_PURPOSE_ALIAS");
      seenPubkeys.set(pubkeyValue, row.id);
    }
  }
  return rows;
}

function validateSignerPlan(plan, fixtures) {
  if (!exactKeys(plan, [
    "feePayerPubkey", "roles", "keyReadAllowed", "keyGenerationAllowed", "loadPhase",
  ]) || !Array.isArray(plan.roles) || plan.keyReadAllowed !== false
    || plan.keyGenerationAllowed !== false
    || plan.loadPhase !== "AFTER_GENESIS_PROGRAM_PROGRAMDATA_AND_ALL_FIXTURES_REOBSERVED") {
    fail("SIGNER_PLAN");
  }
  publicKey(plan.feePayerPubkey, "FEE_PAYER");
  const fixtureKeys = new Set(fixtures.map(({ pubkey }) => pubkey));
  if (!fixtureKeys.has(plan.feePayerPubkey)) fail("FEE_PAYER_NOT_FIXTURE_BOUND");
  const roles = new Set();
  const signerPubkeys = new Set();
  let feePayerRoleMatches = 0;
  for (const entry of plan.roles) {
    if (!exactKeys(entry, ["role", "pubkey"]) || !["admin", "owner", "caller"].includes(entry.role)
      || roles.has(entry.role)) fail("SIGNER_ROLE");
    publicKey(entry.pubkey, "SIGNER_PUBLIC_KEY");
    if (!fixtureKeys.has(entry.pubkey)) fail("SIGNER_NOT_FIXTURE_BOUND");
    if (signerPubkeys.has(entry.pubkey)) fail("SIGNER_ROLE_PUBKEY_COLLISION");
    signerPubkeys.add(entry.pubkey);
    if (entry.pubkey === plan.feePayerPubkey) feePayerRoleMatches += 1;
    roles.add(entry.role);
  }
  if (canonicalIatB3ProductionOfficialRehearsalJson([...roles].sort())
    !== canonicalIatB3ProductionOfficialRehearsalJson(["admin", "caller", "owner"])) {
    fail("SIGNER_ROLES_EXACT");
  }
  if (feePayerRoleMatches !== 1) fail("FEE_PAYER_REQUIRED_ROLE_EXACTLY_ONE");
}

function validateRollbackRow(
  row,
  source,
  fixtures,
  sourceContract,
  identities,
  sharedInfrastructure,
) {
  if (!exactKeys(row, [
    "id", "activeOpcode", "activeCase", "forcedFailureInstructionDataBase64",
    "atomicExpected", "retryExpected",
  ]) || row.id !== source.id || row.activeOpcode !== source.activeOpcode) fail("ROLLBACK_ROW");
  const activeSource = {
    id: `${row.id}:ACTIVE`,
    opcode: source.activeOpcode,
    variant: source.activeVariant,
    lane: source.activeOpcode === 9 ? 1 : null,
    disposition: ACTIVE_DISPOSITION,
    expectedErrorCode: null,
  };
  const activeInput = { ...row.activeCase, id: activeSource.id };
  const activeCase = validateCase(activeInput, activeSource, fixtures, sourceContract, identities);
  const forced = canonicalBase64(row.forcedFailureInstructionDataBase64, "ROLLBACK_FORCED_DATA", {
    allowEmpty: false,
  });
  assertExactInstructionAbi(forced, 12, null);
  for (const [name, expected] of [["ATOMIC", row.atomicExpected], ["RETRY", row.retryExpected]]) {
    if (!exactKeys(expected, EXPECTED_KEYS)) fail(`ROLLBACK_${name}_EXPECTED_KEYS`);
    for (const key of ["beforeStateSetSha256", "afterStateSetSha256", "terminalStateSetSha256"])
      assertHex(expected[key], HEX_SHA256, `ROLLBACK_${name}_${key}`);
    validateSourceDerivedInnerCpi(
      expected.innerCpi,
      row.activeOpcode,
      activeCase.accountBindings,
      identities,
      fixtures,
      canonicalBase64(activeCase.instructionDataBase64, "ROLLBACK_ACTIVE_INSTRUCTION", {
        allowEmpty: false,
      }),
    );
  }
  if (row.atomicExpected.disposition !== "ATOMIC_ROLLBACK_EXPECTED"
    || row.atomicExpected.errorCode !== CCC_DISABLED_CODE
    || row.atomicExpected.feePayerOnlyNoEffect !== true
    || row.retryExpected.disposition !== ACTIVE_DISPOSITION
    || row.retryExpected.errorCode !== null
    || row.retryExpected.feePayerOnlyNoEffect !== false
    || row.atomicExpected.afterStateSetSha256 !== row.retryExpected.beforeStateSetSha256
    || row.retryExpected.terminalStateSetSha256 !== row.retryExpected.afterStateSetSha256
    || canonicalIatB3ProductionOfficialRehearsalJson(row.atomicExpected.innerCpi)
      !== canonicalIatB3ProductionOfficialRehearsalJson(row.retryExpected.innerCpi)) {
    fail("ROLLBACK_EXPECTATION_CHAIN");
  }
  validateSourceDerivedLogs(row.atomicExpected.logs, identities, [
    { errorCode: null },
    { errorCode: CCC_DISABLED_CODE },
  ], row.atomicExpected.innerCpi);
  validateSourceDerivedLogs(
    row.retryExpected.logs,
    identities,
    [{ errorCode: null }],
    row.retryExpected.innerCpi,
  );
  return deepFreeze({
    ...row,
    activeCase,
    forcedFailureInstructionDataSha256: sha256(forced),
    mutableFixtureIds: [...mutableFixtureIds(activeCase, sharedInfrastructure)].sort(),
  });
}

const INPUT_KEYS = Object.freeze([
  "schema", "sourceContractSha256", "declaredHeadSha", "authorityEvidenceSha256",
  "identities", "identityManifestBytesBase64", "buildEnvironment", "genesisDomains",
  "buildReceipts", "artifacts", "deployments", "fixtures",
  "signerPlan", "dualGenesisCases", "operationCases", "opcode9ConditionalCases", "rollbackRows",
  "executionOrder",
]);

export function packIatB3ProductionOfficialLocalRehearsalFixtures(input, dependencies = {}) {
  if (!exactKeys(input, INPUT_KEYS) || input.schema !== IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_FIXTURE_INPUT_SCHEMA
    || input.declaredHeadSha !== IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_CHECKPOINT
    || !HEX_SHA1.test(input.declaredHeadSha)) fail("FIXTURE_INPUT");
  const sourceContract = buildIatB3ProductionOfficialRehearsalSourceContract();
  if (input.sourceContractSha256 !== sourceContract.sourceContractSha256
    || input.authorityEvidenceSha256 !== sourceContract.authorityEvidence.sha256) {
    fail("FIXTURE_SOURCE_BINDING");
  }
  validateIdentities(input.identities);
  const identityManifestBytes = canonicalBase64(
    input.identityManifestBytesBase64,
    "INPUT_IDENTITY_MANIFEST_BYTES",
    { allowEmpty: false },
  );
  const identityEvidence = validateIdentityEvidence({
    manifestBytesBase64: input.identityManifestBytesBase64,
    manifestByteLength: identityManifestBytes.length,
    manifestSha256: sha256(identityManifestBytes),
    fourFieldEnvironment: input.buildEnvironment,
    fourFieldEnvironmentSha256:
      sha256IatB3ProductionOfficialRehearsalValue(input.buildEnvironment),
    lawEnvironmentSha256: sha256IatB3ProductionOfficialRehearsalValue(
      Object.fromEntries(LAW_BUILD_ENVIRONMENT_KEYS.map((key) => [key, input.buildEnvironment[key]])),
    ),
  }, input.identities);
  validateGenesisDomains(input.genesisDomains, input.identities);
  const dependencyNames = Object.keys(dependencies).sort();
  if (dependencyNames.some((name) => !ALLOWED_TEST_DEPENDENCIES.includes(name))) {
    fail("TEST_DEPENDENCY_NAME");
  }
  const injected = dependencyNames.length > 0;
  const lawReceiptValidator = dependencies.validateLawReceipt ?? validateCombinedLawBuildReceipt;
  const economyReceiptValidator = dependencies.validateEconomyReceipt ?? validateEconomyBuildReceipt;
  const fixtureDecoder = dependencies.decodeFixture ?? decodeIatB3ProductionFixtureState;
  lawReceiptValidator(input.buildReceipts.law);
  economyReceiptValidator(input.buildReceipts.economy);
  const productionEvidence = {
    buildReceipts: input.buildReceipts,
    artifacts: input.artifacts,
    deployments: input.deployments,
  };
  const validatedProduction = validateProductionEvidence(
    productionEvidence,
    input.identities,
    identityEvidence,
    input.declaredHeadSha,
    { validateDefaultReceipts: false },
  );
  const { deployments } = validatedProduction;
  if (!Array.isArray(input.fixtures) || input.fixtures.length === 0) fail("FIXTURES");
  const ids = new Set();
  const pubkeyPurposeRole = new Set();
  const fixtures = input.fixtures.map((fixture) => {
    const purposeRole = `${fixture.pubkey}:${fixture.purpose}:${fixture.role}`;
    if (ids.has(fixture.id) || pubkeyPurposeRole.has(purposeRole)) {
      fail("FIXTURE_DUPLICATE");
    }
    ids.add(fixture.id);
    pubkeyPurposeRole.add(purposeRole);
    return validateAndPackIatB3ProductionConcreteFixture(fixture, {
      sourceContract,
      identities: input.identities,
      genesisDomains: input.genesisDomains,
      decodeFixture: fixtureDecoder,
    });
  });
  const positiveLawFixtures = fixtures.filter(({ codec, purpose }) =>
    codec === "LAW_STATE_V1" && purpose !== "NEGATIVE_LOCAL_DOMAIN");
  const negativeLawFixtures = fixtures.filter(({ codec, purpose }) =>
    codec === "LAW_STATE_V1" && purpose === "NEGATIVE_LOCAL_DOMAIN");
  if (positiveLawFixtures.length === 0 || negativeLawFixtures.length !== 1
    || negativeLawFixtures[0].pubkey !== input.identities.dailyLawState) {
    fail("DUAL_DOMAIN_LAW_FIXTURES");
  }
  const transferHookProgramFixtures = fixtures.filter(({ role }) =>
    role === "transfer_hook_program");
  if (transferHookProgramFixtures.length === 0
    || transferHookProgramFixtures.some(({ pubkey, dataSha256 }) =>
      pubkey !== input.identities.lawProgramId
      || dataSha256 !== deployments.law.programAccountSha256)) {
    fail("TRANSFER_HOOK_DEPLOYMENT_FIXTURE_BINDING");
  }
  validateSignerPlan(input.signerPlan, fixtures);
  const sharedInfrastructure = deriveSourceSharedInfrastructure(
    sourceContract,
    input.identities,
    input.signerPlan,
  );
  if (!Array.isArray(input.operationCases) || input.operationCases.length !== 15
    || !Array.isArray(input.opcode9ConditionalCases) || input.opcode9ConditionalCases.length !== 6
    || !Array.isArray(input.rollbackRows) || input.rollbackRows.length !== 5
    || canonicalIatB3ProductionOfficialRehearsalJson(input.executionOrder)
      !== canonicalIatB3ProductionOfficialRehearsalJson(sourceContract.executionOrder)) {
    fail("CASE_CARDINALITY_OR_ORDER");
  }
  const operationCases = input.operationCases.map((caseValue, index) =>
    validateCase(
      caseValue,
      sourceContract.ordinalCases[index],
      fixtures,
      sourceContract,
      input.identities,
    ));
  const dualGenesisCases = validateDualGenesisCases(
    input.dualGenesisCases,
    fixtures,
    sourceContract,
    input.identities,
  );
  const opcode9ConditionalCases = input.opcode9ConditionalCases.map((caseValue, index) =>
    validateCase(
      caseValue,
      sourceContract.opcode9ConditionalCases[index],
      fixtures,
      sourceContract,
      input.identities,
    ));
  const rollbackRows = input.rollbackRows.map((row, index) =>
    validateRollbackRow(
      row,
      sourceContract.rollbackRows[index],
      fixtures,
      sourceContract,
      input.identities,
      sharedInfrastructure,
    ));
  const signerPubkeys = new Map(input.signerPlan.roles.map(({ role, pubkey }) => [role, pubkey]));
  for (const caseValue of [
    ...operationCases,
    ...opcode9ConditionalCases,
    ...rollbackRows.map(({ activeCase }) => activeCase),
  ]) {
    for (const account of caseValue.accountBindings.filter(({ isSigner }) => isSigner)) {
      if (signerPubkeys.get(account.role) !== account.pubkey) fail("CASE_SIGNER_PLAN_BINDING");
    }
  }
  const isolationRows = deriveIsolationRows(
    operationCases,
    opcode9ConditionalCases,
    rollbackRows,
    fixtures,
    sharedInfrastructure,
  );
  validateIatB3ProductionMutableFixtureIsolation(isolationRows);
  validateCaseNamespaceAliases(
    operationCases,
    opcode9ConditionalCases,
    rollbackRows,
    fixtures,
    sharedInfrastructure,
  );
  const core = {
    schema: IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_FIXTURE_PACK_SCHEMA,
    status: injected ? IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_TEST_STATUS
      : IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_STATUS,
    sourceContractSha256: sourceContract.sourceContractSha256,
    declaredHeadSha: input.declaredHeadSha,
    authorityEvidenceSha256: input.authorityEvidenceSha256,
    provenance: {
      kind: injected ? PROVENANCE_TEST : PROVENANCE_SOURCE,
      injectedDependencyNames: dependencyNames,
      productionEvidenceSha256:
        sha256IatB3ProductionOfficialRehearsalValue(productionEvidence),
    },
    productionEvidence,
    identities: input.identities,
    identityEvidence,
    genesisDomains: input.genesisDomains,
    buildReceiptBindings: validatedProduction.buildReceiptBindings,
    artifactBindings: validatedProduction.artifactBindings,
    deployments,
    fixtures,
    fixturesSha256: sha256IatB3ProductionOfficialRehearsalValue(fixtures),
    signerPlan: input.signerPlan,
    sharedInfrastructure: serializedSharedInfrastructure(
      sourceContract,
      input.identities,
      input.signerPlan,
    ),
    dualGenesisCases,
    operationCases,
    opcode9ConditionalCases,
    rollbackRows,
    isolationRows,
    executionOrder: input.executionOrder,
    truth: PACK_TRUTH,
    blockers: PACK_BLOCKERS,
  };
  return deepFreeze({ ...core, fixturePackSha256: sha256IatB3ProductionOfficialRehearsalValue(core) });
}

const PACK_KEYS = Object.freeze([
  "schema", "status", "sourceContractSha256", "declaredHeadSha", "authorityEvidenceSha256",
  "provenance", "productionEvidence", "identities", "identityEvidence", "genesisDomains",
  "buildReceiptBindings",
  "artifactBindings", "deployments",
  "fixtures", "fixturesSha256", "signerPlan", "sharedInfrastructure", "dualGenesisCases",
  "operationCases",
  "opcode9ConditionalCases",
  "rollbackRows", "isolationRows", "executionOrder", "truth", "blockers", "fixturePackSha256",
]);

function validatePackedFixture(fixture, sourceContract, identities, genesisDomains) {
  if (!exactKeys(fixture, [...FIXTURE_KEYS, "dataLength"])) fail("PACKED_FIXTURE_KEYS");
  const raw = Object.fromEntries(FIXTURE_KEYS.map((key) => [key, fixture[key]]));
  const repacked = validateAndPackIatB3ProductionConcreteFixture(raw, {
    sourceContract,
    identities,
    genesisDomains,
    decodeFixture: () => fixture.decodedState,
  });
  if (canonicalIatB3ProductionOfficialRehearsalJson(repacked)
    !== canonicalIatB3ProductionOfficialRehearsalJson(fixture)) {
    fail("PACKED_FIXTURE_BINDING");
  }
}

function validatePackedCase(caseValue, sourceCaseValue, fixtures, sourceContract, identities) {
  if (!exactKeys(caseValue, [
    ...CASE_KEYS,
    "instructionDataSha256", "accountBindings", "logsSha256", "innerCpiSha256",
  ])) fail("PACKED_CASE_KEYS");
  const raw = Object.fromEntries(CASE_KEYS.map((key) => [key, caseValue[key]]));
  const expected = validateCase(raw, sourceCaseValue, fixtures, sourceContract, identities);
  if (caseValue.instructionDataSha256 !== expected.instructionDataSha256
    || caseValue.logsSha256 !== expected.logsSha256
    || caseValue.innerCpiSha256 !== expected.innerCpiSha256
    || canonicalIatB3ProductionOfficialRehearsalJson(caseValue.accountBindings)
      !== canonicalIatB3ProductionOfficialRehearsalJson(expected.accountBindings)) {
    fail("PACKED_CASE_BINDING");
  }
  return caseValue;
}

export function validateIatB3ProductionOfficialLocalRehearsalFixturePack(pack) {
  if (!exactKeys(pack, PACK_KEYS)
    || pack.schema !== IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_FIXTURE_PACK_SCHEMA
    || ![IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_STATUS,
      IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_TEST_STATUS].includes(pack.status)
    || canonicalIatB3ProductionOfficialRehearsalJson(pack.truth)
      !== canonicalIatB3ProductionOfficialRehearsalJson(PACK_TRUTH)
    || canonicalIatB3ProductionOfficialRehearsalJson(pack.blockers)
      !== canonicalIatB3ProductionOfficialRehearsalJson(PACK_BLOCKERS)
    || pack.fixturePackSha256 !== digestCore(pack, "fixturePackSha256")) fail("FIXTURE_PACK");
  const sourceContract = buildIatB3ProductionOfficialRehearsalSourceContract();
  if (pack.sourceContractSha256 !== sourceContract.sourceContractSha256
    || pack.declaredHeadSha !== sourceContract.checkpointHeadSha
    || pack.authorityEvidenceSha256 !== sourceContract.authorityEvidence.sha256
    || !Array.isArray(pack.fixtures) || pack.fixtures.length === 0
    || pack.fixturesSha256 !== sha256IatB3ProductionOfficialRehearsalValue(pack.fixtures)
    || !Array.isArray(pack.operationCases) || pack.operationCases.length !== 15
    || !Array.isArray(pack.opcode9ConditionalCases) || pack.opcode9ConditionalCases.length !== 6
    || !Array.isArray(pack.rollbackRows) || pack.rollbackRows.length !== 5
    || canonicalIatB3ProductionOfficialRehearsalJson(pack.executionOrder)
      !== canonicalIatB3ProductionOfficialRehearsalJson(sourceContract.executionOrder)) {
    fail("FIXTURE_PACK_SOURCE_BINDING");
  }
  validateIdentities(pack.identities);
  validateIdentityEvidence(pack.identityEvidence, pack.identities);
  validateGenesisDomains(pack.genesisDomains, pack.identities);
  if (!exactKeys(pack.provenance, [
    "kind",
    "injectedDependencyNames",
    "productionEvidenceSha256",
  ]) || !Array.isArray(pack.provenance.injectedDependencyNames)
    || new Set(pack.provenance.injectedDependencyNames).size
      !== pack.provenance.injectedDependencyNames.length
    || canonicalIatB3ProductionOfficialRehearsalJson(pack.provenance.injectedDependencyNames)
      !== canonicalIatB3ProductionOfficialRehearsalJson(
        [...pack.provenance.injectedDependencyNames].sort(),
      )
    || pack.provenance.injectedDependencyNames.some((name) =>
      !ALLOWED_TEST_DEPENDENCIES.includes(name))
    || pack.provenance.productionEvidenceSha256
      !== sha256IatB3ProductionOfficialRehearsalValue(pack.productionEvidence)) {
    fail("FIXTURE_PACK_PROVENANCE");
  }
  const sourceProvenance = pack.provenance.kind === PROVENANCE_SOURCE;
  const testProvenance = pack.provenance.kind === PROVENANCE_TEST;
  if ((!sourceProvenance && !testProvenance)
    || sourceProvenance !== (pack.status === IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_STATUS)
    || testProvenance !== (pack.status === IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_TEST_STATUS)
    || (sourceProvenance && pack.provenance.injectedDependencyNames.length !== 0)
    || (testProvenance && pack.provenance.injectedDependencyNames.length === 0)) {
    fail("FIXTURE_PACK_PROVENANCE_STATUS");
  }
  const validatedProduction = validateProductionEvidence(
    pack.productionEvidence,
    pack.identities,
    pack.identityEvidence,
    pack.declaredHeadSha,
    { validateDefaultReceipts: sourceProvenance },
  );
  if (!exactKeys(pack.buildReceiptBindings, ["law", "economy"])
    || !exactKeys(pack.artifactBindings, ["law", "economy"])
    || !exactKeys(pack.deployments, ["law", "economy"])) fail("FIXTURE_PACK_PRODUCTION_BINDINGS");
  for (const value of Object.values(pack.buildReceiptBindings)) {
    assertHex(value, HEX_SHA256, "PACK_BUILD_RECEIPT_SHA256");
  }
  for (const binding of Object.values(pack.artifactBindings)) {
    if (!exactKeys(binding, ["fileName", "byteLength", "sha256"])
      || typeof binding.fileName !== "string" || binding.fileName.length === 0
      || !Number.isSafeInteger(binding.byteLength) || binding.byteLength <= 0) {
      fail("PACK_ARTIFACT_BINDING");
    }
    assertHex(binding.sha256, HEX_SHA256, "PACK_ARTIFACT_SHA256");
  }
  for (const binding of Object.values(pack.deployments)) {
    if (!exactKeys(binding, [
      "programId", "programDataAddress", "programAccountSha256", "programDataAccountSha256",
      "deployedElfSha256",
    ])) fail("PACK_DEPLOYMENT_BINDING");
    publicKey(binding.programId, "PACK_DEPLOYMENT_PROGRAM");
    publicKey(binding.programDataAddress, "PACK_DEPLOYMENT_PROGRAMDATA");
    for (const key of ["programAccountSha256", "programDataAccountSha256", "deployedElfSha256"])
      assertHex(binding[key], HEX_SHA256, "PACK_DEPLOYMENT_SHA256");
  }
  for (const kind of ["law", "economy"]) {
    const binding = pack.deployments[kind];
    const programId = pack.identities[`${kind}ProgramId`];
    const expectedProgramData = PublicKey.findProgramAddressSync(
      [publicKey(programId).toBuffer()],
      UPGRADEABLE_LOADER,
    )[0].toBase58();
    if (binding.programId !== programId || binding.programDataAddress !== expectedProgramData
      || binding.deployedElfSha256 !== pack.artifactBindings[kind].sha256) {
      fail("PACK_DEPLOYMENT_IDENTITY");
    }
  }
  if (canonicalIatB3ProductionOfficialRehearsalJson(pack.buildReceiptBindings)
      !== canonicalIatB3ProductionOfficialRehearsalJson(
        validatedProduction.buildReceiptBindings,
      )
    || canonicalIatB3ProductionOfficialRehearsalJson(pack.artifactBindings)
      !== canonicalIatB3ProductionOfficialRehearsalJson(validatedProduction.artifactBindings)
    || canonicalIatB3ProductionOfficialRehearsalJson(pack.deployments)
      !== canonicalIatB3ProductionOfficialRehearsalJson(validatedProduction.deployments)) {
    fail("FIXTURE_PACK_RAW_PRODUCTION_EVIDENCE_BINDING");
  }
  const fixtureIds = new Set();
  const fixturePurposeRoles = new Set();
  for (const fixture of pack.fixtures) {
    const purposeRole = `${fixture.pubkey}:${fixture.purpose}:${fixture.role}`;
    if (fixtureIds.has(fixture.id) || fixturePurposeRoles.has(purposeRole)) {
      fail("PACK_FIXTURE_DUPLICATE");
    }
    fixtureIds.add(fixture.id);
    fixturePurposeRoles.add(purposeRole);
    validatePackedFixture(fixture, sourceContract, pack.identities, pack.genesisDomains);
    if (sourceProvenance) {
      const rawFixture = Object.fromEntries(FIXTURE_KEYS.map((key) => [key, fixture[key]]));
      const repacked = validateAndPackIatB3ProductionConcreteFixture(rawFixture, {
        sourceContract,
        identities: pack.identities,
        genesisDomains: pack.genesisDomains,
      });
      if (canonicalIatB3ProductionOfficialRehearsalJson(repacked)
        !== canonicalIatB3ProductionOfficialRehearsalJson(fixture)) {
        fail("FIXTURE_PACK_DEFAULT_CODEC_BINDING");
      }
    }
  }
  validateSignerPlan(pack.signerPlan, pack.fixtures);
  const expectedSharedInfrastructure = serializedSharedInfrastructure(
    sourceContract,
    pack.identities,
    pack.signerPlan,
  );
  if (canonicalIatB3ProductionOfficialRehearsalJson(pack.sharedInfrastructure)
    !== canonicalIatB3ProductionOfficialRehearsalJson(expectedSharedInfrastructure)) {
    fail("FIXTURE_PACK_SHARED_INFRASTRUCTURE");
  }
  const sharedInfrastructure = new Map(
    expectedSharedInfrastructure.map((entry) => [entry.pubkey, entry]),
  );
  const expectedDualGenesisCases = validateDualGenesisCases(
    pack.dualGenesisCases,
    pack.fixtures,
    sourceContract,
    pack.identities,
  );
  if (canonicalIatB3ProductionOfficialRehearsalJson(pack.dualGenesisCases)
    !== canonicalIatB3ProductionOfficialRehearsalJson(expectedDualGenesisCases)) {
    fail("FIXTURE_PACK_DUAL_GENESIS_CASES");
  }
  pack.operationCases.forEach((caseValue, index) => validatePackedCase(
    caseValue,
    sourceContract.ordinalCases[index],
    pack.fixtures,
    sourceContract,
    pack.identities,
  ));
  pack.opcode9ConditionalCases.forEach((caseValue, index) => validatePackedCase(
    caseValue,
    sourceContract.opcode9ConditionalCases[index],
    pack.fixtures,
    sourceContract,
    pack.identities,
  ));
  for (let index = 0; index < pack.rollbackRows.length; index += 1) {
    const row = pack.rollbackRows[index];
    const source = sourceContract.rollbackRows[index];
    if (!exactKeys(row, [
      "id", "activeOpcode", "activeCase", "forcedFailureInstructionDataBase64",
      "atomicExpected", "retryExpected", "forcedFailureInstructionDataSha256",
      "mutableFixtureIds",
    ]) || row.id !== source.id || row.activeOpcode !== source.activeOpcode) fail("PACK_ROLLBACK_ROW");
    const activeSource = {
      id: `${row.id}:ACTIVE`,
      opcode: row.activeOpcode,
      variant: source.activeVariant,
      lane: row.activeOpcode === 9 ? 1 : null,
      disposition: ACTIVE_DISPOSITION,
      expectedErrorCode: null,
    };
    validatePackedCase(row.activeCase, activeSource, pack.fixtures, sourceContract, pack.identities);
    const rawActiveCase = Object.fromEntries(CASE_KEYS.map((key) => [key, row.activeCase[key]]));
    const reparsedRow = validateRollbackRow({
      id: row.id,
      activeOpcode: row.activeOpcode,
      activeCase: rawActiveCase,
      forcedFailureInstructionDataBase64: row.forcedFailureInstructionDataBase64,
      atomicExpected: row.atomicExpected,
      retryExpected: row.retryExpected,
    }, source, pack.fixtures, sourceContract, pack.identities, sharedInfrastructure);
    const forced = canonicalBase64(
      row.forcedFailureInstructionDataBase64,
      "PACK_ROLLBACK_FORCED_DATA",
      { allowEmpty: false },
    );
    assertExactInstructionAbi(forced, 12, null);
    if (row.forcedFailureInstructionDataSha256 !== sha256(forced)
      || canonicalIatB3ProductionOfficialRehearsalJson(row.mutableFixtureIds)
        !== canonicalIatB3ProductionOfficialRehearsalJson(
          [...mutableFixtureIds(row.activeCase, sharedInfrastructure)].sort(),
        ) || canonicalIatB3ProductionOfficialRehearsalJson(reparsedRow)
          !== canonicalIatB3ProductionOfficialRehearsalJson(row)) {
      fail("PACK_ROLLBACK_BINDING");
    }
  }
  const derivedIsolationRows = deriveIsolationRows(
    pack.operationCases,
    pack.opcode9ConditionalCases,
    pack.rollbackRows,
    pack.fixtures,
    sharedInfrastructure,
  );
  validateIatB3ProductionMutableFixtureIsolation(pack.isolationRows);
  if (canonicalIatB3ProductionOfficialRehearsalJson(pack.isolationRows)
    !== canonicalIatB3ProductionOfficialRehearsalJson(derivedIsolationRows)) {
    fail("FIXTURE_PACK_ISOLATION_BINDING");
  }
  validateCaseNamespaceAliases(
    pack.operationCases,
    pack.opcode9ConditionalCases,
    pack.rollbackRows,
    pack.fixtures,
    sharedInfrastructure,
  );
  return pack;
}

const SNAPSHOT_ACCOUNT_KEYS = Object.freeze([
  "pubkey", "owner", "lamports", "executable", "rentEpoch", "dataBase64",
]);

export function canonicalIatB3ProductionAccountSnapshot(snapshot) {
  if (!Array.isArray(snapshot) || snapshot.length === 0) fail("SNAPSHOT");
  const seen = new Set();
  const result = snapshot.map((account) => {
    if (!exactKeys(account, SNAPSHOT_ACCOUNT_KEYS) || seen.has(account.pubkey)) fail("SNAPSHOT_ACCOUNT");
    publicKey(account.pubkey, "SNAPSHOT_PUBLIC_KEY");
    publicKey(account.owner, "SNAPSHOT_OWNER");
    if (!Number.isSafeInteger(account.lamports) || account.lamports < 0
      || !Number.isSafeInteger(account.rentEpoch) || account.rentEpoch < 0
      || typeof account.executable !== "boolean") fail("SNAPSHOT_FIELDS");
    canonicalBase64(account.dataBase64, "SNAPSHOT_DATA");
    seen.add(account.pubkey);
    return { ...account };
  });
  return result.sort((left, right) => left.pubkey.localeCompare(right.pubkey));
}

function snapshotSha256(snapshot) {
  return sha256IatB3ProductionOfficialRehearsalValue(
    canonicalIatB3ProductionAccountSnapshot(snapshot),
  );
}

function assertFeePayerOnlyDelta(before, after, feePayer, feeLamports, mustBeFeeOnly) {
  if (!Number.isSafeInteger(feeLamports) || feeLamports < 0) fail("FEE_LAMPORTS");
  const beforeMap = new Map(before.map((value) => [value.pubkey, value]));
  const afterMap = new Map(after.map((value) => [value.pubkey, value]));
  if (beforeMap.size !== afterMap.size || !beforeMap.has(feePayer) || !afterMap.has(feePayer)) {
    fail("FEE_PAYER_SNAPSHOT");
  }
  let nonFeeChange = false;
  let totalBefore = 0n;
  let totalAfter = 0n;
  for (const [pubkeyValue, beforeValue] of beforeMap) {
    const afterValue = afterMap.get(pubkeyValue);
    if (!afterValue) fail("SNAPSHOT_KEY_SET");
    totalBefore += BigInt(beforeValue.lamports);
    totalAfter += BigInt(afterValue.lamports);
    if (pubkeyValue === feePayer) {
      const beforeComparable = { ...beforeValue, lamports: 0 };
      const afterComparable = { ...afterValue, lamports: 0 };
      if (canonicalIatB3ProductionOfficialRehearsalJson(beforeComparable)
        !== canonicalIatB3ProductionOfficialRehearsalJson(afterComparable)) fail("FEE_PAYER_DELTA");
    } else if (canonicalIatB3ProductionOfficialRehearsalJson(beforeValue)
      !== canonicalIatB3ProductionOfficialRehearsalJson(afterValue)) {
      nonFeeChange = true;
    }
  }
  if (totalBefore - totalAfter !== BigInt(feeLamports)) fail("LAMPORT_FEE_CONSERVATION");
  if (mustBeFeeOnly && beforeMap.get(feePayer).lamports - afterMap.get(feePayer).lamports
    !== feeLamports) fail("FEE_PAYER_DELTA");
  if ((mustBeFeeOnly && nonFeeChange) || (!mustBeFeeOnly && !nonFeeChange)) {
    fail("STATE_EFFECT_CLASS");
  }
}

const OBSERVATION_KEYS = Object.freeze([
  "id", "outcome", "errorCode", "submittedSignatureBase64", "landedSignatureBase64",
  "submittedSignatureSha256", "landedSignatureSha256",
  "submittedMessageBase64", "landedMessageBase64", "submittedTransactionBase64",
  "landedTransactionBase64", "submittedMessageSha256", "landedMessageSha256",
  "submittedTransactionSha256", "landedTransactionSha256",
  "logs", "innerCpi", "beforeSnapshot", "afterSnapshot", "landedMeta",
  "terminalStateSetSha256", "transactionConfirmed", "programBindingsSha256",
  "fixtureBindingsSha256",
]);

const LANDED_META_KEYS = Object.freeze([
  "feeLamports",
  "accountKeys",
  "preBalances",
  "postBalances",
  "logMessages",
  "innerCpi",
]);

function snapshotAccountFromFixture(fixture) {
  return Object.fromEntries(SNAPSHOT_ACCOUNT_KEYS.map((key) => [key, fixture[key]]));
}

function exactSnapshotAccount(left, right) {
  return canonicalIatB3ProductionOfficialRehearsalJson(left)
    === canonicalIatB3ProductionOfficialRehearsalJson(right);
}

function expectedInstruction(caseValue, economyProgramId) {
  const instructionData = canonicalBase64(
    caseValue.instructionDataBase64,
    "EXPECTED_TRANSACTION_INSTRUCTION_DATA",
    { allowEmpty: false },
  );
  return new TransactionInstruction({
    programId: publicKey(economyProgramId, "EXPECTED_ECONOMY_PROGRAM"),
    keys: caseValue.accountBindings.map((binding) => ({
      pubkey: publicKey(binding.pubkey, "EXPECTED_TRANSACTION_META"),
      isSigner: binding.isSigner,
      isWritable: binding.isWritable,
    })),
    data: instructionData,
  });
}

function verifyRequiredEd25519Signatures(transaction, messageBytes) {
  const message = transaction.compileMessage();
  const requiredCount = message.header.numRequiredSignatures;
  if (requiredCount <= 0 || transaction.signatures.length !== requiredCount
    || transaction.signatures.some((entry, index) =>
      !entry.signature || entry.signature.length !== 64
      || entry.publicKey.toBase58() !== message.accountKeys[index].toBase58())) {
    fail("TRANSACTION_REQUIRED_SIGNATURES");
  }
  for (const entry of transaction.signatures) {
    const key = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, entry.publicKey.toBuffer()]),
      format: "der",
      type: "spki",
    });
    if (!verifyEd25519(null, messageBytes, key, entry.signature)) {
      fail("TRANSACTION_ED25519_SIGNATURE");
    }
  }
  if (!transaction.verifySignatures()) fail("TRANSACTION_SIGNATURE_VERIFICATION");
}

function expectedSnapshotMap(context, messageAccountKeys) {
  const fixtureById = new Map(context.fixtures.map((fixture) => [fixture.id, fixture]));
  const result = new Map();
  const bind = (account, code) => {
    const previous = result.get(account.pubkey);
    if (previous && !exactSnapshotAccount(previous, account)) fail(code);
    result.set(account.pubkey, account);
  };
  for (const caseValue of context.instructionCases) {
    for (const binding of caseValue.accountBindings) {
      const fixture = fixtureById.get(binding.fixtureId);
      if (!fixture || fixture.pubkey !== binding.pubkey) fail("SNAPSHOT_FIXTURE_BINDING");
      bind(snapshotAccountFromFixture(fixture), "SNAPSHOT_ALIASED_FIXTURE_DRIFT");
    }
  }
  const feePayerFixtures = context.fixtures.filter(({ pubkey }) => pubkey === context.feePayerPubkey);
  if (feePayerFixtures.length === 0) fail("SNAPSHOT_FEE_PAYER_FIXTURE");
  for (const fixture of feePayerFixtures) {
    bind(snapshotAccountFromFixture(fixture), "SNAPSHOT_FEE_PAYER_FIXTURE_DRIFT");
  }
  bind(snapshotAccountFromFixture(context.economyProgramAccount), "SNAPSHOT_PROGRAM_DRIFT");
  const exactKeysValue = [...result.keys()].sort();
  if (canonicalIatB3ProductionOfficialRehearsalJson(exactKeysValue)
    !== canonicalIatB3ProductionOfficialRehearsalJson([...messageAccountKeys].sort())) {
    fail("SNAPSHOT_EXACT_MESSAGE_ACCOUNT_SET");
  }
  return result;
}

function validateLandedMeta(meta, observation, messageAccountKeys, before, after) {
  if (!exactKeys(meta, LANDED_META_KEYS) || !Number.isSafeInteger(meta.feeLamports)
    || meta.feeLamports <= 0 || !Array.isArray(meta.accountKeys)
    || !Array.isArray(meta.preBalances) || !Array.isArray(meta.postBalances)
    || meta.preBalances.length !== messageAccountKeys.length
    || meta.postBalances.length !== messageAccountKeys.length
    || meta.preBalances.some((value) => !Number.isSafeInteger(value) || value < 0)
    || meta.postBalances.some((value) => !Number.isSafeInteger(value) || value < 0)
    || canonicalIatB3ProductionOfficialRehearsalJson(meta.accountKeys)
      !== canonicalIatB3ProductionOfficialRehearsalJson(messageAccountKeys)
    || canonicalIatB3ProductionOfficialRehearsalJson(meta.logMessages)
      !== canonicalIatB3ProductionOfficialRehearsalJson(observation.logs)
    || canonicalIatB3ProductionOfficialRehearsalJson(meta.innerCpi)
      !== canonicalIatB3ProductionOfficialRehearsalJson(observation.innerCpi)) {
    fail("LANDED_META_BINDING");
  }
  const beforeMap = new Map(before.map((account) => [account.pubkey, account]));
  const afterMap = new Map(after.map((account) => [account.pubkey, account]));
  for (let index = 0; index < messageAccountKeys.length; index += 1) {
    const key = messageAccountKeys[index];
    if (beforeMap.get(key)?.lamports !== meta.preBalances[index]
      || afterMap.get(key)?.lamports !== meta.postBalances[index]) fail("LANDED_BALANCE_SNAPSHOT");
  }
}

function validateSnapshotScope(before, after, context, expectedMap) {
  const beforeMap = new Map(before.map((account) => [account.pubkey, account]));
  const afterMap = new Map(after.map((account) => [account.pubkey, account]));
  if (!(context.sharedInfrastructure instanceof Map) || !(context.sharedState instanceof Map)) {
    fail("SNAPSHOT_SHARED_CHAIN_CONTEXT");
  }
  const sharedUpdates = [];
  for (const [pubkeyValue, expected] of expectedMap) {
    const isShared = context.sharedInfrastructure.has(pubkeyValue);
    const chained = isShared && context.sharedState.has(pubkeyValue)
      ? context.sharedState.get(pubkeyValue) : expected;
    if (!exactSnapshotAccount(beforeMap.get(pubkeyValue), chained)) {
      fail(isShared ? "SHARED_SNAPSHOT_CHAIN_PRESTATE" : "SNAPSHOT_PRESTATE_FIXTURE");
    }
    if (isShared) sharedUpdates.push([pubkeyValue, afterMap.get(pubkeyValue)]);
  }
  const writable = new Set([context.feePayerPubkey]);
  for (const caseValue of context.instructionCases) {
    for (const binding of caseValue.accountBindings) {
      if (binding.isWritable) writable.add(binding.pubkey);
    }
  }
  for (const [pubkeyValue, beforeValue] of beforeMap) {
    if (!writable.has(pubkeyValue)
      && !exactSnapshotAccount(beforeValue, afterMap.get(pubkeyValue))) {
      fail("READONLY_ACCOUNT_CHANGED");
    }
  }
  return sharedUpdates;
}

function bigintField(value, name) {
  try {
    const parsed = BigInt(value);
    if (parsed < 0n || parsed > (1n << 64n) - 1n) fail(`STATE_${name}`);
    return parsed;
  } catch {
    fail(`STATE_${name}`);
  }
}

function assertDecodedTransition(before, after, changes, code) {
  const expected = { ...before, ...changes };
  if (canonicalIatB3ProductionOfficialRehearsalJson(after)
    !== canonicalIatB3ProductionOfficialRehearsalJson(expected)) fail(code);
}

function semanticCaseContext(caseValue, before, after, fixtures) {
  const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  const beforeMap = new Map(before.map((account) => [account.pubkey, account]));
  const afterMap = new Map(after.map((account) => [account.pubkey, account]));
  const binding = (role) => {
    const matches = caseValue.accountBindings.filter((entry) => entry.role === role);
    if (matches.length !== 1) fail(`STATE_ROLE_${role}`);
    return matches[0];
  };
  const account = (role, side) => {
    const value = binding(role);
    const fixture = fixtureById.get(value.fixtureId);
    const snapshot = (side === "before" ? beforeMap : afterMap).get(value.pubkey);
    if (!fixture || !snapshot || fixture.pubkey !== value.pubkey) fail("STATE_FIXTURE_SNAPSHOT");
    return { binding: value, fixture, snapshot };
  };
  const decoded = (role, side, afterCodec = null) => {
    const value = account(role, side);
    const codec = side === "after" && value.fixture.codec === "SYSTEM_VACANT"
      ? afterCodec : value.fixture.codec;
    if (!codec) fail("STATE_AFTER_CODEC");
    try {
      return decodeIatB3ProductionFixtureState({
        codec,
        pubkey: value.snapshot.pubkey,
        owner: value.snapshot.owner,
        dataBase64: value.snapshot.dataBase64,
      });
    } catch {
      fail(`STATE_CODEC_${role}`);
    }
  };
  return { account, decoded };
}

function assertTokenAmountDelta(state, role, delta, code) {
  const before = state.decoded(role, "before");
  const after = state.decoded(role, "after");
  const amount = bigintField(before.amount, `${role}_AMOUNT`) + delta;
  if (amount < 0n) fail(code);
  assertDecodedTransition(before, after, { amount: amount.toString() }, code);
}

function assertLifecycleAccountPost(state, role, codec, lifecycle, identities, code) {
  const beforeAccount = state.account(role, "before").snapshot;
  const afterAccount = state.account(role, "after").snapshot;
  const expectedLength = codec === "ECONOMY_ELIGIBILITY_V1"
    ? Number(ELIGIBILITY_ACCOUNT_LEN) : Number(POSITION_ACCOUNT_LEN);
  const funding = Number(lifecycle.fundingLamports);
  if (!Number.isSafeInteger(funding)) fail(`${code}_FUNDING`);
  if (afterAccount.owner !== identities.economyProgramId) fail(`${code}_OWNER`);
  if (afterAccount.executable !== false
    || Buffer.from(afterAccount.dataBase64, "base64").length !== expectedLength) {
    fail(`${code}_DATA`);
  }
  if (afterAccount.lamports !== beforeAccount.lamports + funding) fail(`${code}_LAMPORTS`);
}

function positionPdaBump(identities, config, owner, positionId) {
  const id = Buffer.alloc(8);
  id.writeBigUInt64LE(positionId);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("position", "utf8"), publicKey(config).toBuffer(), publicKey(owner).toBuffer(), id],
    publicKey(identities.economyProgramId),
  )[1];
}

function cumulativeUnlockedLane(state, week, code) {
  const total = bigintField(state.total, `${code}_TOTAL`);
  const genesis = bigintField(state.genesisUnlocked, `${code}_GENESIS`);
  const cliff = bigintField(state.cliffWeek, `${code}_CLIFF`);
  const end = bigintField(state.linearEndWeek, `${code}_END`);
  if (genesis > total || (end !== 0n && end < cliff)) fail(`${code}_POLICY`);
  if (end === 0n || week >= end) return total;
  if (week < cliff) return genesis;
  const duration = end - cliff;
  if (duration === 0n) fail(`${code}_DURATION`);
  return genesis + (total - genesis) * (week - cliff) / duration;
}

function eligibilityPdaBump(identities, config, wallet) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("eligibility", "utf8"), publicKey(config).toBuffer(), publicKey(wallet).toBuffer()],
    publicKey(identities.economyProgramId),
  )[1];
}

function assertSetEligibilityTransition(caseValue, state, cpi, identities) {
  const instruction = canonicalBase64(caseValue.instructionDataBase64, "STATE_INSTRUCTION", {
    allowEmpty: false,
  });
  if (instruction[16] !== 0 || instruction[17] !== 0) fail("SET_ELIGIBILITY_STANDARD_ROLE");
  const lifecycle = cpi;
  assertLifecycleAccountPost(
    state,
    "eligibility",
    "ECONOMY_ELIGIBILITY_V1",
    lifecycle,
    identities,
    "SET_ELIGIBILITY_LIFECYCLE_POST",
  );
  const after = state.decoded("eligibility", "after", "ECONOMY_ELIGIBILITY_V1");
  const config = state.account("config", "before").snapshot.pubkey;
  const wallet = state.account("wallet", "before").snapshot.pubkey;
  const expected = {
    codec: "ECONOMY_ELIGIBILITY_V1",
    config,
    wallet,
    agencyIndex: 0xffff_ffff,
    role: 0,
    bump: eligibilityPdaBump(identities, config, wallet),
  };
  if (canonicalIatB3ProductionOfficialRehearsalJson(after)
    !== canonicalIatB3ProductionOfficialRehearsalJson(expected)) {
    fail("SET_ELIGIBILITY_STATE_TRANSITION");
  }
}

function assertOpenPositionTransition(caseValue, state, cpi, identities) {
  const instruction = canonicalBase64(caseValue.instructionDataBase64, "STATE_INSTRUCTION", {
    allowEmpty: false,
  });
  const positionId = instruction.readBigUInt64LE(16);
  const principal = instruction.readBigUInt64LE(24);
  if (principal === 0n) fail("OPEN_POSITION_PRINCIPAL");
  assertLifecycleAccountPost(
    state,
    "position",
    "ECONOMY_POSITION_V1",
    cpi.lifecycle,
    identities,
    "OPEN_POSITION_LIFECYCLE_POST",
  );
  assertTokenAmountDelta(state, "owner_tokens", -principal, "OPEN_OWNER_TOKEN_DELTA");
  assertTokenAmountDelta(state, "stake_tokens", principal, "OPEN_STAKE_TOKEN_DELTA");
  const beforeConfig = state.decoded("config", "before");
  const afterConfig = state.decoded("config", "after");
  assertDecodedTransition(beforeConfig, afterConfig, {
    stakedPrincipal: (bigintField(beforeConfig.stakedPrincipal, "CONFIG_STAKED") + principal)
      .toString(),
  }, "OPEN_CONFIG_STAKED_CONSERVATION");
  const beforeOwnerTokens = state.decoded("owner_tokens", "before");
  const afterOwnerTokens = state.decoded("owner_tokens", "after");
  if (afterOwnerTokens.delegate !== beforeOwnerTokens.delegate
    || afterOwnerTokens.delegatedAmount !== beforeOwnerTokens.delegatedAmount) {
    fail("OPEN_DELEGATE_RESTORATION");
  }
  const afterPosition = state.decoded("position", "after", "ECONOMY_POSITION_V1");
  const acceptedWeek = bigintField(afterPosition.acceptedWeek, "OPEN_ACCEPTED_WEEK");
  const reserveByRole = {};
  let remainingObligation = principal * 1000n / 10_000n;
  for (const [role, field] of [
    ["treasury", "treasuryReserved"],
    ["ecosystem", "ecosystemReserved"],
    ["liquidity", "liquidityReserved"],
  ]) {
    const beforeLane = state.decoded(role, "before");
    const afterLane = state.decoded(role, "after");
    const delta = bigintField(afterLane.reserved, `${role}_RESERVED_AFTER`)
      - bigintField(beforeLane.reserved, `${role}_RESERVED_BEFORE`);
    if (delta < 0n) fail("OPEN_LANE_RESERVATION");
    if (beforeLane.rewardSource !== true) fail("OPEN_NON_REWARD_LANE");
    const used = bigintField(beforeLane.reserved, `${role}_RESERVED`)
      + bigintField(beforeLane.paid, `${role}_PAID`)
      + bigintField(beforeLane.principalClaimed, `${role}_PRINCIPAL_CLAIMED`);
    const unlocked = cumulativeUnlockedLane(beforeLane, acceptedWeek, `OPEN_${role}`);
    const expectedDelta = (unlocked > used ? unlocked - used : 0n) < remainingObligation
      ? (unlocked > used ? unlocked - used : 0n) : remainingObligation;
    if (delta !== expectedDelta) fail("OPEN_LANE_RESERVATION_ORDER");
    remainingObligation -= expectedDelta;
    assertDecodedTransition(beforeLane, afterLane, {
      reserved: (bigintField(beforeLane.reserved, `${role}_RESERVED`) + delta).toString(),
    }, "OPEN_LANE_RESERVATION");
    reserveByRole[field] = delta;
  }
  const obligation = principal * 1000n / 10_000n;
  if (Object.values(reserveByRole).reduce((sum, value) => sum + value, 0n) !== obligation) {
    fail("OPEN_REWARD_OBLIGATION_CONSERVATION");
  }
  const config = state.account("config", "before").snapshot.pubkey;
  const owner = state.account("owner", "before").snapshot.pubkey;
  const expectedPosition = {
    codec: "ECONOMY_POSITION_V1",
    config,
    owner,
    positionId: positionId.toString(),
    principal: principal.toString(),
    acceptedWeek: acceptedWeek.toString(),
    firstAccrualWeek: (acceptedWeek + 1n).toString(),
    termWeeks: "52",
    annualRateBps: "1000",
    treasuryReserved: reserveByRole.treasuryReserved.toString(),
    ecosystemReserved: reserveByRole.ecosystemReserved.toString(),
    liquidityReserved: reserveByRole.liquidityReserved.toString(),
    paid: "0",
    settledMask: "0",
    agencyIndex: 0xffff_ffff,
    role: 0,
    principalReturned: false,
    closed: false,
    bump: positionPdaBump(identities, config, owner, positionId),
  };
  if (canonicalIatB3ProductionOfficialRehearsalJson(afterPosition)
    !== canonicalIatB3ProductionOfficialRehearsalJson(expectedPosition)) {
    fail("OPEN_POSITION_STATE_TRANSITION");
  }
}

function settleTransferAmounts(cpi) {
  const amounts = [0n, 0n, 0n];
  for (const { groupIndex, amount } of cpi.transferAmounts) amounts[groupIndex] = amount;
  return amounts;
}

function assertSettlePositionTransition(caseValue, state, cpi) {
  const instruction = canonicalBase64(caseValue.instructionDataBase64, "STATE_INSTRUCTION", {
    allowEmpty: false,
  });
  const week = instruction.readBigUInt64LE(16);
  const beforePosition = state.decoded("position", "before");
  const afterPosition = state.decoded("position", "after");
  const firstWeek = bigintField(beforePosition.firstAccrualWeek, "SETTLE_FIRST_WEEK");
  const termWeeks = bigintField(beforePosition.termWeeks, "SETTLE_TERM_WEEKS");
  if (week < firstWeek || week - firstWeek >= termWeeks || beforePosition.role !== 0) {
    fail("SETTLE_WEEK_OR_ROLE");
  }
  const ordinal = week - firstWeek;
  const principal = bigintField(beforePosition.principal, "SETTLE_PRINCIPAL");
  const rate = bigintField(beforePosition.annualRateBps, "SETTLE_RATE");
  const maxReward = (weeks) => principal * rate * weeks / (10_000n * 52n);
  const expectedReward = maxReward(ordinal + 1n) - maxReward(ordinal);
  const amounts = settleTransferAmounts(cpi);
  const total = amounts.reduce((sum, value) => sum + value, 0n);
  if (total !== expectedReward || total === 0n) fail("SETTLE_REWARD_AMOUNT");
  const fields = ["treasuryReserved", "ecosystemReserved", "liquidityReserved"];
  const roles = ["treasury", "ecosystem", "liquidity"];
  const tokenRoles = ["treasury_tokens", "ecosystem_tokens", "liquidity_tokens"];
  let remaining = expectedReward;
  const expectedAmounts = fields.map((field) => {
    const reserved = bigintField(beforePosition[field], `SETTLE_${field}`);
    const amount = reserved < remaining ? reserved : remaining;
    remaining -= amount;
    return amount;
  });
  if (remaining !== 0n
    || canonicalIatB3ProductionOfficialRehearsalJson(amounts.map(String))
      !== canonicalIatB3ProductionOfficialRehearsalJson(expectedAmounts.map(String))) {
    fail("SETTLE_RESERVATION_CONSUMPTION_ORDER");
  }
  const positionChanges = {};
  for (let index = 0; index < roles.length; index += 1) {
    const amount = amounts[index];
    const beforeLane = state.decoded(roles[index], "before");
    const afterLane = state.decoded(roles[index], "after");
    if (bigintField(beforePosition[fields[index]], `SETTLE_${fields[index]}`) < amount) {
      fail("SETTLE_POSITION_RESERVATION_UNDERFLOW");
    }
    positionChanges[fields[index]] =
      (bigintField(beforePosition[fields[index]], `SETTLE_${fields[index]}`) - amount).toString();
    assertDecodedTransition(beforeLane, afterLane, {
      reserved: (bigintField(beforeLane.reserved, "SETTLE_LANE_RESERVED") - amount).toString(),
      paid: (bigintField(beforeLane.paid, "SETTLE_LANE_PAID") + amount).toString(),
    }, "SETTLE_LANE_STATE_TRANSITION");
    assertTokenAmountDelta(state, tokenRoles[index], -amount, "SETTLE_SOURCE_TOKEN_DELTA");
  }
  assertTokenAmountDelta(state, "destination_tokens", total, "SETTLE_DESTINATION_TOKEN_DELTA");
  const bit = 1n << ordinal;
  assertDecodedTransition(beforePosition, afterPosition, {
    ...positionChanges,
    paid: (bigintField(beforePosition.paid, "SETTLE_PAID") + total).toString(),
    settledMask: (bigintField(beforePosition.settledMask, "SETTLE_MASK") | bit).toString(),
  }, "SETTLE_POSITION_STATE_TRANSITION");
}

function assertClaimLaneTransition(state, cpi) {
  const amount = cpi.transferAmounts[0]?.amount;
  if (typeof amount !== "bigint" || amount === 0n) fail("CLAIM_TRANSFER_AMOUNT");
  const beforeLane = state.decoded("lane_state", "before");
  const afterLane = state.decoded("lane_state", "after");
  const committed = bigintField(beforeLane.reserved, "CLAIM_RESERVED")
    + bigintField(beforeLane.paid, "CLAIM_PAID")
    + bigintField(beforeLane.principalClaimed, "CLAIM_PRINCIPAL");
  if (amount > bigintField(beforeLane.total, "CLAIM_TOTAL") - committed) {
    fail("CLAIM_AMOUNT_CAPACITY");
  }
  assertDecodedTransition(beforeLane, afterLane, {
    principalClaimed: (bigintField(beforeLane.principalClaimed, "CLAIM_PRINCIPAL") + amount)
      .toString(),
  }, "CLAIM_LANE_STATE_TRANSITION");
  assertTokenAmountDelta(state, "lane_tokens", -amount, "CLAIM_SOURCE_TOKEN_DELTA");
  assertTokenAmountDelta(state, "destination_tokens", amount, "CLAIM_DESTINATION_TOKEN_DELTA");
}

function assertWithdrawTransition(state, cpi) {
  const beforePosition = state.decoded("position", "before");
  const afterPosition = state.decoded("position", "after");
  const principal = bigintField(beforePosition.principal, "WITHDRAW_PRINCIPAL");
  const amount = cpi.transferAmounts[0]?.amount;
  if (principal === 0n || amount !== principal || beforePosition.principalReturned !== false) {
    fail("WITHDRAW_PRINCIPAL_AMOUNT");
  }
  assertDecodedTransition(beforePosition, afterPosition, { principalReturned: true },
    "WITHDRAW_POSITION_STATE_TRANSITION");
  const beforeConfig = state.decoded("config", "before");
  const afterConfig = state.decoded("config", "after");
  assertDecodedTransition(beforeConfig, afterConfig, {
    stakedPrincipal: (bigintField(beforeConfig.stakedPrincipal, "WITHDRAW_STAKED") - principal)
      .toString(),
  }, "WITHDRAW_CONFIG_STATE_TRANSITION");
  assertTokenAmountDelta(state, "stake_tokens", -principal, "WITHDRAW_SOURCE_TOKEN_DELTA");
  assertTokenAmountDelta(state, "destination_tokens", principal, "WITHDRAW_DEST_TOKEN_DELTA");
}

function assertCloseTransition(state) {
  const beforePosition = state.decoded("position", "before");
  const afterPosition = state.decoded("position", "after");
  if (beforePosition.principalReturned !== true || beforePosition.closed !== false
    || bigintField(beforePosition.settledMask, "CLOSE_MASK") !== (1n << 52n) - 1n) {
    fail("CLOSE_POSITION_PREFLIGHT_STATE");
  }
  const changes = { closed: true };
  for (const [role, field] of [
    ["treasury", "treasuryReserved"],
    ["ecosystem", "ecosystemReserved"],
    ["liquidity", "liquidityReserved"],
  ]) {
    const reserved = bigintField(beforePosition[field], `CLOSE_${field}`);
    changes[field] = "0";
    const beforeLane = state.decoded(role, "before");
    const afterLane = state.decoded(role, "after");
    assertDecodedTransition(beforeLane, afterLane, {
      reserved: (bigintField(beforeLane.reserved, "CLOSE_LANE_RESERVED") - reserved).toString(),
    }, "CLOSE_LANE_STATE_TRANSITION");
  }
  assertDecodedTransition(beforePosition, afterPosition, changes, "CLOSE_POSITION_STATE_TRANSITION");
}

function validateOperationSpecificStateTransition(observation, expected, context, before, after) {
  if (expected.feePayerOnlyNoEffect) return;
  if (context.instructionCases.length !== 1) fail("ACTIVE_STATE_INSTRUCTION_COUNT");
  const caseValue = context.instructionCases[0];
  const instruction = canonicalBase64(caseValue.instructionDataBase64, "STATE_INSTRUCTION", {
    allowEmpty: false,
  });
  const state = semanticCaseContext(caseValue, before, after, context.fixtures);
  const cpi = validateSourceDerivedInnerCpi(
    observation.innerCpi,
    caseValue.opcode,
    caseValue.accountBindings,
    context.identities,
    context.fixtures,
    instruction,
  );
  if (caseValue.opcode === 5) assertSetEligibilityTransition(caseValue, state, cpi, context.identities);
  else if (caseValue.opcode === 6) assertOpenPositionTransition(caseValue, state, cpi, context.identities);
  else if (caseValue.opcode === 7) assertSettlePositionTransition(caseValue, state, cpi);
  else if (caseValue.opcode === 9) assertClaimLaneTransition(state, cpi);
  else if (caseValue.opcode === 10) assertWithdrawTransition(state, cpi);
  else if (caseValue.opcode === 11) assertCloseTransition(state);
  else fail("ACTIVE_OPERATION_SEMANTICS_UNSUPPORTED");
}

export function validateIatB3ProductionOfficialTransactionObservation(
  observation,
  expected,
  context = {},
) {
  const {
    feePayerPubkey,
    programBindingsSha256,
    fixtureBindingsSha256,
    economyProgramId,
    economyProgramAccount,
    fixtures,
    instructionCases,
  } = context;
  if (!Array.isArray(fixtures) || !Array.isArray(instructionCases)
    || instructionCases.length < 1 || instructionCases.length > 2
    || !economyProgramAccount) fail("OBSERVATION_CONTEXT");
  if (!exactKeys(observation, OBSERVATION_KEYS) || observation.id !== expected.id
    || observation.outcome !== expected.disposition || observation.errorCode !== expected.errorCode
    || observation.transactionConfirmed !== true
    || observation.programBindingsSha256 !== programBindingsSha256
    || observation.fixtureBindingsSha256 !== fixtureBindingsSha256
    || canonicalIatB3ProductionOfficialRehearsalJson(observation.logs)
      !== canonicalIatB3ProductionOfficialRehearsalJson(expected.logs)
    || canonicalIatB3ProductionOfficialRehearsalJson(observation.innerCpi)
      !== canonicalIatB3ProductionOfficialRehearsalJson(expected.innerCpi)) fail("OBSERVATION_BINDING");
  const submittedSignature = canonicalBase64(
    observation.submittedSignatureBase64,
    "SUBMITTED_SIGNATURE",
    { allowEmpty: false },
  );
  const landedSignature = canonicalBase64(
    observation.landedSignatureBase64,
    "LANDED_SIGNATURE",
    { allowEmpty: false },
  );
  if (submittedSignature.length !== 64 || !submittedSignature.equals(landedSignature)) {
    fail("SIGNATURE_EQUALITY");
  }
  if (observation.submittedSignatureSha256 !== sha256(submittedSignature)
    || observation.landedSignatureSha256 !== sha256(landedSignature)
    || observation.submittedSignatureSha256 !== observation.landedSignatureSha256) {
    fail("SIGNATURE_DIGEST_BINDING");
  }
  const decoded = {};
  for (const [submittedKey, landedKey, submittedHashKey, landedHashKey, code, outputKey] of [
    [
      "submittedMessageBase64", "landedMessageBase64",
      "submittedMessageSha256", "landedMessageSha256", "MESSAGE_EQUALITY", "message",
    ],
    [
      "submittedTransactionBase64", "landedTransactionBase64",
      "submittedTransactionSha256", "landedTransactionSha256", "TRANSACTION_EQUALITY", "transaction",
    ],
  ]) {
    const submitted = canonicalBase64(observation[submittedKey], code, { allowEmpty: false });
    const landed = canonicalBase64(observation[landedKey], code, { allowEmpty: false });
    if (!submitted.equals(landed) || observation[submittedHashKey] !== sha256(submitted)
      || observation[landedHashKey] !== sha256(landed)
      || observation[submittedHashKey] !== observation[landedHashKey]) fail(code);
    decoded[outputKey] = submitted;
  }
  let transaction;
  try {
    transaction = Transaction.from(decoded.transaction);
  } catch {
    fail("LEGACY_TRANSACTION_DECODE");
  }
  const parsedMessage = transaction.serializeMessage();
  if (!parsedMessage.equals(decoded.message)
    || !transaction.serialize({ requireAllSignatures: true, verifySignatures: false })
      .equals(decoded.transaction)
    || transaction.signatures[0]?.publicKey.toBase58() !== feePayerPubkey
    || !transaction.signatures[0]?.signature?.equals(submittedSignature)) {
    fail("LEGACY_TRANSACTION_WIRE_BINDING");
  }
  publicKey(transaction.recentBlockhash, "TRANSACTION_RECENT_BLOCKHASH");
  const expectedTransaction = new Transaction({
    feePayer: publicKey(feePayerPubkey, "TRANSACTION_FEE_PAYER"),
    recentBlockhash: transaction.recentBlockhash,
  });
  expectedTransaction.add(...instructionCases.map((caseValue) =>
    expectedInstruction(caseValue, economyProgramId)));
  if (!expectedTransaction.serializeMessage().equals(decoded.message)) {
    fail("TRANSACTION_INSTRUCTION_META_BINDING");
  }
  verifyRequiredEd25519Signatures(transaction, decoded.message);
  const messageAccountKeys = transaction.compileMessage().accountKeys
    .map((key) => key.toBase58());
  const before = canonicalIatB3ProductionAccountSnapshot(observation.beforeSnapshot);
  const after = canonicalIatB3ProductionAccountSnapshot(observation.afterSnapshot);
  if (snapshotSha256(before) !== expected.beforeStateSetSha256
    || snapshotSha256(after) !== expected.afterStateSetSha256
    || observation.terminalStateSetSha256 !== expected.terminalStateSetSha256
    || observation.terminalStateSetSha256 !== snapshotSha256(after)) fail("SNAPSHOT_HASH_CHAIN");
  const expectedMap = expectedSnapshotMap({
    ...context,
    economyProgramAccount,
    fixtures,
    instructionCases,
  }, messageAccountKeys);
  const sharedUpdates = validateSnapshotScope(before, after, context, expectedMap);
  validateLandedMeta(observation.landedMeta, observation, messageAccountKeys, before, after);
  assertFeePayerOnlyDelta(
    before,
    after,
    feePayerPubkey,
    observation.landedMeta.feeLamports,
    expected.feePayerOnlyNoEffect,
  );
  validateOperationSpecificStateTransition(observation, expected, context, before, after);
  for (const [pubkeyValue, account] of sharedUpdates) {
    context.sharedState.set(pubkeyValue, account);
  }
  return observation;
}

function executionBindingHashes(pack) {
  return {
    programBindingsSha256: sha256IatB3ProductionOfficialRehearsalValue({
      deployments: pack.deployments,
      artifacts: pack.artifactBindings,
      identities: pack.identities,
      identityEvidence: pack.identityEvidence,
      genesisDomains: pack.genesisDomains,
    }),
    fixtureBindingsSha256: pack.fixturesSha256,
  };
}

function expectedObservation(caseValue) {
  return { id: caseValue.id, ...caseValue.expected };
}

function validateObservationList(actual, cases, context) {
  if (!Array.isArray(actual) || actual.length !== cases.length) fail("OBSERVATION_COUNT");
  return actual.map((observation, index) =>
    validateIatB3ProductionOfficialTransactionObservation(
      observation,
      expectedObservation(cases[index]),
      { ...context, instructionCases: [cases[index]] },
    ));
}

function forcedFailureCase(row) {
  const law = row.activeCase.accountBindings.find(({ role }) => role === "daily_law_state");
  if (!law) fail("ROLLBACK_DAILY_LAW_ACCOUNT");
  return {
    instructionDataBase64: row.forcedFailureInstructionDataBase64,
    accountBindings: [law],
  };
}

function validateRollbackObservations(actual, rows, context) {
  if (!Array.isArray(actual) || actual.length !== rows.length) fail("ROLLBACK_OBSERVATION_COUNT");
  return actual.map((observation, index) => {
    const row = rows[index];
    if (!exactKeys(observation, ["id", "atomic", "standaloneRetry"])
      || observation.id !== row.id) fail("ROLLBACK_OBSERVATION");
    validateIatB3ProductionOfficialTransactionObservation(
      observation.atomic,
      { id: `${row.id}:ATOMIC`, ...row.atomicExpected },
      { ...context, instructionCases: [row.activeCase, forcedFailureCase(row)] },
    );
    validateIatB3ProductionOfficialTransactionObservation(
      observation.standaloneRetry,
      { id: `${row.id}:STANDALONE_RETRY`, ...row.retryExpected },
      { ...context, instructionCases: [row.activeCase] },
    );
    if (snapshotSha256(observation.atomic.afterSnapshot)
      !== snapshotSha256(observation.standaloneRetry.beforeSnapshot)) {
      fail("ROLLBACK_RETRY_START_STATE");
    }
    return observation;
  });
}

const EXECUTION_INPUT_KEYS = Object.freeze([
  "schema", "fixturePack", "validatorGenesisHash", "compiledLawDomainGenesisHash",
  "negativeDomainObservation", "positiveDomainObservation", "operationObservations",
  "opcode9ConditionalObservations", "rollbackObservations",
]);

const EXECUTION_RECEIPT_KEYS = Object.freeze([
  "schema", "status", "complete", "evidenceAccepted", "sourceContractSha256", "fixturePack",
  "fixturePackSha256", "programBindingsSha256", "fixtureBindingsSha256",
  "validatorGenesisHash", "compiledLawDomainGenesisHash", "negativeDomainObservation",
  "positiveDomainObservation", "operationObservations", "opcode9ConditionalObservations",
  "rollbackObservations", "truth", "blockers", "receiptSha256",
]);

export function createIatB3ProductionOfficialLocalRehearsalExecutionReceipt(input) {
  if (!exactKeys(input, EXECUTION_INPUT_KEYS)
    || input.schema !== IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_EXECUTION_INPUT_SCHEMA) {
    fail("EXECUTION_INPUT");
  }
  const pack = validateIatB3ProductionOfficialLocalRehearsalFixturePack(input.fixturePack);
  if (input.validatorGenesisHash !== pack.genesisDomains.validatorGenesisHash
    || input.compiledLawDomainGenesisHash !== pack.genesisDomains.compiledLawDomainGenesisHash) {
    fail("EXECUTION_GENESIS_DOMAINS");
  }
  const hashes = executionBindingHashes(pack);
  const baseContext = {
    feePayerPubkey: pack.signerPlan.feePayerPubkey,
    identities: pack.identities,
    economyProgramId: pack.identities.economyProgramId,
    economyProgramAccount: pack.productionEvidence.deployments.economy.program,
    fixtures: pack.fixtures,
    sharedInfrastructure: new Map(
      pack.sharedInfrastructure.map((entry) => [entry.pubkey, entry]),
    ),
    ...hashes,
  };
  const negativeDomainObservation = validateIatB3ProductionOfficialTransactionObservation(
    input.negativeDomainObservation,
    expectedObservation(pack.dualGenesisCases.negativeLocalDomain),
    {
      ...baseContext,
      instructionCases: [pack.dualGenesisCases.negativeLocalDomain],
      sharedState: new Map(),
    },
  );
  const positiveDomainObservation = validateIatB3ProductionOfficialTransactionObservation(
    input.positiveDomainObservation,
    expectedObservation(pack.dualGenesisCases.positiveCompiledDomain),
    {
      ...baseContext,
      instructionCases: [pack.dualGenesisCases.positiveCompiledDomain],
      sharedState: new Map(),
    },
  );
  const observedExecutionOrder = [
    ...(Array.isArray(input.operationObservations)
      ? input.operationObservations.map(({ id }) => id) : []),
    ...(Array.isArray(input.opcode9ConditionalObservations)
      ? input.opcode9ConditionalObservations.map(({ id }) => id) : []),
    ...(Array.isArray(input.rollbackObservations)
      ? input.rollbackObservations.flatMap(({ atomic, standaloneRetry }) =>
        [atomic?.id, standaloneRetry?.id]) : []),
  ];
  if (canonicalIatB3ProductionOfficialRehearsalJson(observedExecutionOrder)
    !== canonicalIatB3ProductionOfficialRehearsalJson(pack.executionOrder)) {
    fail("EXECUTION_ORDER_CHAIN");
  }
  const context = {
    ...baseContext,
    sharedState: new Map(),
  };
  const operationObservations = validateObservationList(
    input.operationObservations,
    pack.operationCases,
    context,
  );
  const opcode9ConditionalObservations = validateObservationList(
    input.opcode9ConditionalObservations,
    pack.opcode9ConditionalCases,
    context,
  );
  const rollbackObservations = validateRollbackObservations(
    input.rollbackObservations,
    pack.rollbackRows,
    context,
  );
  const core = {
    schema: IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_EXECUTION_RECEIPT_SCHEMA,
    status: pack.status === IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_TEST_STATUS
      ? "HOLD_TEST_EVIDENCE_ONLY" : "HOLD_SOURCE_ONLY_EVIDENCE_UNACCEPTED",
    complete: false,
    evidenceAccepted: false,
    sourceContractSha256: pack.sourceContractSha256,
    fixturePack: pack,
    fixturePackSha256: pack.fixturePackSha256,
    programBindingsSha256: hashes.programBindingsSha256,
    fixtureBindingsSha256: hashes.fixtureBindingsSha256,
    validatorGenesisHash: input.validatorGenesisHash,
    compiledLawDomainGenesisHash: input.compiledLawDomainGenesisHash,
    negativeDomainObservation,
    positiveDomainObservation,
    operationObservations,
    opcode9ConditionalObservations,
    rollbackObservations,
    truth: RECEIPT_TRUTH,
    blockers: RECEIPT_BLOCKERS,
  };
  return deepFreeze({ ...core, receiptSha256: sha256IatB3ProductionOfficialRehearsalValue(core) });
}

export function validateIatB3ProductionOfficialLocalRehearsalExecutionReceipt(receipt) {
  if (!exactKeys(receipt, EXECUTION_RECEIPT_KEYS)
    || receipt.schema !== IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_EXECUTION_RECEIPT_SCHEMA
    || !["HOLD_TEST_EVIDENCE_ONLY", "HOLD_SOURCE_ONLY_EVIDENCE_UNACCEPTED"].includes(receipt.status)
    || receipt.status === "OFFICIAL_COMPLETE" || receipt.complete !== false
    || receipt.evidenceAccepted !== false || receipt.truth?.officialComplete !== false
    || receipt.truth?.activationAuthorized !== false || receipt.truth?.mainnetStatus !== "HOLD"
    || canonicalIatB3ProductionOfficialRehearsalJson(receipt.truth)
      !== canonicalIatB3ProductionOfficialRehearsalJson(RECEIPT_TRUTH)
    || canonicalIatB3ProductionOfficialRehearsalJson(receipt.blockers)
      !== canonicalIatB3ProductionOfficialRehearsalJson(RECEIPT_BLOCKERS)
    || receipt.receiptSha256 !== digestCore(receipt, "receiptSha256")) fail("EXECUTION_RECEIPT");
  const reconstructed = createIatB3ProductionOfficialLocalRehearsalExecutionReceipt({
    schema: IAT_B3_PRODUCTION_OFFICIAL_REHEARSAL_EXECUTION_INPUT_SCHEMA,
    fixturePack: receipt.fixturePack,
    validatorGenesisHash: receipt.validatorGenesisHash,
    compiledLawDomainGenesisHash: receipt.compiledLawDomainGenesisHash,
    negativeDomainObservation: receipt.negativeDomainObservation,
    positiveDomainObservation: receipt.positiveDomainObservation,
    operationObservations: receipt.operationObservations,
    opcode9ConditionalObservations: receipt.opcode9ConditionalObservations,
    rollbackObservations: receipt.rollbackObservations,
  });
  if (canonicalIatB3ProductionOfficialRehearsalJson(reconstructed)
    !== canonicalIatB3ProductionOfficialRehearsalJson(receipt)) fail("EXECUTION_RECEIPT_REBIND");
  return receipt;
}
