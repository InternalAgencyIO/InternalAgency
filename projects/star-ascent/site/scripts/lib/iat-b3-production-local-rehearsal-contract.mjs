import { createHash } from "node:crypto";
import {
  lstatSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import {
  dirname,
  isAbsolute,
  join,
  parse as parsePath,
  relative,
  resolve,
} from "node:path";

import { PublicKey } from "@solana/web3.js";

import {
  IAT_B3_PRODUCTION_SOURCE_KEYS,
  canonicalIatB3ProductionMapJson,
  extractIatB3ProductionTransactionMaps,
} from "./iat-b3-production-transaction-map.mjs";
import {
  IAT_B3_PRODUCTION_UNSIGNED_BUILDERS,
} from "../../programs/iat_b3_economy/production-client.mjs";
import {
  assertOfficialIatB3ProductionLoopbackAdapter,
} from "./iat-b3-production-loopback-adapter.mjs";
import {
  assertIdentityAndOwnerPolicyBytes,
  validateCombinedLawBuildReceipt,
} from "../run-iat-b3-combined-law-reproducible-build.mjs";
import {
  assertEconomyIdentityAndOwnerPolicyBytes,
  validateEconomyBuildReceipt,
} from "../run-iat-b3-economy-reproducible-build.mjs";

export const IAT_B3_PRODUCTION_LOCAL_REHEARSAL_INPUT_SCHEMA =
  "iat-b3-production-local-rehearsal-input/v1";
export const IAT_B3_PRODUCTION_LOCAL_REHEARSAL_PREFLIGHT_SCHEMA =
  "iat-b3-production-local-rehearsal-preflight/v1";
export const IAT_B3_PRODUCTION_EXPECTED_DISPOSITIONS_SCHEMA =
  "iat-b3-production-expected-dispositions/v1";
export const IAT_B3_PRODUCTION_LOCAL_REHEARSAL_EXECUTION_PLAN_SCHEMA =
  "iat-b3-production-local-rehearsal-execution-plan/v1";
export const IAT_B3_PRODUCTION_LOCAL_REHEARSAL_EXECUTION_RECEIPT_SCHEMA =
  "iat-b3-production-local-rehearsal-execution-receipt/v1";

export const IAT_B3_UPGRADEABLE_LOADER_PROGRAM_ID =
  "BPFLoaderUpgradeab1e11111111111111111111111";

const HEX_SHA1 = /^[0-9a-f]{40}$/u;
const HEX_SHA256 = /^[0-9a-f]{64}$/u;
const ELF_MAGIC = Buffer.from([0x7f, 0x45, 0x4c, 0x46]);

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

export const canonicalIatB3ProductionLocalRehearsalJson = (value) =>
  JSON.stringify(canonicalize(value));

const digestCanonical = (value) => sha256(canonicalIatB3ProductionLocalRehearsalJson(value));

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
    || canonicalIatB3ProductionLocalRehearsalJson(Object.keys(value).sort())
      !== canonicalIatB3ProductionLocalRehearsalJson([...expected].sort())) {
    throw new TypeError(`IAT_B3_PRODUCTION_LOCAL_REHEARSAL_${label}_SHAPE_HOLD`);
  }
}

function validPublicKey(value) {
  try {
    return new PublicKey(value);
  } catch {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_PUBLIC_KEY_HOLD");
  }
}

const EXPECTED_OPERATIONS = [
  [0, "initialize_config", "INITIALIZATION_POLICY_HOLD", "InitializeConfigOwnerBootstrapPolicyUnaccepted"],
  [1, "initialize_lane_vault", "INITIALIZATION_POLICY_HOLD", "InitializeLaneVaultGenesisPolicyUnaccepted"],
  [2, "initialize_stake_vault", "INITIALIZATION_POLICY_HOLD", "InitializeStakeVaultGenesisPolicyUnaccepted"],
  [3, "activate", "INITIALIZATION_POLICY_HOLD", "ActivateGenesisAuthorizationAbsent"],
  [4, "register_agency", "INITIALIZATION_POLICY_HOLD", "RegisterAgencyCccDlcNotActive"],
  [5, "set_eligibility", "ACTIVE_EXPECTED_SUCCESS", null],
  [6, "open_position", "ACTIVE_EXPECTED_SUCCESS", null],
  [7, "settle_position_week", "ACTIVE_EXPECTED_SUCCESS", null],
  [8, "settle_core_week", "CORE_CUSTODY_POLICY_HOLD", "CoreCustodyPolicyUnresolved"],
  [9, "claim_lane_principal", "LANE_CONDITIONAL", null],
  [10, "withdraw_position_principal", "ACTIVE_EXPECTED_SUCCESS", null],
  [11, "close_position", "ACTIVE_EXPECTED_SUCCESS", null],
  [12, "commit_round", "CCC_DISABLED", "CccDlcNotActive"],
  [13, "settle_round", "CCC_DISABLED", "CccDlcNotActive"],
  [14, "expire_round", "CCC_DISABLED", "CccDlcNotActive"],
].map(([opcode, operation, expectedDisposition, expectedTypedError]) => ({
  opcode,
  operation,
  expectedDisposition,
  expectedTypedError,
  expectedExecutionEvidence: false,
  ...(opcode === 6 ? { variants: ["BASE", "RESTORE_DELEGATE"] } : {}),
  ...(opcode === 9 ? {
    laneCases: [
      { lanes: [1, 2, 4], expectedDisposition: "ACTIVE_EXPECTED_SUCCESS", expectedTypedError: null },
      { lanes: [3], expectedDisposition: "CORE_CUSTODY_POLICY_HOLD", expectedTypedError: "CoreCustodyPolicyUnresolved" },
      { excludedLanes: [1, 2, 3, 4], expectedDisposition: "INVALID_LANE", expectedTypedError: "InvalidLane" },
    ],
  } : {}),
}));

const ROLLBACK_TARGETS = [
  [5, "set_eligibility", "DEFAULT"],
  [6, "open_position", "BASE"],
  [7, "settle_position_week", "STANDARD"],
  [9, "claim_lane_principal", "NON_CORE_ACTIVE"],
  [10, "withdraw_position_principal", "DEFAULT"],
].map(([activeOpcode, activeOperation, activeVariant]) => ({
  id: `${activeOperation.toUpperCase()}_THEN_COMMIT_ROUND_DISABLED`,
  transactionInstructionOpcodes: [activeOpcode, 12],
  activeOpcode,
  activeOperation,
  activeVariant,
  forcedFailureOpcode: 12,
  expectedTypedError: "CccDlcNotActive",
  expectedActiveWritesCommitted: false,
  expectedAtomicRollback: true,
  executed: false,
  finalArtifactEvidence: "HOLD_UNEXECUTED",
}));

export const IAT_B3_PRODUCTION_EXPECTED_DISPOSITIONS = deepFreeze({
  schema: IAT_B3_PRODUCTION_EXPECTED_DISPOSITIONS_SCHEMA,
  contract: "EXPECTED_DISPOSITION_ONLY_NOT_EXECUTION_EVIDENCE",
  exactOperationCount: 15,
  operations: EXPECTED_OPERATIONS,
  exactRollbackProbeCount: 5,
  rollbackProbes: ROLLBACK_TARGETS,
  devnetExecuted: false,
  finalArtifactRollbackExecuted: false,
  mainnetExecutionAuthorized: false,
  mainnetStatus: "HOLD",
});

export const IAT_B3_PRODUCTION_EXPECTED_DISPOSITIONS_SHA256 =
  digestCanonical(IAT_B3_PRODUCTION_EXPECTED_DISPOSITIONS);

const FILE_KEYS = ["path", "sha256", "byteLength"];
const INPUT_KEYS = [
  "schema",
  "declaredHeadSha",
  "repositoryRoot",
  "rpc",
  "ledger",
  "identities",
  "productionMap",
  "artifacts",
  "expectedDispositionFixture",
  "executionBoundary",
];
const RPC_KEYS = ["url", "commitment", "networkPolicy"];
const LEDGER_KEYS = ["path", "mustNotExistBeforeRun", "cleanupPolicy"];
const IDENTITIES_KEYS = [
  "manifest",
  "ownerPolicy",
  "lawProgramId",
  "economyProgramId",
  "canonicalMint",
  "compiledLawDomainGenesisHash",
];
const MAP_KEYS = [
  "canonicalMapSha256",
  "sourceFiles",
  "transactionMapModule",
  "productionClientModule",
];
const ARTIFACTS_KEYS = ["law", "economy"];
const ARTIFACT_KEYS = ["kind", "programId", "elf", "receipt"];
const EXECUTION_KEYS = [
  "mode",
  "ephemeralSignerDirectory",
  "signerLoadPhase",
  "allowSignerLoad",
  "allowValidatorSpawn",
  "allowRpc",
  "allowSigning",
  "allowSend",
  "allowKeyGeneration",
];

function isWithin(parent, candidate) {
  const suffix = relative(parent, candidate);
  return suffix === "" || (!suffix.startsWith("..") && !isAbsolute(suffix));
}

function assertCanonicalAbsolutePath(path, label) {
  if (typeof path !== "string" || !isAbsolute(path) || resolve(path) !== path) {
    throw new TypeError(`IAT_B3_PRODUCTION_LOCAL_REHEARSAL_${label}_PATH_HOLD`);
  }
}

function assertNoSymlinkSegments(path, { includeLeaf = true } = {}) {
  const target = includeLeaf ? path : dirname(path);
  const parsed = parsePath(target);
  let current = parsed.root;
  const suffix = target.slice(parsed.root.length).split(/[\\/]/u).filter(Boolean);
  for (const component of suffix) {
    current = join(current, component);
    const stat = lstatSync(current);
    if (stat.isSymbolicLink()) {
      throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_SYMLINK_HOLD");
    }
  }
}

function readBoundFile(descriptor, label, { outsideRepositoryRoot = null } = {}) {
  exactKeys(descriptor, FILE_KEYS, `${label}_FILE`);
  assertCanonicalAbsolutePath(descriptor.path, label);
  if (!HEX_SHA256.test(descriptor.sha256)
    || !Number.isSafeInteger(descriptor.byteLength)
    || descriptor.byteLength <= 0) {
    throw new TypeError(`IAT_B3_PRODUCTION_LOCAL_REHEARSAL_${label}_BINDING_HOLD`);
  }
  assertNoSymlinkSegments(descriptor.path);
  const canonical = realpathSync.native(descriptor.path);
  const before = lstatSync(canonical);
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new TypeError(`IAT_B3_PRODUCTION_LOCAL_REHEARSAL_${label}_REGULAR_FILE_HOLD`);
  }
  if (outsideRepositoryRoot !== null && isWithin(outsideRepositoryRoot, canonical)) {
    throw new TypeError(`IAT_B3_PRODUCTION_LOCAL_REHEARSAL_${label}_INSIDE_REPOSITORY_HOLD`);
  }
  const bytes = readFileSync(canonical);
  const after = lstatSync(canonical);
  if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size
    || before.mtimeMs !== after.mtimeMs || bytes.length !== descriptor.byteLength
    || sha256(bytes) !== descriptor.sha256) {
    throw new TypeError(`IAT_B3_PRODUCTION_LOCAL_REHEARSAL_${label}_HASH_HOLD`);
  }
  return bytes;
}

function parseJson(bytes, label, { canonicalFile = false } = {}) {
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new TypeError(`IAT_B3_PRODUCTION_LOCAL_REHEARSAL_${label}_JSON_HOLD`);
  }
  if (canonicalFile
    && bytes.toString("utf8") !== `${canonicalIatB3ProductionLocalRehearsalJson(value)}\n`) {
    throw new TypeError(`IAT_B3_PRODUCTION_LOCAL_REHEARSAL_${label}_CANONICAL_JSON_HOLD`);
  }
  return value;
}

function validateLoopbackRpc(rpc) {
  exactKeys(rpc, RPC_KEYS, "RPC");
  let url;
  try {
    url = new URL(rpc.url);
  } catch {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_RPC_URL_HOLD");
  }
  const port = Number(url.port);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1"
    || url.username !== "" || url.password !== "" || url.pathname !== "/"
    || url.search !== "" || url.hash !== "" || !Number.isInteger(port)
    || port < 1024 || port > 65_535 || rpc.commitment !== "confirmed"
    || rpc.networkPolicy !== "LOOPBACK_ONLY") {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_RPC_LOOPBACK_HOLD");
  }
}

function validateDisposablePath(input, repositoryRoot) {
  exactKeys(input.ledger, LEDGER_KEYS, "LEDGER");
  assertCanonicalAbsolutePath(input.ledger.path, "LEDGER");
  if (isWithin(repositoryRoot, input.ledger.path)
    || input.ledger.mustNotExistBeforeRun !== true
    || input.ledger.cleanupPolicy
      !== "REMOVE_ONLY_IF_CREATED_BY_THIS_PROCESS_AND_MARKER_MATCHES") {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_LEDGER_POLICY_HOLD");
  }
  try {
    lstatSync(input.ledger.path);
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_LEDGER_ALREADY_EXISTS_HOLD");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  assertNoSymlinkSegments(input.ledger.path, { includeLeaf: false });
}

function validateExecutionBoundary(boundary, repositoryRoot) {
  exactKeys(boundary, EXECUTION_KEYS, "EXECUTION_BOUNDARY");
  assertCanonicalAbsolutePath(boundary.ephemeralSignerDirectory, "SIGNER_DIRECTORY");
  if (isWithin(repositoryRoot, boundary.ephemeralSignerDirectory)
    || boundary.mode !== "PREFLIGHT_ONLY"
    || boundary.signerLoadPhase !== "AFTER_ALL_FIXTURE_AND_ARTIFACT_CHECKS"
    || boundary.allowSignerLoad !== false
    || boundary.allowValidatorSpawn !== false
    || boundary.allowRpc !== false
    || boundary.allowSigning !== false
    || boundary.allowSend !== false
    || boundary.allowKeyGeneration !== false) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_EXECUTION_BOUNDARY_HOLD");
  }
  assertNoSymlinkSegments(boundary.ephemeralSignerDirectory, { includeLeaf: false });
}

function validateElfIdentity(bytes, identities, roles, label) {
  if (bytes.length < ELF_MAGIC.length || !bytes.subarray(0, ELF_MAGIC.length).equals(ELF_MAGIC)) {
    throw new TypeError(`IAT_B3_PRODUCTION_LOCAL_REHEARSAL_${label}_ELF_HOLD`);
  }
  for (const role of roles) {
    const key = validPublicKey(identities[role]).toBuffer();
    if (bytes.indexOf(key) === -1) {
      throw new TypeError(`IAT_B3_PRODUCTION_LOCAL_REHEARSAL_${label}_${role.toUpperCase()}_BYTES_HOLD`);
    }
  }
}

function assertDistinctBoundInputFiles(input) {
  const descriptors = [
    ["IDENTITY_MANIFEST", input.identities.manifest],
    ["OWNER_POLICY", input.identities.ownerPolicy],
    ["TRANSACTION_MAP_MODULE", input.productionMap.transactionMapModule],
    ["PRODUCTION_CLIENT_MODULE", input.productionMap.productionClientModule],
    ...IAT_B3_PRODUCTION_SOURCE_KEYS.map((key) => [
      `MAP_SOURCE_${key}`,
      input.productionMap.sourceFiles[key],
    ]),
    ["LAW_ELF", input.artifacts.law.elf],
    ["LAW_RECEIPT", input.artifacts.law.receipt],
    ["ECONOMY_ELF", input.artifacts.economy.elf],
    ["ECONOMY_RECEIPT", input.artifacts.economy.receipt],
    ["EXPECTED_DISPOSITION_FIXTURE", input.expectedDispositionFixture],
  ];
  const paths = new Map();
  for (const [label, descriptor] of descriptors) {
    const prior = paths.get(descriptor.path);
    if (prior !== undefined) {
      throw new TypeError(
        `IAT_B3_PRODUCTION_LOCAL_REHEARSAL_BOUND_FILE_ALIAS_HOLD:${prior}:${label}`,
      );
    }
    paths.set(descriptor.path, label);
  }
}

function validateArtifact({ descriptor, input, repositoryRoot, identityBinding, validator }) {
  exactKeys(descriptor, ARTIFACT_KEYS, `${descriptor?.kind ?? "UNKNOWN"}_ARTIFACT`);
  if (descriptor.kind !== input.kind || descriptor.programId !== input.programId) {
    throw new TypeError(`IAT_B3_PRODUCTION_LOCAL_REHEARSAL_${input.kind}_PROGRAM_ID_HOLD`);
  }
  const elf = readBoundFile(descriptor.elf, `${input.kind}_ELF`, {
    outsideRepositoryRoot: repositoryRoot,
  });
  const receiptBytes = readBoundFile(descriptor.receipt, `${input.kind}_RECEIPT`, {
    outsideRepositoryRoot: repositoryRoot,
  });
  const receipt = validator(parseJson(receiptBytes, `${input.kind}_RECEIPT`));
  if (receipt.source.declaredHeadSha !== input.declaredHeadSha
    || receipt.artifact.sha256 !== descriptor.elf.sha256
    || receipt.artifact.byteLength !== descriptor.elf.byteLength
    || receipt.identityBinding.manifestSha256 !== identityBinding.manifestSha256
    || receipt.identityBinding.environmentBindingSha256
      !== identityBinding.environmentBindingSha256) {
    throw new TypeError(`IAT_B3_PRODUCTION_LOCAL_REHEARSAL_${input.kind}_RECEIPT_BINDING_HOLD`);
  }
  validateElfIdentity(
    elf,
    input.identities,
    input.kind === "LAW"
      ? ["lawProgramId", "economyProgramId", "canonicalMint"]
      : ["economyProgramId", "lawProgramId", "canonicalMint"],
    input.kind,
  );
  return { artifactSha256: descriptor.elf.sha256, receiptSha256: descriptor.receipt.sha256 };
}

export function readCanonicalIatB3ProductionLocalRehearsalInput(path) {
  assertCanonicalAbsolutePath(path, "INPUT");
  assertNoSymlinkSegments(path);
  const bytes = readFileSync(path);
  return parseJson(bytes, "INPUT", { canonicalFile: true });
}

export function preflightIatB3ProductionLocalRehearsal(input, dependencies = {}) {
  const testOnlyValidatorOverride = Object.keys(dependencies).length > 0;
  exactKeys(input, INPUT_KEYS, "INPUT");
  if (input.schema !== IAT_B3_PRODUCTION_LOCAL_REHEARSAL_INPUT_SCHEMA
    || !HEX_SHA1.test(input.declaredHeadSha)) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_INPUT_IDENTITY_HOLD");
  }
  assertCanonicalAbsolutePath(input.repositoryRoot, "REPOSITORY_ROOT");
  assertNoSymlinkSegments(input.repositoryRoot);
  const repositoryRoot = realpathSync.native(input.repositoryRoot);
  validateLoopbackRpc(input.rpc);
  validateDisposablePath(input, repositoryRoot);
  validateExecutionBoundary(input.executionBoundary, repositoryRoot);

  exactKeys(input.identities, IDENTITIES_KEYS, "IDENTITIES");
  exactKeys(input.productionMap, MAP_KEYS, "PRODUCTION_MAP");
  exactKeys(input.productionMap.sourceFiles, IAT_B3_PRODUCTION_SOURCE_KEYS, "MAP_SOURCES");
  exactKeys(input.artifacts, ARTIFACTS_KEYS, "ARTIFACTS");
  exactKeys(input.artifacts.law, ARTIFACT_KEYS, "LAW_ARTIFACT");
  exactKeys(input.artifacts.economy, ARTIFACT_KEYS, "ECONOMY_ARTIFACT");
  assertDistinctBoundInputFiles(input);

  const expectedBytes = readBoundFile(
    input.expectedDispositionFixture,
    "EXPECTED_DISPOSITION_FIXTURE",
  );
  const expected = parseJson(expectedBytes, "EXPECTED_DISPOSITION_FIXTURE", {
    canonicalFile: true,
  });
  if (canonicalIatB3ProductionLocalRehearsalJson(expected)
    !== canonicalIatB3ProductionLocalRehearsalJson(IAT_B3_PRODUCTION_EXPECTED_DISPOSITIONS)) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_EXPECTED_DISPOSITION_DRIFT_HOLD");
  }

  const manifestBytes = readBoundFile(input.identities.manifest, "IDENTITY_MANIFEST");
  const ownerPolicyBytes = readBoundFile(input.identities.ownerPolicy, "OWNER_POLICY");
  const lawIdentity = (dependencies.assertLawIdentity ?? assertIdentityAndOwnerPolicyBytes)({
    identityManifestBytes: manifestBytes,
    ownerPolicyBytes,
  });
  const economyIdentity = (dependencies.assertEconomyIdentity
    ?? assertEconomyIdentityAndOwnerPolicyBytes)({
    identityManifestBytes: manifestBytes,
    ownerPolicyBytes,
  });
  for (const role of [
    "lawProgramId",
    "economyProgramId",
    "canonicalMint",
    "compiledLawDomainGenesisHash",
  ]) {
    validPublicKey(input.identities[role]);
  }
  if (new Set([
    input.identities.lawProgramId,
    input.identities.economyProgramId,
    input.identities.canonicalMint,
    input.identities.compiledLawDomainGenesisHash,
  ]).size !== 4) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_IDENTITY_COLLISION_HOLD");
  }
  const expectedEnvironment = {
    IAT_B3_PRODUCTION_LAW_PROGRAM_ID: input.identities.lawProgramId,
    IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID: input.identities.economyProgramId,
    IAT_B3_PRODUCTION_CANONICAL_MINT: input.identities.canonicalMint,
  };
  for (const [name, value] of Object.entries(expectedEnvironment)) {
    if (lawIdentity.environment[name] !== value || economyIdentity.environment[name] !== value) {
      throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_IDENTITY_ENVIRONMENT_HOLD");
    }
  }
  if (economyIdentity.environment.IAT_B3_PRODUCTION_MAINNET_GENESIS_HASH
    !== input.identities.compiledLawDomainGenesisHash) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_LAW_DOMAIN_IDENTITY_HOLD");
  }

  if (!HEX_SHA256.test(input.productionMap.canonicalMapSha256)) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_MAP_HASH_HOLD");
  }
  readBoundFile(input.productionMap.transactionMapModule, "TRANSACTION_MAP_MODULE");
  readBoundFile(input.productionMap.productionClientModule, "PRODUCTION_CLIENT_MODULE");
  const sourceInput = Object.fromEntries(IAT_B3_PRODUCTION_SOURCE_KEYS.map((key) => [
    key,
    readBoundFile(input.productionMap.sourceFiles[key], `MAP_SOURCE_${key}`).toString("utf8"),
  ]));
  const map = extractIatB3ProductionTransactionMaps(sourceInput);
  if (map.canonicalMapSha256 !== input.productionMap.canonicalMapSha256
    || map.operations.length !== 15 || IAT_B3_PRODUCTION_UNSIGNED_BUILDERS.length !== 15
    || map.operations.some((operation, opcode) => operation.opcode !== opcode
      || operation.name !== IAT_B3_PRODUCTION_EXPECTED_DISPOSITIONS.operations[opcode].operation)) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_MAP_CLIENT_DRIFT_HOLD");
  }

  const law = validateArtifact({
    descriptor: input.artifacts.law,
    input: { ...input, kind: "LAW", programId: input.identities.lawProgramId },
    repositoryRoot,
    identityBinding: lawIdentity.receiptBinding,
    validator: dependencies.validateLawReceipt ?? validateCombinedLawBuildReceipt,
  });
  const economy = validateArtifact({
    descriptor: input.artifacts.economy,
    input: { ...input, kind: "ECONOMY", programId: input.identities.economyProgramId },
    repositoryRoot,
    identityBinding: economyIdentity.receiptBinding,
    validator: dependencies.validateEconomyReceipt ?? validateEconomyBuildReceipt,
  });
  if (input.artifacts.law.elf.path === input.artifacts.economy.elf.path
    || input.artifacts.law.elf.sha256 === input.artifacts.economy.elf.sha256
    || input.artifacts.law.receipt.path === input.artifacts.economy.receipt.path
    || input.artifacts.law.receipt.sha256 === input.artifacts.economy.receipt.sha256) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_DUAL_ARTIFACT_COLLISION_HOLD");
  }

  const core = {
    schema: IAT_B3_PRODUCTION_LOCAL_REHEARSAL_PREFLIGHT_SCHEMA,
    status: testOnlyValidatorOverride
      ? "HOLD_TEST_VALIDATION_ONLY"
      : "OFFICIAL_READY",
    exitCode: testOnlyValidatorOverride ? 2 : 0,
    validationAuthority: testOnlyValidatorOverride
      ? "TEST_ONLY_OVERRIDES_NOT_EVIDENCE"
      : "SOURCE_BOUND_IDENTITY_AND_DOCKER_RECEIPT_VALIDATORS",
    inputBindingSha256: digestCanonical(input),
    declaredHeadSha: input.declaredHeadSha,
    productionMapSha256: map.canonicalMapSha256,
    expectedDispositionsSha256: IAT_B3_PRODUCTION_EXPECTED_DISPOSITIONS_SHA256,
    artifactBindings: { law, economy },
    expectedDispositions: IAT_B3_PRODUCTION_EXPECTED_DISPOSITIONS,
    blockers: [
      ...(testOnlyValidatorOverride ? ["TEST_ONLY_VALIDATOR_OVERRIDE"] : []),
      "LOCAL_EXECUTION_DRIVER_NOT_IMPLEMENTED",
      "EPHEMERAL_SIGNERS_NOT_LOADED",
      "VALIDATOR_NOT_STARTED",
      "ALL_15_NOT_EXECUTED",
      "FIVE_FINAL_ARTIFACT_ROLLBACK_PROBES_NOT_EXECUTED",
      "DEVNET_NOT_EXECUTED",
      "MAINNET_HOLD",
    ],
    safety: {
      preflightOnly: true,
      officialIdentityAndReceiptValidatorsUsed: !testOnlyValidatorOverride,
      fixtureValidationCompletedBeforeSignerLoad: true,
      signerFilesLoaded: false,
      validatorSpawned: false,
      ledgerCreated: false,
      keyGenerated: false,
      rpcUsed: false,
      transactionSigned: false,
      transactionSent: false,
      networkUsed: false,
      executionEvidenceCreated: false,
      mainnetExecutionAuthorized: false,
    },
  };
  return deepFreeze({ ...core, preflightSha256: digestCanonical(core) });
}

export function observeIatB3ProductionLocalRehearsalPreflight({
  inputPath,
  dependencies,
} = {}) {
  try {
    if (typeof inputPath !== "string" || inputPath.length === 0) {
      throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_INPUT_REQUIRED_HOLD");
    }
    return preflightIatB3ProductionLocalRehearsal(
      readCanonicalIatB3ProductionLocalRehearsalInput(inputPath),
      dependencies,
    );
  } catch (error) {
    const core = {
      schema: IAT_B3_PRODUCTION_LOCAL_REHEARSAL_PREFLIGHT_SCHEMA,
      status: "HOLD",
      exitCode: 2,
      validationAuthority: "NOT_COMPLETED",
      inputBindingSha256: null,
      expectedDispositionsSha256: IAT_B3_PRODUCTION_EXPECTED_DISPOSITIONS_SHA256,
      expectedDispositions: IAT_B3_PRODUCTION_EXPECTED_DISPOSITIONS,
      blockers: [error instanceof Error ? error.message : "UNKNOWN_PREFLIGHT_HOLD"],
      safety: {
        preflightOnly: true,
        officialIdentityAndReceiptValidatorsUsed: false,
        fixtureValidationCompletedBeforeSignerLoad: false,
        signerFilesLoaded: false,
        validatorSpawned: false,
        ledgerCreated: false,
        keyGenerated: false,
        rpcUsed: false,
        transactionSigned: false,
        transactionSent: false,
        networkUsed: false,
        executionEvidenceCreated: false,
        mainnetExecutionAuthorized: false,
      },
    };
    return deepFreeze({ ...core, preflightSha256: digestCanonical(core) });
  }
}

export function validateIatB3ProductionLocalRehearsalPreflight(record) {
  if (!record || typeof record !== "object" || !HEX_SHA256.test(record.preflightSha256 ?? "")) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_PREFLIGHT_RECORD_HOLD");
  }
  const { preflightSha256, ...core } = record;
  if (preflightSha256 !== digestCanonical(core)
    || record.schema !== IAT_B3_PRODUCTION_LOCAL_REHEARSAL_PREFLIGHT_SCHEMA
    || ![
      "HOLD",
      "HOLD_TEST_VALIDATION_ONLY",
      "OFFICIAL_READY",
    ].includes(record.status)
    || (record.status === "OFFICIAL_READY"
      && (record.exitCode !== 0
        || record.validationAuthority !== "SOURCE_BOUND_IDENTITY_AND_DOCKER_RECEIPT_VALIDATORS"
        || !HEX_SHA256.test(record.inputBindingSha256 ?? "")
        || record.safety?.officialIdentityAndReceiptValidatorsUsed !== true))
    || (record.status === "HOLD_TEST_VALIDATION_ONLY"
      && (record.exitCode !== 2
        || record.validationAuthority !== "TEST_ONLY_OVERRIDES_NOT_EVIDENCE"
        || record.safety?.officialIdentityAndReceiptValidatorsUsed !== false
        || !record.blockers?.includes("TEST_ONLY_VALIDATOR_OVERRIDE")))
    || (record.status === "HOLD" && record.exitCode !== 2)
    || record.safety?.preflightOnly !== true
    || record.safety?.signerFilesLoaded !== false
    || record.safety?.validatorSpawned !== false
    || record.safety?.rpcUsed !== false
    || record.safety?.transactionSigned !== false
    || record.safety?.transactionSent !== false
    || record.safety?.networkUsed !== false
    || record.safety?.mainnetExecutionAuthorized !== false) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_PREFLIGHT_DIGEST_HOLD");
  }
  return record;
}

export const canonicalIatB3ProductionMapBindingJson = canonicalIatB3ProductionMapJson;

const EXECUTION_PLAN_KEYS = [
  "schema",
  "preflightSha256",
  "inputBindingSha256",
  "rpcUrl",
  "validatorGenesisHash",
  "compiledLawDomainGenesisHash",
  "lawDomainCases",
  "dailyLawState",
  "loaderProgramId",
  "deployments",
  "accountFixtures",
  "signers",
  "operationCases",
  "rollbackCases",
];
const DEPLOYMENT_SET_KEYS = ["law", "economy"];
const LAW_DOMAIN_CASE_SET_KEYS = ["positive", "negative"];
const LAW_DOMAIN_CASE_KEYS = ["lawStateDomainHash", "expectedErrorCode", "executed"];
const DEPLOYMENT_KEYS = [
  "kind",
  "programId",
  "programDataAddress",
  "upgradeAuthority",
  "programAccountDataSha256",
  "programAccountDataLength",
  "programDataAccountSha256",
  "programDataAccountLength",
  "elfOffset",
  "artifactSha256",
  "artifactByteLength",
];
const DEPLOYMENT_OBSERVATION_KEYS = [
  "programId",
  "programAccountOwner",
  "programAccountExecutable",
  "programAccountDataBase64",
  "programDataAddress",
  "programDataOwner",
  "programDataExecutable",
  "programDataBase64",
];
const ACCOUNT_FIXTURE_KEYS = [
  "role",
  "codec",
  "pubkey",
  "owner",
  "executable",
  "dataLength",
  "dataSha256",
  "decodedStateSha256",
  "pda",
];
const PDA_KEYS = ["programId", "seeds", "bump"];
const PDA_SEED_KEYS = ["encoding", "value"];
const SIGNER_KEYS = ["role", "expectedPubkey", "feePayer"];
const SOURCE_BOUND_FIXTURE_CODECS = new Set([
  "LAW_STATE_V1",
  "ECONOMY_CONFIG_V1",
  "ECONOMY_POSITION_V1",
  "ECONOMY_LANE_V1",
  "ECONOMY_ELIGIBILITY_V1",
  "TOKEN_2022_MINT",
  "TOKEN_2022_ACCOUNT",
  "SYSTEM_VACANT",
  "UPGRADEABLE_PROGRAM",
  "BYTE_BOUND",
]);
const INSTRUCTION_SPEC_KEYS = ["opcode", "payload", "variant", "accounts"];
const OPERATION_CASE_KEYS = [
  "id",
  ...INSTRUCTION_SPEC_KEYS,
  "signerRoles",
  "snapshotPubkeys",
  "expected",
];
const CASE_EXPECTED_KEYS = [
  "disposition",
  "errorCode",
  "requiredInnerCpiProgramIds",
  "logsSha256",
  "innerCpiSha256",
  "transitionSha256",
];
const ROLLBACK_CASE_KEYS = [
  "id",
  "activeInstruction",
  "signerRoles",
  "snapshotPubkeys",
  "atomicExpected",
  "retryExpected",
];
const ACCOUNT_OBSERVATION_KEYS = [
  "pubkey",
  "owner",
  "executable",
  "lamports",
  "rentEpoch",
  "dataBase64",
];
const EXECUTION_RESULT_KEYS = [
  "signature",
  "slot",
  "confirmationStatus",
  "errorCode",
  "feeLamports",
  "submittedMessageSha256",
  "landedMessageSha256",
  "submittedTransactionSha256",
  "landedTransactionSha256",
  "logs",
  "innerCpi",
];
const INNER_CPI_KEYS = ["instructionIndex", "programId", "dataSha256", "accountPubkeys"];

const EXPECTED_ENTRYPOINT_ERROR_CODES = Object.freeze([
  0xE540, 0xE541, 0xE542, 0xE543, 0xE544,
  null, null, null, 0xE50E, null, null, null,
  0xE50A, 0xE50A, 0xE50A,
]);

function assertEntrypointErrorSource(entrypointSource) {
  for (const marker of [
    "PRODUCTION_INITIALIZATION_POLICY_HOLD_ERROR_BASE: u32 = 0xE540",
    "CccDlcNotActive = 0xE50A",
    "CoreCustodyPolicyHold = 0xE50E",
    "PRODUCTION_INITIALIZATION_POLICY_HOLD_ERROR_BASE + u32::from(hold.opcode())",
  ]) {
    if (!entrypointSource.includes(marker)) {
      throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_ENTRYPOINT_ERROR_SOURCE_HOLD");
    }
  }
}

function loadProductionMapFromBoundInput(input) {
  const sourceInput = Object.fromEntries(IAT_B3_PRODUCTION_SOURCE_KEYS.map((key) => [
    key,
    readBoundFile(input.productionMap.sourceFiles[key], `EXECUTION_MAP_SOURCE_${key}`)
      .toString("utf8"),
  ]));
  assertEntrypointErrorSource(sourceInput.entrypointSource);
  const map = extractIatB3ProductionTransactionMaps(sourceInput);
  if (map.canonicalMapSha256 !== input.productionMap.canonicalMapSha256) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_EXECUTION_MAP_HOLD");
  }
  return map;
}

function canonicalBase64(value, label) {
  if (typeof value !== "string") {
    throw new TypeError(`IAT_B3_PRODUCTION_LOCAL_REHEARSAL_${label}_BASE64_HOLD`);
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) {
    throw new TypeError(`IAT_B3_PRODUCTION_LOCAL_REHEARSAL_${label}_BASE64_HOLD`);
  }
  return bytes;
}

function decimalString(value, label) {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(value)) {
    throw new TypeError(`IAT_B3_PRODUCTION_LOCAL_REHEARSAL_${label}_DECIMAL_HOLD`);
  }
  return BigInt(value);
}

function seedBytes(seed) {
  exactKeys(seed, PDA_SEED_KEYS, "PDA_SEED");
  switch (seed.encoding) {
    case "utf8":
      if (typeof seed.value !== "string" || seed.value.length === 0) break;
      return Buffer.from(seed.value, "utf8");
    case "pubkey":
      return validPublicKey(seed.value).toBuffer();
    case "u8":
      if (Number.isInteger(seed.value) && seed.value >= 0 && seed.value <= 0xff) {
        return Buffer.from([seed.value]);
      }
      break;
    case "u64le": {
      const value = decimalString(seed.value, "PDA_U64");
      if (value <= 0xffff_ffff_ffff_ffffn) {
        const bytes = Buffer.alloc(8);
        bytes.writeBigUInt64LE(value);
        return bytes;
      }
      break;
    }
    default:
      break;
  }
  throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_PDA_SEED_VALUE_HOLD");
}

function validateFixturePda(fixture) {
  if (fixture.pda === null) return;
  exactKeys(fixture.pda, PDA_KEYS, "PDA");
  if (!Array.isArray(fixture.pda.seeds) || fixture.pda.seeds.length === 0
    || fixture.pda.seeds.length > 16 || !Number.isInteger(fixture.pda.bump)
    || fixture.pda.bump < 0 || fixture.pda.bump > 0xff) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_PDA_SHAPE_HOLD");
  }
  const [derived, bump] = PublicKey.findProgramAddressSync(
    fixture.pda.seeds.map(seedBytes),
    validPublicKey(fixture.pda.programId),
  );
  if (!derived.equals(validPublicKey(fixture.pubkey)) || bump !== fixture.pda.bump) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_PDA_DERIVATION_HOLD");
  }
}

function validateExecutionPlan(plan, preflight, input) {
  exactKeys(plan, EXECUTION_PLAN_KEYS, "EXECUTION_PLAN");
  if (plan.schema !== IAT_B3_PRODUCTION_LOCAL_REHEARSAL_EXECUTION_PLAN_SCHEMA
    || plan.preflightSha256 !== preflight.preflightSha256
    || plan.inputBindingSha256 !== preflight.inputBindingSha256
    || plan.inputBindingSha256 !== digestCanonical(input)
    || plan.rpcUrl !== input.rpc.url
    || plan.compiledLawDomainGenesisHash !== input.identities.compiledLawDomainGenesisHash
    || plan.loaderProgramId !== IAT_B3_UPGRADEABLE_LOADER_PROGRAM_ID) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_EXECUTION_PLAN_BINDING_HOLD");
  }
  const validatorGenesis = validPublicKey(plan.validatorGenesisHash);
  if (validatorGenesis.equals(PublicKey.default)
    || plan.validatorGenesisHash === plan.compiledLawDomainGenesisHash) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_VALIDATOR_GENESIS_DOMAIN_HOLD");
  }
  validPublicKey(plan.compiledLawDomainGenesisHash);
  exactKeys(plan.lawDomainCases, LAW_DOMAIN_CASE_SET_KEYS, "LAW_DOMAIN_CASES");
  exactKeys(plan.lawDomainCases.positive, LAW_DOMAIN_CASE_KEYS, "POSITIVE_LAW_DOMAIN_CASE");
  exactKeys(plan.lawDomainCases.negative, LAW_DOMAIN_CASE_KEYS, "NEGATIVE_LAW_DOMAIN_CASE");
  if (plan.lawDomainCases.positive.lawStateDomainHash !== plan.compiledLawDomainGenesisHash
    || plan.lawDomainCases.positive.expectedErrorCode !== null
    || plan.lawDomainCases.positive.executed !== false
    || plan.lawDomainCases.negative.lawStateDomainHash !== plan.validatorGenesisHash
    || plan.lawDomainCases.negative.expectedErrorCode !== 0xE503
    || plan.lawDomainCases.negative.executed !== false) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_LAW_DOMAIN_CASE_TRUTH_HOLD");
  }
  validPublicKey(plan.dailyLawState);
  exactKeys(plan.deployments, DEPLOYMENT_SET_KEYS, "DEPLOYMENTS");
  for (const [role, kind, programId, artifact] of [
    ["law", "LAW", input.identities.lawProgramId, input.artifacts.law.elf],
    ["economy", "ECONOMY", input.identities.economyProgramId, input.artifacts.economy.elf],
  ]) {
    const deployment = plan.deployments[role];
    exactKeys(deployment, DEPLOYMENT_KEYS, `${kind}_DEPLOYMENT`);
    if (deployment.kind !== kind || deployment.programId !== programId
      || deployment.artifactSha256 !== artifact.sha256
      || deployment.artifactByteLength !== artifact.byteLength
      || !HEX_SHA256.test(deployment.programAccountDataSha256)
      || !HEX_SHA256.test(deployment.programDataAccountSha256)
      || !Number.isSafeInteger(deployment.programAccountDataLength)
      || deployment.programAccountDataLength !== 36
      || !Number.isSafeInteger(deployment.programDataAccountLength)
      || deployment.programDataAccountLength <= 45
      || deployment.elfOffset !== 45
      || (deployment.upgradeAuthority !== null
        && validPublicKey(deployment.upgradeAuthority).toBase58() !== deployment.upgradeAuthority)) {
      throw new TypeError(`IAT_B3_PRODUCTION_LOCAL_REHEARSAL_${kind}_DEPLOYMENT_PLAN_HOLD`);
    }
    const [derived] = PublicKey.findProgramAddressSync(
      [validPublicKey(programId).toBuffer()],
      validPublicKey(plan.loaderProgramId),
    );
    if (derived.toBase58() !== deployment.programDataAddress) {
      throw new TypeError(`IAT_B3_PRODUCTION_LOCAL_REHEARSAL_${kind}_PROGRAMDATA_PDA_HOLD`);
    }
  }
  if (!Array.isArray(plan.accountFixtures) || plan.accountFixtures.length === 0) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_ACCOUNT_FIXTURES_HOLD");
  }
  const fixtureKeys = new Set();
  for (const fixture of plan.accountFixtures) {
    exactKeys(fixture, ACCOUNT_FIXTURE_KEYS, "ACCOUNT_FIXTURE");
    if (typeof fixture.role !== "string" || fixture.role.length === 0
      || typeof fixture.codec !== "string"
      || (preflight.status === "HOLD_TEST_VALIDATION_ONLY"
        ? fixture.codec !== "TEST_FAKE"
        : !SOURCE_BOUND_FIXTURE_CODECS.has(fixture.codec))
      || validPublicKey(fixture.pubkey).toBase58() !== fixture.pubkey
      || validPublicKey(fixture.owner).toBase58() !== fixture.owner
      || typeof fixture.executable !== "boolean"
      || !Number.isSafeInteger(fixture.dataLength) || fixture.dataLength < 0
      || !HEX_SHA256.test(fixture.dataSha256)
      || !HEX_SHA256.test(fixture.decodedStateSha256)
      || fixtureKeys.has(fixture.pubkey)) {
      throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_ACCOUNT_FIXTURE_BINDING_HOLD");
    }
    fixtureKeys.add(fixture.pubkey);
    validateFixturePda(fixture);
  }
  if (!Array.isArray(plan.signers) || plan.signers.length === 0) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_SIGNERS_HOLD");
  }
  const signerRoles = new Set();
  const signerKeys = new Set();
  for (const signer of plan.signers) {
    exactKeys(signer, SIGNER_KEYS, "SIGNER");
    if (typeof signer.role !== "string" || signer.role.length === 0
      || validPublicKey(signer.expectedPubkey).toBase58() !== signer.expectedPubkey
      || typeof signer.feePayer !== "boolean" || signerRoles.has(signer.role)
      || signerKeys.has(signer.expectedPubkey) || !fixtureKeys.has(signer.expectedPubkey)) {
      throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_SIGNER_BINDING_HOLD");
    }
    signerRoles.add(signer.role);
    signerKeys.add(signer.expectedPubkey);
  }
  if (plan.signers.filter(({ feePayer }) => feePayer).length !== 1) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_FEE_PAYER_HOLD");
  }
  if (!Array.isArray(plan.operationCases) || plan.operationCases.length !== 15
    || !Array.isArray(plan.rollbackCases) || plan.rollbackCases.length !== 5) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_CASE_COUNT_HOLD");
  }
  const ids = new Set();
  for (const [opcode, operationCase] of plan.operationCases.entries()) {
    exactKeys(operationCase, OPERATION_CASE_KEYS, "OPERATION_CASE");
    exactKeys(operationCase.expected, CASE_EXPECTED_KEYS, "CASE_EXPECTED");
    if (operationCase.opcode !== opcode || typeof operationCase.id !== "string"
      || operationCase.id.length === 0 || ids.has(operationCase.id)
      || operationCase.expected.errorCode !== EXPECTED_ENTRYPOINT_ERROR_CODES[opcode]
      || operationCase.expected.disposition !== (
        opcode === 9
          ? "ACTIVE_EXPECTED_SUCCESS"
          : IAT_B3_PRODUCTION_EXPECTED_DISPOSITIONS.operations[opcode].expectedDisposition
      )) {
      throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_OPERATION_CASE_TRUTH_HOLD");
    }
    ids.add(operationCase.id);
    validateCaseCollections(operationCase, signerRoles, fixtureKeys);
  }
  for (const [index, rollbackCase] of plan.rollbackCases.entries()) {
    exactKeys(rollbackCase, ROLLBACK_CASE_KEYS, "ROLLBACK_CASE");
    exactKeys(rollbackCase.activeInstruction, INSTRUCTION_SPEC_KEYS, "ROLLBACK_INSTRUCTION");
    exactKeys(rollbackCase.atomicExpected, CASE_EXPECTED_KEYS, "ROLLBACK_ATOMIC_EXPECTED");
    exactKeys(rollbackCase.retryExpected, CASE_EXPECTED_KEYS, "ROLLBACK_RETRY_EXPECTED");
    const canonical = IAT_B3_PRODUCTION_EXPECTED_DISPOSITIONS.rollbackProbes[index];
    if (rollbackCase.id !== canonical.id
      || rollbackCase.activeInstruction.opcode !== canonical.activeOpcode
      || rollbackCase.activeInstruction.variant !== canonical.activeVariant
      || rollbackCase.atomicExpected.disposition !== "CCC_DISABLED"
      || rollbackCase.atomicExpected.errorCode !== 0xE50A
      || rollbackCase.retryExpected.disposition !== "ACTIVE_EXPECTED_SUCCESS"
      || rollbackCase.retryExpected.errorCode !== null) {
      throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_ROLLBACK_CASE_TRUTH_HOLD");
    }
    validateCaseCollections(rollbackCase, signerRoles, fixtureKeys);
  }
  return { fixtureKeys, signerRoles };
}

function validateCaseCollections(value, signerRoles, fixtureKeys) {
  if (!Array.isArray(value.signerRoles) || value.signerRoles.length === 0
    || new Set(value.signerRoles).size !== value.signerRoles.length
    || value.signerRoles.some((role) => !signerRoles.has(role))
    || !Array.isArray(value.snapshotPubkeys) || value.snapshotPubkeys.length === 0
    || new Set(value.snapshotPubkeys).size !== value.snapshotPubkeys.length
    || value.snapshotPubkeys.some((pubkey) => !fixtureKeys.has(pubkey))) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_CASE_COLLECTION_HOLD");
  }
  for (const expected of [value.expected, value.atomicExpected, value.retryExpected].filter(Boolean)) {
    if (!Array.isArray(expected.requiredInnerCpiProgramIds)
      || new Set(expected.requiredInnerCpiProgramIds).size
        !== expected.requiredInnerCpiProgramIds.length
      || expected.requiredInnerCpiProgramIds.some((programId) =>
        validPublicKey(programId).toBase58() !== programId)
      || !HEX_SHA256.test(expected.logsSha256)
      || !HEX_SHA256.test(expected.innerCpiSha256)
      || !HEX_SHA256.test(expected.transitionSha256)
      || ![null, ...EXPECTED_ENTRYPOINT_ERROR_CODES.filter(Number.isInteger)]
        .includes(expected.errorCode)) {
      throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_CASE_EXPECTATION_HOLD");
    }
  }
}

function validateDeploymentObservation(observation, expected, loaderProgramId) {
  exactKeys(observation, DEPLOYMENT_OBSERVATION_KEYS, `${expected.kind}_DEPLOYMENT_OBSERVATION`);
  const programBytes = canonicalBase64(
    observation.programAccountDataBase64,
    `${expected.kind}_PROGRAM_ACCOUNT`,
  );
  const programDataBytes = canonicalBase64(
    observation.programDataBase64,
    `${expected.kind}_PROGRAMDATA_ACCOUNT`,
  );
  if (observation.programId !== expected.programId
    || observation.programAccountOwner !== loaderProgramId
    || observation.programAccountExecutable !== true
    || observation.programDataAddress !== expected.programDataAddress
    || observation.programDataOwner !== loaderProgramId
    || observation.programDataExecutable !== false
    || programBytes.length !== expected.programAccountDataLength
    || sha256(programBytes) !== expected.programAccountDataSha256
    || programDataBytes.length !== expected.programDataAccountLength
    || sha256(programDataBytes) !== expected.programDataAccountSha256
    || programBytes.readUInt32LE(0) !== 2
    || !programBytes.subarray(4, 36).equals(validPublicKey(expected.programDataAddress).toBuffer())
    || programDataBytes.readUInt32LE(0) !== 3) {
    throw new TypeError(`IAT_B3_PRODUCTION_LOCAL_REHEARSAL_${expected.kind}_DEPLOYMENT_REOBSERVATION_HOLD`);
  }
  const authorityTag = programDataBytes[12];
  const authorityBytes = programDataBytes.subarray(13, 45);
  const observedAuthority = authorityTag === 0
    ? null
    : authorityTag === 1 ? new PublicKey(authorityBytes).toBase58() : "INVALID";
  if ((authorityTag === 0 && !authorityBytes.equals(Buffer.alloc(32)))
    || observedAuthority !== expected.upgradeAuthority) {
    throw new TypeError(`IAT_B3_PRODUCTION_LOCAL_REHEARSAL_${expected.kind}_UPGRADE_AUTHORITY_HOLD`);
  }
  const elf = programDataBytes.subarray(expected.elfOffset);
  if (elf.length !== expected.artifactByteLength || sha256(elf) !== expected.artifactSha256) {
    throw new TypeError(`IAT_B3_PRODUCTION_LOCAL_REHEARSAL_${expected.kind}_DEPLOYED_ELF_HOLD`);
  }
  return deepFreeze({
    kind: expected.kind,
    programId: expected.programId,
    programDataAddress: expected.programDataAddress,
    loaderProgramId,
    upgradeAuthority: observedAuthority,
    programAccountDataSha256: sha256(programBytes),
    programDataAccountSha256: sha256(programDataBytes),
    deployedElfSha256: sha256(elf),
    deployedElfByteLength: elf.length,
  });
}

async function validateFixtureAccountsBeforeSigners(plan, input, adapter) {
  const observations = [];
  for (const fixture of plan.accountFixtures) {
    const observed = await adapter.observeAccount(fixture.pubkey);
    exactKeys(observed, ACCOUNT_OBSERVATION_KEYS, "ACCOUNT_OBSERVATION");
    const bytes = canonicalBase64(observed.dataBase64, "ACCOUNT_OBSERVATION");
    const decoded = await adapter.decodeFixtureState({
      role: fixture.role,
      codec: fixture.codec,
      pubkey: fixture.pubkey,
      owner: fixture.owner,
      dataBase64: observed.dataBase64,
    });
    if (fixture.pubkey === plan.dailyLawState) {
      const expectedDomain = validPublicKey(input.identities.compiledLawDomainGenesisHash).toBuffer();
      if (fixture.owner !== input.identities.lawProgramId
        || bytes.length !== 160
        || bytes.subarray(0, 8).toString("ascii") !== "IATB3S01"
        || bytes[8] !== 1
        || !bytes.subarray(48, 80).equals(expectedDomain)
        || decoded.compiledLawDomainGenesisHash
          !== input.identities.compiledLawDomainGenesisHash) {
        throw new TypeError(
          "IAT_B3_PRODUCTION_LOCAL_REHEARSAL_COMPILED_LAW_DOMAIN_STATE_HOLD",
        );
      }
    }
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)
      || observed.pubkey !== fixture.pubkey || observed.owner !== fixture.owner
      || observed.executable !== fixture.executable
      || bytes.length !== fixture.dataLength || sha256(bytes) !== fixture.dataSha256
      || digestCanonical(decoded) !== fixture.decodedStateSha256) {
      throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_FIXTURE_ACCOUNT_REJECTED_HOLD");
    }
    decimalString(observed.lamports, "ACCOUNT_LAMPORTS");
    decimalString(observed.rentEpoch, "ACCOUNT_RENT_EPOCH");
    observations.push({
      role: fixture.role,
      pubkey: fixture.pubkey,
      owner: fixture.owner,
      executable: fixture.executable,
      dataLength: bytes.length,
      dataSha256: sha256(bytes),
      decodedStateSha256: digestCanonical(decoded),
    });
  }
  return deepFreeze(observations);
}

function payloadForBuilder(operation, payload) {
  exactKeys(payload, operation.payload.map(({ name }) => name), "BUILDER_PAYLOAD");
  return Object.fromEntries(operation.payload.map((field) => {
    const value = payload[field.name];
    if (field.type === "u64") return [field.name, decimalString(value, `PAYLOAD_${field.name}`)];
    return [field.name, value];
  }));
}

function buildFromSpec(spec, map, input, plan) {
  exactKeys(spec, INSTRUCTION_SPEC_KEYS, "INSTRUCTION_SPEC");
  const operation = map.operations[spec.opcode];
  if (!operation || !spec.accounts || typeof spec.accounts !== "object"
    || Array.isArray(spec.accounts)) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_INSTRUCTION_SPEC_HOLD");
  }
  const instruction = IAT_B3_PRODUCTION_UNSIGNED_BUILDERS[spec.opcode]({
    transactionMap: map,
    programId: input.identities.economyProgramId,
    lawProgramId: input.identities.lawProgramId,
    canonicalMint: input.identities.canonicalMint,
    dailyLawState: plan.dailyLawState,
    payload: payloadForBuilder(operation, spec.payload),
    accounts: spec.accounts,
    ...(spec.variant === null ? {} : { variant: spec.variant }),
  });
  if (instruction.data[9] !== spec.opcode
    || !instruction.programId.equals(validPublicKey(input.identities.economyProgramId))) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_R06_BUILDER_OUTPUT_HOLD");
  }
  return instruction;
}

function instructionSpecFromCase(value) {
  return {
    opcode: value.opcode,
    payload: value.payload,
    variant: value.variant,
    accounts: value.accounts,
  };
}

function instructionBinding(instruction) {
  const keys = instruction.keys.map(({ pubkey, isSigner, isWritable }) => ({
    pubkey: pubkey.toBase58(),
    isSigner,
    isWritable,
  }));
  return {
    programId: instruction.programId.toBase58(),
    opcode: instruction.data[9],
    dataSha256: sha256(instruction.data),
    keysSha256: digestCanonical(keys),
    keys,
  };
}

function requireInstructionCoverage(instructions, fixtureKeys, loadedSigners, snapshotPubkeys) {
  const snapshots = new Set(snapshotPubkeys);
  for (const instruction of instructions) {
    for (const key of instruction.keys) {
      const pubkey = key.pubkey.toBase58();
      if (!fixtureKeys.has(pubkey)) {
        throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_INSTRUCTION_FIXTURE_COVERAGE_HOLD");
      }
      if (key.isSigner && !loadedSigners.has(pubkey)) {
        throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_INSTRUCTION_SIGNER_HOLD");
      }
      if (key.isWritable && !snapshots.has(pubkey)) {
        throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_WRITABLE_SNAPSHOT_HOLD");
      }
    }
  }
}

function canonicalSnapshot(snapshot, expectedPubkeys) {
  if (!Array.isArray(snapshot) || snapshot.length !== expectedPubkeys.length) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_SNAPSHOT_COUNT_HOLD");
  }
  const expected = [...expectedPubkeys].sort((left, right) => left.localeCompare(right));
  const ordered = [...snapshot].sort((left, right) => left.pubkey.localeCompare(right.pubkey));
  if (canonicalIatB3ProductionLocalRehearsalJson(ordered.map(({ pubkey }) => pubkey))
    !== canonicalIatB3ProductionLocalRehearsalJson(expected)) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_SNAPSHOT_KEYS_HOLD");
  }
  return ordered.map((entry) => {
    exactKeys(entry, ACCOUNT_OBSERVATION_KEYS, "SNAPSHOT_ACCOUNT");
    const bytes = canonicalBase64(entry.dataBase64, "SNAPSHOT_ACCOUNT");
    if (sha256(bytes) === "" || validPublicKey(entry.pubkey).toBase58() !== entry.pubkey
      || validPublicKey(entry.owner).toBase58() !== entry.owner
      || typeof entry.executable !== "boolean") {
      throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_SNAPSHOT_ACCOUNT_HOLD");
    }
    decimalString(entry.lamports, "SNAPSHOT_LAMPORTS");
    decimalString(entry.rentEpoch, "SNAPSHOT_RENT_EPOCH");
    return {
      pubkey: entry.pubkey,
      owner: entry.owner,
      executable: entry.executable,
      lamports: entry.lamports,
      rentEpoch: entry.rentEpoch,
      dataLength: bytes.length,
      dataSha256: sha256(bytes),
    };
  });
}

function validateExecutionResult(result, expected) {
  exactKeys(result, EXECUTION_RESULT_KEYS, "EXECUTION_RESULT");
  if (typeof result.signature !== "string" || result.signature.length === 0
    || !Number.isSafeInteger(result.slot) || result.slot < 0
    || result.confirmationStatus !== "confirmed"
    || result.errorCode !== expected.errorCode
    || !HEX_SHA256.test(result.submittedMessageSha256)
    || result.landedMessageSha256 !== result.submittedMessageSha256
    || !HEX_SHA256.test(result.submittedTransactionSha256)
    || result.landedTransactionSha256 !== result.submittedTransactionSha256
    || !Array.isArray(result.logs) || result.logs.some((line) => typeof line !== "string")
    || !Array.isArray(result.innerCpi)) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_EXECUTION_RESULT_HOLD");
  }
  const fee = decimalString(result.feeLamports, "EXECUTION_FEE");
  if (fee === 0n) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_EXECUTION_FEE_HOLD");
  }
  for (const cpi of result.innerCpi) {
    exactKeys(cpi, INNER_CPI_KEYS, "INNER_CPI");
    if (!Number.isSafeInteger(cpi.instructionIndex) || cpi.instructionIndex < 0
      || validPublicKey(cpi.programId).toBase58() !== cpi.programId
      || !HEX_SHA256.test(cpi.dataSha256)
      || !Array.isArray(cpi.accountPubkeys)
      || cpi.accountPubkeys.some((pubkey) => validPublicKey(pubkey).toBase58() !== pubkey)) {
      throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_INNER_CPI_HOLD");
    }
  }
  if (digestCanonical(result.logs) !== expected.logsSha256
    || digestCanonical(result.innerCpi) !== expected.innerCpiSha256
    || expected.requiredInnerCpiProgramIds.some((requiredProgramId) =>
      !result.innerCpi.some(({ programId }) => programId === requiredProgramId))) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_LOG_OR_CPI_DRIFT_HOLD");
  }
  return fee;
}

function requireFeePayerOnlyDifference(before, after, feePayer, feeLamports) {
  const normalized = after.map((entry) => ({ ...entry }));
  const beforeFeePayer = before.find(({ pubkey }) => pubkey === feePayer);
  const afterFeePayer = normalized.find(({ pubkey }) => pubkey === feePayer);
  if (!beforeFeePayer || !afterFeePayer
    || BigInt(afterFeePayer.lamports) + feeLamports !== BigInt(beforeFeePayer.lamports)) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_FEE_PAYER_DELTA_HOLD");
  }
  afterFeePayer.lamports = beforeFeePayer.lamports;
  if (canonicalIatB3ProductionLocalRehearsalJson(normalized)
    !== canonicalIatB3ProductionLocalRehearsalJson(before)) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_NORMALIZED_ROLLBACK_HOLD");
  }
}

function requireNonFeePayerStateChange(before, after, feePayer) {
  const withoutFeePayer = (snapshot) => snapshot.filter(({ pubkey }) => pubkey !== feePayer);
  if (canonicalIatB3ProductionLocalRehearsalJson(withoutFeePayer(before))
    === canonicalIatB3ProductionLocalRehearsalJson(withoutFeePayer(after))) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_ACTIVE_STATE_CHANGE_HOLD");
  }
}

async function executeObservedTransaction({
  adapter,
  caseId,
  instructions,
  signerRoles,
  snapshotPubkeys,
  expected,
  feePayer,
  fixtureKeys,
  loadedSigners,
}) {
  requireInstructionCoverage(instructions, fixtureKeys, loadedSigners, snapshotPubkeys);
  const before = canonicalSnapshot(
    await adapter.snapshotAccounts(snapshotPubkeys),
    snapshotPubkeys,
  );
  const result = await adapter.executeTransaction({
    caseId,
    instructions,
    signerRoles: [...signerRoles],
    feePayer,
  });
  const fee = validateExecutionResult(result, expected);
  const after = canonicalSnapshot(
    await adapter.snapshotAccounts(snapshotPubkeys),
    snapshotPubkeys,
  );
  const transitionSha256 = digestCanonical({ before, after });
  if (transitionSha256 !== expected.transitionSha256) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_STATE_TRANSITION_DRIFT_HOLD");
  }
  return {
    expectedDisposition: expected.disposition,
    observedErrorCode: result.errorCode,
    signature: result.signature,
    slot: result.slot,
    feeLamports: result.feeLamports,
    submittedMessageSha256: result.submittedMessageSha256,
    landedMessageSha256: result.landedMessageSha256,
    submittedTransactionSha256: result.submittedTransactionSha256,
    landedTransactionSha256: result.landedTransactionSha256,
    logs: [...result.logs],
    logsSha256: digestCanonical(result.logs),
    innerCpi: result.innerCpi.map((entry) => ({
      ...entry,
      accountPubkeys: [...entry.accountPubkeys],
    })),
    innerCpiSha256: digestCanonical(result.innerCpi),
    beforeSnapshot: before,
    beforeSnapshotSha256: digestCanonical(before),
    afterSnapshot: after,
    afterSnapshotSha256: digestCanonical(after),
    transitionSha256,
    fee,
  };
}

function executionReceipt(core) {
  return deepFreeze({ ...core, receiptSha256: digestCanonical(core) });
}

function executionHold({ preflight, plan, error, testOnlyAdapter }) {
  return executionReceipt({
    schema: IAT_B3_PRODUCTION_LOCAL_REHEARSAL_EXECUTION_RECEIPT_SCHEMA,
    status: testOnlyAdapter ? "HOLD_TEST_EXECUTION_ONLY" : "HOLD",
    exitCode: 2,
    complete: false,
    executionAuthority: testOnlyAdapter
      ? "TEST_FAKE_ADAPTER_NOT_EVIDENCE"
      : "SOURCE_BOUND_LOOPBACK_ADAPTER_NOT_IMPLEMENTED",
    preflightSha256: preflight?.preflightSha256 ?? null,
    inputBindingSha256: preflight?.inputBindingSha256 ?? null,
    executionPlanSha256: plan ? digestCanonical(plan) : null,
    runtimeBindings: null,
    signerPublicKeys: [],
    operationObservations: [],
    rollbackObservations: [],
    blockers: [error instanceof Error ? error.message : "UNKNOWN_EXECUTION_HOLD"],
    safety: {
      localLoopbackOnly: true,
      validatorSpawned: false,
      publicNetworkUsed: false,
      keyGenerated: false,
      signerSecretsPersistedInReceipt: false,
      allFixturesValidatedBeforeSignerLoad: false,
      all15Observed: false,
      allFiveRollbackAndRetryProbesObserved: false,
      executionEvidenceAccepted: false,
      devnetExecuted: false,
      mainnetExecutionAuthorized: false,
      mainnetStatus: "HOLD",
    },
  });
}

export async function executeIatB3ProductionLocalRehearsal({
  preflight,
  input,
  executionPlan,
  adapter,
} = {}) {
  const testOnlyAdapter = adapter?.kind === "TEST_FAKE";
  let receipt;
  let adapterDisposalAuthorized = false;
  try {
    validateIatB3ProductionLocalRehearsalPreflight(preflight);
    if (testOnlyAdapter) {
      if (preflight.status !== "HOLD_TEST_VALIDATION_ONLY") {
        throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_TEST_PREFLIGHT_REQUIRED_HOLD");
      }
      if (!adapter || adapter.rpcUrl !== input?.rpc?.url) {
        throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_TEST_ADAPTER_BINDING_HOLD");
      }
      adapterDisposalAuthorized = true;
    } else {
      if (adapter?.kind !== "SOURCE_BOUND_LOOPBACK") {
        throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_SOURCE_BOUND_ADAPTER_KIND_HOLD");
      }
      assertOfficialIatB3ProductionLoopbackAdapter(adapter);
      adapterDisposalAuthorized = true;
      if (preflight.status !== "OFFICIAL_READY") {
        throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_SOURCE_BOUND_PREFLIGHT_REQUIRED_HOLD");
      }
      let sourceBoundPreflight;
      try {
        sourceBoundPreflight = preflightIatB3ProductionLocalRehearsal(input);
      } catch {
        throw new TypeError(
          "IAT_B3_PRODUCTION_LOCAL_REHEARSAL_SOURCE_BOUND_PREFLIGHT_REVALIDATION_HOLD",
        );
      }
      if (canonicalIatB3ProductionLocalRehearsalJson(sourceBoundPreflight)
        !== canonicalIatB3ProductionLocalRehearsalJson(preflight)) {
        throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_SOURCE_BOUND_PREFLIGHT_DRIFT_HOLD");
      }
    }
    for (const method of [
      "observeGenesisHash",
      "assertExecutionPlanBinding",
      "observeProgramDeployment",
      "observeAccount",
      "decodeFixtureState",
      "loadEphemeralSignerBytes",
      "deriveEphemeralSignerPublicKey",
      "disposeEphemeralSigners",
      "snapshotAccounts",
      "executeTransaction",
    ]) {
      if (typeof adapter[method] !== "function") {
        throw new TypeError(`IAT_B3_PRODUCTION_LOCAL_REHEARSAL_ADAPTER_${method}_HOLD`);
      }
    }
    const { fixtureKeys } = validateExecutionPlan(executionPlan, preflight, input);
    await adapter.assertExecutionPlanBinding({ executionPlan, input });
    const map = loadProductionMapFromBoundInput(input);
    const validatorGenesisHash = await adapter.observeGenesisHash();
    if (validatorGenesisHash !== executionPlan.validatorGenesisHash
      || validatorGenesisHash === executionPlan.compiledLawDomainGenesisHash
      || validPublicKey(validatorGenesisHash).equals(PublicKey.default)) {
      throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_VALIDATOR_GENESIS_REOBSERVATION_HOLD");
    }
    const deployments = {};
    for (const role of ["law", "economy"]) {
      deployments[role] = validateDeploymentObservation(
        await adapter.observeProgramDeployment(executionPlan.deployments[role].programId),
        executionPlan.deployments[role],
        executionPlan.loaderProgramId,
      );
    }
    const fixtureObservations = await validateFixtureAccountsBeforeSigners(
      executionPlan,
      input,
      adapter,
    );

    const loadedSignerRoles = new Set();
    const loadedSigners = new Set();
    for (const signer of executionPlan.signers) {
      const secret = await adapter.loadEphemeralSignerBytes({
        role: signer.role,
        expectedPubkey: signer.expectedPubkey,
      });
      if (!(secret instanceof Uint8Array) || secret.length !== 64) {
        throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_SIGNER_BYTES_HOLD");
      }
      try {
        const derivedPublicKey = await adapter.deriveEphemeralSignerPublicKey({
          role: signer.role,
          expectedPubkey: signer.expectedPubkey,
          secret,
        });
        if (validPublicKey(derivedPublicKey).toBase58() !== signer.expectedPubkey) {
          throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_SIGNER_PUBLIC_KEY_HOLD");
        }
      } finally {
        secret.fill(0);
      }
      loadedSignerRoles.add(signer.role);
      loadedSigners.add(signer.expectedPubkey);
    }
    const feePayer = executionPlan.signers.find(({ feePayer: selected }) => selected).expectedPubkey;
    const operationObservations = [];
    for (const operationCase of executionPlan.operationCases) {
      if (operationCase.signerRoles.some((role) => !loadedSignerRoles.has(role))) {
        throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_CASE_SIGNER_ROLE_HOLD");
      }
      const instruction = buildFromSpec(
        instructionSpecFromCase(operationCase),
        map,
        input,
        executionPlan,
      );
      const observation = await executeObservedTransaction({
        adapter,
        caseId: operationCase.id,
        instructions: [instruction],
        signerRoles: operationCase.signerRoles,
        snapshotPubkeys: operationCase.snapshotPubkeys,
        expected: operationCase.expected,
        feePayer,
        fixtureKeys,
        loadedSigners,
      });
      if (operationCase.expected.errorCode !== null) {
        requireFeePayerOnlyDifference(
          observation.beforeSnapshot,
          observation.afterSnapshot,
          feePayer,
          observation.fee,
        );
      } else {
        requireNonFeePayerStateChange(
          observation.beforeSnapshot,
          observation.afterSnapshot,
          feePayer,
        );
      }
      delete observation.fee;
      operationObservations.push({
        id: operationCase.id,
        opcode: operationCase.opcode,
        instruction: instructionBinding(instruction),
        ...observation,
      });
    }
    const rollbackObservations = [];
    for (const rollbackCase of executionPlan.rollbackCases) {
      const active = buildFromSpec(
        instructionSpecFromCase(rollbackCase.activeInstruction),
        map,
        input,
        executionPlan,
      );
      const disabled = buildFromSpec({
        opcode: 12,
        payload: { week: "0" },
        variant: null,
        accounts: {},
      }, map, input, executionPlan);
      const atomic = await executeObservedTransaction({
        adapter,
        caseId: `${rollbackCase.id}:atomic`,
        instructions: [active, disabled],
        signerRoles: rollbackCase.signerRoles,
        snapshotPubkeys: rollbackCase.snapshotPubkeys,
        expected: rollbackCase.atomicExpected,
        feePayer,
        fixtureKeys,
        loadedSigners,
      });
      requireFeePayerOnlyDifference(
        atomic.beforeSnapshot,
        atomic.afterSnapshot,
        feePayer,
        atomic.fee,
      );
      delete atomic.fee;
      const retry = await executeObservedTransaction({
        adapter,
        caseId: `${rollbackCase.id}:standalone-retry`,
        instructions: [active],
        signerRoles: rollbackCase.signerRoles,
        snapshotPubkeys: rollbackCase.snapshotPubkeys,
        expected: rollbackCase.retryExpected,
        feePayer,
        fixtureKeys,
        loadedSigners,
      });
      requireNonFeePayerStateChange(
        retry.beforeSnapshot,
        retry.afterSnapshot,
        feePayer,
      );
      delete retry.fee;
      rollbackObservations.push({
        id: rollbackCase.id,
        transactionInstructionOpcodes: [rollbackCase.activeInstruction.opcode, 12],
        activeInstruction: instructionBinding(active),
        forcedFailureInstruction: instructionBinding(disabled),
        atomic,
        standaloneRetry: retry,
        atomicRollbackProven: true,
        standaloneRetrySuccessProven: true,
      });
    }

    const core = {
      schema: IAT_B3_PRODUCTION_LOCAL_REHEARSAL_EXECUTION_RECEIPT_SCHEMA,
      status: testOnlyAdapter ? "HOLD_TEST_EXECUTION_ONLY" : "HOLD",
      exitCode: 2,
      complete: false,
      executionAuthority: testOnlyAdapter
        ? "TEST_FAKE_ADAPTER_NOT_EVIDENCE"
        : "SOURCE_BOUND_LOOPBACK_OBSERVATION_NOT_ACCEPTED",
      preflightSha256: preflight.preflightSha256,
      inputBindingSha256: preflight.inputBindingSha256,
      executionPlanSha256: digestCanonical(executionPlan),
      runtimeBindings: {
        rpcUrl: executionPlan.rpcUrl,
        validatorGenesisHash,
        compiledLawDomainGenesisHash: executionPlan.compiledLawDomainGenesisHash,
        validatorGenesisClaimedMainnet: false,
        lawDomainCases: executionPlan.lawDomainCases,
        deployments,
        fixtureObservationCount: fixtureObservations.length,
        fixtureObservationsSha256: digestCanonical(fixtureObservations),
      },
      signerPublicKeys: executionPlan.signers.map(({ role, expectedPubkey, feePayer: selected }) => ({
        role,
        publicKey: expectedPubkey,
        feePayer: selected,
      })),
      operationObservations,
      rollbackObservations,
      blockers: [
        ...(testOnlyAdapter ? [
          "TEST_FAKE_ADAPTER_NOT_EVIDENCE",
          "SOURCE_BOUND_LOCAL_REHEARSAL_NOT_EXECUTED",
        ] : [
          "COMPLETE_RECEIPT_NOT_IMPLEMENTED",
          "SOURCE_BOUND_LOOPBACK_OBSERVATION_NOT_ACCEPTED",
        ]),
        "NEGATIVE_LOCAL_DOMAIN_DAILY_LAW_REJECTION_NOT_EXECUTED",
        "POSITIVE_COMPILED_DOMAIN_DAILY_LAW_ACCEPTANCE_NOT_ACCEPTED",
        "DEVNET_NOT_EXECUTED",
        "MAINNET_HOLD",
      ],
      safety: {
        localLoopbackOnly: true,
        validatorSpawned: false,
        publicNetworkUsed: false,
        keyGenerated: false,
        signerSecretsPersistedInReceipt: false,
        allFixturesValidatedBeforeSignerLoad: true,
        all15Observed: operationObservations.length === 15,
        allFiveRollbackAndRetryProbesObserved: rollbackObservations.length === 5,
        executionEvidenceAccepted: false,
        devnetExecuted: false,
        mainnetExecutionAuthorized: false,
        mainnetStatus: "HOLD",
      },
    };
    receipt = executionReceipt(core);
  } catch (error) {
    receipt = executionHold({ preflight, plan: executionPlan, error, testOnlyAdapter });
  }
  try {
    if (adapterDisposalAuthorized && typeof adapter?.disposeEphemeralSigners === "function") {
      await adapter.disposeEphemeralSigners();
    }
  } catch (error) {
    return executionHold({ preflight, plan: executionPlan, error, testOnlyAdapter });
  }
  return receipt;
}

export function validateIatB3ProductionLocalRehearsalExecutionReceipt(receipt) {
  if (!receipt || typeof receipt !== "object" || !HEX_SHA256.test(receipt.receiptSha256 ?? "")) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_EXECUTION_RECEIPT_HOLD");
  }
  const { receiptSha256, ...core } = receipt;
  if (receiptSha256 !== digestCanonical(core)
    || receipt.schema !== IAT_B3_PRODUCTION_LOCAL_REHEARSAL_EXECUTION_RECEIPT_SCHEMA
    || !["HOLD", "HOLD_TEST_EXECUTION_ONLY"].includes(receipt.status)
    || receipt.safety?.localLoopbackOnly !== true
    || receipt.safety?.validatorSpawned !== false
    || receipt.safety?.publicNetworkUsed !== false
    || receipt.safety?.keyGenerated !== false
    || receipt.safety?.signerSecretsPersistedInReceipt !== false
    || receipt.safety?.mainnetExecutionAuthorized !== false
    || receipt.safety?.mainnetStatus !== "HOLD"
    || receipt.complete !== false || receipt.exitCode !== 2
    || receipt.safety.executionEvidenceAccepted !== false) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_EXECUTION_RECEIPT_DIGEST_HOLD");
  }
  return receipt;
}
