import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  Keypair,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

import {
  IAT_V2_ATTENDED_PROGRAM_BROADCAST_ATTEMPT_SCHEMA,
  loadAttendedProgramBroadcastAttempt,
  withAttendedProgramBroadcastReconciliation,
  withAttendedProgramBroadcastOnce,
  withAttendedProgramRecoveryRead,
  withNoAttendedProgramBroadcastAttempts,
} from "../tools/iat-v2-admin-console/attended-program-broadcast-once.mjs";

const base58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function encodeBase58(bytes) {
  let number = 0n;
  for (const byte of bytes) number = (number << 8n) + BigInt(byte);
  let encoded = "";
  while (number > 0n) {
    encoded = base58Alphabet[Number(number % 58n)] + encoded;
    number /= 58n;
  }
  let zeroes = 0;
  while (zeroes < bytes.length && bytes[zeroes] === 0) zeroes += 1;
  return `${"1".repeat(zeroes)}${encoded}`;
}

function memoryStorage() {
  const values = new Map();
  const calls = [];
  return {
    calls,
    values,
    getItem(key) {
      calls.push(["getItem", key]);
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      calls.push(["setItem", key, value]);
      values.set(key, value);
    },
  };
}

function lockManager({ available = true } = {}) {
  const calls = [];
  return {
    calls,
    async request(name, options, callback) {
      calls.push({ name, options });
      return callback(available ? { name } : null);
    },
  };
}

function exclusiveIfAvailableLockManager() {
  const calls = [];
  let held = false;
  return {
    calls,
    async request(name, options, callback) {
      calls.push({ name, options });
      if (held) return callback(null);
      held = true;
      try {
        return await callback({ name });
      } finally {
        held = false;
      }
    },
  };
}

const sourceCommit = "a".repeat(40);
const programArtifactSha256 = "b".repeat(64);
const mint = Keypair.fromSeed(Uint8Array.from({ length: 32 }, (_, index) => index + 1)).publicKey.toBase58();
const signer = Keypair.fromSeed(Uint8Array.from({ length: 32 }, (_, index) => 32 - index));
const destination = Keypair.fromSeed(Uint8Array.from({ length: 32 }, (_, index) => index + 65)).publicKey;

function attempt({
  action = "EXTEND_PROGRAM_DATA",
  blockhashSeed = 97,
  lamports = 1,
  lastValidBlockHeight = 364_000_000,
} = {}) {
  const blockhash = Keypair.fromSeed(
    Uint8Array.from({ length: 32 }, (_, index) => blockhashSeed + index),
  ).publicKey.toBase58();
  const transaction = new Transaction({
    feePayer: signer.publicKey,
    recentBlockhash: blockhash,
  }).add(SystemProgram.transfer({
    fromPubkey: signer.publicKey,
    toPubkey: destination,
    lamports,
  }));
  transaction.sign(signer);
  return {
    schema: IAT_V2_ATTENDED_PROGRAM_BROADCAST_ATTEMPT_SCHEMA,
    sourceCommit,
    programArtifactSha256,
    mint,
    action,
    messageSha256: createHash("sha256").update(transaction.serializeMessage()).digest("hex"),
    signer: signer.publicKey.toBase58(),
    localSignature: encodeBase58(transaction.signature),
    blockhash,
    lastValidBlockHeight,
  };
}

function binding(action = "EXTEND_PROGRAM_DATA") {
  return { sourceCommit, programArtifactSha256, mint, action };
}

test("persists the exact v2 attempt before the sole continuation and never invokes it twice", async () => {
  const storage = memoryStorage();
  const locks = lockManager();
  const exactAttempt = await attempt();
  let calls = 0;
  const first = await withAttendedProgramBroadcastOnce({
    locks,
    storage,
    attempt: exactAttempt,
    beforePersist: async () => {
      assert.equal(loadAttendedProgramBroadcastAttempt(storage, binding()), null);
    },
    afterPersist: async (persisted) => {
      calls += 1;
      assert.deepEqual(loadAttendedProgramBroadcastAttempt(storage, binding()), persisted);
      return "caller-finished";
    },
  });
  const second = await withAttendedProgramBroadcastOnce({
    locks,
    storage,
    attempt: exactAttempt,
    afterPersist: async () => {
      calls += 1;
      throw new Error("must not run");
    },
  });

  assert.equal(first.status, "RESERVED");
  assert.equal(first.value, "caller-finished");
  assert.equal(second.status, "ALREADY_RESERVED");
  assert.equal(second.value, null);
  assert.equal(calls, 1);
  assert.deepEqual(locks.calls, [
    {
      name: "iat-v2-current-source-program-broadcast/global/v2",
      options: { mode: "exclusive", ifAvailable: true },
    },
    {
      name: "iat-v2-current-source-program-broadcast/global/v2",
      options: { mode: "exclusive", ifAvailable: true },
    },
  ]);
  assert.equal(storage.calls.filter(([method]) => method === "setItem").length, 1);
});

test("a failed continuation leaves the permanent reservation and cannot run again", async () => {
  const storage = memoryStorage();
  const locks = lockManager();
  const exactAttempt = await attempt();
  let calls = 0;
  await assert.rejects(
    withAttendedProgramBroadcastOnce({
      locks,
      storage,
      attempt: exactAttempt,
      afterPersist: async () => {
        calls += 1;
        throw new Error("caller failed after reservation");
      },
    }),
    /caller failed after reservation/u,
  );
  const recovered = await withAttendedProgramBroadcastOnce({
    locks,
    storage,
    attempt: exactAttempt,
    afterPersist: async () => { calls += 1; },
  });
  assert.equal(recovered.status, "ALREADY_RESERVED");
  assert.equal(calls, 1);
  assert.deepEqual(loadAttendedProgramBroadcastAttempt(storage, binding()), exactAttempt);
});

test("locked pre-reservation validation failure writes nothing and never reaches continuation", async () => {
  const storage = memoryStorage();
  const exactAttempt = attempt();
  let continuationCalls = 0;
  await assert.rejects(
    withAttendedProgramBroadcastOnce({
      locks: lockManager(),
      storage,
      attempt: exactAttempt,
      beforePersist: async () => {
        assert.equal(loadAttendedProgramBroadcastAttempt(storage, binding()), null);
        throw new Error("final boundary drifted");
      },
      afterPersist: async () => { continuationCalls += 1; },
    }),
    /final boundary drifted/u,
  );
  assert.equal(continuationCalls, 0);
  assert.equal(loadAttendedProgramBroadcastAttempt(storage, binding()), null);
  assert.equal(storage.calls.some(([method]) => method === "setItem"), false);
});

test("both canonical program actions use distinct permanent slots under one global lock", async () => {
  const storage = memoryStorage();
  const locks = lockManager();
  const extension = attempt();
  const upgrade = attempt({ action: "UPGRADE_PROGRAM", blockhashSeed: 129, lamports: 2 });
  for (const exactAttempt of [extension, upgrade]) {
    const result = await withAttendedProgramBroadcastOnce({
      locks,
      storage,
      attempt: exactAttempt,
      afterPersist: async () => exactAttempt.action,
    });
    assert.equal(result.status, "RESERVED");
    assert.equal(result.value, exactAttempt.action);
    assert.deepEqual(
      loadAttendedProgramBroadcastAttempt(storage, binding(exactAttempt.action)),
      exactAttempt,
    );
  }
  assert.equal(storage.values.size, 2);
  assert.equal(new Set(locks.calls.map(({ name }) => name)).size, 1);
});

test("fresh message, signature, blockhash, or height cannot bypass the canonical action slot", async () => {
  const storage = memoryStorage();
  const locks = lockManager();
  const first = await attempt();
  const conflict = await attempt({ blockhashSeed: 129, lamports: 2, lastValidBlockHeight: 364_000_001 });
  await withAttendedProgramBroadcastOnce({
    locks,
    storage,
    attempt: first,
    afterPersist: async () => "first",
  });
  let calls = 0;
  await assert.rejects(
    withAttendedProgramBroadcastOnce({
      locks,
      storage,
      attempt: conflict,
      afterPersist: async () => { calls += 1; },
    }),
    /conflicts with the permanent action reservation/u,
  );
  assert.equal(calls, 0);
  assert.deepEqual(loadAttendedProgramBroadcastAttempt(storage, binding()), first);
});

test("exact schema, fields, public keys, signature bytes, action, and height fail closed", async () => {
  const baseline = await attempt();
  const invalid = [
    { ...baseline, schema: "iat-v2-current-source-program-broadcast-attempt/v1" },
    { ...baseline, secretKey: "forbidden" },
    Object.fromEntries(Object.entries(baseline).filter(([key]) => key !== "localSignature")),
    { ...baseline, sourceCommit: "A".repeat(40) },
    { ...baseline, programArtifactSha256: "B".repeat(64) },
    { ...baseline, mint: "not-a-public-key" },
    { ...baseline, action: "RETURN_BUFFER" },
    { ...baseline, messageSha256: "f".repeat(63) },
    { ...baseline, signer: "not-a-public-key" },
    { ...baseline, localSignature: baseline.signer },
    { ...baseline, localSignature: "1".repeat(64) },
    { ...baseline, blockhash: "not-a-blockhash" },
    { ...baseline, lastValidBlockHeight: 0 },
  ];
  for (const value of invalid) {
    await assert.rejects(withAttendedProgramBroadcastOnce({
      locks: lockManager(),
      storage: memoryStorage(),
      attempt: value,
      afterPersist: async () => {},
    }));
  }
});

test("malformed/conflicting storage and unavailable Web Locks block without continuation", async () => {
  const exactAttempt = await attempt();
  const storage = memoryStorage();
  const key = `iat-v2-current-source-program-broadcast-attempt/${sourceCommit}/${programArtifactSha256}/${mint}/EXTEND_PROGRAM_DATA/v2`;
  storage.values.set(key, "{malformed");
  assert.throws(
    () => loadAttendedProgramBroadcastAttempt(storage, binding()),
    /not valid JSON/u,
  );
  let calls = 0;
  await assert.rejects(withAttendedProgramBroadcastOnce({
    locks: lockManager(),
    storage,
    attempt: exactAttempt,
    afterPersist: async () => { calls += 1; },
  }), /not valid JSON/u);
  await assert.rejects(withAttendedProgramBroadcastOnce({
    locks: lockManager({ available: false }),
    storage: memoryStorage(),
    attempt: exactAttempt,
    afterPersist: async () => { calls += 1; },
  }), /owns the global Web Lock/u);
  await assert.rejects(withAttendedProgramBroadcastOnce({
    locks: {},
    storage: memoryStorage(),
    attempt: exactAttempt,
    afterPersist: async () => { calls += 1; },
  }), /Web Locks are unavailable/u);
  assert.equal(calls, 0);
});

test("reservation writes only its v2 key and preserves prompt and signed-pending records", async () => {
  const storage = memoryStorage();
  const promptLatchKey = "iat-v2-current-source-model-t-transaction-prompt/permanent/v2";
  const signedPendingKey = "iat-v2-current-source-program-signed-pending/permanent/v2";
  storage.values.set(promptLatchKey, "prompt-latch");
  storage.values.set(signedPendingKey, "signed-pending");
  await withAttendedProgramBroadcastOnce({
    locks: lockManager(),
    storage,
    attempt: await attempt(),
    afterPersist: async () => null,
  });
  assert.equal(storage.values.get(promptLatchKey), "prompt-latch");
  assert.equal(storage.values.get(signedPendingKey), "signed-pending");
  assert.equal(storage.values.size, 3);
  assert.equal(storage.calls.some(([method]) => method === "removeItem"), false);
});

test("a held broadcast lock blocks the no-attempt guard without invoking its callback", async () => {
  const storage = memoryStorage();
  const locks = exclusiveIfAvailableLockManager();
  let releaseBroadcast;
  let markBroadcastEntered;
  const broadcastEntered = new Promise((resolve) => { markBroadcastEntered = resolve; });
  const broadcastRelease = new Promise((resolve) => { releaseBroadcast = resolve; });
  const broadcast = withAttendedProgramBroadcastOnce({
    locks,
    storage,
    attempt: attempt(),
    afterPersist: async () => {
      markBroadcastEntered();
      await broadcastRelease;
      return "released";
    },
  });
  await broadcastEntered;

  let guardCalls = 0;
  await assert.rejects(
    withNoAttendedProgramBroadcastAttempts({
      locks,
      storage,
      bindings: [binding("UPGRADE_PROGRAM")],
      callback: async () => { guardCalls += 1; },
    }),
    /owns the global Web Lock/u,
  );
  assert.equal(guardCalls, 0);
  assert.deepEqual(locks.calls.map(({ name }) => name), [
    "iat-v2-current-source-program-broadcast/global/v2",
    "iat-v2-current-source-program-broadcast/global/v2",
  ]);

  releaseBroadcast();
  assert.equal((await broadcast).value, "released");
});

test("a retained attempt blocks the no-attempt guard callback", async () => {
  const storage = memoryStorage();
  const locks = exclusiveIfAvailableLockManager();
  await withAttendedProgramBroadcastOnce({
    locks,
    storage,
    attempt: attempt({ action: "UPGRADE_PROGRAM", blockhashSeed: 129, lamports: 2 }),
    afterPersist: async () => null,
  });

  let guardCalls = 0;
  await assert.rejects(
    withNoAttendedProgramBroadcastAttempts({
      locks,
      storage,
      bindings: [binding(), binding("UPGRADE_PROGRAM")],
      callback: async () => { guardCalls += 1; },
    }),
    /Permanent attended program broadcast attempt already exists for UPGRADE_PROGRAM/u,
  );
  assert.equal(guardCalls, 0);
});

test("the no-attempt guard validates every binding and invokes one callback inside the shared lock", async () => {
  const storage = memoryStorage();
  const locks = exclusiveIfAvailableLockManager();
  let guardCalls = 0;
  const value = await withNoAttendedProgramBroadcastAttempts({
    locks,
    storage,
    bindings: [binding(), binding("UPGRADE_PROGRAM")],
    callback: async (exactBindings) => {
      guardCalls += 1;
      assert.equal(Object.isFrozen(exactBindings), true);
      assert.deepEqual(exactBindings, [binding(), binding("UPGRADE_PROGRAM")]);
      return "guarded";
    },
  });
  assert.equal(value, "guarded");
  assert.equal(guardCalls, 1);

  for (const bindings of [[], [{ ...binding(), extra: true }], [{ ...binding(), action: "RETURN_BUFFER" }]]) {
    await assert.rejects(withNoAttendedProgramBroadcastAttempts({
      locks,
      storage,
      bindings,
      callback: async () => { guardCalls += 1; },
    }));
  }
  assert.equal(guardCalls, 1);
});

test("discard winning the shared lock makes a stale in-memory broadcast fail before reservation", async () => {
  const storage = memoryStorage();
  const locks = exclusiveIfAvailableLockManager();
  const durablePendingKey = "exact-signed-pending";
  storage.values.set(durablePendingKey, "signed-wire");

  await withNoAttendedProgramBroadcastAttempts({
    locks,
    storage,
    bindings: [binding()],
    callback: async () => {
      assert.equal(storage.values.get(durablePendingKey), "signed-wire");
      storage.values.delete(durablePendingKey);
    },
  });

  let sendCalls = 0;
  await assert.rejects(
    withAttendedProgramBroadcastOnce({
      locks,
      storage,
      attempt: attempt(),
      beforePersist: async () => {
        if (storage.values.get(durablePendingKey) !== "signed-wire") {
          throw new Error("exact durable signed wire is absent");
        }
      },
      afterPersist: async () => { sendCalls += 1; },
    }),
    /exact durable signed wire is absent/u,
  );
  assert.equal(sendCalls, 0);
  assert.equal(loadAttendedProgramBroadcastAttempt(storage, binding()), null);
});

test("finalized reconciliation uses the same global lock and exact permanent attempt", async () => {
  const storage = memoryStorage();
  const locks = exclusiveIfAvailableLockManager();
  const exactAttempt = attempt();
  await withAttendedProgramBroadcastOnce({
    locks,
    storage,
    attempt: exactAttempt,
    afterPersist: async () => null,
  });
  let calls = 0;
  const value = await withAttendedProgramBroadcastReconciliation({
    locks,
    storage,
    attempt: exactAttempt,
    callback: async (retained) => {
      calls += 1;
      assert.deepEqual(retained, exactAttempt);
      return "reconciled";
    },
  });
  assert.equal(value, "reconciled");
  assert.equal(calls, 1);
  assert.equal(new Set(locks.calls.map(({ name }) => name)).size, 1);

  await assert.rejects(withAttendedProgramBroadcastReconciliation({
    locks,
    storage: memoryStorage(),
    attempt: exactAttempt,
    callback: async () => { calls += 1; },
  }), /attempt is missing during reconciliation/u);
  assert.equal(calls, 1);
});

test("a concurrent reconciliation cannot enter while the permanent attempt lock is held", async () => {
  const storage = memoryStorage();
  const locks = exclusiveIfAvailableLockManager();
  const exactAttempt = attempt();
  await withAttendedProgramBroadcastOnce({
    locks,
    storage,
    attempt: exactAttempt,
    afterPersist: async () => null,
  });
  let releaseFirst;
  let markFirstEntered;
  const firstEntered = new Promise((resolve) => { markFirstEntered = resolve; });
  const firstRelease = new Promise((resolve) => { releaseFirst = resolve; });
  const first = withAttendedProgramBroadcastReconciliation({
    locks,
    storage,
    attempt: exactAttempt,
    callback: async () => {
      markFirstEntered();
      await firstRelease;
      return "first";
    },
  });
  await firstEntered;
  let secondCalls = 0;
  await assert.rejects(withAttendedProgramBroadcastReconciliation({
    locks,
    storage,
    attempt: exactAttempt,
    callback: async () => { secondCalls += 1; },
  }), /owns the global Web Lock/u);
  assert.equal(secondCalls, 0);
  releaseFirst();
  assert.equal(await first, "first");
});

test("module exposes no remove/reset or network operation", async () => {
  const api = await import("../tools/iat-v2-admin-console/attended-program-broadcast-once.mjs");
  assert.deepEqual(Object.keys(api), [
    "IAT_V2_ATTENDED_PROGRAM_BROADCAST_ATTEMPT_SCHEMA",
    "loadAttendedProgramBroadcastAttempt",
    "withAttendedProgramBroadcastOnce",
    "withAttendedProgramBroadcastReconciliation",
    "withAttendedProgramRecoveryRead",
    "withNoAttendedProgramBroadcastAttempts",
  ]);
  for (const name of Object.keys(api)) {
    assert.doesNotMatch(name, /remove|reset|send|confirm|broadcastRaw/iu);
  }
});

test("recovery reads acquire both writer locks without queuing or mutating storage", async () => {
  const { IAT_V2_ATTENDED_PROMPT_GLOBAL_LOCK_NAME } = await import("../tools/iat-v2-admin-console/attended-prompt-coordinator.mjs");
  for (const unavailable of [null, "prompt", "broadcast"]) {
    const held = new Set();
    let callbacks = 0;
    const locks = { async request(name, options, callback) {
      assert.deepEqual(options, { mode: "exclusive", ifAvailable: true });
      const kind = name === IAT_V2_ATTENDED_PROMPT_GLOBAL_LOCK_NAME ? "prompt" : "broadcast";
      if (kind === unavailable) return callback(null);
      held.add(kind);
      try { return await callback({ name }); } finally { held.delete(kind); }
    } };
    const read = withAttendedProgramRecoveryRead({ locks, callback: () => {
      callbacks += 1;
      assert.deepEqual([...held], ["prompt", "broadcast"]);
      return "read-only snapshot";
    } });
    if (unavailable) await assert.rejects(read, /recovery unavailable/u);
    else assert.equal(await read, "read-only snapshot");
    assert.equal(callbacks, unavailable ? 0 : 1);
    assert.equal(held.size, 0);
  }
  await assert.rejects(withAttendedProgramRecoveryRead({ locks: {}, callback() {} }), /Web Locks are unavailable/u);
});
