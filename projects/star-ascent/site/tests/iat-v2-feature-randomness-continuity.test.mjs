import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  ComputeBudgetProgram,
  Keypair,
  Message,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import nacl from "tweetnacl";
import {
  SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
  deriveIatV2Addresses,
  deriveRoundAddress,
} from "../programs/iat_v2/client.mjs";
import { buildSettlePositionWeekInstruction } from "../programs/iat_v2/feature-instructions.mjs";
import {
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES,
  IAT_V2_PROGRAM_ID,
} from "../programs/iat_v2/instructions.mjs";
import {
  attendedReceiptStorageKey,
  canonicalAttendedActionClassification,
  canonicalReceiptSet,
} from "../tools/iat-v2-admin-console/attended-evidence.mjs";
import {
  IAT_V2_RANDOMNESS_CREATE_TITLE,
  canonicalRandomnessCreateJournal,
  canonicalRandomnessContinuityRecord,
  inspectCanonicalRandomnessDiscardEligibility,
  loadRandomnessCreateJournal,
  parseRandomnessContinuityRecord,
  persistRandomnessCreateJournal,
  randomnessCreateJournalStorageKey,
  reconcileVerifiedRandomnessCreateJournal,
  reviewedRandomnessInitInstruction,
  verifyFinalizedRandomnessContinuity,
} from "../tools/iat-v2-admin-console/feature-randomness-continuity.mjs";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const sourceCommit = "a".repeat(40);
const programArtifactSha256 = "b".repeat(64);

function base58Encode(value) {
  const bytes = Buffer.from(value);
  let number = 0n;
  for (const byte of bytes) number = (number << 8n) + BigInt(byte);
  let encoded = "";
  while (number > 0n) {
    encoded = BASE58_ALPHABET[Number(number % 58n)] + encoded;
    number /= 58n;
  }
  let zeroes = 0;
  while (zeroes < bytes.length && bytes[zeroes] === 0) zeroes += 1;
  return "1".repeat(zeroes) + encoded;
}

function sha256Hex(value) {
  return Promise.resolve(createHash("sha256").update(value).digest("hex"));
}

function signedCreateFixture({ extraInstruction = null, feePayer = null } = {}) {
  const admin = feePayer ?? Keypair.generate();
  const randomness = Keypair.generate();
  const mint = Keypair.generate().publicKey;
  const participant = Keypair.generate().publicKey;
  const destinationTokens = Keypair.generate().publicKey;
  const transaction = new Transaction({
    feePayer: admin.publicKey,
    recentBlockhash: Keypair.generate().publicKey.toBase58(),
  }).add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
    reviewedRandomnessInitInstruction({
      admin: admin.publicKey,
      randomness: randomness.publicKey,
      recentSlot: 321,
    }),
  );
  if (extraInstruction) transaction.add(extraInstruction);
  transaction.sign(admin, randomness);
  const message = transaction.compileMessage();
  const signatures = transaction.signatures.map(({ signature }) => base58Encode(signature));
  const createMessageSha256 = createHash("sha256").update(message.serialize()).digest("hex");
  const { config } = deriveIatV2Addresses({ mint, programId: IAT_V2_PROGRAM_ID });
  const predecessorTransaction = new Transaction({
    feePayer: admin.publicKey,
    recentBlockhash: Keypair.generate().publicKey.toBase58(),
  }).add(buildSettlePositionWeekInstruction({
    caller: admin.publicKey,
    mint,
    positionOwner: participant,
    positionId: 3,
    destinationTokens,
    week: 12,
    round: deriveRoundAddress({ config, programId: IAT_V2_PROGRAM_ID, week: 12 }),
  }));
  predecessorTransaction.sign(admin);
  const predecessorMessage = predecessorTransaction.compileMessage();
  const predecessorSignatures = predecessorTransaction.signatures.map(
    ({ signature }) => base58Encode(signature),
  );
  const predecessorMessageSha256 = createHash("sha256")
    .update(predecessorMessage.serialize())
    .digest("hex");
  const record = canonicalRandomnessContinuityRecord({
    sourceCommit,
    programArtifactSha256,
    mint: mint.toBase58(),
    address: randomness.publicKey.toBase58(),
    createSignature: signatures[0],
    createMessageSha256,
  });
  return {
    admin,
    participant,
    destinationTokens,
    randomness,
    message,
    signatures,
    record,
    receipt: {
      action: "CREATE_SWITCHBOARD_RANDOMNESS",
      signature: signatures[0],
      messageSha256: createMessageSha256,
    },
    transactionResponse: {
      slot: 500,
      blockTime: 1_777_777_777,
      version: "legacy",
      meta: { err: null },
      transaction: { message, signatures },
    },
    predecessorReceipt: {
      action: "SETTLE_LINKED_POSITION_3_WEEK_12",
      signature: predecessorSignatures[0],
      messageSha256: predecessorMessageSha256,
    },
    predecessorTransactionResponse: {
      slot: 499,
      version: "legacy",
      meta: { err: null },
      transaction: { message: predecessorMessage, signatures: predecessorSignatures },
    },
  };
}

function verificationInput(fixture, overrides = {}) {
  return {
    record: fixture.record,
    createReceipt: fixture.receipt,
    predecessorReceipt: fixture.predecessorReceipt,
    predecessorTransactionResponse: fixture.predecessorTransactionResponse,
    transactionResponse: fixture.transactionResponse,
    observedAddress: fixture.randomness.publicKey,
    accountInfo: { owner: SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID },
    accountContextSlot: 600,
    expectedAdmin: fixture.admin.publicKey,
    expectedParticipant: fixture.participant,
    expectedDestinationTokens: fixture.destinationTokens,
    minimumCreationSlot: 400,
    sha256Hex,
    ...overrides,
  };
}

function signedPredecessorEvidence({
  fixture,
  instruction,
  feePayer = fixture.admin,
  signers = [fixture.admin],
} = {}) {
  const transaction = new Transaction({
    feePayer: feePayer.publicKey,
    recentBlockhash: Keypair.generate().publicKey.toBase58(),
  }).add(instruction);
  transaction.sign(...signers);
  const message = transaction.compileMessage();
  const signatures = transaction.signatures.map(({ signature }) => base58Encode(signature));
  const messageSha256 = createHash("sha256").update(message.serialize()).digest("hex");
  return {
    receipt: {
      action: "SETTLE_LINKED_POSITION_3_WEEK_12",
      signature: signatures[0],
      messageSha256,
    },
    response: {
      slot: 499,
      version: "legacy",
      meta: { err: null },
      transaction: { message, signatures },
    },
  };
}

test("continuity record is exact, versioned, and source/artifact/mint bound", () => {
  const fixture = signedCreateFixture();
  assert.deepEqual(
    parseRandomnessContinuityRecord(JSON.stringify(fixture.record), {
      sourceCommit,
      programArtifactSha256,
      mint: fixture.record.mint,
    }),
    fixture.record,
  );
  assert.throws(
    () => parseRandomnessContinuityRecord(fixture.record.address, {
      sourceCommit,
      programArtifactSha256,
      mint: fixture.record.mint,
    }),
    /not valid JSON/u,
  );
  assert.throws(
    () => parseRandomnessContinuityRecord(fixture.record, {
      sourceCommit: "c".repeat(40),
      programArtifactSha256,
      mint: fixture.record.mint,
    }),
    /source commit drifted/u,
  );
  assert.throws(
    () => parseRandomnessContinuityRecord(fixture.record, {
      sourceCommit,
      programArtifactSha256: "d".repeat(64),
      mint: fixture.record.mint,
    }),
    /artifact SHA-256 drifted/u,
  );
  assert.throws(
    () => parseRandomnessContinuityRecord(fixture.record, {
      sourceCommit,
      programArtifactSha256,
      mint: Keypair.generate().publicKey.toBase58(),
    }),
    /mint drifted/u,
  );
});

test("finalized continuity reconstructs the exact two-signer CREATE message", async () => {
  const fixture = signedCreateFixture();
  const observed = await verifyFinalizedRandomnessContinuity(verificationInput(fixture));
  assert.equal(observed.address.toBase58(), fixture.record.address);
  assert.equal(observed.createSlot, 500);
  assert.equal(observed.accountContextSlot, 600);
  assert.equal(observed.messageSha256, fixture.record.createMessageSha256);
});

test("continuity rejects mismatched receipt, failed or stale transaction, and wrong account", async () => {
  const fixture = signedCreateFixture();
  await assert.rejects(
    verifyFinalizedRandomnessContinuity(verificationInput(fixture, {
      createReceipt: { ...fixture.receipt, signature: signedCreateFixture().record.createSignature },
    })),
    /signature does not match/u,
  );
  await assert.rejects(
    verifyFinalizedRandomnessContinuity(verificationInput(fixture, {
      createReceipt: { ...fixture.receipt, messageSha256: "0".repeat(64) },
    })),
    /message hash does not match/u,
  );
  await assert.rejects(
    verifyFinalizedRandomnessContinuity(verificationInput(fixture, {
      transactionResponse: { ...fixture.transactionResponse, meta: { err: { InstructionError: [1, 1] } } },
    })),
    /missing or failed/u,
  );
  await assert.rejects(
    verifyFinalizedRandomnessContinuity(verificationInput(fixture, {
      minimumCreationSlot: 501,
    })),
    /predates the reviewed source deployment/u,
  );
  await assert.rejects(
    verifyFinalizedRandomnessContinuity(verificationInput(fixture, {
      observedAddress: Keypair.generate().publicKey,
    })),
    /Observed randomness address/u,
  );
  await assert.rejects(
    verifyFinalizedRandomnessContinuity(verificationInput(fixture, {
      accountContextSlot: 499,
    })),
    /account observation predates/u,
  );
  await assert.rejects(
    verifyFinalizedRandomnessContinuity(verificationInput(fixture, {
      accountInfo: { owner: IAT_V2_PROGRAM_ID },
    })),
    /missing or not owned/u,
  );
  await assert.rejects(
    verifyFinalizedRandomnessContinuity(verificationInput(fixture, {
      expectedAdmin: Keypair.generate().publicKey,
    })),
    /fee payer is not the reviewed admin/u,
  );
  await assert.rejects(
    verifyFinalizedRandomnessContinuity(verificationInput(fixture, {
      transactionResponse: { ...fixture.transactionResponse, version: 0 },
    })),
    /not an exact legacy message/u,
  );
});

test("continuity rejects extra or IAT instructions and raw-message hash drift", async () => {
  const extraInstruction = new TransactionInstruction({
    programId: IAT_V2_PROGRAM_ID,
    keys: [],
    data: Buffer.alloc(0),
  });
  const extra = signedCreateFixture({ extraInstruction });
  await assert.rejects(
    verifyFinalizedRandomnessContinuity(verificationInput(extra)),
    /exactly two instructions/u,
  );

  const fixture = signedCreateFixture();
  await assert.rejects(
    verifyFinalizedRandomnessContinuity(verificationInput(fixture, {
      sha256Hex: async () => "0".repeat(64),
    })),
    /raw message hash drifted/u,
  );
});

test("continuity rejects a validly re-signed message with an unused readonly account key", async () => {
  const fixture = signedCreateFixture();
  const pollutedMessage = new Message({
    header: {
      ...fixture.message.header,
      numReadonlyUnsignedAccounts: fixture.message.header.numReadonlyUnsignedAccounts + 1,
    },
    accountKeys: [...fixture.message.accountKeys, Keypair.generate().publicKey],
    recentBlockhash: fixture.message.recentBlockhash,
    instructions: fixture.message.instructions,
  });
  const messageBytes = pollutedMessage.serialize();
  const signatures = [fixture.admin, fixture.randomness].map(({ secretKey }) => (
    base58Encode(nacl.sign.detached(messageBytes, secretKey))
  ));
  const createMessageSha256 = createHash("sha256").update(messageBytes).digest("hex");
  const polluted = {
    ...fixture,
    record: canonicalRandomnessContinuityRecord({
      ...fixture.record,
      createSignature: signatures[0],
      createMessageSha256,
    }),
    receipt: {
      action: "CREATE_SWITCHBOARD_RANDOMNESS",
      signature: signatures[0],
      messageSha256: createMessageSha256,
    },
    transactionResponse: {
      ...fixture.transactionResponse,
      transaction: { message: pollutedMessage, signatures },
    },
  };
  await assert.rejects(
    verifyFinalizedRandomnessContinuity(verificationInput(polluted)),
    /compiled message header drifted|compiled account keys drifted|serialized canonical message drifted/u,
  );
});

test("continuity requires the exact signed canonical predecessor and finalized order", async () => {
  const fixture = signedCreateFixture();
  const exactPredecessor = Transaction.populate(
    fixture.predecessorTransactionResponse.transaction.message,
    fixture.predecessorTransactionResponse.transaction.signatures,
  ).instructions[0];
  await assert.rejects(
    verifyFinalizedRandomnessContinuity(verificationInput(fixture, {
      predecessorReceipt: null,
    })),
    /canonical predecessor receipt is missing/u,
  );
  await assert.rejects(
    verifyFinalizedRandomnessContinuity(verificationInput(fixture, {
      predecessorTransactionResponse: {
        ...fixture.predecessorTransactionResponse,
        slot: fixture.transactionResponse.slot,
      },
    })),
    /canonical predecessor slot is outside the reviewed source order/u,
  );
  await assert.rejects(
    verifyFinalizedRandomnessContinuity(verificationInput(fixture, {
      predecessorTransactionResponse: {
        ...fixture.predecessorTransactionResponse,
        slot: 399,
      },
    })),
    /canonical predecessor slot is outside the reviewed source order/u,
  );
  await assert.rejects(
    verifyFinalizedRandomnessContinuity(verificationInput(fixture, {
      predecessorReceipt: {
        ...fixture.predecessorReceipt,
        action: "SETTLE_LINKED_POSITION_3_WEEK_11",
      },
    })),
    /canonical predecessor receipt is missing/u,
  );
  await assert.rejects(
    verifyFinalizedRandomnessContinuity(verificationInput(fixture, {
      predecessorReceipt: {
        ...fixture.predecessorReceipt,
        messageSha256: "0".repeat(64),
      },
    })),
    /canonical predecessor message hash drifted/u,
  );
  const imposter = Keypair.generate();
  const wrongSigner = signedPredecessorEvidence({
    fixture,
    instruction: exactPredecessor,
    feePayer: imposter,
    signers: [imposter, fixture.admin],
  });
  await assert.rejects(
    verifyFinalizedRandomnessContinuity(verificationInput(fixture, {
      predecessorReceipt: wrongSigner.receipt,
      predecessorTransactionResponse: wrongSigner.response,
    })),
    /exactly one signature|signer is not the reviewed admin/u,
  );
  const wrongProgram = signedPredecessorEvidence({
    fixture,
    instruction: new TransactionInstruction({
      programId: Keypair.generate().publicKey,
      keys: exactPredecessor.keys,
      data: exactPredecessor.data,
    }),
  });
  await assert.rejects(
    verifyFinalizedRandomnessContinuity(verificationInput(fixture, {
      predecessorReceipt: wrongProgram.receipt,
      predecessorTransactionResponse: wrongProgram.response,
    })),
    /canonical predecessor settlement instruction drifted/u,
  );
  await assert.rejects(
    verifyFinalizedRandomnessContinuity(verificationInput(fixture, {
      transactionResponse: { ...fixture.transactionResponse, blockTime: null },
    })),
    /finalized block time is unavailable/u,
  );
});

function faultStorage() {
  const values = new Map();
  let fault = null;
  const touched = new Set();
  return {
    seed(key, value) {
      values.set(key, value);
    },
    fault(next) {
      fault = next;
      touched.clear();
    },
    getItem(key) {
      const value = values.get(key) ?? null;
      if (fault?.type === "readback" && fault.key === key && touched.has(key) && value !== null) {
        return `${value} `;
      }
      return value;
    },
    setItem(key, value) {
      if (fault?.type === "set" && fault.key === key) {
        throw new DOMException("quota", "QuotaExceededError");
      }
      values.set(key, value);
      touched.add(key);
    },
    removeItem(key) {
      if (fault?.type === "remove" && fault.key === key) {
        throw new Error("remove denied");
      }
      values.delete(key);
    },
  };
}

const canonicalPreCreateActions = Object.freeze([
  "UPGRADE_PROGRAM",
  "MIGRATE_LEGACY_ROUND_WEEK_7",
  "MIGRATE_LEGACY_ROUND_WEEK_8",
  "BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_9",
  "BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_10",
  "BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_11",
  "BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_12",
  "SETTLE_STANDARD_POSITION_WEEK_10",
  "SETTLE_STANDARD_POSITION_WEEK_11",
  "SETTLE_STANDARD_POSITION_WEEK_12",
  "SETTLE_STANDARD_POSITION_WEEK_13",
  "SETTLE_LINKED_POSITION_2_WEEK_9",
  "SETTLE_LINKED_POSITION_2_WEEK_10",
  "SETTLE_LINKED_POSITION_2_WEEK_11",
  "SETTLE_LINKED_POSITION_2_WEEK_12",
  "SETTLE_LINKED_POSITION_3_WEEK_9",
  "SETTLE_LINKED_POSITION_3_WEEK_10",
  "SETTLE_LINKED_POSITION_3_WEEK_11",
  "SETTLE_LINKED_POSITION_3_WEEK_12",
]);

function preCreateReceiptSet(binding) {
  return canonicalReceiptSet({
    ...binding,
    preUpgradeProgramDataCapacityBytes: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES,
    receipts: canonicalPreCreateActions.map((action, index) => {
      const classification = canonicalAttendedActionClassification(action);
      const signature = base58Encode(Buffer.alloc(64, index + 1));
      return {
        action,
        title: `Canonical predecessor ${index + 1}`,
        signature,
        messageSha256: (index + 1).toString(16).padStart(64, "0"),
        explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
        finalizedAtUtc: new Date(1_700_000_000_000 + index * 1_000).toISOString(),
        kind: classification.kind,
        week: classification.week,
      };
    }),
  });
}

test("first render cannot discard continuity when strict canonical CREATE survives lost feature evidence", () => {
  const fixture = signedCreateFixture();
  const binding = {
    sourceCommit: fixture.record.sourceCommit,
    programArtifactSha256: fixture.record.programArtifactSha256,
    mint: fixture.record.mint,
  };
  const prefix = preCreateReceiptSet(binding);
  const createReceipt = {
    action: "CREATE_SWITCHBOARD_RANDOMNESS",
    title: IAT_V2_RANDOMNESS_CREATE_TITLE,
    signature: fixture.record.createSignature,
    messageSha256: fixture.record.createMessageSha256,
    explorerUrl: `https://explorer.solana.com/tx/${fixture.record.createSignature}?cluster=devnet`,
    finalizedAtUtc: "2026-05-03T03:09:37.000Z",
    kind: "feature",
    week: null,
  };
  const storage = faultStorage();
  storage.seed(attendedReceiptStorageKey(binding), JSON.stringify(canonicalReceiptSet({
    ...binding,
    preUpgradeProgramDataCapacityBytes: prefix.preUpgradeProgramDataCapacityBytes,
    receipts: [...prefix.receipts, createReceipt],
  })));
  const result = inspectCanonicalRandomnessDiscardEligibility({
    storage,
    expectedBinding: binding,
    programArtifactBytes: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES,
  });
  assert.deepEqual(result, {
    canonicalCreateRecorded: true,
    discardEligible: false,
  });
  assert.equal(storage.getItem(`feature/${binding.mint}`), null, "feature evidence must remain absent in the race fixture");

  storage.seed(attendedReceiptStorageKey(binding), "{malformed");
  assert.throws(
    () => inspectCanonicalRandomnessDiscardEligibility({
      storage,
      expectedBinding: binding,
      programArtifactBytes: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES,
    }),
    /JSON/u,
  );
});

async function recoveryFixture() {
  const fixture = signedCreateFixture();
  const verified = await verifyFinalizedRandomnessContinuity(verificationInput(fixture));
  const binding = {
    sourceCommit: fixture.record.sourceCommit,
    programArtifactSha256: fixture.record.programArtifactSha256,
    mint: fixture.record.mint,
  };
  const journal = canonicalRandomnessCreateJournal({
    sourceCommit: fixture.record.sourceCommit,
    programArtifactSha256: fixture.record.programArtifactSha256,
    mint: fixture.record.mint,
    address: fixture.record.address,
    createSignature: fixture.record.createSignature,
    createMessageSha256: fixture.record.createMessageSha256,
    title: IAT_V2_RANDOMNESS_CREATE_TITLE,
  });
  const storage = faultStorage();
  storage.seed(attendedReceiptStorageKey(binding), JSON.stringify(preCreateReceiptSet(binding)));
  persistRandomnessCreateJournal(storage, journal);
  return {
    binding,
    continuityKey: `continuity/${binding.mint}`,
    featureEvidenceKey: `feature/${binding.mint}`,
    fixture,
    journal,
    journalKey: randomnessCreateJournalStorageKey(binding),
    storage,
    verified,
  };
}

function reconcileRecovery(target) {
  return reconcileVerifiedRandomnessCreateJournal({
    storage: target.storage,
    expectedBinding: target.binding,
    journal: target.journal,
    verifiedContinuity: target.verified,
    continuityStorageKey: target.continuityKey,
    featureEvidenceKey: target.featureEvidenceKey,
    programArtifactBytes: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES,
  });
}

test("a finalized CREATE journal recovers all exact durable evidence and clears only itself", async () => {
  const target = await recoveryFixture();
  const recovered = reconcileRecovery(target);
  assert.equal(recovered.receipt.signature, target.fixture.record.createSignature);
  assert.equal(recovered.receipt.messageSha256, target.fixture.record.createMessageSha256);
  assert.equal(recovered.receipt.finalizedAtUtc, "2026-05-03T03:09:37.000Z");
  assert.equal(loadRandomnessCreateJournal(target.storage, target.binding), null);
  assert.deepEqual(
    parseRandomnessContinuityRecord(target.storage.getItem(target.continuityKey), target.binding),
    target.fixture.record,
  );
  assert.equal(
    JSON.parse(target.storage.getItem(target.featureEvidenceKey))[0].action,
    "CREATE_SWITCHBOARD_RANDOMNESS",
  );
});

test("every journal reconciliation write boundary fails closed and is retryable", async () => {
  for (const boundary of [
    { label: "continuity set", type: "set", key: (target) => target.continuityKey },
    { label: "continuity readback", type: "readback", key: (target) => target.continuityKey },
    { label: "canonical set", type: "set", key: (target) => attendedReceiptStorageKey(target.binding) },
    { label: "canonical readback", type: "readback", key: (target) => attendedReceiptStorageKey(target.binding) },
    { label: "feature set", type: "set", key: (target) => target.featureEvidenceKey },
    { label: "feature readback", type: "readback", key: (target) => target.featureEvidenceKey },
    { label: "journal remove", type: "remove", key: (target) => target.journalKey },
  ]) {
    const target = await recoveryFixture();
    target.storage.fault({ type: boundary.type, key: boundary.key(target) });
    assert.throws(() => reconcileRecovery(target), undefined, boundary.label);
    target.storage.fault(null);
    assert.ok(loadRandomnessCreateJournal(target.storage, target.binding), `${boundary.label} lost the recovery journal`);
    const recovered = reconcileRecovery(target);
    assert.equal(recovered.receipt.signature, target.fixture.record.createSignature, boundary.label);
    assert.equal(loadRandomnessCreateJournal(target.storage, target.binding), null, boundary.label);
  }
});

test("journal quota failure occurs before any recoverable CREATE evidence is accepted", () => {
  const fixture = signedCreateFixture();
  const binding = {
    sourceCommit: fixture.record.sourceCommit,
    programArtifactSha256: fixture.record.programArtifactSha256,
    mint: fixture.record.mint,
  };
  const journal = canonicalRandomnessCreateJournal({
    sourceCommit: fixture.record.sourceCommit,
    programArtifactSha256: fixture.record.programArtifactSha256,
    mint: fixture.record.mint,
    address: fixture.record.address,
    createSignature: fixture.record.createSignature,
    createMessageSha256: fixture.record.createMessageSha256,
  });
  const storage = faultStorage();
  const key = randomnessCreateJournalStorageKey(binding);
  storage.fault({ type: "set", key });
  assert.throws(
    () => persistRandomnessCreateJournal(storage, journal),
    /storage is unavailable or non-durable/u,
  );
  storage.fault(null);
  assert.equal(loadRandomnessCreateJournal(storage, binding), null);
});
