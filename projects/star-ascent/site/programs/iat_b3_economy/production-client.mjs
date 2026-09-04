import { Buffer } from "node:buffer";

import { getExtraAccountMetaAddress, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";

import { validateIatB3ProductionTransactionMaps } from
  "../../scripts/lib/iat-b3-production-transaction-map.mjs";

export const IAT_B3_PRODUCTION_OPERATIONS = Object.freeze({
  INITIALIZE_CONFIG: 0,
  INITIALIZE_LANE_VAULT: 1,
  INITIALIZE_STAKE_VAULT: 2,
  ACTIVATE: 3,
  REGISTER_AGENCY: 4,
  SET_ELIGIBILITY: 5,
  OPEN_POSITION: 6,
  SETTLE_POSITION_WEEK: 7,
  SETTLE_CORE_WEEK: 8,
  CLAIM_LANE_PRINCIPAL: 9,
  WITHDRAW_POSITION_PRINCIPAL: 10,
  CLOSE_POSITION: 11,
  COMMIT_ROUND: 12,
  SETTLE_ROUND: 13,
  EXPIRE_ROUND: 14,
});

export const IAT_B3_ZK_ELGAMAL_PROOF_PROGRAM_ID = new PublicKey(
  "ZkE1Gama1Proof11111111111111111111111111111",
);

const MAX_U64 = (1n << 64n) - 1n;
const textEncoder = new TextEncoder();

function fail(message) {
  throw new TypeError(`IAT B3 production client: ${message}`);
}

function publicKey(value, label) {
  try {
    return value instanceof PublicKey ? value : new PublicKey(value);
  } catch {
    fail(`${label} must be a valid PublicKey`);
  }
}

function assertExactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(`${label} keys must be exactly [${wanted.join(", ")}]; received [${actual.join(", ")}]`);
  }
}

function operationFrom(map, value) {
  const operation = typeof value === "number"
    ? map.operations.find((candidate) => candidate.opcode === value)
    : map.operations.find((candidate) => candidate.name === value || candidate.rustVariant === value);
  if (!operation) fail("operation must identify one of the exact 15 production discriminants");
  return operation;
}

function checkedU8(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) fail(`${label} must be a u8 integer`);
  return value;
}

function checkedU32(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) fail(`${label} must be a u32 integer`);
  return value;
}

function checkedU64(value, label) {
  if (typeof value !== "bigint" || value < 0n || value > MAX_U64) {
    fail(`${label} must be a bigint in the u64 range`);
  }
  return value;
}

function encodeForOperation(operation, payload) {
  const expectedPayloadKeys = operation.payload.map(({ name }) => name);
  assertExactKeys(payload, expectedPayloadKeys, `${operation.name} payload`);
  const data = Buffer.alloc(32);
  data.set(textEncoder.encode("IATB3EC1"), 0);
  data[8] = 1;
  data[9] = operation.opcode;

  for (const field of operation.payload) {
    const value = payload[field.name];
    if (field.type === "u8") {
      data[16] = checkedU8(value, field.name);
    } else if (field.type === "u64") {
      const offset = field.name === "principal" ? 24 : 16;
      data.writeBigUInt64LE(checkedU64(value, field.name), offset);
    } else if (field.type === "option_u32") {
      if (value !== null) {
        data[17] = 1;
        data.writeUInt32LE(checkedU32(value, field.name), 20);
      }
    } else {
      fail(`unsupported source-bound payload type ${field.type}`);
    }
  }
  return data;
}

export function encodeIatB3ProductionInstruction({ transactionMap, operation, payload = {} }) {
  validateIatB3ProductionTransactionMaps(transactionMap);
  return encodeForOperation(operationFrom(transactionMap, operation), payload);
}

function selectedVariant(operation, payload, requestedVariant) {
  let expected;
  if (operation.opcode === IAT_B3_PRODUCTION_OPERATIONS.OPEN_POSITION) {
    if (requestedVariant !== "BASE" && requestedVariant !== "RESTORE_DELEGATE") {
      fail("open_position variant must be explicitly BASE or RESTORE_DELEGATE");
    }
    expected = requestedVariant;
  } else if (operation.opcode === IAT_B3_PRODUCTION_OPERATIONS.CLAIM_LANE_PRINCIPAL) {
    const lane = checkedU8(payload.lane, "lane");
    expected = [1, 2, 4].includes(lane)
      ? "NON_CORE_ACTIVE"
      : lane === 3 ? "CORE_CUSTODY_HOLD" : "INVALID_LANE";
    if (requestedVariant !== undefined && requestedVariant !== expected) {
      fail(`claim_lane_principal variant is derived as ${expected}`);
    }
  } else {
    expected = operation.variants[0].name;
    if (requestedVariant !== undefined && requestedVariant !== expected) {
      fail(`${operation.name} only supports variant ${expected}`);
    }
  }
  return operation.variants.find(({ name }) => name === expected);
}

function assertEquals(actual, expected, label) {
  if (!actual.equals(expected)) fail(`${label} does not match its canonical production identity`);
}

function pda(programId, seeds) {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

function u64Bytes(value) {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(value);
  return bytes;
}

function validateDerivedAccountRoles(operation, payload, accounts, programId, canonicalMint, seeds) {
  if (!Object.hasOwn(accounts, "config")) return;
  const config = accounts.config;
  assertEquals(config, pda(programId, [Buffer.from(seeds.config), canonicalMint.toBuffer()]), "config");

  if (Object.hasOwn(accounts, "vault_authority")) {
    assertEquals(
      accounts.vault_authority,
      pda(programId, [Buffer.from(seeds.vaultAuthority), config.toBuffer()]),
      "vault_authority",
    );
  }
  if (Object.hasOwn(accounts, "stake_tokens")) {
    assertEquals(accounts.stake_tokens, pda(programId, [Buffer.from(seeds.stakeToken), config.toBuffer()]), "stake_tokens");
  }
  if (Object.hasOwn(accounts, "ingress_authority")) {
    assertEquals(accounts.ingress_authority, pda(programId, [Buffer.from(seeds.stakeIngress), config.toBuffer()]), "ingress_authority");
  }
  if (Object.hasOwn(accounts, "eligibility")) {
    const operator = operation.opcode === 5 ? accounts.wallet : accounts.owner;
    if (operator) {
      assertEquals(
        accounts.eligibility,
        pda(programId, [Buffer.from(seeds.eligibility), config.toBuffer(), operator.toBuffer()]),
        "eligibility",
      );
    }
  }
  if (operation.opcode === 6 && Object.hasOwn(accounts, "position")) {
    assertEquals(
      accounts.position,
      pda(programId, [
        Buffer.from(seeds.position), config.toBuffer(), accounts.owner.toBuffer(),
        u64Bytes(checkedU64(payload.position_id, "position_id")),
      ]),
      "position",
    );
  }

  const laneRoles = [
    ["treasury", seeds.laneState, 1], ["treasury_tokens", seeds.laneToken, 1],
    ["ecosystem", seeds.laneState, 2], ["ecosystem_tokens", seeds.laneToken, 2],
    ["liquidity", seeds.laneState, 4], ["liquidity_tokens", seeds.laneToken, 4],
  ];
  for (const [role, seed, lane] of laneRoles) {
    if (Object.hasOwn(accounts, role)) {
      assertEquals(accounts[role], pda(programId, [Buffer.from(seed), config.toBuffer(), Buffer.from([lane])]), role);
    }
  }
  if (Object.hasOwn(accounts, "lane_state")) {
    const lane = checkedU8(payload.lane, "lane");
    assertEquals(accounts.lane_state, pda(programId, [Buffer.from(seeds.laneState), config.toBuffer(), Buffer.from([lane])]), "lane_state");
  }
  if (Object.hasOwn(accounts, "lane_tokens")) {
    const lane = checkedU8(payload.lane, "lane");
    assertEquals(accounts.lane_tokens, pda(programId, [Buffer.from(seeds.laneToken), config.toBuffer(), Buffer.from([lane])]), "lane_tokens");
  }
}

function fixedKey(binding, context) {
  switch (binding) {
    case "dailyLawState": return context.dailyLawState;
    case "canonicalMint": return context.canonicalMint;
    case "token2022Program": return TOKEN_2022_PROGRAM_ID;
    case "systemProgram": return SystemProgram.programId;
    case "zkElgamalProofProgram": return IAT_B3_ZK_ELGAMAL_PROOF_PROGRAM_ID;
    case "lawProgram": return context.lawProgramId;
    case "hookValidationPda": return getExtraAccountMetaAddress(context.canonicalMint, context.lawProgramId);
    case "stakeIngressPda": return pda(
      context.programId,
      [Buffer.from(context.seeds.stakeIngress), context.accounts.config.toBuffer()],
    );
    default: fail(`unknown fixed binding ${binding}`);
  }
}

export function buildIatB3ProductionInstruction({
  transactionMap,
  programId: rawProgramId,
  lawProgramId: rawLawProgramId,
  canonicalMint: rawCanonicalMint,
  dailyLawState: rawDailyLawState,
  operation: rawOperation,
  payload = {},
  accounts = {},
  variant,
}) {
  validateIatB3ProductionTransactionMaps(transactionMap);
  const operation = operationFrom(transactionMap, rawOperation);
  const data = encodeForOperation(operation, payload);
  const selected = selectedVariant(operation, payload, variant);
  const programId = publicKey(rawProgramId, "programId");
  const lawProgramId = publicKey(rawLawProgramId, "lawProgramId");
  const canonicalMint = publicKey(rawCanonicalMint, "canonicalMint");
  const dailyLawState = publicKey(rawDailyLawState, "dailyLawState");

  const protectedKeys = [
    [programId, "programId"], [lawProgramId, "lawProgramId"], [canonicalMint, "canonicalMint"],
    [TOKEN_2022_PROGRAM_ID, "Token-2022 program"], [SystemProgram.programId, "system program"],
    [IAT_B3_ZK_ELGAMAL_PROOF_PROGRAM_ID, "zk ElGamal proof program"],
  ];
  for (let left = 0; left < protectedKeys.length; left += 1) {
    for (let right = left + 1; right < protectedKeys.length; right += 1) {
      if (protectedKeys[left][0].equals(protectedKeys[right][0])) {
        fail(`${protectedKeys[left][1]} aliases ${protectedKeys[right][1]}`);
      }
    }
  }
  assertEquals(
    dailyLawState,
    pda(lawProgramId, [Buffer.from(transactionMap.pdaSeeds.lawState), canonicalMint.toBuffer()]),
    "dailyLawState",
  );

  const accountRoles = selected.metas.filter(({ binding }) => binding === "account").map(({ role }) => role);
  assertExactKeys(accounts, accountRoles, `${operation.name}/${selected.name} accounts`);
  const normalizedAccounts = Object.fromEntries(
    accountRoles.map((role) => [role, publicKey(accounts[role], `accounts.${role}`)]),
  );
  validateDerivedAccountRoles(
    operation,
    payload,
    normalizedAccounts,
    programId,
    canonicalMint,
    transactionMap.pdaSeeds,
  );

  const context = {
    programId,
    lawProgramId,
    canonicalMint,
    dailyLawState,
    accounts: normalizedAccounts,
    seeds: transactionMap.pdaSeeds,
  };
  const keys = selected.metas.map((slot) => ({
    pubkey: slot.binding === "account" ? normalizedAccounts[slot.role] : fixedKey(slot.binding, context),
    isSigner: slot.isSigner,
    isWritable: slot.isWritable,
  }));
  const groups = new Map();
  for (const [index, key] of keys.entries()) {
    const encoded = key.pubkey.toBase58();
    if (key.pubkey.equals(programId)) fail(`transaction meta ${index} aliases the economy program id`);
    const group = groups.get(encoded) ?? [];
    group.push(index);
    groups.set(encoded, group);
  }
  for (const indices of groups.values()) {
    if (indices.length === 1) continue;
    const slots = indices.map((index) => selected.metas[index]);
    if (slots.some(({ role }) => role === transactionMap.transactionPrefix.role)) {
      fail("duplicate Daily Law account alias is forbidden");
    }
    const policy = transactionMap.accountAliasPolicy.approvedPriorDelegate;
    const priorDelegateSlots = slots.filter(({ role }) => role === policy.role);
    const counterparts = slots.filter(({ role }) => role !== policy.role);
    const approved = operation.opcode === policy.opcode
      && selected.name === policy.variant
      && indices.length <= policy.maximumGroupSize
      && priorDelegateSlots.length === 1
      && counterparts.length === 1
      && counterparts[0].binding === policy.counterpartBinding;
    if (!approved) {
      fail(`account alias between transaction metas ${indices.join(" and ")}`);
    }
    const effectiveSigner = indices.some((index) => keys[index].isSigner);
    const effectiveWritable = indices.some((index) => keys[index].isWritable);
    for (const index of indices) {
      keys[index].isSigner = effectiveSigner;
      keys[index].isWritable = effectiveWritable;
    }
  }

  return new TransactionInstruction({ programId, keys, data });
}

const namedBuilder = (operation) => (input) => buildIatB3ProductionInstruction({ ...input, operation });

export const buildInitializeConfigInstruction = namedBuilder(0);
export const buildInitializeLaneVaultInstruction = namedBuilder(1);
export const buildInitializeStakeVaultInstruction = namedBuilder(2);
export const buildActivateInstruction = namedBuilder(3);
export const buildRegisterAgencyInstruction = namedBuilder(4);
export const buildSetEligibilityInstruction = namedBuilder(5);
export const buildOpenPositionInstruction = namedBuilder(6);
export const buildSettlePositionWeekInstruction = namedBuilder(7);
export const buildSettleCoreWeekInstruction = namedBuilder(8);
export const buildClaimLanePrincipalInstruction = namedBuilder(9);
export const buildWithdrawPositionPrincipalInstruction = namedBuilder(10);
export const buildClosePositionInstruction = namedBuilder(11);
export const buildCommitRoundInstruction = namedBuilder(12);
export const buildSettleRoundInstruction = namedBuilder(13);
export const buildExpireRoundInstruction = namedBuilder(14);

export const IAT_B3_PRODUCTION_UNSIGNED_BUILDERS = Object.freeze([
  buildInitializeConfigInstruction,
  buildInitializeLaneVaultInstruction,
  buildInitializeStakeVaultInstruction,
  buildActivateInstruction,
  buildRegisterAgencyInstruction,
  buildSetEligibilityInstruction,
  buildOpenPositionInstruction,
  buildSettlePositionWeekInstruction,
  buildSettleCoreWeekInstruction,
  buildClaimLanePrincipalInstruction,
  buildWithdrawPositionPrincipalInstruction,
  buildClosePositionInstruction,
  buildCommitRoundInstruction,
  buildSettleRoundInstruction,
  buildExpireRoundInstruction,
]);
