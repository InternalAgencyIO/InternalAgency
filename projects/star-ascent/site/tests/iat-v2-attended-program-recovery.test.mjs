import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { Keypair, PublicKey } from "@solana/web3.js";

import {
  attendedProgramHoldStatus,
  attendedProgramRecoveryHold,
  classifyAttendedProgramRecovery,
} from "../tools/iat-v2-admin-console/attended-program-recovery.mjs";
import {
  IAT_V2_ATTENDED_PROGRAM_SIGNED_PENDING_SCHEMA,
  loadAttendedProgramSignedPending,
  persistAttendedProgramSignedPending,
} from "../tools/iat-v2-admin-console/attended-program-signed-pending.mjs";
import {
  attendedPromptLatchKey,
  createAttendedModelTPromptCoordinator,
  loadAttendedModelTPromptLatch,
} from "../tools/iat-v2-admin-console/attended-prompt-coordinator.mjs";
import { buildProgramDataExtensionTransaction } from "../tools/iat-v2-admin-console/program-extension-attended.mjs";

const signer = "7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH";
const pending = Object.freeze({ messageSha256: "c".repeat(64), signer });
const latch = (status, overrides = {}) => Object.freeze({
  status,
  messageSha256: pending.messageSha256,
  signer,
  ...overrides,
});

test("recovery classifier distinguishes every latch and pending evidence boundary", () => {
  assert.equal(classifyAttendedProgramRecovery({ promptLatch: null, signedPending: null }).outcome, "NONE");
  assert.equal(
    classifyAttendedProgramRecovery({ promptLatch: latch("PROMPT_ENTERED"), signedPending: null }).code,
    "PROMPT_ENTERED_WITHOUT_PENDING",
  );
  assert.equal(
    classifyAttendedProgramRecovery({ promptLatch: latch("PROMPT_FAILED"), signedPending: null }).code,
    "PROMPT_FAILED_WITHOUT_PENDING",
  );
  assert.equal(
    classifyAttendedProgramRecovery({ promptLatch: latch("PROMPT_VERIFIED"), signedPending: null }).code,
    "PROMPT_VERIFIED_WITHOUT_PENDING",
  );
  assert.equal(
    classifyAttendedProgramRecovery({ promptLatch: null, signedPending: pending }).code,
    "PENDING_WITHOUT_PROMPT_LATCH",
  );
  assert.equal(
    classifyAttendedProgramRecovery({ promptLatch: latch("PROMPT_FAILED"), signedPending: pending }).code,
    "PENDING_WITH_FAILED_PROMPT_LATCH",
  );
  assert.equal(
    classifyAttendedProgramRecovery({
      promptLatch: latch("PROMPT_VERIFIED", { messageSha256: "d".repeat(64) }),
      signedPending: pending,
    }).code,
    "PENDING_PROMPT_IDENTITY_MISMATCH",
  );
  for (const status of ["PROMPT_ENTERED", "PROMPT_VERIFIED"]) {
    assert.equal(
      classifyAttendedProgramRecovery({ promptLatch: latch(status), signedPending: pending }).outcome,
      "RECOVERABLE",
    );
  }
});

test("missing pending states preserve exact HOLD copy without becoming authorization", () => {
  for (const status of ["PROMPT_ENTERED", "PROMPT_FAILED", "PROMPT_VERIFIED"]) {
    const classification = classifyAttendedProgramRecovery({
      promptLatch: latch(status),
      signedPending: null,
    });
    const error = attendedProgramRecoveryHold(classification);
    assert.equal(error.code, classification.code);
    assert.equal(attendedProgramHoldStatus(error), classification.holdStatus);
    assert.match(error.message, /do not retry/u);
    assert.doesNotMatch(error.message, /safe to retry|nothing was signed|nothing was sent/u);
  }
});

test("recovery classifier rejects unreviewed latch status and non-HOLD conversion", () => {
  assert.throws(
    () => classifyAttendedProgramRecovery({
      promptLatch: latch("PROMPT_RETRYABLE"),
      signedPending: null,
    }),
    /status is not reviewed/u,
  );
  assert.throws(
    () => attendedProgramRecoveryHold({ outcome: "RECOVERABLE" }),
    /classification is not a HOLD/u,
  );
  assert.equal(attendedProgramHoldStatus(new Error("ordinary")), null);
});

const sourceCommit = "a".repeat(40);
const programArtifactSha256 = "b".repeat(64);
const ceremonyMint = Keypair.fromSeed(Uint8Array.from({ length: 32 }, (_, index) => index + 1)).publicKey.toBase58();
const transactionSigner = Keypair.fromSeed(Uint8Array.from({ length: 32 }, (_, index) => 32 - index));
const programId = Keypair.fromSeed(Uint8Array.from({ length: 32 }, (_, index) => index + 33)).publicKey;
const programDataAddress = Keypair.fromSeed(Uint8Array.from({ length: 32 }, (_, index) => index + 65)).publicKey;
const blockhash = Keypair.fromSeed(Uint8Array.from({ length: 32 }, (_, index) => index + 129)).publicKey.toBase58();
const loaderProgramId = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const promptBinding = Object.freeze({ sourceCommit, programArtifactSha256, mint: ceremonyMint });
const pendingBinding = Object.freeze({ ...promptBinding, action: "EXTEND_PROGRAM_DATA" });

function signedProgramRecord() {
  const transaction = buildProgramDataExtensionTransaction({
    additionalBytes: 52_344,
    authority: transactionSigner.publicKey,
    blockhash,
    checked: true,
    feePayer: transactionSigner.publicKey,
    loaderProgramId,
    programDataAddress,
    programId,
  });
  transaction.sign(transactionSigner);
  const messageBytes = Buffer.from(transaction.serializeMessage());
  const actionBinding = JSON.stringify({
    action: "extend-program",
    programId: programId.toBase58(),
    programDataAddress: programDataAddress.toBase58(),
    programAdmin: transactionSigner.publicKey.toBase58(),
    buffer: null,
    bufferAuthority: null,
    bufferHash: null,
    deployedHash: null,
    deployedRegionHash: null,
    loaderZeroPaddingBytes: null,
    loaderZeroPaddingVerified: false,
    alreadyUpgraded: false,
    programDataDeploymentSlot: "480000000",
    programDataCapacityBytes: "597336",
    targetProgramDataCapacityBytes: "649680",
    additionalProgramDataBytes: "52344",
    targetProgramDataAccountBytes: "649725",
    currentProgramDataLamports: "4158607680",
    targetProgramDataRentLamports: "4522921920",
    rentTopUpLamports: "364314240",
    extendProgramChecked: true,
    extendProgramCheckedActivationSlot: "376646256",
    sourceCommit,
    programArtifactSha256,
    mint: ceremonyMint,
  });
  return Object.freeze({
    schema: IAT_V2_ATTENDED_PROGRAM_SIGNED_PENDING_SCHEMA,
    sourceCommit,
    programArtifactSha256,
    mint: ceremonyMint,
    action: "EXTEND_PROGRAM_DATA",
    messageSha256: createHash("sha256").update(messageBytes).digest("hex"),
    signer: transactionSigner.publicKey.toBase58(),
    actionBinding,
    finalizedContextSlot: 376_700_000,
    blockhash,
    lastValidBlockHeight: 364_000_000,
    messageBytesHex: messageBytes.toString("hex"),
    signedWireHex: Buffer.from(transaction.serialize()).toString("hex"),
    preUpgradeProgramDataCapacityBytes: 597_336,
  });
}

function lockManager() {
  let held = false;
  return {
    async request(name, options, callback) {
      if (held && options?.ifAvailable === true) return callback(null);
      held = true;
      try {
        return await callback({ name });
      } finally {
        held = false;
      }
    },
  };
}

function faultingCeremonyStorage({ pendingFailure = null, verifiedFailure = null } = {}) {
  const values = new Map();
  const calls = [];
  let latchWrites = 0;
  return {
    calls,
    values,
    getItem(key) {
      calls.push(["getItem", key]);
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      calls.push(["setItem", key, value]);
      const isLatch = key.startsWith("iat-v2-current-source-model-t-transaction-prompt/");
      const isPending = key.startsWith("iat-v2-current-source-program-signed-pending/");
      if (isLatch) latchWrites += 1;
      const failure = isPending ? pendingFailure : isLatch && latchWrites === 2 ? verifiedFailure : null;
      if (failure === "before") throw new Error("injected storage failure before write");
      if (failure !== "noop") values.set(key, value);
      if (failure === "after") throw new Error("injected storage failure after write");
    },
    removeItem(key) {
      calls.push(["removeItem", key]);
      values.delete(key);
    },
  };
}

function ceremonyCoordinator(storage) {
  const times = [
    "2026-09-06T10:00:00.000Z",
    "2026-09-06T10:01:00.000Z",
  ];
  return createAttendedModelTPromptCoordinator({
    locks: lockManager(),
    storage,
    tabId: "123e4567-e89b-42d3-a456-426614174000",
    now: () => times.shift(),
  });
}

function recoveryRequest(coordinator, record, prompt) {
  return coordinator.request({
    binding: promptBinding,
    action: "EXTEND_PROGRAM_DATA",
    messageSha256: record.messageSha256,
    signer: record.signer,
    prompt,
  });
}

test("durable signed pending survives every final latch promotion ambiguity without enabling a second prompt", async () => {
  for (const verifiedFailure of ["before", "after", "noop"]) {
    const storage = faultingCeremonyStorage({ verifiedFailure });
    const coordinator = ceremonyCoordinator(storage);
    const record = signedProgramRecord();
    let promptCalls = 0;
    const prompt = async () => {
      promptCalls += 1;
      persistAttendedProgramSignedPending(storage, record);
      return "signed";
    };

    await assert.rejects(
      recoveryRequest(coordinator, record, prompt),
      /Prompt latch storage is unavailable or non-durable/u,
    );

    const retainedPending = loadAttendedProgramSignedPending(storage, pendingBinding);
    const retainedLatch = loadAttendedModelTPromptLatch(storage, {
      binding: promptBinding,
      action: "EXTEND_PROGRAM_DATA",
    });
    assert.deepEqual(retainedPending, record);
    assert.equal(
      retainedLatch.status,
      verifiedFailure === "after" ? "PROMPT_VERIFIED" : "PROMPT_ENTERED",
    );
    assert.equal(
      classifyAttendedProgramRecovery({
        promptLatch: retainedLatch,
        signedPending: retainedPending,
      }).outcome,
      "RECOVERABLE",
    );
    await assert.rejects(
      recoveryRequest(coordinator, record, prompt),
      /already consumed its transaction-prompt latch/u,
    );
    assert.equal(promptCalls, 1);
    assert.equal(storage.calls.filter(([method]) => method === "removeItem").length, 0);
  }
});

test("pending persistence ambiguity retains a failed latch and never authorizes recovery or a second prompt", async () => {
  for (const pendingFailure of ["before", "after", "noop"]) {
    const storage = faultingCeremonyStorage({ pendingFailure });
    const coordinator = ceremonyCoordinator(storage);
    const record = signedProgramRecord();
    let promptCalls = 0;
    const prompt = async () => {
      promptCalls += 1;
      persistAttendedProgramSignedPending(storage, record);
      return "signed";
    };

    await assert.rejects(
      recoveryRequest(coordinator, record, prompt),
      /Signed pending storage is unavailable or non-durable/u,
    );
    const retainedPending = loadAttendedProgramSignedPending(storage, pendingBinding);
    const retainedLatch = loadAttendedModelTPromptLatch(storage, {
      binding: promptBinding,
      action: "EXTEND_PROGRAM_DATA",
    });
    assert.equal(retainedLatch.status, "PROMPT_FAILED");
    const classification = classifyAttendedProgramRecovery({
      promptLatch: retainedLatch,
      signedPending: retainedPending,
    });
    assert.equal(classification.outcome, "HOLD");
    assert.equal(
      classification.code,
      pendingFailure === "after"
        ? "PENDING_WITH_FAILED_PROMPT_LATCH"
        : "PROMPT_FAILED_WITHOUT_PENDING",
    );
    await assert.rejects(
      recoveryRequest(coordinator, record, prompt),
      /already consumed its transaction-prompt latch/u,
    );
    assert.equal(promptCalls, 1);
    assert.equal(storage.calls.filter(([method]) => method === "removeItem").length, 0);
  }
});
