import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const v2Source = readFileSync(
  new URL("../programs/iat_v2/src/lib.rs", import.meta.url),
  "utf8",
);
const v2Cargo = readFileSync(
  new URL("../programs/iat_v2/Cargo.toml", import.meta.url),
  "utf8",
);
const lawSource = readFileSync(
  new URL("../programs/iat_b3_law/src/lib.rs", import.meta.url),
  "utf8",
);
const lawCargo = readFileSync(
  new URL("../programs/iat_b3_law/Cargo.toml", import.meta.url),
  "utf8",
);
const lawBuildSource = readFileSync(
  new URL("../programs/iat_b3_law/build.rs", import.meta.url),
  "utf8",
);
const stakeIngressSource = readFileSync(
  new URL("../programs/iat_b3_law/src/stake_ingress.rs", import.meta.url),
  "utf8",
);
const economyStakeIngressSource = readFileSync(
  new URL("../programs/iat_b3_economy/src/stake_ingress.rs", import.meta.url),
  "utf8",
);
const economyStakeIngressRuntimeSource = readFileSync(
  new URL("../programs/iat_b3_economy/src/stake_ingress_runtime.rs", import.meta.url),
  "utf8",
);
const economyNativeAdapterSource = readFileSync(
  new URL("../programs/iat_b3_economy/src/native_adapter.rs", import.meta.url),
  "utf8",
);
const economyRuntimeAdapterSource = readFileSync(
  new URL("../programs/iat_b3_economy/src/runtime_adapter.rs", import.meta.url),
  "utf8",
);
const economyRuntimeWriteAdapterSource = readFileSync(
  new URL("../programs/iat_b3_economy/src/runtime_write_adapter.rs", import.meta.url),
  "utf8",
);
const economyRuntimeAccountLifecycleSource = readFileSync(
  new URL("../programs/iat_b3_economy/src/runtime_account_lifecycle.rs", import.meta.url),
  "utf8",
);
const economyConfigGenesisCodecSource = readFileSync(
  new URL("../programs/iat_b3_economy/src/config_genesis_codec.rs", import.meta.url),
  "utf8",
);
const economyConfigGenesisTransitionSource = readFileSync(
  new URL("../programs/iat_b3_economy/src/config_genesis_transition.rs", import.meta.url),
  "utf8",
);
const economyConfigGenesisTransitionRuntimeSource = readFileSync(
  new URL(
    "../programs/iat_b3_economy/src/config_genesis_transition_runtime.rs",
    import.meta.url,
  ),
  "utf8",
);
const economyGenesisConservationSource = readFileSync(
  new URL("../programs/iat_b3_economy/src/genesis_conservation.rs", import.meta.url),
  "utf8",
);
const economyGenesisConservationRuntimeSource = readFileSync(
  new URL("../programs/iat_b3_economy/src/genesis_conservation_runtime.rs", import.meta.url),
  "utf8",
);
const economyRehearsalAdapterSource = readFileSync(
  new URL("../programs/iat_b3_economy/src/rehearsal_adapter.rs", import.meta.url),
  "utf8",
);
const economyToken2022RuntimeSource = readFileSync(
  new URL("../programs/iat_b3_economy/src/token_2022_runtime.rs", import.meta.url),
  "utf8",
);
const economySbfPreflightSource = readFileSync(
  new URL("../programs/iat_b3_economy/src/sbf_preflight.rs", import.meta.url),
  "utf8",
);
const economyProductionInstructionSource = readFileSync(
  new URL("../programs/iat_b3_economy/src/production_instruction.rs", import.meta.url),
  "utf8",
);
const economyProductionDispatchSource = readFileSync(
  new URL("../programs/iat_b3_economy/src/production_dispatch.rs", import.meta.url),
  "utf8",
);
const economySource = readFileSync(
  new URL("../programs/iat_b3_economy/src/lib.rs", import.meta.url),
  "utf8",
);
const economyCargo = readFileSync(
  new URL("../programs/iat_b3_economy/Cargo.toml", import.meta.url),
  "utf8",
);
const audit = readFileSync(
  new URL("../docs/b3/RUST_WRITE_GATE_AUDIT.md", import.meta.url),
  "utf8",
);
const lawAdapter = readFileSync(
  new URL("../docs/b3/LAW_ADAPTER.md", import.meta.url),
  "utf8",
);
const workspaceCargo = readFileSync(new URL("../Cargo.toml", import.meta.url), "utf8");

const EXPECTED_V2_HANDLERS = [
  "initialize_config",
  "initialize_lane_vault",
  "initialize_stake_vault",
  "activate",
  "register_agency",
  "set_eligibility",
  "open_position",
  "settle_position_week",
  "settle_core_week",
  "claim_lane_principal",
  "withdraw_position_principal",
  "close_position",
  "commit_round",
  "settle_round",
  "expire_round",
];

function anchorProgramBody(source) {
  const start = source.indexOf("#[program]");
  const end = source.indexOf("\n}\n\nfn beneficiary", start);
  assert.notEqual(start, -1, "V2 #[program] module is missing");
  assert.notEqual(end, -1, "V2 #[program] module terminator moved");
  return source.slice(start, end);
}

function functionBody(source, name) {
  const signature = new RegExp(`(?:pub(?:\\(crate\\))? )?fn ${name}\\b`, "u");
  const match = signature.exec(source);
  assert.ok(match, `missing Rust function ${name}`);
  const open = source.indexOf("{", match.index);
  assert.notEqual(open, -1, `missing body for Rust function ${name}`);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(match.index, index + 1);
  }
  assert.fail(`unterminated body for Rust function ${name}`);
}

function structBody(source, name) {
  const signature = new RegExp(`pub struct ${name}\\b`, "u");
  const match = signature.exec(source);
  assert.ok(match, `missing Rust struct ${name}`);
  const open = source.indexOf("{", match.index);
  assert.notEqual(open, -1, `missing body for Rust struct ${name}`);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(match.index, index + 1);
  }
  assert.fail(`unterminated body for Rust struct ${name}`);
}

function assertTokensInOrder(body, tokens, label) {
  let cursor = -1;
  for (const token of tokens) {
    const next = body.indexOf(token, cursor + 1);
    assert.notEqual(next, -1, `${label} is missing ${token}`);
    assert.ok(next > cursor, `${label} moved ${token} out of order`);
    cursor = next;
  }
}

test("the audit inventories every retained V2 Rust write handler", () => {
  const handlers = [...anchorProgramBody(v2Source).matchAll(/^\s+pub fn ([a-z0-9_]+)\s*\(/gmu)]
    .map((match) => match[1]);
  assert.deepEqual(handlers, EXPECTED_V2_HANDLERS);

  for (const handler of EXPECTED_V2_HANDLERS) {
    const row = new RegExp(`\\| ${"`"}${handler}${"`"} \\|`, "u");
    assert.match(audit, row, `${handler} is absent from the write-gate matrix`);
  }
  assert.match(audit, /All 15 of its public\s+write handlers omit/u);
});

test("the Rust workspace reports the sole structural economy entrypoint without exposing writes", () => {
  const workspaceMembers = [...workspaceCargo.matchAll(/"(programs\/[a-z0-9_]+)"/gu)]
    .map((match) => match[1]);
  assert.deepEqual(workspaceMembers, [
    "programs/iat_b3_consensus",
    "programs/iat_b3_economy",
    "programs/iat_b3_law",
    "programs/iat_b3_vault",
    "programs/iat_v2",
  ]);
  assert.match(economyCargo, /crate-type = \["cdylib", "lib"\]/u);
  assert.match(economyCargo, /solana-pubkey = \{ version = "=3\.0\.0"/u);
  assert.match(economyCargo, /solana-sdk-ids = "=3\.1\.0"/u);
  assert.match(economyCargo, /runtime-account-bridge = \[/u);
  assert.match(economyCargo, /runtime-write-adapter = \["runtime-account-bridge"\]/u);
  assert.match(economyCargo, /runtime-account-lifecycle = \[[\s\S]+"runtime-write-adapter"[\s\S]+"dep:solana-cpi"[\s\S]+"dep:solana-program-error"[\s\S]+"dep:solana-system-interface"[\s\S]+\]/u);
  assert.match(economyCargo, /solana-account-info = \{[^}]+optional = true/u);
  assert.match(economyCargo, /solana-zk-sdk = \{ version = "=4\.0\.0", optional = true \}/u);
  assert.match(
    economyCargo,
    /spl-token-2022-interface = \{ version = "=2\.1\.0", optional = true \}/u,
  );
  assert.deepEqual(
    [...economyCargo.matchAll(/^(spl-token[a-z0-9-]*)\s*=/gmu)].map(
      (match) => match[1],
    ),
    ["spl-token-2022-interface"],
  );
  assert.doesNotMatch(economyCargo, /iat-b3-vault/u);
  assert.doesNotMatch(economyCargo, /anchor-/u);
  assert.match(economyCargo, /solana-cpi = \{ version = "=3\.1\.0", optional = true \}/u);
  assert.match(economyCargo, /solana-system-interface = \{ version = "=2\.0\.0", features = \["bincode"\], optional = true \}/u);
  assert.match(economyCargo, /solana-program-entrypoint = \{ version = "=3\.1\.1", optional = true \}/u);
  assert.match(economyCargo, /solana-program-error = \{ version = "=3\.0\.1", optional = true \}/u);
  assert.doesNotMatch(
    `${economyNativeAdapterSource}\n${economyRuntimeAdapterSource}\n${economyRuntimeWriteAdapterSource}\n${economyConfigGenesisCodecSource}\n${economyRehearsalAdapterSource}\n${economyToken2022RuntimeSource}`,
    /entrypoint!|process_instruction|#\[program\]|invoke(?:_signed)?\s*\(/u,
  );
  assert.match(economySource, /solana_program_entrypoint::entrypoint!\(process_instruction\);/u);
  assert.equal((economySource.match(/entrypoint!/gu) ?? []).length, 1);
  assert.doesNotMatch(
    economySbfPreflightSource,
    /try_borrow_(?:mut_)?data|try_borrow_mut_lamports|invoke(?:_signed)?\s*\(/u,
  );
  for (const falseFlag of [
    "production_entrypoint_exposed",
    "production_dispatcher_exposed",
    "public_economic_write_exposure",
    "account_writes_executed",
    "system_cpi_executed",
    "token_cpi_executed",
    "any_handler_complete",
  ]) {
    assert.match(economySbfPreflightSource, new RegExp(`${falseFlag}: false`, "u"), falseFlag);
  }
  assert.doesNotMatch(economyRuntimeAdapterSource, /try_borrow_mut|instruction_data/u);
  assert.doesNotMatch(
    `${economyRehearsalAdapterSource}\n${economyToken2022RuntimeSource}`,
    /try_borrow_mut|instruction_data|RpcClient|send_and_confirm/u,
  );
  assert.match(economyRuntimeWriteAdapterSource, /try_borrow_mut_data\(\)/u);
  assert.match(economyRuntimeWriteAdapterSource, /validate_atomic_write_preconditions/u);
  assert.match(
    economyRuntimeWriteAdapterSource,
    /production_active_config_capability_required: true/u,
  );
  assert.match(
    economyRuntimeWriteAdapterSource,
    /execute_production_active_existing_write_batch_account_infos/u,
  );
  assert.match(
    economyRuntimeWriteAdapterSource,
    /execute_production_active_config_stake_principal_cas_for_completed_ingress/u,
  );
  assert.match(
    economyRuntimeWriteAdapterSource,
    /production_active_config_stake_principal_cas_supported: true/u,
  );
  assert.match(
    economyRuntimeWriteAdapterSource,
    /production_completed_ingress_lane_account_preflight_supported: true/u,
  );
  assert.match(
    economyRuntimeWriteAdapterSource,
    /production_completed_ingress_config_and_lanes_atomic_cas_supported: true/u,
  );
  assert.match(
    economyRuntimeWriteAdapterSource,
    /prepare_production_completed_ingress_lane_write_batch_account_infos/u,
  );
  assert.match(
    economyRuntimeWriteAdapterSource,
    /execute_production_completed_ingress_config_and_lanes_cas_account_infos/u,
  );
  assert.match(
    economyRuntimeAdapterSource,
    /pub fn authenticate_runtime_production_active_writable_config/u,
  );
  assert.match(
    economyRuntimeWriteAdapterSource,
    /next_state\.config\.staked_principal = next_staked_principal/u,
  );
  assert.match(economyRuntimeWriteAdapterSource, /completed\.config != expected_config/u);
  assert.match(economyRuntimeWriteAdapterSource, /ActiveConfigCapabilityMismatch/u);
  assert.match(economyRuntimeWriteAdapterSource, /all_mutable_borrows_acquired_before_write: true/u);
  assert.match(economyRuntimeWriteAdapterSource, /all_preimages_revalidated_before_write: true/u);
  assert.match(economyRuntimeWriteAdapterSource, /account_data_writes_supported: true/u);
  assert.match(economyRuntimeWriteAdapterSource, /account_creation_supported: false/u);
  assert.match(economyRuntimeWriteAdapterSource, /system_cpi_supported: false/u);
  assert.match(economyRuntimeWriteAdapterSource, /token_cpi_supported: false/u);
  assert.match(economyRuntimeWriteAdapterSource, /entrypoint_exposed: false/u);
  assert.match(economyRuntimeWriteAdapterSource, /dispatcher_exposed: false/u);
  assert.match(economyRuntimeWriteAdapterSource, /any_handler_complete: false/u);
  assert.match(economyRuntimeWriteAdapterSource, /mainnet_hold: true/u);
  assert.match(economySource, /#\[cfg\(feature = "runtime-account-lifecycle"\)\]\s+pub mod runtime_account_lifecycle;/u);
  assert.match(economyRuntimeAccountLifecycleSource, /execute_create_state_batch_account_infos/u);
  assert.match(
    economyRuntimeAccountLifecycleSource,
    /execute_production_active_create_state_batch_account_infos/u,
  );
  assert.match(
    economyRuntimeAccountLifecycleSource,
    /validate_production_completed_ingress_position_lifecycle_binding/u,
  );
  assert.match(
    economyRuntimeAccountLifecycleSource,
    /execute_production_completed_ingress_position_create_account_infos/u,
  );
  assert.match(
    economyRuntimeAccountLifecycleSource,
    /production_completed_ingress_position_lifecycle_boundary_present: true/u,
  );
  assert.match(economyRuntimeAccountLifecycleSource, /CompletedStakeIngressMismatch/u);
  assert.match(economyRuntimeAccountLifecycleSource, /StrictStateValue::Position\(completed\.position\)/u);
  assert.match(
    economyRuntimeAccountLifecycleSource,
    /production_active_config_capability_required: true/u,
  );
  assert.match(economyRuntimeAccountLifecycleSource, /RuntimeProductionActiveConfig/u);
  assert.match(economyRuntimeAccountLifecycleSource, /ActiveConfigCapabilityMismatch/u);
  assert.match(economyRuntimeAccountLifecycleSource, /all_preconditions_checked_before_first_cpi: true/u);
  assert.match(economyRuntimeAccountLifecycleSource, /canonical_internal_pda_signer_seeds_only: true/u);
  assert.match(economyRuntimeAccountLifecycleSource, /system_create_account_supported: true/u);
  assert.match(economyRuntimeAccountLifecycleSource, /system_fund_allocate_assign_supported: true/u);
  assert.match(economyRuntimeAccountLifecycleSource, /invoke_signed\(/u);
  assert.match(economyRuntimeAccountLifecycleSource, /token_cpi_supported: false/u);
  assert.match(economyRuntimeAccountLifecycleSource, /entrypoint_exposed: false/u);
  assert.match(economyRuntimeAccountLifecycleSource, /dispatcher_exposed: false/u);
  assert.match(economyRuntimeAccountLifecycleSource, /any_handler_complete: false/u);
  assert.match(economyRuntimeAccountLifecycleSource, /mainnet_hold: true/u);
  assert.match(economyRuntimeAdapterSource, /Clock::get\(\)/u);
  assert.match(economyRuntimeAdapterSource, /Rent::get\(\)/u);
  assert.match(
    audit,
    /faction and core-team-cap implementations currently present[\s\S]+JavaScript specifications[\s\S]+default `iat_b3_economy` kernel remains host-only[\s\S]+structural preflight[\s\S]+no production economic entrypoint or public write dispatcher/u,
  );
});

test("the Config Genesis codec is a strict read-only representation, not a phase transition", () => {
  assert.match(economySource, /mod config_genesis_codec;/u);
  for (const declaration of [
    'pub const CONFIG_GENESIS_ACCOUNT_MAGIC: [u8; 8] = *b"IATB3CFG";',
    "pub const CONFIG_GENESIS_ACCOUNT_VERSION: u8 = 1;",
    "pub const CONFIG_GENESIS_ACCOUNT_LEN: usize = 272;",
    '"STRICT_V1_REPRESENTATION_ONLY_PHASE_POLICY_UNRESOLVED_MAINNET_HOLD"',
  ]) {
    assert.ok(economyConfigGenesisCodecSource.includes(declaration), declaration);
  }
  assert.match(economyConfigGenesisCodecSource, /pub enum GenesisPhase/u);
  assert.match(economyConfigGenesisCodecSource, /pub struct ConfigGenesisState/u);
  assert.match(economyConfigGenesisCodecSource, /pub fn encode_config_genesis_state\(/u);
  assert.match(economyConfigGenesisCodecSource, /pub fn decode_config_genesis_state\(/u);
  assert.match(economyConfigGenesisCodecSource, /PhaseActiveMismatch/u);
  assert.match(economyConfigGenesisCodecSource, /NonCanonicalLaneMask/u);
  assert.match(economyConfigGenesisCodecSource, /owner_bootstrap_policy_accepted: false/u);
  assert.match(economyConfigGenesisCodecSource, /phase_transition_predicate_frozen: false/u);
  assert.match(economyConfigGenesisCodecSource, /vacuous_cap_rule_proved: false/u);
  assert.match(economyConfigGenesisCodecSource, /genesis_conservation_proved: false/u);
  assert.match(economyConfigGenesisCodecSource, /transition_authorized: false/u);
  assert.match(economyConfigGenesisCodecSource, /account_writes_executed: false/u);
  assert.match(economyConfigGenesisCodecSource, /any_handler_complete: false/u);
  assert.match(economyConfigGenesisCodecSource, /mainnet_hold: true/u);
  assert.doesNotMatch(
    economyConfigGenesisCodecSource,
    /AccountInfo|entrypoint!|process_instruction|#\[program\]|invoke(?:_signed)?\s*\(|try_borrow_mut/u,
  );

  const parserEntry = functionBody(
    economyRuntimeAdapterSource,
    "parse_config_genesis_account_info",
  );
  assert.match(
    parserEntry,
    /parse_config_genesis_account_info_with_expected_writability\(gate, binding, account, false\)/u,
  );
  const parser = functionBody(
    economyRuntimeAdapterSource,
    "parse_config_genesis_account_info_with_expected_writability",
  );
  assertTokensInOrder(
    parser,
    [
      "gate.mint() != binding.mint()",
      "PdaIdentity::Config",
      "derive_pda(binding, identity)",
      "account.key.to_bytes() != derived.key",
      "account.owner.to_bytes() != binding.program_id()",
      "account.is_writable && !expected_writable",
      "account.executable",
      "account.is_signer",
      "try_borrow_data()",
      "decode_config_genesis_state(&data)",
      "state.config.mint != binding.mint()",
      "state.config.bump != derived.bump",
      "ReadonlyConfigGenesisAccount",
    ],
    "read-only Config Genesis parser",
  );
  assert.doesNotMatch(
    parser,
    /try_borrow_mut|entrypoint!|process_instruction|invoke(?:_signed)?\s*\(|StateWriteIntent/u,
  );
  assert.match(economyRuntimeAdapterSource, /requires_open_daily_law_capability: true/u);
  assert.match(economyRuntimeAdapterSource, /immutable_account_borrow_only: true/u);
  assert.match(economyRuntimeAdapterSource, /binding_relative_config_identity_checked: true/u);
  assert.match(
    economyRuntimeAdapterSource,
    /production_active_config_capability_present: true/u,
  );
  assert.match(economyRuntimeAdapterSource, /pub struct RuntimeProductionActiveConfig/u);
  assert.match(
    economyRuntimeAdapterSource,
    /authenticate_runtime_production_active_config/u,
  );
  assert.match(economyRuntimeAdapterSource, /state\.phase != GenesisPhase::Active/u);
  assert.match(economyRuntimeAdapterSource, /state\.config\.rehearsal_mode/u);
  assert.match(economyRuntimeAdapterSource, /production_identity_binding_frozen: false/u);
  assert.match(economyRuntimeAdapterSource, /phase_transition_predicate_frozen: false/u);
  assert.match(economyRuntimeAdapterSource, /genesis_conservation_proved: false/u);
  assert.match(economyRuntimeAdapterSource, /transition_authorized: false/u);
  assert.match(economyRuntimeAdapterSource, /any_handler_complete: false/u);
  assert.match(economyRuntimeAdapterSource, /mainnet_hold: true/u);
});

test("the Config Genesis candidate is non-circular but never self-authorizes policy", () => {
  assert.match(economySource, /mod config_genesis_transition;/u);
  assert.match(economyConfigGenesisTransitionSource, /prepare_enter_genesis_staging_candidate/u);
  assert.match(economyConfigGenesisTransitionSource, /prepare_config_genesis_activation_plan/u);
  assert.doesNotMatch(economyConfigGenesisTransitionSource, /prepare_activate_genesis_candidate/u);
  assert.match(economyConfigGenesisTransitionSource, /staging_daily_law_not_required: true/u);
  assert.match(economyConfigGenesisTransitionSource, /activation_requires_open_daily_law: true/u);
  assert.match(
    economyConfigGenesisTransitionSource,
    /activation_requires_conservation_receipt: true/u,
  );
  assert.match(
    economyConfigGenesisTransitionSource,
    /activation_requires_zero_preactivation_economic_state: true/u,
  );
  assert.match(
    economyConfigGenesisTransitionSource,
    /activation_binds_complete_readset: true/u,
  );
  assert.match(
    economyConfigGenesisTransitionSource,
    /activation_binds_retained_five_account_poststate: true/u,
  );
  assert.match(economyConfigGenesisTransitionSource, /CONFIG_GENESIS_ACTIVATION_READSET_DOMAIN/u);
  assert.match(
    economyConfigGenesisTransitionSource,
    /CONFIG_GENESIS_ACTIVATION_POSTSTATES_DOMAIN/u,
  );
  assert.match(economyConfigGenesisTransitionSource, /input\.config_key != expected_config_key/u);
  assert.match(economyConfigGenesisTransitionSource, /input\.mint\.key != current\.config\.mint/u);
  assert.match(economyConfigGenesisTransitionSource, /require_activation_lane_bindings/u);
  assert.match(economyConfigGenesisTransitionSource, /require_vacuous_activation_input/u);
  assert.match(economyConfigGenesisTransitionSource, /matches_exact_retained_result/u);
  assert.doesNotMatch(
    economyConfigGenesisTransitionSource,
    /pub const fn (?:config|treasury|ecosystem|liquidity|core_reward)\(&self\)/u,
  );
  assert.match(economyConfigGenesisTransitionSource, /owner_bootstrap_policy_accepted: false/u);
  assert.match(
    economyConfigGenesisTransitionSource,
    /preactivation_facts_runtime_authenticated: false/u,
  );
  assert.match(economyConfigGenesisTransitionSource, /production_identity_binding_frozen: false/u);
  assert.match(economyConfigGenesisTransitionSource, /transition_authorized: false/u);
  assert.match(economyConfigGenesisTransitionSource, /account_writes_executed: false/u);
  assert.match(economyConfigGenesisTransitionSource, /entrypoint_exposed: false/u);
  assert.match(economyConfigGenesisTransitionSource, /dispatcher_exposed: false/u);
  assert.match(economyConfigGenesisTransitionSource, /mainnet_hold: true/u);
  assert.doesNotMatch(
    economyConfigGenesisTransitionSource,
    /AccountInfo|try_borrow_mut|entrypoint!|process_instruction|invoke(?:_signed)?\s*\(/u,
  );
});

test("Config Genesis runtime composition authenticates current state without inventing history", () => {
  assert.match(
    economySource,
    /#\[cfg\(feature = "runtime-account-bridge"\)\]\s+pub mod config_genesis_transition_runtime;/u,
  );
  assert.match(economyRuntimeAdapterSource, /pub struct RuntimeValidatedDailyLawWrite/u);
  assert.match(
    economyRuntimeAdapterSource,
    /verify_runtime_daily_law_open_account_info/u,
  );
  assert.match(
    economyRuntimeAdapterSource,
    /parse_config_genesis_account_info_with_runtime_law/u,
  );
  assert.match(
    economyGenesisConservationRuntimeSource,
    /pub struct AuthenticatedGenesisConservationReceipt/u,
  );
  assert.match(
    economyConfigGenesisTransitionRuntimeSource,
    /prepare_runtime_authenticated_activate_genesis_prerequisites/u,
  );
  assert.match(
    economyConfigGenesisTransitionRuntimeSource,
    /prepare_runtime_authenticated_config_genesis_activation_plan/u,
  );
  assert.match(
    economyConfigGenesisTransitionRuntimeSource,
    /CONFIG_GENESIS_RUNTIME_ACTIVATION_READSET_DOMAIN/u,
  );
  assert.match(
    economyConfigGenesisTransitionRuntimeSource,
    /runtime_activation_readset_sha256/u,
  );
  assert.match(
    economyGenesisConservationRuntimeSource,
    /GENESIS_CONSERVATION_RUNTIME_ACCOUNT_SET_DOMAIN/u,
  );
  assert.match(economyGenesisConservationRuntimeSource, /account_set_sha256/u);
  assert.match(economyGenesisConservationRuntimeSource, /GENESIS_ACTIVATE_LANE_WRITABILITY/u);
  assert.match(
    economyGenesisConservationRuntimeSource,
    /AuthenticatedGenesisLaneCapability/u,
  );
  assert.match(economyNativeAdapterSource, /AuthenticatedReadonlyStateAccount/u);
  assert.match(economyNativeAdapterSource, /authenticate_readonly_state_account/u);
  assert.match(economyNativeAdapterSource, /AccountMustBeReadonly/u);
  assert.match(
    economyConfigGenesisTransitionRuntimeSource,
    /runtime_daily_law_account_authenticated: true/u,
  );
  assert.match(
    economyConfigGenesisTransitionRuntimeSource,
    /runtime_config_pda_authenticated: true/u,
  );
  assert.match(
    economyConfigGenesisTransitionRuntimeSource,
    /runtime_genesis_balances_and_lanes_authenticated: true/u,
  );
  assert.match(
    economyConfigGenesisTransitionRuntimeSource,
    /current_preactivation_economic_state_authenticated: true/u,
  );
  assert.match(
    economyConfigGenesisTransitionRuntimeSource,
    /conservation_account_set_cross_bound_to_activation_readset: true/u,
  );
  assert.match(
    economyConfigGenesisTransitionRuntimeSource,
    /complete_activation_readset_authenticated: true/u,
  );
  assert.match(
    economyConfigGenesisTransitionRuntimeSource,
    /exact_retained_activate_lane_writability_authenticated: true/u,
  );
  assert.match(
    economyConfigGenesisTransitionRuntimeSource,
    /stake_vault_observation_authenticated: true/u,
  );
  assert.match(
    economyConfigGenesisTransitionRuntimeSource,
    /core_reward_vacant_or_prefunded_target_authenticated: true/u,
  );
  assert.match(
    economyConfigGenesisTransitionRuntimeSource,
    /stake_vault_and_core_reward_lifecycle_authenticated: false/u,
  );
  assert.match(
    economyConfigGenesisTransitionRuntimeSource,
    /complete_preactivation_write_history_authenticated: false/u,
  );
  assert.match(
    economyConfigGenesisTransitionRuntimeSource,
    /owner_bootstrap_policy_accepted: false/u,
  );
  assert.match(
    economyConfigGenesisTransitionRuntimeSource,
    /production_identity_binding_frozen: false/u,
  );
  assert.match(economyConfigGenesisTransitionRuntimeSource, /transition_authorized: false/u);
  assert.match(economyConfigGenesisTransitionRuntimeSource, /account_writes_executed: false/u);
  assert.match(economyConfigGenesisTransitionRuntimeSource, /mainnet_hold: true/u);
  assert.doesNotMatch(
    economyConfigGenesisTransitionRuntimeSource,
    /try_borrow_mut|entrypoint!|process_instruction|invoke(?:_signed)?\s*\(/u,
  );
});

test("the Genesis conservation kernel proves exact arithmetic without accepting owner or chain evidence", () => {
  assert.match(economySource, /mod genesis_conservation;/u);
  assert.match(economyGenesisConservationSource, /pub const GENESIS_ALLOCATION_COUNT: usize = 5;/u);
  assert.match(economyGenesisConservationSource, /500_000_000_000_000_000/u);
  assert.match(economyGenesisConservationSource, /200_000_000_000_000_000/u);
  assert.match(economyGenesisConservationSource, /150_000_000_000_000_000/u);
  assert.match(economyGenesisConservationSource, /100_000_000_000_000_000/u);
  assert.match(economyGenesisConservationSource, /50_000_000_000_000_000/u);
  assert.match(economyGenesisConservationSource, /verify_genesis_allocation_conservation/u);
  assert.match(economyGenesisConservationSource, /DuplicateDestinationAccount/u);
  assert.match(economyGenesisConservationSource, /DuplicateBeneficiary/u);
  assert.match(economyGenesisConservationSource, /UnsafeTokenAccountState/u);
  assert.match(economyGenesisConservationSource, /owner_destination_manifest_accepted: false/u);
  assert.match(economyGenesisConservationSource, /production_identity_binding_frozen: false/u);
  assert.match(economyGenesisConservationSource, /runtime_account_authentication_present: false/u);
  assert.match(economyGenesisConservationSource, /migration_or_no_prior_supply_proved: false/u);
  assert.match(economyGenesisConservationSource, /transition_authorized: false/u);
  assert.match(economyGenesisConservationSource, /mainnet_hold: true/u);
  assert.doesNotMatch(
    economyGenesisConservationSource,
    /AccountInfo|entrypoint!|process_instruction|invoke(?:_signed)?\s*\(|try_borrow_mut/u,
  );
});

test("Genesis runtime conservation requires opaque Token-2022 and Lane capabilities without activating", () => {
  assert.match(
    economySource,
    /#\[cfg\(feature = "runtime-account-bridge"\)\]\s+pub mod genesis_conservation_runtime;/u,
  );
  assert.match(economyGenesisConservationRuntimeSource, /ReadonlyCanonicalEconomyMint/u);
  assert.match(economyGenesisConservationRuntimeSource, /ReadonlyPublicTokenAccount/u);
  assert.match(economyGenesisConservationRuntimeSource, /AuthenticatedGenesisLaneCapability/u);
  assert.match(economyGenesisConservationRuntimeSource, /GENESIS_ACTIVATE_LANE_WRITABILITY/u);
  assert.match(
    economyGenesisConservationRuntimeSource,
    /exact_retained_activate_lane_writability_authenticated: true/u,
  );
  assert.match(economyGenesisConservationRuntimeSource, /verify_authenticated_genesis_conservation/u);
  assert.match(economyGenesisConservationRuntimeSource, /PdaIdentity::VaultAuthority/u);
  assert.match(economyGenesisConservationRuntimeSource, /PdaIdentity::LaneState/u);
  assert.match(economyGenesisConservationRuntimeSource, /lane\.reserved != 0/u);
  assert.match(economyGenesisConservationRuntimeSource, /lane\.paid != 0/u);
  assert.match(economyGenesisConservationRuntimeSource, /lane\.principal_claimed != 0/u);
  assert.match(economyGenesisConservationRuntimeSource, /owner_destination_manifest_accepted: false/u);
  assert.match(economyGenesisConservationRuntimeSource, /production_identity_binding_frozen: false/u);
  assert.match(economyGenesisConservationRuntimeSource, /migration_or_no_prior_supply_proved: false/u);
  assert.match(economyGenesisConservationRuntimeSource, /phase_transition_authorized: false/u);
  assert.match(economyGenesisConservationRuntimeSource, /account_writes_executed: false/u);
  assert.match(economyGenesisConservationRuntimeSource, /entrypoint_exposed: false/u);
  assert.match(economyGenesisConservationRuntimeSource, /dispatcher_exposed: false/u);
  assert.match(economyGenesisConservationRuntimeSource, /mainnet_hold: true/u);
  assert.doesNotMatch(
    economyGenesisConservationRuntimeSource,
    /try_borrow_mut|entrypoint!|process_instruction|invoke(?:_signed)?\s*\(/u,
  );
});

test("current V2 has no hidden Daily Law dependency and still targets legacy SPL Token", () => {
  const handlers = anchorProgramBody(v2Source);
  assert.doesNotMatch(handlers, /iat_b3|law[_ -]?state|DailyLaw|daily[_ -]?law/iu);
  assert.doesNotMatch(v2Cargo, /iat-b3-(?:law|consensus)/u);
  assert.match(v2Source, /anchor_spl::token::\{self, Mint, Token, TokenAccount, TransferChecked\}/u);
  assert.match(v2Source, /Program<'info, Token>/u);
  assert.match(audit, /legacy SPL Token program rather\s+than the canonical B3 Token-2022 mint/u);
});

test("native adapter keeps exactly two own writes and one canonical transfer gate", () => {
  const dispatcher = functionBody(lawSource, "process_instruction");
  assert.match(dispatcher, /INITIALIZE_LAW_OPCODE/u);
  assert.match(dispatcher, /FINALIZE_DAY_OPCODE/u);
  assert.match(dispatcher, /process_execute\(program_id, accounts, amount\)/u);

  const initialize = functionBody(lawSource, "process_initialize_law");
  assert.match(lawSource, /INITIALIZE_LAW_ACCOUNT_COUNT: usize = 6/u);
  assert.match(initialize, /require_exact_account_count\(accounts\.len\(\), INITIALIZE_LAW_ACCOUNT_COUNT\)\?/u);
  assert.match(initialize, /LawState::uninitialized/u);
  assert.match(initialize, /ExtraAccountMetaList::init::<ExecuteInstruction>/u);

  const finalize = functionBody(lawSource, "process_finalize_day");
  assert.match(lawSource, /FINALIZE_DAY_ACCOUNT_COUNT: usize = 2/u);
  assert.match(finalize, /require_exact_account_count\(accounts\.len\(\), FINALIZE_DAY_ACCOUNT_COUNT\)\?/u);
  assert.match(finalize, /Clock::get\(\)/u);
  assert.match(finalize, /PodSlotHashes::fetch\(\)/u);
  assert.match(finalize, /ensure_day_can_finalize/u);
  assert.match(finalize, /create_solana_daily_decision/u);

  const execute = functionBody(lawSource, "process_execute");
  assert.match(lawSource, /TRANSFER_HOOK_EXECUTE_ACCOUNT_COUNT: usize = 6/u);
  assert.match(execute, /require_exact_account_count\(accounts\.len\(\), TRANSFER_HOOK_EXECUTE_ACCOUNT_COUNT\)\?/u);
  assert.match(execute, /validate_law_state_account/u);
  assert.match(execute, /validate_transfer_context/u);
  assert.match(execute, /state\.transfer_disposition_at\(clock\.unix_timestamp\)/u);
  assert.match(execute, /IatTransferDisposition::DayUnfinalized/u);
  assert.match(execute, /IatTransferDisposition::RejectedDailyLockdown/u);
});

test("production combined-hook build stays identity-gated and fail-closed", () => {
  const binding = structBody(stakeIngressSource, "StakeIngressBinding");
  assertTokensInOrder(
    binding,
    [
      "config_bump",
      "stake_vault_bump",
      "ingress_authority_bump",
      "economy_program_id",
      "mint",
      "config",
      "stake_vault",
      "ingress_authority",
    ],
    "stake-ingress binding codec",
  );

  const derive = functionBody(stakeIngressSource, "derive");
  assertTokensInOrder(
    derive,
    [
      "economy_program_id == Pubkey::default()",
      "mint == Pubkey::default()",
      "ECONOMY_CONFIG_SEED",
      "ECONOMY_STAKE_TOKEN_SEED",
      "ECONOMY_STAKE_INGRESS_AUTHORITY_SEED",
    ],
    "stake-ingress canonical derivation",
  );

  const enforce = functionBody(stakeIngressSource, "enforce_stake_ingress");
  assertTokensInOrder(
    enforce,
    [
      "binding.validate()?",
      "enforce_frozen_stake_ingress(",
      "&binding.mint",
      "&binding.stake_vault",
      "&binding.ingress_authority",
    ],
    "reference-to-executable admission delegation",
  );
  const frozenEnforce = functionBody(stakeIngressSource, "enforce_frozen_stake_ingress");
  assertTokensInOrder(
    frozenEnforce,
    [
      "canonical_mint == &Pubkey::default()",
      "stake_vault == &Pubkey::default()",
      "ingress_authority == &Pubkey::default()",
      "mint != canonical_mint",
      "destination != stake_vault",
      "authority != ingress_authority",
      "UnauthorizedStakeIngress",
    ],
    "build-frozen stake-ingress admission rule",
  );
  assert.doesNotMatch(
    `${enforce}\n${frozenEnforce}`,
    /authority_is_signer|\.is_signer|Clock|oracle|admin|sweep|update|disposition/iu,
  );

  assert.match(lawCargo, /production-combined-hook = \[\]/u);
  assert.match(
    lawSource,
    /#\[cfg\(feature = "production-combined-hook"\)\]\s+#\[allow\(dead_code\)\]\s+mod stake_ingress;/u,
  );
  assert.doesNotMatch(lawSource, /pub mod stake_ingress;/u);
  assert.match(
    functionBody(lawSource, "process_instruction"),
    /require_compiled_law_program\(program_id\)\?/u,
  );
  for (const handler of ["process_initialize_law", "process_finalize_day", "process_execute"]) {
    assert.match(
      functionBody(lawSource, handler),
      /require_compiled_canonical_mint\(mint\.key\)\?/u,
      `${handler} must bind the build-frozen mint`,
    );
  }
  assertTokensInOrder(
    functionBody(lawSource, "process_execute"),
    [
      "state.transfer_disposition_at(clock.unix_timestamp)?",
      "IatTransferDisposition::Allowed",
      "enforce_compiled_stake_ingress(mint.key, destination.key, authority.key)",
    ],
    "Daily Law before compiled stake-ingress admission",
  );
  const compiledEnforcement = functionBody(lawSource, "enforce_compiled_stake_ingress");
  assertTokensInOrder(
    compiledEnforcement,
    [
      "CANONICAL_MINT_BYTES",
      "STAKE_VAULT_BYTES",
      "INGRESS_AUTHORITY_BYTES",
      "enforce_frozen_stake_ingress",
    ],
    "build-frozen stake-ingress enforcement",
  );
  assert.doesNotMatch(compiledEnforcement, /Clock|is_signer|try_borrow|invoke/u);
  for (const identity of [
    "IAT_B3_PRODUCTION_LAW_PROGRAM_ID",
    "IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID",
    "IAT_B3_PRODUCTION_CANONICAL_MINT",
  ]) {
    assert.match(lawBuildSource, new RegExp(identity, "u"));
  }
  assert.match(
    lawBuildSource,
    /CARGO_FEATURE_PRODUCTION_COMBINED_HOOK[\s\S]+required_pubkey[\s\S]+find_program_address/u,
  );
  assert.match(lawBuildSource, /ECONOMY_STAKE_TOKEN_SEED/u);
  assert.match(lawBuildSource, /ECONOMY_STAKE_INGRESS_AUTHORITY_SEED/u);
  assert.doesNotMatch(lawBuildSource, /mainnetExecutionAuthorized|sendTransaction|RpcClient/u);
  assert.match(economySource, /pub mod stake_ingress;/u);
  const combined = functionBody(
    economyStakeIngressSource,
    "prepare_open_position_stake_ingress",
  );
  assertTokensInOrder(
    combined,
    [
      "prepare_open_position(gate, open_position)",
      "map_err(StakeIngressSpecError::RetainedV2)",
      "prepare_stake_ingress(gate, open_position, ingress)",
    ],
    "combined Daily-Law/V2/stake-ingress boundary",
  );
  assert.doesNotMatch(
    economyStakeIngressSource,
    /entrypoint!|process_instruction|#\[program\]|invoke(?:_signed)?\s*\(|AccountInfo/u,
  );
  assert.match(
    economySource,
    /#\[cfg\(feature = "runtime-token-2022-stake-ingress"\)\]\s+pub mod stake_ingress_runtime;/u,
  );
  assert.match(
    economyCargo,
    /runtime-production-open-position = \[[\s\S]+"runtime-account-lifecycle"[\s\S]+"runtime-token-2022-stake-ingress"[\s\S]+\]/u,
  );
  assert.match(economyStakeIngressRuntimeSource, /pub fn execute_prepared_stake_ingress/u);
  assert.match(economyStakeIngressRuntimeSource, /add_extra_accounts_for_execute_cpi\(/u);
  assert.match(economyStakeIngressRuntimeSource, /invoke_signed\(/u);
  assert.match(
    economyStakeIngressRuntimeSource,
    /transfer_infos[\s\S]+law_state_address[\s\S]+HookLawAccountUnresolved/u,
  );
  assert.match(
    economyStakeIngressRuntimeSource,
    /retained_v2_post_cpi_persistence_complete: false/u,
  );
  assert.match(economyStakeIngressRuntimeSource, /daily_law_capability_reauthenticated: true/u);
  assert.match(
    economyStakeIngressRuntimeSource,
    /retained_v2_post_cpi_finalizer_executed: true/u,
  );
  assert.match(
    economyStakeIngressRuntimeSource,
    /persistence_callback_after_restoration: true/u,
  );
  assert.match(
    economyStakeIngressRuntimeSource,
    /production_active_config_capability_required: true/u,
  );
  assert.match(
    economyStakeIngressRuntimeSource,
    /pub fn execute_daily_law_authenticated_stake_ingress/u,
  );
  assert.match(
    economyStakeIngressRuntimeSource,
    /pub fn execute_production_active_daily_law_authenticated_stake_ingress/u,
  );
  assert.match(
    economyStakeIngressRuntimeSource,
    /pub fn execute_production_open_position_and_persist/u,
  );
  const productionOpenPosition = functionBody(
    economyStakeIngressRuntimeSource,
    "execute_production_open_position_and_persist",
  );
  assertTokensInOrder(
    productionOpenPosition,
    [
      "authenticate_daily_law(",
      "require_production_active_context(",
      "authenticate_canonical_economy_mint_account_info(",
      "canonical_mint.supply() != MAINNET_SUPPLY",
      "execute_daily_law_authenticated_stake_ingress_with_gate_callback(",
      "execute_production_completed_ingress_position_create_account_infos(",
      "execute_production_completed_ingress_config_and_lanes_cas_account_infos(",
    ],
    "production open-position composition",
  );
  assert.match(economyStakeIngressRuntimeSource, /same_artifact_daily_law_and_stake_ingress: true/u);
  assert.match(economyStakeIngressRuntimeSource, /completed_ingress_position_lifecycle_executed: true/u);
  assert.match(economyStakeIngressRuntimeSource, /completed_ingress_config_and_lanes_cas_executed: true/u);
  assert.match(economyStakeIngressRuntimeSource, /callback_failure_requires_transaction_rollback: true/u);
  assert.match(economyStakeIngressRuntimeSource, /any_handler_complete: false/u);
  assert.match(economyStakeIngressRuntimeSource, /RuntimeProductionActiveConfig/u);
  assert.match(economyStakeIngressRuntimeSource, /ActiveConfigCapabilityMismatch/u);
  assert.match(economyStakeIngressRuntimeSource, /fn authenticate_daily_law/u);
  assert.match(economyStakeIngressRuntimeSource, /fn bind_stake_ingress_accounts/u);
  assert.match(economyStakeIngressRuntimeSource, /Box<PrepareOpenPositionInput>/u);
  assert.match(economyStakeIngressRuntimeSource, /Box<StakeIngressExecutionPlan>/u);
  assert.match(economyStakeIngressRuntimeSource, /canonical_mint_policy_reauthenticated: false/u);
  assert.match(economyStakeIngressRuntimeSource, /public_entrypoint_exposed: false/u);
  assert.doesNotMatch(
    economyStakeIngressRuntimeSource,
    /entrypoint!|process_instruction|#\[program\]|RpcClient|send_and_confirm/u,
  );
  const lawState = structBody(lawSource, "LawState");
  assert.doesNotMatch(lawState, /stake|economy|ingress/iu);
  assert.match(lawSource, /pub const LAW_STATE_LEN: usize = 160;/u);
  const initialize = functionBody(lawSource, "process_initialize_law");
  assert.match(initialize, /ExtraAccountMetaList::size_of\(1\)/u);
  assert.match(
    initialize,
    /ExtraAccountMetaList::init::<ExecuteInstruction>[\s\S]+&\[extra_meta\]/u,
  );
  assert.match(audit, /production-combined-hook[\s\S]+identit(?:y|ies)[\s\S]+process_execute/u);
  assert.match(
    lawAdapter,
    /identities remain unfrozen[\s\S]+no approved production[\s\S]+no committed production[\s\S]+unpublished/u,
  );
  assert.match(
    lawAdapter,
    /does not yet\s+claim active donation protection/u,
  );
  assert.match(
    lawAdapter,
    /adds no instruction opcode, account meta, binding account[\s\S]+no such path\s+exists/u,
  );
  assert.match(
    lawAdapter,
    /2\.1\.0[\s\S]+authority meta[\s\S]+not a signer[\s\S]+must not test\s+`authority\.is_signer`/u,
  );
  assert.match(
    lawAdapter,
    /derives[\s\S]+stake-vault[\s\S]+ingress-\s*authority PDAs at build time[\s\S]+must\s+freeze[\s\S]+No design may add an account to every\s+transfer/u,
  );
  assert.match(
    lawAdapter,
    /source file[\s\S]+src\/stake_ingress\.rs[\s\S]+production-combined-hook[\s\S]+feature-disabled/u,
  );
});

test("all fifteen production codecs are frozen without a dispatcher or entrypoint", () => {
  assert.match(economySource, /pub mod production_instruction;/u);
  assert.match(economyProductionInstructionSource, /PRODUCTION_INSTRUCTION_NAMESPACE: &\[u8; 8\] = b"IATB3EC1"/u);
  assert.match(economyProductionInstructionSource, /OPEN_POSITION_OPCODE: u8 = 6/u);
  assert.match(economyProductionInstructionSource, /PRODUCTION_INSTRUCTION_LEN: usize = 32/u);
  assert.match(economyProductionInstructionSource, /PRODUCTION_INSTRUCTION_COUNT: usize = 15/u);
  assert.match(economyProductionInstructionSource, /all_15_instruction_abi_frozen: true/u);
  assert.match(economyProductionInstructionSource, /production_dispatcher_exposed: false/u);
  assert.match(economyProductionInstructionSource, /production_entrypoint_exposed: false/u);
  assert.match(economyProductionInstructionSource, /mainnet_hold: true/u);
  assert.doesNotMatch(
    economyProductionInstructionSource,
    /AccountInfo|process_instruction|entrypoint!|invoke(?:_signed)?\s*\(|try_borrow_mut|RpcClient/u,
  );
});

test("production ABI routing requires the composed capability and stays nonexecuting", () => {
  assert.match(
    economySource,
    /#\[cfg\(feature = "runtime-account-bridge"\)\]\s+pub mod production_dispatch;/u,
  );
  assert.match(economyProductionDispatchSource, /all_15_instruction_routes_frozen: true/u);
  assert.match(economyProductionDispatchSource, /opaque_daily_law_capability_required: true/u);
  assert.match(economyProductionDispatchSource, /canonical_mint_capability_required: true/u);
  assert.match(economyProductionDispatchSource, /account_identity_graph_complete: false/u);
  assert.match(economyProductionDispatchSource, /handler_dispatch_exposed: false/u);
  assert.match(economyProductionDispatchSource, /entrypoint_exposed: false/u);
  assert.match(economyProductionDispatchSource, /mainnet_hold: true/u);
  const prepare = functionBody(
    economyProductionDispatchSource,
    "prepare_production_dispatch_preflight",
  );
  assertTokensInOrder(
    prepare,
    [
      "decode_production_instruction(instruction_data)",
      "operation_for_instruction(instruction)",
      "capabilities.descriptor(operation)",
      "validate_account_meta_shape(descriptor.accounts, accounts)",
    ],
    "production instruction-to-account-graph route",
  );
  assert.doesNotMatch(
    economyProductionDispatchSource,
    /try_borrow(?:_mut)?_(?:data|lamports)|invoke(?:_signed)?\s*\(|process_instruction|entrypoint!|RpcClient|send_and_confirm/u,
  );
});

test("ledger-only V2 writes cannot be mistaken for transfer-hook coverage", () => {
  for (const handler of [
    "set_eligibility",
    "close_position",
    "commit_round",
    "settle_round",
    "expire_round",
  ]) {
    const body = functionBody(anchorProgramBody(v2Source), handler);
    assert.doesNotMatch(body, /transfer_checked|transfer_from_vault|transfer_reward_splits/u);
    assert.doesNotMatch(body, /iat_b3|law[_ -]?state|DailyLaw|daily[_ -]?law/iu);
  }
});

test("the host-only close_position port preserves the V2 validation boundary", () => {
  const v2Close = functionBody(anchorProgramBody(v2Source), "close_position");
  const economyClose = functionBody(economySource, "close_position");
  const economyTransition = functionBody(economySource, "close_position_transition");

  for (const token of [
    "config.active",
    "position.closed",
    "position.principal_returned",
    "position.settled_mask",
    "release_three_reservations",
    "position.closed = true",
  ]) {
    assert.ok(v2Close.includes(token), `V2 close_position drifted: ${token}`);
  }
  assert.match(economyClose, /_gate: &ValidatedDailyLawWrite/u);
  assert.match(economyClose, /close_position_transition/u);
  assert.match(economyTransition, /EconomyError::NotActive/u);
  assert.match(economyTransition, /EconomyError::PositionClosed/u);
  assert.match(economyTransition, /EconomyError::PrincipalNotReturned/u);
  assert.match(economyTransition, /EconomyError::PositionWeeksOutstanding/u);
  assert.match(economyTransition, /EconomyError::WrongLaneOrder/u);
  assert.match(economyTransition, /release_reserved_lane/u);
  const v2Accounts = structBody(v2Source, "ClosePosition");
  assert.doesNotMatch(v2Accounts, /\bclose\s*=/u);
  assert.doesNotMatch(v2Close, /close_position_account|\.close\s*\(/u);
  assert.match(
    audit,
    /`close_position` the\s+second,/u,
  );
  assert.match(
    audit,
    /retains the position PDA\s+permanently[\s\S]+position ID nonreusable[\s\S]+never claim a `close_position_account` mutation/u,
  );
});

test("the host-only settle_round port preserves V2 validation and mutation order", () => {
  const v2Settle = functionBody(anchorProgramBody(v2Source), "settle_round");
  const economySettle = functionBody(economySource, "settle_round");
  const economyTransition = functionBody(economySource, "settle_pending_round");

  assertTokensInOrder(
    v2Settle,
    [
      "CCC_DLC_GENESIS_ENABLED",
      "RANDOMNESS_ADAPTER_VERIFIED",
      "config.active",
      "round.status",
      "randomness_account.owner",
      "ccc_round_recovery_available",
      "parse_randomness",
      "validated_reveal",
      "uniform_tiebreak_outcome",
      "round.randomness = revealed",
      "round.selected_agency_index = outcome.index",
      "round.derivation_counter = outcome.derivation_counter",
      "round.status = ROUND_SETTLED",
    ],
    "V2 settle_round",
  );
  assert.match(economySettle, /gate: &ValidatedDailyLawWrite/u);
  assertTokensInOrder(
    economySettle,
    [
      "CCC_DLC_GENESIS_ENABLED",
      "RANDOMNESS_ADAPTER_VERIFIED",
      "settle_pending_round",
    ],
    "B3 settle_round wrapper",
  );
  assertTokensInOrder(
    economyTransition,
    [
      "!config_active",
      "round.status",
      "randomness_account.owner",
      "checked_add",
      "clock_unix_timestamp >= recovery_timestamp",
      "parse_round_randomness",
      "randomness.reveal_slot != clock_slot",
      "randomness.seed_slot != round.commit_slot",
      "randomness.reveal_slot <= randomness.seed_slot",
      "uniform_tiebreak_outcome",
      "round.randomness = randomness.value",
      "round.selected_agency_index = outcome.index",
      "round.derivation_counter = outcome.derivation_counter",
      "round.status = ROUND_SETTLED",
    ],
    "B3 settle_round transition",
  );
  assert.match(economyCargo, /sha2 = \{ version = "=0\.10\.9", default-features = false \}/u);
  assert.match(
    audit,
    /and `settle_round` the third\./u,
  );
});

test("the host-only commit_round port preserves adjacent proof and snapshot order", () => {
  const v2Commit = functionBody(anchorProgramBody(v2Source), "commit_round");
  const economyCommit = functionBody(economySource, "commit_round");
  const economyTransition = functionBody(economySource, "commit_round_transition");
  const adjacentProof = functionBody(economySource, "immediately_preceding_instruction");
  const commitProof = functionBody(economySource, "validate_round_commit_instruction");

  assertTokensInOrder(
    v2Commit,
    [
      "CCC_DLC_GENESIS_ENABLED",
      "RANDOMNESS_ADAPTER_VERIFIED",
      "config.active",
      "config.agency_count > 0",
      "ccc_round_for",
      "randomness_account.owner",
      "load_current_index_checked",
      "current_instruction_index > 0",
      "load_instruction_at_checked",
      "validate_commit_instruction",
      "Clock::get",
      "parse_randomness",
      "is_fresh_unrevealed_commit",
      "round.config =",
      "round.week =",
      "round.agency_count_snapshot =",
      "round.agency_registry_hash_snapshot =",
      "round.decision_context =",
      "round.randomness_account =",
      "round.commit_slot =",
      "round.commit_timestamp =",
      "round.randomness = [0; 32]",
      "round.selected_agency_index = u32::MAX",
      "round.derivation_counter = u32::MAX",
      "round.status = ROUND_PENDING",
      "round.bump = ctx.bumps.round",
    ],
    "V2 commit_round",
  );
  assert.match(economyCommit, /gate: &ValidatedDailyLawWrite/u);
  assertTokensInOrder(
    economyCommit,
    [
      "CCC_DLC_GENESIS_ENABLED",
      "RANDOMNESS_ADAPTER_VERIFIED",
      "commit_round_transition",
    ],
    "B3 commit_round wrapper",
  );
  assertTokensInOrder(
    economyTransition,
    [
      "!input.config.active",
      "input.config.agency_count == 0",
      "current_ccc_round",
      "input.week != expected_week",
      "input.randomness_account.owner",
      "immediately_preceding_instruction",
      "validate_round_commit_instruction",
      "parse_round_randomness",
      "input.clock_slot.checked_sub(1)",
      "randomness.reveal_slot == input.clock_slot",
      "ccc_tiebreak_context",
      "round: RoundState",
      "config: input.config.key",
      "randomness_account: input.randomness_account_key",
      "week: input.week",
      "commit_slot: randomness.seed_slot",
      "commit_timestamp: clock_unix_timestamp",
      "randomness: [0; 32]",
      "selected_agency_index: NO_SELECTED_AGENCY",
      "derivation_counter: NO_DERIVATION_COUNTER",
      "status: ROUND_PENDING",
      "bump: input.round_bump",
    ],
    "B3 commit_round transition",
  );
  assertTokensInOrder(
    adjacentProof,
    [
      "current_instruction_index",
      "current_index == 0",
      "current_index >= trace.instructions.len()",
      "get(current_index - 1)",
    ],
    "B3 adjacent instruction proof",
  );
  assertTokensInOrder(
    commitProof,
    [
      "instruction.program_id != randomness_program",
      "RANDOMNESS_COMMIT_DISCRIMINATOR.len()",
      "instruction.accounts.len() < 5",
      "instruction.accounts[0]",
      "randomness_meta.key != randomness_account",
      "!randomness_meta.is_writable",
      "instruction.accounts[4]",
      "authority_meta.key != authority",
      "!authority_meta.is_signer",
    ],
    "B3 Switchboard commit proof",
  );
  assert.match(
    audit,
    /`commit_round` is the fourth and only additional\s+handler-body kernel/u,
  );
});

test("the retained Round bump is stored once and preserved by terminal transitions", () => {
  const roundState = structBody(economySource, "RoundState");
  const commitResult = structBody(economySource, "CommitRoundResult");
  const settleTransition = functionBody(economySource, "settle_pending_round");
  const expireTransition = functionBody(economySource, "expire_pending_round");

  assertTokensInOrder(
    roundState,
    ["pub status: u8", "pub bump: u8"],
    "B3 RoundState terminal fields",
  );
  assert.match(commitResult, /pub round: RoundState/u);
  assert.doesNotMatch(commitResult, /round_bump/u);
  assert.doesNotMatch(settleTransition, /round\.bump\s*=/u);
  assert.doesNotMatch(expireTransition, /round\.bump\s*=/u);
});

test("the initialize_config kernel preserves V2 validation and initial state construction", () => {
  const v2Initialize = functionBody(anchorProgramBody(v2Source), "initialize_config");
  const economyInitialize = functionBody(economySource, "initialize_config");
  const economyTransition = functionBody(
    economySource,
    "initialize_config_transition",
  );

  assertTokensInOrder(
    v2Initialize,
    [
      "ctx.accounts.admin.key()",
      "PROGRAM_ADMIN",
      "ctx.accounts.mint.decimals",
      "TOKEN_DECIMALS",
      "let expected_randomness_program",
      "randomness_program,",
      "expected_randomness_program",
      "let now = Clock::get",
      "if rehearsal_mode",
      "rehearsal_genesis_timestamp.ok_or",
      "rehearsal_genesis_timestamp.is_none()",
      "genesis_timestamp <= now",
      "config.admin = PROGRAM_ADMIN",
      "config.mint = ctx.accounts.mint.key()",
      "config.token_program = ctx.accounts.token_program.key()",
      "config.randomness_program = randomness_program",
      "config.genesis_timestamp = genesis_timestamp",
      "config.expected_supply = if rehearsal_mode",
      "config.rehearsal_mode = rehearsal_mode",
      "config.active = false",
      "config.lane_mask = 0",
      "config.stake_vault_initialized = false",
      "config.stake_token_account = Pubkey::default()",
      "config.staked_principal = 0",
      "config.agency_registry_hash = [0; 32]",
      "config.agency_count = 0",
      "config.bump = ctx.bumps.config",
      "config.vault_authority_bump = ctx.bumps.vault_authority",
    ],
    "V2 initialize_config",
  );
  assert.match(economyInitialize, /gate: &ValidatedDailyLawWrite/u);
  assert.match(economyInitialize, /initialize_config_transition\(input, gate\.unix_timestamp\)/u);
  assertTokensInOrder(
    economyTransition,
    [
      "input.admin != PROGRAM_ADMIN",
      "input.mint_decimals != TOKEN_DECIMALS",
      "let expected_randomness_program",
      "input.randomness_program != expected_randomness_program",
      "let genesis_timestamp = if input.rehearsal_mode",
      ".rehearsal_genesis_timestamp",
      "ProductionTimestampOverrideForbidden",
      "genesis_timestamp > clock_unix_timestamp",
      "config: ConfigState",
      "admin: PROGRAM_ADMIN",
      "mint: input.mint",
      "token_program: input.token_program",
      "randomness_program: input.randomness_program",
      "stake_token_account: [0; 32]",
      "agency_registry_hash: [0; 32]",
      "genesis_timestamp,",
      "expected_supply: if input.rehearsal_mode",
      "staked_principal: 0",
      "agency_count: 0",
      "rehearsal_mode: input.rehearsal_mode",
      "active: false",
      "lane_mask: 0",
      "stake_vault_initialized: false",
      "bump: input.config_bump",
      "vault_authority_bump: input.vault_authority_bump",
    ],
    "B3 initialize_config transition",
  );
  assert.match(
    audit,
    /`initialize_config` is the fifth host kernel[\s\S]+pre-lifecycle validation[\s\S]+by-value state construction/u,
  );
  assert.match(audit, /explicitly staged as\s+`PRE_LIFECYCLE_ONLY`/u);
});

test("the initialize_lane_vault kernel preserves V2 precedence and state construction", () => {
  const v2Initialize = functionBody(
    anchorProgramBody(v2Source),
    "initialize_lane_vault",
  );
  const economyInitialize = functionBody(economySource, "initialize_lane_vault");
  const economyTransition = functionBody(
    economySource,
    "initialize_lane_vault_transition",
  );

  assertTokensInOrder(
    v2Initialize,
    [
      "!ctx.accounts.config.active",
      "(TREASURY..=LIQUIDITY).contains(&lane)",
      "ctx.accounts.config.lane_mask & (1u8 << lane)",
      "lane_policy(lane, ctx.accounts.config.rehearsal_mode)",
      "state.config = ctx.accounts.config.key()",
      "state.token_account = ctx.accounts.lane_token_account.key()",
      "state.beneficiary = beneficiary(lane)",
      "state.total = lane_terms.total",
      "state.genesis_unlocked = lane_terms.genesis_unlocked",
      "state.cliff_week = lane_terms.cliff_week",
      "state.linear_end_week = lane_terms.linear_end_week",
      "state.reserved = 0",
      "state.paid = 0",
      "state.principal_claimed = 0",
      "state.lane = lane",
      "state.reward_source = lane_terms.reward_source",
      "state.bump = ctx.bumps.lane_state",
      "state.token_bump = ctx.bumps.lane_token_account",
      "ctx.accounts.config.lane_mask |= 1u8 << lane",
    ],
    "V2 initialize_lane_vault",
  );
  assert.match(economyInitialize, /_gate: &ValidatedDailyLawWrite/u);
  assert.match(economyInitialize, /initialize_lane_vault_transition\(input\)/u);
  assertTokensInOrder(
    economyTransition,
    [
      "input.config.active",
      "(TREASURY..=LIQUIDITY).contains(&input.lane)",
      "input.config.lane_mask & (1u8 << input.lane)",
      "lane_policy(input.lane, input.config.rehearsal_mode)",
      "beneficiary(input.lane)",
      "config: input.config_key",
      "token_account: input.lane_token_account",
      "beneficiary,",
      "total: lane_terms.total",
      "genesis_unlocked: lane_terms.genesis_unlocked",
      "cliff_week: lane_terms.cliff_week",
      "linear_end_week: lane_terms.linear_end_week",
      "reserved: 0",
      "paid: 0",
      "principal_claimed: 0",
      "lane: input.lane",
      "reward_source: lane_terms.reward_source",
      "bump: input.lane_state_bump",
      "token_bump: input.lane_token_bump",
      "config.lane_mask |= 1u8 << input.lane",
    ],
    "B3 initialize_lane_vault transition",
  );
  assert.match(
    audit,
    /`initialize_lane_vault` is the sixth[\s\S]+pre-lifecycle validation/u,
  );
  assert.match(
    audit,
    /does not[\s\S]+initialize Token-2022 state[\s\S]+does not make `initialize_lane_vault` complete/u,
  );
});

test("the initialize_stake_vault kernel preserves V2 precedence and config binding", () => {
  const v2Initialize = functionBody(
    anchorProgramBody(v2Source),
    "initialize_stake_vault",
  );
  const economyInitialize = functionBody(economySource, "initialize_stake_vault");
  const economyTransition = functionBody(
    economySource,
    "initialize_stake_vault_transition",
  );

  assertTokensInOrder(
    v2Initialize,
    [
      "!ctx.accounts.config.active",
      "!ctx.accounts.config.stake_vault_initialized",
      "ctx.accounts.config.stake_token_account = ctx.accounts.stake_token_account.key()",
      "ctx.accounts.config.stake_vault_initialized = true",
    ],
    "V2 initialize_stake_vault",
  );
  assert.match(economyInitialize, /_gate: &ValidatedDailyLawWrite/u);
  assert.match(economyInitialize, /initialize_stake_vault_transition\(input\)/u);
  assertTokensInOrder(
    economyTransition,
    [
      "input.config.active",
      "input.config.stake_vault_initialized",
      "config.stake_token_account = input.stake_token_account",
      "config.stake_vault_initialized = true",
    ],
    "B3 initialize_stake_vault transition",
  );
  assert.match(
    audit,
    /`initialize_stake_vault` is the[\s\S]+seventh[\s\S]+pre-lifecycle validation/u,
  );
  assert.match(
    audit,
    /does not[\s\S]+derive the vault-authority or stake-token PDA[\s\S]+does not\s+make `initialize_stake_vault` complete/u,
  );
});

test("the activate kernel preserves V2 preflight, reservation, and terminal ordering", () => {
  const v2Activate = functionBody(anchorProgramBody(v2Source), "activate");
  const economyActivate = functionBody(economySource, "activate");
  const economyTransition = functionBody(economySource, "activate_transition");

  assertTokensInOrder(
    v2Activate,
    [
      "RANDOMNESS_ADAPTER_VERIFIED",
      "!ctx.accounts.config.active",
      "ctx.accounts.config.lane_mask",
      "ctx.accounts.config.stake_vault_initialized",
      "ctx.accounts.mint.supply",
      "ctx.accounts.mint.mint_authority",
      "ctx.accounts.mint.freeze_authority",
      "verify_community_funding(",
      "verify_stake_vault(",
      "&ctx.accounts.treasury,",
      "&ctx.accounts.ecosystem,",
      "&ctx.accounts.core_team,",
      "&ctx.accounts.liquidity,",
      "let core_principal = lane_policy(CORE_TEAM",
      "maximum_reward(core_principal",
      "reserve_three_lanes(",
      "core_reward.config = ctx.accounts.config.key()",
      "core_reward.principal = core_principal",
      "core_reward.annual_rate_bps = CORE_RATE_BPS",
      "core_reward.term_weeks = CORE_TERM_WEEKS",
      "core_reward.treasury_reserved = treasury",
      "core_reward.ecosystem_reserved = ecosystem",
      "core_reward.liquidity_reserved = liquidity",
      "core_reward.paid = 0",
      "core_reward.settled_low = 0",
      "core_reward.settled_high = 0",
      "core_reward.bump = ctx.bumps.core_reward",
      "ctx.accounts.config.active = true",
    ],
    "V2 activate",
  );

  assert.match(economyActivate, /_gate: &ValidatedDailyLawWrite/u);
  assert.match(economyActivate, /activate_transition\(input\)/u);
  assertTokensInOrder(
    economyTransition,
    [
      "if !RANDOMNESS_ADAPTER_VERIFIED",
      "if input.config.active",
      "input.config.lane_mask != 0b1_1110",
      "if !input.config.stake_vault_initialized",
      "input.mint.supply != input.config.expected_supply",
      "input.mint.mint_authority.is_some()",
      "input.mint.freeze_authority.is_some()",
      "verify_community_funding(",
      "verify_stake_vault(",
      "input.treasury,",
      "input.ecosystem,",
      "input.core_team,",
      "input.liquidity,",
      "let core_principal = lane_policy(CORE_TEAM",
      "maximum_reward(core_principal",
      "let mut treasury = input.treasury",
      "let mut ecosystem = input.ecosystem",
      "let mut liquidity = input.liquidity",
      "reserve_three_lanes(",
      "let core_reward = CoreRewardState",
      "config: input.config_key",
      "principal: core_principal",
      "annual_rate_bps: CORE_RATE_BPS",
      "term_weeks: CORE_TERM_WEEKS",
      "treasury_reserved,",
      "ecosystem_reserved,",
      "liquidity_reserved,",
      "paid: 0",
      "settled_low: 0",
      "settled_high: 0",
      "bump: input.core_reward_bump",
      "let mut config = input.config",
      "config.active = true",
    ],
    "B3 activate transition",
  );

  for (const source of [v2Source, economySource]) {
    assertTokensInOrder(
      functionBody(source, "verify_community_funding"),
      ["tokens.mint", "tokens.owner", "tokens.amount"],
      "activate community funding helper",
    );
    assertTokensInOrder(
      functionBody(source, "verify_stake_vault"),
      ["tokens.mint", "tokens.owner", "tokens.amount"],
      "activate stake funding helper",
    );
    assertTokensInOrder(
      functionBody(source, "verify_lane_funding"),
      ["lane.token_account", "tokens.mint", "tokens.owner", "lane.total"],
      "activate lane funding helper",
    );
    assertTokensInOrder(
      functionBody(source, "reserve_lane"),
      [
        "*remaining == 0",
        "lane.reward_source",
        "cumulative_unlocked",
        "let used = lane",
        ".reserved",
        ".checked_add(lane.paid)",
        ".and_then(|value| value.checked_add(lane.principal_claimed))",
        "saturating_sub",
        "capacity.min",
        "lane.reserved =",
        "*remaining =",
      ],
      "activate single-lane reservation helper",
    );
    assertTokensInOrder(
      functionBody(source, "reserve_three_lanes"),
      [
        "treasury.lane",
        "ecosystem.lane",
        "liquidity.lane",
        "reserve_lane(treasury",
        "reserve_lane(ecosystem",
        "reserve_lane(liquidity",
        "remaining",
      ],
      "activate three-lane reservation helper",
    );
  }

  assert.match(
    audit,
    /`activate` is the eighth host kernel[\s\S]+`PRE_LIFECYCLE_ONLY`[\s\S]+no public exposure/u,
  );
  assert.match(
    audit,
    /handler-body parity only[\s\S]+does not authenticate[\s\S]+does not make `activate`\s+complete/u,
  );
  assert.match(
    audit,
    /pre-activation\/vacuous-cap phase[\s\S]+atomically enables normal cap\s+enforcement[\s\S]+Core payout custody remains separately blocked/u,
  );
});

test("the set_eligibility kernel preserves V2 policy order without importing lifecycle", () => {
  const v2SetEligibility = functionBody(
    anchorProgramBody(v2Source),
    "set_eligibility",
  );
  const economySetEligibility = functionBody(economySource, "set_eligibility");
  const economyTransition = functionBody(
    economySource,
    "set_eligibility_transition",
  );

  assertTokensInOrder(
    v2SetEligibility,
    [
      "ctx.accounts.config.active",
      "IatV2Error::NotActive",
      "role_rate(role).is_some()",
      "IatV2Error::UnknownRole",
      "if role == 0",
      "agency_index.is_none()",
      "IatV2Error::StandardCannotLinkAgency",
      "CCC_DLC_GENESIS_ENABLED",
      "IatV2Error::CccDlcNotActive",
      "agency_index.is_some()",
      "IatV2Error::CccRoleRequiresAgency",
      "agency_index.unwrap() < ctx.accounts.config.agency_count",
      "IatV2Error::InvalidAgencyIndex",
      "let eligibility = &mut ctx.accounts.eligibility",
      "eligibility.config = ctx.accounts.config.key()",
      "eligibility.wallet = ctx.accounts.wallet.key()",
      "eligibility.role = role",
      "eligibility.agency_index = agency_index.unwrap_or(u32::MAX)",
      "eligibility.bump = ctx.bumps.eligibility",
    ],
    "V2 set_eligibility",
  );

  assert.match(economySetEligibility, /_gate: &ValidatedDailyLawWrite/u);
  assert.match(
    economySetEligibility,
    /set_eligibility_transition\(input\)/u,
  );
  assertTokensInOrder(
    economyTransition,
    [
      "if !input.config.active",
      "EconomyError::NotActive",
      "role_rate(input.role).is_none()",
      "EconomyError::UnknownRole",
      "if input.role == 0",
      "input.agency_index.is_some()",
      "EconomyError::StandardCannotLinkAgency",
      "if !CCC_DLC_GENESIS_ENABLED",
      "EconomyError::CccDlcNotActive",
      "input.agency_index.is_none()",
      "EconomyError::CccRoleRequiresAgency",
      "input.agency_index.unwrap_or(u32::MAX) >= input.config.agency_count",
      "EconomyError::InvalidAgencyIndex",
      "eligibility: EligibilityState",
      "config: input.config_key",
      "wallet: input.wallet",
      "agency_index: input.agency_index.unwrap_or(u32::MAX)",
      "role: input.role",
      "bump: input.eligibility_bump",
    ],
    "B3 set_eligibility transition",
  );

  const v2Accounts = structBody(v2Source, "SetEligibility");
  assertTokensInOrder(
    v2Accounts,
    [
      "#[account(mut, address = config.admin)]",
      "pub admin: Signer<'info>",
      "pub config: Account<'info, Config>",
      "pub wallet: UncheckedAccount<'info>",
      "init_if_needed",
      "payer = admin",
      "space = 8 + Eligibility::INIT_SPACE",
      'seeds = [b"eligibility", config.key().as_ref(), wallet.key().as_ref()]',
      "bump",
      "pub eligibility: Account<'info, Eligibility>",
      "pub system_program: Program<'info, System>",
    ],
    "V2 SetEligibility account lifecycle",
  );
  assert.doesNotMatch(
    economySetEligibility,
    /Signer|AccountInfo|init_if_needed|create_account|invoke|serialize|persist/u,
  );
  assert.doesNotMatch(
    economyTransition,
    /Signer|AccountInfo|init_if_needed|create_account|invoke|serialize|persist/u,
  );

  assert.match(
    audit,
    /`set_eligibility` is the ninth host kernel[\s\S]+`PRE_LIFECYCLE_ONLY`[\s\S]+no public exposure/u,
  );
  assert.match(
    audit,
    /Standard role[\s\S]+`u32::MAX`[\s\S]+Roles one and two[\s\S]+`CccDlcNotActive`[\s\S]+unknown roles fail before any agency rule/u,
  );
  assert.match(
    audit,
    /does not authenticate the administrator or config[\s\S]+`init_if_needed` create-or-update lifecycle[\s\S]+does not make `set_eligibility` complete/u,
  );
  assert.match(
    audit,
    /For\s+`set_eligibility`[\s\S]+Daily Law gate and pure role-policy transition succeed[\s\S]+manually create an absent record or mutably overwrite a valid existing\s+record/u,
  );
});

test("prepare_open_position stops at the exact V2 pre-token-CPI boundary", () => {
  const v2Open = functionBody(anchorProgramBody(v2Source), "open_position");
  const economyPrepare = functionBody(economySource, "prepare_open_position");
  const economyTransition = functionBody(
    economySource,
    "prepare_open_position_transition",
  );

  assertTokensInOrder(
    v2Open,
    [
      "ctx.accounts.config.active",
      "principal > 0",
      "verify_destination(",
      "&ctx.accounts.owner_tokens",
      "ctx.accounts.mint.key()",
      "ctx.accounts.owner.key()",
      "Pubkey::find_program_address(",
      'b"vault-authority"',
      "verify_stake_vault(",
      "&ctx.accounts.stake_tokens",
      "ctx.accounts.config.staked_principal",
      "ctx.accounts.eligibility.wallet",
      "ctx.accounts.owner.key()",
      "role_rate(ctx.accounts.eligibility.role)",
      "if ctx.accounts.eligibility.role == 0",
      "ctx.accounts.eligibility.agency_index",
      "u32::MAX",
      "CCC_DLC_GENESIS_ENABLED",
      "ctx.accounts.eligibility.agency_index < ctx.accounts.config.agency_count",
      "week_for(&ctx.accounts.config)",
      "maximum_reward(principal, rate, USER_TERM_WEEKS)",
      "reserve_three_lanes(",
      "&mut ctx.accounts.treasury",
      "&mut ctx.accounts.ecosystem",
      "&mut ctx.accounts.liquidity",
      "token::transfer_checked(",
      "ctx.accounts.config.staked_principal =",
      ".checked_add(principal)",
      "let position = &mut ctx.accounts.position",
    ],
    "V2 open_position",
  );

  assert.match(economyPrepare, /gate: &ValidatedDailyLawWrite/u);
  assert.match(
    economyPrepare,
    /prepare_open_position_transition\(input, gate\.unix_timestamp\)/u,
  );
  assertTokensInOrder(
    economyTransition,
    [
      "if !input.config.active",
      "input.principal == 0",
      "verify_destination(input.owner_tokens, input.mint, input.owner)",
      "verify_stake_vault(",
      "input.stake_tokens",
      "input.mint",
      "input.vault_authority",
      "input.config.staked_principal",
      "input.eligibility.wallet != input.owner",
      "role_rate(input.eligibility.role)",
      "if input.eligibility.role == 0",
      "input.eligibility.agency_index != u32::MAX",
      "if !CCC_DLC_GENESIS_ENABLED",
      "input.eligibility.agency_index >= input.config.agency_count",
      "current_week(input.config.genesis_timestamp, clock_unix_timestamp)",
      "maximum_reward(input.principal, rate, USER_TERM_WEEKS)",
      "let mut treasury = input.treasury",
      "let mut ecosystem = input.ecosystem",
      "let mut liquidity = input.liquidity",
      "reserve_three_lanes(",
      "Ok(OpenPositionPreCpiPlan",
      "config_snapshot: input.config",
      "treasury_reserved,",
      "ecosystem_reserved,",
      "liquidity_reserved,",
      "transfer: TransferCheckedIntent",
      "token_program: input.config.token_program",
      "source: input.owner_tokens.key",
      "destination: input.stake_tokens.key",
      "amount: input.principal",
      "decimals: TOKEN_DECIMALS",
    ],
    "B3 prepare_open_position transition",
  );

  for (const body of [economyPrepare, economyTransition]) {
    assert.doesNotMatch(
      body,
      /config\.staked_principal\s*=|config\.staked_principal\s*\.checked_add|PositionState\s*\{|CpiContext|token::transfer_checked|\binvoke(?:_signed)?\s*\(/u,
    );
  }

  const plan = structBody(economySource, "OpenPositionPreCpiPlan");
  assert.match(plan, /pub treasury: LaneState/u);
  assert.match(plan, /pub ecosystem: LaneState/u);
  assert.match(plan, /pub liquidity: LaneState/u);
  assert.match(plan, /pub transfer: TransferCheckedIntent/u);
  assert.doesNotMatch(plan, /PositionState/u);

  const v2Accounts = structBody(v2Source, "OpenPosition");
  assertTokensInOrder(
    v2Accounts,
    [
      "pub owner: Signer<'info>",
      "pub config: Box<Account<'info, Config>>",
      "pub eligibility: Box<Account<'info, Eligibility>>",
      "pub stake_tokens: Box<Account<'info, TokenAccount>>",
      "init,",
      "payer = owner",
      'b"position"',
      "pub position: Box<Account<'info, Position>>",
      "pub token_program: Program<'info, Token>",
      "pub system_program: Program<'info, System>",
    ],
    "V2 OpenPosition lifecycle",
  );

  assert.match(
    audit,
    /`prepare_open_position` is\s+the tenth host kernel[\s\S]+`PRE_TOKEN_CPI_ONLY`[\s\S]+no public exposure/u,
  );
  assert.match(
    audit,
    /exact retained V2 pre-CPI\s+order[\s\S]+CCC[\s\S]+transaction-\s*local lane copies and an owner-to-stake-vault transfer intent only/u,
  );
  assert.match(
    audit,
    /does not\s+perform `config\.staked_principal\.checked_add`[\s\S]+construct `PositionState`[\s\S]+invoke a CPI/u,
  );
  assert.match(
    audit,
    /manually\s+create the position account[\s\S]+`add_extra_accounts_for_execute_cpi`[\s\S]+post-CPI finalizer[\s\S]+local validator[\s\S]+rolls back/u,
  );
  assert.match(
    audit,
    /derive and bind the canonical\s+vault-authority PDA[\s\S]+semantic value[\s\S]+not\s+trusted adapter evidence/u,
  );
  assert.match(
    audit,
    /unsolicited 1-base-unit donation[\s\S]+`StakeLedgerMismatch`[\s\S]+does not relax the\s+equality/u,
  );
});

test("prepare_withdraw_position_principal stops at the exact V2 pre-token-CPI boundary", () => {
  const v2Withdraw = functionBody(
    anchorProgramBody(v2Source),
    "withdraw_position_principal",
  );
  const economyPrepare = functionBody(
    economySource,
    "prepare_withdraw_position_principal",
  );
  const economyTransition = functionBody(
    economySource,
    "prepare_withdraw_position_principal_transition",
  );

  assertTokensInOrder(
    v2Withdraw,
    [
      "ctx.accounts.config.active",
      "ctx.accounts.position.closed",
      "verify_destination(",
      "&ctx.accounts.destination_tokens",
      "ctx.accounts.mint.key()",
      "ctx.accounts.position.owner",
      "ctx.accounts.position.principal_returned",
      "position_maturity_week(",
      "ctx.accounts.position.accepted_week",
      "ctx.accounts.position.term_weeks",
      "week_for(&ctx.accounts.config)? >= maturity_week",
      "ctx.accounts.config.staked_principal >= ctx.accounts.position.principal",
      "verify_stake_vault(",
      "&ctx.accounts.stake_tokens",
      "ctx.accounts.mint.key()",
      "ctx.accounts.vault_authority.key()",
      "ctx.accounts.config.staked_principal",
      "transfer_from_vault(",
      "ctx.accounts.position.principal",
      "ctx.accounts.config.staked_principal =",
      ".checked_sub(ctx.accounts.position.principal)",
      "ctx.accounts.position.principal_returned = true",
    ],
    "V2 withdraw_position_principal",
  );

  assert.match(economyPrepare, /gate: &ValidatedDailyLawWrite/u);
  assert.match(
    economyPrepare,
    /prepare_withdraw_position_principal_transition\(input, gate\.unix_timestamp\)/u,
  );
  assertTokensInOrder(
    economyTransition,
    [
      "if !input.config.active",
      "if input.position.closed",
      "verify_destination(input.destination_tokens, input.mint, input.position.owner)",
      "if input.position.principal_returned",
      "position_maturity_week(input.position.accepted_week, input.position.term_weeks)",
      "current_week(input.config.genesis_timestamp, clock_unix_timestamp)",
      "if current_week < maturity_week",
      "if input.config.staked_principal < input.position.principal",
      "verify_stake_vault(",
      "input.stake_tokens",
      "input.mint",
      "input.vault_authority",
      "input.config.staked_principal",
      "Ok(WithdrawPositionPrincipalPreCpiPlan",
      "config_snapshot: input.config",
      "position_snapshot: input.position",
      "maturity_week,",
      "transfer: TransferCheckedIntent",
      "token_program: input.config.token_program",
      "source: input.stake_tokens.key",
      "destination: input.destination_tokens.key",
      "authority: input.vault_authority",
      "amount: input.position.principal",
      "decimals: TOKEN_DECIMALS",
    ],
    "B3 prepare_withdraw_position_principal transition",
  );

  for (const body of [economyPrepare, economyTransition]) {
    assert.doesNotMatch(
      body,
      /\bconfig\.staked_principal\s*=|position\.principal_returned\s*=\s*true|CpiContext|transfer_from_vault|token::transfer_checked|\binvoke(?:_signed)?\s*\(/u,
    );
  }

  const plan = structBody(
    economySource,
    "WithdrawPositionPrincipalPreCpiPlan",
  );
  assert.match(plan, /pub config_snapshot: ConfigState/u);
  assert.match(plan, /pub position_snapshot: PositionState/u);
  assert.match(plan, /pub maturity_week: u64/u);
  assert.match(plan, /pub transfer: TransferCheckedIntent/u);

  const v2Accounts = structBody(v2Source, "WithdrawPositionPrincipal");
  assertTokensInOrder(
    v2Accounts,
    [
      "pub caller: Signer<'info>",
      "#[account(mut, has_one = mint, has_one = token_program)]",
      "pub config: Account<'info, Config>",
      "#[account(mut, has_one = config)]",
      "pub position: Account<'info, Position>",
      "pub mint: Account<'info, Mint>",
      'seeds = [b"vault-authority", config.key().as_ref()]',
      "pub vault_authority: UncheckedAccount<'info>",
      "#[account(mut, address = config.stake_token_account)]",
      "pub stake_tokens: Account<'info, TokenAccount>",
      "pub destination_tokens: Account<'info, TokenAccount>",
      "pub token_program: Program<'info, Token>",
    ],
    "V2 WithdrawPositionPrincipal accounts",
  );

  assert.match(
    audit,
    /`prepare_withdraw_position_principal` is the eleventh host kernel[\s\S]+`PRE_TOKEN_CPI_ONLY`[\s\S]+no public exposure/u,
  );
  assert.match(
    audit,
    /withdrawal kernel preserves the exact retained V2 pre-CPI order[\s\S]+maturity[\s\S]+exact tracked stake-vault balance/u,
  );
  assert.match(
    audit,
    /does not decrement[\s\S]+staked_principal[\s\S]+does not set[\s\S]+principal_returned[\s\S]+does not invoke a CPI/u,
  );
  assert.match(
    audit,
    /For `withdraw_position_principal`[\s\S]+`add_extra_accounts_for_execute_cpi`[\s\S]+post-CPI finalizer[\s\S]+roll back/u,
  );
});

test("prepare_settle_position_week stops before V2's ordered reward CPIs", () => {
  const v2Settle = functionBody(
    anchorProgramBody(v2Source),
    "settle_position_week",
  );
  const economyPrepare = functionBody(
    economySource,
    "prepare_settle_position_week",
  );
  const economyTransition = functionBody(
    economySource,
    "prepare_settle_position_week_transition",
  );

  assertTokensInOrder(
    v2Settle,
    [
      "ctx.accounts.config.active",
      "ctx.accounts.position.closed",
      "verify_destination(",
      "&ctx.accounts.destination_tokens",
      "ctx.accounts.mint.key()",
      "ctx.accounts.position.owner",
      "week <= week_for(&ctx.accounts.config)",
      ".checked_sub(ctx.accounts.position.first_accrual_week)",
      "ordinal < ctx.accounts.position.term_weeks",
      ".checked_shl",
      "ctx.accounts.position.settled_mask & bit",
      "if ctx.accounts.position.role == 0",
      "ctx.accounts.round.is_none()",
      "CCC_DLC_GENESIS_ENABLED",
      ".ok_or(IatV2Error::CccRoundRequired)",
      "round.config",
      "round.week",
      "ctx.accounts.position.agency_index < round.agency_count_snapshot",
      "match round.status",
      "ROUND_SETTLED",
      "ROUND_EXPIRED_NEUTRAL",
      "reward_for_week(",
      "neutral_expired_round_reward",
      "consume_three_reservations(",
      "ctx.accounts.position.treasury_reserved = treasury_reserved",
      "ctx.accounts.position.ecosystem_reserved = ecosystem_reserved",
      "ctx.accounts.position.liquidity_reserved = liquidity_reserved",
      "transfer_reward_splits(",
      "ctx.accounts.position.paid =",
      ".checked_add(amount)",
      "ctx.accounts.position.settled_mask |= bit",
    ],
    "V2 settle_position_week",
  );

  assert.match(economyPrepare, /gate: &ValidatedDailyLawWrite/u);
  assert.match(
    economyPrepare,
    /prepare_settle_position_week_transition\(input, gate\.unix_timestamp, CCC_DLC_GENESIS_ENABLED\)/u,
  );
  assertTokensInOrder(
    economyTransition,
    [
      "if !input.config.active",
      "if input.position.closed",
      "verify_destination(input.destination_tokens, input.mint, input.position.owner)",
      "current_week(input.config.genesis_timestamp, clock_unix_timestamp)",
      "if input.week > current_policy_week",
      ".checked_sub(input.position.first_accrual_week)",
      "if ordinal >= input.position.term_weeks",
      "u32::try_from(ordinal)",
      ".checked_shl(shift)",
      "input.position.settled_mask & settlement_bit",
      "if input.position.role == 0",
      "input.round.is_some()",
      "if !ccc_dlc_enabled",
      "input.round.ok_or(EconomyError::CccRoundRequired)",
      "round.config != input.config_key",
      "round.week != input.week",
      "input.position.agency_index >= round.agency_count_snapshot",
      "match round.status",
      "ROUND_SETTLED",
      "ROUND_EXPIRED_NEUTRAL",
      "reward_for_week(",
      "neutral_expired_round_reward",
      "let mut position = input.position",
      "let mut treasury = input.treasury",
      "let mut ecosystem = input.ecosystem",
      "let mut liquidity = input.liquidity",
      "consume_three_reservations(",
      "Ok(SettlePositionWeekPreCpiPlan",
      "position,",
      "treasury,",
      "ecosystem,",
      "liquidity,",
      "settlement_bit,",
      "transfers:",
      "transfer(input.treasury.token_account, treasury_paid)",
      "transfer(input.ecosystem.token_account, ecosystem_paid)",
      "transfer(input.liquidity.token_account, liquidity_paid)",
    ],
    "B3 prepare_settle_position_week transition",
  );

  for (const body of [economyPrepare, economyTransition]) {
    assert.doesNotMatch(
      body,
      /position\.paid\s*=|position\.settled_mask\s*\|=|CpiContext|transfer_reward_splits|token::transfer_checked|\binvoke(?:_signed)?\s*\(/u,
    );
  }

  for (const source of [v2Source, economySource]) {
    assertTokensInOrder(
      functionBody(source, "consume_reserved_lane"),
      [
        "lane.reward_source",
        "position_reserved",
        "lane.reserved",
        "min(*remaining)",
        "position_reserved =",
        "lane.reserved =",
        "lane.paid =",
        "remaining =",
      ],
      "settlement single-lane consumption",
    );
    assertTokensInOrder(
      functionBody(source, "consume_three_reservations"),
      [
        "treasury.lane",
        "ecosystem.lane",
        "liquidity.lane",
        "consume_reserved_lane(treasury",
        "consume_reserved_lane(ecosystem",
        "consume_reserved_lane(liquidity",
        "remaining",
      ],
      "settlement three-lane consumption",
    );
  }

  const plan = structBody(economySource, "SettlePositionWeekPreCpiPlan");
  assert.match(plan, /pub position: PositionState/u);
  assert.match(plan, /pub amount: u64/u);
  assert.match(plan, /pub settlement_bit: u64/u);
  assert.match(plan, /pub transfers: \[TransferCheckedIntent; 3\]/u);

  const v2Accounts = structBody(v2Source, "SettlePositionWeek");
  assertTokensInOrder(
    v2Accounts,
    [
      "pub caller: Signer<'info>",
      "pub config: Box<Account<'info, Config>>",
      "pub position: Box<Account<'info, Position>>",
      "pub round: Option<Account<'info, Round>>",
      "pub mint: Box<Account<'info, Mint>>",
      'seeds = [b"vault-authority", config.key().as_ref()]',
      "pub vault_authority: UncheckedAccount<'info>",
      'seeds = [b"lane", config.key().as_ref(), &[TREASURY]]',
      "pub treasury: Box<Account<'info, LaneVault>>",
      "pub treasury_tokens: Box<Account<'info, TokenAccount>>",
      'seeds = [b"lane", config.key().as_ref(), &[ECOSYSTEM]]',
      "pub ecosystem: Box<Account<'info, LaneVault>>",
      "pub ecosystem_tokens: Box<Account<'info, TokenAccount>>",
      'seeds = [b"lane", config.key().as_ref(), &[LIQUIDITY]]',
      "pub liquidity: Box<Account<'info, LaneVault>>",
      "pub liquidity_tokens: Box<Account<'info, TokenAccount>>",
      "pub destination_tokens: Box<Account<'info, TokenAccount>>",
      "pub token_program: Program<'info, Token>",
    ],
    "V2 SettlePositionWeek accounts",
  );
  assert.doesNotMatch(v2Accounts, /\binit\b|\bclose\s*=/u);

  assert.match(
    audit,
    /`prepare_settle_position_week` is the twelfth[\s\S]+`PRE_TOKEN_CPI_ONLY`[\s\S]+no public exposure/u,
  );
  assert.match(
    audit,
    /leaving position\s+paid and settlement bits unchanged[\s\S]+change CPI-error precedence/u,
  );
  assert.match(
    audit,
    /For `settle_position_week`[\s\S]+treasury, ecosystem, liquidity order[\s\S]+post-CPI finalizer[\s\S]+rolls back/u,
  );
});
