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
