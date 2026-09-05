import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

import {
  IAT_B3_PRODUCTION_LOOPBACK_ADAPTER_KIND,
  IAT_B3_PRODUCTION_LOOPBACK_TEST_ADAPTER_KIND,
  assertOfficialIatB3ProductionLoopbackAdapter,
  createIatB3ProductionLoopbackAdapter,
  createIatB3ProductionLoopbackJsonRpcTransport,
  decodeIatB3ProductionFixtureState,
  readIatB3ProductionEphemeralSignerFile,
  validateIatB3ProductionLoopbackUrl,
} from "../scripts/lib/iat-b3-production-loopback-adapter.mjs";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const RPC_URL = "http://127.0.0.1:18899/";
const LOADER = "BPFLoaderUpgradeab1e11111111111111111111111";

function key(fill) {
  return new PublicKey(new Uint8Array(32).fill(fill));
}

function base58Encode(bytes) {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let index = 0; index < digits.length; index += 1) {
      carry += digits[index] << 8;
      digits[index] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let output = "";
  for (let index = 0; index < bytes.length - 1 && bytes[index] === 0; index += 1) output += "1";
  for (let index = digits.length - 1; index >= 0; index -= 1) output += alphabet[digits[index]];
  return output;
}

function rpcAccount({ owner, data, executable = false, lamports = 1_000_000, rentEpoch = 0 }) {
  return {
    owner,
    executable,
    lamports,
    rentEpoch,
    data: [Buffer.from(data).toString("base64"), "base64"],
  };
}

function lawBytes() {
  const bytes = Buffer.alloc(160);
  bytes.set(Buffer.from("IATB3S01", "ascii"), 0);
  bytes[8] = 1;
  bytes[9] = 7;
  key(0x11).toBuffer().copy(bytes, 16);
  key(0x12).toBuffer().copy(bytes, 48);
  bytes[10] = 1;
  bytes[11] = 1;
  bytes.writeBigInt64LE(-4n, 80);
  bytes.writeBigUInt64LE(55n, 88);
  Buffer.alloc(32, 0x13).copy(bytes, 96);
  bytes.writeBigUInt64LE(3n, 128);
  bytes.writeUInt16LE(4, 136);
  bytes.writeUInt16LE(5, 138);
  bytes.writeUInt16LE(10, 140);
  return bytes;
}

function configBytes() {
  const bytes = Buffer.alloc(272);
  bytes.set(Buffer.from("IATB3CFG", "ascii"), 0);
  bytes[8] = 1;
  bytes[9] = 2;
  for (let offset = 32, fill = 0x21; offset < 224; offset += 32, fill += 1) {
    key(fill).toBuffer().copy(bytes, offset);
  }
  bytes.writeBigInt64LE(-1n, 224);
  bytes.writeBigUInt64LE(2n, 232);
  bytes.writeBigUInt64LE(3n, 240);
  bytes.writeUInt32LE(4, 248);
  bytes[252] = 0;
  bytes[253] = 1;
  bytes[254] = 0b1_1110;
  bytes[255] = 1;
  bytes[256] = 5;
  bytes[257] = 6;
  return bytes;
}

function laneBytes() {
  const bytes = Buffer.alloc(176);
  bytes.set(Buffer.from("IATB3LAN", "ascii"), 0);
  bytes[8] = 1;
  key(0x31).toBuffer().copy(bytes, 16);
  key(0x32).toBuffer().copy(bytes, 48);
  key(0x33).toBuffer().copy(bytes, 80);
  for (let offset = 112, value = 1n; offset <= 160; offset += 8, value += 1n) {
    bytes.writeBigUInt64LE(value, offset);
  }
  bytes[168] = 4;
  bytes[169] = 1;
  bytes[170] = 8;
  bytes[171] = 9;
  return bytes;
}

function positionBytes() {
  const bytes = Buffer.alloc(176);
  bytes.set(Buffer.from("IATB3POS", "ascii"), 0);
  bytes[8] = 1;
  key(0x41).toBuffer().copy(bytes, 16);
  key(0x42).toBuffer().copy(bytes, 48);
  for (let offset = 80, value = 1n; offset <= 160; offset += 8, value += 1n) {
    bytes.writeBigUInt64LE(value, offset);
  }
  bytes.writeUInt32LE(12, 168);
  bytes[172] = 2;
  bytes[173] = 1;
  bytes[174] = 0;
  bytes[175] = 13;
  return bytes;
}

function eligibilityBytes() {
  const bytes = Buffer.alloc(96);
  bytes.set(Buffer.from("IATB3ELG", "ascii"), 0);
  bytes[8] = 1;
  key(0x51).toBuffer().copy(bytes, 16);
  key(0x52).toBuffer().copy(bytes, 48);
  bytes.writeUInt32LE(15, 80);
  bytes[84] = 1;
  bytes[85] = 16;
  return bytes;
}

function mintBytes() {
  const bytes = Buffer.alloc(82);
  bytes.writeUInt32LE(1, 0);
  key(0x61).toBuffer().copy(bytes, 4);
  bytes.writeBigUInt64LE(1_000n, 36);
  bytes[44] = 9;
  bytes[45] = 1;
  bytes.writeUInt32LE(0, 46);
  return bytes;
}

function tokenBytes() {
  const bytes = Buffer.alloc(165);
  key(0x62).toBuffer().copy(bytes, 0);
  key(0x63).toBuffer().copy(bytes, 32);
  bytes.writeBigUInt64LE(500n, 64);
  bytes.writeUInt32LE(0, 72);
  bytes[108] = 1;
  bytes.writeUInt32LE(0, 109);
  bytes.writeBigUInt64LE(0n, 121);
  bytes.writeUInt32LE(0, 129);
  return bytes;
}

test("loopback URL and raw JSON-RPC transport reject every public/ambiguous route", async () => {
  assert.equal(validateIatB3ProductionLoopbackUrl(RPC_URL), RPC_URL);
  for (const value of [
    "http://localhost:18899/",
    "http://[::1]:18899/",
    "https://127.0.0.1:18899/",
    "http://127.0.0.2:18899/",
    "http://127.0.0.1:18899/path",
    "http://user:pass@127.0.0.1:18899/",
  ]) assert.throws(() => validateIatB3ProductionLoopbackUrl(value), /RPC_LOOPBACK_ONLY_HOLD/u);

  const requests = [];
  const transport = createIatB3ProductionLoopbackJsonRpcTransport({
    rpcUrl: RPC_URL,
    fetchImpl: async (url, request) => {
      requests.push({ url, request });
      const body = JSON.parse(request.body);
      return {
        ok: true,
        url: RPC_URL,
        headers: { get: () => "application/json; charset=utf-8" },
        async text() {
          return JSON.stringify({ jsonrpc: "2.0", id: body.id, result: key(0x01).toBase58() });
        },
      };
    },
  });
  assert.equal(await transport.call("getGenesisHash", []), key(0x01).toBase58());
  assert.equal(requests.length, 1);
  assert.equal(requests[0].request.method, "POST");
  assert.equal(requests[0].request.redirect, "error");
  await assert.rejects(transport.call("requestAirdrop", []), /RPC_METHOD_HOLD/u);

  const lossless = createIatB3ProductionLoopbackJsonRpcTransport({
    rpcUrl: RPC_URL,
    fetchImpl: async () => ({
      ok: true,
      url: RPC_URL,
      headers: { get: () => "application/json" },
      async text() {
        return '{"jsonrpc":"2.0","id":1,"result":{"lamports":18446744073709551615}}';
      },
    }),
  });
  assert.equal((await lossless.call("getAccountInfo", [])).lamports, "18446744073709551615");

  for (const duplicate of [
    '{"jsonrpc":"2.0","jsonrpc":"2.0","id":1,"result":null}',
    '{"jsonrpc":"2.0","id":1,"\\u0069d":1,"result":null}',
    '{"jsonrpc":"2.0","id":1,"result":{"meta":{"fee":1,"fee":2}}}',
  ]) {
    const duplicateTransport = createIatB3ProductionLoopbackJsonRpcTransport({
      rpcUrl: RPC_URL,
      fetchImpl: async () => ({
        ok: true,
        url: RPC_URL,
        headers: { get: () => "application/json" },
        async text() { return duplicate; },
      }),
    });
    await assert.rejects(
      duplicateTransport.call("getGenesisHash", []),
      /RPC_JSON_DUPLICATE_MEMBER_HOLD/u,
    );
  }
});

test("source-derived fixture codecs reject reserved/canonical drift", () => {
  const law = decodeIatB3ProductionFixtureState({
    codec: "LAW_STATE_V1",
    pubkey: key(0x02).toBase58(),
    owner: key(0x03).toBase58(),
    dataBase64: lawBytes().toString("base64"),
  });
  assert.equal(law.decision.locked, true);
  assert.equal(law.decision.localDay, "-4");
  assert.equal(law.decision.entropySlot, "55");

  const config = decodeIatB3ProductionFixtureState({
    codec: "ECONOMY_CONFIG_V1",
    pubkey: key(0x04).toBase58(),
    owner: key(0x05).toBase58(),
    dataBase64: configBytes().toString("base64"),
  });
  assert.equal(config.phase, 2);
  assert.equal(config.active, true);
  assert.equal(config.expectedSupply, "2");

  assert.equal(decodeIatB3ProductionFixtureState({
    codec: "ECONOMY_LANE_V1",
    pubkey: key(0x06).toBase58(),
    owner: key(0x07).toBase58(),
    dataBase64: laneBytes().toString("base64"),
  }).lane, 4);
  assert.equal(decodeIatB3ProductionFixtureState({
    codec: "ECONOMY_POSITION_V1",
    pubkey: key(0x08).toBase58(),
    owner: key(0x09).toBase58(),
    dataBase64: positionBytes().toString("base64"),
  }).closed, false);
  assert.equal(decodeIatB3ProductionFixtureState({
    codec: "ECONOMY_ELIGIBILITY_V1",
    pubkey: key(0x0a).toBase58(),
    owner: key(0x0b).toBase58(),
    dataBase64: eligibilityBytes().toString("base64"),
  }).agencyIndex, 15);

  const mint = decodeIatB3ProductionFixtureState({
    codec: "TOKEN_2022_MINT",
    pubkey: key(0x0c).toBase58(),
    owner: TOKEN_2022_PROGRAM_ID.toBase58(),
    dataBase64: mintBytes().toString("base64"),
  });
  assert.equal(mint.supply, "1000");
  assert.equal(mint.decimals, 9);
  const token = decodeIatB3ProductionFixtureState({
    codec: "TOKEN_2022_ACCOUNT",
    pubkey: key(0x0d).toBase58(),
    owner: TOKEN_2022_PROGRAM_ID.toBase58(),
    dataBase64: tokenBytes().toString("base64"),
  });
  assert.equal(token.amount, "500");

  const drift = laneBytes();
  drift[175] = 1;
  assert.throws(() => decodeIatB3ProductionFixtureState({
    codec: "ECONOMY_LANE_V1",
    pubkey: key(0x0e).toBase58(),
    owner: key(0x0f).toBase58(),
    dataBase64: drift.toString("base64"),
  }), /CODEC_IATB3LAN_RESERVED_HOLD/u);
  assert.throws(() => decodeIatB3ProductionFixtureState({
    codec: "UNSUPPORTED",
    pubkey: key(0x10).toBase58(),
    owner: key(0x11).toBase58(),
    dataBase64: Buffer.alloc(0).toString("base64"),
  }), /FIXTURE_CODEC_UNSUPPORTED_HOLD/u);
  assert.throws(() => decodeIatB3ProductionFixtureState({
    codec: "BYTE_BOUND",
    pubkey: key(0x10).toBase58(),
    owner: key(0x11).toBase58(),
    dataBase64: lawBytes().toString("base64"),
  }), /SEMANTIC_CODEC_REQUIRED_HOLD/u);
  assert.throws(() => decodeIatB3ProductionFixtureState({
    codec: "BYTE_BOUND",
    pubkey: key(0x10).toBase58(),
    owner: TOKEN_2022_PROGRAM_ID.toBase58(),
    dataBase64: mintBytes().toString("base64"),
  }), /TOKEN_2022_CODEC_REQUIRED_HOLD/u);
});

test("program, ProgramData, Genesis, account, and atomic snapshots use injected loopback RPC only", async () => {
  const programId = key(0x21);
  const programDataAddress = PublicKey.findProgramAddressSync(
    [programId.toBuffer()],
    new PublicKey(LOADER),
  )[0];
  const programBytes = Buffer.alloc(36);
  programBytes.writeUInt32LE(2, 0);
  programDataAddress.toBuffer().copy(programBytes, 4);
  const programDataBytes = Buffer.alloc(49);
  programDataBytes.writeUInt32LE(3, 0);
  Buffer.from([0x7f, 0x45, 0x4c, 0x46]).copy(programDataBytes, 45);
  const systemAccount = key(0x22).toBase58();
  const calls = [];
  const transport = {
    rpcUrl: RPC_URL,
    async call(method, params) {
      calls.push([method, params]);
      if (method === "getGenesisHash") return key(0x23).toBase58();
      if (method === "getAccountInfo") {
        const address = params[0];
        const value = address === programId.toBase58()
          ? rpcAccount({ owner: LOADER, data: programBytes, executable: true })
          : address === programDataAddress.toBase58()
            ? rpcAccount({ owner: LOADER, data: programDataBytes })
            : rpcAccount({
              owner: SystemProgram.programId.toBase58(),
              data: Buffer.alloc(0),
              rentEpoch: "18446744073709551615",
            });
        return { context: { slot: 7 }, value };
      }
      if (method === "getMultipleAccounts") {
        return {
          context: { slot: 8 },
          value: params[0].map(() => rpcAccount({
            owner: SystemProgram.programId.toBase58(),
            data: Buffer.alloc(0),
          })),
        };
      }
      throw new Error(`unexpected RPC method ${method}`);
    },
  };
  const adapter = createIatB3ProductionLoopbackAdapter({
    rpcUrl: RPC_URL,
    signerRoot: resolve(ROOT, "tests/fixtures/never-read-signers"),
    signerBindings: [],
    fixtureCodecs: [{ pubkey: systemAccount, codec: "SYSTEM_VACANT" }],
    transport,
  });
  assert.equal(adapter.kind, IAT_B3_PRODUCTION_LOOPBACK_TEST_ADAPTER_KIND);
  const sourceBoundInput = {
    rpc: { url: RPC_URL },
    executionBoundary: {
      ephemeralSignerDirectory: resolve(ROOT, "tests/fixtures/never-read-signers"),
    },
  };
  const sourceBoundPlan = {
    signers: [],
    accountFixtures: [{ pubkey: systemAccount, codec: "SYSTEM_VACANT" }],
  };
  await adapter.assertExecutionPlanBinding({
    executionPlan: sourceBoundPlan,
    input: sourceBoundInput,
  });
  await assert.rejects(adapter.assertExecutionPlanBinding({
    executionPlan: {
      ...sourceBoundPlan,
      accountFixtures: [{ pubkey: systemAccount, codec: "BYTE_BOUND" }],
    },
    input: sourceBoundInput,
  }), /EXECUTION_PLAN_BINDING_HOLD/u);
  assert.equal(calls.length, 0);
  assert.equal(await adapter.observeGenesisHash(), key(0x23).toBase58());
  const deployment = await adapter.observeProgramDeployment(programId.toBase58());
  assert.equal(deployment.programDataAddress, programDataAddress.toBase58());
  assert.equal(deployment.programDataBase64, programDataBytes.toString("base64"));
  const observed = await adapter.observeAccount(systemAccount);
  assert.equal(observed.rentEpoch, "18446744073709551615");
  assert.deepEqual(await adapter.decodeFixtureState({ ...observed, codec: "SYSTEM_VACANT" }), {
    codec: "SYSTEM_VACANT",
    dataLength: 0,
  });
  const snapshot = await adapter.snapshotAccounts([systemAccount]);
  assert.equal(snapshot.length, 1);
  assert.equal(snapshot[0].pubkey, systemAccount);
  assert.deepEqual(calls.map(([method]) => method), [
    "getGenesisHash",
    "getAccountInfo",
    "getAccountInfo",
    "getAccountInfo",
    "getMultipleAccounts",
  ]);
  assert.equal(calls[2][1][1].minContextSlot, 7);
});

test("signer bytes load late through injection, derive dynamically, sign loopback, and zeroize", async () => {
  const payer = Keypair.fromSeed(new Uint8Array(32).fill(0x31));
  const destination = key(0x32);
  const signerRaw = Buffer.from(`[${[...payer.secretKey].join(",")}]\n`, "ascii");
  let capturedSerialized = null;
  const blockhash = key(0x33).toBase58();
  const transport = {
    rpcUrl: RPC_URL,
    async call(method, params) {
      if (method === "getLatestBlockhash") {
        return { context: { slot: 10 }, value: { blockhash, lastValidBlockHeight: 20 } };
      }
      if (method === "sendTransaction") {
        capturedSerialized = Buffer.from(params[0], "base64");
        const transaction = Transaction.from(capturedSerialized);
        return base58Encode(transaction.signatures[0].signature);
      }
      if (method === "getSignatureStatuses") {
        return { value: [{ confirmationStatus: "confirmed", err: null }] };
      }
      if (method === "getTransaction") {
        const transaction = Transaction.from(capturedSerialized);
        const accountKeys = transaction.compileMessage().accountKeys.map((value) => value.toBase58());
        return {
          slot: 11,
          transaction: [capturedSerialized.toString("base64"), "base64"],
          meta: {
            err: null,
            fee: 5000,
            logMessages: ["Program log: exact"],
            innerInstructions: [{
              index: 0,
              instructions: [{
                programIdIndex: accountKeys.indexOf(SystemProgram.programId.toBase58()),
                accounts: [
                  accountKeys.indexOf(payer.publicKey.toBase58()),
                  accountKeys.indexOf(destination.toBase58()),
                ],
                data: base58Encode(Buffer.from([1, 2, 3])),
              }],
            }],
          },
        };
      }
      throw new Error(`unexpected RPC method ${method}`);
    },
  };
  const adapter = createIatB3ProductionLoopbackAdapter({
    rpcUrl: RPC_URL,
    signerRoot: resolve(ROOT, "tests/fixtures/never-read-signers"),
    signerBindings: [{
      role: "payer",
      path: resolve(ROOT, "tests/fixtures/never-read-signers/payer.json"),
      expectedPubkey: payer.publicKey.toBase58(),
    }],
    fixtureCodecs: [],
    transport,
    readSignerFile: async () => signerRaw,
    confirmationDelay: async () => {},
  });
  const secret = await adapter.loadEphemeralSignerBytes({
    role: "payer",
    expectedPubkey: payer.publicKey.toBase58(),
  });
  assert.ok(signerRaw.every((byte) => byte === 0));
  assert.equal(await adapter.deriveEphemeralSignerPublicKey({
    role: "payer",
    expectedPubkey: payer.publicKey.toBase58(),
    secret,
  }), payer.publicKey.toBase58());
  secret.fill(0);
  const observation = await adapter.executeTransaction({
    caseId: "opcode-5",
    instructions: [SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: destination,
      lamports: 1,
    })],
    signerRoles: ["payer"],
    feePayer: payer.publicKey.toBase58(),
  });
  assert.equal(observation.errorCode, null);
  assert.equal(observation.feeLamports, "5000");
  assert.equal(observation.submittedMessageSha256, observation.landedMessageSha256);
  assert.equal(observation.submittedTransactionSha256, observation.landedTransactionSha256);
  assert.equal(observation.innerCpi[0].programId, SystemProgram.programId.toBase58());
  assert.equal(observation.innerCpi[0].instructionIndex, 0);
  await adapter.disposeEphemeralSigners();
  await assert.rejects(adapter.deriveEphemeralSignerPublicKey({
    role: "payer",
    expectedPubkey: payer.publicKey.toBase58(),
    secret: Uint8Array.from(payer.secretKey),
  }), /SIGNER_DERIVATION_BINDING_HOLD/u);
  await assert.rejects(
    adapter.executeTransaction({
      caseId: "after-dispose",
      instructions: [SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: destination,
        lamports: 1,
      })],
      signerRoles: ["payer"],
      feePayer: payer.publicKey.toBase58(),
    }),
    /EXECUTION_SIGNERS_HOLD/u,
  );
});

test("loopback RPC cannot substitute the local signature or landed transaction bytes", async () => {
  const run = async ({
    substituteSignature = false,
    substituteMessage = false,
    throwAt = null,
  } = {}) => {
    const payer = Keypair.fromSeed(new Uint8Array(32).fill(0x41));
    const destination = key(0x42);
    let capturedSerialized = null;
    const transport = {
      rpcUrl: RPC_URL,
      async call(method, params) {
        if (method === throwAt) throw new Error(`TRANSPORT_THROW:${method}`);
        if (method === "getLatestBlockhash") {
          return {
            context: { slot: 10 },
            value: { blockhash: key(0x43).toBase58(), lastValidBlockHeight: 20 },
          };
        }
        if (method === "sendTransaction") {
          capturedSerialized = Buffer.from(params[0], "base64");
          return substituteSignature
            ? base58Encode(Buffer.alloc(64, 0x7f))
            : base58Encode(Transaction.from(capturedSerialized).signatures[0].signature);
        }
        if (method === "getSignatureStatuses") {
          return { value: [{ confirmationStatus: "confirmed", err: null }] };
        }
        if (method === "getTransaction") {
          let landed = Buffer.from(capturedSerialized);
          if (substituteMessage) {
            const transaction = Transaction.from(landed);
            transaction.recentBlockhash = key(0x44).toBase58();
            landed = transaction.serialize({
              requireAllSignatures: false,
              verifySignatures: false,
            });
          }
          return {
            slot: 11,
            transaction: [landed.toString("base64"), "base64"],
            meta: {
              err: null,
              fee: 5000,
              logMessages: [],
              innerInstructions: [],
            },
          };
        }
        throw new Error(`unexpected RPC method ${method}`);
      },
    };
    const adapter = createIatB3ProductionLoopbackAdapter({
      rpcUrl: RPC_URL,
      signerRoot: resolve(ROOT, "tests/fixtures/never-read-signers"),
      signerBindings: [{
        role: "payer",
        path: resolve(ROOT, "tests/fixtures/never-read-signers/payer.json"),
        expectedPubkey: payer.publicKey.toBase58(),
      }],
      fixtureCodecs: [],
      transport,
      readSignerFile: async () => Buffer.from(`[${[...payer.secretKey].join(",")}]\n`, "ascii"),
      confirmationDelay: async () => {},
    });
    const secret = await adapter.loadEphemeralSignerBytes({
      role: "payer",
      expectedPubkey: payer.publicKey.toBase58(),
    });
    await adapter.deriveEphemeralSignerPublicKey({
      role: "payer",
      expectedPubkey: payer.publicKey.toBase58(),
      secret,
    });
    secret.fill(0);
    try {
      await adapter.executeTransaction({
        caseId: "binding-adversarial",
        instructions: [SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: destination,
          lamports: 1,
        })],
        signerRoles: ["payer"],
        feePayer: payer.publicKey.toBase58(),
      });
    } finally {
      await adapter.disposeEphemeralSigners();
    }
  };

  await assert.rejects(run({ substituteSignature: true }), /TRANSACTION_SIGNATURE_HOLD/u);
  await assert.rejects(run({ substituteMessage: true }), /LANDED_TRANSACTION_BINDING_HOLD/u);
  await assert.rejects(
    run({ throwAt: "getSignatureStatuses" }),
    /TRANSPORT_THROW:getSignatureStatuses/u,
  );
  const source = readFileSync(
    resolve(ROOT, "scripts/lib/iat-b3-production-loopback-adapter.mjs"),
    "utf8",
  );
  assert.match(
    source,
    /finally\s*\{[\s\S]*serialized\.fill\(0\);[\s\S]*message\.fill\(0\);[\s\S]*landedBytes\?\.fill\(0\);[\s\S]*landedMessage\?\.fill\(0\);/u,
  );
});

test("signer reader rejects a path swapped after opening the original file descriptor", () => {
  const signerRoot = resolve(ROOT, "tests/fixtures/never-read-signers");
  const signerPath = resolve(signerRoot, "payer.json");
  const raw = Buffer.from(`[${Array(64).fill(0).join(",")}]\n`, "ascii");
  const stat = (ino) => ({
    dev: 1,
    ino,
    size: raw.length,
    mtimeMs: 1,
    isFile: () => true,
    isSymbolicLink: () => false,
  });
  let lstatCalls = 0;
  let closed = false;
  const fileSystem = {
    realpath: (path) => path,
    lstat: () => stat(lstatCalls += 1),
    open: () => 7,
    fstat: () => stat(1),
    read: (descriptor, bytes, offset, length) => {
      assert.equal(descriptor, 7);
      raw.copy(bytes, offset, offset, offset + length);
      return length;
    },
    close: (descriptor) => {
      assert.equal(descriptor, 7);
      closed = true;
    },
  };
  assert.throws(
    () => readIatB3ProductionEphemeralSignerFile({ path: signerPath }, signerRoot, fileSystem),
    /SIGNER_FILE_RACE_HOLD/u,
  );
  assert.equal(closed, true);
});

test("official adapter source has no validator spawn, airdrop, public endpoint, or CLI run path", () => {
  const sourceBound = createIatB3ProductionLoopbackAdapter({
    rpcUrl: RPC_URL,
    signerRoot: resolve(ROOT, "tests/fixtures/never-read-signers"),
    signerBindings: [],
    fixtureCodecs: [],
  });
  assert.equal(sourceBound.kind, IAT_B3_PRODUCTION_LOOPBACK_ADAPTER_KIND);
  assert.equal(assertOfficialIatB3ProductionLoopbackAdapter(sourceBound), sourceBound);
  assert.throws(
    () => assertOfficialIatB3ProductionLoopbackAdapter({
      kind: IAT_B3_PRODUCTION_LOOPBACK_ADAPTER_KIND,
    }),
    /OFFICIAL_ADAPTER_BRAND_HOLD/u,
  );
  const adapterSource = readFileSync(
    resolve(ROOT, "scripts/lib/iat-b3-production-loopback-adapter.mjs"),
    "utf8",
  );
  const driverSource = readFileSync(
    resolve(ROOT, "scripts/iat-b3-production-local-rehearsal-driver.mjs"),
    "utf8",
  );
  const contractDoc = readFileSync(
    resolve(ROOT, "docs/b3/IAT_B3_PRODUCTION_LOCAL_REHEARSAL_CONTRACT.md"),
    "utf8",
  );
  assert.doesNotMatch(adapterSource, /solana-test-validator|requestAirdrop|api\.mainnet-beta|api\.devnet/u);
  assert.doesNotMatch(adapterSource, /spawn(?:Sync)?\s*\(/u);
  assert.match(adapterSource, /hostname !== "127\.0\.0\.1"/u);
  assert.match(adapterSource, /testOnlyInjection[\s\S]*TEST_ADAPTER_KIND/u);
  assert.match(adapterSource, new RegExp(IAT_B3_PRODUCTION_LOOPBACK_ADAPTER_KIND, "u"));
  assert.match(adapterSource, /skipPreflight: false/u);
  assert.match(adapterSource, /searchTransactionHistory: true/u);
  assert.doesNotMatch(driverSource, /production-loopback-adapter|--run|sendTransaction/u);
  assert.match(contractDoc, /validatorGenesisHash[\s\S]*must differ from `compiledLawDomainGenesisHash`/u);
  assert.match(contractDoc, /DailyLawRejected` \(`0xE503`\)/u);
  assert.match(contractDoc, /disposable Devnet build may be used for behavioral rehearsal only/u);
});
