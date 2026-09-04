import { Buffer } from "buffer";
import {
  AddressLookupTableProgram,
  ComputeBudgetProgram,
  Message,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  deriveIatV2Addresses,
  deriveRoundAddress,
  SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
} from "../../programs/iat_v2/client.mjs";
import { buildSettlePositionWeekInstruction } from "../../programs/iat_v2/feature-instructions.mjs";
import { IAT_V2_PROGRAM_ID } from "../../programs/iat_v2/instructions.mjs";
import {
  assertCanonicalAttendedNextActionFromReceiptSet,
  canonicalAttendedReceipt,
  canonicalReceiptSet,
  loadAttendedReceiptSet,
  persistAttendedReceipt,
} from "./attended-evidence.mjs";

export const IAT_V2_RANDOMNESS_CONTINUITY_SCHEMA =
  "iat-v2-current-source-switchboard-randomness-continuity/v1";
export const IAT_V2_RANDOMNESS_CREATE_JOURNAL_SCHEMA =
  "iat-v2-current-source-switchboard-randomness-create-journal/v1";
export const IAT_V2_RANDOMNESS_CREATE_TITLE = "Create ephemeral Switchboard account";

const SWITCHBOARD_QUEUE = new PublicKey("EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7");
const RANDOMNESS_INIT_DISCRIMINATOR = Buffer.from("0909cc213274710f", "hex");
const hex40 = /^[0-9a-f]{40}$/u;
const hex64 = /^[0-9a-f]{64}$/u;
const base58 = /^[1-9A-HJ-NP-Za-km-z]+$/u;
const base58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const verifiedContinuityCapabilities = new WeakSet();

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function exactKeys(value, expected, label) {
  check(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  check(JSON.stringify(Object.keys(value)) === JSON.stringify(expected), `${label} fields are not exact`);
}

function base58ByteLength(value) {
  if (!base58.test(value ?? "")) return -1;
  let number = 0n;
  for (const character of value) {
    number = number * 58n + BigInt(base58Alphabet.indexOf(character));
  }
  let bytes = 0;
  while (number > 0n) {
    bytes += 1;
    number >>= 8n;
  }
  let zeroes = 0;
  while (zeroes < value.length && value[zeroes] === "1") zeroes += 1;
  return bytes + zeroes;
}

export function encodeSolanaSignature(value) {
  const bytes = Buffer.from(value ?? []);
  check(bytes.length === 64, "Solana signature bytes are not exact");
  let number = 0n;
  for (const byte of bytes) number = (number << 8n) + BigInt(byte);
  let encoded = "";
  while (number > 0n) {
    encoded = base58Alphabet[Number(number % 58n)] + encoded;
    number /= 58n;
  }
  let zeroes = 0;
  while (zeroes < bytes.length && bytes[zeroes] === 0) zeroes += 1;
  const result = "1".repeat(zeroes) + encoded;
  check(base58ByteLength(result) === 64, "Encoded Solana signature is not exact");
  return result;
}

function canonicalAddress(value, label) {
  check(typeof value === "string", `${label} must be a string`);
  let address;
  try {
    address = new PublicKey(value);
  } catch {
    throw new Error(`${label} is not a canonical public key`);
  }
  check(address.toBase58() === value, `${label} is not canonical`);
  return value;
}

function exactSourceBinding({ sourceCommit, programArtifactSha256, mint } = {}) {
  check(hex40.test(sourceCommit ?? ""), "Randomness continuity source commit is not exact");
  check(hex64.test(programArtifactSha256 ?? ""), "Randomness continuity artifact SHA-256 is not exact");
  canonicalAddress(mint, "Randomness continuity mint");
  return { sourceCommit, programArtifactSha256, mint };
}

export function canonicalRandomnessContinuityRecord({
  schema = IAT_V2_RANDOMNESS_CONTINUITY_SCHEMA,
  sourceCommit,
  programArtifactSha256,
  mint,
  address,
  createSignature,
  createMessageSha256,
} = {}) {
  check(schema === IAT_V2_RANDOMNESS_CONTINUITY_SCHEMA, "Randomness continuity schema is not reviewed");
  const binding = exactSourceBinding({ sourceCommit, programArtifactSha256, mint });
  canonicalAddress(address, "Randomness continuity address");
  check(base58ByteLength(createSignature) === 64, "Randomness CREATE signature is not exact");
  check(hex64.test(createMessageSha256 ?? ""), "Randomness CREATE message SHA-256 is not exact");
  return Object.freeze({
    schema,
    ...binding,
    address,
    createSignature,
    createMessageSha256,
  });
}

export function parseRandomnessContinuityRecord(value, expectedBinding) {
  let parsed;
  try {
    parsed = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    throw new Error("Retained randomness continuity record is not valid JSON");
  }
  exactKeys(parsed, [
    "schema",
    "sourceCommit",
    "programArtifactSha256",
    "mint",
    "address",
    "createSignature",
    "createMessageSha256",
  ], "retained randomness continuity record");
  const record = canonicalRandomnessContinuityRecord(parsed);
  const expected = exactSourceBinding(expectedBinding);
  check(record.sourceCommit === expected.sourceCommit, "Retained randomness source commit drifted");
  check(
    record.programArtifactSha256 === expected.programArtifactSha256,
    "Retained randomness artifact SHA-256 drifted",
  );
  check(record.mint === expected.mint, "Retained randomness mint drifted");
  return record;
}

export function canonicalRandomnessCreateJournal({
  schema = IAT_V2_RANDOMNESS_CREATE_JOURNAL_SCHEMA,
  sourceCommit,
  programArtifactSha256,
  mint,
  address,
  createSignature,
  createMessageSha256,
  title = IAT_V2_RANDOMNESS_CREATE_TITLE,
} = {}) {
  check(schema === IAT_V2_RANDOMNESS_CREATE_JOURNAL_SCHEMA, "Randomness CREATE journal schema is not reviewed");
  const continuity = canonicalRandomnessContinuityRecord({
    sourceCommit,
    programArtifactSha256,
    mint,
    address,
    createSignature,
    createMessageSha256,
  });
  check(title === IAT_V2_RANDOMNESS_CREATE_TITLE, "Randomness CREATE journal title drifted");
  return Object.freeze({
    schema,
    sourceCommit: continuity.sourceCommit,
    programArtifactSha256: continuity.programArtifactSha256,
    mint: continuity.mint,
    address: continuity.address,
    createSignature: continuity.createSignature,
    createMessageSha256: continuity.createMessageSha256,
    title,
  });
}

export function parseRandomnessCreateJournal(value, expectedBinding) {
  let parsed;
  try {
    parsed = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    throw new Error("Randomness CREATE journal is not valid JSON");
  }
  exactKeys(parsed, [
    "schema",
    "sourceCommit",
    "programArtifactSha256",
    "mint",
    "address",
    "createSignature",
    "createMessageSha256",
    "title",
  ], "randomness CREATE journal");
  const journal = canonicalRandomnessCreateJournal(parsed);
  const expected = exactSourceBinding(expectedBinding);
  check(journal.sourceCommit === expected.sourceCommit, "Randomness CREATE journal source commit drifted");
  check(
    journal.programArtifactSha256 === expected.programArtifactSha256,
    "Randomness CREATE journal artifact SHA-256 drifted",
  );
  check(journal.mint === expected.mint, "Randomness CREATE journal mint drifted");
  return journal;
}

export function randomnessCreateJournalStorageKey(expectedBinding) {
  const exact = exactSourceBinding(expectedBinding);
  return [
    "iat-v2-current-source-switchboard-randomness-create-journal",
    exact.sourceCommit,
    exact.programArtifactSha256,
    exact.mint,
    "v1",
  ].join("/");
}

function exactStorage(storage) {
  check(
    typeof storage?.getItem === "function"
      && typeof storage?.setItem === "function"
      && typeof storage?.removeItem === "function",
    "Randomness continuity storage is unavailable",
  );
  return storage;
}

function storedValue(storage, key, label) {
  try {
    return exactStorage(storage).getItem(key);
  } catch (error) {
    throw new Error(`${label} storage is unavailable for reading`, { cause: error });
  }
}

function persistExactJson(storage, key, value, label) {
  const serialized = JSON.stringify(value);
  try {
    exactStorage(storage).setItem(key, serialized);
    check(storage.getItem(key) === serialized, `${label} storage readback disagrees with the write`);
  } catch (error) {
    throw new Error(`${label} storage is unavailable or non-durable`, { cause: error });
  }
  return serialized;
}

export function loadRandomnessCreateJournal(storage, expectedBinding) {
  const key = randomnessCreateJournalStorageKey(expectedBinding);
  const serialized = storedValue(storage, key, "Randomness CREATE journal");
  return serialized === null ? null : parseRandomnessCreateJournal(serialized, expectedBinding);
}

export function persistRandomnessCreateJournal(storage, journal) {
  const exact = canonicalRandomnessCreateJournal(journal);
  const key = randomnessCreateJournalStorageKey(exact);
  const current = storedValue(storage, key, "Randomness CREATE journal");
  if (current !== null) {
    const parsed = parseRandomnessCreateJournal(current, exact);
    check(JSON.stringify(parsed) === JSON.stringify(exact), "Randomness CREATE journal conflicts with retained evidence");
    return parsed;
  }
  persistExactJson(storage, key, exact, "Randomness CREATE journal");
  return parseRandomnessCreateJournal(storedValue(storage, key, "Randomness CREATE journal"), exact);
}

function clearRandomnessCreateJournal(storage, expectedBinding) {
  const key = randomnessCreateJournalStorageKey(expectedBinding);
  try {
    exactStorage(storage).removeItem(key);
    check(storage.getItem(key) === null, "Randomness CREATE journal remained after recovery");
  } catch (error) {
    throw new Error("Randomness CREATE journal could not be cleared after durable recovery", { cause: error });
  }
}

export function randomnessJournalContinuityRecord(journal) {
  const exact = canonicalRandomnessCreateJournal(journal);
  return canonicalRandomnessContinuityRecord({
    sourceCommit: exact.sourceCommit,
    programArtifactSha256: exact.programArtifactSha256,
    mint: exact.mint,
    address: exact.address,
    createSignature: exact.createSignature,
    createMessageSha256: exact.createMessageSha256,
  });
}

export function randomnessJournalReceiptStub(journal) {
  const exact = canonicalRandomnessCreateJournal(journal);
  return Object.freeze({
    action: "CREATE_SWITCHBOARD_RANDOMNESS",
    signature: exact.createSignature,
    messageSha256: exact.createMessageSha256,
  });
}

export function inspectCanonicalRandomnessDiscardEligibility({
  storage,
  expectedBinding,
  programArtifactBytes,
} = {}) {
  check(
    Number.isSafeInteger(programArtifactBytes) && programArtifactBytes > 0,
    "Program artifact byte length is unavailable for randomness discard inspection",
  );
  const exactBinding = exactSourceBinding(expectedBinding);
  const receiptSet = loadAttendedReceiptSet(exactStorage(storage), exactBinding);
  const canonicalCreateRecorded = receiptSet.receipts.some(
    ({ action }) => action === "CREATE_SWITCHBOARD_RANDOMNESS",
  );
  if (canonicalCreateRecorded) {
    return Object.freeze({
      canonicalCreateRecorded: true,
      discardEligible: false,
    });
  }
  const preUpgradeCapacity = receiptSet.preUpgradeProgramDataCapacityBytes;
  check(
    Number.isSafeInteger(preUpgradeCapacity) && preUpgradeCapacity > 0,
    "Randomness discard inspection requires the frozen pre-upgrade ProgramData capacity",
  );
  const programDataExtensionRequired = preUpgradeCapacity < programArtifactBytes;
  const extensionReceiptPresent = receiptSet.receipts.some(
    ({ action }) => action === "EXTEND_PROGRAM_DATA",
  );
  check(
    extensionReceiptPresent === programDataExtensionRequired,
    "Randomness discard inspection extension evidence disagrees with frozen capacity",
  );
  assertCanonicalAttendedNextActionFromReceiptSet({
    receiptSet,
    expectedBinding: exactBinding,
    programDataExtensionRequired,
    nextAction: "CREATE_SWITCHBOARD_RANDOMNESS",
  });
  return Object.freeze({
    canonicalCreateRecorded: false,
    discardEligible: true,
  });
}

function meta(pubkey, isSigner = false, isWritable = false) {
  return { pubkey: new PublicKey(pubkey), isSigner, isWritable };
}

function switchboardState() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("STATE")],
    SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
  )[0];
}

function lutSigner(randomness) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("LutSigner"), randomness.toBuffer()],
    SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
  )[0];
}

function lutAddress(signer, recentSlot) {
  return AddressLookupTableProgram.createLookupTable({
    authority: signer,
    payer: PublicKey.default,
    recentSlot,
  })[1];
}

export function reviewedRandomnessInitInstruction({ admin, randomness, recentSlot }) {
  const exactAdmin = new PublicKey(admin);
  const exactRandomness = new PublicKey(randomness);
  check(Number.isSafeInteger(recentSlot) && recentSlot > 0, "Randomness init recent slot is invalid");
  const signer = lutSigner(exactRandomness);
  const data = Buffer.alloc(16);
  RANDOMNESS_INIT_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(BigInt(recentSlot), 8);
  return new TransactionInstruction({
    programId: SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
    data,
    keys: [
      meta(exactRandomness, true, true),
      meta(SWITCHBOARD_QUEUE, false, true),
      meta(exactAdmin, true, true),
      meta(exactAdmin, true, true),
      meta(getAssociatedTokenAddressSync(NATIVE_MINT, exactRandomness), false, true),
      meta(SystemProgram.programId),
      meta(TOKEN_PROGRAM_ID),
      meta(ASSOCIATED_TOKEN_PROGRAM_ID),
      meta(NATIVE_MINT),
      meta(switchboardState()),
      meta(signer),
      meta(lutAddress(signer, recentSlot), false, true),
      meta(AddressLookupTableProgram.programId),
    ],
  });
}

function sameInstruction(actual, expected) {
  return actual.programId.equals(expected.programId)
    && Buffer.from(actual.data).equals(Buffer.from(expected.data))
    && JSON.stringify(actual.keys.map(({ pubkey, isSigner, isWritable }) => ({
      pubkey: pubkey.toBase58(),
      isSigner,
      isWritable,
    }))) === JSON.stringify(expected.keys.map(({ pubkey, isSigner, isWritable }) => ({
      pubkey: pubkey.toBase58(),
      isSigner,
      isWritable,
    })));
}

function exactCompiledMessage(actual, expected, label) {
  check(
    actual.header.numRequiredSignatures === expected.header.numRequiredSignatures
      && actual.header.numReadonlySignedAccounts === expected.header.numReadonlySignedAccounts
      && actual.header.numReadonlyUnsignedAccounts === expected.header.numReadonlyUnsignedAccounts,
    `${label} compiled message header drifted`,
  );
  check(
    JSON.stringify(actual.accountKeys.map((key) => key.toBase58()))
      === JSON.stringify(expected.accountKeys.map((key) => key.toBase58())),
    `${label} compiled account keys drifted`,
  );
  check(
    JSON.stringify(actual.instructions) === JSON.stringify(expected.instructions),
    `${label} compiled instruction indexes drifted`,
  );
  check(
    Buffer.from(actual.serialize()).equals(Buffer.from(expected.serialize())),
    `${label} serialized canonical message drifted`,
  );
}

export async function verifyFinalizedRandomnessContinuity({
  record,
  createReceipt,
  predecessorReceipt,
  predecessorTransactionResponse,
  transactionResponse,
  observedAddress,
  accountInfo,
  accountContextSlot,
  expectedAdmin,
  expectedParticipant,
  expectedDestinationTokens,
  minimumCreationSlot,
  sha256Hex,
} = {}) {
  const exactRecord = canonicalRandomnessContinuityRecord(record);
  const admin = new PublicKey(expectedAdmin);
  const participant = new PublicKey(expectedParticipant);
  const destinationTokens = new PublicKey(expectedDestinationTokens);
  check(typeof sha256Hex === "function", "Exact randomness message hashing is unavailable");
  check(createReceipt?.action === "CREATE_SWITCHBOARD_RANDOMNESS", "Exact randomness CREATE receipt is missing");
  check(
    createReceipt.signature === exactRecord.createSignature,
    "Retained randomness CREATE signature does not match its receipt",
  );
  check(
    createReceipt.messageSha256 === exactRecord.createMessageSha256,
    "Retained randomness CREATE message hash does not match its receipt",
  );
  check(
    predecessorReceipt?.action === "SETTLE_LINKED_POSITION_3_WEEK_10",
    "Randomness CREATE canonical predecessor receipt is missing",
  );
  check(
    predecessorTransactionResponse?.meta && predecessorTransactionResponse.meta.err === null,
    "Randomness CREATE canonical predecessor transaction is missing or failed",
  );
  check(transactionResponse?.meta && transactionResponse.meta.err === null, "Finalized randomness CREATE transaction is missing or failed");
  check(
    Number.isSafeInteger(transactionResponse.slot)
      && transactionResponse.slot > 0
      && BigInt(transactionResponse.slot) >= BigInt(minimumCreationSlot),
    "Randomness CREATE transaction predates the reviewed source deployment",
  );
  check(
    Number.isSafeInteger(predecessorTransactionResponse.slot)
      && predecessorTransactionResponse.slot > 0
      && BigInt(predecessorTransactionResponse.slot) >= BigInt(minimumCreationSlot)
      && predecessorTransactionResponse.slot < transactionResponse.slot,
    "Randomness CREATE canonical predecessor slot is outside the reviewed source order",
  );
  check(
    Number.isSafeInteger(transactionResponse.blockTime) && transactionResponse.blockTime > 0,
    "Randomness CREATE finalized block time is unavailable",
  );
  const responseTransaction = transactionResponse.transaction;
  const message = responseTransaction?.message;
  const signatures = responseTransaction?.signatures;
  check(
    message instanceof Message
      && message.version === "legacy"
      && (transactionResponse.version === undefined || transactionResponse.version === "legacy"),
    "Randomness CREATE transaction is not an exact legacy message",
  );
  check(Array.isArray(signatures) && signatures.length === 2, "Randomness CREATE must have exactly two signatures");
  check(signatures[0] === exactRecord.createSignature, "Randomness CREATE primary signature drifted");
  check(message.header.numRequiredSignatures === 2, "Randomness CREATE message must require exactly two signers");
  check(message.accountKeys.length >= 2, "Randomness CREATE signer keys are missing");
  const randomness = new PublicKey(exactRecord.address);
  check(message.accountKeys[0].equals(admin), "Randomness CREATE fee payer is not the reviewed admin");
  check(message.accountKeys[1].equals(randomness), "Randomness CREATE ephemeral signer does not match the retained address");
  let transaction;
  try {
    transaction = Transaction.populate(message, signatures);
  } catch {
    throw new Error("Randomness CREATE raw legacy transaction cannot be reconstructed exactly");
  }
  check(transaction.verifySignatures(), "Randomness CREATE signatures do not verify against the exact message");
  check(transaction.instructions.length === 2, "Randomness CREATE must contain exactly two instructions");
  check(
    transaction.instructions.every((instruction) => !instruction.programId.equals(IAT_V2_PROGRAM_ID)),
    "Randomness CREATE transaction must not contain an IAT instruction",
  );
  const compute = ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 });
  check(sameInstruction(transaction.instructions[0], compute), "Randomness CREATE compute-budget instruction drifted");
  const init = transaction.instructions[1];
  check(
    init.data.length === 16
      && Buffer.from(init.data).subarray(0, 8).equals(RANDOMNESS_INIT_DISCRIMINATOR),
    "Randomness CREATE Switchboard discriminator/data drifted",
  );
  const recentSlotBig = Buffer.from(init.data).readBigUInt64LE(8);
  check(
    recentSlotBig > 0n && recentSlotBig <= BigInt(Number.MAX_SAFE_INTEGER),
    "Randomness CREATE Switchboard recent slot is invalid",
  );
  const expectedInit = reviewedRandomnessInitInstruction({
    admin,
    randomness,
    recentSlot: Number(recentSlotBig),
  });
  check(sameInstruction(init, expectedInit), "Randomness CREATE pinned Switchboard init instruction drifted");
  const expectedMessage = new Transaction({
    feePayer: admin,
    recentBlockhash: message.recentBlockhash,
  }).add(compute, expectedInit).compileMessage();
  exactCompiledMessage(message, expectedMessage, "Randomness CREATE");
  const observedMessageSha256 = await sha256Hex(message.serialize());
  check(
    observedMessageSha256 === exactRecord.createMessageSha256,
    "Finalized randomness CREATE raw message hash drifted",
  );
  check(new PublicKey(observedAddress).equals(randomness), "Observed randomness address does not match the retained record");
  check(
    Number.isSafeInteger(accountContextSlot) && accountContextSlot >= transactionResponse.slot,
    "Finalized randomness account observation predates its CREATE transaction",
  );
  check(
    accountInfo?.owner?.equals(SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID),
    "Retained randomness account is missing or not owned by the pinned Switchboard program",
  );

  const predecessorResponseTransaction = predecessorTransactionResponse.transaction;
  const predecessorMessage = predecessorResponseTransaction?.message;
  const predecessorSignatures = predecessorResponseTransaction?.signatures;
  check(
    predecessorMessage instanceof Message
      && predecessorMessage.version === "legacy"
      && (
        predecessorTransactionResponse.version === undefined
        || predecessorTransactionResponse.version === "legacy"
      ),
    "Randomness CREATE canonical predecessor is not an exact legacy message",
  );
  check(
    Array.isArray(predecessorSignatures) && predecessorSignatures.length === 1,
    "Randomness CREATE canonical predecessor must have exactly one signature",
  );
  check(
    predecessorSignatures[0] === predecessorReceipt.signature,
    "Randomness CREATE canonical predecessor primary signature drifted",
  );
  check(
    predecessorMessage.header.numRequiredSignatures === 1
      && predecessorMessage.accountKeys[0]?.equals(admin),
    "Randomness CREATE canonical predecessor signer is not the reviewed admin",
  );
  let predecessorTransaction;
  try {
    predecessorTransaction = Transaction.populate(predecessorMessage, predecessorSignatures);
  } catch {
    throw new Error("Randomness CREATE canonical predecessor cannot be reconstructed exactly");
  }
  check(
    predecessorTransaction.verifySignatures(),
    "Randomness CREATE canonical predecessor signature does not verify",
  );
  check(
    predecessorTransaction.instructions.length === 1,
    "Randomness CREATE canonical predecessor must contain exactly one instruction",
  );
  const mint = new PublicKey(exactRecord.mint);
  const { config } = deriveIatV2Addresses({ mint, programId: IAT_V2_PROGRAM_ID });
  const expectedPredecessorInstruction = buildSettlePositionWeekInstruction({
    caller: admin,
    mint,
    positionOwner: participant,
    positionId: 3,
    destinationTokens,
    week: 10,
    round: deriveRoundAddress({ config, programId: IAT_V2_PROGRAM_ID, week: 10 }),
  });
  check(
    predecessorTransaction.instructions[0].programId.equals(expectedPredecessorInstruction.programId)
      && Buffer.from(predecessorTransaction.instructions[0].data)
        .equals(Buffer.from(expectedPredecessorInstruction.data)),
    "Randomness CREATE canonical predecessor settlement instruction drifted",
  );
  const expectedPredecessorMessage = new Transaction({
    feePayer: admin,
    recentBlockhash: predecessorMessage.recentBlockhash,
  }).add(expectedPredecessorInstruction).compileMessage();
  exactCompiledMessage(
    predecessorMessage,
    expectedPredecessorMessage,
    "Randomness CREATE canonical predecessor",
  );
  const predecessorMessageSha256 = await sha256Hex(predecessorMessage.serialize());
  check(
    predecessorMessageSha256 === predecessorReceipt.messageSha256,
    "Randomness CREATE canonical predecessor message hash drifted",
  );
  const verified = Object.freeze({
    record: exactRecord,
    address: randomness,
    createSlot: transactionResponse.slot,
    accountContextSlot,
    predecessorSlot: predecessorTransactionResponse.slot,
    finalizedAtUtc: new Date(transactionResponse.blockTime * 1_000).toISOString(),
    messageSha256: observedMessageSha256,
  });
  verifiedContinuityCapabilities.add(verified);
  return verified;
}

function featureEvidenceRecord(value) {
  exactKeys(value, [
    "action",
    "title",
    "signature",
    "messageSha256",
    "explorerUrl",
    "finalizedAtUtc",
    "week",
  ], "source-bound feature evidence record");
  const exact = canonicalAttendedReceipt({ ...value, kind: "feature" });
  return Object.freeze({
    action: exact.action,
    title: exact.title,
    signature: exact.signature,
    messageSha256: exact.messageSha256,
    explorerUrl: exact.explorerUrl,
    finalizedAtUtc: exact.finalizedAtUtc,
    week: exact.week,
  });
}

function featureEvidenceRecords(value) {
  let parsed;
  try {
    parsed = value === null ? [] : JSON.parse(value);
  } catch {
    throw new Error("Source-bound feature evidence is not valid JSON");
  }
  check(Array.isArray(parsed), "Source-bound feature evidence must be an array");
  const records = parsed.map(featureEvidenceRecord);
  check(
    new Set(records.map(({ action }) => action)).size === records.length,
    "Source-bound feature evidence repeats an action",
  );
  check(
    new Set(records.map(({ signature }) => signature)).size === records.length,
    "Source-bound feature evidence repeats a signature",
  );
  return records;
}

function sameRecord(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function reconcileVerifiedRandomnessCreateJournal({
  storage,
  expectedBinding,
  journal,
  verifiedContinuity,
  continuityStorageKey,
  featureEvidenceKey,
  programArtifactBytes,
} = {}) {
  check(
    verifiedContinuityCapabilities.has(verifiedContinuity),
    "Randomness CREATE recovery requires genuine finalized continuity verification",
  );
  check(
    typeof continuityStorageKey === "string" && continuityStorageKey.length > 0,
    "Randomness continuity storage key is unavailable",
  );
  check(
    typeof featureEvidenceKey === "string" && featureEvidenceKey.length > 0,
    "Feature evidence storage key is unavailable",
  );
  check(
    Number.isSafeInteger(programArtifactBytes) && programArtifactBytes > 0,
    "Program artifact byte length is unavailable for CREATE recovery",
  );
  const exactBinding = exactSourceBinding(expectedBinding);
  const exactJournal = parseRandomnessCreateJournal(journal, exactBinding);
  const retainedJournal = loadRandomnessCreateJournal(storage, exactBinding);
  check(retainedJournal && sameRecord(retainedJournal, exactJournal), "Durable randomness CREATE journal drifted");
  const continuity = randomnessJournalContinuityRecord(exactJournal);
  check(
    sameRecord(verifiedContinuity.record, continuity)
      && verifiedContinuity.address.equals(new PublicKey(continuity.address))
      && verifiedContinuity.messageSha256 === continuity.createMessageSha256,
    "Verified finalized randomness continuity does not match the recovery journal",
  );

  const finalizedReceipt = featureEvidenceRecord({
    action: "CREATE_SWITCHBOARD_RANDOMNESS",
    title: exactJournal.title,
    signature: exactJournal.createSignature,
    messageSha256: exactJournal.createMessageSha256,
    explorerUrl: `https://explorer.solana.com/tx/${exactJournal.createSignature}?cluster=devnet`,
    finalizedAtUtc: verifiedContinuity.finalizedAtUtc,
    week: null,
  });
  const canonicalFinalizedReceipt = canonicalAttendedReceipt({
    ...finalizedReceipt,
    kind: "feature",
  });
  const receiptSet = loadAttendedReceiptSet(storage, exactBinding);
  const preUpgradeCapacity = receiptSet.preUpgradeProgramDataCapacityBytes;
  check(
    Number.isSafeInteger(preUpgradeCapacity) && preUpgradeCapacity > 0,
    "Randomness CREATE recovery requires the frozen pre-upgrade ProgramData capacity",
  );
  const programDataExtensionRequired = preUpgradeCapacity < programArtifactBytes;
  const extensionReceiptPresent = receiptSet.receipts.some(
    ({ action }) => action === "EXTEND_PROGRAM_DATA",
  );
  check(
    extensionReceiptPresent === programDataExtensionRequired,
    "Randomness CREATE recovery extension evidence disagrees with frozen capacity",
  );
  const createIndex = receiptSet.receipts.findIndex(
    ({ action }) => action === "CREATE_SWITCHBOARD_RANDOMNESS",
  );
  check(
    createIndex === -1 || createIndex === receiptSet.receipts.length - 1,
    "Randomness CREATE recovery journal remained after later canonical receipts",
  );
  const prefixReceipts = createIndex === -1
    ? receiptSet.receipts
    : receiptSet.receipts.slice(0, createIndex);
  const prefixSet = canonicalReceiptSet({
    ...exactBinding,
    preUpgradeProgramDataCapacityBytes: preUpgradeCapacity,
    receipts: prefixReceipts,
  });
  assertCanonicalAttendedNextActionFromReceiptSet({
    receiptSet: prefixSet,
    expectedBinding: exactBinding,
    programDataExtensionRequired,
    nextAction: "CREATE_SWITCHBOARD_RANDOMNESS",
  });
  if (createIndex !== -1) {
    check(
      sameRecord(receiptSet.receipts[createIndex], canonicalFinalizedReceipt),
      "Recovered randomness CREATE receipt conflicts with canonical attended evidence",
    );
  }

  const retainedContinuity = storedValue(storage, continuityStorageKey, "Randomness continuity");
  if (retainedContinuity === null) {
    persistExactJson(storage, continuityStorageKey, continuity, "Randomness continuity");
  } else {
    const parsed = parseRandomnessContinuityRecord(retainedContinuity, exactBinding);
    check(sameRecord(parsed, continuity), "Retained randomness continuity conflicts with the recovery journal");
  }
  const nextReceiptSet = persistAttendedReceipt(storage, exactBinding, canonicalFinalizedReceipt);

  const existingEvidence = featureEvidenceRecords(
    storedValue(storage, featureEvidenceKey, "Source-bound feature evidence"),
  );
  const existingCreate = existingEvidence.find(
    ({ action }) => action === "CREATE_SWITCHBOARD_RANDOMNESS",
  );
  if (existingCreate) {
    check(
      sameRecord(existingCreate, finalizedReceipt),
      "Recovered randomness CREATE receipt conflicts with source-bound feature evidence",
    );
  }
  const nextEvidence = existingCreate
    ? existingEvidence
    : [...existingEvidence, finalizedReceipt];
  persistExactJson(storage, featureEvidenceKey, nextEvidence, "Source-bound feature evidence");
  clearRandomnessCreateJournal(storage, exactBinding);
  return Object.freeze({
    continuity,
    receipt: finalizedReceipt,
    receiptSet: nextReceiptSet,
    featureEvidence: Object.freeze(nextEvidence),
  });
}
