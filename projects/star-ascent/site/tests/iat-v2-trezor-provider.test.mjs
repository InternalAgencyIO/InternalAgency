import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { Buffer } from "buffer";
import {
  Keypair,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  createTrezorTransactionProvider,
  findTrezorSolanaAccount,
  IAT_V2_TREZOR_PREPARED_SIGNING_MAX_AGE_MS,
  TREZOR_SOLANA_NETWORK_GENESIS_HASHES,
  verifyTrezorSolanaAccountOnDevice,
} from "../tools/iat-v2-admin-console/trezor-provider.mjs";
import {
  IAT_V2_ATTENDED_PROMPT_GLOBAL_LOCK_NAME,
  attendedPromptLatchKey,
  createAttendedModelTPromptCoordinator,
  loadAttendedModelTPromptLatch,
} from "../tools/iat-v2-admin-console/attended-prompt-coordinator.mjs";
import {
  assertExactTransactionMessage,
  assertFreshProgramPromptBlockhashWindow,
} from "../tools/iat-v2-admin-console/attended-transaction-boundary.mjs";

const devnetGenesis = () => TREZOR_SOLANA_NETWORK_GENESIS_HASHES.devnet;
const mainnetGenesis = () => TREZOR_SOLANA_NETWORK_GENESIS_HASHES["mainnet-beta"];
const DEFAULT_PATH = "m/44'/501'/0'/0'";

function solanaEntry(publicKey, path = DEFAULT_PATH) {
  const accountIndex = Number.parseInt(path.split("/")[3], 10);
  return {
    publicKey: Buffer.from(publicKey.toBytes()).toString("hex"),
    publicKeyBase58: publicKey.toBase58(),
    displayablePublicKey: publicKey.toBase58(),
    path: [
      0x8000002c,
      0x800001f5,
      (0x80000000 + accountIndex) >>> 0,
      0x80000000,
    ],
    serializedPath: path,
  };
}

async function createMockVerification({
  connect,
  publicKey,
  path = DEFAULT_PATH,
}) {
  connect.solanaGetPublicKey = async (request) => {
    assert.deepEqual(request, { path, showOnTrezor: true });
    return { success: true, payload: solanaEntry(publicKey, path) };
  };
  return verifyTrezorSolanaAccountOnDevice({
    connect,
    account: { path, publicKey },
    expectedAddress: publicKey,
  });
}

async function createMockVerifiedProvider({
  connect,
  publicKey,
  path = DEFAULT_PATH,
  network,
  readGenesisHash,
  monotonicNow,
}) {
  const verification = await createMockVerification({ connect, publicKey, path });
  return createTrezorTransactionProvider({
    connect,
    verification,
    network,
    readGenesisHash,
    monotonicNow,
  });
}

test("direct Trezor adapter preserves top-level Connect error details", async () => {
  const signer = Keypair.generate().publicKey;
  let requestCount = 0;
  await assert.rejects(
    verifyTrezorSolanaAccountOnDevice({
      connect: {
        async solanaGetPublicKey(request) {
          requestCount += 1;
          assert.deepEqual(request, { path: DEFAULT_PATH, showOnTrezor: true });
          return {
            success: false,
            error: {
              code: "Transport_Missing",
              message: "Trezor transport is unavailable",
            },
          };
        },
      },
      account: { path: DEFAULT_PATH, publicKey: signer },
      expectedAddress: signer,
    }),
    /Trezor Solana address display failed \(Transport_Missing\): Trezor transport is unavailable/,
  );
  assert.equal(requestCount, 1);
});

test("direct Trezor adapter retains legacy errors and fails closed on malformed errors", async () => {
  const signer = Keypair.generate().publicKey;
  const verifyFailure = (result) => verifyTrezorSolanaAccountOnDevice({
    connect: { async solanaGetPublicKey() { return result; } },
    account: { path: DEFAULT_PATH, publicKey: signer },
    expectedAddress: signer,
  });

  await assert.rejects(
    verifyFailure({
      success: false,
      payload: { code: "Device_NotFound", error: "Device not found" },
    }),
    /Trezor Solana address display failed \(Device_NotFound\): Device not found/,
  );
  await assert.rejects(
    verifyFailure({ success: false, error: {} }),
    /Trezor Solana address display failed: Unknown Trezor error/,
  );
});

test("direct Trezor adapter finds the exact account and offline-verifies a mocked Devnet-bound signature", async () => {
  const signer = Keypair.generate();
  const recipient = Keypair.generate().publicKey;
  const decoy = Keypair.generate().publicKey;
  const path = "m/44'/501'/3'/0'";
  let signRequest;
  const connect = {
    async solanaGetPublicKey(request) {
      if (request.showOnTrezor === true) {
        assert.deepEqual(request, { path, showOnTrezor: true });
        return { success: true, payload: solanaEntry(signer.publicKey, path) };
      }
      const { bundle } = request;
      assert.equal(bundle.length, 2);
      return {
        success: true,
        payload: [
          {
            publicKey: Buffer.from(decoy.toBytes()).toString("hex"),
            publicKeyBase58: decoy.toBase58(),
            displayablePublicKey: decoy.toBase58(),
            path: [0x8000002c, 0x800001f5, 0x80000000, 0x80000000],
            serializedPath: bundle[0].path,
          },
          {
            publicKey: Buffer.from(signer.publicKey.toBytes()).toString("hex"),
            publicKeyBase58: signer.publicKey.toBase58(),
            displayablePublicKey: signer.publicKey.toBase58(),
            path: [0x8000002c, 0x800001f5, 0x80000003, 0x80000000],
            serializedPath: bundle[1].path,
          },
        ],
      };
    },
    async solanaSignTransaction(request) {
      signRequest = request;
      const transaction = Transaction.from(Buffer.from(request.serializedTx, "hex"));
      transaction.partialSign(signer);
      const signature = transaction.signatures.find(({ publicKey }) => publicKey.equals(signer.publicKey));
      return {
        success: true,
        payload: {
          signature: Buffer.from(signature.signature).toString("hex"),
          serializedTx: Buffer.from(transaction.serialize()).toString("hex"),
        },
      };
    },
  };
  const account = await findTrezorSolanaAccount({
    connect,
    expectedAddress: signer.publicKey,
    paths: ["m/44'/501'/0'/0'", path],
  });
  assert.equal(account.path, path);
  const verification = await verifyTrezorSolanaAccountOnDevice({
    connect,
    account,
    expectedAddress: signer.publicKey,
  });
  const provider = createTrezorTransactionProvider({
    connect,
    verification,
    network: "devnet",
    readGenesisHash: devnetGenesis,
  });
  const unsigned = new Transaction({
    feePayer: signer.publicKey,
    recentBlockhash: Keypair.generate().publicKey.toBase58(),
  }).add(SystemProgram.transfer({
    fromPubkey: signer.publicKey,
    toPubkey: recipient,
    lamports: 1,
  }));
  const signed = await provider.signTransaction(unsigned);
  assert.equal(signRequest.path, path);
  assert.equal(signRequest.serialize, true);
  assert.deepEqual(signRequest.additionalInfo, { isDevnet: true });
  assert.equal(
    Buffer.from(signed.serializeMessage()).toString("hex"),
    Buffer.from(unsigned.serializeMessage()).toString("hex"),
  );
  assert.equal(signed.verifySignatures(), true);
});

test("direct Trezor adapter fails closed when the expected address is absent", async () => {
  const expected = Keypair.generate().publicKey;
  const other = Keypair.generate().publicKey;
  await assert.rejects(
    findTrezorSolanaAccount({
      connect: {
        async solanaGetPublicKey() {
          return {
            success: true,
            payload: [{
              publicKey: Buffer.from(other.toBytes()).toString("hex"),
              publicKeyBase58: other.toBase58(),
              displayablePublicKey: other.toBase58(),
              path: [0x8000002c, 0x800001f5, 0x80000000, 0x80000000],
              serializedPath: "m/44'/501'/0'/0'",
            }],
          };
        },
      },
      expectedAddress: expected,
      paths: ["m/44'/501'/0'/0'"],
    }),
    new RegExp(`Required signer ${expected.toBase58()} was not found`),
  );
});

test("direct Trezor adapter rejects response reordering and inconsistent key encodings", async () => {
  const expected = Keypair.generate().publicKey;
  const other = Keypair.generate().publicKey;
  await assert.rejects(
    findTrezorSolanaAccount({
      connect: {
        async solanaGetPublicKey() {
          return {
            success: true,
            payload: [{
              publicKey: Buffer.from(expected.toBytes()).toString("hex"),
              publicKeyBase58: expected.toBase58(),
              displayablePublicKey: expected.toBase58(),
              path: [0x8000002c, 0x800001f5, 0x80000001, 0x80000000],
              serializedPath: "m/44'/501'/1'/0'",
            }],
          };
        },
      },
      expectedAddress: expected,
      paths: ["m/44'/501'/0'/0'"],
    }),
    /unexpected derivation path/,
  );
  await assert.rejects(
    findTrezorSolanaAccount({
      connect: {
        async solanaGetPublicKey() {
          return {
            success: true,
            payload: [{
              publicKey: Buffer.from(other.toBytes()).toString("hex"),
              publicKeyBase58: expected.toBase58(),
              displayablePublicKey: expected.toBase58(),
              path: [0x8000002c, 0x800001f5, 0x80000000, 0x80000000],
              serializedPath: "m/44'/501'/0'/0'",
            }],
          };
        },
      },
      expectedAddress: expected,
      paths: ["m/44'/501'/0'/0'"],
    }),
    /inconsistent Solana public-key encodings/,
  );
});

test("direct Trezor adapter rejects incomplete or incoherent account response shapes", async () => {
  const expected = Keypair.generate().publicKey;
  const baseEntry = {
    publicKey: Buffer.from(expected.toBytes()).toString("hex"),
    publicKeyBase58: expected.toBase58(),
    displayablePublicKey: expected.toBase58(),
    path: [0x8000002c, 0x800001f5, 0x80000000, 0x80000000],
    serializedPath: "m/44'/501'/0'/0'",
  };
  const discover = (entry) => findTrezorSolanaAccount({
    connect: { async solanaGetPublicKey() { return { success: true, payload: [entry] }; } },
    expectedAddress: expected,
    paths: ["m/44'/501'/0'/0'"],
  });

  await assert.rejects(discover({ ...baseEntry, path: undefined }), /numeric and serialized/);
  await assert.rejects(
    discover({ ...baseEntry, path: [0x8000002c, 0x800001f5, 0x80000009, 0x80000000] }),
    /numeric and serialized/,
  );
  await assert.rejects(discover({ ...baseEntry, displayablePublicKey: "wrong" }), /displayable/);
  await assert.rejects(
    findTrezorSolanaAccount({
      connect: { async solanaGetPublicKey() { return { success: true, payload: [] }; } },
      expectedAddress: expected,
      paths: ["m/44'/501'/0'/0'"],
    }),
    /different number/,
  );
});

test("direct Trezor adapter rejects a valid expected-key signature over a substituted message", async () => {
  const signer = Keypair.generate();
  const requestedRecipient = Keypair.generate().publicKey;
  const substitutedRecipient = Keypair.generate().publicKey;
  const connect = {
    async solanaSignTransaction(request) {
      const requested = Transaction.from(Buffer.from(request.serializedTx, "hex"));
      const substituted = new Transaction({
        feePayer: requested.feePayer,
        recentBlockhash: requested.recentBlockhash,
      }).add(SystemProgram.transfer({
        fromPubkey: signer.publicKey,
        toPubkey: substitutedRecipient,
        lamports: 1,
      }));
      substituted.partialSign(signer);
      const signature = substituted.signatures.find(({ publicKey }) => publicKey.equals(signer.publicKey));
      return {
        success: true,
        payload: {
          signature: Buffer.from(signature.signature).toString("hex"),
          serializedTx: Buffer.from(substituted.serialize()).toString("hex"),
        },
      };
    },
  };
  const provider = await createMockVerifiedProvider({
    connect,
    publicKey: signer.publicKey,
    network: "devnet",
    readGenesisHash: devnetGenesis,
  });
  const requested = new Transaction({
    feePayer: signer.publicKey,
    recentBlockhash: Keypair.generate().publicKey.toBase58(),
  }).add(SystemProgram.transfer({
    fromPubkey: signer.publicKey,
    toPubkey: requestedRecipient,
    lamports: 1,
  }));

  await assert.rejects(
    provider.signTransaction(requested),
    /different Solana transaction message/,
  );
});

test("direct Trezor adapter rejects forged bytes in the expected signer slot", async () => {
  const signer = Keypair.generate();
  const recipient = Keypair.generate().publicKey;
  const connect = {
    async solanaSignTransaction(request) {
      const transaction = Transaction.from(Buffer.from(request.serializedTx, "hex"));
      const forgedSignature = Buffer.alloc(64, 0x5a);
      transaction.addSignature(signer.publicKey, forgedSignature);
      return {
        success: true,
        payload: {
          signature: forgedSignature.toString("hex"),
          serializedTx: Buffer.from(transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false,
          })).toString("hex"),
        },
      };
    },
  };
  const provider = await createMockVerifiedProvider({
    connect,
    publicKey: signer.publicKey,
    network: "devnet",
    readGenesisHash: devnetGenesis,
  });
  const requested = new Transaction({
    feePayer: signer.publicKey,
    recentBlockhash: Keypair.generate().publicKey.toBase58(),
  }).add(SystemProgram.transfer({
    fromPubkey: signer.publicKey,
    toPubkey: recipient,
    lamports: 1,
  }));

  await assert.rejects(
    provider.signTransaction(requested),
    /failed cryptographic verification/,
  );
});

test("direct Trezor adapter preserves every pre-existing non-Trezor cosigner slot", async () => {
  const signer = Keypair.generate();
  const feePayer = Keypair.generate();
  const transaction = new Transaction({
    feePayer: feePayer.publicKey,
    recentBlockhash: Keypair.generate().publicKey.toBase58(),
  }).add(SystemProgram.transfer({
    fromPubkey: signer.publicKey,
    toPubkey: Keypair.generate().publicKey,
    lamports: 1,
  }));
  transaction.partialSign(feePayer);
  const originalFeePayerSignature = Buffer.from(
    transaction.signatures.find(({ publicKey }) => publicKey.equals(feePayer.publicKey)).signature,
  );
  const connect = {
    async solanaSignTransaction(request) {
      const signed = Transaction.from(Buffer.from(request.serializedTx, "hex"));
      signed.partialSign(signer);
      const signature = signed.signatures.find(({ publicKey }) => publicKey.equals(signer.publicKey));
      return {
        success: true,
        payload: {
          signature: Buffer.from(signature.signature).toString("hex"),
          serializedTx: Buffer.from(signed.serialize()).toString("hex"),
        },
      };
    },
  };
  const provider = await createMockVerifiedProvider({
    connect,
    publicKey: signer.publicKey,
    network: "devnet",
    readGenesisHash: devnetGenesis,
  });

  const signed = await provider.signTransaction(transaction);
  assert.equal(signed.verifySignatures(), true);
  assert.deepEqual(
    Buffer.from(signed.signatures.find(({ publicKey }) => publicKey.equals(feePayer.publicKey)).signature),
    originalFeePayerSignature,
  );
});

test("direct Trezor adapter rejects dropped or injected non-Trezor cosigner signatures", async () => {
  const signer = Keypair.generate();
  const feePayer = Keypair.generate();
  const makeTransaction = (signFeePayer) => {
    const transaction = new Transaction({
      feePayer: feePayer.publicKey,
      recentBlockhash: Keypair.generate().publicKey.toBase58(),
    }).add(SystemProgram.transfer({
      fromPubkey: signer.publicKey,
      toPubkey: Keypair.generate().publicKey,
      lamports: 1,
    }));
    if (signFeePayer) transaction.partialSign(feePayer);
    return transaction;
  };
  const providerForMutation = async (mutate) => {
    const connect = {
      async solanaSignTransaction(request) {
        const signed = Transaction.from(Buffer.from(request.serializedTx, "hex"));
        signed.partialSign(signer);
        mutate(signed);
        const signature = signed.signatures.find(({ publicKey }) => publicKey.equals(signer.publicKey));
        return {
          success: true,
          payload: {
            signature: Buffer.from(signature.signature).toString("hex"),
            serializedTx: Buffer.from(signed.serialize({
              requireAllSignatures: false,
              verifySignatures: false,
            })).toString("hex"),
          },
        };
      },
    };
    return createMockVerifiedProvider({
      connect,
      publicKey: signer.publicKey,
      network: "devnet",
      readGenesisHash: devnetGenesis,
    });
  };
  const dropProvider = await providerForMutation((signed) => {
    signed.signatures.find(({ publicKey }) => publicKey.equals(feePayer.publicKey)).signature = null;
  });
  await assert.rejects(
    dropProvider.signTransaction(makeTransaction(true)),
    /changed a non-Trezor cosigner signature slot/,
  );
  const injectProvider = await providerForMutation((signed) => signed.partialSign(feePayer));
  await assert.rejects(
    injectProvider.signTransaction(makeTransaction(false)),
    /changed a non-Trezor cosigner signature slot/,
  );
});

test("direct Trezor adapter requires an explicit supported network", async () => {
  const signer = Keypair.generate().publicKey;
  const connect = {};
  const verification = await createMockVerification({ connect, publicKey: signer });
  assert.throws(
    () => createTrezorTransactionProvider({
      connect,
      verification,
      readGenesisHash: devnetGenesis,
    }),
    /explicit devnet or mainnet-beta network/,
  );
  assert.throws(
    () => createTrezorTransactionProvider({
      connect,
      verification,
      network: "testnet",
      readGenesisHash: devnetGenesis,
    }),
    /explicit devnet or mainnet-beta network/,
  );
});

test("direct Trezor adapter rejects unbranded evidence and cross-Connect capability reuse", async () => {
  const signer = Keypair.generate().publicKey;
  const connect = {};
  const verification = await createMockVerification({ connect, publicKey: signer });
  assert.throws(
    () => createTrezorTransactionProvider({
      connect,
      verification: Object.freeze({
        ...verification,
        verifiedOnDevice: true,
      }),
      network: "devnet",
      readGenesisHash: devnetGenesis,
    }),
    /genuine on-device verification capability/u,
  );
  assert.throws(
    () => createTrezorTransactionProvider({
      connect: { ...connect },
      verification,
      network: "devnet",
      readGenesisHash: devnetGenesis,
    }),
    /bound to a different Connect session/u,
  );
});

test("direct Trezor adapter labels mainnet-beta explicitly to the device", async () => {
  const signer = Keypair.generate();
  let signRequest;
  const connect = {
    async solanaSignTransaction(request) {
      signRequest = request;
      const transaction = Transaction.from(Buffer.from(request.serializedTx, "hex"));
      transaction.partialSign(signer);
      const signature = transaction.signatures.find(({ publicKey }) => publicKey.equals(signer.publicKey));
      return {
        success: true,
        payload: {
          signature: Buffer.from(signature.signature).toString("hex"),
          serializedTx: Buffer.from(transaction.serialize()).toString("hex"),
        },
      };
    },
  };
  const provider = await createMockVerifiedProvider({
    connect,
    publicKey: signer.publicKey,
    network: "mainnet-beta",
    readGenesisHash: mainnetGenesis,
  });
  const transaction = new Transaction({
    feePayer: signer.publicKey,
    recentBlockhash: Keypair.generate().publicKey.toBase58(),
  }).add(SystemProgram.transfer({
    fromPubkey: signer.publicKey,
    toPubkey: Keypair.generate().publicKey,
    lamports: 1,
  }));

  await provider.signTransaction(transaction);
  assert.deepEqual(signRequest.additionalInfo, { isDevnet: false });
});

test("direct Trezor adapter rejects an RPC Genesis mismatch before the device prompt", async () => {
  const signer = Keypair.generate();
  let promptCount = 0;
  const connect = {
    async solanaSignTransaction() {
      promptCount += 1;
      throw new Error("must not prompt");
    },
  };
  const provider = await createMockVerifiedProvider({
    connect,
    publicKey: signer.publicKey,
    network: "mainnet-beta",
    readGenesisHash: devnetGenesis,
  });
  const transaction = new Transaction({
    feePayer: signer.publicKey,
    recentBlockhash: Keypair.generate().publicKey.toBase58(),
  }).add(SystemProgram.transfer({
    fromPubkey: signer.publicKey,
    toPubkey: Keypair.generate().publicKey,
    lamports: 1,
  }));

  await assert.rejects(provider.signTransaction(transaction), /canonical mainnet-beta/);
  assert.equal(promptCount, 0);
});

test("prepared Devnet signing verifies Genesis before the one-use device boundary", async () => {
  const signer = Keypair.generate();
  let genesisReads = 0;
  let promptCount = 0;
  const connect = {
    async solanaSignTransaction(request) {
      promptCount += 1;
      const signed = Transaction.from(Buffer.from(request.serializedTx, "hex"));
      signed.partialSign(signer);
      const signature = signed.signatures.find(({ publicKey }) => publicKey.equals(signer.publicKey));
      return {
        success: true,
        payload: {
          signature: Buffer.from(signature.signature).toString("hex"),
          serializedTx: Buffer.from(signed.serialize()).toString("hex"),
        },
      };
    },
  };
  const times = [100, 101];
  const provider = await createMockVerifiedProvider({
    connect,
    publicKey: signer.publicKey,
    network: "devnet",
    readGenesisHash: async () => {
      genesisReads += 1;
      return devnetGenesis();
    },
    monotonicNow: () => times.shift(),
  });
  const transaction = new Transaction({
    feePayer: signer.publicKey,
    recentBlockhash: Keypair.generate().publicKey.toBase58(),
  }).add(SystemProgram.transfer({
    fromPubkey: signer.publicKey,
    toPubkey: Keypair.generate().publicKey,
    lamports: 1,
  }));

  const capability = await provider.prepareDevnetTransactionSigning(transaction);
  assert.equal(genesisReads, 1);
  assert.equal(promptCount, 0);
  const signed = await provider.signPreparedDevnetTransaction(transaction, capability);
  assert.equal(signed.verifySignatures(), true);
  assert.equal(genesisReads, 1, "prepared signing must not perform a post-admission Genesis read");
  assert.equal(promptCount, 1);
  await assert.rejects(
    provider.signPreparedDevnetTransaction(transaction, capability),
    /already consumed/u,
  );
  assert.equal(promptCount, 1);
});

test("prepared Devnet signing capability rejects substitution, cross-provider use, and staleness", async () => {
  assert.equal(IAT_V2_TREZOR_PREPARED_SIGNING_MAX_AGE_MS, 10_000);
  const signer = Keypair.generate();
  let promptCount = 0;
  const connect = {
    async solanaSignTransaction() {
      promptCount += 1;
      throw new Error("must not prompt");
    },
  };
  const verification = await createMockVerification({ connect, publicKey: signer.publicKey });
  const makeProvider = (monotonicNow) => createTrezorTransactionProvider({
    connect,
    verification,
    network: "devnet",
    readGenesisHash: devnetGenesis,
    monotonicNow,
  });
  const makeTransaction = () => new Transaction({
    feePayer: signer.publicKey,
    recentBlockhash: Keypair.generate().publicKey.toBase58(),
  }).add(SystemProgram.transfer({
    fromPubkey: signer.publicKey,
    toPubkey: Keypair.generate().publicKey,
    lamports: 1,
  }));

  const provider = makeProvider(() => 100);
  const crossProvider = makeProvider(() => 100);
  const original = makeTransaction();
  const crossCapability = await provider.prepareDevnetTransactionSigning(original);
  await assert.rejects(
    crossProvider.signPreparedDevnetTransaction(original, crossCapability),
    /belongs to another provider/u,
  );
  original.recentBlockhash = Keypair.generate().publicKey.toBase58();
  await assert.rejects(
    provider.signPreparedDevnetTransaction(original, crossCapability),
    /bound to a different transaction/u,
  );

  const staleTimes = [0, IAT_V2_TREZOR_PREPARED_SIGNING_MAX_AGE_MS + 1];
  const staleProvider = makeProvider(() => staleTimes.shift());
  const staleTransaction = makeTransaction();
  const staleCapability = await staleProvider.prepareDevnetTransactionSigning(staleTransaction);
  await assert.rejects(
    staleProvider.signPreparedDevnetTransaction(staleTransaction, staleCapability),
    /capability is stale/u,
  );
  await assert.rejects(
    provider.signPreparedDevnetTransaction(makeTransaction(), Object.freeze({})),
    /capability is unavailable/u,
  );
  assert.equal(promptCount, 0);
});

test("prepared transaction signing is Devnet-only and Genesis mismatch never reaches the device", async () => {
  const signer = Keypair.generate();
  let promptCount = 0;
  const connect = {
    async solanaSignTransaction() {
      promptCount += 1;
      throw new Error("must not prompt");
    },
  };
  const transaction = new Transaction({
    feePayer: signer.publicKey,
    recentBlockhash: Keypair.generate().publicKey.toBase58(),
  }).add(SystemProgram.transfer({
    fromPubkey: signer.publicKey,
    toPubkey: Keypair.generate().publicKey,
    lamports: 1,
  }));
  const mismatch = await createMockVerifiedProvider({
    connect,
    publicKey: signer.publicKey,
    network: "devnet",
    readGenesisHash: mainnetGenesis,
    monotonicNow: () => 0,
  });
  await assert.rejects(
    mismatch.prepareDevnetTransactionSigning(transaction),
    /canonical devnet/u,
  );
  const mainnet = await createMockVerifiedProvider({
    connect,
    publicKey: signer.publicKey,
    network: "mainnet-beta",
    readGenesisHash: mainnetGenesis,
    monotonicNow: () => 0,
  });
  await assert.rejects(
    mainnet.prepareDevnetTransactionSigning(transaction),
    /restricted to Devnet/u,
  );
  assert.equal(promptCount, 0);
});

test("real prepared provider and coordinator preserve unsigned admission and one-use SDK ordering offline", async (t) => {
  const cases = [
    { name: "Genesis mismatch", genesisMismatch: true, rejected: /canonical devnet/u },
    { name: "99 remaining blocks", remainingBlocks: 99, rejected: /at least 100 remaining blocks/u },
    { name: "5001 ms preparation", preparationMs: 5_001, rejected: /preparation is stale/u },
    { name: "hidden completion", hideAtCompletion: true, rejected: /page is hidden/u },
    { name: "exact 100 blocks and 5000 ms", preparationMs: 5_000 },
    { name: "SDK rejection consumes latch and capability", preparationMs: 5_000, sdkFailure: true },
  ];

  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      // Deterministic software-only message/signature fixtures: no browser storage,
      // network connection, device, loader instruction, or broadcast is involved.
      const signer = Keypair.fromSeed(Buffer.alloc(32, 7));
      const destination = Keypair.fromSeed(Buffer.alloc(32, 9)).publicKey;
      const blockhash = Keypair.fromSeed(Buffer.alloc(32, 11)).publicKey.toBase58();
      const transaction = new Transaction({ feePayer: signer.publicKey, recentBlockhash: blockhash })
        .add(SystemProgram.transfer({ fromPubkey: signer.publicKey, toPubkey: destination, lamports: 1 }));
      const messageBytes = Buffer.from(transaction.serializeMessage());
      const messageSha256 = createHash("sha256").update(messageBytes).digest("hex");
      const binding = Object.freeze({
        sourceCommit: "a".repeat(40),
        programArtifactSha256: "b".repeat(64),
        mint: destination.toBase58(),
      });
      const action = "UPGRADE_PROGRAM";
      const latchKey = attendedPromptLatchKey({ binding, action });
      const values = new Map();
      const latchWrites = [];
      const events = [];
      let sdkCalls = 0;
      let monotonicMs = 0;
      let visible = true;
      let held = false;
      let capability = null;
      const storage = {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) {
          assert.equal(key, latchKey);
          const latch = JSON.parse(value);
          events.push(`latch:${latch.status}`);
          latchWrites.push(latch);
          values.set(key, value);
        },
      };
      const locks = {
        async request(name, options, callback) {
          assert.equal(name, IAT_V2_ATTENDED_PROMPT_GLOBAL_LOCK_NAME);
          assert.deepEqual(options, { mode: "exclusive", ifAvailable: true });
          if (held) return callback(null);
          held = true;
          try {
            return await callback({ name });
          } finally {
            held = false;
          }
        },
      };
      const assertPreLatchRpc = () => {
        assert.equal(held, true, "preparation must hold the real coordinator's global lock");
        assert.equal(latchWrites.length, 0, "no application RPC may follow prompt entry");
        assert.equal(sdkCalls, 0);
      };
      const connect = {
        async solanaSignTransaction(request) {
          sdkCalls += 1;
          events.push("sdk");
          assert.equal(held, true);
          const latch = loadAttendedModelTPromptLatch(storage, { binding, action });
          assert.equal(latch.status, "PROMPT_ENTERED");
          assert.equal(latch.messageSha256, messageSha256);
          assert.equal(latch.signer, signer.publicKey.toBase58());
          assert.equal(request.path, DEFAULT_PATH);
          assert.deepEqual(request.additionalInfo, { isDevnet: true });
          assert.equal(request.serialize, true);
          if (scenario.sdkFailure) throw new Error("injected offline SDK rejection");
          const signed = Transaction.from(Buffer.from(request.serializedTx, "hex"));
          assert.deepEqual(Buffer.from(signed.serializeMessage()), messageBytes);
          signed.partialSign(signer);
          const signature = signed.signatures.find(({ publicKey }) => publicKey.equals(signer.publicKey));
          return {
            success: true,
            payload: {
              signature: Buffer.from(signature.signature).toString("hex"),
              serializedTx: Buffer.from(signed.serialize()).toString("hex"),
            },
          };
        },
      };
      const provider = await createMockVerifiedProvider({
        connect,
        publicKey: signer.publicKey,
        network: "devnet",
        readGenesisHash: async () => {
          assertPreLatchRpc();
          events.push("genesis");
          // Charge Genesis preparation before the final observation. An
          // observation-only timer would incorrectly admit the 5001-ms case.
          monotonicMs = 1_000;
          return scenario.genesisMismatch ? mainnetGenesis() : devnetGenesis();
        },
        monotonicNow: () => monotonicMs,
      });
      const timestamps = ["2026-09-06T10:00:00.000Z", "2026-09-06T10:00:01.000Z"];
      const coordinator = createAttendedModelTPromptCoordinator({
        locks,
        storage,
        tabId: "123e4567-e89b-42d3-a456-426614174000",
        now: () => timestamps.shift(),
      });
      const requestOnce = () => coordinator.request({
        binding,
        action,
        messageSha256,
        signer: signer.publicKey.toBase58(),
        prepare: async () => {
          capability = await provider.prepareDevnetTransactionSigning(transaction);
          await assertFreshProgramPromptBlockhashWindow({
            blockhash,
            lastValidBlockHeight: 1_000,
            minContextSlot: 500,
            preparationStartedAtMonotonicMs: 0,
            isVisible: () => visible,
            monotonicNow: () => monotonicMs,
            connection: {
              async isBlockhashValid(requestedBlockhash, config) {
                assertPreLatchRpc();
                assert.equal(requestedBlockhash, blockhash);
                events.push(`rpc:${config.commitment}`);
                const finalized = config.commitment === "finalized";
                assert.deepEqual(config, {
                  commitment: finalized ? "finalized" : "processed",
                  minContextSlot: finalized ? 500 : 501,
                });
                return { context: { slot: finalized ? 501 : 507 }, value: true };
              },
              async getBlockHeight(config) {
                assertPreLatchRpc();
                assert.deepEqual(config, { commitment: "processed", minContextSlot: 507 });
                events.push("rpc:height");
                monotonicMs = scenario.preparationMs ?? 2_000;
                if (scenario.hideAtCompletion) visible = false;
                return 1_000 - (scenario.remainingBlocks ?? 100);
              },
            },
          });
          assertExactTransactionMessage(transaction, messageBytes, "Offline prepared coordinator fixture");
        },
        prompt: () => provider.signPreparedDevnetTransaction(transaction, capability),
      });

      if (scenario.rejected) {
        await assert.rejects(requestOnce(), scenario.rejected);
        assert.equal(latchWrites.length, 0);
        assert.equal(values.size, 0);
        assert.equal(loadAttendedModelTPromptLatch(storage, { binding, action }), null);
        assert.equal(sdkCalls, 0);
        assert.deepEqual(events, scenario.genesisMismatch
          ? ["genesis"]
          : ["genesis", "rpc:finalized", "rpc:processed", "rpc:height"]);
      } else {
        if (scenario.sdkFailure) {
          await assert.rejects(requestOnce(), /injected offline SDK rejection/u);
        } else {
          const result = await requestOnce();
          assert.equal(result.value.verifySignatures(), true);
          assert.deepEqual(Buffer.from(result.value.serializeMessage()), messageBytes);
        }
        const terminalStatus = scenario.sdkFailure ? "PROMPT_FAILED" : "PROMPT_VERIFIED";
        assert.deepEqual(events, [
          "genesis", "rpc:finalized", "rpc:processed", "rpc:height",
          "latch:PROMPT_ENTERED", "sdk", `latch:${terminalStatus}`,
        ]);
        assert.equal(sdkCalls, 1);
        assert.deepEqual(latchWrites.map(({ status }) => status), ["PROMPT_ENTERED", terminalStatus]);
        assert.equal(loadAttendedModelTPromptLatch(storage, { binding, action }).status, terminalStatus);
        const completedEvents = [...events];
        await assert.rejects(requestOnce(), /already consumed its transaction-prompt latch/u);
        await assert.rejects(
          provider.signPreparedDevnetTransaction(transaction, capability),
          /already consumed/u,
        );
        assert.deepEqual(events, completedEvents, "retry must reach neither preparation, latch writes, nor SDK");
        assert.equal(sdkCalls, 1);
        assert.equal(latchWrites.length, 2);
      }
      assert.equal(held, false, "every outcome must release the in-memory global lock");
    });
  }
});
