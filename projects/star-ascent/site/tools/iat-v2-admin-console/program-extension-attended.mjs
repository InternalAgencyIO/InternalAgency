import { Buffer } from "buffer";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

const EXTEND_PROGRAM_DISCRIMINANT = 6;
const EXTEND_PROGRAM_CHECKED_DISCRIMINANT = 9;

function positiveSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
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
