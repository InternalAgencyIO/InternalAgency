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
    /faction and core-team-cap implementations currently present[\s\S]+JavaScript specifications[\s\S]+host-only `iat_b3_economy` library[\s\S]+no Solana entrypoint or public dispatcher/u,
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
