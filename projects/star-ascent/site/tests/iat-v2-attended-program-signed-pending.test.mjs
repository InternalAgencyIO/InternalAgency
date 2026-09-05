import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  Keypair,
  PublicKey,
} from "@solana/web3.js";

import {
  IAT_V2_ATTENDED_PROGRAM_SIGNED_PENDING_SCHEMA,
  loadAttendedProgramSignedPending,
  persistAttendedProgramSignedPending,
  removeAttendedProgramSignedPending,
} from "../tools/iat-v2-admin-console/attended-program-signed-pending.mjs";
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
    () => removeAttendedProgramSignedPending(storage, binding(), "EXPLICIT_DISCARD"),
    /not valid JSON/u,
  );
  assert.equal(storage.values.get(key), "{malformed");
});

test("removal requires one reviewed terminal reason and never touches the prompt latch", () => {
  for (const reason of ["EXPLICIT_DISCARD", "PRE_SEND_FAILURE", "FINALIZED_SUCCESS"]) {
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
    () => removeAttendedProgramSignedPending(badRemove, binding(), "PRE_SEND_FAILURE"),
    /unavailable for removal/u,
  );
  assert.ok(loadAttendedProgramSignedPending(badRemove, binding()));
});
