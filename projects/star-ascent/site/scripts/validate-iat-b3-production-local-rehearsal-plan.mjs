import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

import {
  IAT_B3_PRODUCTION_SOURCE_KEYS,
  canonicalIatB3ProductionMapJson,
  extractIatB3ProductionTransactionMaps,
} from "./lib/iat-b3-production-transaction-map.mjs";
import {
  IAT_B3_PRODUCTION_EXPECTED_DISPOSITIONS,
  IAT_B3_PRODUCTION_EXPECTED_DISPOSITIONS_SHA256,
} from "./lib/iat-b3-production-local-rehearsal-contract.mjs";

export const IAT_B3_PRODUCTION_LOCAL_REHEARSAL_PLAN_SCHEMA =
  "iat-b3-production-local-rehearsal-plan/v1";
export const IAT_B3_PRODUCTION_LOCAL_REHEARSAL_PLAN_STATUS = "HOLD";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const DEFAULT_PACKET = resolve(ROOT, "docs/b3/iat-b3-production-local-rehearsal-plan.v1.json");
const HEX_SHA256 = /^[0-9a-f]{64}$/u;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const SOURCE_PATHS = Object.freeze({
  economySource: "programs/iat_b3_economy/src/lib.rs",
  instructionSource: "programs/iat_b3_economy/src/production_instruction.rs",
  entrypointSource: "programs/iat_b3_economy/src/production_entrypoint.rs",
  dispatchSource: "programs/iat_b3_economy/src/production_dispatch.rs",
  initializationHoldSource: "programs/iat_b3_economy/src/production_initialization_policy_hold.rs",
  nativeAdapterSource: "programs/iat_b3_economy/src/native_adapter.rs",
  setEligibilitySource: "programs/iat_b3_economy/src/production_set_eligibility.rs",
  openPositionSource: "programs/iat_b3_economy/src/production_open_position.rs",
  openExecutorSource: "programs/iat_b3_economy/src/production_open_position_executor.rs",
  settleExecutorSource: "programs/iat_b3_economy/src/production_settle_position_week_executor.rs",
  settleCoreHoldSource: "programs/iat_b3_economy/src/production_settle_position_week.rs",
  claimLanePrincipalSource: "programs/iat_b3_economy/src/production_claim_lane_principal.rs",
  claimExecutorSource: "programs/iat_b3_economy/src/production_claim_lane_principal_executor.rs",
  withdrawPositionSource: "programs/iat_b3_economy/src/production_withdraw_position.rs",
  withdrawExecutorSource: "programs/iat_b3_economy/src/production_withdraw_position_executor.rs",
  closeSource: "programs/iat_b3_economy/src/production_close_position.rs",
  closeSpecSource: "programs/iat_b3_economy/tests/production_close_position_spec.rs",
  disabledRoundSource: "programs/iat_b3_economy/src/production_round_disabled.rs",
  stakeIngressRuntimeSource: "programs/iat_b3_economy/src/stake_ingress_runtime.rs",
  economicWriteGatesSource: "docs/b3/iat-b3-economic-write-gates.v1.json",
});

const ADDITIONAL_SOURCE_PATHS = Object.freeze([
  "scripts/lib/iat-b3-production-transaction-map.mjs",
  "programs/iat_b3_economy/production-client.mjs",
  "scripts/lib/iat-b3-production-local-rehearsal-contract.mjs",
  "scripts/lib/iat-b3-production-loopback-adapter.mjs",
  "programs/iat_b3_law/src/lib.rs",
  "programs/iat_b3_economy/src/config_genesis_codec.rs",
  "programs/iat_b3_economy/src/codec.rs",
  "tests/fixtures/iat-b3-production-local-rehearsal/expected-dispositions.v1.json",
]);

const SOURCE_PATH_LIST = Object.freeze([
  ...IAT_B3_PRODUCTION_SOURCE_KEYS.map((key) => SOURCE_PATHS[key]),
  ...ADDITIONAL_SOURCE_PATHS,
]);

const CODECS = Object.freeze([
  { name: "LAW_STATE_V1", magic: "IATB3S01", exactLength: 160, owner: "LAW_PROGRAM", decodedInvariants: ["mint==canonicalMint", "compiledLawDomainGenesisHash==selectedLawDomain", "decision envelope canonical"] },
  { name: "ECONOMY_CONFIG_V1", magic: "IATB3CFG", exactLength: 272, owner: "ECONOMY_PROGRAM", decodedInvariants: ["mint==canonicalMint", "tokenProgram==TOKEN_2022", "phase/active/laneMask canonical"] },
  { name: "ECONOMY_POSITION_V1", magic: "IATB3POS", exactLength: 176, owner: "ECONOMY_PROGRAM", decodedInvariants: ["config==configPda", "owner/positionId match case", "role<=2", "principalReturned/closed canonical booleans"] },
  { name: "ECONOMY_LANE_V1", magic: "IATB3LAN", exactLength: 176, owner: "ECONOMY_PROGRAM", decodedInvariants: ["config==configPda", "lane in [1,2,3,4]", "tokenAccount==laneTokenPda"] },
  { name: "ECONOMY_ELIGIBILITY_V1", magic: "IATB3ELG", exactLength: 96, owner: "ECONOMY_PROGRAM", decodedInvariants: ["config==configPda", "wallet==case wallet", "role<=2"] },
  { name: "TOKEN_2022_MINT", magic: null, exactLength: null, owner: "TOKEN_2022_PROGRAM", decodedInvariants: ["pubkey==canonicalMint", "base mint and TLV extensions decode canonically"] },
  { name: "TOKEN_2022_ACCOUNT", magic: null, exactLength: null, owner: "TOKEN_2022_PROGRAM", decodedInvariants: ["mint==canonicalMint", "base account and TLV extensions decode canonically"] },
  { name: "SYSTEM_VACANT", magic: null, exactLength: 0, owner: "SYSTEM_PROGRAM", decodedInvariants: ["zero data before init-if-needed lifecycle"] },
  { name: "UPGRADEABLE_PROGRAM", magic: null, exactLength: 36, owner: "BPF_UPGRADEABLE_LOADER", decodedInvariants: ["state tag==Program", "ProgramData PDA exact"] },
  { name: "BYTE_BOUND", magic: null, exactLength: null, owner: "ROLE_SPECIFIC", decodedInvariants: ["semantic B3 magic forbidden", "Token-2022 owner forbidden"] },
]);

const FIXED_PROGRAM_ROLES = new Set([
  "system_program", "token_program", "zk_elgamal_proof_program", "transfer_hook_program",
]);
const TOKEN_ACCOUNT_ROLES = new Set([
  "owner_tokens", "stake_tokens", "treasury_tokens", "ecosystem_tokens",
  "liquidity_tokens", "destination_tokens", "lane_tokens",
]);
const LANE_ROLES = new Set(["treasury", "ecosystem", "liquidity", "lane_state"]);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export const canonicalIatB3ProductionLocalRehearsalPlanJson = (value) =>
  JSON.stringify(canonicalize(value));

function descriptor(path) {
  const absolute = resolve(ROOT, path);
  if (!isAbsolute(absolute) || realpathSync.native(absolute) !== absolute
    || lstatSync(absolute).isSymbolicLink()) {
    throw new TypeError(`IAT_B3_PRODUCTION_LOCAL_REHEARSAL_PLAN_SOURCE_PATH_HOLD:${path}`);
  }
  const bytes = readFileSync(absolute);
  return { path, sha256: sha256(bytes), byteLength: bytes.length };
}

function assertSourceCodecMarkers() {
  const sources = Object.fromEntries([
    "programs/iat_b3_law/src/lib.rs",
    "programs/iat_b3_economy/src/config_genesis_codec.rs",
    "programs/iat_b3_economy/src/codec.rs",
    "scripts/lib/iat-b3-production-loopback-adapter.mjs",
  ].map((path) => [path, readFileSync(resolve(ROOT, path), "utf8")]));
  const markers = [
    ["programs/iat_b3_law/src/lib.rs", /LAW_STATE_LEN:\s*usize\s*=\s*160/u],
    ["programs/iat_b3_law/src/lib.rs", /LAW_STATE_MAGIC[^\n]*IATB3S01/u],
    ["programs/iat_b3_economy/src/config_genesis_codec.rs", /CONFIG_GENESIS_ACCOUNT_LEN:\s*usize\s*=\s*272/u],
    ["programs/iat_b3_economy/src/config_genesis_codec.rs", /CONFIG_GENESIS_ACCOUNT_MAGIC[^\n]*IATB3CFG/u],
    ["programs/iat_b3_economy/src/codec.rs", /POSITION_ACCOUNT_LEN:\s*usize\s*=\s*176/u],
    ["programs/iat_b3_economy/src/codec.rs", /LANE_ACCOUNT_LEN:\s*usize\s*=\s*176/u],
    ["programs/iat_b3_economy/src/codec.rs", /ELIGIBILITY_ACCOUNT_LEN:\s*usize\s*=\s*96/u],
    ["scripts/lib/iat-b3-production-loopback-adapter.mjs", /case "LAW_STATE_V1"/u],
    ["scripts/lib/iat-b3-production-loopback-adapter.mjs", /case "TOKEN_2022_ACCOUNT"/u],
    ["scripts/lib/iat-b3-production-loopback-adapter.mjs", /OFFICIAL_LOOPBACK_ADAPTERS\s*=\s*new WeakSet/u],
  ];
  for (const [path, marker] of markers) {
    if (!marker.test(sources[path])) {
      throw new TypeError(`IAT_B3_PRODUCTION_LOCAL_REHEARSAL_PLAN_CODEC_SOURCE_HOLD:${path}`);
    }
  }
}

function roleRule(role, occurrences) {
  let ownerRule = "SOURCE_ROLE_SPECIFIC_CONCRETE_OWNER_REQUIRED";
  let addressRule = "SOURCE_ROLE_SPECIFIC_CONCRETE_ADDRESS_REQUIRED";
  let codecAlternatives = ["BYTE_BOUND"];
  let dataLengthRule = "CONCRETE_EXACT_LENGTH_REQUIRED";
  let decodedInvariantRequirements = ["exact owner/data hash/decoded-state hash required"];
  if (role === "daily_law_state") {
    ownerRule = "LAW_PROGRAM";
    addressRule = "PDA(lawProgramId,['law-state',canonicalMint])";
    codecAlternatives = ["LAW_STATE_V1"];
    dataLengthRule = "EXACT_160";
    decodedInvariantRequirements = CODECS[0].decodedInvariants;
  } else if (role === "config") {
    ownerRule = "ECONOMY_PROGRAM";
    addressRule = "PDA(economyProgramId,['config',canonicalMint])";
    codecAlternatives = ["ECONOMY_CONFIG_V1"];
    dataLengthRule = "EXACT_272";
    decodedInvariantRequirements = CODECS[1].decodedInvariants;
  } else if (role === "eligibility") {
    ownerRule = "ECONOMY_PROGRAM_OR_SYSTEM_VACANT_BY_CASE";
    addressRule = "PDA(economyProgramId,['eligibility',config,walletOrOwner])";
    codecAlternatives = ["ECONOMY_ELIGIBILITY_V1", "SYSTEM_VACANT"];
    dataLengthRule = "EXACT_96_OR_0_BY_CASE";
    decodedInvariantRequirements = CODECS[4].decodedInvariants;
  } else if (role === "position") {
    ownerRule = "ECONOMY_PROGRAM_OR_SYSTEM_VACANT_BY_CASE";
    addressRule = "PDA(economyProgramId,['position',config,owner,u64le(positionId)])";
    codecAlternatives = ["ECONOMY_POSITION_V1", "SYSTEM_VACANT"];
    dataLengthRule = "EXACT_176_OR_0_BY_CASE";
    decodedInvariantRequirements = CODECS[2].decodedInvariants;
  } else if (LANE_ROLES.has(role)) {
    const lane = role === "treasury" ? 1 : role === "ecosystem" ? 2 : role === "liquidity" ? 4 : "instruction.lane";
    ownerRule = "ECONOMY_PROGRAM";
    addressRule = `PDA(economyProgramId,['lane',config,${lane}])`;
    codecAlternatives = ["ECONOMY_LANE_V1"];
    dataLengthRule = "EXACT_176";
    decodedInvariantRequirements = CODECS[3].decodedInvariants;
  } else if (role === "mint") {
    ownerRule = "TOKEN_2022_PROGRAM";
    addressRule = "EXACT_CANONICAL_MINT";
    codecAlternatives = ["TOKEN_2022_MINT"];
    dataLengthRule = "TOKEN_2022_MINT_EXACT_OBSERVED_LENGTH_REQUIRED";
    decodedInvariantRequirements = CODECS[5].decodedInvariants;
  } else if (TOKEN_ACCOUNT_ROLES.has(role)) {
    ownerRule = "TOKEN_2022_PROGRAM";
    addressRule = ["stake_tokens", "lane_tokens"].includes(role)
      ? `PDA(economyProgramId,['${role === "stake_tokens" ? "stake-token" : "lane-token"}',config${role === "lane_tokens" ? ",instruction.lane" : ""}])`
      : "SOURCE_ROLE_SPECIFIC_TOKEN_ACCOUNT";
    codecAlternatives = ["TOKEN_2022_ACCOUNT"];
    dataLengthRule = "TOKEN_2022_ACCOUNT_EXACT_OBSERVED_LENGTH_REQUIRED";
    decodedInvariantRequirements = CODECS[6].decodedInvariants;
  } else if (role === "vault_authority") {
    ownerRule = "SOURCE_DOES_NOT_REQUIRE_DATA_OWNERSHIP";
    addressRule = "PDA(economyProgramId,['vault-authority',config])";
  } else if (role === "ingress_authority") {
    ownerRule = "SOURCE_DOES_NOT_REQUIRE_DATA_OWNERSHIP";
    addressRule = "PDA(economyProgramId,['stake-ingress',config])";
  } else if (role === "transfer_hook_validation") {
    ownerRule = "LAW_PROGRAM";
    addressRule = "SPL_EXTRA_ACCOUNT_META_PDA(canonicalMint,lawProgramId)";
    decodedInvariantRequirements = ["exact transfer-hook extra-account-meta TLV bytes required"];
  } else if (FIXED_PROGRAM_ROLES.has(role)) {
    ownerRule = role === "system_program" ? "NATIVE_LOADER" : "BPF_UPGRADEABLE_LOADER";
    addressRule = `FIXED_${role.toUpperCase()}`;
    codecAlternatives = role === "system_program" ? ["BYTE_BOUND"] : ["UPGRADEABLE_PROGRAM"];
    dataLengthRule = role === "system_program" ? "EXACT_OBSERVED_NATIVE_PROGRAM_LENGTH_REQUIRED" : "EXACT_36";
    decodedInvariantRequirements = ["fixed program identity", "executable==true"];
  }
  return {
    role,
    occurrences,
    ownerRule,
    addressRule,
    codecAlternatives,
    dataLengthRule,
    decodedInvariantRequirements,
    concrete: {
      pubkey: null,
      owner: null,
      dataLength: null,
      dataSha256: null,
      decodedStateSha256: null,
      decodedInvariants: null,
    },
    executionObserved: false,
  };
}

const NUMERIC_ERRORS = Object.freeze([
  0xE540, 0xE541, 0xE542, 0xE543, 0xE544,
  null, null, null, 0xE50E, null, null, null,
  0xE50A, 0xE50A, 0xE50A,
]);

function ordinalCases(map) {
  return map.operations.map((operation) => {
    const variant = operation.opcode === 6
      ? operation.variants.find(({ name }) => name === "BASE")
      : operation.opcode === 9
        ? operation.variants.find(({ name }) => name === "NON_CORE_ACTIVE")
        : operation.variants[0];
    return {
      ordinal: operation.opcode,
      opcode: operation.opcode,
      operation: operation.name,
      variant: variant.name,
      payloadPlan: operation.opcode === 9 ? { lane: 1 } : null,
      exactMetaCount: variant.totalMetaCount,
      orderedRoles: variant.metas.map(({ role }) => role),
      authoritySignerRoles: variant.metas.filter(({ isSigner }) => isSigner).map(({ role }) => role),
      expectedDisposition: IAT_B3_PRODUCTION_EXPECTED_DISPOSITIONS.operations[operation.opcode]
        .expectedDisposition,
      expectedNumericErrorCode: NUMERIC_ERRORS[operation.opcode],
      executed: false,
      executionEvidenceAccepted: false,
    };
  });
}

const CONDITIONAL_OPCODE9_CASES = Object.freeze([
  ["TREASURY_ACTIVE", 1, "NON_CORE_ACTIVE", "ACTIVE_EXPECTED_SUCCESS", null, 12, false],
  ["ECOSYSTEM_ACTIVE", 2, "NON_CORE_ACTIVE", "ACTIVE_EXPECTED_SUCCESS", null, 12, false],
  ["LIQUIDITY_ACTIVE", 4, "NON_CORE_ACTIVE", "ACTIVE_EXPECTED_SUCCESS", null, 12, false],
  ["CORE_TEAM_HOLD", 3, "CORE_CUSTODY_HOLD", "CORE_CUSTODY_POLICY_HOLD", 0xE50E, 1, true],
  ["COMMUNITY_INVALID", 0, "INVALID_LANE", "INVALID_LANE", 0xE50D, 1, true],
  ["UNKNOWN_INVALID", 5, "INVALID_LANE", "INVALID_LANE", 0xE50D, 1, true],
].map(([id, lane, variant, expectedDisposition, expectedNumericErrorCode, exactMetaCount, lawOnly]) => ({
  id,
  opcode: 9,
  lane,
  variant,
  expectedDisposition,
  expectedNumericErrorCode,
  exactMetaCount,
  requiredNoEffectBeyondFeePayer: lawOnly,
  executed: false,
  executionEvidenceAccepted: false,
})));

function sourceSet() {
  if (new Set(SOURCE_PATH_LIST).size !== SOURCE_PATH_LIST.length) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_PLAN_DUPLICATE_SOURCE_HOLD");
  }
  const descriptors = SOURCE_PATH_LIST.map(descriptor);
  return {
    descriptors,
    canonicalDescriptorSetSha256: sha256(canonicalIatB3ProductionLocalRehearsalPlanJson(descriptors)),
  };
}

function productionMap() {
  const sourceText = Object.fromEntries(IAT_B3_PRODUCTION_SOURCE_KEYS.map((key) => [
    key,
    readFileSync(resolve(ROOT, SOURCE_PATHS[key]), "utf8"),
  ]));
  return extractIatB3ProductionTransactionMaps(sourceText);
}

function fixtureIsolationRows(map) {
  const rows = [];
  for (const opcode of [5, 6, 7, 9, 10, 11]) {
    const operation = map.operations[opcode];
    const variant = operation.variants.find(({ name }) =>
      name === (opcode === 6 ? "BASE" : opcode === 9 ? "NON_CORE_ACTIVE" : operation.variants[0].name));
    rows.push({
      id: `ORDINAL_ACTIVE_${opcode}`,
      mutableRoles: variant.metas.filter(({ isWritable }) => isWritable).map(({ role }) => role),
      concreteMutablePubkeys: null,
      beforeStateSetSha256: null,
      terminalStateSetSha256: null,
    });
  }
  for (const opcode of [5, 6, 7, 9, 10]) {
    const operation = map.operations[opcode];
    const variant = operation.variants.find(({ name }) =>
      name === (opcode === 6 ? "BASE" : opcode === 9 ? "NON_CORE_ACTIVE" : operation.variants[0].name));
    rows.push({
      id: `ROLLBACK_AND_RETRY_${opcode}`,
      mutableRoles: variant.metas.filter(({ isWritable }) => isWritable).map(({ role }) => role),
      concreteMutablePubkeys: null,
      beforeStateSetSha256: null,
      terminalStateSetSha256: null,
    });
  }
  return rows;
}

export function buildIatB3ProductionLocalRehearsalPlanPacket() {
  assertSourceCodecMarkers();
  const sources = sourceSet();
  const map = productionMap();
  const occurrencesByRole = new Map();
  for (const operation of map.operations) {
    for (const variant of operation.variants) {
      variant.metas.forEach((meta, index) => {
        const occurrence = {
          opcode: operation.opcode,
          variant: variant.name,
          index,
          binding: meta.binding,
          isSigner: meta.isSigner,
          isWritable: meta.isWritable,
          executable: meta.executable,
        };
        const existing = occurrencesByRole.get(meta.role) ?? [];
        existing.push(occurrence);
        occurrencesByRole.set(meta.role, existing);
      });
    }
  }
  const fixtureRoles = [...occurrencesByRole]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([role, occurrences]) => roleRule(role, occurrences));
  const operationAccountMap = map.operations.map(({ opcode, name, variants }) => ({
    opcode,
    operation: name,
    variants: variants.map(({ name: variant, totalMetaCount, lanes, excludedLanes, metas }) => ({
      variant,
      totalMetaCount,
      ...(lanes ? { lanes } : {}),
      ...(excludedLanes ? { excludedLanes } : {}),
      orderedMetas: metas,
    })),
  }));
  const isolationRows = fixtureIsolationRows(map);
  const rollbackRows = IAT_B3_PRODUCTION_EXPECTED_DISPOSITIONS.rollbackProbes.map((probe) => ({
    ...probe,
    requiredAtomicErrorCode: 0xE50A,
    requiredAtomicNoEffectBeyondFeePayer: true,
    requiredInnerCpiProgram: probe.activeOpcode === 5 ? "SYSTEM_PROGRAM" : "TOKEN_2022_PROGRAM",
    standaloneRetryRequired: true,
    standaloneRetryExpectedErrorCode: null,
    standaloneRetryMustChangeNonFeePayerState: true,
    beforeStateSetSha256: null,
    postAtomicStateSetSha256: null,
    postRetryTerminalStateSetSha256: null,
  }));
  const executionOrder = [
    ...Array.from({ length: 15 }, (_, opcode) => `ORDINAL_${opcode}`),
    ...CONDITIONAL_OPCODE9_CASES.map(({ id }) => `OPCODE9_${id}`),
    ...rollbackRows.flatMap(({ id }) => [`${id}:ATOMIC`, `${id}:STANDALONE_RETRY`]),
  ];
  const core = {
    schema: IAT_B3_PRODUCTION_LOCAL_REHEARSAL_PLAN_SCHEMA,
    status: IAT_B3_PRODUCTION_LOCAL_REHEARSAL_PLAN_STATUS,
    scope: {
      contract: "SOURCE_BOUND_EXPECTED_DISPOSITION_AND_FIXTURE_PLAN_ONLY",
      authorizesRpc: false,
      authorizesKeyRead: false,
      authorizesBuild: false,
      authorizesDeploy: false,
      authorizesSigning: false,
      authorizesSend: false,
      authorizesMainnet: false,
    },
    sourceBindings: sources,
    productionTransactionMap: {
      schema: map.schema,
      canonicalMapSha256: map.canonicalMapSha256,
      operationAccountMapSha256: sha256(canonicalIatB3ProductionMapJson(operationAccountMap)),
      operationAccountMap,
      pdaSeeds: map.pdaSeeds,
      accountAliasPolicy: map.accountAliasPolicy,
      exactMetaCounts: map.operations.map(({ variants }) => variants.map(({ totalMetaCount }) => totalMetaCount)),
    },
    codecPlan: {
      definitions: CODECS,
      definitionsSha256: sha256(canonicalIatB3ProductionLocalRehearsalPlanJson(CODECS)),
      concreteAccountDumpsProvided: false,
    },
    expectedDispositions: {
      canonicalExpectedDispositionsSha256: IAT_B3_PRODUCTION_EXPECTED_DISPOSITIONS_SHA256,
      ordinalCases: ordinalCases(map),
      ordinalCasesAreFullConditionalCoverage: false,
      opcode9ConditionalCases: CONDITIONAL_OPCODE9_CASES,
      allConditionalCasesExecuted: false,
    },
    dualGenesisDomains: {
      validatorGenesisHash: null,
      validatorGenesisClaimedMainnet: false,
      compiledLawDomainGenesisHash: null,
      requireDistinctHashes: true,
      positiveCase: { lawStateDomain: "COMPILED_LAW_DOMAIN", expectedErrorCode: null, executed: false },
      negativeCase: { lawStateDomain: "VALIDATOR_GENESIS", expectedErrorCode: 0xE503, executed: false },
      publicDevnetFinalByteEvidence: false,
    },
    identityAndArtifacts: {
      lawProgramId: null,
      economyProgramId: null,
      canonicalMint: null,
      lawElf: null,
      lawDockerBuildReceipt: null,
      economyElf: null,
      economyDockerBuildReceipt: null,
    },
    fixturePlan: {
      roles: fixtureRoles,
      fixtureRolePlanSha256: sha256(canonicalIatB3ProductionLocalRehearsalPlanJson(fixtureRoles)),
      concreteAccountDumps: [],
      isolation: {
        sharedImmutableRoleAllowlist: [
          "daily_law_state", "config", "mint", "system_program", "token_program",
          "zk_elgamal_proof_program", "transfer_hook_program",
        ],
        everyOtherWritableFixtureMustBePurposeSpecific: true,
        mutablePubkeySetsMustBePairwiseDisjoint: true,
        exactExecutionOrder: executionOrder,
        rows: isolationRows,
        isolationStrategy: null,
        cumulativeStateTransitionPlanSha256: null,
      },
    },
    signerPlan: {
      keyFilesRead: false,
      keyGenerationAllowed: false,
      feePayer: { expectedPubkey: null, ephemeralKeyPath: null },
      authorityRoles: [
        { role: "admin", opcodes: [5], expectedPubkey: null, ephemeralKeyPath: null },
        { role: "owner", opcodes: [6], expectedPubkey: null, ephemeralKeyPath: null },
        { role: "caller", opcodes: [7, 9, 10, 11], expectedPubkey: null, ephemeralKeyPath: null },
      ],
      signerPubkeysMustMatchFixtureMetasBeforeKeyRead: true,
      secretsLoadedOnlyAfterGenesisDeploymentsAndAllFixturesReobserved: true,
      secretsZeroizedAfterDerivationAndDisposal: true,
    },
    rollbackPlan: {
      exactProbeCount: 5,
      exactActiveOpcodes: [5, 6, 7, 9, 10],
      forcedFailureOpcode: 12,
      probes: rollbackRows,
      allAtomicAndStandaloneRetryProbesExecuted: false,
    },
    runtimePrerequisites: {
      rpcUrl: null,
      loopbackHostMustEqual: "127.0.0.1",
      prestartedValidatorObserved: false,
      validatorSpawnAllowed: false,
      validatorLedgerPath: null,
      validatorGenesisHash: null,
    },
    blockers: [
      "CONCRETE_LAW_PROGRAM_ID_MISSING",
      "CONCRETE_ECONOMY_PROGRAM_ID_MISSING",
      "CONCRETE_CANONICAL_MINT_MISSING",
      "COMPILED_LAW_DOMAIN_GENESIS_HASH_MISSING",
      "FINAL_LAW_ELF_AND_DOCKER_RECEIPT_MISSING",
      "FINAL_ECONOMY_ELF_AND_DOCKER_RECEIPT_MISSING",
      "PRESTARTED_LOOPBACK_VALIDATOR_MISSING",
      "VALIDATOR_GENESIS_HASH_MISSING",
      "CONCRETE_ACCOUNT_DUMPS_AND_DECODED_INVARIANTS_MISSING",
      "EPHEMERAL_SIGNER_PUBLIC_KEYS_AND_PATHS_MISSING",
      "MUTABLE_FIXTURE_ISOLATION_AND_TERMINAL_HASH_PLAN_MISSING",
      "ALL_15_ORDINAL_CASES_NOT_EXECUTED",
      "OPCODE9_FULL_CONDITIONAL_CASES_NOT_EXECUTED",
      "FIVE_ATOMIC_ROLLBACK_AND_STANDALONE_RETRY_PROBES_NOT_EXECUTED",
      "NEGATIVE_VALIDATOR_DOMAIN_DAILY_LAW_REJECTION_NOT_EXECUTED",
      "POSITIVE_COMPILED_DOMAIN_DAILY_LAW_ACCEPTANCE_NOT_EXECUTED",
      "SOURCE_BOUND_LOOPBACK_RECEIPT_COMPLETION_NOT_IMPLEMENTED",
      "DEVNET_NOT_EXECUTED",
      "MAINNET_HOLD",
    ],
    truth: {
      packetValidated: true,
      fixturePlanComplete: false,
      executableAdapterInputComplete: false,
      executionEvidenceAccepted: false,
      devnetExecuted: false,
      rollbackExecuted: false,
      releaseAuthorized: false,
      mainnetExecutionAuthorized: false,
      mainnetStatus: "HOLD",
    },
  };
  return Object.freeze({
    ...core,
    planCoreSha256: sha256(canonicalIatB3ProductionLocalRehearsalPlanJson(core)),
  });
}

function strictJson(text, label = "plan") {
  if (typeof text !== "string") throw new TypeError(`${label}: JSON source must be a string`);
  let index = 0;
  const whitespace = /[\t\n\r ]/u;
  const skip = () => { while (index < text.length && whitespace.test(text[index])) index += 1; };
  const fail = (message) => { throw new SyntaxError(`${label}: ${message} at byte ${index}`); };
  const stringToken = () => {
    if (text[index] !== "\"") fail("expected JSON string");
    const start = index;
    index += 1;
    while (index < text.length) {
      if (text[index] === "\"") {
        index += 1;
        return JSON.parse(text.slice(start, index));
      }
      if (text[index] === "\\") index += 2;
      else {
        if (text[index] < " ") fail("unescaped control character");
        index += 1;
      }
    }
    fail("unterminated JSON string");
  };
  const value = (path) => {
    skip();
    if (text[index] === "{") {
      index += 1; skip();
      const keys = new Set();
      if (text[index] === "}") { index += 1; return; }
      while (index < text.length) {
        skip();
        const key = stringToken();
        if (keys.has(key)) throw new SyntaxError(`${label}: duplicate JSON member ${path}.${key}`);
        keys.add(key); skip();
        if (text[index] !== ":") fail("expected colon");
        index += 1; value(`${path}.${key}`); skip();
        if (text[index] === "}") { index += 1; return; }
        if (text[index] !== ",") fail("expected comma or closing brace");
        index += 1;
      }
      fail("unterminated JSON object");
    }
    if (text[index] === "[") {
      index += 1; skip();
      if (text[index] === "]") { index += 1; return; }
      let item = 0;
      while (index < text.length) {
        value(`${path}[${item}]`); item += 1; skip();
        if (text[index] === "]") { index += 1; return; }
        if (text[index] !== ",") fail("expected comma or closing bracket");
        index += 1;
      }
      fail("unterminated JSON array");
    }
    if (text[index] === "\"") { stringToken(); return; }
    const start = index;
    while (index < text.length && !/[\t\n\r ,\]}]/u.test(text[index])) index += 1;
    if (start === index) fail("expected JSON value");
    JSON.parse(text.slice(start, index));
  };
  skip(); value("$root"); skip();
  if (index !== text.length) fail("unexpected trailing data");
  return JSON.parse(text);
}

export function readIatB3ProductionLocalRehearsalPlan(path = DEFAULT_PACKET) {
  const absolute = resolve(path);
  if (lstatSync(absolute).isSymbolicLink() || realpathSync.native(absolute) !== absolute) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_PLAN_PACKET_PATH_HOLD");
  }
  const bytes = readFileSync(absolute, "utf8");
  const packet = strictJson(bytes, absolute);
  if (bytes !== `${canonicalIatB3ProductionLocalRehearsalPlanJson(packet)}\n`) {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_PLAN_CANONICAL_JSON_HOLD");
  }
  return packet;
}

export function validateIatB3ProductionLocalRehearsalPlan(packet) {
  const expected = buildIatB3ProductionLocalRehearsalPlanPacket();
  const actualJson = canonicalIatB3ProductionLocalRehearsalPlanJson(packet);
  const expectedJson = canonicalIatB3ProductionLocalRehearsalPlanJson(expected);
  if (actualJson !== expectedJson || !HEX_SHA256.test(packet?.planCoreSha256 ?? "")
    || packet.status !== "HOLD" || packet.scope?.authorizesRpc !== false
    || packet.scope?.authorizesKeyRead !== false || packet.scope?.authorizesBuild !== false
    || packet.scope?.authorizesDeploy !== false || packet.scope?.authorizesSigning !== false
    || packet.scope?.authorizesSend !== false || packet.scope?.authorizesMainnet !== false
    || packet.truth?.executionEvidenceAccepted !== false
    || packet.truth?.mainnetExecutionAuthorized !== false
    || packet.truth?.mainnetStatus !== "HOLD") {
    throw new TypeError("IAT_B3_PRODUCTION_LOCAL_REHEARSAL_PLAN_TRUTH_HOLD");
  }
  return Object.freeze({
    valid: true,
    status: "HOLD",
    packetSha256: sha256(Buffer.from(actualJson)),
    planCoreSha256: packet.planCoreSha256,
    sourceDescriptorSetSha256: packet.sourceBindings.canonicalDescriptorSetSha256,
    productionMapSha256: packet.productionTransactionMap.canonicalMapSha256,
    operationAccountMapSha256: packet.productionTransactionMap.operationAccountMapSha256,
    expectedDispositionsSha256: packet.expectedDispositions.canonicalExpectedDispositionsSha256,
    fixtureRolePlanSha256: packet.fixturePlan.fixtureRolePlanSha256,
    blockers: [...packet.blockers],
    executionAuthorized: false,
  });
}

function main() {
  if (process.argv.includes("--template")) {
    process.stdout.write(`${canonicalIatB3ProductionLocalRehearsalPlanJson(
      buildIatB3ProductionLocalRehearsalPlanPacket(),
    )}\n`);
    return;
  }
  const path = resolve(process.argv[2] ?? DEFAULT_PACKET);
  const result = validateIatB3ProductionLocalRehearsalPlan(
    readIatB3ProductionLocalRehearsalPlan(path),
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
