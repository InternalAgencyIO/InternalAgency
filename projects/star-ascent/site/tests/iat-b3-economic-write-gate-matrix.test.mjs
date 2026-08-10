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
const economyStakeIngressRuntimeSource = readFileSync(
  new URL("programs/iat_b3_economy/src/stake_ingress_runtime.rs", siteRoot),
  "utf8",
);
const economyNativeAdapterSource = readFileSync(
  new URL("programs/iat_b3_economy/src/native_adapter.rs", siteRoot),
  "utf8",
);
const economyRuntimeAdapterSource = readFileSync(
  new URL("programs/iat_b3_economy/src/runtime_adapter.rs", siteRoot),
  "utf8",
);
const economyRuntimeWriteAdapterSource = readFileSync(
  new URL("programs/iat_b3_economy/src/runtime_write_adapter.rs", siteRoot),
  "utf8",
);
const economyRuntimeAccountLifecycleSource = readFileSync(
  new URL("programs/iat_b3_economy/src/runtime_account_lifecycle.rs", siteRoot),
  "utf8",
);
const economyRehearsalAdapterSource = readFileSync(
  new URL("programs/iat_b3_economy/src/rehearsal_adapter.rs", siteRoot),
  "utf8",
);
const economyToken2022RuntimeSource = readFileSync(
  new URL("programs/iat_b3_economy/src/token_2022_runtime.rs", siteRoot),
  "utf8",
);
const economySbfPreflightSource = readFileSync(
  new URL("programs/iat_b3_economy/src/sbf_preflight.rs", siteRoot),
  "utf8",
);
const economySbfPreflightDriverSource = readFileSync(
  new URL("scripts/iat-b3-economy-sbf-preflight-driver.mjs", siteRoot),
  "utf8",
);
const economySbfPreflightRunnerSource = readFileSync(
  new URL("scripts/run-iat-b3-economy-sbf-preflight-local.sh", siteRoot),
  "utf8",
);
const economySbfPreflightDevnetRunnerSource = readFileSync(
  new URL("scripts/run-iat-b3-economy-sbf-preflight-devnet.sh", siteRoot),
  "utf8",
);
const accountLifecycleFixtureManifest = readFileSync(
  new URL("tests/fixtures/iat-b3-account-lifecycle/Cargo.toml", siteRoot),
  "utf8",
);
const accountLifecycleFixtureSource = readFileSync(
  new URL("tests/fixtures/iat-b3-account-lifecycle/src/lib.rs", siteRoot),
  "utf8",
);
const accountLifecycleLocalDriverSource = readFileSync(
  new URL("scripts/iat-b3-account-lifecycle-local-driver.mjs", siteRoot),
  "utf8",
);
const accountLifecycleLocalRunnerSource = readFileSync(
  new URL("scripts/run-iat-b3-account-lifecycle-local.sh", siteRoot),
  "utf8",
);
const releaseProofWorkflowSource = readFileSync(
  new URL("../../../../.github/workflows/iat-v2-proof.yml", import.meta.url),
  "utf8",
);
const economySbfPreflightDevnetEvidence = JSON.parse(readFileSync(
  new URL(
    "docs/b3/evidence/iat-b3-economy-sbf-structural-devnet-20260810T141607Z.json",
    siteRoot,
  ),
  "utf8",
));
const lawSource = readFileSync(
  new URL("programs/iat_b3_law/src/lib.rs", siteRoot),
  "utf8",
);
const economyPureKernelCode = `${economyCodecSource}\n${economyStakeIngressSource}\n${economyNativeAdapterSource}`
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

test("the default Rust kernel stays host-only while the sole SBF entrypoint is structural", () => {
  assert.deepEqual(matrix.firstSafeSlice, {
    crate: "programs/iat_b3_economy",
    crateType: "cdylib+lib",
    defaultFeatureHostOnly: true,
    defaultFeatureSolanaEntrypoint: false,
    featureGatedStructuralPreflight: true,
    productionSolanaEntrypoint: false,
    productionDispatcher: false,
    accountLifecycle: false,
    tokenCpi: false,
    networkAccess: false,
  });
  assert.match(workspaceManifest, /"programs\/iat_b3_economy"/u);
  assert.match(economyManifest, /crate-type = \["cdylib", "lib"\]/u);
  assert.match(
    economyManifest,
    /solana-pubkey = \{ version = "=3\.0\.0", features = \["curve25519"\] \}/u,
  );
  assert.match(economyManifest, /solana-sdk-ids = "=3\.1\.0"/u);
  assert.match(economyManifest, /runtime-account-bridge = \[/u);
  for (const dependency of [
    "solana-account-info",
    "solana-clock",
    "solana-rent",
    "solana-sysvar",
    "solana-zk-sdk",
    "solana-program-entrypoint",
    "solana-program-error",
    "spl-token-2022-interface",
  ]) {
    assert.match(
      economyManifest,
      new RegExp(`${dependency} = \\{[^}]+optional = true`, "u"),
      dependency,
    );
  }
  assert.match(economyManifest, /solana-zk-sdk = \{ version = "=4\.0\.0", optional = true \}/u);
  assert.match(
    economyManifest,
    /spl-token-2022-interface = \{ version = "=2\.1\.0", optional = true \}/u,
  );
  assert.match(
    economyManifest,
    /spl-transfer-hook-interface = \{ version = "=2\.1\.0", optional = true \}/u,
  );
  assert.match(
    economyManifest,
    /solana-instruction = \{ version = "=3\.5\.0", optional = true \}/u,
  );
  assert.deepEqual(
    [...economyManifest.matchAll(/^(spl-token[a-z0-9-]*)\s*=/gmu)].map(
      (match) => match[1],
    ),
    ["spl-token-2022-interface"],
  );
  assert.doesNotMatch(economyManifest, /iat-b3-vault/u);
  assert.doesNotMatch(economyManifest, /anchor-/u);
  assert.match(economyManifest, /solana-cpi = \{ version = "=3\.1\.0", optional = true \}/u);
  assert.match(economyManifest, /solana-system-interface = \{ version = "=2\.0\.0", features = \["bincode"\], optional = true \}/u);
  assert.doesNotMatch(
    economyPureKernelCode,
    /entrypoint!|process_instruction|#\[program\]|invoke(?:_signed)?\s*\(|AccountInfo|TcpStream|UdpSocket/u,
  );
  assert.match(
    economySource,
    /#\[cfg\(all\(feature = "sbf-preflight-entrypoint", not\(feature = "no-entrypoint"\)\)\)\]\s+solana_program_entrypoint::entrypoint!\(process_instruction\);/u,
  );
  assert.equal((economySource.match(/entrypoint!/gu) ?? []).length, 1);
});

test("the all-15 SBF surface is an exact structural preflight and never an economic handler", () => {
  assert.deepEqual(matrix.sbfStructuralPreflight, {
    stage: "FEATURE_GATED_ALL_15_ACCOUNT_META_SHAPE_SBF_NO_WRITES",
    feature: "sbf-preflight-entrypoint",
    complete: false,
    expectedHandlerCount: 15,
    instructionNamespace: "IATB3PF1",
    instructionVersion: 1,
    accountGraphOpcode: 0,
    instructionLengthBytes: 16,
    operationInventoryExact: true,
    accountMetaShapeChecksPresent: true,
    accountKeysAuthenticated: false,
    accountOwnersAuthenticated: false,
    accountDataRead: false,
    mutableAccountBorrows: false,
    accountWrites: false,
    systemCpi: false,
    tokenCpi: false,
    structuralPreflightAbiFrozen: true,
    productionInstructionAbiFrozen: false,
    structuralPreflightEntrypoint: true,
    structuralPreflightDispatcher: true,
    productionSolanaEntrypoint: false,
    productionDispatcher: false,
    localValidatorExecuted: true,
    localValidatorOperationCount: 15,
    localValidatorHostileSignerDriftRejected: true,
    artifactBytes: 21120,
    artifactSha256: "3bdffb2bcd9ee919e012d71522c8667883efea196ce5b58a2aef354b720a1588",
    publicDevnetDriverWired: true,
    devnetRpc: "https://api.devnet.solana.com",
    devnetGenesisHash: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
    devnetPayer: "DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4",
    immutableDeploymentRequired: true,
    temporaryAccountCleanupRequired: true,
    structuralPreflightPubliclyDeployed: true,
    publicDevnetExecuted: true,
    publicDevnetOperationCount: 15,
    publicDevnetEvidence: {
      path: "projects/star-ascent/site/docs/b3/evidence/iat-b3-economy-sbf-structural-devnet-20260810T141607Z.json",
      sha256: "f0298ad92cd84bee91a3b0e6fbf6f002b7cd62b9e8905b6c353ed1974c42a607",
    },
    publicEconomicWriteExposure: false,
    anyHandlerComplete: false,
    mainnetHold: true,
  });
  assert.match(economyManifest, /sbf-preflight-entrypoint = \[/u);
  assert.match(economySbfPreflightSource, /pub const SBF_PREFLIGHT_INSTRUCTION_NAMESPACE: &\[u8; 8\] = b"IATB3PF1";/u);
  assert.match(economySbfPreflightSource, /structural_preflight_entrypoint_exposed: true/u);
  for (const falseFlag of [
    "production_instruction_abi_frozen",
    "production_entrypoint_exposed",
    "production_dispatcher_exposed",
    "public_economic_write_exposure",
    "account_keys_authenticated",
    "account_owners_authenticated",
    "mutable_account_borrows",
    "account_writes_executed",
    "system_cpi_executed",
    "token_cpi_executed",
    "any_handler_complete",
  ]) {
    assert.match(economySbfPreflightSource, new RegExp(`${falseFlag}: false`, "u"), falseFlag);
  }
  assert.doesNotMatch(
    economySbfPreflightSource,
    /try_borrow_(?:mut_)?data|try_borrow_mut_lamports|invoke(?:_signed)?\s*\(|RpcClient|send_and_confirm/u,
  );
  assert.match(economySbfPreflightDriverSource, /const RPC_LOOPBACK =/u);
  assert.match(economySbfPreflightDriverSource, /const DEVNET_RPC = "https:\/\/api\.devnet\.solana\.com";/u);
  assert.match(economySbfPreflightDriverSource, /canonical Devnet Genesis hash mismatch/u);
  assert.match(economySbfPreflightDriverSource, /programData\[12\] !== 0/u);
  assert.match(economySbfPreflightDriverSource, /operationCount: signatures\.length/u);
  assert.match(economySbfPreflightDriverSource, /writesExecutedByEconomyProgram: false/u);
  assert.match(economySbfPreflightRunnerSource, /solana-test-validator/u);
  assert.doesNotMatch(economySbfPreflightRunnerSource, /api\.devnet|api\.mainnet|api\.testnet/u);
  assert.match(economySbfPreflightDevnetRunnerSource, /\[\[ "\$\{1:-\}" == "--execute" && \$# -eq 1 \]\]/u);
  assert.match(economySbfPreflightDevnetRunnerSource, /solana program deploy "\$artifact"[\s\S]+--final/u);
  assert.match(economySbfPreflightDevnetRunnerSource, /--resume-program/u);
  assert.match(economySbfPreflightDevnetRunnerSource, /if \[\[ "\$mode" == "deploy" \]\]; then[\s\S]+solana program deploy/u);
  assert.match(economySbfPreflightDevnetRunnerSource, /solana program dump "\$program_id"/u);
  assert.match(economySbfPreflightDevnetRunnerSource, /--network devnet/u);
  assert.match(economySbfPreflightDevnetRunnerSource, /temporaryAccountsRemoved":true/u);
  assert.doesNotMatch(economySbfPreflightDevnetRunnerSource, /mainnet-beta|api\.mainnet|api\.testnet/u);
  assert.equal(economySbfPreflightDevnetEvidence.status, "PASS");
  assert.equal(economySbfPreflightDevnetEvidence.resume.operations.length, 15);
  assert.equal(
    economySbfPreflightDevnetEvidence.independentFinalizedObservation.signatureCount,
    28,
  );
  assert.equal(
    economySbfPreflightDevnetEvidence.independentFinalizedObservation.temporaryAccountsAbsent,
    true,
  );
  assert.equal(economySbfPreflightDevnetEvidence.writesExecutedByEconomyProgram, false);
  assert.equal(economySbfPreflightDevnetEvidence.fullEconomicHandlerRehearsalComplete, false);
  assert.equal(economySbfPreflightDevnetEvidence.anyHandlerComplete, false);
  assert.equal(economySbfPreflightDevnetEvidence.mainnetExecutionAuthorized, false);
  assert.equal(economySbfPreflightDevnetEvidence.mainnetStatus, "HOLD");
});

test("the native state adapter remains an explicit nonactivating truth surface", () => {
  assert.match(economySource, /pub mod native_adapter;/u);
  assert.match(
    economyNativeAdapterSource,
    /pub const NATIVE_ACCOUNT_ADAPTER_STATUS: &str =\s*"HOST_ONLY_NONACTIVATING_STRICT_STATE_ADAPTER";/u,
  );
  for (const falseFlag of [
    "entrypoint_exposed",
    "dispatcher_exposed",
    "account_writes_executed",
    "system_cpi_executed",
    "token_cpi_executed",
    "rent_sysvar_authenticated",
    "config_codec_supported",
    "runtime_authorization_complete",
    "any_handler_complete",
  ]) {
    assert.match(
      economyNativeAdapterSource,
      new RegExp(`${falseFlag}: false`, "u"),
      falseFlag,
    );
  }
  assert.match(economyNativeAdapterSource, /mainnet_hold: true/u);
  for (const capabilityField of [
    "unix_timestamp",
    "local_day",
    "law_program_id",
    "law_state_address",
    "law_state_bump",
    "mint",
    "network_genesis_hash",
    "law_account_sha256",
  ]) {
    assert.match(
      economySource,
      new RegExp(`\\s${capabilityField}: (?:i64|u8|\\[u8; 32\\]),`, "u"),
      capabilityField,
    );
    assert.match(
      economyNativeAdapterSource,
      new RegExp(`\\s${capabilityField}: (?:i64|u8|\\[u8; 32\\]),`, "u"),
      capabilityField,
    );
  }
  assert.match(
    economyNativeAdapterSource,
    /if gate\.mint\(\) != binding\.mint[\s\S]+LawMintMismatch/u,
  );
  assert.match(
    economyNativeAdapterSource,
    /pub struct CanonicalFactionConfigPda[\s\S]+pub struct CanonicalFactionWeekPda[\s\S]+pub struct CanonicalFactionRewardManifestPda/u,
  );
  assert.match(
    economyNativeAdapterSource,
    /fn validate_batch_funding[\s\S]+InsufficientPayerBalance/u,
  );
  assert.match(
    economyNativeAdapterSource,
    /fn validate_payer_preconditions[\s\S]+PayerMustBeSystemOwned[\s\S]+PayerDataMustBeEmpty[\s\S]+PayerPreimageMismatch/u,
  );
  assert.doesNotMatch(
    economyNativeAdapterSource.replace(/\/\/.*$/gmu, "").replace(/\/\*[\s\S]*?\*\//gu, ""),
    /entrypoint!|process_instruction|#\[program\]|invoke(?:_signed)?\s*\(|AccountInfo/u,
  );
});

test("the feature-gated runtime bridge reads AccountInfo Clock and Rent without activating a dispatcher", () => {
  assert.deepEqual(matrix.runtimeAccountBridgePreparation, {
    stage: "FEATURE_GATED_READ_ONLY_ACCOUNTINFO_CLOCK_RENT_NO_DISPATCH",
    feature: "runtime-account-bridge",
    complete: false,
    accountInfoReads: true,
    clockSysvarAuthenticated: true,
    rentSysvarAuthenticated: true,
    mutableAccountBorrows: false,
    accountWrites: false,
    systemCpi: false,
    tokenCpi: false,
    instructionAbiFrozen: false,
    solanaEntrypoint: false,
    publicDispatcher: false,
    productionIdentityBindingFrozen: false,
    configCodecSupported: false,
    anyHandlerComplete: false,
    publicExposure: false,
  });
  assert.match(
    economySource,
    /#\[cfg\(feature = "runtime-account-bridge"\)\]\s+pub mod runtime_adapter;/u,
  );
  assert.match(economyRuntimeAdapterSource, /use solana_account_info::AccountInfo;/u);
  assert.match(economyRuntimeAdapterSource, /Clock::get\(\)/u);
  assert.match(economyRuntimeAdapterSource, /Rent::get\(\)/u);
  assert.match(
    economyRuntimeAdapterSource,
    /RUNTIME_ACCOUNT_BRIDGE_STATUS:[\s\S]+FEATURE_GATED_READ_ONLY_ACCOUNTINFO_CLOCK_RENT_NO_DISPATCH/u,
  );
  for (const falseFlag of [
    "mutable_account_borrows",
    "account_writes_executed",
    "system_cpi_executed",
    "token_cpi_executed",
    "instruction_abi_frozen",
    "entrypoint_exposed",
    "dispatcher_exposed",
    "production_identity_binding_frozen",
    "config_codec_supported",
    "any_handler_complete",
  ]) {
    assert.match(economyRuntimeAdapterSource, new RegExp(`${falseFlag}: false`, "u"), falseFlag);
  }
  assert.doesNotMatch(
    economyRuntimeAdapterSource.replace(/\/\/.*$/gmu, "").replace(/\/\*[\s\S]*?\*\//gu, ""),
    /entrypoint!|process_instruction|#\[program\]|invoke(?:_signed)?\s*\(|try_borrow_mut|instruction_data/u,
  );
});

test("the runtime write adapter executes only authenticated existing-state CAS batches", () => {
  assert.deepEqual(matrix.runtimeWriteAdapterPreparation, {
    stage: "FEATURE_GATED_EXISTING_STATE_CAS_BATCH_WRITES_NO_CPI_NO_DISPATCH",
    feature: "runtime-write-adapter",
    complete: false,
    dailyLawCapabilityRequired: true,
    strictStateAuthenticationRequired: true,
    existingStateAccountsOnly: true,
    allMutableBorrowsAcquiredBeforeWrite: true,
    allPreimagesRevalidatedBeforeWrite: true,
    mutableAccountBorrows: true,
    accountDataWrites: true,
    accountCreation: false,
    lamportWrites: false,
    systemCpi: false,
    tokenCpi: false,
    instructionAbiFrozen: false,
    solanaEntrypoint: false,
    publicDispatcher: false,
    productionIdentityBindingFrozen: false,
    anyHandlerComplete: false,
    publicExposure: false,
    mainnetHold: true,
  });
  assert.match(economyManifest, /runtime-write-adapter = \["runtime-account-bridge"\]/u);
  assert.match(
    economySource,
    /#\[cfg\(feature = "runtime-write-adapter"\)\]\s+pub mod runtime_write_adapter;/u,
  );
  assert.match(
    economyRuntimeWriteAdapterSource,
    /pub fn execute_existing_write_batch_account_infos/u,
  );
  assert.match(
    economyRuntimeWriteAdapterSource,
    /pub fn execute_production_active_existing_write_batch_account_infos/u,
  );
  assert.match(
    economyRuntimeWriteAdapterSource,
    /production_active_config_capability_required: true/u,
  );
  assert.match(economyRuntimeWriteAdapterSource, /RuntimeProductionActiveConfig/u);
  assert.match(economyRuntimeWriteAdapterSource, /ActiveConfigCapabilityMismatch/u);
  assert.match(economyRuntimeWriteAdapterSource, /validate_atomic_write_preconditions/u);
  assert.match(economyRuntimeWriteAdapterSource, /try_borrow_mut_data\(\)/u);
  assert.match(economyRuntimeWriteAdapterSource, /PostValidationPreimageMismatch/u);
  assert.match(economyRuntimeWriteAdapterSource, /data\.copy_from_slice\(existing\.postimage\(\)\)/u);
  assert.match(economyRuntimeWriteAdapterSource, /account_data_writes_supported: true/u);
  for (const falseFlag of [
    "account_creation_supported",
    "lamport_writes_supported",
    "system_cpi_supported",
    "token_cpi_supported",
    "instruction_abi_frozen",
    "entrypoint_exposed",
    "dispatcher_exposed",
    "any_handler_complete",
  ]) {
    assert.match(
      economyRuntimeWriteAdapterSource,
      new RegExp(`${falseFlag}: false`, "u"),
      falseFlag,
    );
  }
  assert.match(economyRuntimeWriteAdapterSource, /mainnet_hold: true/u);
  assert.doesNotMatch(
    economyRuntimeWriteAdapterSource.replace(/\/\/.*$/gmu, "").replace(/\/\*[\s\S]*?\*\//gu, ""),
    /entrypoint!|process_instruction|#\[program\]|invoke(?:_signed)?\s*\(|instruction_data|RpcClient|send_and_confirm/u,
  );
});

test("the runtime account lifecycle executes only sealed canonical System CPI batches", () => {
  assert.deepEqual(matrix.runtimeAccountLifecyclePreparation, {
    stage: "FEATURE_GATED_SEALED_PDA_SYSTEM_CPI_NO_ABI_NO_DISPATCH_MAINNET_HOLD",
    feature: "runtime-account-lifecycle",
    complete: false,
    dailyLawCapabilityRequired: true,
    sealedCreateIntentsOnly: true,
    allPreconditionsCheckedBeforeFirstCpi: true,
    canonicalInternalPdaSignerSeedsOnly: true,
    systemCreateAccount: true,
    systemAllocateAssignFund: true,
    sealedPostimageWrite: true,
    transactionRollbackRequiredAfterCpi: true,
    accountCreation: true,
    lamportWrites: true,
    systemCpi: true,
    tokenCpi: false,
    instructionAbiFrozen: false,
    solanaEntrypoint: false,
    publicDispatcher: false,
    productionIdentityBindingFrozen: false,
    anyHandlerComplete: false,
    publicExposure: false,
    devnetExecuted: false,
    mainnetHold: true,
  });
  assert.match(economyManifest, /runtime-account-lifecycle = \[[\s\S]+"runtime-write-adapter"[\s\S]+"dep:solana-cpi"[\s\S]+"dep:solana-program-error"[\s\S]+"dep:solana-system-interface"[\s\S]+\]/u);
  assert.match(
    economySource,
    /#\[cfg\(feature = "runtime-account-lifecycle"\)\]\s+pub mod runtime_account_lifecycle;/u,
  );
  assert.match(economyRuntimeAccountLifecycleSource, /pub fn execute_create_state_batch_account_infos/u);
  assert.match(
    economyRuntimeAccountLifecycleSource,
    /pub fn execute_production_active_create_state_batch_account_infos/u,
  );
  assert.match(
    economyRuntimeAccountLifecycleSource,
    /production_active_config_capability_required: true/u,
  );
  assert.match(economyRuntimeAccountLifecycleSource, /RuntimeProductionActiveConfig/u);
  assert.match(economyRuntimeAccountLifecycleSource, /ActiveConfigCapabilityMismatch/u);
  assert.match(economyRuntimeAccountLifecycleSource, /validate_atomic_write_preconditions/u);
  assert.match(economyRuntimeAccountLifecycleSource, /with_pda_signer_seeds/u);
  assert.match(economyRuntimeAccountLifecycleSource, /system_instruction::create_account/u);
  assert.match(economyRuntimeAccountLifecycleSource, /system_instruction::allocate/u);
  assert.match(economyRuntimeAccountLifecycleSource, /system_instruction::assign/u);
  assert.match(economyRuntimeAccountLifecycleSource, /system_instruction::transfer/u);
  assert.match(economyRuntimeAccountLifecycleSource, /invoke_signed\(/u);
  assert.match(economyRuntimeAccountLifecycleSource, /transaction_rollback_required_after_cpi: true/u);
  for (const falseFlag of [
    "token_cpi_supported",
    "instruction_abi_frozen",
    "entrypoint_exposed",
    "dispatcher_exposed",
    "any_handler_complete",
  ]) {
    assert.match(
      economyRuntimeAccountLifecycleSource,
      new RegExp(`${falseFlag}: false`, "u"),
      falseFlag,
    );
  }
  assert.match(economyRuntimeAccountLifecycleSource, /mainnet_hold: true/u);
  assert.doesNotMatch(
    economyRuntimeAccountLifecycleSource.replace(/\/\/.*$/gmu, "").replace(/\/\*[\s\S]*?\*\//gu, ""),
    /entrypoint!|process_instruction|#\[program\]|instruction_data|RpcClient|send_and_confirm|spl_token/u,
  );
});

test("the local lifecycle fixture proves SBF CPI without becoming a production surface", () => {
  assert.match(
    accountLifecycleFixtureManifest,
    /iat-b3-economy = \{ path = "\.\.\/\.\.\/\.\.\/programs\/iat_b3_economy", features = \["runtime-account-lifecycle"\] \}/u,
  );
  assert.match(accountLifecycleFixtureManifest, /^\[workspace\]$/mu);
  assert.match(
    accountLifecycleFixtureSource,
    /execute_create_state_batch_account_infos/u,
  );
  assert.match(accountLifecycleFixtureSource, /execute_existing_write_batch_account_infos/u);
  assert.match(accountLifecycleFixtureSource, /verify_daily_law_open_account_info/u);
  assert.match(accountLifecycleFixtureSource, /prepare_create_state_account_info/u);
  assert.match(accountLifecycleFixtureSource, /InjectedRollback = 909/u);
  assert.match(accountLifecycleLocalDriverSource, /systemCpiCount/u);
  assert.match(accountLifecycleLocalDriverSource, /rollbackObserved/u);
  assert.match(accountLifecycleLocalDriverSource, /existingStateCasObserved/u);
  assert.match(accountLifecycleLocalDriverSource, /syntheticDailyLawFixture: true/u);
  assert.match(accountLifecycleLocalDriverSource, /productionInstructionAbiFrozen: false/u);
  assert.match(accountLifecycleLocalDriverSource, /activationReady: false/u);
  assert.match(accountLifecycleLocalRunnerSource, /http:\/\/127\.0\.0\.1:/u);
  assert.match(accountLifecycleLocalRunnerSource, /publicNetworkWrites":false/u);
  assert.match(accountLifecycleLocalRunnerSource, /fullFeatureDevnetRehearsalComplete":false/u);
  assert.match(accountLifecycleLocalRunnerSource, /mainnetStatus":"HOLD/u);
  assert.match(
    releaseProofWorkflowSource,
    /Rehearse B3 sealed account lifecycle on an isolated local validator[\s\S]+npm ci --ignore-scripts --no-audit --no-fund[\s\S]+bash scripts\/run-iat-b3-account-lifecycle-local\.sh/u,
  );
  assert.doesNotMatch(
    `${accountLifecycleFixtureSource}\n${accountLifecycleLocalDriverSource}\n${accountLifecycleLocalRunnerSource}`,
    /https:\/\/|api\.devnet\.solana\.com|api\.mainnet-beta\.solana\.com/u,
  );

  for (const [source, functionName] of [
    [economySource, "verify_daily_law_open"],
    [economyNativeAdapterSource, "prepare_create_state_account"],
    [economyNativeAdapterSource, "prepare_existing_state_write"],
    [economyNativeAdapterSource, "seal_atomic_write_batch"],
    [economyRuntimeAdapterSource, "authenticate_state_account_info"],
    [economyRuntimeAdapterSource, "prepare_existing_state_write_account_info"],
    [economyRuntimeAdapterSource, "verify_daily_law_open_account_info"],
    [economyRuntimeAdapterSource, "prepare_create_state_account_info"],
    [economyRuntimeAccountLifecycleSource, "execute_create_state_batch_account_infos"],
    [economyRuntimeWriteAdapterSource, "execute_existing_write_batch_account_infos"],
    [
      economyRuntimeWriteAdapterSource,
      "execute_production_active_existing_write_batch_account_infos",
    ],
  ]) {
    assert.match(
      source,
      new RegExp(`#\\[inline\\(never\\)\\]\\s+pub fn ${functionName}`, "u"),
      `${functionName} must retain its SBF stack-frame boundary`,
    );
  }
});

test("the all-15 rehearsal preflight is exact-version read-only and cannot activate Devnet", () => {
  assert.deepEqual(matrix.all15RehearsalPreflight, {
    stage: "FEATURE_GATED_READ_ONLY_ALL_15_ACCOUNT_GRAPH_PREFLIGHT_NO_DISPATCH",
    feature: "runtime-account-bridge",
    complete: false,
    expectedHandlerCount: 15,
    operationInventoryExact: true,
    accountRoleGraphsPresent: true,
    accountMetaShapeChecksPresent: true,
    accountIdentityGraphComplete: false,
    dailyLawCapabilityRequired: true,
    nativeBindingRequired: true,
    canonicalToken2022MintRequired: true,
    token2022InterfaceVersion: "=2.1.0",
    solanaAccountInfoVersion: "=3.1.1",
    solanaZkSdkVersion: "=4.0.0",
    canonicalPodBooleansRequired: true,
    publicBalanceAccountsOnly: true,
    confidentialBalanceAccountsAccepted: false,
    strictStateAuthenticationReused: true,
    inertWriteBatchSealingReused: true,
    mutableAccountBorrows: false,
    accountWrites: false,
    systemCpi: false,
    tokenCpi: false,
    rpcUsed: false,
    transactionSigned: false,
    deploymentExecuted: false,
    devnetExecuted: false,
    publicDevnetDriverWired: false,
    instructionAbiFrozen: false,
    solanaEntrypoint: false,
    publicDispatcher: false,
    productionIdentityBindingFrozen: false,
    configCodecSupported: false,
    ownerPolicyFrozen: false,
    cccGenesisEnabled: false,
    anyHandlerComplete: false,
    mainnetHold: true,
    publicExposure: false,
  });
  assert.match(
    economySource,
    /#\[cfg\(feature = "runtime-account-bridge"\)\]\s+pub mod rehearsal_adapter;/u,
  );
  assert.match(
    economySource,
    /#\[cfg\(feature = "runtime-account-bridge"\)\]\s+pub mod token_2022_runtime;/u,
  );
  assert.match(
    economyRehearsalAdapterSource,
    /pub const EXPECTED_REHEARSAL_HANDLER_COUNT: usize = 15;/u,
  );
  assert.match(
    economyRehearsalAdapterSource,
    /pub const ALL_REHEARSAL_OPERATIONS:[\s\S]+InitializeConfig[\s\S]+ExpireRound/u,
  );
  for (const falseFlag of [
    "account_identity_graph_complete",
    "config_codec_supported",
    "owner_policy_frozen",
    "ccc_genesis_enabled",
    "instruction_abi_frozen",
    "entrypoint_exposed",
    "dispatcher_exposed",
    "mutable_account_borrows",
    "account_writes_executed",
    "system_cpi_executed",
    "token_cpi_executed",
    "rpc_used",
    "transaction_signed",
    "deployment_executed",
    "production_identity_binding_frozen",
    "devnet_executed",
    "any_handler_complete",
  ]) {
    assert.match(economyRehearsalAdapterSource, new RegExp(`${falseFlag}: false`, "u"), falseFlag);
  }
  assert.match(economyRehearsalAdapterSource, /mainnet_hold: true/u);
  assert.match(economyToken2022RuntimeSource, /TOKEN_2022_INTERFACE_VERSION: &str = "2\.1\.0"/u);
  assert.match(economyToken2022RuntimeSource, /SOLANA_ZK_SDK_VERSION: &str = "4\.0\.0"/u);
  assert.match(
    economyToken2022RuntimeSource,
    /confidential\.auto_approve_new_accounts\.0 > 1/u,
  );
  assert.match(economyToken2022RuntimeSource, /transfer_hook\.transferring\.0 > 1/u);
  assert.match(economyToken2022RuntimeSource, /get_extension::<ImmutableOwner>\(\)/u);
  assert.doesNotMatch(
    `${economyRehearsalAdapterSource}\n${economyToken2022RuntimeSource}`
      .replace(/\/\/.*$/gmu, "")
      .replace(/\/\*[\s\S]*?\*\//gu, ""),
    /entrypoint!|process_instruction|#\[program\]|invoke(?:_signed)?\s*\(|try_borrow_mut|RpcClient|send_and_confirm|instruction_data/u,
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

test("the feature-gated stake-ingress runtime executes exact Token-2022 CPI reloads without completing a handler", () => {
  assert.match(
    economySource,
    /#\[cfg\(feature = "runtime-token-2022-stake-ingress"\)\]\s+pub mod stake_ingress_runtime;/u,
  );
  assert.match(economyManifest, /runtime-token-2022-stake-ingress = \[/u);
  for (const token of [
    "approve_checked(",
    "transfer_checked(",
    "add_extra_accounts_for_execute_cpi(",
    "invoke_signed(",
    "persist_transaction_local_state(plan, &post_transfer)",
    "restore_original_delegate(plan, accounts)",
  ]) {
    assert.ok(economyStakeIngressRuntimeSource.includes(token), token);
  }
  assert.match(
    economyStakeIngressRuntimeSource,
    /retained_v2_post_cpi_persistence_complete: false/u,
  );
  assert.match(economyStakeIngressRuntimeSource, /daily_law_capability_reauthenticated: true/u);
  assert.match(
    economyStakeIngressRuntimeSource,
    /pub fn execute_daily_law_authenticated_stake_ingress/u,
  );
  assert.match(economyStakeIngressRuntimeSource, /fn authenticate_daily_law/u);
  assert.match(economyStakeIngressRuntimeSource, /fn bind_stake_ingress_accounts/u);
  assert.match(economyStakeIngressRuntimeSource, /Box<PrepareOpenPositionInput>/u);
  assert.match(economyStakeIngressRuntimeSource, /Box<StakeIngressExecutionPlan>/u);
  assert.match(economyStakeIngressRuntimeSource, /canonical_mint_policy_reauthenticated: false/u);
  assert.match(economyStakeIngressRuntimeSource, /public_entrypoint_exposed: false/u);
  assert.match(economyStakeIngressRuntimeSource, /instruction_abi_frozen: false/u);
  assert.match(economyStakeIngressRuntimeSource, /production_identities_frozen: false/u);
  assert.match(economyStakeIngressRuntimeSource, /devnet_executed: false/u);
  assert.match(economyStakeIngressRuntimeSource, /mainnet_hold: true/u);
  assert.doesNotMatch(
    economyStakeIngressRuntimeSource,
    /entrypoint!|process_instruction|#\[program\]|RpcClient|send_and_confirm/u,
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
  assert.doesNotMatch(economySource, /pub fn register_agency\s*\(/u);
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
    economySource,
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
