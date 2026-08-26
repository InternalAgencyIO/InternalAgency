#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PublicKey, Transaction } from "@solana/web3.js";
import { validateSbfEvidence } from "./validate-iat-v2-ci-sbf-evidence.mjs";

export const CANONICAL_DEVNET_RPC = "https://api.devnet.solana.com";
export const CANONICAL_DEVNET_GENESIS_HASH =
  "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
export const REVIEWED_IAT_V2_PROGRAM_ID =
  "62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj";
export const REVIEWED_IAT_V2_SIGNER =
  "7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH";

const UPGRADEABLE_LOADER = "BPFLoaderUpgradeab1e11111111111111111111111";
const SWITCHBOARD_DEVNET_PROGRAM = "Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2";
const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const PARTIAL_PREDICATE = "CURRENT_SOURCE_SIGNED_DEVNET_REHEARSAL_PARTIAL";
const COMPLETE_BUNDLE_SCHEMA = "iat-v2-current-source-attended-devnet-console-bundle/v1";
const COMPLETE_ROSTER_VERSION = "IAT_V2_MIGRATION_BACKFILL_WEEK11_V1";
const DIRECT_FILENAME = "signed-devnet-rehearsal-partial.json";
const PUBLIC_ROOT = "public/evidence/iat-v2/current-source";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hex40 = /^[0-9a-f]{40}$/u;
const hex64 = /^[0-9a-f]{64}$/u;
const base58 = /^[1-9A-HJ-NP-Za-km-z]+$/u;

export class CurrentSourceEvidenceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CurrentSourceEvidenceError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new CurrentSourceEvidenceError(code, message);
}

function check(condition, code, message) {
  if (!condition) fail(code, message);
}

function exactKeys(value, expected, label) {
  check(value && typeof value === "object" && !Array.isArray(value), "INPUT_SCHEMA_HOLD", `${label} must be an object`);
  check(JSON.stringify(Object.keys(value)) === JSON.stringify(expected), "INPUT_SCHEMA_HOLD", `${label} fields are not exact`);
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function encodeBase58(bytes) {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let number = bytes.length === 0 ? 0n : BigInt(`0x${Buffer.from(bytes).toString("hex") || "0"}`);
  let encoded = "";
  while (number > 0n) {
    encoded = `${alphabet[Number(number % 58n)]}${encoded}`;
    number /= 58n;
  }
  let zeroes = 0;
  while (zeroes < bytes.length && bytes[zeroes] === 0) zeroes += 1;
  return `${"1".repeat(zeroes)}${encoded}`;
}

function normalizeUtc(value) {
  const timestamp = value instanceof Date ? value : new Date(value);
  check(Number.isFinite(timestamp.getTime()), "OBSERVATION_TIME_HOLD", "observation time is invalid");
  return timestamp.toISOString().replace(/\.\d{3}Z$/u, "Z");
}

function expectedProgramForAction(action, iatProgramId) {
  if (["EXTEND_PROGRAM_DATA", "UPGRADE_PROGRAM"].includes(action)) return UPGRADEABLE_LOADER;
  if (action === "CREATE_SWITCHBOARD_RANDOMNESS") return SWITCHBOARD_DEVNET_PROGRAM;
  if (action === "FUND_PARTICIPANT_RENT") return SYSTEM_PROGRAM;
  const iatAction = /^(?:MIGRATE_LEGACY_ROUND_WEEK_[0-9]+|BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_[0-9]+|REGISTER_AGENCY_[01]|SET_(?:STANDARD|CCC_AGENT|CCC_ASSOCIATE)_ELIGIBILITY|OPEN_(?:STANDARD|CCC_AGENT|CCC_ASSOCIATE)_POSITION|SETTLE_CORE_WEEK_0|CLAIM_LIQUIDITY_GENESIS_UNLOCK|SETTLE_STANDARD_POSITION_WEEK_[0-9]+|SETTLE_LINKED_POSITION_[1-3]_WEEK_[0-9]+|COMMIT_CCC_ROUND_[0-9]+|REVEAL_CCC_ROUND_[0-9]+|EXPIRE_CCC_ROUND_[0-9]+)$/u;
  check(iatAction.test(action), "ACTION_NOT_REVIEWED_HOLD", `console action is not reviewed: ${action}`);
  return iatProgramId;
}

function validateBinding(binding) {
  exactKeys(binding, [
    "sourceCommit",
    "sourceTree",
    "programArtifactSha256",
    "programArtifactBytes",
    "ciBuildEvidenceSha256",
    "ciRunUrl",
  ], "source/CI binding");
  check(hex40.test(binding.sourceCommit), "SOURCE_BINDING_HOLD", "source commit is malformed");
  check(hex40.test(binding.sourceTree), "SOURCE_BINDING_HOLD", "source tree is malformed");
  check(hex64.test(binding.programArtifactSha256), "SOURCE_BINDING_HOLD", "program artifact digest is malformed");
  check(Number.isSafeInteger(binding.programArtifactBytes) && binding.programArtifactBytes > 0, "SOURCE_BINDING_HOLD", "program artifact byte length is invalid");
  check(hex64.test(binding.ciBuildEvidenceSha256), "SOURCE_BINDING_HOLD", "CI manifest digest is malformed");
  check(/^https:\/\/github\.com\/InternalAgencyIO\/InternalAgency\/actions\/runs\/[1-9][0-9]*\/attempts\/[1-9][0-9]*$/u.test(binding.ciRunUrl), "SOURCE_BINDING_HOLD", "CI run receipt is not canonical");
}

function completeRoster(conditions) {
  exactKeys(conditions, [
    "programDataExtensionRequired",
    "preUpgradeProgramDataCapacityBytes",
    "switchboardRandomnessCreationRequired",
    "cccRound11TerminalAction",
  ], "complete rehearsal conditions");
  check(typeof conditions.programDataExtensionRequired === "boolean", "COMPLETE_ROSTER_HOLD", "programDataExtensionRequired must be boolean");
  check(Number.isSafeInteger(conditions.preUpgradeProgramDataCapacityBytes) && conditions.preUpgradeProgramDataCapacityBytes > 0, "COMPLETE_ROSTER_HOLD", "pre-upgrade ProgramData capacity is invalid");
  check(typeof conditions.switchboardRandomnessCreationRequired === "boolean", "COMPLETE_ROSTER_HOLD", "switchboardRandomnessCreationRequired must be boolean");
  check(["REVEAL_CCC_ROUND_11", "EXPIRE_CCC_ROUND_11"].includes(conditions.cccRound11TerminalAction), "COMPLETE_ROSTER_HOLD", "CCC round 11 terminal action is invalid");
  return [
    ...(conditions.programDataExtensionRequired ? ["EXTEND_PROGRAM_DATA"] : []),
    "UPGRADE_PROGRAM",
    "MIGRATE_LEGACY_ROUND_WEEK_7",
    "MIGRATE_LEGACY_ROUND_WEEK_8",
    "BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_9",
    "BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_10",
    "SETTLE_STANDARD_POSITION_WEEK_10",
    "SETTLE_STANDARD_POSITION_WEEK_11",
    "SETTLE_LINKED_POSITION_2_WEEK_9",
    "SETTLE_LINKED_POSITION_2_WEEK_10",
    "SETTLE_LINKED_POSITION_3_WEEK_9",
    "SETTLE_LINKED_POSITION_3_WEEK_10",
    ...(conditions.switchboardRandomnessCreationRequired ? ["CREATE_SWITCHBOARD_RANDOMNESS"] : []),
    "COMMIT_CCC_ROUND_11",
    conditions.cccRound11TerminalAction,
    "SETTLE_LINKED_POSITION_2_WEEK_11",
    "SETTLE_LINKED_POSITION_3_WEEK_11",
  ];
}

function validateConsoleExport(consoleExport, { binding, expectedProgramId, expectedSigner, includeSignatures }) {
  const completeBundle = consoleExport?.schema === COMPLETE_BUNDLE_SCHEMA;
  check(
    completeBundle || consoleExport?.schema === "iat-v2-devnet-on-chain-feature-rehearsal-evidence/v1",
    "CONSOLE_EXPORT_HOLD",
    "unexpected console export schema",
  );
  check(
    consoleExport.status === (completeBundle
      ? "COMPLETE_PENDING_AUTOMATED_DIRECT_EVIDENCE"
      : "PARTIAL_PENDING_ALL_TIME_GATES_AND_AUTOMATED_DIRECT_EVIDENCE"),
    "CONSOLE_EXPORT_HOLD",
    "console export completion status is incorrect",
  );
  check(consoleExport.network === "devnet" && consoleExport.rpc === CANONICAL_DEVNET_RPC, "CONSOLE_EXPORT_HOLD", "console export is not canonical Devnet");
  check(String(consoleExport.programId) === expectedProgramId, "CONSOLE_EXPORT_HOLD", "console program ID drifted");
  check(String(consoleExport.participant) === expectedSigner, "CONSOLE_EXPORT_HOLD", "console participant is not the reviewed signer");
  check(consoleExport.mainnetStatus === "HOLD" && consoleExport.automatedDirectEvidenceRequired === true, "CONSOLE_EXPORT_HOLD", "console export lost its HOLD/direct-evidence boundary");
  check(consoleExport.humanReviewerRequired === false && consoleExport.noSelfAttestation === true && consoleExport.secretMaterialIncluded === false, "CONSOLE_EXPORT_HOLD", "console export evidence safety fields drifted");
  if (completeBundle) {
    check(consoleExport.rosterVersion === COMPLETE_ROSTER_VERSION, "COMPLETE_ROSTER_HOLD", "complete rehearsal roster version drifted");
    check(consoleExport.sourceCommit === binding.sourceCommit && consoleExport.programArtifactSha256 === binding.programArtifactSha256, "COMPLETE_ROSTER_HOLD", "complete rehearsal source/artifact binding drifted");
    const extensionExpected = binding.programArtifactBytes > consoleExport.conditions?.preUpgradeProgramDataCapacityBytes;
    check(extensionExpected === consoleExport.conditions?.programDataExtensionRequired, "COMPLETE_ROSTER_HOLD", "extension condition disagrees with exact pre-upgrade capacity and CI artifact bytes");
  }
  check(Array.isArray(consoleExport.transactions) && consoleExport.transactions.length > 0, "CONSOLE_EXPORT_HOLD", "console export has no transactions");

  const all = consoleExport.transactions.map((item, index) => {
    exactKeys(item, ["action", "title", "signature", "messageSha256", "explorerUrl", "confirmedAtUtc"], `transactions[${index}]`);
    check(typeof item.action === "string" && item.action.length > 0, "CONSOLE_EXPORT_HOLD", `transactions[${index}] action is invalid`);
    check(typeof item.title === "string" && item.title.length > 0, "CONSOLE_EXPORT_HOLD", `transactions[${index}] title is invalid`);
    check(base58.test(item.signature), "CONSOLE_EXPORT_HOLD", `transactions[${index}] signature is malformed`);
    check(hex64.test(item.messageSha256), "CONSOLE_EXPORT_HOLD", `transactions[${index}] message digest is malformed`);
    check(item.explorerUrl === `https://explorer.solana.com/tx/${item.signature}?cluster=devnet`, "CONSOLE_EXPORT_HOLD", `transactions[${index}] Explorer receipt is not exact`);
    check(Number.isFinite(Date.parse(item.confirmedAtUtc)), "CONSOLE_EXPORT_HOLD", `transactions[${index}] confirmation time is invalid`);
    expectedProgramForAction(item.action, expectedProgramId);
    return item;
  });
  check(new Set(all.map((item) => item.signature)).size === all.length, "CONSOLE_EXPORT_HOLD", "console export repeats a transaction signature");
  check(new Set(all.map((item) => item.action)).size === all.length, "CONSOLE_EXPORT_HOLD", "console export repeats an action identifier");

  if (completeBundle) {
    const expected = completeRoster(consoleExport.conditions);
    check(JSON.stringify(all.map((item) => item.action)) === JSON.stringify(expected), "COMPLETE_ROSTER_HOLD", "complete rehearsal action roster/order is not exact");
  }
  if (!includeSignatures || includeSignatures.length === 0) return { completeBundle, selected: all };
  check(new Set(includeSignatures).size === includeSignatures.length, "SIGNATURE_SELECTION_HOLD", "signature selection contains duplicates");
  const bySignature = new Map(all.map((item) => [item.signature, item]));
  const selected = includeSignatures.map((signature) => {
    check(bySignature.has(signature), "SIGNATURE_SELECTION_HOLD", `selected signature is absent from console export: ${signature}`);
    return bySignature.get(signature);
  });
  return { completeBundle: false, selected };
}

function accountBytes(result, label) {
  const value = result?.value;
  check(value && Array.isArray(value.data) && value.data[1] === "base64", "PROGRAM_OBSERVATION_HOLD", `${label} account is missing or not base64`);
  return { value, bytes: Buffer.from(value.data[0], "base64") };
}

async function observeDeployedProgram({ rpcCall, binding, expectedProgramId, expectedSigner }) {
  const programResult = await rpcCall("getAccountInfo", [expectedProgramId, { commitment: "finalized", encoding: "base64" }]);
  const program = accountBytes(programResult, "program");
  check(program.value.owner === UPGRADEABLE_LOADER && program.value.executable === true, "PROGRAM_OBSERVATION_HOLD", "program owner/executable state drifted");
  check(program.bytes.length === 36 && program.bytes.readUInt32LE(0) === 2, "PROGRAM_OBSERVATION_HOLD", "program account layout drifted");
  const programDataAddress = new PublicKey(program.bytes.subarray(4, 36)).toBase58();

  const dataResult = await rpcCall("getAccountInfo", [programDataAddress, { commitment: "finalized", encoding: "base64" }]);
  const programData = accountBytes(dataResult, "ProgramData");
  check(programData.value.owner === UPGRADEABLE_LOADER && programData.value.executable === false, "PROGRAM_OBSERVATION_HOLD", "ProgramData owner/executable state drifted");
  check(programData.bytes.length >= 45 + binding.programArtifactBytes && programData.bytes.readUInt32LE(0) === 3, "PROGRAM_OBSERVATION_HOLD", "ProgramData layout/capacity drifted");
  const deploymentSlotBig = programData.bytes.readBigUInt64LE(4);
  check(deploymentSlotBig <= BigInt(Number.MAX_SAFE_INTEGER), "PROGRAM_OBSERVATION_HOLD", "ProgramData deployment slot is unsafe");
  check(programData.bytes[12] === 1, "PROGRAM_OBSERVATION_HOLD", "ProgramData upgrade authority is absent");
  const upgradeAuthority = new PublicKey(programData.bytes.subarray(13, 45)).toBase58();
  check(upgradeAuthority === expectedSigner, "PROGRAM_OBSERVATION_HOLD", "ProgramData upgrade authority is not the reviewed Model T wallet");
  const deployedBytes = programData.bytes.subarray(45, 45 + binding.programArtifactBytes);
  check(sha256(deployedBytes) === binding.programArtifactSha256, "DEPLOYED_ARTIFACT_MISMATCH_HOLD", "finalized ProgramData bytes do not match the CI artifact");
  check(programData.bytes.subarray(45 + binding.programArtifactBytes).every((value) => value === 0), "DEPLOYED_ARTIFACT_MISMATCH_HOLD", "ProgramData capacity has non-zero bytes beyond the CI artifact");
  return {
    programId: expectedProgramId,
    programDataAddress,
    deploymentSlot: Number(deploymentSlotBig),
    upgradeAuthority,
    artifactSha256: binding.programArtifactSha256,
    artifactBytes: binding.programArtifactBytes,
    programDataCapacityBytes: programData.bytes.length - 45,
  };
}

async function pollFinalizedStatuses({ rpcCall, signatures, maxWaitMs, pollIntervalMs, nowMs, sleep }) {
  const deadline = nowMs() + maxWaitMs;
  let observation;
  while (true) {
    observation = await rpcCall("getSignatureStatuses", [signatures, { searchTransactionHistory: true }]);
    check(Array.isArray(observation?.value) && observation.value.length === signatures.length, "FINALIZATION_HOLD", "signature status response is incomplete");
    for (let index = 0; index < observation.value.length; index += 1) {
      const status = observation.value[index];
      if (status?.err !== null && status?.err !== undefined) fail("TRANSACTION_FAILED_HOLD", `transaction failed: ${signatures[index]}`);
    }
    if (observation.value.every((status) => status?.confirmationStatus === "finalized" && status.confirmations === null)) return observation;
    if (nowMs() >= deadline) fail("FINALIZATION_TIMEOUT_HOLD", "not every selected Devnet signature is finalized");
    await sleep(Math.min(pollIntervalMs, Math.max(0, deadline - nowMs())));
  }
}

function parseTransaction(result, expectedSignature) {
  check(result && Number.isSafeInteger(result.slot) && result.slot > 0, "TRANSACTION_OBSERVATION_HOLD", `finalized transaction is unavailable: ${expectedSignature}`);
  check(result.meta?.err === null, "TRANSACTION_FAILED_HOLD", `finalized transaction meta reports failure: ${expectedSignature}`);
  check(Array.isArray(result.transaction) && result.transaction[1] === "base64", "TRANSACTION_OBSERVATION_HOLD", `transaction wire bytes are unavailable: ${expectedSignature}`);
  let transaction;
  try {
    transaction = Transaction.from(Buffer.from(result.transaction[0], "base64"));
  } catch (error) {
    fail("TRANSACTION_WIRE_HOLD", `transaction is not the reviewed legacy wire format: ${error instanceof Error ? error.message : String(error)}`);
  }
  check(transaction.verifySignatures(), "TRANSACTION_SIGNATURE_HOLD", `transaction signatures do not verify: ${expectedSignature}`);
  const primary = transaction.signatures[0]?.signature;
  check(primary && encodeBase58(primary) === expectedSignature, "TRANSACTION_SIGNATURE_HOLD", `wire signature does not match console export: ${expectedSignature}`);
  return transaction;
}

function makeCheck({ id, observedAtUtc, binding, details }) {
  const detailsBytes = jsonBytes(details);
  const receipt = {
    schema: "iat-v2-current-source-check-receipt/v1",
    predicate: PARTIAL_PREDICATE,
    checkId: id,
    result: "PASS",
    sourceCommit: binding.sourceCommit,
    programArtifactSha256: binding.programArtifactSha256,
    observedAtUtc,
    detailsSha256: sha256(detailsBytes),
  };
  const slug = id.toLowerCase().replaceAll("_", "-");
  const receiptBytes = jsonBytes(receipt);
  return {
    evidence: {
      id,
      result: "PASS",
      evidencePath: `${PUBLIC_ROOT}/checks/${slug}.json`,
      evidenceSha256: sha256(receiptBytes),
    },
    files: [
      { path: `checks/${slug}.json`, bytes: receiptBytes },
      { path: `details/${slug}.json`, bytes: detailsBytes },
    ],
  };
}

export async function finalizeCurrentSourceDevnetEvidence({
  consoleExport,
  binding,
  rpcCall,
  includeSignatures = [],
  expectedProgramId = REVIEWED_IAT_V2_PROGRAM_ID,
  expectedSigner = REVIEWED_IAT_V2_SIGNER,
  maxWaitMs = 0,
  pollIntervalMs = 2_000,
  nowMs = () => Date.now(),
  sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds)),
  observedAt = new Date(),
} = {}) {
  validateBinding(binding);
  check(typeof rpcCall === "function", "RPC_CONFIGURATION_HOLD", "a read-only RPC caller is required");
  check(Number.isSafeInteger(maxWaitMs) && maxWaitMs >= 0, "RPC_CONFIGURATION_HOLD", "maxWaitMs is invalid");
  check(Number.isSafeInteger(pollIntervalMs) && pollIntervalMs > 0, "RPC_CONFIGURATION_HOLD", "pollIntervalMs is invalid");
  new PublicKey(expectedProgramId);
  new PublicKey(expectedSigner);
  const validatedExport = validateConsoleExport(consoleExport, {
    binding,
    expectedProgramId,
    expectedSigner,
    includeSignatures,
  });
  const transactions = validatedExport.selected;
  check(transactions.length > 0, "SIGNATURE_SELECTION_HOLD", "no console transactions were selected");
  const signatures = transactions.map((item) => item.signature);

  const genesisHash = await rpcCall("getGenesisHash", []);
  check(genesisHash === CANONICAL_DEVNET_GENESIS_HASH, "NETWORK_BINDING_HOLD", "RPC genesis hash is not canonical Devnet");
  const deployedProgram = await observeDeployedProgram({ rpcCall, binding, expectedProgramId, expectedSigner });
  const statusObservation = await pollFinalizedStatuses({ rpcCall, signatures, maxWaitMs, pollIntervalMs, nowMs, sleep });
  const transactionObservations = [];
  for (let index = 0; index < transactions.length; index += 1) {
    const exported = transactions[index];
    const result = await rpcCall("getTransaction", [exported.signature, {
      commitment: "finalized",
      encoding: "base64",
      maxSupportedTransactionVersion: 0,
    }]);
    const transaction = parseTransaction(result, exported.signature);
    const signerKeys = transaction.signatures.map((entry) => entry.publicKey.toBase58());
    check(signerKeys.includes(expectedSigner), "TRANSACTION_SIGNER_HOLD", `reviewed Model T signer is absent: ${exported.signature}`);
    const programIds = [...new Set(transaction.instructions.map((instruction) => instruction.programId.toBase58()))];
    const expectedActionProgram = expectedProgramForAction(exported.action, expectedProgramId);
    check(programIds.includes(expectedActionProgram), "TRANSACTION_PROGRAM_HOLD", `expected action program is absent: ${exported.signature}`);
    const observedMessageSha256 = sha256(transaction.serializeMessage());
    check(observedMessageSha256 === exported.messageSha256, "TRANSACTION_MESSAGE_HOLD", `wire message digest differs from console export: ${exported.signature}`);
    if (exported.action === "UPGRADE_PROGRAM") {
      check(result.slot === deployedProgram.deploymentSlot, "TRANSACTION_SOURCE_AGE_HOLD", "upgrade transaction slot does not match finalized ProgramData deployment slot");
    } else if (exported.action !== "EXTEND_PROGRAM_DATA") {
      check(result.slot >= deployedProgram.deploymentSlot, "TRANSACTION_SOURCE_AGE_HOLD", `transaction predates the current-source program deployment: ${exported.signature}`);
    }
    check(statusObservation.value[index].slot === result.slot, "TRANSACTION_SLOT_HOLD", `status and transaction slots differ: ${exported.signature}`);
    check(Number.isSafeInteger(result.blockTime) && result.blockTime > 0, "TRANSACTION_OBSERVATION_HOLD", `transaction block time is unavailable: ${exported.signature}`);
    transactionObservations.push({
      action: exported.action,
      title: exported.title,
      signature: exported.signature,
      slot: result.slot,
      blockTime: result.blockTime,
      confirmationStatus: statusObservation.value[index].confirmationStatus,
      statusError: statusObservation.value[index].err,
      metaError: result.meta.err,
      signers: signerKeys,
      requiredSigner: expectedSigner,
      programIds,
      requiredActionProgram: expectedActionProgram,
      messageSha256: observedMessageSha256,
      consoleMessageSha256: exported.messageSha256,
      explorerUrl: exported.explorerUrl,
    });
  }
  check(transactionObservations.some((item) => item.programIds.includes(expectedProgramId)), "TRANSACTION_PROGRAM_HOLD", "selected rehearsal contains no current IAT V2 program instruction");

  const observedAtUtc = normalizeUtc(observedAt);
  const consoleBytes = jsonBytes(consoleExport);
  const checks = [
    makeCheck({
      id: "CONSOLE_EXPORT_BOUND",
      observedAtUtc,
      binding,
      details: {
        schema: consoleExport.schema,
        consoleExportSha256: sha256(consoleBytes),
        exportedAtUtc: consoleExport.exportedAtUtc,
        programId: expectedProgramId,
        participant: expectedSigner,
        selectedTransactionCount: transactions.length,
        selectedSignatures: signatures,
      },
    }),
    makeCheck({
      id: "CANONICAL_DEVNET_FINALIZED",
      observedAtUtc,
      binding,
      details: {
        rpc: CANONICAL_DEVNET_RPC,
        genesisHash,
        commitment: "finalized",
        statusContextSlot: statusObservation.context?.slot ?? null,
        transactionCount: transactions.length,
      },
    }),
    makeCheck({
      id: "DEPLOYED_PROGRAM_ARTIFACT_BOUND",
      observedAtUtc,
      binding,
      details: {
        ...deployedProgram,
        sourceCommit: binding.sourceCommit,
        sourceTree: binding.sourceTree,
        ciBuildEvidenceSha256: binding.ciBuildEvidenceSha256,
        ciRunUrl: binding.ciRunUrl,
      },
    }),
    ...transactionObservations.map((details, index) => makeCheck({
      id: `DEVNET_TX_${String(index + 1).padStart(3, "0")}_FINALIZED`,
      observedAtUtc,
      binding,
      details,
    })),
  ];

  const directEvidence = {
    schema: "iat-v2-current-source-direct-evidence/v1",
    predicate: PARTIAL_PREDICATE,
    observationMode: "AUTOMATED_SOURCE_BOUND_DIRECT_OBSERVATION",
    sourceCommit: binding.sourceCommit,
    sourceTree: binding.sourceTree,
    programArtifactSha256: binding.programArtifactSha256,
    network: "devnet",
    observedAtUtc,
    receipts: transactions.map((item) => item.explorerUrl),
    transactionSignatures: signatures,
    checks: checks.map((item) => item.evidence),
  };
  const directBytes = jsonBytes(directEvidence);
  const files = [
    { path: DIRECT_FILENAME, bytes: directBytes },
    ...checks.flatMap((item) => item.files),
  ];
  return Object.freeze({
    directEvidence,
    directEvidenceSha256: sha256(directBytes),
    clearingEligible: false,
    clearingBlocker: "EXACT_ROSTER_INSTRUCTION_DECODING_AND_COMPLETE_POST_STATE_VERIFICATION_NOT_IMPLEMENTED",
    files: files.map((file) => Object.freeze({ ...file, sha256: sha256(file.bytes) })),
  });
}

export function writeCurrentSourceEvidenceStage({ stagingDirectory, files }) {
  check(typeof stagingDirectory === "string" && stagingDirectory.length > 0, "STAGING_PATH_HOLD", "caller-specified staging directory is required");
  const absolute = resolve(stagingDirectory);
  check(absolute !== resolve("."), "STAGING_PATH_HOLD", "project root cannot be used as the staging directory");
  if (existsSync(absolute)) check(readdirSync(absolute).length === 0, "STAGING_NOT_EMPTY_HOLD", "staging directory must be empty");
  mkdirSync(absolute, { recursive: true });
  for (const file of files) {
    const target = resolve(absolute, file.path);
    check(target.startsWith(`${absolute}\\`) || target.startsWith(`${absolute}/`), "STAGING_PATH_HOLD", "staged evidence path escapes the staging directory");
    mkdirSync(resolve(target, ".."), { recursive: true });
    writeFileSync(target, file.bytes, { flag: "wx" });
  }
  return absolute;
}

export function createJsonRpcCaller({ endpoint = CANONICAL_DEVNET_RPC, fetchImpl = fetch } = {}) {
  check(endpoint === CANONICAL_DEVNET_RPC, "RPC_CONFIGURATION_HOLD", "only the canonical Devnet RPC endpoint is admitted");
  let id = 0;
  return async (method, params) => {
    id += 1;
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    });
    check(response.ok, "RPC_TRANSPORT_HOLD", `Devnet RPC HTTP status ${response.status}`);
    const envelope = await response.json();
    check(envelope?.jsonrpc === "2.0" && envelope.id === id && !envelope.error, "RPC_TRANSPORT_HOLD", `Devnet RPC rejected ${method}`);
    return envelope.result;
  };
}

function parseCli(argv) {
  const options = { includeSignatures: [], write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--write") { options.write = true; continue; }
    const value = argv[index + 1];
    check(flag?.startsWith("--") && value !== undefined, "CLI_USAGE", "options must be --name value; --write is the only value-free flag");
    index += 1;
    if (flag === "--console-export") options.consoleExport = value;
    else if (flag === "--ci-manifest") options.ciManifest = value;
    else if (flag === "--staging-dir") options.stagingDirectory = value;
    else if (flag === "--include-signature") options.includeSignatures.push(value);
    else if (flag === "--max-wait-ms") options.maxWaitMs = value;
    else fail("CLI_USAGE", `unexpected option: ${flag}`);
  }
  check(options.consoleExport && options.stagingDirectory, "CLI_USAGE", "--console-export and --staging-dir are required");
  if (options.maxWaitMs !== undefined) check(/^(?:0|[1-9][0-9]*)$/u.test(options.maxWaitMs), "CLI_USAGE", "--max-wait-ms must be a non-negative integer");
  return options;
}

function bindingFromCiManifest({ projectRoot, manifestPath }) {
  const requested = manifestPath ?? "target/verifiable/iat-v2-build-evidence.json";
  const validated = validateSbfEvidence({ projectRoot, manifestPath: requested, allowDescendantCheckout: true });
  const absolute = isAbsolute(requested) ? requested : resolve(projectRoot, requested);
  const manifest = JSON.parse(readFileSync(absolute, "utf8"));
  return {
    sourceCommit: manifest.sourceBinding.sourceHeadCommit,
    sourceTree: manifest.sourceBinding.sourceHeadTree,
    programArtifactSha256: manifest.artifacts.programBinary.sha256,
    programArtifactBytes: manifest.artifacts.programBinary.bytes,
    ciBuildEvidenceSha256: validated.manifestSha256,
    ciRunUrl: validated.runUrl,
  };
}

async function main() {
  const options = parseCli(process.argv.slice(2));
  const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const binding = bindingFromCiManifest({ projectRoot, manifestPath: options.ciManifest });
  const consoleExport = JSON.parse(readFileSync(resolve(options.consoleExport), "utf8"));
  const result = await finalizeCurrentSourceDevnetEvidence({
    consoleExport,
    binding,
    rpcCall: createJsonRpcCaller(),
    includeSignatures: options.includeSignatures,
    maxWaitMs: Number(options.maxWaitMs ?? 0),
  });
  let stagedAt = null;
  if (options.write) stagedAt = writeCurrentSourceEvidenceStage({ stagingDirectory: options.stagingDirectory, files: result.files });
  console.log(JSON.stringify({
    schema: "iat-v2-current-source-devnet-finalizer-result/v1",
    status: options.write ? "STAGED_PARTIAL_NON_CLEARING" : "DRY_RUN_PARTIAL_NON_CLEARING",
    network: "devnet",
    rpc: CANONICAL_DEVNET_RPC,
    directEvidenceSha256: result.directEvidenceSha256,
    predicate: result.directEvidence.predicate,
    clearingEligible: result.clearingEligible,
    clearingBlocker: result.clearingBlocker,
    transactionSignatures: result.directEvidence.transactionSignatures,
    files: result.files.map((file) => ({ path: file.path, sha256: file.sha256, bytes: file.bytes.length })),
    stagingDirectory: stagedAt ?? resolve(options.stagingDirectory),
    wroteFiles: options.write,
    signing: false,
    broadcast: false,
  }, null, 2));
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(JSON.stringify({
      schema: "iat-v2-current-source-devnet-finalizer-error/v1",
      status: "HOLD",
      code: error instanceof CurrentSourceEvidenceError ? error.code : "UNEXPECTED_FINALIZER_FAILURE",
      message: error instanceof Error ? error.message : String(error),
      wroteFiles: false,
      signing: false,
      broadcast: false,
    }));
    process.exitCode = 2;
  });
}
