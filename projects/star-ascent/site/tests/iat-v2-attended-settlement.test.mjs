import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import {
  IAT_V2_WEEK9_STANDARD_ACCOUNT_METAS,
  IAT_V2_WEEK9_STANDARD_PRE_STATE,
  IAT_V2_WEEK9_STANDARD_SETTLEMENT,
  assertIatV2Week9BroadcastReady,
  buildExactIatV2Week9SimulationRpcRequest,
  finalizeIatV2Week9StandardSettlement,
  prepareIatV2Week9StandardSettlement,
} from "../programs/iat_v2/attended-settlement.mjs";

const BLOCKHASH = "3QhxKd9wK6xG7VikCjUUibTTrSzFzJa1PKtMsfWetSzm";
const REPLAY_BLOCKHASH = "11111111111111111111111111111111";
const PROGRAM_SUCCESS = `Program ${IAT_V2_WEEK9_STANDARD_SETTLEMENT.programId} success`;
const SIGNATURE = "4K5wuDRmAQCM3Vchmvjv998hrqjZv3k3aPKCmCz5P9GkAWfP4hbf9S1B11S1YusTfgoHYgTwLc4KMtePx3jzjcdr";

function sha256Hex(value) {
  return Promise.resolve(crypto.createHash("sha256").update(value).digest("hex"));
}

function mutable(value) {
  if (Array.isArray(value)) return value.map(mutable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mutable(item)]));
  }
  return value;
}

function instruction() {
  return {
    programId: IAT_V2_WEEK9_STANDARD_SETTLEMENT.programId,
    data: Buffer.from(IAT_V2_WEEK9_STANDARD_SETTLEMENT.instructionDataHex, "hex"),
    keys: IAT_V2_WEEK9_STANDARD_ACCOUNT_METAS.map((meta) => ({
      pubkey: meta.address,
      isSigner: meta.signer,
      isWritable: meta.writable,
    })),
  };
}

function transaction({
  message = Buffer.from("reviewed exact week-9 legacy message"),
  recentBlockhash = BLOCKHASH,
  signed = false,
} = {}) {
  const signature = signed ? Buffer.alloc(64, 0xa5) : null;
  return {
    feePayer: IAT_V2_WEEK9_STANDARD_SETTLEMENT.requiredSigner,
    recentBlockhash,
    instructions: [instruction()],
    serializeMessage: () => Buffer.from(message),
    serialize: () => Buffer.concat([
      Buffer.from([1]),
      signature ?? Buffer.alloc(64),
      Buffer.from(message),
    ]),
    signatures: [{
      publicKey: IAT_V2_WEEK9_STANDARD_SETTLEMENT.requiredSigner,
      signature,
    }],
    verifySignatures: () => Boolean(signature),
  };
}

function programDeployment() {
  return {
    commitment: "finalized",
    programId: IAT_V2_WEEK9_STANDARD_SETTLEMENT.programId,
    programData: IAT_V2_WEEK9_STANDARD_SETTLEMENT.programData,
    upgradeAuthority: IAT_V2_WEEK9_STANDARD_SETTLEMENT.requiredSigner,
    executable: true,
    artifactSha256: IAT_V2_WEEK9_STANDARD_SETTLEMENT.programArtifactSha256,
    artifactBytes: IAT_V2_WEEK9_STANDARD_SETTLEMENT.programArtifactBytes,
    deploymentSlot: IAT_V2_WEEK9_STANDARD_SETTLEMENT.programDeploymentSlot,
  };
}

function preState(contextSlot = 100) {
  return {
    commitment: "finalized",
    contextSlot,
    currentWeek: 9n,
    ...mutable(IAT_V2_WEEK9_STANDARD_PRE_STATE),
  };
}

function expectedPost(contextSlot = 101, commitment = "finalized") {
  const value = preState(contextSlot);
  value.commitment = commitment;
  value.position.treasuryReserved = 961_538_462n;
  value.position.paid = 38_461_538n;
  value.position.settledMask = 3n;
  value.lanes.treasury.reserved = 39_380_769_233n;
  value.lanes.treasury.paid = 419_230_767n;
  value.tokenBalances.destination = 470_092_307_691n;
  value.tokenBalances.treasury = 199_580_769_233n;
  value.signerLamports = 4_201_193_718n;
  delete value.currentWeek;
  return value;
}

async function simulation(contextSlot = 101, sigVerify = false, tx = transaction()) {
  const message = tx.serializeMessage();
  return {
    contextSlot,
    err: null,
    replaceRecentBlockhash: false,
    sigVerify,
    messageSha256: await sha256Hex(message),
    recentBlockhash: tx.recentBlockhash,
    unitsConsumed: 29_996,
    logs: ["Program log: Instruction: SettlePositionWeek", PROGRAM_SUCCESS],
    postState: expectedPost(contextSlot, "simulation"),
  };
}

async function preparationOptions() {
  const tx = transaction();
  return {
    transaction: tx,
    sha256Hex,
    programDeployment: programDeployment(),
    preState: preState(),
    blockhash: {
      blockhash: BLOCKHASH,
      contextSlot: 100,
      lastValidBlockHeight: 1_000,
    },
    feeLamports: 5_000n,
    simulation: await simulation(101, false, tx),
  };
}

async function readyReview() {
  const prepared = await prepareIatV2Week9StandardSettlement(await preparationOptions());
  const signed = transaction({ signed: true });
  return assertIatV2Week9BroadcastReady({
    review: prepared,
    signedTransaction: signed,
    sha256Hex,
    latestBlockHeight: 999,
    revalidatedPreState: preState(102),
    simulation: await simulation(103, true, signed),
  });
}

test("week-9 preparation binds the exact 634d transaction, full message, fee, state, simulation, and deltas", async () => {
  const review = await prepareIatV2Week9StandardSettlement(await preparationOptions());
  assert.equal(review.status, "SIMULATED_NOT_SIGNED_NOT_BROADCAST");
  assert.equal(review.identity.requiredSigner, "7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH");
  assert.equal(review.identity.programArtifactSha256, "634d95055b891e6b624a3f6996d10b66e2a7f4bbb1ab50711d6195f72c7772a7");
  assert.equal(review.messageHex, Buffer.from("reviewed exact week-9 legacy message").toString("hex"));
  assert.match(review.messageSha256, /^[0-9a-f]{64}$/u);
  assert.equal(review.feeLamports, 5_000n);
  assert.equal(review.expectedPost.reward, 19_230_769n);
  assert.deepEqual(review.expectedPost.lanePayments, {
    treasury: 19_230_769n,
    ecosystem: 0n,
    liquidity: 0n,
  });
  assert.equal(review.expectedPost.position.paid, 38_461_538n);
  assert.equal(review.expectedPost.position.settledMask, 3n);
  assert.equal(review.expectedPost.tokenBalances.destination, 470_092_307_691n);
});

test("raw simulation request preserves exact legacy bytes and forbids RPC blockhash replacement", async () => {
  const tx = transaction();
  const before = tx.serializeMessage().toString("hex");
  const request = await buildExactIatV2Week9SimulationRpcRequest({
    transaction: tx,
    sha256Hex,
    sigVerify: false,
    minContextSlot: 100,
  });
  assert.deepEqual(Object.keys(request.rpcRequest), ["jsonrpc", "id", "method", "params"]);
  assert.equal(request.rpcRequest.jsonrpc, "2.0");
  assert.equal(request.rpcRequest.id, "iat-v2-week9-attended-settlement-simulation");
  assert.equal(request.rpcRequest.method, "simulateTransaction");
  assert.equal(request.rpcRequest.params[1].commitment, "finalized");
  assert.equal(request.rpcRequest.params[1].sigVerify, false);
  assert.equal(request.rpcRequest.params[1].replaceRecentBlockhash, false);
  assert.equal(request.rpcRequest.params[1].minContextSlot, 100);
  assert.equal(tx.serializeMessage().toString("hex"), before);
  assert.equal(request.recentBlockhash, BLOCKHASH);
  assert.equal(Buffer.from(request.rpcRequest.params[0], "base64").toString("hex"), tx.serialize().toString("hex"));
  assert.equal(request.rpcRequest.params[1].accounts.addresses.length, 10);

  const signed = transaction({ signed: true });
  const signedRequest = await buildExactIatV2Week9SimulationRpcRequest({
    transaction: signed,
    sha256Hex,
    sigVerify: true,
    minContextSlot: 101,
  });
  assert.equal(signedRequest.rpcRequest.params[1].sigVerify, true);

  const mutating = transaction();
  mutating.serialize = () => {
    mutating.recentBlockhash = REPLAY_BLOCKHASH;
    return Buffer.from("mutated");
  };
  await assert.rejects(
    buildExactIatV2Week9SimulationRpcRequest({
      transaction: mutating,
      sha256Hex,
      sigVerify: false,
      minContextSlot: 100,
    }),
    /(?:after wire serialization|serialized legacy transaction must encode exactly one signature canonically)/u,
  );
});

test("raw simulation rejects unrelated or noncanonical serialized wire bytes", async () => {
  const unrelated = transaction();
  unrelated.serialize = () => Buffer.concat([Buffer.from([1]), Buffer.alloc(64), Buffer.from("other")]);
  await assert.rejects(
    buildExactIatV2Week9SimulationRpcRequest({
      transaction: unrelated,
      sha256Hex,
      sigVerify: false,
      minContextSlot: 100,
    }),
    /wire (?:length does not bind|contains different message bytes)/u,
  );

  const noncanonical = transaction();
  noncanonical.serialize = () => Buffer.concat([Buffer.from([0x81, 0x00]), Buffer.alloc(64), noncanonical.serializeMessage()]);
  await assert.rejects(
    buildExactIatV2Week9SimulationRpcRequest({
      transaction: noncanonical,
      sha256Hex,
      sigVerify: false,
      minContextSlot: 100,
    }),
    /exactly one signature canonically/u,
  );
});

test("preparation rejects identity, instruction, state, fee, message, and simulation drift", async (t) => {
  const hostileCases = [
    ["wrong artifact", (value) => { value.programDeployment.artifactSha256 = "0".repeat(64); }],
    ["wrong signer", (value) => { value.transaction.feePayer = "Vote111111111111111111111111111111111111111"; }],
    ["extra instruction", (value) => { value.transaction.instructions.push(instruction()); }],
    ["wrong instruction data", (value) => { value.transaction.instructions[0].data[8] = 8; }],
    ["swapped accounts", (value) => {
      [value.transaction.instructions[0].keys[1], value.transaction.instructions[0].keys[2]] = [
        value.transaction.instructions[0].keys[2], value.transaction.instructions[0].keys[1],
      ];
    }],
    ["writable signer", (value) => { value.transaction.instructions[0].keys[0].isWritable = true; }],
    ["wrong pre-state mask", (value) => { value.preState.position.settledMask = 3n; }],
    ["wrong lane reservation", (value) => { value.preState.lanes.treasury.reserved -= 1n; }],
    ["wrong destination balance", (value) => { value.preState.tokenBalances.destination += 1n; }],
    ["wrong fee", (value) => { value.feeLamports = 5_001n; }],
    ["failed simulation", (value) => { value.simulation.err = { InstructionError: [0, "InvalidArgument"] }; }],
    ["wrong simulated delta", (value) => { value.simulation.postState.position.paid -= 1n; }],
    ["missing success log", (value) => { value.simulation.logs = ["Program log: Instruction: SettlePositionWeek"]; }],
  ];
  for (const [name, mutate] of hostileCases) {
    await t.test(name, async () => {
      const value = await preparationOptions();
      mutate(value);
      await assert.rejects(
        prepareIatV2Week9StandardSettlement(value),
        /Week-9 attended settlement HOLD/u,
      );
    });
  }
});

test("broadcast readiness permits one send only after same-message hardware verification and immediate revalidation", async () => {
  const review = await readyReview();
  assert.equal(review.status, "SIGNED_SIMULATED_READY_FOR_ONE_BROADCAST");
  assert.equal(review.broadcastCountAllowed, 1);
  assert.equal(review.revalidationSlot, 102);
  assert.equal(review.preBroadcastSimulationSlot, 103);
});

test("broadcast readiness rejects message mutation, missing hardware verification, expiry, state drift, and failed re-simulation", async (t) => {
  const prepared = await prepareIatV2Week9StandardSettlement(await preparationOptions());
  const base = async () => {
    const signed = transaction({ signed: true });
    return {
      review: prepared,
      signedTransaction: signed,
      sha256Hex,
      latestBlockHeight: 999,
      revalidatedPreState: preState(102),
      simulation: await simulation(103, true, signed),
    };
  };
  const cases = [
    ["message mutation", (value) => { value.signedTransaction = transaction({ message: Buffer.from("mutated"), signed: true }); }],
    ["unverified signature", (value) => { value.signedTransaction.verifySignatures = () => false; }],
    ["missing signature bytes", (value) => { value.signedTransaction.signatures[0].signature = null; }],
    ["expired blockhash", (value) => { value.latestBlockHeight = 1_001; }],
    ["state drift", (value) => { value.revalidatedPreState.signerLamports -= 5_000n; }],
    ["simulation failure", (value) => { value.simulation.err = { InstructionError: [0, "InvalidArgument"] }; }],
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, async () => {
      const value = await base();
      mutate(value);
      await assert.rejects(assertIatV2Week9BroadcastReady(value), /Week-9 attended settlement HOLD/u);
    });
  }
});

test("finalization requires exact finalized deltas and a fresh PositionWeekAlreadySettled replay rejection", async () => {
  const review = await readyReview();
  const signed = transaction({ signed: true });
  const replay = transaction({ recentBlockhash: REPLAY_BLOCKHASH });
  const result = await finalizeIatV2Week9StandardSettlement({
    review,
    signedTransaction: signed,
    finalizedTransaction: transaction({ signed: true }),
    sha256Hex,
    signature: SIGNATURE,
    transactionResult: {
      commitment: "finalized",
      slot: 104,
      err: null,
      feeLamports: 5_000n,
      signature: SIGNATURE,
    },
    localBroadcastReceipts: [{ method: "sendRawTransaction", signature: SIGNATURE }],
    postState: expectedPost(105),
    replayTransaction: replay,
    replaySimulation: {
      contextSlot: 106,
      err: { InstructionError: [0, { Custom: 6_040 }] },
      messageSha256: await sha256Hex(replay.serializeMessage()),
      recentBlockhash: REPLAY_BLOCKHASH,
      replaceRecentBlockhash: false,
      sigVerify: false,
      logs: ["Program log: AnchorError. Error Code: PositionWeekAlreadySettled."],
      postState: expectedPost(106, "simulation"),
    },
  });
  assert.equal(result.status, "FINALIZED_AND_REPLAY_REJECTED");
  assert.equal(result.expectedRewardBaseUnits, 19_230_769n);
  assert.equal(result.resultingSettledMask, 3n);
  assert.equal(result.replayCustomError, 6_040);
  assert.equal(result.localBroadcastReceiptCount, 1);
});

test("finalization fails closed on non-finality, wrong deltas, wrong chain message, or absent replay rejection", async (t) => {
  const review = await readyReview();
  const base = async () => {
    const replay = transaction({ recentBlockhash: REPLAY_BLOCKHASH });
    return {
    review,
    signedTransaction: transaction({ signed: true }),
    finalizedTransaction: transaction({ signed: true }),
    sha256Hex,
    signature: SIGNATURE,
    transactionResult: {
      commitment: "finalized",
      slot: 104,
      err: null,
      feeLamports: 5_000n,
      signature: SIGNATURE,
    },
    localBroadcastReceipts: [{ method: "sendRawTransaction", signature: SIGNATURE }],
    postState: expectedPost(105),
    replayTransaction: replay,
    replaySimulation: {
      contextSlot: 106,
      err: { InstructionError: [0, { Custom: 6_040 }] },
      messageSha256: await sha256Hex(replay.serializeMessage()),
      recentBlockhash: REPLAY_BLOCKHASH,
      replaceRecentBlockhash: false,
      sigVerify: false,
      logs: ["Error Code: PositionWeekAlreadySettled"],
      postState: expectedPost(106, "simulation"),
    },
  };
  };
  const cases = [
    ["confirmed only", (value) => { value.transactionResult.commitment = "confirmed"; }],
    ["wrong finalized message", (value) => { value.finalizedTransaction = transaction({ message: Buffer.from("wrong"), signed: true }); }],
    ["wrong finalized embedded signature", (value) => { value.finalizedTransaction.signatures[0].signature[0] ^= 0xff; }],
    ["wrong returned signature", (value) => { value.transactionResult.signature = `${SIGNATURE.slice(0, -1)}1`; }],
    ["second local broadcast receipt", (value) => { value.localBroadcastReceipts.push({ method: "sendRawTransaction", signature: SIGNATURE }); }],
    ["wrong post-state delta", (value) => { value.postState.position.settledMask = 1n; }],
    ["wrong replay error", (value) => { value.replaySimulation.err.InstructionError[1].Custom = 6_041; }],
    ["missing replay log", (value) => { value.replaySimulation.logs = []; }],
    ["replay altered state", (value) => { value.replaySimulation.postState.tokenBalances.destination += 1n; }],
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, async () => {
      const value = await base();
      mutate(value);
      await assert.rejects(finalizeIatV2Week9StandardSettlement(value), /Week-9 attended settlement HOLD/u);
    });
  }
});
