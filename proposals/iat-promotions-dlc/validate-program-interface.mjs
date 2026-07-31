/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { fileURLToPath } from "node:url";

import {
  deriveDiscriminatorHex,
  instructionEncodedLength,
  loadProgramInterface,
} from "./program-interface-codec.mjs";

const REQUIRED_ACCOUNTS = [
  "Campaign",
  "Nomination",
  "HeroReservation",
  "RoleMarker",
  "SettlementReceipt",
];
const REQUIRED_INSTRUCTIONS = [
  "initialize_campaign",
  "fund_campaign",
  "activate_campaign",
  "cancel_campaign_pre_activation",
  "nominate_hero",
  "cancel_nomination",
  "settle_pair",
  "finalize_exhausted_surplus",
];
const FORBIDDEN_ACCOUNT_PATTERN = /(treasury|ecosystem|liquidity|core_team|staking_reserve|mint_authority|v2_upgrade)/i;

export function validateProgramInterface(definition) {
  const errors = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };

  expect(definition?.interfaceVersion === 0, "interfaceVersion must remain zero");
  expect(definition?.proposalId === "iat-promotions-dlc-v0", "proposal ID mismatch");
  expect(
    JSON.stringify(definition?.status?.labels) ===
      JSON.stringify(["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"]),
    "public status labels mismatch",
  );
  expect(definition?.status?.network === "NONE", "interface must remain network-free");
  expect(definition?.status?.programId === null, "interface must not claim a program ID");
  expect(definition?.codec?.discriminatorBytes === 8, "discriminators must be eight bytes");
  expect(definition?.codec?.integerEndian === "little", "integer encoding must be little-endian");
  expect(definition?.codec?.variableLengthFields === false, "instruction data must remain fixed-length");

  const economics = definition?.economics ?? {};
  expect(economics.heroRewardBaseUnits === "120000000000", "hero reward mismatch");
  expect(economics.proposerRewardBaseUnits === "60000000000", "proposer reward mismatch");
  expect(economics.pairRewardBaseUnits === "180000000000", "pair reward mismatch");
  expect(economics.maximumCompletedPairs === 1000, "pair cap mismatch");
  expect(economics.maximumBudgetBaseUnits === "180000000000000", "budget mismatch");

  const boundary = definition?.vaultBoundary ?? {};
  expect(boundary.scope === "PROMOTIONS_DLC_ONLY", "vault scope mismatch");
  expect(boundary.activeWithdrawal === false, "active withdrawal must remain impossible");
  expect(boundary.preActivationRefundOnly === true, "refund must remain pre-activation only");
  expect(boundary.postExhaustionSurplusReturnOnly === true, "surplus return must remain post-exhaustion only");
  expect(boundary.externalV2AccountsWritable === false, "external V2 accounts must never be writable");

  const accountNames = definition?.accounts?.map((account) => account.name) ?? [];
  expect(JSON.stringify(accountNames) === JSON.stringify(REQUIRED_ACCOUNTS), "account set or order mismatch");
  expect(new Set(accountNames).size === accountNames.length, "duplicate account definition");
  for (const account of definition?.accounts ?? []) {
    expect(
      account.discriminatorHex === deriveDiscriminatorHex("account", account.name, definition),
      `${account.name} discriminator mismatch`,
    );
    expect(Array.isArray(account.seeds) && account.seeds.length > 0, `${account.name} seeds missing`);
    const fieldNames = account.fields.map((field) => field.name);
    expect(new Set(fieldNames).size === fieldNames.length, `${account.name} has duplicate fields`);
    const computedSize = definition.codec.discriminatorBytes + account.fields.reduce(
      (total, field) => total + field.sizeBytes,
      0,
    );
    expect(computedSize === account.sizeBytes, `${account.name} size mismatch`);
  }

  const instructionNames = definition?.instructions?.map((instruction) => instruction.name) ?? [];
  expect(
    JSON.stringify(instructionNames) === JSON.stringify(REQUIRED_INSTRUCTIONS),
    "instruction set or order mismatch",
  );
  expect(new Set(instructionNames).size === instructionNames.length, "duplicate instruction definition");
  const discriminators = new Set();
  for (const instruction of definition?.instructions ?? []) {
    expect(
      instruction.discriminatorHex === deriveDiscriminatorHex("instruction", instruction.name, definition),
      `${instruction.name} discriminator mismatch`,
    );
    expect(!discriminators.has(instruction.discriminatorHex), `${instruction.name} discriminator collision`);
    discriminators.add(instruction.discriminatorHex);
    const accountMetaNames = instruction.accounts.map((account) => account.name);
    expect(
      new Set(accountMetaNames).size === accountMetaNames.length,
      `${instruction.name} repeats an account meta`,
    );
    expect(
      accountMetaNames.every((name) => !FORBIDDEN_ACCOUNT_PATTERN.test(name)),
      `${instruction.name} names a forbidden V2 capability account`,
    );
    const fieldNames = instruction.data.map((field) => field.name);
    expect(new Set(fieldNames).size === fieldNames.length, `${instruction.name} repeats a data field`);
    try {
      expect(instructionEncodedLength(instruction.name, definition) >= 8, `${instruction.name} length invalid`);
    } catch (error) {
      errors.push(`${instruction.name} codec failure: ${error.message}`);
    }
    expect(Array.isArray(instruction.guards) && instruction.guards.length > 0, `${instruction.name} guards missing`);
  }

  const fund = definition?.instructions?.find((instruction) => instruction.name === "fund_campaign");
  expect(fund?.guards?.includes("AMOUNT_EQUALS_180000000000000"), "funding hard cap guard missing");
  const settle = definition?.instructions?.find((instruction) => instruction.name === "settle_pair");
  expect(settle?.guards?.includes("HERO_AND_PROPOSER_TRANSFERS_ATOMIC"), "atomic transfer guard missing");
  expect(settle?.guards?.includes("ALL_SIX_ROLE_MARKERS_ABSENT"), "six-marker guard missing");
  expect(settle?.guards?.includes("PAIR_1000_EXPIRES_ALL_REMAINING_NOMINATIONS"), "terminal expiry guard missing");

  const forbidden = new Set(definition?.forbiddenCapabilities ?? []);
  for (const capability of [
    "MINT_AUTHORITY",
    "V2_UPGRADE_AUTHORITY",
    "TREASURY_ACCESS",
    "ECOSYSTEM_ACCESS",
    "LIQUIDITY_ACCESS",
    "CORE_TEAM_ACCESS",
    "STAKING_RESERVE_ACCESS",
    "ACTIVE_CAMPAIGN_WITHDRAWAL",
  ]) {
    expect(forbidden.has(capability), `forbidden capability missing: ${capability}`);
  }

  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateProgramInterface(loadProgramInterface());
  if (errors.length) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    process.exitCode = 1;
  } else {
    console.log("Promotions DLC program interface is internally consistent and remains undeployed.");
  }
}
