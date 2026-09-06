import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { Buffer } from "buffer";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

import {
  IAT_V2_WEEK9_STANDARD_ACCOUNT_METAS,
  IAT_V2_WEEK9_STANDARD_SETTLEMENT,
  buildExactIatV2Week9SimulationRpcRequest,
} from "../programs/iat_v2/attended-settlement.mjs";
import {
  IAT_V2_WEEK9_OBSERVATION_ACCOUNTS,
  awaitFinalizedIatV2Week9Transaction,
  buildIatV2Week9StandardTransaction,
  canonicalizeIatV2Week9SignedTransaction,
  postPinnedDevnetRpcEnvelope,
  sanitizedIatV2Week9Evidence,
  sendRawIatV2Week9TransactionOnce,
  signatureBase58FromSignedIatV2Week9Transaction,
} from "../tools/iat-v2-admin-console/attended-settlement-browser.mjs";

const MAIN = new URL("../tools/iat-v2-admin-console/main.jsx", import.meta.url);
const COMPONENT = new URL("../tools/iat-v2-admin-console/AttendedWeek9Settlement.jsx", import.meta.url);
const ADAPTER = new URL("../tools/iat-v2-admin-console/attended-settlement-browser.mjs", import.meta.url);
const TREZOR_PROVIDER = new URL("../tools/iat-v2-admin-console/trezor-provider.mjs", import.meta.url);
const PACKAGE = new URL("../package.json", import.meta.url);
const BLOCKHASH = "3QhxKd9wK6xG7VikCjUUibTTrSzFzJa1PKtMsfWetSzm";
const SIGNATURE = "3uoSVvDecrmjwg3XT7xpoVfLSKMAbTnJZfnrRZvqXzfb6wtdo1unyzpFXAv4Kj3nRHAnHahTwfD1AvgWX3vF7st9";

function source(url) {
  return fs.readFileSync(url, "utf8");
}

async function sha256Hex(value) {
  const crypto = await import("node:crypto");
  return crypto.createHash("sha256").update(value).digest("hex");
}

function rpcResponse(envelope, result) {
  return {
    ok: true,
    status: 200,
    async json() {
      return { jsonrpc: "2.0", id: envelope.id, result };
    },
  };
}

test("settle-week9 is an isolated lazy route before App and preserves every existing console mode", () => {
  const main = source(MAIN);
  assert.match(main, /CONSOLE_PARAMS\.get\("mode"\) === "settle-week9"/u);
  assert.match(main, /lazy\(\(\) => import\("\.\/AttendedWeek9Settlement\.jsx"\)\)/u);
  assert.match(
    main,
    /ATTENDED_WEEK9_MODE[\s\S]*<AttendedWeek9Settlement[\s\S]*: <App getHardwareProvider=\{getHardwareProvider\} \/>/u,
  );
  assert.match(main, /INSPECTION_MODE[\s\S]*UPGRADE_MODE[\s\S]*ATTENDED_WEEK9_MODE[\s\S]*FEATURE_MODE/u);
});

test("attended sources contain no legacy simulation call, CCC round path, upgrade artifact, or automatic side effect", () => {
  const component = source(COMPONENT);
  const adapter = source(ADAPTER);
  const combined = `${component}\n${adapter}`;
  assert.doesNotMatch(combined, /connection\.simulateTransaction|\.simulateTransaction\(/u);
  assert.doesNotMatch(combined, /deriveRoundAddress|buildCommitRound|buildSettleRound|buildExpireRound/u);
  assert.doesNotMatch(combined, /d437be9a|CURRENT_REVIEWED_PROGRAM_ARTIFACT|mainnet/iu);
  assert.doesNotMatch(component, /useEffect\s*\(/u);
  assert.equal((component.match(/provider\.signTransaction\(/gu) ?? []).length, 1);
  assert.match(adapter, /round: null/u);
  assert.match(component, /REQUEST ONE TREZOR SIGNATURE/u);
  assert.match(component, /BROADCAST EXACT SIGNED DEVNET WIRE ONCE/u);
});

test("exact transaction has one unsigned legacy instruction and all 14 pinned metas", () => {
  const transaction = buildIatV2Week9StandardTransaction(BLOCKHASH);
  assert.equal(transaction.feePayer.toBase58(), IAT_V2_WEEK9_STANDARD_SETTLEMENT.requiredSigner);
  assert.equal(transaction.recentBlockhash, BLOCKHASH);
  assert.equal(transaction.instructions.length, 1);
  const wire = transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
  assert.equal(transaction.signatures.length, 1);
  assert.equal(transaction.signatures[0].signature, null);
  const [instruction] = transaction.instructions;
  assert.equal(instruction.programId.toBase58(), IAT_V2_WEEK9_STANDARD_SETTLEMENT.programId);
  assert.equal(Buffer.from(instruction.data).toString("hex"), IAT_V2_WEEK9_STANDARD_SETTLEMENT.instructionDataHex);
  assert.deepEqual(instruction.keys.map((meta) => ({
    address: meta.pubkey.toBase58(),
    signer: meta.isSigner,
    writable: meta.isWritable,
  })), IAT_V2_WEEK9_STANDARD_ACCOUNT_METAS);
  assert.ok(wire.length <= 1_232);
});

test("web3 legacy rehydration promotes only the instruction fee-payer view while preserving exact message and wire", async () => {
  assert.match(source(TREZOR_PROVIDER), /Transaction\.from\(Buffer\.from\(result\.payload\.serializedTx, "hex"\)\)/u);
  const reviewed = buildIatV2Week9StandardTransaction(BLOCKHASH);
  const reviewedMessage = Buffer.from(reviewed.serializeMessage());
  const unsignedWire = Buffer.from(reviewed.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  }));
  const rehydrated = Transaction.from(unsignedWire);
  assert.equal(reviewed.instructions[0].keys[0].isWritable, false);
  assert.equal(rehydrated.instructions[0].keys[0].isWritable, true);
  assert.deepEqual(
    rehydrated.instructions[0].keys.slice(1).map(({ isSigner, isWritable, pubkey }) => ({
      address: pubkey.toBase58(),
      signer: isSigner,
      writable: isWritable,
    })),
    IAT_V2_WEEK9_STANDARD_ACCOUNT_METAS.slice(1),
  );
  assert.ok(Buffer.from(rehydrated.serializeMessage()).equals(reviewedMessage));
  assert.ok(Buffer.from(rehydrated.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  })).equals(unsignedWire));
  await assert.rejects(
    buildExactIatV2Week9SimulationRpcRequest({
      transaction: rehydrated,
      sha256Hex,
      sigVerify: false,
      minContextSlot: 100,
    }),
    /instruction account 0 writable flag changed/u,
  );
});

function fakeTrezorRehydratedTransaction(reviewed) {
  const wire = Buffer.from(reviewed.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  }));
  assert.equal(wire[0], 1);
  for (let index = 0; index < 64; index += 1) wire[index + 1] = index + 1;
  return { returned: Transaction.from(wire), wire };
}

test("localized canonicalization transplants only the bound signature and restores the exact reviewed metas", async () => {
  const reviewed = buildIatV2Week9StandardTransaction(BLOCKHASH);
  const message = Buffer.from(reviewed.serializeMessage());
  const expectedMessageHex = message.toString("hex");
  const expectedMessageSha256 = await sha256Hex(message);
  const { returned, wire } = fakeTrezorRehydratedTransaction(reviewed);
  assert.equal(returned.instructions[0].keys[0].isWritable, true);

  // The pinned 7XZ private key is intentionally unavailable to tests. Patch only
  // web3's cryptographic predicate while exercising its real message/wire codec.
  const originalSignednessCheck = Transaction.prototype._getMessageSignednessErrors;
  Transaction.prototype._getMessageSignednessErrors = () => undefined;
  try {
    const canonical = await canonicalizeIatV2Week9SignedTransaction({
      reviewedUnsignedTransaction: reviewed,
      returnedSignedTransaction: returned,
      expectedMessageSha256,
      expectedMessageHex,
      expectedSignedWire: wire,
      sha256Hex,
    });
    assert.equal(canonical.verifySignatures(), true);
    assert.equal(canonical.instructions[0].keys[0].isWritable, false);
    assert.deepEqual(canonical.instructions[0].keys.map((meta) => ({
      address: meta.pubkey.toBase58(),
      signer: meta.isSigner,
      writable: meta.isWritable,
    })), IAT_V2_WEEK9_STANDARD_ACCOUNT_METAS);
    assert.ok(Buffer.from(canonical.serializeMessage()).equals(message));
    assert.ok(Buffer.from(canonical.serialize({
      requireAllSignatures: true,
      verifySignatures: true,
    })).equals(wire));
    assert.ok(Buffer.from(canonical.signatures[0].signature).equals(Buffer.from(returned.signatures[0].signature)));
  } finally {
    Transaction.prototype._getMessageSignednessErrors = originalSignednessCheck;
  }
});

test("localized canonicalization rejects every high-level drift except fee-payer readonly-to-writable rehydration", async (t) => {
  const mutations = [
    ["other writable flag", (transaction) => { transaction.instructions[0].keys[1].isWritable = true; }],
    ["fee-payer signer flag", (transaction) => { transaction.instructions[0].keys[0].isSigner = false; }],
    ["account order", (transaction) => {
      [transaction.instructions[0].keys[1], transaction.instructions[0].keys[2]] = [
        transaction.instructions[0].keys[2],
        transaction.instructions[0].keys[1],
      ];
    }],
    ["instruction data", (transaction) => { transaction.instructions[0].data[0] ^= 0xff; }],
    ["instruction program", (transaction) => { transaction.instructions[0].programId = SystemProgram.programId; }],
    ["extra instruction", (transaction) => { transaction.instructions.push(transaction.instructions[0]); }],
  ];
  for (const [label, mutate] of mutations) {
    await t.test(label, async () => {
      const reviewed = buildIatV2Week9StandardTransaction(BLOCKHASH);
      const message = Buffer.from(reviewed.serializeMessage());
      const { returned } = fakeTrezorRehydratedTransaction(reviewed);
      mutate(returned);
      await assert.rejects(
        canonicalizeIatV2Week9SignedTransaction({
          reviewedUnsignedTransaction: reviewed,
          returnedSignedTransaction: returned,
          expectedMessageSha256: await sha256Hex(message),
          expectedMessageHex: message.toString("hex"),
          sha256Hex,
        }),
        /returned signed transaction/u,
      );
    });
  }
});

test("localized canonicalization rejects hostile signatures, wire mismatch, and reviewed-input mutation", async (t) => {
  await t.test("cryptographically invalid signature", async () => {
    const reviewed = buildIatV2Week9StandardTransaction(BLOCKHASH);
    const message = Buffer.from(reviewed.serializeMessage());
    const { returned } = fakeTrezorRehydratedTransaction(reviewed);
    await assert.rejects(
      canonicalizeIatV2Week9SignedTransaction({
        reviewedUnsignedTransaction: reviewed,
        returnedSignedTransaction: returned,
        expectedMessageSha256: await sha256Hex(message),
        expectedMessageHex: message.toString("hex"),
        sha256Hex,
      }),
      /one valid local signature/u,
    );
  });

  await t.test("unexpected signed wire", async () => {
    const reviewed = buildIatV2Week9StandardTransaction(BLOCKHASH);
    const message = Buffer.from(reviewed.serializeMessage());
    const { returned, wire } = fakeTrezorRehydratedTransaction(reviewed);
    const wrongWire = Buffer.from(wire);
    wrongWire[1] ^= 0xff;
    const originalSignednessCheck = Transaction.prototype._getMessageSignednessErrors;
    Transaction.prototype._getMessageSignednessErrors = () => undefined;
    try {
      await assert.rejects(
        canonicalizeIatV2Week9SignedTransaction({
          reviewedUnsignedTransaction: reviewed,
          returnedSignedTransaction: returned,
          expectedMessageSha256: await sha256Hex(message),
          expectedMessageHex: message.toString("hex"),
          expectedSignedWire: wrongWire,
          sha256Hex,
        }),
        /wire differs/u,
      );
    } finally {
      Transaction.prototype._getMessageSignednessErrors = originalSignednessCheck;
    }
  });

  await t.test("reviewed transaction already signed", async () => {
    const reviewed = buildIatV2Week9StandardTransaction(BLOCKHASH);
    const message = Buffer.from(reviewed.serializeMessage());
    const { returned } = fakeTrezorRehydratedTransaction(reviewed);
    reviewed.signatures[0].signature = Buffer.alloc(64, 7);
    await assert.rejects(
      canonicalizeIatV2Week9SignedTransaction({
        reviewedUnsignedTransaction: reviewed,
        returnedSignedTransaction: returned,
        expectedMessageSha256: await sha256Hex(message),
        expectedMessageHex: message.toString("hex"),
        sha256Hex,
      }),
      /not exactly unsigned/u,
    );
  });

  await t.test("reviewed representation changed after review", async () => {
    const reviewed = buildIatV2Week9StandardTransaction(BLOCKHASH);
    const message = Buffer.from(reviewed.serializeMessage());
    const { returned } = fakeTrezorRehydratedTransaction(reviewed);
    reviewed.instructions[0].keys[0].isWritable = true;
    await assert.rejects(
      canonicalizeIatV2Week9SignedTransaction({
        reviewedUnsignedTransaction: reviewed,
        returnedSignedTransaction: returned,
        expectedMessageSha256: await sha256Hex(message),
        expectedMessageHex: message.toString("hex"),
        sha256Hex,
      }),
      /reviewed unsigned transaction instruction account 0 writable flag changed/u,
    );
  });
});

test("raw simulation POST body is the frozen helper rpcRequest byte-for-byte as JSON", async () => {
  const transaction = buildIatV2Week9StandardTransaction(BLOCKHASH);
  const request = await buildExactIatV2Week9SimulationRpcRequest({
    transaction,
    sha256Hex,
    sigVerify: false,
    minContextSlot: 100,
  });
  let calls = 0;
  let posted;
  const result = { context: { slot: 101 }, value: { marker: "exact" } };
  const returned = await postPinnedDevnetRpcEnvelope(request.rpcRequest, {
    fetchImpl: async (url, options) => {
      calls += 1;
      posted = { url, options };
      return rpcResponse(request.rpcRequest, result);
    },
  });
  assert.equal(calls, 1);
  assert.equal(posted.url, IAT_V2_WEEK9_STANDARD_SETTLEMENT.rpc);
  assert.equal(posted.options.method, "POST");
  assert.equal(posted.options.credentials, "omit");
  assert.deepEqual(JSON.parse(posted.options.body), request.rpcRequest);
  assert.deepEqual(returned, result);
});

test("strict RPC transport rejects response identity drift", async () => {
  const envelope = { jsonrpc: "2.0", id: "expected", method: "getGenesisHash", params: [] };
  await assert.rejects(
    postPinnedDevnetRpcEnvelope(envelope, {
      fetchImpl: async () => rpcResponse({ ...envelope, id: "hostile" }, "wrong-chain"),
    }),
    /response identity changed/u,
  );
});

test("one raw send uses one RPC invocation, exact wire, finalized preflight, and zero retries", async () => {
  const wire = Uint8Array.from([1, 2, 3, 4]);
  let calls = 0;
  let envelope;
  const result = await sendRawIatV2Week9TransactionOnce({
    signedTransaction: { serialize: () => wire },
    minContextSlot: 500,
    fetchImpl: async (_url, options) => {
      calls += 1;
      envelope = JSON.parse(options.body);
      return rpcResponse(envelope, SIGNATURE);
    },
  });
  assert.equal(calls, 1);
  assert.equal(envelope.method, "sendTransaction");
  assert.equal(Buffer.from(envelope.params[0], "base64").toString("hex"), Buffer.from(wire).toString("hex"));
  assert.equal(envelope.params[1].preflightCommitment, "finalized");
  assert.equal(envelope.params[1].maxRetries, 0);
  assert.equal(envelope.params[1].minContextSlot, 500);
  assert.deepEqual(result.receipt, { method: "sendRawTransaction", signature: SIGNATURE });
});

test("persistent latch is written before the only send boundary and can never be cleared by the UI", () => {
  const component = source(COMPONENT);
  const latchWrite = component.indexOf("localStorage.setItem(BROADCAST_LATCH_KEY");
  const send = component.indexOf("sendRawIatV2Week9TransactionOnce({");
  assert.ok(latchWrite >= 0 && send > latchWrite);
  assert.doesNotMatch(component, /removeItem\(BROADCAST_LATCH_KEY/u);
  assert.match(component, /BROADCAST_RPC_ENTERED_RESULT_UNKNOWN/u);
  assert.match(component, /navigator\.locks\.request\(BROADCAST_LATCH_KEY/u);
  assert.match(component, /ifAvailable: true/u);
  assert.match(component, /console is reconcile-only and will never retry/u);
});

test("fresh finalized signed simulation occurs inside the broadcast lock before latch or send", () => {
  const component = source(COMPONENT);
  const start = component.indexOf("async function broadcastUnderExclusiveLock()");
  const end = component.indexOf("async function completeFinalizedEvidence(");
  const locked = component.slice(start, end);
  const observe = locked.indexOf("observeFinalizedIatV2Week9State({");
  const signedSimulation = locked.indexOf("sigVerify: true");
  const ready = locked.indexOf("assertIatV2Week9BroadcastReady({");
  const deriveSignature = locked.indexOf("signatureBase58FromSignedIatV2Week9Transaction");
  const latch = locked.indexOf("localStorage.setItem(BROADCAST_LATCH_KEY");
  const send = locked.indexOf("sendRawIatV2Week9TransactionOnce({");
  assert.ok(start >= 0 && end > start);
  assert.ok(observe >= 0 && signedSimulation > observe && ready > signedSimulation);
  assert.ok(deriveSignature > ready && latch > deriveSignature && send > latch);
});

test("signing has a cross-tab lock and persistent prompt latch before the sole Trezor call", () => {
  const component = source(COMPONENT);
  const lock = component.indexOf("navigator.locks.request(SIGN_LATCH_KEY");
  const latch = component.indexOf("localStorage.setItem(SIGN_LATCH_KEY");
  const sign = component.indexOf("provider.signTransaction(unsignedTransaction)");
  assert.ok(lock >= 0 && latch > lock && sign > latch);
  assert.equal((component.match(/provider\.signTransaction\(/gu) ?? []).length, 1);
  assert.match(component, /tabId: tabId|tabId,/u);
  assert.match(component, /signLatch\.tabId !== tabId/u);
});

test("locally derived public signature is pinned before an ambiguous broadcast result", () => {
  const signature = signatureBase58FromSignedIatV2Week9Transaction({
    verifySignatures: () => true,
    signatures: [{
      publicKey: new PublicKey(IAT_V2_WEEK9_STANDARD_SETTLEMENT.requiredSigner),
      signature: Uint8Array.from({ length: 64 }, (_value, index) => index + 1),
    }],
  });
  assert.match(signature, /^[1-9A-HJ-NP-Za-km-z]{80,90}$/u);
  assert.throws(
    () => signatureBase58FromSignedIatV2Week9Transaction({
      verifySignatures: () => true,
      signatures: [{
        publicKey: new PublicKey(IAT_V2_WEEK9_STANDARD_SETTLEMENT.requiredSigner),
        signature: new Uint8Array(64),
      }],
    }),
    /pinned 7XZ/u,
  );
});

test("reload reconciliation polls a persisted signature and reconstructs finalized wire without any send", async () => {
  const signer = Keypair.generate();
  const transaction = new Transaction({
    feePayer: signer.publicKey,
    recentBlockhash: Keypair.generate().publicKey.toBase58(),
  }).add(SystemProgram.transfer({
    fromPubkey: signer.publicKey,
    toPubkey: Keypair.generate().publicKey,
    lamports: 1,
  }));
  transaction.partialSign(signer);
  const wire = transaction.serialize();
  const methods = [];
  const finalized = await awaitFinalizedIatV2Week9Transaction({
    signature: SIGNATURE,
    signedWire: null,
    pollMs: 0,
    timeoutMs: 1_000,
    fetchImpl: async (_url, options) => {
      const envelope = JSON.parse(options.body);
      methods.push(envelope.method);
      if (envelope.method === "getSignatureStatuses") {
        return rpcResponse(envelope, {
          value: [{ err: null, confirmationStatus: "finalized" }],
        });
      }
      assert.equal(envelope.method, "getTransaction");
      return rpcResponse(envelope, {
        slot: 800,
        meta: { err: null, fee: 5_000 },
        transaction: [Buffer.from(wire).toString("base64"), "base64"],
      });
    },
  });
  assert.deepEqual(methods, ["getSignatureStatuses", "getTransaction"]);
  assert.equal(finalized.transactionResult.signature, SIGNATURE);
  assert.equal(finalized.finalizedTransaction.verifySignatures(), true);
  assert.doesNotMatch(methods.join(" "), /send/u);
});

test("finalized reconstruction, exact post-state, and fresh replay are all mandatory before evidence", () => {
  const adapter = source(ADAPTER);
  const component = source(COMPONENT);
  assert.match(adapter, /getSignatureStatuses/u);
  assert.match(adapter, /getTransaction/u);
  assert.match(adapter, /Transaction\.from\(finalizedWire\)/u);
  assert.match(adapter, /finalized chain wire differs from the signed wire/u);
  assert.match(component, /expectedSignedWire: finalized\.finalizedWire/u);
  assert.match(component, /finalizedTransaction: canonicalFinalizedTransaction/u);
  assert.match(component, /minContextSlot: finalized\.transactionResult\.slot/u);
  assert.match(component, /replayMessage\.blockhash\.blockhash === activeReview\.blockhash\.blockhash/u);
  assert.match(component, /InstructionError\?\.\[0\] !== 0/u);
  assert.match(component, /finalizeIatV2Week9StandardSettlement/u);
  assert.ok(component.indexOf("finalizeIatV2Week9StandardSettlement({") < component.indexOf("persist(activeReview, completed.status"));
});

test("finalized snapshot pins Devnet genesis, Clock sysvar, exact layouts, owners, and all state accounts", () => {
  const adapter = source(ADAPTER);
  assert.equal(IAT_V2_WEEK9_OBSERVATION_ACCOUNTS.length, 13);
  assert.equal(IAT_V2_WEEK9_OBSERVATION_ACCOUNTS.at(-1), "SysvarC1ock11111111111111111111111111111111");
  assert.match(adapter, /EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG/u);
  assert.match(adapter, /getMultipleAccounts/u);
  assert.match(adapter, /commitment: FINALIZED/u);
  assert.match(adapter, /finalized Clock unix timestamp/u);
  assert.match(adapter, /wrong Anchor discriminator/u);
  assert.match(adapter, /token authority/u);
  assert.match(adapter, /deployed program is not the exact pinned 634d artifact/u);
});

test("sanitized evidence strips byte material and secret-like fields while retaining public proof", () => {
  const sanitized = sanitizedIatV2Week9Evidence({
    status: "FINALIZED_AND_REPLAY_REJECTED",
    signature: SIGNATURE,
    messageSha256: "a".repeat(64),
    messageHex: "abcd",
    messageBytes: Uint8Array.of(1, 2),
    signedTransaction: { public: false },
    serializedWire: "deadbeef",
    trezorPath: "m/44'/501'/0'/0'",
    nested: { privateKey: "never", reward: 19_230_769n },
  });
  assert.equal(sanitized.signature, SIGNATURE);
  assert.equal(sanitized.messageHex, "abcd");
  assert.equal(sanitized.messageBytes, undefined);
  assert.equal(sanitized.signedTransaction, undefined);
  assert.equal(sanitized.serializedWire, undefined);
  assert.equal(sanitized.trezorPath, undefined);
  assert.equal(sanitized.nested.privateKey, undefined);
  assert.equal(sanitized.nested.reward, "19230769");
});

test("hosted check:iat-v2 includes both frozen helper and attended UI suites", () => {
  const pkg = JSON.parse(source(PACKAGE));
  assert.match(pkg.scripts["check:iat-v2"], /tests\/iat-v2-attended-settlement\.test\.mjs/u);
  assert.match(pkg.scripts["check:iat-v2"], /tests\/iat-v2-attended-settlement-ui\.test\.mjs/u);
});
