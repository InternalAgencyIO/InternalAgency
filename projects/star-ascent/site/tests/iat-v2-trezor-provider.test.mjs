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
} from "../tools/iat-v2-admin-console/trezor-provider.mjs";

test("direct Trezor adapter finds the exact account and returns a verified Devnet signature", async () => {
  const signer = Keypair.generate();
  const recipient = Keypair.generate().publicKey;
  const path = "m/44'/501'/3'/0'";
  let signRequest;
  const connect = {
    async solanaGetPublicKey({ bundle }) {
      assert.equal(bundle.length, 2);
      return {
        success: true,
        payload: [
          {
            publicKeyBase58: Keypair.generate().publicKey.toBase58(),
            serializedPath: bundle[0].path,
          },
          {
            publicKeyBase58: signer.publicKey.toBase58(),
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
  await assert.rejects(
    findTrezorSolanaAccount({
      connect: {
        async solanaGetPublicKey() {
          return {
            success: true,
            payload: [{
              publicKeyBase58: Keypair.generate().publicKey.toBase58(),
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
