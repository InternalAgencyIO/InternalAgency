/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  deriveDiscriminatorHex,
  instructionEncodedLength,
} from "./program-interface-codec.mjs";

const amendmentPath = fileURLToPath(
  new URL("./program-interface-key-lifecycle-amendment.v1.json", import.meta.url),
);
const STATUS_LABELS = [
  "DRAFT",
  "INACTIVE",
  "NOT PART OF GENESIS",
  "NOT DEPLOYED",
  "NO CLAIM ROUTE",
];
const ACCOUNT_NAMES = ["VerifierRegistry", "VerifierKeyRecord", "VerifierReviewReceipt"];
const INSTRUCTION_NAMES = [
  "initialize_verifier_registry",
  "schedule_verifier_key_rotation",
  "activate_scheduled_verifier_key",
  "finalize_verifier_key_retirement",
  "emergency_disable_verifier_registry",
];
const EVENT_NAMES = [
  "VerifierRegistryInitialized",
  "VerifierKeyRotationScheduled",
  "VerifierKeyRotationActivated",
  "VerifierKeyRetirementFinalized",
  "VerifierRegistryEmergencyDisabled",
];
const FORBIDDEN_ACCOUNT_PATTERN =
  /(token|vault|mint|treasury|ecosystem|liquidity|core_team|staking|upgrade_authority)/i;

export function loadKeyLifecycleAmendment() {
  return JSON.parse(readFileSync(amendmentPath, "utf8"));
}

export function validateKeyLifecycleAmendment(definition) {
  const errors = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };

  expect(definition?.proposalId === "iat-promotions-dlc-key-lifecycle-v1", "proposal ID mismatch");
  expect(definition?.amendmentVersion === 1, "amendment version mismatch");
  expect(definition?.baseInterfaceVersion === 0, "base interface version mismatch");
  expect(
    JSON.stringify(definition?.status?.labels) === JSON.stringify(STATUS_LABELS),
    "public status labels mismatch",
  );
  expect(definition?.status?.network === "NONE", "amendment must remain network-free");
  expect(definition?.status?.programId === null, "amendment must not claim a program ID");
  expect(definition?.status?.baseV0Deployable === false, "v0 must remain explicitly undeployable");
  expect(definition?.status?.amendmentApplied === false, "amendment must remain unapplied");
  expect(definition?.reviewGate?.separateSecurityReviewRequired === true, "security review gate missing");
  expect(
    definition?.reviewGate?.independentReviewerApprovalRequired === true,
    "independent review gate missing",
  );
  expect(definition?.reviewGate?.devnetRehearsalRequired === true, "Devnet rehearsal gate missing");

  const policy = definition?.referencePolicy ?? {};
  expect(policy.minimumRotationNoticeSeconds === 86_400, "rotation notice mismatch");
  expect(policy.maximumRotationOverlapSeconds === 3_600, "rotation overlap mismatch");
  expect(policy.onePendingRotation === true, "single pending rotation guard missing");
  expect(policy.reviewIdsSingleUse === true, "review replay guard missing");
  expect(policy.publicKeyReuseForbidden === true, "public key reuse guard missing");
  expect(policy.identityDomainImmutable === true, "identity domain immutability missing");
  expect(policy.emergencyDisableImmediate === true, "immediate emergency disable missing");
  expect(policy.emergencyDisableTerminal === true, "terminal emergency disable missing");
  expect(policy.historicalVerificationPreserved === true, "historical verification rule missing");
  expect(policy.reenableInstructionExists === false, "re-enable path must not exist");

  expect(definition?.codec?.discriminatorBytes === 8, "discriminator size mismatch");
  expect(definition?.codec?.integerEndian === "little", "integer endian mismatch");
  expect(definition?.codec?.variableLengthFields === false, "instruction data must remain fixed-width");

  const changes = definition?.baseInterfaceChanges ?? {};
  expect(changes?.campaignFieldRemoval?.name === "verifier_ed25519_key", "v0 key field removal missing");
  expect(changes?.campaignFieldAddition?.name === "verifier_registry", "registry field addition missing");
  expect(
    JSON.stringify(changes.attestationInstructions) ===
      JSON.stringify(["nominate_hero", "cancel_nomination", "settle_pair"]),
    "attestation instruction amendment mismatch",
  );
  expect(
    JSON.stringify(changes.requiredReadOnlyAccounts) ===
      JSON.stringify(["verifier_registry", "verifier_key_record"]),
    "attestation read-only account amendment mismatch",
  );
  for (const guard of [
    "REGISTRY_NOT_EMERGENCY_DISABLED_AT_ISSUED_AT",
    "KEY_ACTIVATION_FINALIZED_AT_OR_BEFORE_ISSUED_AT",
    "KEY_NOT_RETIRED_AT_ISSUED_AT",
    "KEY_NOT_CANCELLED",
    "KEY_ID_MATCHES_SIGNED_ATTESTATION",
    "ED25519_PREINSTRUCTION_PUBLIC_KEY_MATCHES_KEY_RECORD",
    "IDENTITY_DOMAIN_MATCHES_REGISTRY",
  ]) {
    expect(changes.requiredAttestationGuards?.includes(guard), `attestation guard missing: ${guard}`);
  }

  const accountNames = definition?.accounts?.map((account) => account.name) ?? [];
  expect(JSON.stringify(accountNames) === JSON.stringify(ACCOUNT_NAMES), "account set or order mismatch");
  for (const account of definition?.accounts ?? []) {
    expect(
      account.discriminatorHex === deriveDiscriminatorHex("account", account.name, definition),
      `${account.name} discriminator mismatch`,
    );
    expect(Array.isArray(account.seeds) && account.seeds.length > 0, `${account.name} seeds missing`);
    const fieldNames = account.fields.map((field) => field.name);
    expect(new Set(fieldNames).size === fieldNames.length, `${account.name} duplicate field`);
    expect(
      fieldNames.every((name) => !/(private|secret|seed|mnemonic)/i.test(name)),
      `${account.name} contains a secret-bearing field name`,
    );
    const computedSize = definition.codec.discriminatorBytes + account.fields.reduce(
      (total, field) => total + field.sizeBytes,
      0,
    );
    expect(computedSize === account.sizeBytes, `${account.name} size mismatch`);
  }

  const instructionNames = definition?.instructions?.map((instruction) => instruction.name) ?? [];
  expect(
    JSON.stringify(instructionNames) === JSON.stringify(INSTRUCTION_NAMES),
    "instruction set or order mismatch",
  );
  expect(
    instructionNames.every((name) => !/(reenable|withdraw|transfer|mint)/i.test(name)),
    "forbidden lifecycle instruction exists",
  );
  const discriminators = new Set();
  for (const instruction of definition?.instructions ?? []) {
    expect(
      instruction.discriminatorHex ===
        deriveDiscriminatorHex("instruction", instruction.name, definition),
      `${instruction.name} discriminator mismatch`,
    );
    expect(!discriminators.has(instruction.discriminatorHex), `${instruction.name} discriminator collision`);
    discriminators.add(instruction.discriminatorHex);
    const accountMetaNames = instruction.accounts.map((account) => account.name);
    expect(new Set(accountMetaNames).size === accountMetaNames.length, `${instruction.name} duplicate account`);
    expect(
      accountMetaNames.every((name) => !FORBIDDEN_ACCOUNT_PATTERN.test(name)),
      `${instruction.name} includes a forbidden money or V2 account`,
    );
    try {
      expect(instructionEncodedLength(instruction.name, definition) >= 8, `${instruction.name} length invalid`);
    } catch (error) {
      errors.push(`${instruction.name} codec failure: ${error.message}`);
    }
    expect(Array.isArray(instruction.guards) && instruction.guards.length > 0, `${instruction.name} guards missing`);
  }

  const schedule = definition?.instructions?.find(
    (instruction) => instruction.name === "schedule_verifier_key_rotation",
  );
  for (const guard of [
    "NO_PENDING_ROTATION",
    "SEPARATE_REVIEW_AUTHORITY_SIGNS",
    "REVIEW_RECEIPT_MUST_NOT_EXIST",
    "ACTIVATE_AT_AT_LEAST_NOW_PLUS_86400",
    "OVERLAP_NOT_ABOVE_3600",
    "NEW_KEY_RECORD_MUST_NOT_EXIST",
    "IDENTITY_DOMAIN_IMMUTABLE",
  ]) {
    expect(schedule?.guards?.includes(guard), `schedule guard missing: ${guard}`);
  }
  const emergency = definition?.instructions?.find(
    (instruction) => instruction.name === "emergency_disable_verifier_registry",
  );
  for (const guard of [
    "SEPARATE_EMERGENCY_REVIEW_AUTHORITY_SIGNS",
    "DISABLED_AT_WRITTEN_FROM_CLOCK",
    "PENDING_UNACTIVATED_KEY_CANCELLED_IF_PRESENT",
    "EMERGENCY_DISABLE_TERMINAL",
    "NO_REENABLE_PATH",
  ]) {
    expect(emergency?.guards?.includes(guard), `emergency guard missing: ${guard}`);
  }
  expect(
    emergency?.accounts?.filter((account) => account.optional).map((account) => account.name).join(",") ===
      "pending_key_record",
    "emergency optional account contract mismatch",
  );

  expect(JSON.stringify(definition?.events) === JSON.stringify(EVENT_NAMES), "event set or order mismatch");
  const forbidden = new Set(definition?.forbiddenCapabilities ?? []);
  for (const capability of [
    "REENABLE_VERIFIER_REGISTRY",
    "PRIVATE_KEY_STORAGE",
    "SECRET_KEY_STORAGE",
    "MINT_AUTHORITY",
    "V2_UPGRADE_AUTHORITY",
    "TREASURY_ACCESS",
    "ECOSYSTEM_ACCESS",
    "LIQUIDITY_ACCESS",
    "CORE_TEAM_ACCESS",
    "STAKING_RESERVE_ACCESS",
    "PROMOTION_VAULT_WITHDRAWAL",
  ]) {
    expect(forbidden.has(capability), `forbidden capability missing: ${capability}`);
  }

  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateKeyLifecycleAmendment(loadKeyLifecycleAmendment());
  if (errors.length) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    process.exitCode = 1;
  } else {
    console.log("Verifier-key lifecycle amendment is internally consistent and remains unapplied.");
  }
}
