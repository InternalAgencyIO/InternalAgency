import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

import {
  extractIatB3ProductionTransactionMaps,
  IAT_B3_PRODUCTION_META_SHAPE_PROBES,
  validateIatB3ProductionTransactionMaps,
} from "../scripts/lib/iat-b3-production-transaction-map.mjs";
import {
  buildIatB3ProductionInstruction,
  encodeIatB3ProductionInstruction,
  IAT_B3_PRODUCTION_UNSIGNED_BUILDERS,
  IAT_B3_ZK_ELGAMAL_PROOF_PROGRAM_ID,
} from "../programs/iat_b3_economy/production-client.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

function sourceInput() {
  return {
    economySource: read("programs/iat_b3_economy/src/lib.rs"),
    instructionSource: read("programs/iat_b3_economy/src/production_instruction.rs"),
    entrypointSource: read("programs/iat_b3_economy/src/production_entrypoint.rs"),
    dispatchSource: read("programs/iat_b3_economy/src/production_dispatch.rs"),
    initializationHoldSource: read("programs/iat_b3_economy/src/production_initialization_policy_hold.rs"),
    nativeAdapterSource: read("programs/iat_b3_economy/src/native_adapter.rs"),
    setEligibilitySource: read("programs/iat_b3_economy/src/production_set_eligibility.rs"),
    openPositionSource: read("programs/iat_b3_economy/src/production_open_position.rs"),
    openExecutorSource: read("programs/iat_b3_economy/src/production_open_position_executor.rs"),
    settleExecutorSource: read("programs/iat_b3_economy/src/production_settle_position_week_executor.rs"),
    settleCoreHoldSource: read("programs/iat_b3_economy/src/production_settle_position_week.rs"),
    claimLanePrincipalSource: read("programs/iat_b3_economy/src/production_claim_lane_principal.rs"),
    claimExecutorSource: read("programs/iat_b3_economy/src/production_claim_lane_principal_executor.rs"),
    withdrawPositionSource: read("programs/iat_b3_economy/src/production_withdraw_position.rs"),
    withdrawExecutorSource: read("programs/iat_b3_economy/src/production_withdraw_position_executor.rs"),
    closeSource: read("programs/iat_b3_economy/src/production_close_position.rs"),
    closeSpecSource: read("programs/iat_b3_economy/tests/production_close_position_spec.rs"),
    disabledRoundSource: read("programs/iat_b3_economy/src/production_round_disabled.rs"),
    stakeIngressRuntimeSource: read("programs/iat_b3_economy/src/stake_ingress_runtime.rs"),
    economicWriteGatesSource: read("docs/b3/iat-b3-economic-write-gates.v1.json"),
  };
}

function mutateFixturePrivilege(source, probe, property) {
  const startPattern = new RegExp(`\\b${probe.field}:\\s*[^\\n]*?TestAccount\\s*\\{`, "gu");
  const edits = [];
  for (const match of source.matchAll(startPattern)) {
    const open = source.indexOf("{", match.index);
    let depth = 0;
    for (let index = open; index < source.length; index += 1) {
      if (source[index] === "{") depth += 1;
      if (source[index] === "}") depth -= 1;
      if (depth !== 0) continue;
      const block = source.slice(open, index + 1);
      const fields = {
        isSigner: probe.signerField,
        isWritable: probe.writableField,
        executable: "executable",
      };
      const expected = probe[property];
      const needle = `${fields[property]}: ${expected},`;
      if (block.includes(needle)) {
        const offset = block.indexOf(needle);
        edits.push({
          start: open + offset,
          end: open + offset + needle.length,
          replacement: `${fields[property]}: ${!expected},`,
        });
      }
      break;
    }
  }
  assert.notEqual(edits.length, 0, `fixture mutation target exists: ${probe.label}/${property}`);
  let mutated = source;
  for (const edit of edits.reverse()) {
    mutated = `${mutated.slice(0, edit.start)}${edit.replacement}${mutated.slice(edit.end)}`;
  }
  return mutated;
}

const MAP = extractIatB3ProductionTransactionMaps(sourceInput());
const PROGRAM_ID = new PublicKey(new Uint8Array(32).fill(0xa1));
const LAW_PROGRAM_ID = new PublicKey(new Uint8Array(32).fill(0xb1));
const MINT = new PublicKey(new Uint8Array(32).fill(0xc1));
const pda = (programId, seeds) => PublicKey.findProgramAddressSync(seeds, programId)[0];
const LAW_STATE = pda(LAW_PROGRAM_ID, [Buffer.from("law-state"), MINT.toBuffer()]);
const CONFIG = pda(PROGRAM_ID, [Buffer.from("config"), MINT.toBuffer()]);

const PAYLOADS = [
  {}, { lane: 1 }, {}, {}, {}, { role: 2, agency_index: 3 },
  { position_id: 4n, principal: 5n }, { week: 6n }, { ordinal: 7n },
  { lane: 1 }, {}, {}, { week: 8n }, {}, {},
];

function selectedVariant(operation, payload, requested) {
  if (operation.opcode === 6) return operation.variants.find(({ name }) => name === requested);
  if (operation.opcode === 9) {
    const name = [1, 2, 4].includes(payload.lane)
      ? "NON_CORE_ACTIVE" : payload.lane === 3 ? "CORE_CUSTODY_HOLD" : "INVALID_LANE";
    return operation.variants.find((candidate) => candidate.name === name);
  }
  return operation.variants[0];
}

function fixtureAccounts(operation, payload, variantName) {
  const variant = selectedVariant(operation, payload, variantName);
  const roles = variant.metas.filter(({ binding }) => binding === "account").map(({ role }) => role);
  let marker = 1;
  const accounts = Object.fromEntries(roles.map((role) => {
    marker += 1;
    return [role, new PublicKey(Uint8Array.from({ length: 32 }, (_, index) => (marker + index) & 0xff))];
  }));
  if (roles.includes("config")) accounts.config = CONFIG;
  if (roles.includes("vault_authority")) {
    accounts.vault_authority = pda(PROGRAM_ID, [Buffer.from("vault-authority"), CONFIG.toBuffer()]);
  }
  if (roles.includes("stake_tokens")) {
    accounts.stake_tokens = pda(PROGRAM_ID, [Buffer.from("stake-token"), CONFIG.toBuffer()]);
  }
  if (roles.includes("eligibility")) {
    const operator = operation.opcode === 5 ? accounts.wallet : accounts.owner;
    accounts.eligibility = pda(PROGRAM_ID, [Buffer.from("eligibility"), CONFIG.toBuffer(), operator.toBuffer()]);
  }
  if (operation.opcode === 6) {
    const positionId = Buffer.alloc(8);
    positionId.writeBigUInt64LE(payload.position_id);
    accounts.position = pda(PROGRAM_ID, [
      Buffer.from("position"), CONFIG.toBuffer(), accounts.owner.toBuffer(), positionId,
    ]);
  }
  for (const [role, seed, lane] of [
    ["treasury", "lane", 1], ["treasury_tokens", "lane-token", 1],
    ["ecosystem", "lane", 2], ["ecosystem_tokens", "lane-token", 2],
    ["liquidity", "lane", 4], ["liquidity_tokens", "lane-token", 4],
  ]) {
    if (roles.includes(role)) {
      accounts[role] = pda(PROGRAM_ID, [Buffer.from(seed), CONFIG.toBuffer(), Buffer.from([lane])]);
    }
  }
  if (roles.includes("lane_state")) {
    accounts.lane_state = pda(PROGRAM_ID, [Buffer.from("lane"), CONFIG.toBuffer(), Buffer.from([payload.lane])]);
  }
  if (roles.includes("lane_tokens")) {
    accounts.lane_tokens = pda(PROGRAM_ID, [Buffer.from("lane-token"), CONFIG.toBuffer(), Buffer.from([payload.lane])]);
  }
  return accounts;
}

function buildInput(opcode, { payload = PAYLOADS[opcode], variant } = {}) {
  const operation = MAP.operations[opcode];
  return {
    transactionMap: MAP,
    programId: PROGRAM_ID,
    lawProgramId: LAW_PROGRAM_ID,
    canonicalMint: MINT,
    dailyLawState: LAW_STATE,
    payload,
    accounts: fixtureAccounts(operation, payload, variant),
    ...(variant === undefined ? {} : { variant }),
  };
}

test("source extraction freezes exact disposition truth and all production meta counts", () => {
  assert.equal(validateIatB3ProductionTransactionMaps(MAP), true);
  assert.equal(Object.isFrozen(MAP), true);
  assert.deepEqual(MAP.dispositions, {
    active: 6,
    initializationPolicyHold: 5,
    cccDisabled: 3,
    coreCustodyPolicyHold: 1,
    all15Active: false,
    devnetExecuted: false,
    mainnetHold: true,
  });
  assert.deepEqual(MAP.pdaSeeds, {
    lawState: "law-state",
    config: "config",
    vaultAuthority: "vault-authority",
    laneState: "lane",
    laneToken: "lane-token",
    stakeToken: "stake-token",
    stakeIngress: "stake-ingress",
    eligibility: "eligibility",
    position: "position",
  });
  assert.deepEqual(MAP.accountAliasPolicy, {
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
  });
  assert.deepEqual(
    MAP.operations.map((operation) => operation.variants.map(({ totalMetaCount }) => totalMetaCount)),
    [[1], [1], [1], [1], [1], [6], [17, 18], [17], [1], [12, 1, 1], [12], [7], [1], [1], [1]],
  );
  for (const operation of MAP.operations) {
    assert.equal(operation.opcode, MAP.operations.indexOf(operation));
    for (const variant of operation.variants) {
      assert.equal(variant.metas[0].role, "daily_law_state");
      assert.equal(variant.metas.filter(({ role }) => role === "daily_law_state").length, 1);
    }
  }
  assert.equal(MAP.operations[7].variants.length, 1, "production settlement exposes no optional Round layout");
});

test("all fifteen strict ABI vectors preserve namespace, reserved bytes, and canonical payload offsets", () => {
  const vectors = PAYLOADS.map((payload, opcode) =>
    encodeIatB3ProductionInstruction({ transactionMap: MAP, operation: opcode, payload }));
  assert.equal(vectors.length, 15);
  for (const [opcode, data] of vectors.entries()) {
    assert.equal(data.length, 32);
    assert.equal(data.subarray(0, 8).toString("ascii"), "IATB3EC1");
    assert.equal(data[8], 1);
    assert.equal(data[9], opcode);
    assert.deepEqual([...data.subarray(10, 16)], [0, 0, 0, 0, 0, 0]);
  }
  assert.equal(vectors[1][16], 1);
  assert.equal(vectors[5][16], 2);
  assert.equal(vectors[5][17], 1);
  assert.equal(vectors[5].readUInt32LE(20), 3);
  assert.equal(vectors[6].readBigUInt64LE(16), 4n);
  assert.equal(vectors[6].readBigUInt64LE(24), 5n);
  assert.equal(vectors[7].readBigUInt64LE(16), 6n);
  assert.equal(vectors[8].readBigUInt64LE(16), 7n);
  assert.equal(vectors[9][16], 1);
  assert.equal(vectors[12].readBigUInt64LE(16), 8n);
});

test("the named unsigned registry builds every discriminant with exact ordered metas", () => {
  assert.equal(IAT_B3_PRODUCTION_UNSIGNED_BUILDERS.length, 15);
  for (let opcode = 0; opcode < 15; opcode += 1) {
    const variant = opcode === 6 ? "BASE" : undefined;
    const instruction = IAT_B3_PRODUCTION_UNSIGNED_BUILDERS[opcode](buildInput(opcode, { variant }));
    assert.ok(instruction instanceof TransactionInstruction);
    assert.ok(instruction.programId.equals(PROGRAM_ID));
    assert.equal(instruction.data[9], opcode);
    assert.equal(instruction.keys[0].pubkey.toBase58(), LAW_STATE.toBase58());
    assert.deepEqual(
      instruction.keys.map(({ isSigner, isWritable }) => ({ isSigner, isWritable })),
      selectedVariant(MAP.operations[opcode], PAYLOADS[opcode], variant).metas
        .map(({ isSigner, isWritable }) => ({ isSigner, isWritable })),
    );
  }
});

test("Open variants and lane-conditional claim variants use only their exact production layouts", () => {
  const base = buildIatB3ProductionInstruction({ ...buildInput(6, { variant: "BASE" }), operation: 6 });
  const delegate = buildIatB3ProductionInstruction({ ...buildInput(6, { variant: "RESTORE_DELEGATE" }), operation: 6 });
  assert.equal(base.keys.length, 17);
  assert.equal(delegate.keys.length, 18);
  const ambiguousOpen = buildInput(6, { variant: "BASE" });
  delete ambiguousOpen.variant;
  assert.throws(
    () => buildIatB3ProductionInstruction({ ...ambiguousOpen, operation: 6 }),
    /variant must be explicitly BASE or RESTORE_DELEGATE/u,
  );

  const active = buildIatB3ProductionInstruction({ ...buildInput(9), operation: 9 });
  const corePayload = { lane: 3 };
  const core = buildIatB3ProductionInstruction({ ...buildInput(9, { payload: corePayload }), operation: 9 });
  const invalidPayload = { lane: 0 };
  const invalid = buildIatB3ProductionInstruction({ ...buildInput(9, { payload: invalidPayload }), operation: 9 });
  assert.equal(active.keys.length, 12);
  assert.equal(core.keys.length, 1);
  assert.equal(invalid.keys.length, 1);
  assert.throws(
    () => buildIatB3ProductionInstruction({
      ...buildInput(9, { payload: corePayload }), operation: 9, variant: "NON_CORE_ACTIVE",
    }),
    /variant is derived as CORE_CUSTODY_HOLD/u,
  );
});

test("fixed standard programs and source-derived PDAs cannot be overridden or aliased", () => {
  const instruction = buildIatB3ProductionInstruction({ ...buildInput(10), operation: 10 });
  assert.ok(instruction.keys.some(({ pubkey }) => pubkey.equals(TOKEN_2022_PROGRAM_ID)));
  assert.ok(instruction.keys.some(({ pubkey }) => pubkey.equals(IAT_B3_ZK_ELGAMAL_PROOF_PROGRAM_ID)));
  assert.ok(instruction.keys.some(({ pubkey }) => pubkey.equals(LAW_PROGRAM_ID)));
  assert.ok(!instruction.keys.some(({ pubkey }) => pubkey.equals(SystemProgram.programId)));

  assert.throws(
    () => buildIatB3ProductionInstruction({ ...buildInput(0), operation: 0, dailyLawState: PublicKey.unique() }),
    /dailyLawState does not match/u,
  );
  assert.throws(
    () => buildIatB3ProductionInstruction({ ...buildInput(0), operation: 0, lawProgramId: PROGRAM_ID }),
    /programId aliases lawProgramId/u,
  );
  const wrongConfig = buildInput(10);
  wrongConfig.accounts = { ...wrongConfig.accounts, config: PublicKey.unique() };
  assert.throws(
    () => buildIatB3ProductionInstruction({ ...wrongConfig, operation: 10 }),
    /config does not match/u,
  );
  const fixedOverride = buildInput(10);
  fixedOverride.accounts = { ...fixedOverride.accounts, token_program: TOKEN_2022_PROGRAM_ID };
  assert.throws(
    () => buildIatB3ProductionInstruction({ ...fixedOverride, operation: 10 }),
    /accounts keys must be exactly/u,
  );
  const alias = buildInput(5);
  alias.accounts = { ...alias.accounts, admin: LAW_STATE };
  assert.throws(
    () => buildIatB3ProductionInstruction({ ...alias, operation: 5 }),
    /account alias/u,
  );
});

test("only prior_delegate may alias an operation account and receives effective privilege union", () => {
  const ownerAlias = buildInput(6, { variant: "RESTORE_DELEGATE" });
  ownerAlias.accounts = {
    ...ownerAlias.accounts,
    prior_delegate: ownerAlias.accounts.owner,
  };
  const instruction = buildIatB3ProductionInstruction({ ...ownerAlias, operation: 6 });
  const owner = instruction.keys[1];
  const priorDelegate = instruction.keys[17];
  assert.ok(owner.pubkey.equals(priorDelegate.pubkey));
  assert.deepEqual(
    [owner.isSigner, owner.isWritable, priorDelegate.isSigner, priorDelegate.isWritable],
    [true, true, true, true],
  );

  const duplicateLaw = buildInput(6, { variant: "RESTORE_DELEGATE" });
  duplicateLaw.accounts = { ...duplicateLaw.accounts, prior_delegate: LAW_STATE };
  assert.throws(
    () => buildIatB3ProductionInstruction({ ...duplicateLaw, operation: 6 }),
    /duplicate Daily Law account alias is forbidden/u,
  );

  const fixedProgramAlias = buildInput(6, { variant: "RESTORE_DELEGATE" });
  fixedProgramAlias.accounts = {
    ...fixedProgramAlias.accounts,
    prior_delegate: TOKEN_2022_PROGRAM_ID,
  };
  assert.throws(
    () => buildIatB3ProductionInstruction({ ...fixedProgramAlias, operation: 6 }),
    /account alias/u,
  );

  const ordinaryAlias = buildInput(5);
  ordinaryAlias.accounts = { ...ordinaryAlias.accounts, admin: ordinaryAlias.accounts.wallet };
  assert.throws(
    () => buildIatB3ProductionInstruction({ ...ordinaryAlias, operation: 5 }),
    /account alias/u,
  );
});

test("malformed payloads, stale maps, missing accounts, and rehearsal-only shapes fail closed", () => {
  assert.throws(
    () => encodeIatB3ProductionInstruction({
      transactionMap: MAP, operation: 6, payload: { position_id: 4, principal: 5n },
    }),
    /position_id must be a bigint/u,
  );
  assert.throws(
    () => encodeIatB3ProductionInstruction({
      transactionMap: MAP, operation: 5, payload: { role: 2, agency_index: undefined },
    }),
    /agency_index must be a u32/u,
  );
  assert.throws(
    () => encodeIatB3ProductionInstruction({ transactionMap: MAP, operation: 11, payload: { extra: 1 } }),
    /payload keys must be exactly/u,
  );
  const missing = buildInput(11);
  delete missing.accounts.liquidity;
  assert.throws(
    () => buildIatB3ProductionInstruction({ ...missing, operation: 11 }),
    /accounts keys must be exactly/u,
  );
  const rehearsalRound = buildInput(7);
  rehearsalRound.accounts = { ...rehearsalRound.accounts, round: PublicKey.unique() };
  assert.throws(
    () => buildIatB3ProductionInstruction({ ...rehearsalRound, operation: 7 }),
    /accounts keys must be exactly/u,
  );
  const stale = structuredClone(MAP);
  stale.operations[7].variants[0].totalMetaCount = 18;
  assert.throws(() => validateIatB3ProductionTransactionMaps(stale), /operations differs/u);
});

test("source extraction rejects dispatcher, executor, and write-gate truth drift", () => {
  const dispatchDrift = sourceInput();
  dispatchDrift.dispatchSource = dispatchDrift.dispatchSource.replace(
    "PRODUCTION_ACTIVE_HANDLER_COUNT: usize = 6",
    "PRODUCTION_ACTIVE_HANDLER_COUNT: usize = 7",
  );
  assert.throws(() => extractIatB3ProductionTransactionMaps(dispatchDrift), /six active handlers/u);

  const executorDrift = sourceInput();
  executorDrift.openExecutorSource = executorDrift.openExecutorSource.replace(
    "PRODUCTION_OPEN_POSITION_EXECUTOR_BASE_ACCOUNT_COUNT: usize = 17",
    "PRODUCTION_OPEN_POSITION_EXECUTOR_BASE_ACCOUNT_COUNT: usize = 16",
  );
  assert.throws(() => extractIatB3ProductionTransactionMaps(executorDrift), /open base total/u);

  const gatesDrift = sourceInput();
  const gates = JSON.parse(gatesDrift.economicWriteGatesSource);
  gates.currentProductionSourceSurface.all15HandlersActive = true;
  gatesDrift.economicWriteGatesSource = JSON.stringify(gates);
  assert.throws(() => extractIatB3ProductionTransactionMaps(gatesDrift), /readiness truth drift/u);
});

test("every client PDA seed and first-stage account-order source binding fails closed on mutation", () => {
  const probes = [
    ...[
      ["CONFIG", "config"], ["VAULT_AUTHORITY", "vault-authority"],
      ["LANE_STATE", "lane"], ["LANE_TOKEN", "lane-token"],
      ["STAKE_TOKEN", "stake-token"], ["STAKE_INGRESS", "stake-ingress"],
      ["ELIGIBILITY", "eligibility"], ["POSITION", "position"],
    ].map(([constant, seed]) => ({
      sourceKey: "nativeAdapterSource",
      label: `${seed} PDA seed`,
      pattern: new RegExp(`pub const ${constant}_SEED: &\\[u8\\] = b"${seed}";`, "u"),
    })),
    { sourceKey: "entrypointSource", label: "Law PDA seed", pattern: /const LAW_STATE_SEED:\s*&\[u8\]\s*=\s*b"law-state"/u },
    { sourceKey: "openPositionSource", label: "open first-stage count", pattern: /PRODUCTION_OPEN_POSITION_ACCOUNT_COUNT:\s*usize\s*=\s*12/u },
    { sourceKey: "openPositionSource", label: "open owner slot 0", pattern: /authenticate_system_payer_account_info\(gate, binding, &accounts\[0\], owner\)/u },
    { sourceKey: "openPositionSource", label: "open config slot 1", pattern: /authenticate_runtime_production_active_writable_config\([^;]*&accounts\[1\]/su },
    { sourceKey: "openPositionSource", label: "open eligibility slot 2", pattern: /authenticate_readonly_eligibility\(binding, &accounts\[2\]/u },
    { sourceKey: "openPositionSource", label: "open mint slot 3", pattern: /require_mint_meta\(binding, &accounts\[3\]\)/u },
    { sourceKey: "openPositionSource", label: "open source-token slot 4", pattern: /observe_stake_ingress_source\(&accounts\[4\]/u },
    { sourceKey: "openPositionSource", label: "open stake-token slot 5", pattern: /observe_stake_ingress_vault\(&accounts\[5\]/u },
    { sourceKey: "openPositionSource", label: "open treasury slot 6", pattern: /authenticate_lane\(gate, binding, &accounts\[6\][^;]*TREASURY/su },
    { sourceKey: "openPositionSource", label: "open ecosystem slot 7", pattern: /authenticate_lane\(gate, binding, &accounts\[7\][^;]*ECOSYSTEM/su },
    { sourceKey: "openPositionSource", label: "open liquidity slot 8", pattern: /authenticate_lane\(gate, binding, &accounts\[8\][^;]*LIQUIDITY/su },
    { sourceKey: "openPositionSource", label: "open position slot 9", pattern: /require_create_target\(&accounts\[9\], position\.key\)/u },
    { sourceKey: "openPositionSource", label: "open token-program slot 10", pattern: /require_token_program\(&accounts\[10\]\)/u },
    { sourceKey: "openPositionSource", label: "open system-program slot 11", pattern: /require_system_program\(&accounts\[11\]\)/u },
    { sourceKey: "claimLanePrincipalSource", label: "claim first-stage count", pattern: /PRODUCTION_CLAIM_LANE_PRINCIPAL_ACCOUNT_COUNT:\s*usize\s*=\s*8/u },
    { sourceKey: "claimLanePrincipalSource", label: "claim caller slot 0", pattern: /authenticate_caller\(gate, binding, &accounts\[0\]\)/u },
    { sourceKey: "claimLanePrincipalSource", label: "claim config slot 1", pattern: /authenticate_runtime_production_active_config\([^;]*&accounts\[1\]/su },
    { sourceKey: "claimLanePrincipalSource", label: "claim mint slot 2", pattern: /require_mint_meta\(binding, &accounts\[2\]\)/u },
    { sourceKey: "claimLanePrincipalSource", label: "claim vault slot 3", pattern: /require_vault_authority_meta\(&accounts\[3\]/u },
    { sourceKey: "claimLanePrincipalSource", label: "claim lane slot 4", pattern: /authenticate_lane\(gate, binding, &accounts\[4\]/u },
    { sourceKey: "claimLanePrincipalSource", label: "claim source-token slot 5", pattern: /require_source_token_meta\(&accounts\[5\]/u },
    { sourceKey: "claimLanePrincipalSource", label: "claim destination-token slot 6", pattern: /let destination_before = observe_stake_ingress_source\(\s*&accounts\[6\]/u },
    { sourceKey: "claimLanePrincipalSource", label: "claim token-program slot 7", pattern: /require_token_program\(&accounts\[7\]\)/u },
    { sourceKey: "withdrawPositionSource", label: "withdraw first-stage count", pattern: /PRODUCTION_WITHDRAW_POSITION_ACCOUNT_COUNT:\s*usize\s*=\s*8/u },
    { sourceKey: "withdrawPositionSource", label: "withdraw caller slot 0", pattern: /authenticate_caller\(gate, binding, &accounts\[0\]\)/u },
    { sourceKey: "withdrawPositionSource", label: "withdraw config slot 1", pattern: /authenticate_runtime_production_active_writable_config\([^;]*&accounts\[1\]/su },
    { sourceKey: "withdrawPositionSource", label: "withdraw position slot 2", pattern: /authenticate_position\(gate, binding, &accounts\[2\]/u },
    { sourceKey: "withdrawPositionSource", label: "withdraw mint slot 3", pattern: /require_mint_meta\(binding, &accounts\[3\]\)/u },
    { sourceKey: "withdrawPositionSource", label: "withdraw vault slot 4", pattern: /require_vault_authority_meta\(&accounts\[4\]/u },
    { sourceKey: "withdrawPositionSource", label: "withdraw source-token slot 5", pattern: /observe_stake_ingress_vault\(&accounts\[5\]/u },
    { sourceKey: "withdrawPositionSource", label: "withdraw destination-token slot 6", pattern: /let destination = observe_stake_ingress_source\(\s*&accounts\[6\]/u },
    { sourceKey: "withdrawPositionSource", label: "withdraw token-program slot 7", pattern: /require_token_program\(&accounts\[7\]\)/u },
    { sourceKey: "stakeIngressRuntimeSource", label: "prior-delegate effective privilege union", pattern: /duplicate metas[\s\S]*delegate == owner[\s\S]*inherit unified transaction privileges/u },
    { sourceKey: "openExecutorSource", label: "owner\/prior-delegate alias positive case", pattern: /Duplicate outer metas inherit the owner's effective privileges/u },
  ];

  for (const { sourceKey, label, pattern } of probes) {
    const drift = sourceInput();
    const match = pattern.exec(drift[sourceKey]);
    assert.ok(match, `test probe exists: ${label}`);
    drift[sourceKey] = `${drift[sourceKey].slice(0, match.index)}R03_SEMANTIC_DRIFT${drift[sourceKey].slice(match.index + match[0].length)}`;
    assert.throws(
      () => extractIatB3ProductionTransactionMaps(drift),
      new RegExp(label.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"),
      label,
    );
  }
});

test("every mapped active-account signer, writable, and executable source shape rejects mutation", () => {
  for (const probe of IAT_B3_PRODUCTION_META_SHAPE_PROBES) {
    for (const property of ["isSigner", "isWritable", "executable"]) {
      const drift = sourceInput();
      drift[probe.sourceKey] = mutateFixturePrivilege(drift[probe.sourceKey], probe, property);
      assert.throws(
        () => extractIatB3ProductionTransactionMaps(drift),
        new RegExp(probe.label.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"),
        `${probe.label}/${property}`,
      );
    }
  }
});

test("production client remains offline, unsigned, and unable to compose transaction authority", () => {
  const client = read("programs/iat_b3_economy/production-client.mjs");
  for (const forbidden of [
    /\bConnection\b/u,
    /\bKeypair\b/u,
    /sendAndConfirmTransaction/u,
    /sendRawTransaction/u,
    /recentBlockhash/u,
    /feePayer/u,
    /\.sign\(/u,
    /https?:\/\//u,
  ]) {
    assert.doesNotMatch(client, forbidden);
  }
});
