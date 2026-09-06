import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";

import {
  IAT_V2_ATTENDED_PROGRAM_SIGNED_PENDING_SCHEMA,
  loadAttendedProgramSignedPending,
  persistAttendedProgramSignedPending,
  removeAttendedProgramSignedPending,
  loadAttendedProgramSignedTerminal,
  terminalizeAttendedProgramSignedPending,
  withRetainedAttendedProgramPreSend,
} from "../tools/iat-v2-admin-console/attended-program-signed-pending.mjs";
import { classifyAttendedProgramRecovery } from "../tools/iat-v2-admin-console/attended-program-recovery.mjs";
import { withAttendedProgramBroadcastOnce, IAT_V2_ATTENDED_PROGRAM_BROADCAST_ATTEMPT_SCHEMA } from "../tools/iat-v2-admin-console/attended-program-broadcast-once.mjs";
import { buildProgramDataExtensionTransaction } from "../tools/iat-v2-admin-console/program-extension-attended.mjs";

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
    removeItem(key) {
      calls.push(["removeItem", key]);
      values.delete(key);
    },
  };
}

const sourceCommit = "a".repeat(40);
const programArtifactSha256 = "b".repeat(64);
const mint = Keypair.fromSeed(Uint8Array.from({ length: 32 }, (_, index) => index + 1)).publicKey.toBase58();
const signer = Keypair.fromSeed(Uint8Array.from({ length: 32 }, (_, index) => 32 - index));
const programId = Keypair.fromSeed(Uint8Array.from({ length: 32 }, (_, index) => index + 33)).publicKey;
const programDataAddress = Keypair.fromSeed(Uint8Array.from({ length: 32 }, (_, index) => index + 65)).publicKey;
const blockhash = Keypair.fromSeed(Uint8Array.from({ length: 32 }, (_, index) => index + 129)).publicKey.toBase58();
const loaderProgramId = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");

function binding(action = "EXTEND_PROGRAM_DATA") {
  return { sourceCommit, programArtifactSha256, mint, action };
}

function attemptFromRecord(record) {
  const bytes = Transaction.from(Buffer.from(record.signedWireHex, "hex")).signatures[0].signature;
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = BigInt(`0x${Buffer.from(bytes).toString("hex")}`), encoded = "";
  while (n > 0n) { encoded = alphabet[Number(n % 58n)] + encoded; n /= 58n; }
  let zeros = 0;
  while (bytes[zeros] === 0) zeros += 1;
  return {
    schema: IAT_V2_ATTENDED_PROGRAM_BROADCAST_ATTEMPT_SCHEMA,
    ...binding(record.action),
    messageSha256: record.messageSha256,
    signer: record.signer,
    localSignature: "1".repeat(zeros) + encoded,
    blockhash: record.blockhash,
    lastValidBlockHeight: record.lastValidBlockHeight,
  };
}

function fixture(overrides = {}) {
  const transaction = buildProgramDataExtensionTransaction({
    additionalBytes: 52_344,
    authority: signer.publicKey,
    blockhash,
    checked: true,
    feePayer: signer.publicKey,
    loaderProgramId,
    programDataAddress,
    programId,
  });
  transaction.sign(signer);
  const messageBytes = Buffer.from(transaction.serializeMessage());
  const actionBinding = JSON.stringify({
    action: "extend-program",
    programId: programId.toBase58(),
    programDataAddress: programDataAddress.toBase58(),
    programAdmin: signer.publicKey.toBase58(),
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
    mint,
  });
  return {
    schema: IAT_V2_ATTENDED_PROGRAM_SIGNED_PENDING_SCHEMA,
    sourceCommit,
    programArtifactSha256,
    mint,
    action: "EXTEND_PROGRAM_DATA",
    messageSha256: createHash("sha256").update(messageBytes).digest("hex"),
    signer: signer.publicKey.toBase58(),
    actionBinding,
    finalizedContextSlot: 376_700_000,
    blockhash,
    lastValidBlockHeight: 364_000_000,
    messageBytesHex: messageBytes.toString("hex"),
    signedWireHex: Buffer.from(transaction.serialize()).toString("hex"),
    preUpgradeProgramDataCapacityBytes: 597_336,
    ...overrides,
  };
}

function upgradeFixture(overrides = {}) {
  const base = fixture();
  const actionBinding = JSON.parse(base.actionBinding);
  Object.assign(actionBinding, {
    action: "upgrade",
    buffer: programId.toBase58(),
    bufferAuthority: signer.publicKey.toBase58(),
    bufferHash: programArtifactSha256,
    programDataCapacityBytes: "649680",
    additionalProgramDataBytes: "0",
    currentProgramDataLamports: "4522921920",
    rentTopUpLamports: "0",
  });
  return {
    ...base,
    action: "UPGRADE_PROGRAM",
    actionBinding: JSON.stringify(actionBinding),
    preUpgradeProgramDataCapacityBytes: 649_680,
    ...overrides,
  };
}

test("persists and loads one exact source-bound signed program record idempotently", () => {
  const storage = memoryStorage();
  const record = fixture();
  const first = persistAttendedProgramSignedPending(storage, record);
  const second = persistAttendedProgramSignedPending(storage, record);
  const loaded = loadAttendedProgramSignedPending(storage, binding());

  assert.deepEqual(first, record);
  assert.deepEqual(second, record);
  assert.deepEqual(loaded, record);
  assert.equal(storage.values.size, 1);
  const [key] = storage.values.keys();
  assert.equal(
    key,
    `iat-v2-current-source-program-signed-pending/${sourceCommit}/${programArtifactSha256}/${mint}/EXTEND_PROGRAM_DATA/v2`,
  );
  assert.equal(storage.calls.filter(([method]) => method === "setItem").length, 1);
  assert.deepEqual(Object.keys(JSON.parse(storage.values.get(key))), Object.keys(record));
  assert.doesNotMatch(storage.values.get(key), /secret|mnemonic|privateKey|seedPhrase|recoveryPhrase/iu);
});

test("fails closed on exact-schema, binding, byte, hash, signature, and type drift", () => {
  const wire = fixture().signedWireHex;
  const tamperedWire = `${wire.slice(0, -2)}${wire.endsWith("00") ? "01" : "00"}`;
  const invalid = [
    { ...fixture(), secretKey: "forbidden" },
    Object.fromEntries(Object.entries(fixture()).filter(([key]) => key !== "signedWireHex")),
    { ...fixture(), sourceCommit: "A".repeat(40) },
    { ...fixture(), action: "RETURN_BUFFER" },
    { ...fixture(), finalizedContextSlot: 0 },
    { ...fixture(), messageSha256: "c".repeat(64) },
    { ...fixture(), signedWireHex: tamperedWire },
    { ...fixture(), actionBinding: `${fixture().actionBinding} ` },
    {
      ...fixture(),
      actionBinding: fixture().actionBinding.replace(programArtifactSha256, "c".repeat(64)),
    },
  ];
  for (const record of invalid) {
    assert.throws(() => persistAttendedProgramSignedPending(memoryStorage(), record));
  }
});

test("upgrade pending metadata cannot alter the action-bound pre-upgrade capacity", () => {
  const exact = upgradeFixture();
  assert.deepEqual(
    persistAttendedProgramSignedPending(memoryStorage(), exact),
    exact,
  );
  assert.throws(
    () => persistAttendedProgramSignedPending(memoryStorage(), {
      ...exact,
      preUpgradeProgramDataCapacityBytes: exact.preUpgradeProgramDataCapacityBytes - 1,
    }),
    /pre-upgrade ProgramData capacity drifted/u,
  );
});

test("retained state is immutable and malformed retained state blocks load and removal", () => {
  const storage = memoryStorage();
  const record = fixture();
  persistAttendedProgramSignedPending(storage, record);
  assert.throws(
    () => persistAttendedProgramSignedPending(storage, { ...record, finalizedContextSlot: record.finalizedContextSlot + 1 }),
    /conflicts with retained state/u,
  );

  const [key] = storage.values.keys();
  storage.values.set(key, "{malformed");
  assert.throws(() => loadAttendedProgramSignedPending(storage, binding()), /not valid JSON/u);
  assert.throws(
    () => removeAttendedProgramSignedPending(storage, binding(), "FINALIZED_SUCCESS"),
    /not valid JSON/u,
  );
  assert.equal(storage.values.get(key), "{malformed");
});

test("removal is restricted to finalized success and never touches the prompt latch", () => {
  for (const reason of ["FINALIZED_SUCCESS"]) {
    const storage = memoryStorage();
    const record = fixture();
    persistAttendedProgramSignedPending(storage, record);
    const promptLatchKeys = ["v1", "v2"].map(
      (version) => `iat-v2-current-source-model-t-transaction-prompt/${sourceCommit}/${programArtifactSha256}/${mint}/EXTEND_PROGRAM_DATA/${version}`,
    );
    for (const key of promptLatchKeys) storage.values.set(key, `permanent-latch-sentinel-${key}`);

    assert.deepEqual(removeAttendedProgramSignedPending(storage, binding(), reason), record);
    assert.equal(loadAttendedProgramSignedPending(storage, binding()), null);
    for (const key of promptLatchKeys) {
      assert.equal(storage.values.get(key), `permanent-latch-sentinel-${key}`);
      assert.equal(
        storage.calls.some(([method, removedKey]) => method === "removeItem" && removedKey === key),
        false,
      );
    }
    assert.equal(removeAttendedProgramSignedPending(storage, binding(), reason), null);
  }

  const storage = memoryStorage();
  persistAttendedProgramSignedPending(storage, fixture());
  assert.throws(
    () => removeAttendedProgramSignedPending(storage, binding(), "RESET_AND_RETRY"),
    /reason is not reviewed/u,
  );
  assert.ok(loadAttendedProgramSignedPending(storage, binding()));
  for (const reason of ["PRE_SEND_FAILURE", "EXPLICIT_DISCARD"]) {
    assert.throws(() => removeAttendedProgramSignedPending(storage, binding(), reason), /retain terminal evidence/u);
  }
});

test("storage failures and write/remove readback disagreement fail closed", () => {
  assert.throws(() => loadAttendedProgramSignedPending({}, binding()), /storage is unavailable/u);

  const badWrite = memoryStorage();
  badWrite.setItem = () => {};
  assert.throws(
    () => persistAttendedProgramSignedPending(badWrite, fixture()),
    /unavailable or non-durable/u,
  );

  const badRemove = memoryStorage();
  persistAttendedProgramSignedPending(badRemove, fixture());
  badRemove.removeItem = () => {};
  assert.throws(
    () => removeAttendedProgramSignedPending(badRemove, binding(), "FINALIZED_SUCCESS"),
    /unavailable for removal/u,
  );
  assert.ok(loadAttendedProgramSignedPending(badRemove, binding()));
});

test("terminal disposition preserves exact wire and latch across recovery and never becomes recoverable", () => {
  for (const action of ["EXTEND_PROGRAM_DATA", "UPGRADE_PROGRAM"]) {
    for (const reason of ["PRE_SEND_FAILURE", "EXPLICIT_DISCARD"]) {
      const storage = memoryStorage();
      const record = action === "UPGRADE_PROGRAM" ? upgradeFixture() : fixture();
      const expected = binding(action);
      persistAttendedProgramSignedPending(storage, record);
      const promptLatch = { status: "PROMPT_VERIFIED", messageSha256: record.messageSha256, signer: record.signer };
      storage.values.set("prompt-latch-sentinel", JSON.stringify(promptLatch));
      const before = new Map(storage.values);
      const terminal = terminalizeAttendedProgramSignedPending(storage, expected, reason);
      assert.deepEqual(terminalizeAttendedProgramSignedPending(storage, expected, reason), terminal);
      for (const [key, value] of before) assert.equal(storage.values.get(key), value);
      assert.equal(storage.calls.filter(([method]) => method === "removeItem").length, 0);
      assert.deepEqual(loadAttendedProgramSignedPending(storage, expected), record);
      assert.deepEqual(loadAttendedProgramSignedTerminal(storage, expected), terminal);
      const recovered = classifyAttendedProgramRecovery({ promptLatch, signedPending: loadAttendedProgramSignedPending(storage, expected), terminalDisposition: loadAttendedProgramSignedTerminal(storage, expected) });
      assert.equal(recovered.outcome, "HOLD");
      assert.equal(recovered.code, "TERMINAL_SIGNED_EVIDENCE_RETAINED");
      assert.throws(() => removeAttendedProgramSignedPending(storage, expected, "FINALIZED_SUCCESS"), /terminal/u);
      assert.throws(() => terminalizeAttendedProgramSignedPending(storage, expected, reason === "PRE_SEND_FAILURE" ? "EXPLICIT_DISCARD" : "PRE_SEND_FAILURE"), /conflicts/u);
    }
  }
});

test("terminal disposition never fabricates missing evidence and rejects tampered bindings or bytes", () => {
  const storage = memoryStorage();
  assert.throws(() => terminalizeAttendedProgramSignedPending(storage, binding(), "EXPLICIT_DISCARD"), /missing signed evidence/u);
  assert.equal(storage.values.size, 0);
  persistAttendedProgramSignedPending(storage, fixture());
  terminalizeAttendedProgramSignedPending(storage, binding(), "EXPLICIT_DISCARD");
  const terminalKey = [...storage.values.keys()].find(key => key.endsWith("/terminal/v1"));
  const good = storage.values.get(terminalKey);
  for (const patch of [{ reason: "RETRY" }, { pendingRecordSha256: "0".repeat(64) }, { sourceCommit: "c".repeat(40) }, { extra: true }]) {
    storage.values.set(terminalKey, JSON.stringify({ ...JSON.parse(good), ...patch }));
    assert.throws(() => loadAttendedProgramSignedTerminal(storage, binding()));
  }
  storage.values.set(terminalKey, good);
  const pendingKey = [...storage.values.keys()].find(key => key.endsWith("/v2"));
  storage.values.delete(pendingKey);
  assert.throws(() => loadAttendedProgramSignedTerminal(storage, binding()), /no retained signed evidence/u);
});

test("terminal persistence faults keep signed bytes and do not claim an uncommitted disposition", () => {
  for (const fault of ["before", "after", "noop"]) {
    const storage = memoryStorage();
    const record = fixture();
    persistAttendedProgramSignedPending(storage, record);
    const originalWrite = storage.setItem;
    storage.setItem = (key, value) => {
      if (fault === "before") throw new Error("write failed");
      if (fault !== "noop") originalWrite(key, value);
      if (fault === "after") throw new Error("write result unknown");
    };
    assert.throws(() => terminalizeAttendedProgramSignedPending(storage, binding(), "EXPLICIT_DISCARD"), /non-durable/u);
    assert.deepEqual(loadAttendedProgramSignedPending(storage, binding()), record);
    assert.equal(storage.calls.filter(([method]) => method === "removeItem").length, 0);
    assert.equal(loadAttendedProgramSignedTerminal(storage, binding())?.reason ?? null, fault === "after" ? "EXPLICIT_DISCARD" : null);
  }
});

test("pre-send failure terminalizes under the existing lock and rejects a stale second tab without deleting evidence", async () => {
  for (const reason of ["PRE_SEND_FAILURE", "EXPLICIT_DISCARD"]) {
    const storage = memoryStorage();
    const record = upgradeFixture();
    persistAttendedProgramSignedPending(storage, record);
    const attempt = attemptFromRecord(record);
    let held = false, sent = 0, checked = 0;
    const locks = { async request(name, options, cb) { assert.equal(held, false); held = true; try { return await cb({name}); } finally { held = false; } } };
    const originalWrite = storage.setItem;
    storage.setItem = (key, value) => { if (key.endsWith("/terminal/v1")) assert.equal(held, true); originalWrite(key, value); };
    if (reason === "PRE_SEND_FAILURE") {
      await assert.rejects(withAttendedProgramBroadcastOnce({ locks, storage, attempt, beforePersist: () => withRetainedAttendedProgramPreSend({storage, record, callback: async () => { throw new Error("expired before reservation"); }}), afterPersist: async () => { sent += 1; } }), /expired before reservation/u);
    } else {
      const { withNoAttendedProgramBroadcastAttempts } = await import("../tools/iat-v2-admin-console/attended-program-broadcast-once.mjs");
      await withNoAttendedProgramBroadcastAttempts({ locks, storage, bindings:[binding("UPGRADE_PROGRAM")], callback: () => terminalizeAttendedProgramSignedPending(storage, binding("UPGRADE_PROGRAM"), reason) });
    }
    await assert.rejects(withAttendedProgramBroadcastOnce({ locks, storage, attempt, beforePersist: async () => { checked += 1; }, afterPersist: async () => { sent += 1; } }), /terminal/u);
    assert.equal(checked, 0);
    assert.equal(sent, 0);
    assert.deepEqual(loadAttendedProgramSignedPending(storage, binding("UPGRADE_PROGRAM")), record);
    assert.equal([...storage.values.keys()].some(key => key.startsWith("iat-v2-current-source-program-broadcast-attempt/")), false);
  }
});

test("reservation write failures terminalize only when absence is proven under the held lock", async () => {
  for (const fault of ["before", "after", "noop", null]) {
    const storage = memoryStorage();
    const record = upgradeFixture();
    persistAttendedProgramSignedPending(storage, record);
    let held = false, sent = 0, terminalized = 0;
    const locks = { async request(name, options, cb) {
      assert.equal(held, false);
      held = true;
      try { return await cb({ name }); } finally { held = false; }
    } };
    const originalWrite = storage.setItem;
    storage.setItem = (key, value) => {
      const isAttempt = key.startsWith("iat-v2-current-source-program-broadcast-attempt/");
      if (isAttempt && fault === "before") throw new Error("reservation before-write failure");
      if (!(isAttempt && fault === "noop")) originalWrite(key, value);
      if (isAttempt && fault === "after") throw new Error("reservation committed then threw");
    };
    const exactAttempt = attemptFromRecord(record);
    const options = {
      locks, storage, attempt: exactAttempt,
      beforePersist: () => withRetainedAttendedProgramPreSend({ storage, record, callback: async () => "validated" }),
      onPreReservationFailure: () => {
        assert.equal(held, true);
        terminalized += 1;
        return terminalizeAttendedProgramSignedPending(storage, binding(record.action), "PRE_SEND_FAILURE");
      },
      afterPersist: () => { sent += 1; return "mock-send"; },
    };
    if (fault) await assert.rejects(withAttendedProgramBroadcastOnce(options), /non-durable/u);
    else assert.equal((await withAttendedProgramBroadcastOnce(options)).status, "RESERVED");
    assert.equal(sent, fault ? 0 : 1);
    assert.equal(held, false);
    assert.deepEqual(loadAttendedProgramSignedPending(storage, binding(record.action)), record);
    const shouldTerminalize = fault === "before" || fault === "noop";
    assert.equal(terminalized, shouldTerminalize ? 1 : 0);
    assert.equal(loadAttendedProgramSignedTerminal(storage, binding(record.action))?.reason ?? null, shouldTerminalize ? "PRE_SEND_FAILURE" : null);
    if (shouldTerminalize) {
      await assert.rejects(withAttendedProgramBroadcastOnce({ locks, storage, attempt: exactAttempt, afterPersist: () => { sent += 1; } }), /terminal/u);
      assert.equal(sent, 0);
    } else {
      assert.equal((await withAttendedProgramBroadcastOnce(options)).status, "ALREADY_RESERVED");
      assert.equal(sent, fault ? 0 : 1);
    }
  }
});

test("terminalization rejects evidence lost after its immediate write readback", () => {
  const storage = memoryStorage();
  const record = fixture();
  persistAttendedProgramSignedPending(storage, record);
  const originalRead = storage.getItem;
  let readsAfterWrite = 0;
  storage.getItem = key => {
    if (key.endsWith("/terminal/v1") && storage.values.has(key)) {
      readsAfterWrite += 1;
      if (readsAfterWrite > 1) return null;
    }
    return originalRead(key);
  };
  assert.throws(() => terminalizeAttendedProgramSignedPending(storage, binding(), "EXPLICIT_DISCARD"), /not retained after readback/u);
  assert.deepEqual(loadAttendedProgramSignedPending(storage, binding()), record);
});

test("an uncommitted terminal disposition is not claimed as durable across reload", async () => {
  for (const fault of ["before", "after", "noop"]) {
    const storage = memoryStorage();
    const record = fixture();
    persistAttendedProgramSignedPending(storage, record);
    const originalWrite = storage.setItem;
    storage.setItem = (key, value) => {
      if (fault === "before") throw new Error("no commit");
      if (fault !== "noop") originalWrite(key, value);
      if (fault === "after") throw new Error("ambiguous commit");
    };
    await assert.rejects(withRetainedAttendedProgramPreSend({ storage, record, callback() { throw new Error("pre-send failed"); } }), /could not be committed/u);
    const result = classifyAttendedProgramRecovery({
      promptLatch: { status: "PROMPT_VERIFIED", messageSha256: record.messageSha256, signer: record.signer },
      signedPending: loadAttendedProgramSignedPending(storage, binding()),
      terminalDisposition: loadAttendedProgramSignedTerminal(storage, binding()),
    });
    assert.equal(result.outcome, fault === "after" ? "HOLD" : "RECOVERABLE");
    // No durable record can assert an intent that never committed. The current
    // UI stays HOLD; recovery of retained bytes is not automatic send authority.
  }
});
