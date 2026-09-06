import { Buffer } from "buffer";
import { VersionedTransaction } from "@solana/web3.js";

// Admission headroom for physical review plus the existing 40-block send margin.
// This is not a guarantee of wall-clock signing time.
export const IAT_V2_PROGRAM_MIN_PROMPT_REMAINING_BLOCKS = 100;
export const IAT_V2_PROGRAM_MAX_PROMPT_PREPARATION_MS = 5_000;

export function sameBytes(left, right) {
  return Buffer.from(left).equals(Buffer.from(right));
}

export function finalizedContextSlot(result, label, minContextSlot = 0) {
  const slot = result?.context?.slot;
  if (!Number.isSafeInteger(slot) || slot <= 0 || slot < minContextSlot) {
    throw new Error(`${label} did not return a valid monotonic finalized context slot`);
  }
  return slot;
}

export function exactVersionedSimulation(transaction) {
  const messageBytes = Buffer.from(transaction.serializeMessage());
  const simulationTransaction = new VersionedTransaction(transaction.compileMessage());
  if (!sameBytes(simulationTransaction.message.serialize(), messageBytes)) {
    throw new Error("Exact reviewed legacy message changed while preparing versioned simulation");
  }
  return { messageBytes, simulationTransaction };
}

export function assertExactTransactionMessage(transaction, expectedMessageBytes, label) {
  if (!sameBytes(transaction.serializeMessage(), expectedMessageBytes)) {
    throw new Error(`${label} no longer matches the exact reviewed transaction message`);
  }
}

export async function simulateExactLegacyTransaction({
  commitment = "finalized",
  connection,
  minContextSlot,
  sha256Hex,
  transaction,
}) {
  if (!Number.isSafeInteger(minContextSlot) || minContextSlot <= 0) {
    throw new Error("Exact transaction simulation requires a positive finalized minContextSlot");
  }
  const { messageBytes, simulationTransaction } = exactVersionedSimulation(transaction);
  const messageSha256 = await sha256Hex(messageBytes);
  const simulation = await connection.simulateTransaction(simulationTransaction, {
    commitment,
    minContextSlot,
    replaceRecentBlockhash: false,
    sigVerify: false,
  });
  const simulationSlot = finalizedContextSlot(
    simulation,
    "Exact transaction simulation",
    minContextSlot,
  );
  if (
    !sameBytes(simulationTransaction.message.serialize(), messageBytes)
    || !sameBytes(transaction.serializeMessage(), messageBytes)
    || await sha256Hex(transaction.serializeMessage()) !== messageSha256
  ) {
    throw new Error("Simulation changed the exact hardware-reviewed transaction message");
  }
  return {
    messageBytes,
    messageSha256,
    simulation,
    simulationSlot,
  };
}

export async function assertSignedLegacyTransaction({
  expectedBlockhash,
  expectedMessageBytes,
  expectedMessageSha256,
  expectedSigner,
  sha256Hex,
  signed,
}) {
  assertExactTransactionMessage(signed, expectedMessageBytes, "Signed transaction");
  if (await sha256Hex(signed.serializeMessage()) !== expectedMessageSha256) {
    throw new Error("Signed transaction message hash no longer matches hardware review");
  }
  if (signed.recentBlockhash !== expectedBlockhash) {
    throw new Error("Signed transaction blockhash no longer matches hardware review");
  }
  const signer = signed.signatures.find(({ publicKey }) => publicKey.equals(expectedSigner));
  if (!signer?.signature) throw new Error("Required hardware signature is missing");
  if (!signed.verifySignatures()) {
    throw new Error("Hardware-signed transaction failed local signature verification");
  }
}

export async function assertFreshFinalizedBlockhash({
  blockhash,
  commitment = "finalized",
  connection,
  minContextSlot,
}) {
  const result = await connection.isBlockhashValid(blockhash, {
    commitment,
    minContextSlot,
  });
  const contextSlot = finalizedContextSlot(
    result,
    "Signed transaction blockhash",
    minContextSlot,
  );
  if (!result.value) throw new Error("Signed transaction blockhash is no longer valid");
  return contextSlot;
}

export async function observeSignedBlockhashWindow({
  blockhash,
  connection,
  lastValidBlockHeight,
  minContextSlot,
}) {
  if (typeof blockhash !== "string" || blockhash.length === 0) {
    throw new Error("Signed transaction blockhash observation requires an exact blockhash");
  }
  if (!Number.isSafeInteger(lastValidBlockHeight) || lastValidBlockHeight <= 0) {
    throw new Error("Signed transaction blockhash observation requires an exact last-valid height");
  }
  if (!Number.isSafeInteger(minContextSlot) || minContextSlot <= 0) {
    throw new Error("Signed transaction blockhash observation requires a positive finalized minContextSlot");
  }
  const finalized = await connection.isBlockhashValid(blockhash, {
    commitment: "finalized",
    minContextSlot,
  });
  const finalizedSlot = finalizedContextSlot(
    finalized,
    "Finalized signed transaction blockhash observation",
    minContextSlot,
  );
  const processed = await connection.isBlockhashValid(blockhash, {
    commitment: "processed",
    minContextSlot: finalizedSlot,
  });
  const processedSlot = finalizedContextSlot(
    processed,
    "Processed signed transaction blockhash observation",
    finalizedSlot,
  );
  const observedBlockHeight = await connection.getBlockHeight({
    commitment: "processed",
    minContextSlot: processedSlot,
  });
  if (!Number.isSafeInteger(observedBlockHeight) || observedBlockHeight <= 0) {
    throw new Error("Signed transaction blockhash observation returned an invalid block height");
  }
  const remainingBlocks = lastValidBlockHeight - observedBlockHeight;
  return Object.freeze({
    status: finalized.value === true && processed.value === true && remainingBlocks >= 0
      ? "VALID"
      : "EXPIRED",
    finalizedContextSlot: finalizedSlot,
    processedContextSlot: processedSlot,
    observedBlockHeight,
    remainingBlocks,
    lastValidBlockHeight,
  });
}

export async function assertFreshProgramPromptBlockhashWindow({
  blockhash,
  connection,
  lastValidBlockHeight,
  minContextSlot,
  preparationStartedAtMonotonicMs,
  isVisible = () => globalThis.document?.visibilityState === "visible",
  monotonicNow = () => performance.now(),
}) {
  if (typeof isVisible !== "function" || typeof monotonicNow !== "function" || isVisible() !== true) {
    throw new Error("Program prompt requires a visible attended page before consuming its latch");
  }
  const started = preparationStartedAtMonotonicMs === undefined
    ? monotonicNow()
    : preparationStartedAtMonotonicMs;
  const observed = await observeSignedBlockhashWindow({
    blockhash,
    connection,
    lastValidBlockHeight,
    minContextSlot,
  });
  const finished = monotonicNow();
  const elapsed = finished - started;
  if (
    !Number.isFinite(started)
    || started < 0
    || !Number.isFinite(finished)
    || !Number.isFinite(elapsed)
    || elapsed < 0
    || elapsed > IAT_V2_PROGRAM_MAX_PROMPT_PREPARATION_MS
    || isVisible() !== true
  ) {
    throw new Error("Program prompt preparation is stale or the page is hidden; no prompt latch consumed");
  }
  if (
    observed.status !== "VALID"
    || !Number.isSafeInteger(observed.remainingBlocks)
    || observed.remainingBlocks < IAT_V2_PROGRAM_MIN_PROMPT_REMAINING_BLOCKS
  ) {
    throw new Error(`Program prompt requires at least ${IAT_V2_PROGRAM_MIN_PROMPT_REMAINING_BLOCKS} remaining blocks; observed ${observed.remainingBlocks}; no prompt latch consumed`);
  }
  return observed;
}
