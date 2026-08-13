import assert from "node:assert/strict";
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
  TREZOR_SOLANA_NETWORK_GENESIS_HASHES,
} from "../tools/iat-v2-admin-console/trezor-provider.mjs";

const devnetGenesis = () => TREZOR_SOLANA_NETWORK_GENESIS_HASHES.devnet;
const mainnetGenesis = () => TREZOR_SOLANA_NETWORK_GENESIS_HASHES["mainnet-beta"];

test("direct Trezor adapter finds the exact account and returns a verified Devnet signature", async () => {
const signer = Keypair.generate();
  const recipient = Keypair.generate().publicKey;
  const decoy = Keypair.generate().publicKey;
  const path = "m/44'/501'/3'/0'";
  let signRequest;
  const connect = {
    async solanaGetPublicKey({ bundle }) {
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
  const provider = createTrezorTransactionProvider({
    connect,
    path: account.path,
    publicKey: account.publicKey,
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
  const provider = createTrezorTransactionProvider({
    connect,
    path: "m/44'/501'/0'/0'",
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
  const provider = createTrezorTransactionProvider({
    connect,
    path: "m/44'/501'/0'/0'",
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
  const provider = createTrezorTransactionProvider({
    connect: {
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
    },
    path: "m/44'/501'/0'/0'",
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
  const providerForMutation = (mutate) => createTrezorTransactionProvider({
    connect: {
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
    },
    path: "m/44'/501'/0'/0'",
    publicKey: signer.publicKey,
    network: "devnet",
    readGenesisHash: devnetGenesis,
  });
  const dropProvider = providerForMutation((signed) => {
    signed.signatures.find(({ publicKey }) => publicKey.equals(feePayer.publicKey)).signature = null;
  });
  await assert.rejects(
    dropProvider.signTransaction(makeTransaction(true)),
    /changed a non-Trezor cosigner signature slot/,
  );
  const injectProvider = providerForMutation((signed) => signed.partialSign(feePayer));
  await assert.rejects(
    injectProvider.signTransaction(makeTransaction(false)),
    /changed a non-Trezor cosigner signature slot/,
  );
});

test("direct Trezor adapter requires an explicit supported network", () => {
  const signer = Keypair.generate().publicKey;
  assert.throws(
    () => createTrezorTransactionProvider({
      connect: {},
      path: "m/44'/501'/0'/0'",
      publicKey: signer,
      readGenesisHash: devnetGenesis,
    }),
    /explicit devnet or mainnet-beta network/,
  );
  assert.throws(
    () => createTrezorTransactionProvider({
      connect: {},
      path: "m/44'/501'/0'/0'",
      publicKey: signer,
      network: "testnet",
      readGenesisHash: devnetGenesis,
    }),
    /explicit devnet or mainnet-beta network/,
  );
});

test("direct Trezor adapter labels mainnet-beta explicitly to the device", async () => {
  const signer = Keypair.generate();
  let signRequest;
  const provider = createTrezorTransactionProvider({
    connect: {
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
    },
    path: "m/44'/501'/0'/0'",
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
  const provider = createTrezorTransactionProvider({
    connect: {
      async solanaSignTransaction() {
        promptCount += 1;
        throw new Error("must not prompt");
      },
    },
    path: "m/44'/501'/0'/0'",
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
