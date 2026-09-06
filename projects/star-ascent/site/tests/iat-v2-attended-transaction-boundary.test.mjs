import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  Keypair,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";

import {
  assertExactTransactionMessage,
  assertFreshFinalizedBlockhash,
  assertFreshProgramPromptBlockhashWindow,
  IAT_V2_PROGRAM_MIN_PROMPT_REMAINING_BLOCKS,
  IAT_V2_PROGRAM_MAX_PROMPT_PREPARATION_MS,
  assertSignedLegacyTransaction,
  exactVersionedSimulation,
  observeSignedBlockhashWindow,
  simulateExactLegacyTransaction,
} from "../tools/iat-v2-admin-console/attended-transaction-boundary.mjs";

const BLOCKHASH = "11111111111111111111111111111111";

function promptWindow(overrides = {}) {
  return {
    blockhash: BLOCKHASH,
    connection: {
      async isBlockhashValid(_blockhash, config) {
        return { context: { slot: config.minContextSlot + 1 }, value: true };
      },
      async getBlockHeight() { return 900; },
    },
    lastValidBlockHeight: 1_000,
    minContextSlot: 500,
    isVisible: () => true,
    monotonicNow: () => 100,
    ...overrides,
  };
}

test("program prompt admits 100 or more blocks and rejects smaller or expired windows", async () => {
  assert.equal(IAT_V2_PROGRAM_MIN_PROMPT_REMAINING_BLOCKS, 100);
  assert.equal(IAT_V2_PROGRAM_MAX_PROMPT_PREPARATION_MS, 5_000);
  for (const remaining of [-1, 0, 3, 39, 40, 80, 99, 100, 101]) {
    const args = promptWindow();
    args.connection.getBlockHeight = async () => 1_000 - remaining;
    if (remaining < 100) {
      await assert.rejects(assertFreshProgramPromptBlockhashWindow(args), /at least 100 remaining blocks/u);
    } else {
      assert.equal((await assertFreshProgramPromptBlockhashWindow(args)).remainingBlocks, remaining);
    }
  }
});

test("program prompt fails closed on hidden pages, stale elapsed time, and invalid clocks", async () => {
  const initiallyHidden = promptWindow({ isVisible: () => false, connection: {
    async isBlockhashValid() { assert.fail("hidden page cannot begin observation"); },
  } });
  await assert.rejects(assertFreshProgramPromptBlockhashWindow(initiallyHidden), /visible attended page/u);
  let visibilityReads = 0;
  await assert.rejects(assertFreshProgramPromptBlockhashWindow(promptWindow({
    isVisible: () => ++visibilityReads === 1,
  })), /page is hidden/u);
  for (const times of [[100, 5_101], [100, 99], [Number.NaN, 100], [100, Infinity], [0, null], [0, "1"]]) {
    const readings = [...times];
    await assert.rejects(assertFreshProgramPromptBlockhashWindow(promptWindow({
      monotonicNow: () => readings.shift(),
    })), /preparation is stale/u);
  }
  const boundary = [100, 5_100];
  assert.equal((await assertFreshProgramPromptBlockhashWindow(promptWindow({
    monotonicNow: () => boundary.shift(),
  }))).remainingBlocks, 100);
  assert.equal((await assertFreshProgramPromptBlockhashWindow(promptWindow({
    preparationStartedAtMonotonicMs: 100,
    monotonicNow: () => 5_100,
  }))).remainingBlocks, 100);
  await assert.rejects(assertFreshProgramPromptBlockhashWindow(promptWindow({
    preparationStartedAtMonotonicMs: 100,
    monotonicNow: () => 5_101,
  })), /preparation is stale/u);
});

test("program prompt rejects invalid explicit preparation-start timestamps", async () => {
  for (const preparationStartedAtMonotonicMs of [
    -1, Number.NaN, Infinity, -Infinity, "100", false, {}, 101,
  ]) {
    await assert.rejects(assertFreshProgramPromptBlockhashWindow(promptWindow({
      preparationStartedAtMonotonicMs,
      monotonicNow: () => 100,
    })), /preparation is stale/u);
  }
});

test("program prompt rejects unknown validity, malformed heights, and stale context", async () => {
  for (const validity of [false, null, "true", 1, undefined]) {
    const args = promptWindow();
    args.connection.isBlockhashValid = async (_blockhash, config) => ({
      context: { slot: config.minContextSlot + 1 }, value: validity,
    });
    await assert.rejects(assertFreshProgramPromptBlockhashWindow(args), /at least 100 remaining blocks/u);
  }
  for (const height of [Number.NaN, 900.5, 0, -1, Number.MAX_SAFE_INTEGER + 1]) {
    const args = promptWindow();
    args.connection.getBlockHeight = async () => height;
    await assert.rejects(assertFreshProgramPromptBlockhashWindow(args), /invalid block height/u);
  }
  const stale = promptWindow();
  stale.connection.isBlockhashValid = async () => ({ context: { slot: 499 }, value: true });
  await assert.rejects(assertFreshProgramPromptBlockhashWindow(stale), /finalized context slot/u);
});
const signer = Keypair.fromSeed(Uint8Array.from({ length: 32 }, (_, index) => index + 1));
const destination = Keypair.fromSeed(Uint8Array.from({ length: 32 }, (_, index) => 255 - index));
const sha256Hex = async (value) => createHash("sha256").update(value).digest("hex");

function transaction() {
  return new Transaction({
    feePayer: signer.publicKey,
    recentBlockhash: BLOCKHASH,
  }).add(SystemProgram.transfer({
    fromPubkey: signer.publicKey,
    lamports: 1,
    toPubkey: destination.publicKey,
  }));
}

test("legacy attended simulation uses the exact versioned message and fail-closed RPC config", async () => {
  const reviewed = transaction();
  const expectedMessage = reviewed.serializeMessage();
  let request = null;
  const result = await simulateExactLegacyTransaction({
    connection: {
      async simulateTransaction(simulationTransaction, config) {
        request = { simulationTransaction, config };
        return { context: { slot: 101 }, value: { err: null, logs: ["ok"] } };
      },
    },
    minContextSlot: 100,
    sha256Hex,
    transaction: reviewed,
  });

  assert.ok(request.simulationTransaction instanceof VersionedTransaction);
  assert.deepEqual(request.config, {
    commitment: "finalized",
    minContextSlot: 100,
    replaceRecentBlockhash: false,
    sigVerify: false,
  });
  assert.ok(Buffer.from(request.simulationTransaction.message.serialize()).equals(expectedMessage));
  assert.ok(Buffer.from(result.messageBytes).equals(expectedMessage));
  assert.equal(result.messageSha256, await sha256Hex(expectedMessage));
  assert.equal(result.simulationSlot, 101);
  assert.ok(Buffer.from(reviewed.serializeMessage()).equals(expectedMessage));
});

test("exact simulation rejects a stale context or any simulation-side message mutation", async () => {
  await assert.rejects(
    simulateExactLegacyTransaction({
      connection: {
        async simulateTransaction() {
          return { context: { slot: 99 }, value: { err: null, logs: [] } };
        },
      },
      minContextSlot: 100,
      sha256Hex,
      transaction: transaction(),
    }),
    /monotonic finalized context slot/u,
  );

  await assert.rejects(
    simulateExactLegacyTransaction({
      connection: {
        async simulateTransaction(simulationTransaction) {
          simulationTransaction.message.recentBlockhash = destination.publicKey.toBase58();
          return { context: { slot: 100 }, value: { err: null, logs: [] } };
        },
      },
      minContextSlot: 100,
      sha256Hex,
      transaction: transaction(),
    }),
    /Simulation changed the exact hardware-reviewed transaction message/u,
  );

  await assert.rejects(
    simulateExactLegacyTransaction({
      connection: { async simulateTransaction() { throw new Error("must not run"); } },
      minContextSlot: 0,
      sha256Hex,
      transaction: transaction(),
    }),
    /positive finalized minContextSlot/u,
  );
});

test("signed-boundary verification requires exact bytes, signer, signature, and blockhash", async () => {
  const signed = transaction();
  const expectedMessageBytes = Buffer.from(signed.serializeMessage());
  const expectedMessageSha256 = await sha256Hex(expectedMessageBytes);
  signed.sign(signer);
  await assertSignedLegacyTransaction({
    expectedBlockhash: BLOCKHASH,
    expectedMessageBytes,
    expectedMessageSha256,
    expectedSigner: signer.publicKey,
    sha256Hex,
    signed,
  });

  const unsigned = transaction();
  await assert.rejects(
    assertSignedLegacyTransaction({
      expectedBlockhash: BLOCKHASH,
      expectedMessageBytes,
      expectedMessageSha256,
      expectedSigner: signer.publicKey,
      sha256Hex,
      signed: unsigned,
    }),
    /hardware signature is missing/u,
  );

  const changed = transaction();
  changed.recentBlockhash = destination.publicKey.toBase58();
  assert.throws(
    () => assertExactTransactionMessage(changed, expectedMessageBytes, "Rebuilt action"),
    /no longer matches the exact reviewed transaction message/u,
  );
});

test("pre-send blockhash verification is finalized, monotonic, and fail-closed", async () => {
  let requested = null;
  const contextSlot = await assertFreshFinalizedBlockhash({
    blockhash: BLOCKHASH,
    connection: {
      async isBlockhashValid(blockhash, config) {
        requested = { blockhash, config };
        return { context: { slot: 401 }, value: true };
      },
    },
    minContextSlot: 400,
  });
  assert.equal(contextSlot, 401);
  assert.deepEqual(requested, {
    blockhash: BLOCKHASH,
    config: { commitment: "finalized", minContextSlot: 400 },
  });

  await assert.rejects(
    assertFreshFinalizedBlockhash({
      blockhash: BLOCKHASH,
      connection: {
        async isBlockhashValid() {
          return { context: { slot: 401 }, value: false };
        },
      },
      minContextSlot: 400,
    }),
    /blockhash is no longer valid/u,
  );
});

test("versioned promotion itself preserves the exact legacy message", () => {
  const reviewed = transaction();
  const before = reviewed.serializeMessage();
  const promoted = exactVersionedSimulation(reviewed);
  assert.ok(Buffer.from(promoted.messageBytes).equals(before));
  assert.ok(Buffer.from(promoted.simulationTransaction.message.serialize()).equals(before));
});

test("signed blockhash window observes both commitments and an exact remaining-block countdown", async () => {
  const requests = [];
  const result = await observeSignedBlockhashWindow({
    blockhash: BLOCKHASH,
    connection: {
      async isBlockhashValid(blockhash, config) {
        requests.push(["isBlockhashValid", blockhash, config]);
        return {
          context: { slot: config.commitment === "finalized" ? 501 : 507 },
          value: true,
        };
      },
      async getBlockHeight(config) {
        requests.push(["getBlockHeight", config]);
        return 900;
      },
    },
    lastValidBlockHeight: 1_000,
    minContextSlot: 500,
  });

  assert.deepEqual(result, {
    status: "VALID",
    finalizedContextSlot: 501,
    processedContextSlot: 507,
    observedBlockHeight: 900,
    remainingBlocks: 100,
    lastValidBlockHeight: 1_000,
  });
  assert.deepEqual(requests, [
    ["isBlockhashValid", BLOCKHASH, { commitment: "finalized", minContextSlot: 500 }],
    ["isBlockhashValid", BLOCKHASH, { commitment: "processed", minContextSlot: 501 }],
    ["getBlockHeight", { commitment: "processed", minContextSlot: 507 }],
  ]);
});

test("signed blockhash window is expired if either commitment rejects it or height passed", async () => {
  for (const [finalizedValid, processedValid, height] of [
    [false, true, 900],
    [true, false, 900],
    [true, true, 1_001],
  ]) {
    let call = 0;
    const result = await observeSignedBlockhashWindow({
      blockhash: BLOCKHASH,
      connection: {
        async isBlockhashValid() {
          call += 1;
          return { context: { slot: 600 + call }, value: call === 1 ? finalizedValid : processedValid };
        },
        async getBlockHeight() { return height; },
      },
      lastValidBlockHeight: 1_000,
      minContextSlot: 600,
    });
    assert.equal(result.status, "EXPIRED");
  }
});

test("signed blockhash window rejects malformed, stale, and indeterminate observations", async () => {
  await assert.rejects(
    observeSignedBlockhashWindow({
      blockhash: BLOCKHASH,
      connection: {
        async isBlockhashValid(_blockhash, config) {
          return { context: { slot: config.commitment === "finalized" ? 700 : 699 }, value: true };
        },
        async getBlockHeight() { throw new Error("must not read height"); },
      },
      lastValidBlockHeight: 1_000,
      minContextSlot: 700,
    }),
    /monotonic finalized context slot/u,
  );
  await assert.rejects(
    observeSignedBlockhashWindow({
      blockhash: BLOCKHASH,
      connection: {
        async isBlockhashValid(_blockhash, config) {
          return { context: { slot: config.commitment === "finalized" ? 701 : 702 }, value: true };
        },
        async getBlockHeight() { return Number.NaN; },
      },
      lastValidBlockHeight: 1_000,
      minContextSlot: 700,
    }),
    /invalid block height/u,
  );
  await assert.rejects(
    observeSignedBlockhashWindow({
      blockhash: "",
      connection: {},
      lastValidBlockHeight: 1_000,
      minContextSlot: 700,
    }),
    /exact blockhash/u,
  );
});
