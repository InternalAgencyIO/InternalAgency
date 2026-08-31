import { Buffer } from "buffer";
import { PublicKey } from "@solana/web3.js";

export const EXTEND_PROGRAM_CHECKED_FEATURE_ID = new PublicKey(
  "2oMRZEDWT2tqtYMofhmmfQ8SsjqUFzT6sYXppQDavxwz",
);
export const FEATURE_PROGRAM_ID = new PublicKey(
  "Feature111111111111111111111111111111111111",
);
export const MAX_PERMITTED_ACCOUNT_DATA_BYTES = 10 * 1024 * 1024;

function positiveSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}

export function inspectExtendProgramCheckedFeature(info) {
  if (!info) return { active: false, activationSlot: null };
  if (!info.owner.equals(FEATURE_PROGRAM_ID)) {
    throw new Error("ExtendProgramChecked feature account has an unexpected owner");
  }
  const data = Buffer.from(info.data);
  if (data.length < 9 || ![0, 1].includes(data[0])) {
    throw new Error("ExtendProgramChecked feature account has invalid state");
  }
  if (data[0] === 0) return { active: false, activationSlot: null };
  return { active: true, activationSlot: data.readBigUInt64LE(1) };
}

export function computeProgramDataExtension({
  artifactBytes,
  currentCapacityBytes,
  currentAccountBytes,
  currentLamports,
  targetRentLamports,
}) {
  const artifact = positiveSafeInteger(artifactBytes, "Reviewed artifact byte length");
  const capacity = positiveSafeInteger(currentCapacityBytes, "Current ProgramData capacity");
  const accountBytes = positiveSafeInteger(currentAccountBytes, "Current ProgramData account size");
  const lamports = positiveSafeInteger(currentLamports, "Current ProgramData lamports");
  if (!Number.isSafeInteger(targetRentLamports) || targetRentLamports < 0) {
    throw new Error("Target ProgramData rent must be a non-negative safe integer");
  }
  const additionalBytes = Math.max(0, artifact - capacity);
  if (additionalBytes > 0xffff_ffff) {
    throw new Error("ProgramData extension exceeds the loader u32 byte limit");
  }
  const targetAccountBytes = accountBytes + additionalBytes;
  if (
    !Number.isSafeInteger(targetAccountBytes)
    || targetAccountBytes > MAX_PERMITTED_ACCOUNT_DATA_BYTES
  ) {
    throw new Error("ProgramData extension exceeds Solana's 10 MiB account-data limit");
  }
  return Object.freeze({
    artifactBytes: artifact,
    currentCapacityBytes: capacity,
    currentAccountBytes: accountBytes,
    additionalBytes,
    targetAccountBytes,
    currentLamports: lamports,
    targetRentLamports,
    rentTopUpLamports: Math.max(0, targetRentLamports - lamports),
    extensionRequired: additionalBytes > 0,
  });
}
