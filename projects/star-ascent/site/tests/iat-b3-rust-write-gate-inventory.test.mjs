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
  const signature = new RegExp(`(?:pub )?fn ${name}\\b`, "u");
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

test("the Rust workspace has no unreported faction or core-cap entrypoint", () => {
  const workspaceMembers = [...workspaceCargo.matchAll(/"(programs\/[a-z0-9_]+)"/gu)]
    .map((match) => match[1]);
  assert.deepEqual(workspaceMembers, [
    "programs/iat_b3_consensus",
    "programs/iat_b3_economy",
    "programs/iat_b3_law",
    "programs/iat_v2",
  ]);
  assert.match(economyCargo, /crate-type = \["lib"\]/u);
  assert.doesNotMatch(economyCargo, /cdylib|solana-|anchor-|spl-token/u);
  assert.doesNotMatch(
    economySource,
    /entrypoint!|process_instruction|#\[program\]|invoke(?:_signed)?\s*\(/u,
  );
  assert.match(
    audit,
    /faction and core-team-cap implementations currently present[\s\S]+JavaScript specifications[\s\S]+host-only `iat_b3_economy` library[\s\S]+no Solana\s+entrypoint or\s+public dispatcher/u,
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
  assert.match(initialize, /LawState::uninitialized/u);
  assert.match(initialize, /ExtraAccountMetaList::init::<ExecuteInstruction>/u);

  const finalize = functionBody(lawSource, "process_finalize_day");
  assert.match(finalize, /Clock::get\(\)/u);
  assert.match(finalize, /PodSlotHashes::fetch\(\)/u);
  assert.match(finalize, /ensure_day_can_finalize/u);
  assert.match(finalize, /create_solana_daily_decision/u);

  const execute = functionBody(lawSource, "process_execute");
  assert.match(execute, /validate_law_state_account/u);
  assert.match(execute, /validate_transfer_context/u);
  assert.match(execute, /state\.transfer_disposition_at\(clock\.unix_timestamp\)/u);
  assert.match(execute, /IatTransferDisposition::DayUnfinalized/u);
  assert.match(execute, /IatTransferDisposition::RejectedDailyLockdown/u);
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
  assert.match(
    audit,
    /`close_position` the\s+second,/u,
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
    /`initialize_config` is the fifth host kernel[\s\S]+pre-lifecycle validation and by-value initial-state construction/u,
  );
  assert.match(audit, /explicitly staged as `PRE_LIFECYCLE_ONLY`/u);
});
