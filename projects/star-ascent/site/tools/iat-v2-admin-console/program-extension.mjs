import { Buffer } from "buffer";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

export const EXTEND_PROGRAM_CHECKED_FEATURE_ID = new PublicKey(
  "2oMRZEDWT2tqtYMofhmmfQ8SsjqUFzT6sYXppQDavxwz",
);
export const FEATURE_PROGRAM_ID = new PublicKey(
  "Feature111111111111111111111111111111111111",
);
export const MAX_PERMITTED_ACCOUNT_DATA_BYTES = 10 * 1024 * 1024;

const EXTEND_PROGRAM_DISCRIMINANT = 6;
const EXTEND_PROGRAM_CHECKED_DISCRIMINANT = 9;

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

export function buildProgramDataExtensionTransaction({
  additionalBytes,
  authority,
  blockhash,
  checked,
  feePayer,
  loaderProgramId,
  programDataAddress,
  programId,
}) {
  const extensionBytes = positiveSafeInteger(additionalBytes, "ProgramData additional bytes");
  if (extensionBytes > 0xffff_ffff) {
    throw new Error("ProgramData additional bytes exceed the loader u32 limit");
  }
  const payer = feePayer instanceof PublicKey ? feePayer : new PublicKey(feePayer);
  const program = programId instanceof PublicKey ? programId : new PublicKey(programId);
  const programData = programDataAddress instanceof PublicKey
    ? programDataAddress
    : new PublicKey(programDataAddress);
  const loader = loaderProgramId instanceof PublicKey
    ? loaderProgramId
    : new PublicKey(loaderProgramId);
  const authorityKey = authority instanceof PublicKey ? authority : new PublicKey(authority);
  const data = Buffer.alloc(8);
  data.writeUInt32LE(
    checked ? EXTEND_PROGRAM_CHECKED_DISCRIMINANT : EXTEND_PROGRAM_DISCRIMINANT,
    0,
  );
  data.writeUInt32LE(extensionBytes, 4);
  const keys = checked
    ? [
        { pubkey: programData, isSigner: false, isWritable: true },
        { pubkey: program, isSigner: false, isWritable: true },
        { pubkey: authorityKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: payer, isSigner: true, isWritable: true },
      ]
    : [
        { pubkey: programData, isSigner: false, isWritable: true },
        { pubkey: program, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: payer, isSigner: true, isWritable: true },
      ];
  return new Transaction({
    feePayer: payer,
    recentBlockhash: blockhash,
  }).add(new TransactionInstruction({ programId: loader, keys, data }));
}
