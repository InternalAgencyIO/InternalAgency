import {
  ACCOUNT_SIZE,
  MINT_SIZE,
  unpackAccount,
  unpackMint,
} from "@solana/spl-token";

export const ORIGINAL_TOKEN_ACCOUNT_BYTES = ACCOUNT_SIZE;
export const ORIGINAL_TOKEN_MINT_BYTES = MINT_SIZE;

function assertExactOriginalTokenInfo({ info, programId, expectedBytes, label }) {
  if (!info) throw new Error(`${label} is missing`);
  if (!info.owner?.equals?.(programId)) throw new Error(`${label} has the wrong program owner`);
  if (!(info.data instanceof Uint8Array)) throw new Error(`${label} data is not a byte array`);
  if (info.data.byteLength !== expectedBytes) {
    throw new Error(`${label} is ${info.data.byteLength} bytes; expected exactly ${expectedBytes}`);
  }
}

export function decodeOriginalTokenAccountInfo({ address, info, programId }) {
  assertExactOriginalTokenInfo({
    info,
    programId,
    expectedBytes: ORIGINAL_TOKEN_ACCOUNT_BYTES,
    label: "Original SPL Token account",
  });
  return unpackAccount(address, info, programId);
}

export function decodeOriginalTokenMintInfo({ address, info, programId }) {
  assertExactOriginalTokenInfo({
    info,
    programId,
    expectedBytes: ORIGINAL_TOKEN_MINT_BYTES,
    label: "Original SPL Token mint",
  });
  return unpackMint(address, info, programId);
}
