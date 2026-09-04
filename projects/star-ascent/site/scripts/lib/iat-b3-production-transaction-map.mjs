import { createHash } from "node:crypto";

export const IAT_B3_PRODUCTION_TRANSACTION_MAP_SCHEMA =
  "iat-b3-production-transaction-map/v1";

export const IAT_B3_PRODUCTION_SOURCE_KEYS = Object.freeze([
  "economySource",
  "instructionSource",
  "entrypointSource",
  "dispatchSource",
  "initializationHoldSource",
  "nativeAdapterSource",
  "setEligibilitySource",
  "openPositionSource",
  "openExecutorSource",
  "settleExecutorSource",
  "settleCoreHoldSource",
  "claimLanePrincipalSource",
  "claimExecutorSource",
  "withdrawPositionSource",
  "withdrawExecutorSource",
  "closeSource",
  "closeSpecSource",
  "disabledRoundSource",
  "stakeIngressRuntimeSource",
  "economicWriteGatesSource",
]);

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

export const canonicalIatB3ProductionMapJson = (value) =>
  JSON.stringify(canonicalize(value));

const digestCanonical = (value) => sha256(canonicalIatB3ProductionMapJson(value));

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function assert(condition, message) {
  if (!condition) throw new TypeError(`IAT B3 production transaction map: ${message}`);
}

function requireMarker(source, pattern, label) {
  assert(typeof source === "string" && pattern.test(source), `missing source marker: ${label}`);
}

function fixtureBlock(source, field, signerField, writableField, expected) {
  const startPattern = new RegExp(`\\b${field}:\\s*[^\\n]*?TestAccount\\s*\\{`, "gu");
  for (const match of source.matchAll(startPattern)) {
    const open = source.indexOf("{", match.index);
    let depth = 0;
    for (let index = open; index < source.length; index += 1) {
      if (source[index] === "{") depth += 1;
      if (source[index] === "}") depth -= 1;
      if (depth !== 0) continue;
      const block = source.slice(open, index + 1);
      const signer = new RegExp(`\\b${signerField}:\\s*${expected.isSigner},`, "u");
      const writable = new RegExp(`\\b${writableField}:\\s*${expected.isWritable},`, "u");
      const executable = new RegExp(`\\bexecutable:\\s*${expected.executable},`, "u");
      if (signer.test(block) && writable.test(block) && executable.test(block)) return block;
      break;
    }
  }
  return null;
}

const fixtureProbes = (sourceKey, signerField, writableField, entries) => entries.map(
  ([field, isSigner, isWritable, executable]) => ({
    sourceKey,
    field,
    signerField,
    writableField,
    isSigner,
    isWritable,
    executable,
    label: `${sourceKey} ${field} privilege shape`,
  }),
);

export const IAT_B3_PRODUCTION_META_SHAPE_PROBES = deepFreeze([
  ...fixtureProbes("setEligibilitySource", "is_signer", "is_writable", [
    ["admin", true, true, false], ["config", false, false, false],
    ["wallet", false, false, false], ["eligibility", false, true, false],
    ["system", false, false, true],
  ]),
  ...fixtureProbes("openExecutorSource", "signer", "writable", [
    ["owner", true, true, false], ["config", false, true, false],
    ["eligibility", false, false, false], ["mint", false, false, false],
    ["source", false, true, false], ["stake", false, true, false],
    ["treasury", false, true, false], ["ecosystem", false, true, false],
    ["liquidity", false, true, false], ["position", false, true, false],
    ["token_program", false, false, true], ["system_program", false, false, true],
    ["ingress_authority", false, false, false], ["zk_program", false, false, true],
    ["hook_program", false, false, true], ["hook_validation", false, false, false],
    ["law_state", false, false, false], ["prior_delegate", false, false, false],
  ]),
  ...fixtureProbes("settleExecutorSource", "signer", "writable", [
    ["caller", true, false, false], ["config", false, false, false],
    ["position", false, true, false], ["mint", false, false, false],
    ["vault_authority", false, false, false], ["treasury", false, true, false],
    ["treasury_tokens", false, true, false], ["ecosystem", false, true, false],
    ["ecosystem_tokens", false, true, false], ["liquidity", false, true, false],
    ["liquidity_tokens", false, true, false], ["destination_tokens", false, true, false],
    ["token_program", false, false, true], ["zk_program", false, false, true],
    ["hook_program", false, false, true], ["hook_validation", false, false, false],
    ["law_state", false, false, false],
  ]),
  ...fixtureProbes("claimExecutorSource", "signer", "writable", [
    ["caller", true, false, false], ["config", false, false, false],
    ["mint", false, false, false], ["vault_authority", false, false, false],
    ["lane_state", false, true, false], ["lane_tokens", false, true, false],
    ["destination_tokens", false, true, false], ["token_program", false, false, true],
    ["zk_program", false, false, true], ["hook_program", false, false, true],
    ["hook_validation", false, false, false], ["law_state", false, false, false],
  ]),
  ...fixtureProbes("withdrawExecutorSource", "signer", "writable", [
    ["caller", true, false, false], ["config", false, true, false],
    ["position", false, true, false], ["mint", false, false, false],
    ["vault_authority", false, false, false], ["stake_tokens", false, true, false],
    ["destination_tokens", false, true, false], ["token_program", false, false, true],
    ["zk_program", false, false, true], ["hook_program", false, false, true],
    ["hook_validation", false, false, false], ["law_state", false, false, false],
  ]),
]);

const meta = (role, isSigner, isWritable, executable = false, binding = "account") => ({
  role,
  isSigner,
  isWritable,
  executable,
  binding,
});

const LAW = meta("daily_law_state", false, false, false, "dailyLawState");
const MINT = meta("mint", false, false, false, "canonicalMint");
const TOKEN = meta("token_program", false, false, true, "token2022Program");
const SYSTEM = meta("system_program", false, false, true, "systemProgram");
const ZK = meta("zk_elgamal_proof_program", false, false, true, "zkElgamalProofProgram");
const HOOK = meta("transfer_hook_program", false, false, true, "lawProgram");
const VALIDATION = meta("transfer_hook_validation", false, false, false, "hookValidationPda");
const INGRESS = meta("ingress_authority", false, false, false, "stakeIngressPda");

const held = (name) => [{ name, totalMetaCount: 1, metas: [LAW] }];
const active = (name, metas) => [{ name, totalMetaCount: metas.length, metas }];

const CANONICAL_OPERATIONS = [
  {
    opcode: 0, name: "initialize_config", rustVariant: "InitializeConfig",
    payload: [], disposition: "INITIALIZATION_POLICY_HOLD", variants: held("POLICY_HOLD"),
  },
  {
    opcode: 1, name: "initialize_lane_vault", rustVariant: "InitializeLaneVault",
    payload: [{ name: "lane", type: "u8" }], disposition: "INITIALIZATION_POLICY_HOLD",
    variants: held("POLICY_HOLD"),
  },
  {
    opcode: 2, name: "initialize_stake_vault", rustVariant: "InitializeStakeVault",
    payload: [], disposition: "INITIALIZATION_POLICY_HOLD", variants: held("POLICY_HOLD"),
  },
  {
    opcode: 3, name: "activate", rustVariant: "Activate", payload: [],
    disposition: "INITIALIZATION_POLICY_HOLD", variants: held("POLICY_HOLD"),
  },
  {
    opcode: 4, name: "register_agency", rustVariant: "RegisterAgency", payload: [],
    disposition: "INITIALIZATION_POLICY_HOLD", variants: held("POLICY_HOLD"),
  },
  {
    opcode: 5, name: "set_eligibility", rustVariant: "SetEligibility",
    payload: [{ name: "role", type: "u8" }, { name: "agency_index", type: "option_u32" }],
    disposition: "ACTIVE",
    variants: active("DEFAULT", [
      LAW,
      meta("admin", true, true),
      meta("config", false, false),
      meta("wallet", false, false),
      meta("eligibility", false, true),
      SYSTEM,
    ]),
  },
  {
    opcode: 6, name: "open_position", rustVariant: "OpenPosition",
    payload: [{ name: "position_id", type: "u64" }, { name: "principal", type: "u64" }],
    disposition: "ACTIVE",
    variants: [
      {
        name: "BASE", totalMetaCount: 17,
        metas: [
          LAW, meta("owner", true, true), meta("config", false, true),
          meta("eligibility", false, false), MINT, meta("owner_tokens", false, true),
          meta("stake_tokens", false, true), meta("treasury", false, true),
          meta("ecosystem", false, true), meta("liquidity", false, true),
          meta("position", false, true), TOKEN, SYSTEM, INGRESS, ZK, HOOK, VALIDATION,
        ],
      },
      {
        name: "RESTORE_DELEGATE", totalMetaCount: 18,
        metas: [
          LAW, meta("owner", true, true), meta("config", false, true),
          meta("eligibility", false, false), MINT, meta("owner_tokens", false, true),
          meta("stake_tokens", false, true), meta("treasury", false, true),
          meta("ecosystem", false, true), meta("liquidity", false, true),
          meta("position", false, true), TOKEN, SYSTEM, INGRESS, ZK, HOOK, VALIDATION,
          meta("prior_delegate", false, false),
        ],
      },
    ],
  },
  {
    opcode: 7, name: "settle_position_week", rustVariant: "SettlePositionWeek",
    payload: [{ name: "week", type: "u64" }], disposition: "ACTIVE",
    variants: active("STANDARD", [
      LAW, meta("caller", true, false), meta("config", false, false),
      meta("position", false, true), MINT, meta("vault_authority", false, false),
      meta("treasury", false, true), meta("treasury_tokens", false, true),
      meta("ecosystem", false, true), meta("ecosystem_tokens", false, true),
      meta("liquidity", false, true), meta("liquidity_tokens", false, true),
      meta("destination_tokens", false, true), TOKEN, ZK, HOOK, VALIDATION,
    ]),
  },
  {
    opcode: 8, name: "settle_core_week", rustVariant: "SettleCoreWeek",
    payload: [{ name: "ordinal", type: "u64" }], disposition: "CORE_CUSTODY_POLICY_HOLD",
    variants: held("POLICY_HOLD"),
  },
  {
    opcode: 9, name: "claim_lane_principal", rustVariant: "ClaimLanePrincipal",
    payload: [{ name: "lane", type: "u8" }],
    disposition: "LANE_CONDITIONAL_ACTIVE_OR_CORE_CUSTODY_POLICY_HOLD",
    variants: [
      {
        name: "NON_CORE_ACTIVE", lanes: [1, 2, 4], totalMetaCount: 12,
        metas: [
          LAW, meta("caller", true, false), meta("config", false, false), MINT,
          meta("vault_authority", false, false), meta("lane_state", false, true),
          meta("lane_tokens", false, true), meta("destination_tokens", false, true),
          TOKEN, ZK, HOOK, VALIDATION,
        ],
      },
      { name: "CORE_CUSTODY_HOLD", lanes: [3], totalMetaCount: 1, metas: [LAW] },
      { name: "INVALID_LANE", excludedLanes: [1, 2, 3, 4], totalMetaCount: 1, metas: [LAW] },
    ],
  },
  {
    opcode: 10, name: "withdraw_position_principal", rustVariant: "WithdrawPositionPrincipal",
    payload: [], disposition: "ACTIVE",
    variants: active("DEFAULT", [
      LAW, meta("caller", true, false), meta("config", false, true),
      meta("position", false, true), MINT, meta("vault_authority", false, false),
      meta("stake_tokens", false, true), meta("destination_tokens", false, true),
      TOKEN, ZK, HOOK, VALIDATION,
    ]),
  },
  {
    opcode: 11, name: "close_position", rustVariant: "ClosePosition", payload: [],
    disposition: "ACTIVE",
    variants: active("DEFAULT", [
      LAW, meta("caller", true, false), meta("config", false, false),
      meta("position", false, true), meta("treasury", false, true),
      meta("ecosystem", false, true), meta("liquidity", false, true),
    ]),
  },
  {
    opcode: 12, name: "commit_round", rustVariant: "CommitRound",
    payload: [{ name: "week", type: "u64" }], disposition: "CCC_DISABLED",
    variants: held("CCC_DISABLED"),
  },
  {
    opcode: 13, name: "settle_round", rustVariant: "SettleRound", payload: [],
    disposition: "CCC_DISABLED", variants: held("CCC_DISABLED"),
  },
  {
    opcode: 14, name: "expire_round", rustVariant: "ExpireRound", payload: [],
    disposition: "CCC_DISABLED", variants: held("CCC_DISABLED"),
  },
];

const CANONICAL_SHAPE = {
  schema: IAT_B3_PRODUCTION_TRANSACTION_MAP_SCHEMA,
  expectedDispositionTruthOnly: true,
  instructionAbi: {
    namespace: "IATB3EC1",
    version: 1,
    instructionLength: 32,
    opcodeOffset: 9,
    reservedZeroRange: [10, 16],
    payloadRange: [16, 32],
  },
  transactionPrefix: {
    accountCount: 1,
    role: "daily_law_state",
    isSigner: false,
    isWritable: false,
    authenticatedBeforeAbiDecode: true,
  },
  pdaSeeds: {
    lawState: "law-state",
    config: "config",
    vaultAuthority: "vault-authority",
    laneState: "lane",
    laneToken: "lane-token",
    stakeToken: "stake-token",
    stakeIngress: "stake-ingress",
    eligibility: "eligibility",
    position: "position",
  },
  accountAliasPolicy: {
    defaultDisposition: "REJECT",
    duplicateDailyLawDisposition: "REJECT",
    approvedPriorDelegate: {
      opcode: 6,
      variant: "RESTORE_DELEGATE",
      role: "prior_delegate",
      counterpartBinding: "account",
      maximumGroupSize: 2,
      effectivePrivileges: "UNION",
    },
  },
  dispositions: {
    active: 6,
    initializationPolicyHold: 5,
    cccDisabled: 3,
    coreCustodyPolicyHold: 1,
    all15Active: false,
    devnetExecuted: false,
    mainnetHold: true,
  },
  lanes: { community: 0, treasury: 1, ecosystem: 2, coreTeam: 3, liquidity: 4 },
  operations: CANONICAL_OPERATIONS,
};

function validateSources(input) {
  for (const key of IAT_B3_PRODUCTION_SOURCE_KEYS) {
    assert(typeof input[key] === "string" && input[key].length > 0, `${key} must be nonempty source text`);
  }
  const {
    economySource, instructionSource, entrypointSource, dispatchSource,
    initializationHoldSource, nativeAdapterSource, setEligibilitySource,
    openPositionSource, openExecutorSource, settleExecutorSource,
    settleCoreHoldSource, claimLanePrincipalSource, claimExecutorSource,
    withdrawPositionSource, withdrawExecutorSource, closeSource, closeSpecSource,
    disabledRoundSource, stakeIngressRuntimeSource,
  } = input;

  for (const probe of IAT_B3_PRODUCTION_META_SHAPE_PROBES) {
    assert(
      fixtureBlock(
        input[probe.sourceKey],
        probe.field,
        probe.signerField,
        probe.writableField,
        probe,
      ) !== null,
      `missing source marker: ${probe.label}`,
    );
  }

  requireMarker(instructionSource, /PRODUCTION_INSTRUCTION_NAMESPACE[^\n]*b"IATB3EC1"/u, "instruction namespace");
  requireMarker(instructionSource, /PRODUCTION_INSTRUCTION_VERSION:\s*u8\s*=\s*1/u, "instruction version");
  requireMarker(instructionSource, /PRODUCTION_INSTRUCTION_LEN:\s*usize\s*=\s*32/u, "instruction length");
  requireMarker(instructionSource, /PRODUCTION_INSTRUCTION_COUNT:\s*usize\s*=\s*15/u, "instruction count");
  const opcodeNames = [
    "INITIALIZE_CONFIG", "INITIALIZE_LANE_VAULT", "INITIALIZE_STAKE_VAULT", "ACTIVATE",
    "REGISTER_AGENCY", "SET_ELIGIBILITY", "OPEN_POSITION", "SETTLE_POSITION_WEEK",
    "SETTLE_CORE_WEEK", "CLAIM_LANE_PRINCIPAL", "WITHDRAW_POSITION_PRINCIPAL",
    "CLOSE_POSITION", "COMMIT_ROUND", "SETTLE_ROUND", "EXPIRE_ROUND",
  ];
  opcodeNames.forEach((name, opcode) => requireMarker(
    instructionSource,
    new RegExp(`pub const ${name}_OPCODE: u8 = ${opcode};`, "u"),
    `opcode ${opcode}`,
  ));
  requireMarker(instructionSource, /encoded\[0\.\.8\]\.copy_from_slice\(PRODUCTION_INSTRUCTION_NAMESPACE\)/u, "namespace encoder");
  requireMarker(instructionSource, /encoded\[16\.\.24\].*position_id\.to_le_bytes/u, "open position id ABI");
  requireMarker(instructionSource, /encoded\[24\.\.32\].*principal\.to_le_bytes/u, "open principal ABI");

  for (const [name, value] of [["COMMUNITY", 0], ["TREASURY", 1], ["ECOSYSTEM", 2], ["CORE_TEAM", 3], ["LIQUIDITY", 4]]) {
    requireMarker(economySource, new RegExp(`pub const ${name}: u8 = ${value};`, "u"), `lane ${name}`);
  }
  requireMarker(economySource, /CCC_DLC_GENESIS_ENABLED:\s*bool\s*=\s*false/u, "CCC disabled");
  requireMarker(entrypointSource, /accounts\s*\.split_first\(\)/u, "one Law prefix split");
  requireMarker(entrypointSource, /const LAW_STATE_SEED:\s*&\[u8\]\s*=\s*b"law-state"/u, "Law PDA seed");
  for (const [name, value] of [
    ["CONFIG", "config"], ["VAULT_AUTHORITY", "vault-authority"],
    ["LANE_STATE", "lane"], ["LANE_TOKEN", "lane-token"],
    ["STAKE_TOKEN", "stake-token"], ["STAKE_INGRESS", "stake-ingress"],
    ["ELIGIBILITY", "eligibility"], ["POSITION", "position"],
  ]) requireMarker(
    nativeAdapterSource,
    new RegExp(`pub const ${name}_SEED: &\\[u8\\] = b"${value}";`, "u"),
    `${value} PDA seed`,
  );
  for (const [pattern, label] of [
    [/PdaIdentity::Config \{ mint \} => derive\(&program_id, &\[CONFIG_SEED, &mint\]\)/u, "config PDA seed order"],
    [/derive\(&program_id, &\[VAULT_AUTHORITY_SEED, &config\]\)/u, "vault PDA seed order"],
    [/derive\(&program_id, &\[LANE_STATE_SEED, &config, &\[lane\]\]\)/u, "lane-state PDA seed order"],
    [/derive\(&program_id, &\[LANE_TOKEN_SEED, &config, &\[lane\]\]\)/u, "lane-token PDA seed order"],
    [/derive\(&program_id, &\[STAKE_TOKEN_SEED, &config\]\)/u, "stake-token PDA seed order"],
    [/derive\(&program_id, &\[STAKE_INGRESS_SEED, &config\]\)/u, "stake-ingress PDA seed order"],
    [/derive\(&program_id, &\[ELIGIBILITY_SEED, &config, &operator\]\)/u, "eligibility PDA seed order"],
    [/let position_seed = position_id\.to_le_bytes\(\);[\s\S]*POSITION_SEED,[\s\S]*&config,[\s\S]*&operator,[\s\S]*&position_seed/u, "position PDA seed order"],
  ]) requireMarker(nativeAdapterSource, pattern, label);
  requireMarker(dispatchSource, /PRODUCTION_ACTIVE_HANDLER_COUNT:\s*usize\s*=\s*6/u, "six active handlers");
  requireMarker(dispatchSource, /PRODUCTION_DISABLED_HANDLER_COUNT:\s*usize\s*=\s*3/u, "three disabled handlers");
  requireMarker(dispatchSource, /PRODUCTION_POLICY_HELD_HANDLER_COUNT:\s*usize\s*=\s*6/u, "six held handlers");
  requireMarker(dispatchSource, /PRODUCTION_DAILY_LAW_TRANSACTION_ACCOUNT_COUNT:\s*usize\s*=\s*1/u, "one Law meta");
  requireMarker(initializationHoldSource, /PRODUCTION_INITIALIZATION_POLICY_HOLD_STATUS/u, "initialization typed HOLD");
  requireMarker(setEligibilitySource, /PRODUCTION_SET_ELIGIBILITY_ACCOUNT_COUNT:\s*usize\s*=\s*5/u, "eligibility operation count");
  requireMarker(setEligibilitySource, /authenticate_system_payer_account_info\([^;]*&accounts\[0\]/su, "eligibility admin slot 0");
  requireMarker(setEligibilitySource, /authenticate_production_active_config_account_info\([^;]*&accounts\[1\]/su, "eligibility config slot 1");
  requireMarker(setEligibilitySource, /require_wallet_meta\(&accounts\[2\]\)/u, "eligibility wallet slot 2");
  requireMarker(setEligibilitySource, /require_eligibility_target_shape\([^;]*&accounts\[3\]/su, "eligibility target slot 3");
  requireMarker(setEligibilitySource, /require_system_program\(&accounts\[4\]\)/u, "eligibility system slot 4");
  requireMarker(openPositionSource, /PRODUCTION_OPEN_POSITION_ACCOUNT_COUNT:\s*usize\s*=\s*12/u, "open first-stage count");
  for (const [pattern, label] of [
    [/authenticate_system_payer_account_info\(gate, binding, &accounts\[0\], owner\)/u, "open owner slot 0"],
    [/authenticate_runtime_production_active_writable_config\([^;]*&accounts\[1\]/su, "open config slot 1"],
    [/authenticate_readonly_eligibility\(binding, &accounts\[2\]/u, "open eligibility slot 2"],
    [/require_mint_meta\(binding, &accounts\[3\]\)/u, "open mint slot 3"],
    [/observe_stake_ingress_source\(&accounts\[4\]/u, "open source-token slot 4"],
    [/observe_stake_ingress_vault\(&accounts\[5\]/u, "open stake-token slot 5"],
    [/authenticate_lane\(gate, binding, &accounts\[6\][^;]*TREASURY/su, "open treasury slot 6"],
    [/authenticate_lane\(gate, binding, &accounts\[7\][^;]*ECOSYSTEM/su, "open ecosystem slot 7"],
    [/authenticate_lane\(gate, binding, &accounts\[8\][^;]*LIQUIDITY/su, "open liquidity slot 8"],
    [/require_create_target\(&accounts\[9\], position\.key\)/u, "open position slot 9"],
    [/require_token_program\(&accounts\[10\]\)/u, "open token-program slot 10"],
    [/require_system_program\(&accounts\[11\]\)/u, "open system-program slot 11"],
  ]) requireMarker(openPositionSource, pattern, label);
  requireMarker(openExecutorSource, /PRODUCTION_OPEN_POSITION_EXECUTOR_BASE_ACCOUNT_COUNT:\s*usize\s*=\s*17/u, "open base total");
  requireMarker(openExecutorSource, /PRODUCTION_OPEN_POSITION_EXECUTOR_DELEGATE_ACCOUNT_COUNT:\s*usize\s*=\s*18/u, "open delegate total");
  for (const [name, index] of [
    ["OWNER", 0], ["CONFIG", 1], ["ELIGIBILITY", 2], ["MINT", 3],
    ["SOURCE_TOKEN", 4], ["STAKE_TOKEN", 5], ["TREASURY", 6], ["ECOSYSTEM", 7],
    ["LIQUIDITY", 8], ["POSITION", 9], ["TOKEN_PROGRAM", 10], ["SYSTEM_PROGRAM", 11],
    ["INGRESS_AUTHORITY", 12], ["ZK_PROOF_PROGRAM", 13], ["HOOK_PROGRAM", 14],
    ["HOOK_VALIDATION", 15], ["LAW_STATE", 16], ["PRIOR_DELEGATE", 17],
  ]) requireMarker(openExecutorSource, new RegExp(`const ${name}_INDEX: usize = ${index};`, "u"), `open ${name} slot`);
  requireMarker(settleExecutorSource, /PRODUCTION_SETTLE_POSITION_STANDARD_EXECUTOR_ACCOUNT_COUNT:\s*usize\s*=\s*17/u, "settlement total");
  for (const [marker, label] of [
    [/const POSITION_INDEX: usize = 2;/u, "position 2"],
    [/const MINT_INDEX: usize = 3;/u, "mint 3"],
    [/const VAULT_AUTHORITY_INDEX: usize = 4;/u, "vault 4"],
    [/const LANE_STATE_INDICES: \[usize; 3\] = \[5, 7, 9\];/u, "lane states 5/7/9"],
    [/const SOURCE_TOKEN_INDICES: \[usize; 3\] = \[6, 8, 10\];/u, "lane tokens 6/8/10"],
    [/const DESTINATION_TOKEN_INDEX: usize = 11;/u, "destination 11"],
    [/const TOKEN_PROGRAM_INDEX: usize = 12;/u, "token program 12"],
    [/const ZK_PROOF_PROGRAM_INDEX: usize = 13;/u, "zk program 13"],
    [/const HOOK_PROGRAM_INDEX: usize = 14;/u, "hook program 14"],
    [/const HOOK_VALIDATION_INDEX: usize = 15;/u, "hook validation 15"],
    [/const LAW_STATE_INDEX: usize = 16;/u, "Law 16"],
  ]) requireMarker(settleExecutorSource, marker, `settlement ${label}`);
  requireMarker(settleCoreHoldSource, /CoreCustodyPolicyUnresolved/u, "core settlement HOLD");
  requireMarker(claimLanePrincipalSource, /PRODUCTION_CLAIM_LANE_PRINCIPAL_ACCOUNT_COUNT:\s*usize\s*=\s*8/u, "claim first-stage count");
  for (const [pattern, label] of [
    [/authenticate_caller\(gate, binding, &accounts\[0\]\)/u, "claim caller slot 0"],
    [/authenticate_runtime_production_active_config\([^;]*&accounts\[1\]/su, "claim config slot 1"],
    [/require_mint_meta\(binding, &accounts\[2\]\)/u, "claim mint slot 2"],
    [/require_vault_authority_meta\(&accounts\[3\]/u, "claim vault slot 3"],
    [/authenticate_lane\(gate, binding, &accounts\[4\]/u, "claim lane slot 4"],
    [/require_source_token_meta\(&accounts\[5\]/u, "claim source-token slot 5"],
    [/let destination_before = observe_stake_ingress_source\(\s*&accounts\[6\]/u, "claim destination-token slot 6"],
    [/require_token_program\(&accounts\[7\]\)/u, "claim token-program slot 7"],
  ]) requireMarker(claimLanePrincipalSource, pattern, label);
  requireMarker(claimExecutorSource, /PRODUCTION_CLAIM_LANE_PRINCIPAL_EXECUTOR_ACCOUNT_COUNT:\s*usize\s*=\s*12/u, "claim total");
  requireMarker(claimExecutorSource, /TREASURY\s*\|\s*ECOSYSTEM\s*\|\s*LIQUIDITY/u, "non-core claim lanes");
  requireMarker(claimExecutorSource, /require_readonly_program\(&accounts\[8\],\s*&zk_elgamal_proof_program::ID\)/u, "claim zk slot 8");
  requireMarker(claimExecutorSource, /require_readonly_program\(&accounts\[9\],\s*&hook_program\)/u, "claim hook slot 9");
  requireMarker(claimExecutorSource, /require_readonly_owned_account\(&accounts\[10\],\s*&expected_validation/u, "claim validation slot 10");
  requireMarker(claimExecutorSource, /&accounts\[11\],[\s\S]*runtime_law\.law_account_key/u, "claim Law slot 11");
  requireMarker(withdrawExecutorSource, /PRODUCTION_WITHDRAW_POSITION_EXECUTOR_ACCOUNT_COUNT:\s*usize\s*=\s*12/u, "withdraw total");
  requireMarker(withdrawPositionSource, /PRODUCTION_WITHDRAW_POSITION_ACCOUNT_COUNT:\s*usize\s*=\s*8/u, "withdraw first-stage count");
  for (const [pattern, label] of [
    [/authenticate_caller\(gate, binding, &accounts\[0\]\)/u, "withdraw caller slot 0"],
    [/authenticate_runtime_production_active_writable_config\([^;]*&accounts\[1\]/su, "withdraw config slot 1"],
    [/authenticate_position\(gate, binding, &accounts\[2\]/u, "withdraw position slot 2"],
    [/require_mint_meta\(binding, &accounts\[3\]\)/u, "withdraw mint slot 3"],
    [/require_vault_authority_meta\(&accounts\[4\]/u, "withdraw vault slot 4"],
    [/observe_stake_ingress_vault\(&accounts\[5\]/u, "withdraw source-token slot 5"],
    [/let destination = observe_stake_ingress_source\(\s*&accounts\[6\]/u, "withdraw destination-token slot 6"],
    [/require_token_program\(&accounts\[7\]\)/u, "withdraw token-program slot 7"],
  ]) requireMarker(withdrawPositionSource, pattern, label);
  for (const [name, index] of [
    ["CONFIG", 1], ["POSITION", 2], ["MINT", 3], ["VAULT_AUTHORITY", 4],
    ["SOURCE_TOKEN", 5], ["DESTINATION_TOKEN", 6], ["TOKEN_PROGRAM", 7],
    ["ZK_PROOF_PROGRAM", 8], ["HOOK_PROGRAM", 9], ["HOOK_VALIDATION", 10], ["LAW_STATE", 11],
  ]) requireMarker(withdrawExecutorSource, new RegExp(`const ${name}_INDEX: usize = ${index};`, "u"), `withdraw ${name} slot`);
  requireMarker(closeSource, /PRODUCTION_CLOSE_POSITION_ACCOUNT_COUNT:\s*usize\s*=\s*6/u, "close operation count");
  requireMarker(closeSource, /authenticate_caller\([^;]*&accounts\[0\]/su, "close caller slot 0");
  requireMarker(closeSource, /authenticate_runtime_production_active_config\([^;]*&accounts\[1\]/su, "close config slot 1");
  requireMarker(closeSource, /embedded_position_identity\(&accounts\[2\]/u, "close position slot 2");
  requireMarker(closeSource, /authenticate_lane\([^;]*&accounts\[3\][^;]*TREASURY/su, "close treasury slot 3");
  requireMarker(closeSource, /authenticate_lane\([^;]*&accounts\[4\][^;]*ECOSYSTEM/su, "close ecosystem slot 4");
  requireMarker(closeSource, /authenticate_lane\([^;]*&accounts\[5\][^;]*LIQUIDITY/su, "close liquidity slot 5");
  requireMarker(closeSpecSource, /self\.caller\.info\(\),\s*self\.config\.info\(\),\s*self\.position\.info\(\),\s*self\.treasury\.info\(\),\s*self\.ecosystem\.info\(\),\s*self\.liquidity\.info\(\)/su, "close exact test account order");
  requireMarker(closeSpecSource, /caller: TestAccount::new\(UNRELATED_CALLER,[\s\S]*?true, false\)/u, "close caller signer readonly");
  requireMarker(closeSpecSource, /config: TestAccount::new\([\s\S]*?false,\s*false,\s*\),[\s\S]*?position: TestAccount::new\([\s\S]*?false,\s*true,\s*\),[\s\S]*?treasury: TestAccount::new\([\s\S]*?false, true\)/u, "close state privilege contract");
  requireMarker(disabledRoundSource, /CccDlcNotActive/u, "CCC typed disabled error");
  requireMarker(stakeIngressRuntimeSource, /Bind only the pubkey encoded in the retained Token-2022 delegate state/u, "prior-delegate pubkey-only binding");
  requireMarker(stakeIngressRuntimeSource, /duplicate metas[\s\S]*delegate == owner[\s\S]*inherit unified transaction privileges/u, "prior-delegate effective privilege union");
  requireMarker(openExecutorSource, /Duplicate outer metas inherit the owner's effective privileges/u, "owner/prior-delegate alias positive case");
}

export function extractIatB3ProductionTransactionMaps(input) {
  assert(input && typeof input === "object", "source input must be an object");
  validateSources(input);
  let parsedGates;
  try {
    parsedGates = JSON.parse(input.economicWriteGatesSource);
  } catch (error) {
    throw new TypeError(`IAT B3 production transaction map: economicWriteGatesSource is invalid JSON: ${error.message}`);
  }
  if (input.economicWriteGates !== undefined) {
    assert(
      canonicalIatB3ProductionMapJson(parsedGates) === canonicalIatB3ProductionMapJson(input.economicWriteGates),
      "economicWriteGates object does not match its source bytes",
    );
  }
  const surface = parsedGates.currentProductionSourceSurface;
  assert(surface?.exactDiscriminantCount === 15, "write-gate matrix discriminant count drift");
  assert(surface?.activeHandlerCount === 6, "write-gate matrix active count drift");
  assert(surface?.initializationPolicyHoldCount === 5, "write-gate matrix initialization HOLD count drift");
  assert(surface?.cccDisabledHandlerCount === 3, "write-gate matrix CCC-disabled count drift");
  assert(surface?.coreCustodyPolicyHoldCount === 1, "write-gate matrix core HOLD count drift");
  assert(surface?.all15HandlersActive === false && surface?.devnetExecuted === false && surface?.mainnetHold === true,
    "write-gate matrix readiness truth drift");

  const sourceSha256 = Object.fromEntries(
    IAT_B3_PRODUCTION_SOURCE_KEYS.map((key) => [key, sha256(input[key])]),
  );
  const sourceBinding = {
    sourceSha256,
    canonicalSha256: digestCanonical(sourceSha256),
  };
  const map = {
    ...CANONICAL_SHAPE,
    sourceBinding,
    canonicalMapSha256: digestCanonical({ ...CANONICAL_SHAPE, sourceBinding }),
  };
  validateIatB3ProductionTransactionMaps(map);
  return deepFreeze(map);
}

export const extractIatB3ProductionTransactionMap = extractIatB3ProductionTransactionMaps;

export function validateIatB3ProductionTransactionMaps(map) {
  assert(map && typeof map === "object" && !Array.isArray(map), "map must be an object");
  const expectedKeys = [...Object.keys(CANONICAL_SHAPE), "sourceBinding", "canonicalMapSha256"].sort();
  assert(JSON.stringify(Object.keys(map).sort()) === JSON.stringify(expectedKeys), "map top-level keys drift");
  for (const key of Object.keys(CANONICAL_SHAPE)) {
    assert(
      canonicalIatB3ProductionMapJson(map[key]) === canonicalIatB3ProductionMapJson(CANONICAL_SHAPE[key]),
      `${key} differs from the source-derived production shape`,
    );
  }
  const hashes = map.sourceBinding?.sourceSha256;
  assert(hashes && typeof hashes === "object" && !Array.isArray(hashes), "source hash set missing");
  assert(JSON.stringify(Object.keys(hashes).sort()) === JSON.stringify([...IAT_B3_PRODUCTION_SOURCE_KEYS].sort()),
    "source hash keys drift");
  for (const [key, digest] of Object.entries(hashes)) {
    assert(/^[0-9a-f]{64}$/u.test(digest), `${key} source hash is invalid`);
  }
  assert(map.sourceBinding.canonicalSha256 === digestCanonical(hashes), "source binding hash mismatch");
  assert(
    map.canonicalMapSha256 === digestCanonical({ ...CANONICAL_SHAPE, sourceBinding: map.sourceBinding }),
    "canonical map hash mismatch",
  );
  for (const operation of map.operations) {
    for (const variant of operation.variants) {
      assert(variant.totalMetaCount === variant.metas.length, `${operation.name}/${variant.name} meta count mismatch`);
      assert(variant.metas[0]?.role === "daily_law_state", `${operation.name}/${variant.name} lacks Law prefix`);
      assert(variant.metas.filter((slot) => slot.role === "daily_law_state").length === 1,
        `${operation.name}/${variant.name} duplicates Law`);
    }
  }
  return true;
}

export const validateIatB3ProductionTransactionMap = validateIatB3ProductionTransactionMaps;
