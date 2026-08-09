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
const lawSource = readFileSync(
  new URL("programs/iat_b3_law/src/lib.rs", siteRoot),
  "utf8",
);
const economyCode = economySource
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

test("the host-only port contains exactly the first eleven gated kernels", () => {
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
    /pub fn (?:register_agency|open_position|settle_position_week|settle_core_week|claim_lane_principal|withdraw_position_principal)\s*\(/u,
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

  const closePosition = matrix.handlers.find(
    (handler) => handler.name === "close_position",
  );
  assert.deepEqual(closePosition.mutations, [
    "release_reservations",
    "mark_closed",
  ]);
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
