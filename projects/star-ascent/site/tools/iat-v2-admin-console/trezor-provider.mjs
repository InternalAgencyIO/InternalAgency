import { Buffer } from "buffer";
import {
  PublicKey,
  Transaction,
} from "@solana/web3.js";

const SOLANA_ACCOUNT_PATHS = Array.from(
  { length: 20 },
  (_value, index) => `m/44'/501'/${index}'/0'`,
);

function resultError(result, action) {
  const message = result?.payload?.error ?? result?.payload?.message ?? "Unknown Trezor error";
  const code = result?.payload?.code ? ` (${result.payload.code})` : "";
  return new Error(`${action} failed${code}: ${message}`);
}

function publicKeyForEntry(entry) {
  if (entry?.publicKeyBase58) return new PublicKey(entry.publicKeyBase58);
  if (typeof entry?.publicKey === "string" && /^[0-9a-f]{64}$/i.test(entry.publicKey)) {
    return new PublicKey(Buffer.from(entry.publicKey, "hex"));
  }
  throw new Error("Trezor returned an invalid Solana public key");
}

export async function findTrezorSolanaAccount({
  connect,
  expectedAddress,
  paths = SOLANA_ACCOUNT_PATHS,
}) {
  const expected = expectedAddress instanceof PublicKey
    ? expectedAddress
    : new PublicKey(expectedAddress);
  const result = await connect.solanaGetPublicKey({
    bundle: paths.map((path) => ({ path, showOnTrezor: false })),
  });
  if (!result?.success) throw resultError(result, "Trezor Solana account discovery");
  if (!Array.isArray(result.payload)) {
    throw new Error("Trezor did not return the requested Solana account list");
  }
  const match = result.payload.find((entry) => publicKeyForEntry(entry).equals(expected));
  if (!match) {
    throw new Error(
      `Required signer ${expected.toBase58()} was not found in the first ${paths.length} Model T Solana accounts`,
    );
  }
  return {
    path: match.serializedPath,
    publicKey: expected,
  };
}

export function createTrezorTransactionProvider({
  connect,
  path,
  publicKey,
}) {
  const signer = publicKey instanceof PublicKey ? publicKey : new PublicKey(publicKey);
  return {
    publicKey: signer,
    isTrezor: true,
    async signTransaction(transaction) {
      if (!(transaction instanceof Transaction)) {
        throw new Error("Direct Model T signing only accepts legacy Solana transactions");
      }
      const unsignedHex = Buffer.from(transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      })).toString("hex");
      const result = await connect.solanaSignTransaction({
        path,
        serializedTx: unsignedHex,
        additionalInfo: { isDevnet: true },
        serialize: true,
      });
      if (!result?.success) throw resultError(result, "Model T transaction signing");
      if (
        typeof result.payload?.signature !== "string"
        || !/^[0-9a-f]{128}$/i.test(result.payload.signature)
      ) {
        throw new Error("Model T returned an invalid Solana signature");
      }
      if (
        typeof result.payload?.serializedTx !== "string"
        || !/^[0-9a-f]+$/i.test(result.payload.serializedTx)
      ) {
        throw new Error("Model T did not return the signed Solana transaction");
      }
      const signed = Transaction.from(Buffer.from(result.payload.serializedTx, "hex"));
      const signature = signed.signatures.find(({ publicKey: key }) => key.equals(signer));
      if (
        !signature?.signature
        || !Buffer.from(signature.signature).equals(Buffer.from(result.payload.signature, "hex"))
      ) {
        throw new Error("Model T signature does not belong to the required signer");
      }
      return signed;
    },
  };
}

export const DEFAULT_TREZOR_SOLANA_PATHS = Object.freeze([...SOLANA_ACCOUNT_PATHS]);
