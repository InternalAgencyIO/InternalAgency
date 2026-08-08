import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_SLOT_HASHES_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  AuthorityType,
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createExecuteInstruction,
  createSetAuthorityInstruction,
  createTransferCheckedWithTransferHookInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getExtensionData,
  getExtensionTypes,
  getExtraAccountMetaAddress,
  getMint,
  getTransferHook,
} from "@solana/spl-token";

import {
  ENTROPY_LAG_SLOTS,
  deriveSolanaDraw,
  matchesCustomError,
  parseLawState,
  protocolLocalDay,
} from "./iat-b3-local-rehearsal-driver.mjs";

export const DEVNET_RPC = "https://api.devnet.solana.com";
export const DEVNET_GENESIS_HASH = "GH7ome3EiwEr7tu9JuTh2dpYWBJK3z69Xm1ZE3MEE6JC";
export const EXECUTE_CONFIRMATION = "CONFIRMED_PUBLIC_DEVNET_REHEARSAL";
export const EXPECTED_ARTIFACT_SHA256 =
  "50fc66ec95bc68a71e6a1288f6fb830e2a3c996bd93348f4b832de954ca6dbc4";
export const EXPECTED_ARTIFACT_SIZE = 141_824;

const SCHEMA = "iat-b3-devnet-rehearsal/v1";
const EXPLORER = "https://explorer.solana.com";
const LAW_NAMESPACE = Buffer.from("IATB3LAW", "ascii");
const IAT_TOTAL_BASE_UNITS = 1_000_000_000_000_000_000n;
const UPGRADEABLE_LOADER_ID = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const EXPECTED_CLI_EVIDENCE = Object.freeze([
  "airdrop-1",
  "airdrop-2",
  "deploy-program",
  "freeze-program",
  "create-mint",
  "create-source",
  "create-destination",
  "mint-supply",
  "revoke-freeze",
  "revoke-mint",
]);

let currentPhase = "argument_gate";
let transactionSequence = 0;
let partialPublicAddresses = null;
const observedPublicTransactions = [];

function parseArgs(argv) {
  const parsed = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key || !key.startsWith("--") || value === undefined || parsed.has(key.slice(2))) {
      throw new TypeError("invalid or duplicate command argument");
    }
    parsed.set(key.slice(2), value);
  }
  return parsed;
}

function required(args, key) {
  const value = args.get(key);
  if (!value) throw new TypeError("missing required driver argument");
  return value;
}

function readKeypair(path) {
  const secret = JSON.parse(readFileSync(path, "utf8"));
  assert(Array.isArray(secret) && secret.length === 64, "invalid disposable keypair");
  assert(secret.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function emit(payload) {
  assertEvidenceSafe(payload);
  process.stdout.write(JSON.stringify(payload) + "\n");
}

export function assertHardPinnedDevnetUrl(url) {
  assert.equal(url, DEVNET_RPC, "RPC must be the hard-pinned official Devnet endpoint");
  return url;
}

export function accountExplorerUrl(address) {
  return EXPLORER + "/address/" + new PublicKey(address).toBase58() + "?cluster=devnet";
}

export function transactionExplorerUrl(signature) {
  assert(/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(signature), "invalid transaction signature");
  return EXPLORER + "/tx/" + signature + "?cluster=devnet";
}

export function sanitizeFailureText(value) {
  return String(value)
    .replace(/(?<![A-Za-z])[A-Za-z]:[\\/][^\s"']+/gu, "[redacted-path]")
    .replace(/\/(?:home|Users|mnt|tmp)\/[^\s"']+/gu, "[redacted-path]")
    .replace(/\[(?:\s*\d+\s*,){15,}\s*\d+\s*\]/gu, "[redacted-key-material]")
    .slice(0, 240);
}

export function assertEvidenceSafe(value) {
  const forbiddenKeys = /^(?:path|cwd|home|config|secret|secretKey|privateKey|keypair|seed|mnemonic)$/iu;
  const visit = (node) => {
    if (typeof node === "string") {
      assert(
        !/(?<![A-Za-z])[A-Za-z]:[\\/]/u.test(node),
        "evidence contains a Windows filesystem path",
      );
      assert(!/\/(?:home|Users|mnt|tmp)\//u.test(node), "evidence contains a filesystem path");
      assert(!/\[(?:\s*\d+\s*,){15,}\s*\d+\s*\]/u.test(node), "evidence contains key bytes");
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, child] of Object.entries(node)) {
        assert(!forbiddenKeys.test(key), "evidence contains a forbidden field");
        visit(child);
      }
    }
  };
  visit(value);
  return value;
}

function parseClock(data) {
  const bytes = Buffer.from(data);
  assert(bytes.length >= 40, "Clock sysvar is too short");
  return Object.freeze({
    slot: bytes.readBigUInt64LE(0),
    unixTimestamp: bytes.readBigInt64LE(32),
  });
}

function parseSlotHashes(data) {
  const bytes = Buffer.from(data);
  assert(bytes.length >= 8, "SlotHashes sysvar is too short");
  const count = bytes.readBigUInt64LE(0);
  assert(count <= 100_000n, "SlotHashes count is unreasonable");
  assert(bytes.length >= 8 + Number(count) * 40, "SlotHashes data is truncated");
  const entries = [];
  for (let index = 0; index < Number(count); index += 1) {
    const offset = 8 + index * 40;
    entries.push(Object.freeze({
      slot: bytes.readBigUInt64LE(offset),
      hash: Buffer.from(bytes.subarray(offset + 8, offset + 40)),
    }));
  }
  return entries;
}

async function getClock(connection) {
  const info = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY, "finalized");
  assert(info, "Clock sysvar is missing");
  return parseClock(info.data);
}

async function verifyProgramFrozen(connection, programId, expectedArtifact) {
  const program = await connection.getAccountInfo(programId, "finalized");
  assert(program && program.executable, "law program is absent or not executable");
  assert(program.owner.equals(UPGRADEABLE_LOADER_ID), "unexpected program loader");
  const bytes = Buffer.from(program.data);
  assert.equal(bytes.length, 36, "upgradeable program account length mismatch");
  assert.equal(bytes.readUInt32LE(0), 2, "upgradeable program discriminator mismatch");
  const programDataAddress = new PublicKey(bytes.subarray(4, 36));
  const programData = await connection.getAccountInfo(programDataAddress, "finalized");
  assert(programData && programData.owner.equals(UPGRADEABLE_LOADER_ID));
  assert(programData.data.length >= 13, "program-data account is too short");
  assert.equal(programData.data.readUInt32LE(0), 3, "program-data discriminator mismatch");
  assert.equal(programData.data[12], 0, "program upgrade authority remains");
  const metadataBytes = 45;
  assert(
    programData.data.length >= metadataBytes + expectedArtifact.length,
    "deployed program data is shorter than the pinned artifact",
  );
  const deployedArtifact = Buffer.from(
    programData.data.subarray(metadataBytes, metadataBytes + expectedArtifact.length),
  );
  assert(deployedArtifact.equals(expectedArtifact), "deployed program bytes differ from pinned artifact");
  assert(
    programData.data.subarray(metadataBytes + expectedArtifact.length).every((byte) => byte === 0),
    "deployed program has unexpected nonzero trailing bytes",
  );
  return Object.freeze({
    id: programId.toBase58(),
    programData: programDataAddress.toBase58(),
    executable: true,
    upgradeAuthority: null,
    deployedArtifactSha256: sha256Bytes(deployedArtifact),
    deployedArtifactBytes: deployedArtifact.length,
  });
}

function extensionAuthorityIsNull(data) {
  return Buffer.from(data).subarray(0, 32).every((byte) => byte === 0);
}

function inspectMintShape(mintState, programId, expectedHookAuthority) {
  const extensionTypes = getExtensionTypes(mintState.tlvData);
  assert.deepEqual(
    [...extensionTypes].sort((a, b) => a - b),
    [ExtensionType.ConfidentialTransferMint, ExtensionType.TransferHook].sort((a, b) => a - b),
    "Token-2022 mint extension shape is not exact",
  );
  assert.equal(mintState.decimals, 9, "mint decimals mismatch");
  assert.equal(mintState.supply, IAT_TOTAL_BASE_UNITS, "mint supply mismatch");
  assert.equal(mintState.mintAuthority, null, "mint authority remains");
  assert.equal(mintState.freezeAuthority, null, "freeze authority remains");
  const transferHook = getTransferHook(mintState);
  assert(transferHook && transferHook.programId.equals(programId), "transfer-hook program mismatch");
  assert(
    transferHook.authority.equals(expectedHookAuthority),
    "transfer-hook authority does not match the expected stage",
  );
  const confidential = getExtensionData(
    ExtensionType.ConfidentialTransferMint,
    mintState.tlvData,
  );
  assert(confidential, "confidential-transfer mint extension is absent");
  const confidentialBytes = Buffer.from(confidential);
  assert.equal(confidentialBytes.length, 65, "confidential-transfer mint layout length mismatch");
  assert.equal(confidentialBytes[32], 1, "confidential accounts are not auto-approved");
  assert(
    confidentialBytes.subarray(33, 65).every((byte) => byte === 0),
    "confidential-transfer auditor key is not null",
  );
  return Object.freeze({
    transferHook,
    confidential: confidentialBytes,
    autoApproveNewAccounts: true,
    auditorElGamalPubkey: null,
  });
}

async function waitForTransaction(connection, signature) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const transaction = await connection.getTransaction(signature, {
      commitment: "finalized",
      maxSupportedTransactionVersion: 0,
    });
    if (transaction) return transaction;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("finalized transaction metrics were not exposed by RPC");
}

function metricFromTransaction(label, signature, transaction, expectedCustomError = null) {
  const logs = transaction.meta?.logMessages ?? [];
  const failureText = JSON.stringify(transaction.meta?.err) + "\n" + logs.join("\n");
  if (expectedCustomError === null) {
    assert.equal(transaction.meta?.err, null, label + " unexpectedly failed");
  } else {
    assert(transaction.meta?.err, label + " unexpectedly succeeded");
    assert(
      matchesCustomError(failureText, expectedCustomError),
      label + " did not fail with the required custom error",
    );
  }
  const consumed = transaction.meta?.computeUnitsConsumed;
  return Object.freeze({
    label,
    signature,
    slot: transaction.slot,
    feeLamports: transaction.meta?.fee ?? null,
    computeUnitsConsumed: consumed === undefined ? null : Number(consumed),
    succeeded: expectedCustomError === null,
    expectedCustomError,
    explorerUrl: transactionExplorerUrl(signature),
  });
}

async function sendMeasured(connection, payer, label, instructions, expectedCustomError = null) {
  transactionSequence += 1;
  const latest = await connection.getLatestBlockhash("finalized");
  const transaction = new Transaction({
    feePayer: payer.publicKey,
    recentBlockhash: latest.blockhash,
  }).add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 + transactionSequence }));
  for (const instruction of instructions) transaction.add(instruction);
  transaction.sign(payer);
  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    maxRetries: 5,
    skipPreflight: true,
  });
  observedPublicTransactions.push(Object.freeze({
    label,
    signature,
    explorerUrl: transactionExplorerUrl(signature),
  }));
  await connection.confirmTransaction(
    {
      signature,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    },
    "finalized",
  );
  const landed = await waitForTransaction(connection, signature);
  return metricFromTransaction(label, signature, landed, expectedCustomError);
}

async function transferInstruction(connection, source, mint, destination, owner) {
  return createTransferCheckedWithTransferHookInstruction(
    connection,
    source,
    mint,
    destination,
    owner,
    1n,
    9,
    [],
    "finalized",
    TOKEN_2022_PROGRAM_ID,
  );
}

function signatureCandidate(value) {
  return typeof value === "string" && /^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(value);
}

export function extractCliSignatures(value) {
  const signatures = new Set();
  const visit = (node, key = "") => {
    if (signatureCandidate(node) && /signature|transactionId|txid|result/iu.test(key)) {
      signatures.add(node);
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item, key);
    } else if (node && typeof node === "object") {
      for (const [childKey, child] of Object.entries(node)) visit(child, childKey);
    }
  };
  visit(value);
  return [...signatures];
}

async function collectCliEvidence(connection, directory) {
  const files = new Set(readdirSync(directory).map((name) => basename(name)));
  const steps = [];
  for (const label of EXPECTED_CLI_EVIDENCE) {
    const file = label + ".json";
    assert(files.has(file), "required CLI evidence is absent");
    const payload = JSON.parse(readFileSync(join(directory, file), "utf8"));
    const signatures = extractCliSignatures(payload);
    const transactions = [];
    for (const signature of signatures) {
      const transaction = await waitForTransaction(connection, signature);
      transactions.push(metricFromTransaction(label, signature, transaction));
    }
    steps.push(Object.freeze({
      label,
      signatureExposed: signatures.length > 0,
      transactions,
    }));
  }
  return steps;
}

async function collectPayerTransactionHistory(connection, payer, knownTransactions) {
  const entries = await connection.getSignaturesForAddress(
    payer,
    { limit: 1_000 },
    "finalized",
  );
  assert(entries.length < 1_000, "fresh payer history exceeded the bounded evidence query");
  const labels = new Map(
    knownTransactions.map((transaction) => [transaction.signature, transaction.label]),
  );
  const resolved = new Map();
  for (let offset = 0; offset < entries.length; offset += 20) {
    const chunk = entries.slice(offset, offset + 20);
    const transactions = await connection.getTransactions(
      chunk.map((entry) => entry.signature),
      { commitment: "finalized", maxSupportedTransactionVersion: 0 },
    );
    for (let index = 0; index < chunk.length; index += 1) {
      resolved.set(chunk[index].signature, transactions[index] ?? null);
    }
    if (offset + chunk.length < entries.length) {
      await new Promise((resolve) => setTimeout(resolve, 5_250));
    }
  }
  return entries.map((entry) => {
    const transaction = resolved.get(entry.signature);
    const consumed = transaction?.meta?.computeUnitsConsumed;
    return Object.freeze({
      label: labels.get(entry.signature) ?? "payer-history-unlabeled",
      signature: entry.signature,
      slot: transaction?.slot ?? entry.slot,
      feeLamports: transaction?.meta?.fee ?? null,
      computeUnitsConsumed: consumed === undefined ? null : Number(consumed),
      succeeded: entry.err === null,
      rpcMetadataExposed: transaction !== null,
      explorerUrl: transactionExplorerUrl(entry.signature),
    });
  });
}

function publicAccount(address) {
  const id = new PublicKey(address).toBase58();
  return Object.freeze({ address: id, explorerUrl: accountExplorerUrl(id) });
}

async function run(argv) {
  const args = parseArgs(argv);
  assert.equal(args.size, 7, "unexpected driver arguments");
  assert.equal(required(args, "execute"), EXECUTE_CONFIRMATION, "explicit execution confirmation missing");
  assertHardPinnedDevnetUrl(DEVNET_RPC);

  currentPhase = "artifact_pin_verification";
  const artifact = required(args, "artifact");
  const artifactBytes = readFileSync(artifact);
  assert.equal(artifactBytes.length, EXPECTED_ARTIFACT_SIZE, "optimized artifact size is not pinned");
  assert.equal(sha256File(artifact), EXPECTED_ARTIFACT_SHA256, "optimized artifact digest is not pinned");

  currentPhase = "disposable_identity_load";
  const payer = readKeypair(required(args, "payer"));
  const recipient = readKeypair(required(args, "recipient"));
  const programId = new PublicKey(required(args, "program-id"));
  const mint = new PublicKey(required(args, "mint"));
  const cliEvidenceDirectory = required(args, "cli-evidence-dir");
  assert(!payer.publicKey.equals(recipient.publicKey), "disposable identities collided");
  assert(!payer.publicKey.equals(programId), "payer and program identities collided");
  assert(!payer.publicKey.equals(mint), "payer and mint identities collided");
  partialPublicAddresses = {
    payer: publicAccount(payer.publicKey),
    recipient: publicAccount(recipient.publicKey),
    program: publicAccount(programId),
    mint: publicAccount(mint),
  };

  currentPhase = "cluster_identity_verification";
  const connection = new Connection(assertHardPinnedDevnetUrl(DEVNET_RPC), "finalized");
  const genesisHash = await connection.getGenesisHash();
  assert.equal(genesisHash, DEVNET_GENESIS_HASH, "RPC did not identify as canonical Devnet");
  const networkGenesisHash = new PublicKey(genesisHash).toBuffer();

  currentPhase = "program_immutability_verification_before_law_initialization";
  const program = await verifyProgramFrozen(connection, programId, artifactBytes);

  const source = getAssociatedTokenAddressSync(
    mint,
    payer.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
  );
  const destination = getAssociatedTokenAddressSync(
    mint,
    recipient.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
  );
  const [lawState, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("law-state", "ascii"), mint.toBuffer()],
    programId,
  );
  const validation = getExtraAccountMetaAddress(mint, programId);
  assert.equal(await connection.getAccountInfo(lawState, "finalized"), null, "law state already exists");
  assert.equal(await connection.getAccountInfo(validation, "finalized"), null, "validation state already exists");

  currentPhase = "token_2022_shape_verification_before_law_initialization";
  let mintState = await getMint(connection, mint, "finalized", TOKEN_2022_PROGRAM_ID);
  const initialShape = inspectMintShape(mintState, programId, payer.publicKey);
  assert(!extensionAuthorityIsNull(initialShape.confidential), "confidential authority was unexpectedly null");
  assert(initialShape.confidential.subarray(0, 32).equals(payer.publicKey.toBuffer()));

  const measurements = [];
  currentPhase = "law_initialization";
  const initializeLaw = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: lawState, isSigner: false, isWritable: true },
      { pubkey: validation, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([LAW_NAMESPACE, Buffer.from([0]), networkGenesisHash]),
  });
  measurements.push(await sendMeasured(connection, payer, "initialize-law", [initializeLaw]));
  const initializedInfo = await connection.getAccountInfo(lawState, "finalized");
  assert(initializedInfo && initializedInfo.owner.equals(programId));
  const initialized = parseLawState(initializedInfo.data);
  assert.equal(initialized.bump, bump);
  assert.equal(initialized.decision, null);
  assert(initialized.mint.equals(mint));
  assert(initialized.networkGenesisHash.equals(networkGenesisHash));
  const validationInfo = await connection.getAccountInfo(validation, "finalized");
  assert(validationInfo && validationInfo.owner.equals(programId));

  currentPhase = "fail_closed_missing_decision";
  measurements.push(await sendMeasured(
    connection,
    payer,
    "missing-decision-hooked-transfer",
    [await transferInstruction(connection, source, mint, destination, payer.publicKey)],
    7,
  ));

  currentPhase = "fail_closed_direct_bypass";
  const directExecute = createExecuteInstruction(
    programId,
    source,
    mint,
    destination,
    payer.publicKey,
    validation,
    1n,
  );
  directExecute.keys.push({ pubkey: lawState, isSigner: false, isWritable: false });
  measurements.push(await sendMeasured(
    connection,
    payer,
    "direct-hook-bypass",
    [directExecute],
    12,
  ));

  currentPhase = "extension_authority_revocation";
  measurements.push(await sendMeasured(connection, payer, "revoke-transfer-hook-authority", [
    createSetAuthorityInstruction(
      mint,
      payer.publicKey,
      AuthorityType.TransferHookProgramId,
      null,
      [],
      TOKEN_2022_PROGRAM_ID,
    ),
  ]));
  measurements.push(await sendMeasured(connection, payer, "revoke-confidential-mint-authority", [
    createSetAuthorityInstruction(
      mint,
      payer.publicKey,
      AuthorityType.ConfidentialTransferMint,
      null,
      [],
      TOKEN_2022_PROGRAM_ID,
    ),
  ]));

  currentPhase = "all_authorities_null_verification";
  const frozenProgramAgain = await verifyProgramFrozen(connection, programId, artifactBytes);
  mintState = await getMint(connection, mint, "finalized", TOKEN_2022_PROGRAM_ID);
  const immutableShape = inspectMintShape(mintState, programId, PublicKey.default);
  assert(extensionAuthorityIsNull(immutableShape.confidential), "confidential authority remains");
  assert.equal(mintState.mintAuthority, null);
  assert.equal(mintState.freezeAuthority, null);
  assert.equal(frozenProgramAgain.upgradeAuthority, null);

  currentPhase = "permissionless_daily_finalization";
  const finalizeDay = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: lawState, isSigner: false, isWritable: true },
    ],
    data: Buffer.concat([LAW_NAMESPACE, Buffer.from([1])]),
  });
  const finalizeMetric = await sendMeasured(connection, payer, "finalize-day", [finalizeDay]);
  measurements.push(finalizeMetric);
  const finalizedInfo = await connection.getAccountInfo(lawState, "finalized");
  assert(finalizedInfo);
  const finalized = parseLawState(finalizedInfo.data);
  assert(finalized.decision, "daily decision is absent after finalization");
  const decision = finalized.decision;
  const recomputed = deriveSolanaDraw({
    ancestorSlotHash: decision.ancestorSlotHash,
    localDay: decision.localDay,
    entropySlot: decision.entropySlot,
    networkGenesisHash: finalized.networkGenesisHash,
    mint,
  });
  assert.equal(decision.drawCounter, recomputed.drawCounter);
  assert.equal(decision.drawBucket, recomputed.drawBucket);
  assert.equal(decision.chanceNumerator, recomputed.chanceNumerator);
  assert.equal(decision.chanceDenominator, recomputed.chanceDenominator);
  assert.equal(decision.locked, recomputed.locked);
  const slotHashesInfo = await connection.getAccountInfo(SYSVAR_SLOT_HASHES_PUBKEY, "finalized");
  assert(slotHashesInfo, "SlotHashes sysvar is missing");
  const targetSlot = BigInt(finalizeMetric.slot) - ENTROPY_LAG_SLOTS;
  const selected = parseSlotHashes(slotHashesInfo.data).find((entry) => entry.slot <= targetSlot);
  assert(selected, "lagged finalized slot hash is absent");
  assert.equal(decision.entropySlot, selected.slot);
  assert(decision.ancestorSlotHash.equals(selected.hash));
  const clock = await getClock(connection);
  assert.equal(decision.localDay, protocolLocalDay(clock.unixTimestamp));

  currentPhase = "fail_closed_same_day_reroll";
  measurements.push(await sendMeasured(connection, payer, "same-day-reroll", [finalizeDay], 9));

  currentPhase = "selected_day_hooked_transfer";
  const sourceBefore = await getAccount(connection, source, "finalized", TOKEN_2022_PROGRAM_ID);
  const destinationBefore = await getAccount(
    connection,
    destination,
    "finalized",
    TOKEN_2022_PROGRAM_ID,
  );
  measurements.push(await sendMeasured(
    connection,
    payer,
    "selected-day-hooked-transfer",
    [await transferInstruction(connection, source, mint, destination, payer.publicKey)],
    decision.locked ? 8 : null,
  ));
  const sourceAfter = await getAccount(connection, source, "finalized", TOKEN_2022_PROGRAM_ID);
  const destinationAfter = await getAccount(
    connection,
    destination,
    "finalized",
    TOKEN_2022_PROGRAM_ID,
  );
  if (decision.locked) {
    assert.equal(sourceAfter.amount, sourceBefore.amount);
    assert.equal(destinationAfter.amount, destinationBefore.amount);
  } else {
    assert.equal(sourceAfter.amount, sourceBefore.amount - 1n);
    assert.equal(destinationAfter.amount, destinationBefore.amount + 1n);
  }

  currentPhase = "final_all_authorities_null_verification";
  const finalProgram = await verifyProgramFrozen(connection, programId, artifactBytes);
  assert.equal(finalProgram.programData, program.programData);
  const finalMintState = await getMint(connection, mint, "finalized", TOKEN_2022_PROGRAM_ID);
  const finalMintShape = inspectMintShape(finalMintState, programId, PublicKey.default);
  assert(extensionAuthorityIsNull(finalMintShape.confidential));
  assert.equal(finalProgram.upgradeAuthority, null);
  assert.equal(finalMintState.mintAuthority, null);
  assert.equal(finalMintState.freezeAuthority, null);

  currentPhase = "cli_transaction_metric_collection";
  const cliSteps = await collectCliEvidence(connection, cliEvidenceDirectory);
  const cliTransactions = cliSteps.flatMap((step) => step.transactions);
  currentPhase = "complete_payer_transaction_history_collection";
  await new Promise((resolve) => setTimeout(resolve, 10_500));
  const payerTransactionHistory = await collectPayerTransactionHistory(
    connection,
    payer.publicKey,
    [...measurements, ...cliTransactions],
  );
  const addresses = {
    payer: publicAccount(payer.publicKey),
    recipient: publicAccount(recipient.publicKey),
    program: publicAccount(programId),
    programData: publicAccount(program.programData),
    mint: publicAccount(mint),
    sourceTokenAccount: publicAccount(source),
    destinationTokenAccount: publicAccount(destination),
    lawState: publicAccount(lawState),
    extraAccountMetaList: publicAccount(validation),
    token2022Program: publicAccount(TOKEN_2022_PROGRAM_ID),
  };

  currentPhase = "sanitized_evidence_emission";
  emit({
    schema: SCHEMA,
    status: "PASS",
    network: "solana-devnet",
    rpc: DEVNET_RPC,
    genesisHash,
    artifact: {
      sha256: EXPECTED_ARTIFACT_SHA256,
      bytes: EXPECTED_ARTIFACT_SIZE,
      deployedSha256: finalProgram.deployedArtifactSha256,
      deployedBytes: finalProgram.deployedArtifactBytes,
    },
    publicAddresses: addresses,
    authorities: {
      programUpgrade: null,
      mint: null,
      freeze: null,
      transferHookAuthority: null,
      confidentialTransferMint: null,
    },
    mintShape: {
      tokenProgram: TOKEN_2022_PROGRAM_ID.toBase58(),
      decimals: finalMintState.decimals,
      supplyBaseUnits: finalMintState.supply.toString(),
      extensions: ["ConfidentialTransferMint", "TransferHook"],
      transferHookProgram: programId.toBase58(),
      autoApproveNewConfidentialAccounts: finalMintShape.autoApproveNewAccounts,
      confidentialTransferAuditorElGamalPubkey: finalMintShape.auditorElGamalPubkey,
    },
    finality: "finalized",
    decision: {
      localDay: decision.localDay.toString(),
      entropySlot: decision.entropySlot.toString(),
      finalizeSlot: finalizeMetric.slot,
      drawBucket: decision.drawBucket.toString(),
      chanceNumerator: decision.chanceNumerator.toString(),
      chanceDenominator: decision.chanceDenominator.toString(),
      locked: decision.locked,
      recomputed: true,
      laggedSlotHashMatched: true,
    },
    failClosed: {
      missingDecisionCustomError: 7,
      sameDayRerollCustomError: 9,
      directBypassCustomError: 12,
      selectedLockedDayCustomError: decision.locked ? 8 : null,
    },
    transactions: measurements,
    cliSteps,
    payerTransactionHistory,
    limits: {
      proves: "immutable native law adapter on public Solana Devnet",
      doesNotProve: ["retained V2 feature parity", "privacy vault", "Mainnet readiness"],
    },
  });
}

async function main() {
  if (
    process.argv.length === 3
    && process.argv[2] === "--offline-import-preflight"
  ) {
    emit({
      schema: SCHEMA,
      status: "PREFLIGHT_PASS",
      network: "solana-devnet",
      rpc: DEVNET_RPC,
      publicNetworkWrites: false,
    });
    return;
  }
  if (
    process.argv.length === 5
    && process.argv[2] === "--offline-sanitize-cli-evidence"
  ) {
    try {
      const label = process.argv[3];
      assert(/^[a-z0-9-]{1,64}$/u.test(label), "invalid public step label");
      const payload = JSON.parse(readFileSync(process.argv[4], "utf8"));
      const signatures = extractCliSignatures(payload);
      emit({
        schema: SCHEMA,
        status: "PUBLIC_STEP_RECORDED",
        network: "solana-devnet",
        rpc: DEVNET_RPC,
        label,
        signatureExposed: signatures.length > 0,
        transactions: signatures.map((signature) => ({
          signature,
          explorerUrl: transactionExplorerUrl(signature),
        })),
      });
    } catch (error) {
      emit({
        schema: SCHEMA,
        status: "FAIL",
        phase: "offline_cli_evidence_sanitization",
        failure: "cli_evidence_was_not_safe_or_parseable",
        errorType: String(error?.name ?? "Error").replace(/[^A-Za-z]/gu, "").slice(0, 32),
      });
      process.exitCode = 1;
    }
    return;
  }
  try {
    await run(process.argv.slice(2));
  } catch (error) {
    emit({
      schema: SCHEMA,
      status: "FAIL",
      network: "solana-devnet",
      rpc: DEVNET_RPC,
      phase: currentPhase,
      failure: "invariant_or_rpc_operation_failed",
      errorType: String(error?.name ?? "Error").replace(/[^A-Za-z]/gu, "").slice(0, 32),
      partialPublicArtifactsMayRemain: currentPhase !== "argument_gate",
      publicAddresses: partialPublicAddresses,
      knownTransactions: observedPublicTransactions,
    });
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (invokedPath === import.meta.url) await main();
