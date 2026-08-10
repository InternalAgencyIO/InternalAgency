import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const siteRoot = new URL("../", import.meta.url);
const matrixUrl = new URL(
  "../docs/b3/iat-b3-economic-write-gates.v1.json",
  import.meta.url,
);
const matrix = JSON.parse(readFileSync(matrixUrl, "utf8"));
const v2Source = readFileSync(new URL(matrix.source, siteRoot), "utf8");
const economyManifest = readFileSync(
  new URL("programs/iat_b3_economy/Cargo.toml", siteRoot),
  "utf8",
);
const economySource = readFileSync(
  new URL("programs/iat_b3_economy/src/lib.rs", siteRoot),
  "utf8",
);
const economyCodecSource = readFileSync(
  new URL("programs/iat_b3_economy/src/codec.rs", siteRoot),
  "utf8",
);
const economyStakeIngressSource = readFileSync(
  new URL("programs/iat_b3_economy/src/stake_ingress.rs", siteRoot),
  "utf8",
);
const lawSource = readFileSync(
  new URL("programs/iat_b3_law/src/lib.rs", siteRoot),
  "utf8",
);
const economyCode = `${economySource}\n${economyCodecSource}\n${economyStakeIngressSource}`
  .replace(/\/\/.*$/gmu, "")
  .replace(/\/\*[\s\S]*?\*\//gu, "");
const workspaceManifest = readFileSync(new URL("Cargo.toml", siteRoot), "utf8");

const sourceHandlers = [...v2Source.matchAll(/^    pub fn ([a-z0-9_]+)\(/gmu)].map(
  (match) => match[1],
);

const TOKEN_TRANSFER_HANDLERS = Object.freeze([
  "open_position",
  "settle_position_week",
  "settle_core_week",
  "claim_lane_principal",
  "withdraw_position_principal",
]);

const ACCOUNT_CREATING_HANDLERS = Object.freeze([
  "initialize_config",
  "initialize_lane_vault",
  "initialize_stake_vault",
  "activate",
  "register_agency",
  "set_eligibility",
  "open_position",
  "commit_round",
]);

test("the B3 port matrix covers the exact retained V2 public write inventory", () => {
  assert.equal(matrix.schema, "iat-b3-economic-write-gate-matrix/v1");
  assert.equal(matrix.expectedHandlerCount, 15);
  assert.equal(sourceHandlers.length, matrix.expectedHandlerCount);
  assert.deepEqual(
    matrix.handlers.map((handler) => handler.name),
    sourceHandlers,
  );
  assert.equal(new Set(sourceHandlers).size, sourceHandlers.length);
});

test("every retained handler is fail-closed before mutation, lifecycle, or CPI", () => {
  assert.equal(matrix.deploymentExposure, "DISABLED_UNTIL_ALL_15_PASS");
  assert.equal(matrix.canonicalGate.acceptsCallerDisposition, false);
  assert.equal(matrix.canonicalGate.clockSource, "SOLANA_CLOCK_SYSVAR_ONLY");

  for (const handler of matrix.handlers) {
    assert.equal(handler.lawGate, matrix.canonicalGate.name, handler.name);
    assert.equal(handler.gatePlacement, matrix.canonicalGate.placement, handler.name);
    assert.equal(handler.anchorLifecycleConstraintAllowed, false, handler.name);
    assert.equal(handler.publicExposure, matrix.deploymentExposure, handler.name);
    assert(handler.mutations.length > 0, `${handler.name} has no recorded mutation`);
    assert.equal(typeof handler.parity, "string", handler.name);
  }
});

test("every token-moving V2 handler is explicitly replaced by hooked Token-2022 CPI", () => {
  const actual = matrix.handlers
    .filter((handler) => handler.cpis.includes("token_2022.transfer_checked_with_hook_accounts"))
    .map((handler) => handler.name);
  assert.deepEqual(actual, TOKEN_TRANSFER_HANDLERS);
  assert.equal(matrix.canonicalMintProgram, "Token-2022");
});

test("every former Anchor account-init path is moved behind the canonical gate", () => {
  const actual = matrix.handlers
    .filter((handler) => handler.cpis.some((cpi) => cpi.startsWith("system_program.create_account")))
    .map((handler) => handler.name);
  assert.deepEqual(actual, ACCOUNT_CREATING_HANDLERS);
});

test("the two V2 core payout paths remain honestly blocked on custody semantics", () => {
  const byName = new Map(matrix.handlers.map((handler) => [handler.name, handler]));
  assert.match(byName.get("settle_core_week").parity, /^BLOCKED_/u);
  assert.match(byName.get("claim_lane_principal").parity, /^BLOCKED_/u);
  assert.equal(
    byName.get("settle_core_week").token2022Flow,
    "REWARD_LANES_TO_CANONICAL_CORE_CUSTODY",
  );
});

test("the first Rust slice is a host-only library with no Solana entrypoint or dispatcher", () => {
  assert.deepEqual(matrix.firstSafeSlice, {
    crate: "programs/iat_b3_economy",
    crateType: "lib",
    hostOnly: true,
    solanaEntrypoint: false,
    publicDispatcher: false,
    accountLifecycle: false,
    tokenCpi: false,
    networkAccess: false,
  });
  assert.match(workspaceManifest, /"programs\/iat_b3_economy"/u);
  assert.match(economyManifest, /crate-type = \["lib"\]/u);
  assert.doesNotMatch(economyManifest, /cdylib|solana-|anchor-|spl-token/u);
  assert.doesNotMatch(
    economyCode,
    /entrypoint!|process_instruction|#\[program\]|invoke(?:_signed)?\s*\(|AccountInfo|TcpStream|UdpSocket/u,
  );
});

test("the combined stake-ingress slice is production source without public execution", () => {
  assert.match(economySource, /pub mod stake_ingress;/u);
  assert.match(
    economyStakeIngressSource,
    /pub fn prepare_open_position_stake_ingress\(/u,
  );
  assert.match(
    economyStakeIngressSource,
    /prepare_open_position\(gate, open_position\)[\s\S]+prepare_stake_ingress\(gate, open_position, ingress\)/u,
  );
  assert.match(economyStakeIngressSource, /pub fn verify_ingress_approval\(/u);
  assert.match(
    economyStakeIngressSource,
    /pub fn apply_transfer_and_retained_v2_finalizer\(/u,
  );
  assert.match(economyStakeIngressSource, /pub fn complete_stake_ingress\(/u);
  assert.doesNotMatch(
    economyStakeIngressSource,
    /entrypoint!|process_instruction|#\[program\]|invoke(?:_signed)?\s*\(|AccountInfo/u,
  );
});

test("the native preparation has strict partial codecs only", () => {
  for (const declaration of [
    'pub const POSITION_ACCOUNT_MAGIC: [u8; 8] = *b"IATB3POS";',
    'pub const LANE_ACCOUNT_MAGIC: [u8; 8] = *b"IATB3LAN";',
    'pub const ROUND_ACCOUNT_MAGIC: [u8; 8] = *b"IATB3RND";',
    'pub const CORE_REWARD_ACCOUNT_MAGIC: [u8; 8] = *b"IATB3CRW";',
    'pub const AGENCY_ACCOUNT_MAGIC: [u8; 8] = *b"IATB3AGN";',
    'pub const AGENCY_OWNER_INDEX_ACCOUNT_MAGIC: [u8; 8] = *b"IATB3AOI";',
    'pub const ELIGIBILITY_ACCOUNT_MAGIC: [u8; 8] = *b"IATB3ELG";',
    "pub const ACCOUNT_CODEC_VERSION: u8 = 1;",
    "pub const POSITION_ACCOUNT_LEN: usize = 176;",
    "pub const LANE_ACCOUNT_LEN: usize = 176;",
    "pub const ROUND_ACCOUNT_LEN: usize = 224;",
    "pub const CORE_REWARD_ACCOUNT_LEN: usize = 128;",
    "pub const AGENCY_ACCOUNT_LEN: usize = 96;",
    "pub const AGENCY_OWNER_INDEX_ACCOUNT_LEN: usize = 96;",
    "pub const ELIGIBILITY_ACCOUNT_LEN: usize = 96;",
  ]) {
    assert.ok(economyCodecSource.includes(declaration), declaration);
  }
  for (const type of [
    "position",
    "lane",
    "round",
    "core_reward",
    "agency",
    "agency_owner_index",
    "eligibility",
  ]) {
    assert.match(economyCodecSource, new RegExp(`pub fn encode_${type}_state\\(`, "u"));
    assert.match(economyCodecSource, new RegExp(`pub fn decode_${type}_state\\(`, "u"));
  }
  assert.match(economyCodecSource, /NonCanonicalBoolean/u);
  assert.match(economyCodecSource, /NonCanonicalDiscriminant/u);
  assert.doesNotMatch(
    economyCodecSource,
    /ConfigState|encode_config|decode_config|AccountInfo|process_instruction|invoke(?:_signed)?\s*\(/u,
  );

  assert.deepEqual(matrix.nativeCodecPreparation, {
    stage: "PARTIAL_STRICT_CODEC_ONLY",
    complete: false,
    strictCodecTypes: [
      "PositionState",
      "LaneState",
      "RoundState",
      "CoreRewardState",
      "AgencyState",
      "AgencyOwnerIndexState",
      "EligibilityState",
    ],
    configCodecStatus:
      "BLOCKED_PENDING_GENESIS_STAGING_ACTIVE_CAP_PHASE_RULE",
    roundCodecStatus: "STRICT_V1",
  });
});

test("the host-only port contains exactly all fifteen gated kernels", () => {
  assert.deepEqual(matrix.hostOnlyPureTransitions, [
    {
      name: "expire_round",
      dailyLawCapabilityRequired: true,
      v2DifferentialTests: true,
      publicExposure: false,
    },
    {
      name: "close_position",
      dailyLawCapabilityRequired: true,
      v2DifferentialTests: true,
      publicExposure: false,
    },
    {
      name: "settle_round",
      dailyLawCapabilityRequired: true,
      v2DifferentialTests: true,
      publicExposure: false,
    },
    {
      name: "commit_round",
      dailyLawCapabilityRequired: true,
      v2DifferentialTests: true,
      publicExposure: false,
    },
    {
      name: "initialize_config",
      implementationStage: "PRE_LIFECYCLE_ONLY",
      dailyLawCapabilityRequired: true,
      v2DifferentialTests: true,
      handlerComplete: false,
      publicExposure: false,
    },
    {
      name: "initialize_lane_vault",
      implementationStage: "PRE_LIFECYCLE_ONLY",
      dailyLawCapabilityRequired: true,
      v2DifferentialTests: true,
      handlerComplete: false,
      publicExposure: false,
    },
    {
      name: "initialize_stake_vault",
      implementationStage: "PRE_LIFECYCLE_ONLY",
      dailyLawCapabilityRequired: true,
      v2DifferentialTests: true,
      handlerComplete: false,
      publicExposure: false,
    },
    {
      name: "activate",
      implementationStage: "PRE_LIFECYCLE_ONLY",
      dailyLawCapabilityRequired: true,
      v2DifferentialTests: true,
      handlerComplete: false,
      publicExposure: false,
    },
    {
      name: "prepare_register_agency",
      productionBehavior: "CCC_INACTIVE",
      implementationStage: "PRE_LIFECYCLE_ONLY",
      dailyLawCapabilityRequired: true,
      v2DifferentialTests: true,
      handlerComplete: false,
      publicExposure: false,
    },
    {
      name: "set_eligibility",
      implementationStage: "PRE_LIFECYCLE_ONLY",
      dailyLawCapabilityRequired: true,
      v2DifferentialTests: true,
      handlerComplete: false,
      publicExposure: false,
    },
    {
      name: "prepare_open_position",
      implementationStage: "PRE_TOKEN_CPI_ONLY",
      dailyLawCapabilityRequired: true,
      v2DifferentialTests: true,
      handlerComplete: false,
      publicExposure: false,
    },
    {
      name: "prepare_withdraw_position_principal",
      implementationStage: "PRE_TOKEN_CPI_ONLY",
      dailyLawCapabilityRequired: true,
      v2DifferentialTests: true,
      handlerComplete: false,
      publicExposure: false,
    },
    {
      name: "prepare_settle_position_week",
      implementationStage: "PRE_TOKEN_CPI_ONLY",
      dailyLawCapabilityRequired: true,
      v2DifferentialTests: true,
      handlerComplete: false,
      publicExposure: false,
    },
    {
      name: "prepare_claim_lane_principal",
      implementationStage: "PRE_TOKEN_CPI_ONLY",
      dailyLawCapabilityRequired: true,
      v2DifferentialTests: true,
      handlerComplete: false,
      publicExposure: false,
    },
    {
      name: "prepare_settle_core_week",
      implementationStage: "PRE_TOKEN_CPI_ONLY",
      dailyLawCapabilityRequired: true,
      v2DifferentialTests: true,
      handlerComplete: false,
      publicExposure: false,
    },
  ]);
  assert.match(
    economySource,
    /pub fn initialize_config\(\s*gate: &ValidatedDailyLawWrite,/u,
  );
  assert.match(economySource, /fn initialize_config_transition\(/u);
  assert.match(economySource, /struct InitializeConfigInput/u);
  assert.match(economySource, /struct ConfigState/u);
  assert.match(
    economySource,
    /pub fn initialize_lane_vault\(\s*_gate: &ValidatedDailyLawWrite,/u,
  );
  assert.match(economySource, /fn initialize_lane_vault_transition\(/u);
  assert.match(economySource, /struct InitializeLaneVaultInput/u);
  assert.match(economySource, /struct LaneState/u);
  assert.match(
    economySource,
    /pub fn initialize_stake_vault\(\s*_gate: &ValidatedDailyLawWrite,/u,
  );
  assert.match(economySource, /fn initialize_stake_vault_transition\(/u);
  assert.match(economySource, /struct InitializeStakeVaultInput/u);
  assert.match(
    economySource,
    /pub fn activate\(\s*_gate: &ValidatedDailyLawWrite,/u,
  );
  assert.match(economySource, /fn activate_transition\(/u);
  assert.match(economySource, /struct ActivateInput/u);
  assert.match(economySource, /struct CoreRewardState/u);
  assert.match(
    economySource,
    /pub fn prepare_register_agency\(\s*_gate: &ValidatedDailyLawWrite,/u,
  );
  assert.doesNotMatch(economyCode, /pub fn register_agency\s*\(/u);
  assert.match(economySource, /fn prepare_register_agency_transition\(/u);
  assert.match(economySource, /struct RegisterAgencyInput/u);
  assert.match(economySource, /struct AgencyState/u);
  assert.match(economySource, /struct AgencyOwnerIndexState/u);
  assert.match(
    economySource,
    /#\[cfg\(test\)\]\s*fn register_agency_v2_enabled_parity_seam\(/u,
  );

  const registerTransitionStart = economySource.indexOf(
    "fn prepare_register_agency_transition(",
  );
  const registerParitySeamStart = economySource.indexOf(
    "#[cfg(test)]\nfn register_agency_v2_enabled_parity_seam(",
  );
  const registerHashHelperStart = economySource.indexOf(
    "#[cfg(test)]\nfn append_agency_registry_hash(",
  );
  assert(registerTransitionStart >= 0);
  assert(registerParitySeamStart > registerTransitionStart);
  assert(registerHashHelperStart > registerParitySeamStart);

  const registerTransition = economySource.slice(
    registerTransitionStart,
    registerParitySeamStart,
  );
  assert(
    registerTransition.indexOf("!input.config.active") <
      registerTransition.indexOf("!CCC_DLC_GENESIS_ENABLED"),
    "register-agency must preserve NotActive before immutable CCC inactivity",
  );
  assert(
    registerTransition.indexOf("!CCC_DLC_GENESIS_ENABLED") <
      registerTransition.indexOf("EconomyError::CccDlcNotActive"),
    "register-agency must return CCC inactivity immediately after the constant",
  );
  assert.doesNotMatch(
    registerTransition,
    /current_week|AgencyState\s*\{|AgencyOwnerIndexState\s*\{|agency_registry_hash\s*=|checked_add/u,
  );

  const registerEnabledSeam = economySource.slice(
    registerParitySeamStart,
    registerHashHelperStart,
  );
  let precedingRegisterStep = -1;
  for (const marker of [
    "!input.config.active",
    "let mut agency = AgencyState",
    "agency.config = input.config_key",
    "agency.owner = input.agency_owner",
    "agency.index = input.config.agency_count",
    "let registered_week = current_week",
    "agency.registered_week = registered_week",
    "agency.bump = input.agency_bump",
    "let mut agency_owner_index = AgencyOwnerIndexState",
    "agency_owner_index.config = input.config_key",
    "agency_owner_index.owner = input.agency_owner",
    "agency_owner_index.index = agency.index",
    "agency_owner_index.bump = input.agency_owner_index_bump",
    "let owner_bytes = input.agency_owner",
    "let mut config = input.config",
    "config.agency_registry_hash =",
    "append_agency_registry_hash(",
    "config.agency_count = config",
    ".checked_add(1)",
    "Ok(RegisterAgencyResult",
  ]) {
    const currentRegisterStep = registerEnabledSeam.indexOf(marker);
    assert(
      currentRegisterStep > precedingRegisterStep,
      `register-agency enabled parity order drifted: ${marker}`,
    );
    precedingRegisterStep = currentRegisterStep;
  }
  assert.match(
    economySource.slice(registerHashHelperStart),
    /b"IAT_AGENCY_REGISTRY_V1"/u,
  );
  const registerInputMatch = economySource.match(
    /pub struct RegisterAgencyInput\s*\{(?<body>[^}]*)\}/u,
  );
  assert(registerInputMatch?.groups?.body);
  assert.doesNotMatch(registerInputMatch.groups.body, /enable|ccc|clock/u);
  assert.match(
    economySource,
    /pub fn set_eligibility\(\s*_gate: &ValidatedDailyLawWrite,/u,
  );
  assert.match(economySource, /fn set_eligibility_transition\(/u);
  assert.match(economySource, /struct SetEligibilityInput/u);
  assert.match(economySource, /struct EligibilityState/u);
  assert.match(
    economySource,
    /pub fn prepare_open_position\(\s*gate: &ValidatedDailyLawWrite,/u,
  );
  assert.match(economySource, /fn prepare_open_position_transition\(/u);
  assert.match(economySource, /struct PrepareOpenPositionInput/u);
  assert.match(economySource, /struct OpenPositionPreCpiPlan/u);
  assert.match(economySource, /struct TransferCheckedIntent/u);
  assert.match(
    economySource,
    /pub fn prepare_withdraw_position_principal\(\s*gate: &ValidatedDailyLawWrite,/u,
  );
  assert.match(
    economySource,
    /fn prepare_withdraw_position_principal_transition\(/u,
  );
  assert.match(
    economySource,
    /struct PrepareWithdrawPositionPrincipalInput/u,
  );
  assert.match(
    economySource,
    /struct WithdrawPositionPrincipalPreCpiPlan/u,
  );
  assert.match(
    economySource,
    /pub fn prepare_settle_position_week\(\s*gate: &ValidatedDailyLawWrite,/u,
  );
  assert.match(economySource, /fn prepare_settle_position_week_transition\(/u);
  assert.match(economySource, /struct PrepareSettlePositionWeekInput/u);
  assert.match(economySource, /struct SettlePositionWeekPreCpiPlan/u);
  assert.match(
    economySource,
    /pub fn prepare_settle_core_week\(\s*gate: &ValidatedDailyLawWrite,/u,
  );
  assert.match(economySource, /fn prepare_settle_core_week_transition\(/u);
  assert.match(economySource, /struct PrepareSettleCoreWeekInput/u);
  assert.match(economySource, /struct SettleCoreWeekPreCpiPlan/u);
  assert.match(
    economySource,
    /#\[cfg\(test\)\]\s*fn prepare_settle_core_week_v2_parity_seam\(/u,
  );

  const coreTransitionStart = economySource.indexOf(
    "fn prepare_settle_core_week_transition(",
  );
  const corePreCpiStart = economySource.indexOf(
    "fn prepare_settle_core_week_v2_pre_cpi(",
  );
  const coreLocationStart = economySource.indexOf(
    "fn core_week_settlement_location(",
  );
  const coreParitySeamStart = economySource.indexOf(
    "#[cfg(test)]\nfn prepare_settle_core_week_v2_parity_seam(",
  );
  assert(coreTransitionStart >= 0);
  assert(corePreCpiStart > coreTransitionStart);
  assert(coreLocationStart > corePreCpiStart);
  assert(coreParitySeamStart > coreLocationStart);

  const coreTransition = economySource.slice(coreTransitionStart, corePreCpiStart);
  assert(
    coreTransition.indexOf("prepare_settle_core_week_v2_pre_cpi") <
      coreTransition.indexOf("CoreCustodyPolicyUnresolved"),
    "the core-custody blocker must follow every retained settle-core pre-CPI check",
  );
  const corePreCpi = economySource.slice(corePreCpiStart, coreLocationStart);
  let precedingCoreCheck = -1;
  for (const marker of [
    "!input.config.active",
    "verify_destination(",
    "input.ordinal >= input.core_reward.term_weeks",
    ".checked_add(1)",
    "let current_policy_week =",
    "if payable_week > current_policy_week",
    "core_week_settlement_location(",
    "if already_settled",
    "let amount = reward_for_week(",
    "consume_three_reservations(",
    "Ok(SettleCoreWeekPreCpiPlan",
  ]) {
    const currentCoreCheck = corePreCpi.indexOf(marker);
    assert(currentCoreCheck > precedingCoreCheck, `settle-core order drifted: ${marker}`);
    precedingCoreCheck = currentCoreCheck;
  }
  assert.doesNotMatch(corePreCpi, /CoreCustodyPolicyUnresolved/u);
  assert.doesNotMatch(corePreCpi, /CCC_DLC_GENESIS_ENABLED|CccDlcNotActive/u);
  assert.doesNotMatch(corePreCpi, /\.paid\s*=|settled_(?:low|high)\s*\|=/u);
  assert.match(
    economySource,
    /pub fn prepare_claim_lane_principal\(\s*gate: &ValidatedDailyLawWrite,/u,
  );
  assert.match(economySource, /fn prepare_claim_lane_principal_transition\(/u);
  assert.match(economySource, /struct PrepareClaimLanePrincipalInput/u);
  assert.match(economySource, /struct ClaimLanePrincipalPreCpiPlan/u);
  assert.match(
    economySource,
    /#\[cfg\(test\)\]\s*fn prepare_claim_lane_principal_v2_parity_seam\(/u,
  );

  const claimTransitionStart = economySource.indexOf(
    "fn prepare_claim_lane_principal_transition(",
  );
  const claimPreCpiStart = economySource.indexOf(
    "fn prepare_claim_lane_principal_v2_pre_cpi(",
  );
  const claimParitySeamStart = economySource.indexOf(
    "#[cfg(test)]\nfn prepare_claim_lane_principal_v2_parity_seam(",
  );
  assert(claimTransitionStart >= 0);
  assert(claimPreCpiStart > claimTransitionStart);
  assert(claimParitySeamStart > claimPreCpiStart);

  const claimTransition = economySource.slice(
    claimTransitionStart,
    claimPreCpiStart,
  );
  assert(
    claimTransition.indexOf("prepare_claim_lane_principal_v2_pre_cpi") <
      claimTransition.indexOf("CoreCustodyPolicyUnresolved"),
    "the core-custody blocker must follow every retained V2 pre-CPI check",
  );

  const claimPreCpi = economySource.slice(claimPreCpiStart, claimParitySeamStart);
  let precedingClaimCheck = -1;
  for (const marker of [
    "!input.config.active",
    "input.lane_state.lane != input.lane",
    "!(TREASURY..=LIQUIDITY).contains(&input.lane)",
    "verify_destination(",
    "let current_week =",
    "let unlocked =",
    "let committed =",
    "let claimable =",
    "if claimable == 0",
    "Ok(ClaimLanePrincipalPreCpiPlan",
  ]) {
    const currentClaimCheck = claimPreCpi.indexOf(marker);
    assert(currentClaimCheck > precedingClaimCheck, `claim order drifted: ${marker}`);
    precedingClaimCheck = currentClaimCheck;
  }
  assert.doesNotMatch(claimPreCpi, /CoreCustodyPolicyUnresolved/u);
  assert.doesNotMatch(claimPreCpi, /lane_tokens\.(?:mint|owner|amount)/u);
  assert.match(
    economySource,
    /pub fn close_position\(\s*_gate: &ValidatedDailyLawWrite,/u,
  );
  assert.match(economySource, /fn close_position_transition\(/u);
  assert.match(economySource, /fn release_reserved_lane\(/u);
  assert.match(
    economySource,
    /pub fn settle_round\(\s*gate: &ValidatedDailyLawWrite,/u,
  );
  assert.match(economySource, /fn settle_pending_round\(/u);
  assert.match(economySource, /struct ReadonlyRoundRandomnessAccount/u);
  assert.match(
    economySource,
    /pub fn commit_round\(\s*gate: &ValidatedDailyLawWrite,/u,
  );
  assert.match(economySource, /fn commit_round_transition\(/u);
  assert.match(economySource, /struct ReadonlyInstructionTrace/u);
  assert.match(economySource, /fn immediately_preceding_instruction\(/u);
  assert.match(economySource, /fn validate_round_commit_instruction\(/u);
  assert.doesNotMatch(
    economyCode,
    /pub fn (?:open_position|settle_position_week|settle_core_week|claim_lane_principal|withdraw_position_principal)\s*\(/u,
  );

  const initializeConfig = matrix.handlers.find(
    (handler) => handler.name === "initialize_config",
  );
  assert.equal(initializeConfig.implementationStage, "PRE_LIFECYCLE_ONLY");
  assert.equal(initializeConfig.handlerComplete, false);
  assert.equal(initializeConfig.publicExposure, matrix.deploymentExposure);
  assert(initializeConfig.cpis.includes("system_program.create_account"));

  const initializeLaneVault = matrix.handlers.find(
    (handler) => handler.name === "initialize_lane_vault",
  );
  assert.equal(initializeLaneVault.implementationStage, "PRE_LIFECYCLE_ONLY");
  assert.equal(initializeLaneVault.handlerComplete, false);
  assert.equal(initializeLaneVault.publicExposure, matrix.deploymentExposure);
  assert(initializeLaneVault.cpis.includes("token_2022.initialize_account"));

  const initializeStakeVault = matrix.handlers.find(
    (handler) => handler.name === "initialize_stake_vault",
  );
  assert.equal(initializeStakeVault.implementationStage, "PRE_LIFECYCLE_ONLY");
  assert.equal(initializeStakeVault.handlerComplete, false);
  assert.equal(initializeStakeVault.publicExposure, matrix.deploymentExposure);
  assert(initializeStakeVault.cpis.includes("token_2022.initialize_account"));

  const activate = matrix.handlers.find((handler) => handler.name === "activate");
  assert.equal(activate.implementationStage, "PRE_LIFECYCLE_ONLY");
  assert.equal(activate.handlerComplete, false);
  assert.equal(activate.publicExposure, matrix.deploymentExposure);
  assert.equal(activate.parity, "PRESERVE");
  assert(activate.cpis.includes("system_program.create_account"));

  const registerAgency = matrix.handlers.find(
    (handler) => handler.name === "register_agency",
  );
  assert.equal(registerAgency.productionBehavior, "CCC_INACTIVE");
  assert.equal(registerAgency.implementationStage, "PRE_LIFECYCLE_ONLY");
  assert.equal(registerAgency.handlerComplete, false);
  assert.equal(registerAgency.publicExposure, matrix.deploymentExposure);
  assert.equal(registerAgency.parity, "PRESERVE_COMPILE_TIME_INACTIVE");
  assert(registerAgency.cpis.includes("system_program.create_account"));

  const setEligibility = matrix.handlers.find(
    (handler) => handler.name === "set_eligibility",
  );
  assert.equal(setEligibility.implementationStage, "PRE_LIFECYCLE_ONLY");
  assert.equal(setEligibility.handlerComplete, false);
  assert.equal(setEligibility.publicExposure, matrix.deploymentExposure);
  assert.equal(
    setEligibility.parity,
    "PRESERVE_STANDARD_AND_CCC_INACTIVE_BOUNDARY",
  );
  assert(setEligibility.cpis.includes("system_program.create_account_if_absent"));

  const openPosition = matrix.handlers.find(
    (handler) => handler.name === "open_position",
  );
  assert.equal(openPosition.implementationStage, "PRE_TOKEN_CPI_ONLY");
  assert.equal(openPosition.handlerComplete, false);
  assert.equal(openPosition.publicExposure, matrix.deploymentExposure);
  assert.equal(openPosition.parity, "PRESERVE");
  assert.equal(openPosition.token2022Flow, "OWNER_TO_STAKE_VAULT");

  const withdrawPositionPrincipal = matrix.handlers.find(
    (handler) => handler.name === "withdraw_position_principal",
  );
  assert.equal(
    withdrawPositionPrincipal.implementationStage,
    "PRE_TOKEN_CPI_ONLY",
  );
  assert.equal(withdrawPositionPrincipal.handlerComplete, false);
  assert.equal(
    withdrawPositionPrincipal.publicExposure,
    matrix.deploymentExposure,
  );
  assert.equal(withdrawPositionPrincipal.parity, "PRESERVE");
  assert.equal(
    withdrawPositionPrincipal.token2022Flow,
    "STAKE_VAULT_TO_POSITION_OWNER",
  );

  const settlePositionWeek = matrix.handlers.find(
    (handler) => handler.name === "settle_position_week",
  );
  assert.equal(settlePositionWeek.implementationStage, "PRE_TOKEN_CPI_ONLY");
  assert.equal(settlePositionWeek.handlerComplete, false);
  assert.equal(settlePositionWeek.publicExposure, matrix.deploymentExposure);
  assert.equal(settlePositionWeek.parity, "PRESERVE");
  assert.equal(
    settlePositionWeek.token2022Flow,
    "REWARD_LANES_TO_POSITION_OWNER",
  );

  const settleCoreWeek = matrix.handlers.find(
    (handler) => handler.name === "settle_core_week",
  );
  assert.equal(settleCoreWeek.implementationStage, "PRE_TOKEN_CPI_ONLY");
  assert.equal(settleCoreWeek.handlerComplete, false);
  assert.equal(settleCoreWeek.publicExposure, matrix.deploymentExposure);
  assert.equal(
    settleCoreWeek.parity,
    "BLOCKED_PENDING_OWNER_ACCEPTANCE_OF_CUSTODY_SCOPE_AND_RELEASE_POLICY",
  );
  assert.equal(
    settleCoreWeek.token2022Flow,
    "REWARD_LANES_TO_CANONICAL_CORE_CUSTODY",
  );

  const claimLanePrincipal = matrix.handlers.find(
    (handler) => handler.name === "claim_lane_principal",
  );
  assert.equal(claimLanePrincipal.implementationStage, "PRE_TOKEN_CPI_ONLY");
  assert.equal(claimLanePrincipal.handlerComplete, false);
  assert.equal(claimLanePrincipal.publicExposure, matrix.deploymentExposure);
  assert.equal(
    claimLanePrincipal.parity,
    "BLOCKED_FOR_CORE_LANE_ONLY_PENDING_OWNER_ACCEPTANCE_OF_RELEASE_POLICY",
  );
  assert.equal(
    claimLanePrincipal.token2022Flow,
    "LANE_VAULT_TO_FIXED_BENEFICIARY_OR_CORE_CUSTODY_POLICY",
  );

  const closePosition = matrix.handlers.find(
    (handler) => handler.name === "close_position",
  );
  assert.deepEqual(closePosition.mutations, [
    "release_reservations",
    "mark_closed",
  ]);
  assert.equal(closePosition.nativeAdapterStage, "PARTIAL_STRICT_CODEC_ONLY");
  assert.equal(closePosition.nativeAdapterComplete, false);
  assert.deepEqual(closePosition.strictCodecTypes, [
    "PositionState",
    "LaneState",
  ]);
  assert.equal(
    closePosition.configCodecStatus,
    "BLOCKED_PENDING_GENESIS_STAGING_ACTIVE_CAP_PHASE_RULE",
  );
});

test("the pure verifier pins the exact current Daily Law v1 codec", () => {
  for (const declaration of [
    'pub const LAW_STATE_MAGIC: &[u8; 8] = b"IATB3S01";',
    "pub const LAW_STATE_VERSION: u8 = 1;",
    "pub const LAW_STATE_LEN: usize = 160;",
  ]) {
    assert.ok(lawSource.includes(declaration), `law adapter drifted: ${declaration}`);
    assert.ok(economySource.includes(declaration), `economy verifier drifted: ${declaration}`);
  }
});
