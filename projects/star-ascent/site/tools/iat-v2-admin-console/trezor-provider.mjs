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
const trezorVerificationCapabilities = new WeakSet();
const trezorVerificationBindings = new WeakMap();

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

function exactPublicKeyEncodingsForEntry(entry) {
  if (
    typeof entry?.publicKeyBase58 !== "string"
    || typeof entry?.publicKey !== "string"
    || !/^[0-9a-f]{64}$/i.test(entry.publicKey)
  ) {
    throw new Error("Trezor did not return both exact Solana public-key encodings");
  }
  const publicKey = publicKeyForEntry(entry);
  return {
    publicKey,
    publicKeyBase58: publicKey.toBase58(),
    publicKeyHex: Buffer.from(publicKey.toBytes()).toString("hex"),
  };
}

function createTrezorVerificationCapability({
  connect,
  expectedAddress,
  serializedPath,
  numericPath,
  publicKeyBase58,
  publicKeyHex,
  displayablePublicKey,
}) {
  const binding = Object.freeze({
    connect,
    expectedAddress,
    serializedPath,
    numericPath: Object.freeze([...numericPath]),
    publicKeyBase58,
    publicKeyHex,
    displayablePublicKey,
  });
  const capability = Object.freeze({
    expectedAddress: binding.expectedAddress,
    path: binding.serializedPath,
    serializedPath: binding.serializedPath,
    numericPath: binding.numericPath,
    publicKey: new PublicKey(binding.publicKeyBase58),
    publicKeyBase58: binding.publicKeyBase58,
    publicKeyHex: binding.publicKeyHex,
    displayablePublicKey: binding.displayablePublicKey,
    verifiedOnDevice: true,
  });
  trezorVerificationCapabilities.add(capability);
  trezorVerificationBindings.set(capability, binding);
  return capability;
}

export function assertTrezorSolanaVerificationCapability({
  capability,
  expectedAddress,
  connect,
}) {
  if (!capability || !trezorVerificationCapabilities.has(capability)) {
    throw new Error("Direct Model T signing requires a genuine on-device verification capability");
  }
  const binding = trezorVerificationBindings.get(capability);
  if (!binding) {
    throw new Error("Direct Model T signing verification capability is unavailable");
  }
  const expected = expectedAddress === undefined
    ? binding.expectedAddress
    : (expectedAddress instanceof PublicKey ? expectedAddress : new PublicKey(expectedAddress)).toBase58();
  if (expected !== binding.expectedAddress) {
    throw new Error("Model T verification capability is bound to a different Solana address");
  }
  if (connect !== undefined && connect !== binding.connect) {
    throw new Error("Model T verification capability is bound to a different Connect session");
  }
  const expectedNumericPath = numericDerivationPath(binding.serializedPath);
  if (
    capability.verifiedOnDevice !== true
    || capability.expectedAddress !== binding.expectedAddress
    || capability.path !== binding.serializedPath
    || capability.serializedPath !== binding.serializedPath
    || capability.publicKeyBase58 !== binding.publicKeyBase58
    || capability.publicKeyHex !== binding.publicKeyHex
    || capability.displayablePublicKey !== binding.displayablePublicKey
    || !Array.isArray(capability.numericPath)
    || capability.numericPath.length !== expectedNumericPath.length
    || capability.numericPath.some((value, index) => value !== expectedNumericPath[index])
    || binding.numericPath.length !== expectedNumericPath.length
    || binding.numericPath.some((value, index) => value !== expectedNumericPath[index])
  ) {
    throw new Error("Model T verification capability binding is inconsistent");
  }
  const publicKey = capability.publicKey instanceof PublicKey
    ? capability.publicKey
    : new PublicKey(capability.publicKey);
  const normalizedBase58 = publicKey.toBase58();
  const normalizedHex = Buffer.from(publicKey.toBytes()).toString("hex");
  if (
    normalizedBase58 !== binding.expectedAddress
    || normalizedBase58 !== binding.publicKeyBase58
    || normalizedHex !== binding.publicKeyHex
    || binding.displayablePublicKey !== binding.expectedAddress
  ) {
    throw new Error("Model T verification capability public-key binding is inconsistent");
  }
  return Object.freeze({
    expectedAddress: binding.expectedAddress,
    path: binding.serializedPath,
    numericPath: binding.numericPath,
    publicKey: new PublicKey(binding.publicKeyBase58),
    publicKeyBase58: binding.publicKeyBase58,
    publicKeyHex: binding.publicKeyHex,
    displayablePublicKey: binding.displayablePublicKey,
    capability,
  });
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

export async function verifyTrezorSolanaAccountOnDevice({
  connect,
  account,
  expectedAddress,
}) {
  if (typeof connect?.solanaGetPublicKey !== "function") {
    throw new Error("Trezor Solana address display is unavailable");
  }
  if (typeof account?.path !== "string") {
    throw new Error("Trezor Solana address display requires a matched derivation path");
  }
  const expectedPath = account.path;
  const expectedNumericPath = numericDerivationPath(expectedPath);
  const matchedPublicKey = account.publicKey instanceof PublicKey
    ? account.publicKey
    : new PublicKey(account.publicKey);
  const expectedPublicKey = expectedAddress instanceof PublicKey
    ? expectedAddress
    : new PublicKey(expectedAddress);
  if (!matchedPublicKey.equals(expectedPublicKey)) {
    throw new Error("Matched Model T account does not equal the required Solana signer");
  }
  const result = await connect.solanaGetPublicKey({
    path: expectedPath,
    showOnTrezor: true,
  });
  if (!result?.success) throw resultError(result, "Trezor Solana address display");
  const entry = result.payload;
  if (!entry || Array.isArray(entry)) {
    throw new Error("Trezor did not return the displayed Solana account");
  }
  if (entry.serializedPath !== expectedPath) {
    throw new Error("Trezor displayed a different Solana derivation path");
  }
  if (
    !Array.isArray(entry.path)
    || entry.path.length !== expectedNumericPath.length
    || entry.path.some((value, offset) => value !== expectedNumericPath[offset])
  ) {
    throw new Error("Trezor displayed inconsistent numeric and serialized Solana derivation paths");
  }
  const {
    publicKey: displayedPublicKey,
    publicKeyBase58,
    publicKeyHex,
  } = exactPublicKeyEncodingsForEntry(entry);
  if (!displayedPublicKey.equals(expectedPublicKey)) {
    throw new Error("Trezor displayed a different Solana public key");
  }
  if (entry.displayablePublicKey !== expectedPublicKey.toBase58()) {
    throw new Error("Trezor returned an inconsistent displayed Solana address");
  }
  return createTrezorVerificationCapability({
    connect,
    expectedAddress: expectedPublicKey.toBase58(),
    serializedPath: expectedPath,
    numericPath: expectedNumericPath,
    publicKeyBase58,
    publicKeyHex,
    displayablePublicKey: entry.displayablePublicKey,
  });
}

export function createTrezorTransactionProvider({
  connect,
  verification,
  network,
  readGenesisHash,
}) {
  if (!Object.hasOwn(SOLANA_NETWORK_GENESIS_HASHES, network)) {
    throw new Error("Direct Model T signing requires an explicit devnet or mainnet-beta network");
  }
  if (typeof readGenesisHash !== "function") {
    throw new Error("Direct Model T signing requires a canonical network Genesis-hash reader");
  }
  const verified = assertTrezorSolanaVerificationCapability({
    capability: verification,
    connect,
  });
  const path = verified.path;
  const signer = verified.publicKey;
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
