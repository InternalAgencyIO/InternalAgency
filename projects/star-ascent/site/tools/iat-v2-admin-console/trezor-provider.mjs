import { Buffer } from "buffer";
import {
  PublicKey,
  Transaction,
} from "@solana/web3.js";

const SOLANA_ACCOUNT_PATHS = Array.from(
  { length: 20 },
  (_value, index) => `m/44'/501'/${index}'/0'`,
);
const SOLANA_NETWORK_GENESIS_HASHES = Object.freeze({
  devnet: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
  "mainnet-beta": "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
});

function numericDerivationPath(serializedPath) {
  if (typeof serializedPath !== "string" || !/^m(?:\/[0-9]+'?)+$/.test(serializedPath)) {
    throw new Error("Trezor returned an invalid serialized Solana derivation path");
  }
  return serializedPath.slice(2).split("/").map((segment) => {
    const hardened = segment.endsWith("'");
    const value = Number.parseInt(hardened ? segment.slice(0, -1) : segment, 10);
    if (!Number.isSafeInteger(value) || value < 0 || value >= 0x80000000) {
      throw new Error("Trezor returned an invalid serialized Solana derivation path");
    }
    return hardened ? (value + 0x80000000) >>> 0 : value;
  });
}

function resultError(result, action) {
  const message = result?.payload?.error ?? result?.payload?.message ?? "Unknown Trezor error";
  const code = result?.payload?.code ? ` (${result.payload.code})` : "";
  return new Error(`${action} failed${code}: ${message}`);
}

function publicKeyForEntry(entry) {
  const base58Key = typeof entry?.publicKeyBase58 === "string"
    ? new PublicKey(entry.publicKeyBase58)
    : undefined;
  const hexKey = typeof entry?.publicKey === "string" && /^[0-9a-f]{64}$/i.test(entry.publicKey)
    ? new PublicKey(Buffer.from(entry.publicKey, "hex"))
    : undefined;
  if (base58Key && hexKey && !base58Key.equals(hexKey)) {
    throw new Error("Trezor returned inconsistent Solana public-key encodings");
  }
  if (base58Key) return base58Key;
  if (hexKey) return hexKey;
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
  if (result.payload.length !== paths.length) {
    throw new Error("Trezor returned a different number of Solana accounts than requested");
  }
  const entries = result.payload.map((entry, index) => {
    if (entry?.serializedPath !== paths[index]) {
      throw new Error("Trezor returned a Solana account for an unexpected derivation path");
    }
    const expectedNumericPath = numericDerivationPath(paths[index]);
    if (
      !Array.isArray(entry?.path)
      || entry.path.length !== expectedNumericPath.length
      || entry.path.some((value, offset) => value !== expectedNumericPath[offset])
    ) {
      throw new Error("Trezor returned inconsistent numeric and serialized Solana derivation paths");
    }
    const publicKey = publicKeyForEntry(entry);
    if (entry?.displayablePublicKey !== publicKey.toBase58()) {
      throw new Error("Trezor returned an inconsistent displayable Solana public key");
    }
    return { entry, publicKey };
  });
  const match = entries.find(({ publicKey }) => publicKey.equals(expected));
  if (!match) {
    throw new Error(
      `Required signer ${expected.toBase58()} was not found in the first ${paths.length} Model T Solana accounts`,
    );
  }
  return {
    path: match.entry.serializedPath,
    publicKey: expected,
  };
}

export function createTrezorTransactionProvider({
  connect,
  path,
  publicKey,
  network,
  readGenesisHash,
}) {
  if (!Object.hasOwn(SOLANA_NETWORK_GENESIS_HASHES, network)) {
    throw new Error("Direct Model T signing requires an explicit devnet or mainnet-beta network");
  }
  if (typeof readGenesisHash !== "function") {
    throw new Error("Direct Model T signing requires a canonical network Genesis-hash reader");
  }
  const signer = publicKey instanceof PublicKey ? publicKey : new PublicKey(publicKey);
  return {
    publicKey: signer,
    isTrezor: true,
    async signTransaction(transaction) {
      if (!(transaction instanceof Transaction)) {
        throw new Error("Direct Model T signing only accepts legacy Solana transactions");
      }
      const unsignedMessage = Buffer.from(transaction.serializeMessage());
      const originalSignatures = transaction.signatures.map(({ publicKey: key, signature }) => ({
        publicKey: key,
        signature: signature === null ? null : Buffer.from(signature),
      }));
      const unsignedHex = Buffer.from(transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      })).toString("hex");
      const observedGenesisHash = await readGenesisHash();
      if (observedGenesisHash !== SOLANA_NETWORK_GENESIS_HASHES[network]) {
        throw new Error(`Refusing Model T prompt: RPC Genesis hash does not identify canonical ${network}`);
      }
      const result = await connect.solanaSignTransaction({
        path,
        serializedTx: unsignedHex,
        additionalInfo: { isDevnet: network === "devnet" },
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
      if (!Buffer.from(signed.serializeMessage()).equals(unsignedMessage)) {
        throw new Error("Model T returned a signature for a different Solana transaction message");
      }
      if (!signed.verifySignatures(false)) {
        throw new Error("Model T returned a Solana signature that failed cryptographic verification");
      }
      if (signed.signatures.length !== originalSignatures.length) {
        throw new Error("Model T changed the Solana transaction signer set");
      }
      for (let index = 0; index < originalSignatures.length; index += 1) {
        const before = originalSignatures[index];
        const after = signed.signatures[index];
        if (!after.publicKey.equals(before.publicKey)) {
          throw new Error("Model T changed the Solana transaction signer order");
        }
        if (before.publicKey.equals(signer)) {
          if (before.signature !== null && !Buffer.from(after.signature ?? []).equals(before.signature)) {
            throw new Error("Model T replaced an existing signature in its signer slot");
          }
          continue;
        }
        const afterSignature = after.signature === null ? null : Buffer.from(after.signature);
        if (
          (before.signature === null) !== (afterSignature === null)
          || (before.signature !== null && !afterSignature.equals(before.signature))
        ) {
          throw new Error("Model T changed a non-Trezor cosigner signature slot");
        }
      }
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
export const TREZOR_SOLANA_NETWORK_GENESIS_HASHES = SOLANA_NETWORK_GENESIS_HASHES;
