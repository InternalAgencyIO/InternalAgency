import { useEffect, useState } from "react";
import { Buffer } from "buffer";
import {
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import {
  BPF_UPGRADEABLE_LOADER_ID,
  IAT_V2_PROGRAM_ADMIN,
  IAT_V2_PROGRAM_DATA_ADDRESS,
  IAT_V2_PROGRAM_ID,
} from "../../programs/iat_v2/instructions.mjs";
import { buildProgramDataExtensionTransaction } from "./program-extension-attended.mjs";
import {
  assertCanonicalAttendedNextActionFromReceiptSet,
  canonicalReceiptSet,
  clearAttendedReceipts,
  loadAttendedReceiptSet,
  persistAttendedReceipt,
} from "./attended-evidence.mjs";
import {
  assertExactTransactionMessage,
  assertFreshProgramPromptBlockhashWindow,
  assertSignedLegacyTransaction,
  finalizedContextSlot,
  observeSignedBlockhashWindow,
  simulateExactLegacyTransaction,
} from "./attended-transaction-boundary.mjs";
import {
  attendedPromptLatchKey,
  createAttendedModelTPromptCoordinator,
  loadAttendedModelTPromptLatch,
} from "./attended-prompt-coordinator.mjs";
import {
  IAT_V2_ATTENDED_PROGRAM_SIGNED_PENDING_SCHEMA,
  loadAttendedProgramSignedPending,
  persistAttendedProgramSignedPending,
  removeAttendedProgramSignedPending,
} from "./attended-program-signed-pending.mjs";
import {
  attendedProgramHoldStatus,
  attendedProgramRecoveryHold,
  classifyAttendedProgramRecovery,
} from "./attended-program-recovery.mjs";
import {
  IAT_V2_ATTENDED_PROGRAM_BROADCAST_ATTEMPT_SCHEMA,
  loadAttendedProgramBroadcastAttempt,
  withAttendedProgramBroadcastReconciliation,
  withAttendedProgramBroadcastOnce,
  withNoAttendedProgramBroadcastAttempts,
} from "./attended-program-broadcast-once.mjs";

const UPGRADE_INSTRUCTION_DATA = Uint8Array.from([3, 0, 0, 0]);
const SET_AUTHORITY_INSTRUCTION_DATA = Uint8Array.from([4, 0, 0, 0]);
const DEVNET_DEPLOYER = new PublicKey("DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4");
const SIGNABLE_ACTIONS = ["extend-program", "upgrade"];
const PROGRAM_PROMPT_ACTIONS = ["EXTEND_PROGRAM_DATA", "UPGRADE_PROGRAM"];
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BLOCKHASH_WINDOW_POLL_MS = 1_500;
const BLOCKHASH_WINDOW_MAX_AGE_MS = 5_000;
const MIN_BROADCAST_REMAINING_BLOCKS = 40;

function programPromptAction(action) {
  if (action === "extend-program") return "EXTEND_PROGRAM_DATA";
  if (action === "upgrade") return "UPGRADE_PROGRAM";
  throw new Error("Finalized program action is outside the canonical attended prompt roster");
}

function programUiAction(action) {
  if (action === "EXTEND_PROGRAM_DATA") return "extend-program";
  if (action === "UPGRADE_PROGRAM") return "upgrade";
  throw new Error("Signed pending action is outside the canonical attended program roster");
}

function encodeSignature(bytes) {
  const value = Buffer.from(bytes ?? []);
  if (value.length !== 64 || value.every((byte) => byte === 0)) {
    throw new Error("Signed program transaction does not contain one nonzero 64-byte signature");
  }
  let number = 0n;
  for (const byte of value) number = (number << 8n) + BigInt(byte);
  let encoded = "";
  while (number > 0n) {
    encoded = BASE58_ALPHABET[Number(number % 58n)] + encoded;
    number /= 58n;
  }
  let zeroes = 0;
  while (zeroes < value.length && value[zeroes] === 0) zeroes += 1;
  return `${"1".repeat(zeroes)}${encoded}`;
}

function signedPendingBinding(evidenceBinding, action) {
  return {
    sourceCommit: evidenceBinding.sourceCommit,
    programArtifactSha256: evidenceBinding.programArtifactSha256,
    mint: evidenceBinding.mint,
    action: programPromptAction(action),
  };
}

function assertProgramPromptOrder(snapshot, nextAction) {
  const receiptSet = loadAttendedReceiptSet(localStorage, snapshot.evidenceBinding);
  if (
    !Number.isSafeInteger(snapshot.programDataCapacityBytes)
    || !Number.isSafeInteger(snapshot.targetProgramDataCapacityBytes)
    || snapshot.programDataCapacityBytes <= 0
    || snapshot.targetProgramDataCapacityBytes <= 0
  ) {
    throw new Error("Finalized ProgramData capacity cannot establish canonical attended order");
  }
  const extensionReceiptPresent = receiptSet.receipts.some(
    ({ action }) => action === "EXTEND_PROGRAM_DATA",
  );
  const frozenPreUpgradeCapacity = receiptSet.preUpgradeProgramDataCapacityBytes;
  if (
    receiptSet.receipts.length > 0
    && (!Number.isSafeInteger(frozenPreUpgradeCapacity) || frozenPreUpgradeCapacity <= 0)
  ) {
    throw new Error("Canonical program prompting cannot recover the frozen pre-upgrade capacity");
  }
  const programDataExtensionRequired = receiptSet.receipts.length === 0
    ? snapshot.programDataCapacityBytes < snapshot.targetProgramDataCapacityBytes
    : frozenPreUpgradeCapacity < snapshot.targetProgramDataCapacityBytes;
  if (receiptSet.receipts.length > 0 && extensionReceiptPresent !== programDataExtensionRequired) {
    throw new Error("Canonical extension receipt disagrees with the frozen pre-upgrade capacity");
  }
  return assertCanonicalAttendedNextActionFromReceiptSet({
    receiptSet,
    expectedBinding: snapshot.evidenceBinding,
    programDataExtensionRequired,
    nextAction,
  });
}

async function requestProgramModelTSignature({
  coordinator,
  binding,
  action,
  messageSha256,
  provider,
  signer,
  transaction,
  verifySigned,
  persistSigned,
  prepare,
}) {
  if (
    typeof provider?.prepareDevnetTransactionSigning !== "function"
    || typeof provider?.signPreparedDevnetTransaction !== "function"
    || typeof prepare !== "function"
  ) {
    throw new Error("Program signing requires prepared one-use Devnet Model T capability support");
  }
  let preparedSigningCapability = null;
  const result = await coordinator.request({
    binding,
    action,
    messageSha256,
    signer: signer.toBase58(),
    prepare: async () => {
      preparedSigningCapability = await prepare();
      if (preparedSigningCapability === null) {
        throw new Error("Program signing preparation did not return a one-use Model T capability");
      }
    },
    prompt: async () => {
      const signed = await provider.signPreparedDevnetTransaction(
        transaction,
        preparedSigningCapability,
      );
      await verifySigned(signed);
      await persistSigned(signed);
      return signed;
    },
  });
  return result.value;
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

function programRecoveryBindingKey(snapshot) {
  return snapshot?.evidenceBinding
    ? JSON.stringify({ ...snapshot.evidenceBinding, snapshotAction: snapshot.action ?? null })
    : null;
}

function pendingBlockhashWindowKey(pending) {
  return pending ? JSON.stringify(signedPendingRecord(pending)) : null;
}

function isFreshBroadcastWindow(pending, windowState) {
  const bindingKey = pendingBlockhashWindowKey(pending);
  return bindingKey !== null
    && windowState?.bindingKey === bindingKey
    && windowState.status === "VALID"
    && Number.isSafeInteger(windowState.remainingBlocks)
    && windowState.remainingBlocks >= MIN_BROADCAST_REMAINING_BLOCKS
    && Number.isFinite(windowState.observedAtMonotonicMs)
    && performance.now() - windowState.observedAtMonotonicMs <= BLOCKHASH_WINDOW_MAX_AGE_MS
    && document.visibilityState === "visible";
}

function blockhashWindowLabel(windowState, terminal = false) {
  if (terminal) {
    return windowState?.status === "EXPIRED"
      ? "EXPIRED // CEREMONY TERMINAL // COUNTDOWN STOPPED"
      : Number.isSafeInteger(windowState?.remainingBlocks)
        ? `CEREMONY TERMINAL // LAST OBSERVED ${windowState.remainingBlocks} BLOCKS REMAINING // COUNTDOWN STOPPED`
        : "CEREMONY TERMINAL // OBSERVATION UNAVAILABLE // COUNTDOWN STOPPED";
  }
  if (windowState?.status === "VALID") {
    if (windowState.remainingBlocks < MIN_BROADCAST_REMAINING_BLOCKS) {
      return `TOO CLOSE // ${windowState.remainingBlocks} BLOCKS REMAINING // CEREMONY TERMINAL`;
    }
    return `VALID // ${windowState.remainingBlocks} BLOCKS REMAINING // LAST VALID HEIGHT ${windowState.lastValidBlockHeight}`;
  }
  if (windowState?.status === "EXPIRED") return "EXPIRED // CEREMONY TERMINAL";
  if (windowState?.status === "UNKNOWN") return "RPC UNKNOWN // BROADCAST DISABLED";
  return "CHECKING // BROADCAST DISABLED";
}

function shouldBlockProgramPromptRetry({ binding, action }) {
  try {
    return loadAttendedModelTPromptLatch(localStorage, { binding, action }) !== null;
  } catch {
    return true;
  }
}

function explorer(kind, value) {
  return `https://explorer.solana.com/${kind}/${value}?cluster=devnet`;
}

function buildUpgradeTransaction({ buffer, feePayer, blockhash }) {
  const instruction = new TransactionInstruction({
    programId: BPF_UPGRADEABLE_LOADER_ID,
    keys: [
      { pubkey: IAT_V2_PROGRAM_DATA_ADDRESS, isSigner: false, isWritable: true },
      { pubkey: IAT_V2_PROGRAM_ID, isSigner: false, isWritable: true },
      { pubkey: buffer, isSigner: false, isWritable: true },
      { pubkey: feePayer, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: IAT_V2_PROGRAM_ADMIN, isSigner: true, isWritable: false },
    ],
    data: Buffer.from(UPGRADE_INSTRUCTION_DATA),
  });
  return new Transaction({ feePayer, recentBlockhash: blockhash }).add(instruction);
}

function buildReturnBufferTransaction({ buffer, feePayer, blockhash }) {
  const instruction = new TransactionInstruction({
    programId: BPF_UPGRADEABLE_LOADER_ID,
    keys: [
      { pubkey: buffer, isSigner: false, isWritable: true },
      { pubkey: IAT_V2_PROGRAM_ADMIN, isSigner: true, isWritable: false },
      { pubkey: DEVNET_DEPLOYER, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(SET_AUTHORITY_INSTRUCTION_DATA),
  });
  return new Transaction({ feePayer, recentBlockhash: blockhash }).add(instruction);
}

function publicKeyText(value) {
  return value?.toBase58?.() ?? null;
}

function scalarText(value) {
  return value === null || value === undefined ? null : String(value);
}

function upgradeActionBinding(snapshot) {
  return JSON.stringify({
    action: snapshot.action,
    programId: IAT_V2_PROGRAM_ID.toBase58(),
    programDataAddress: IAT_V2_PROGRAM_DATA_ADDRESS.toBase58(),
    programAdmin: IAT_V2_PROGRAM_ADMIN.toBase58(),
    buffer: publicKeyText(snapshot.buffer),
    bufferAuthority: publicKeyText(snapshot.bufferAuthority),
    bufferHash: snapshot.bufferHash ?? null,
    deployedHash: snapshot.deployedHash ?? null,
    deployedRegionHash: snapshot.deployedRegionHash ?? null,
    loaderZeroPaddingBytes: scalarText(snapshot.loaderZeroPaddingBytes),
    loaderZeroPaddingVerified: snapshot.loaderZeroPaddingVerified === true,
    alreadyUpgraded: snapshot.alreadyUpgraded === true,
    programDataDeploymentSlot: scalarText(snapshot.programDataDeploymentSlot),
    programDataCapacityBytes: scalarText(snapshot.programDataCapacityBytes),
    targetProgramDataCapacityBytes: scalarText(snapshot.targetProgramDataCapacityBytes),
    additionalProgramDataBytes: scalarText(snapshot.additionalProgramDataBytes),
    targetProgramDataAccountBytes: scalarText(snapshot.targetProgramDataAccountBytes),
    currentProgramDataLamports: scalarText(snapshot.currentProgramDataLamports),
    targetProgramDataRentLamports: scalarText(snapshot.targetProgramDataRentLamports),
    rentTopUpLamports: scalarText(snapshot.rentTopUpLamports),
    extendProgramChecked: snapshot.extendProgramChecked === true,
    extendProgramCheckedActivationSlot: scalarText(snapshot.extendProgramCheckedActivationSlot),
    sourceCommit: snapshot.evidenceBinding?.sourceCommit ?? null,
    programArtifactSha256: snapshot.evidenceBinding?.programArtifactSha256 ?? null,
    mint: snapshot.evidenceBinding?.mint ?? null,
  });
}

function buildAttendedProgramTransaction({ blockhash, current, feePayer }) {
  if (current.action === "extend-program") {
    return buildProgramDataExtensionTransaction({
      additionalBytes: current.additionalProgramDataBytes,
      authority: feePayer,
      blockhash,
      checked: current.extendProgramChecked,
      feePayer,
      loaderProgramId: BPF_UPGRADEABLE_LOADER_ID,
      programDataAddress: IAT_V2_PROGRAM_DATA_ADDRESS,
      programId: IAT_V2_PROGRAM_ID,
    });
  }
  if (current.action === "upgrade") {
    return buildUpgradeTransaction({ buffer: current.buffer, feePayer, blockhash });
  }
  if (current.action === "return-for-repair") {
    return buildReturnBufferTransaction({ buffer: current.buffer, feePayer, blockhash });
  }
  throw new Error("Finalized program state has no signable attended action");
}

async function buildAndSimulateFreshProgramTransaction({
  commitment,
  connection,
  current,
  feePayer,
  label,
  minContextSlot,
  sha256Hex,
}) {
  const latestResult = await connection.getLatestBlockhashAndContext({
    commitment,
    minContextSlot,
  });
  const latestContextSlot = finalizedContextSlot(
    latestResult,
    `${label} blockhash`,
    minContextSlot,
  );
  const latest = latestResult.value;
  const transaction = buildAttendedProgramTransaction({
    blockhash: latest.blockhash,
    current,
    feePayer,
  });
  const simulated = await simulateExactLegacyTransaction({
    commitment,
    connection,
    minContextSlot: latestContextSlot,
    sha256Hex,
    transaction,
  });
  if (simulated.simulation.value.err) {
    throw new Error(`${label} simulation failed: ${JSON.stringify(simulated.simulation.value.err)}`);
  }
  return { ...simulated, latest, transaction };
}

function signedPendingRecord(pending) {
  return {
    schema: IAT_V2_ATTENDED_PROGRAM_SIGNED_PENDING_SCHEMA,
    sourceCommit: pending.evidenceBinding.sourceCommit,
    programArtifactSha256: pending.evidenceBinding.programArtifactSha256,
    mint: pending.evidenceBinding.mint,
    action: programPromptAction(pending.action),
    messageSha256: pending.messageSha256,
    signer: pending.signer.toBase58(),
    actionBinding: pending.actionBinding,
    finalizedContextSlot: pending.finalizedContextSlot,
    blockhash: pending.latest.blockhash,
    lastValidBlockHeight: pending.latest.lastValidBlockHeight,
    messageBytesHex: Buffer.from(pending.messageBytes).toString("hex"),
    signedWireHex: Buffer.from(pending.signed.serialize()).toString("hex"),
    preUpgradeProgramDataCapacityBytes: pending.preUpgradeProgramDataCapacityBytes,
  };
}

function pendingFromRecord(record) {
  return {
    signed: Transaction.from(Buffer.from(record.signedWireHex, "hex")),
    latest: {
      blockhash: record.blockhash,
      lastValidBlockHeight: record.lastValidBlockHeight,
    },
    signer: new PublicKey(record.signer),
    messageBytes: Buffer.from(record.messageBytesHex, "hex"),
    messageSha256: record.messageSha256,
    action: programUiAction(record.action),
    actionBinding: record.actionBinding,
    evidenceBinding: {
      sourceCommit: record.sourceCommit,
      programArtifactSha256: record.programArtifactSha256,
      mint: record.mint,
    },
    finalizedContextSlot: record.finalizedContextSlot,
    preUpgradeProgramDataCapacityBytes: record.preUpgradeProgramDataCapacityBytes,
  };
}

function localSignatureFromPending(pending) {
  if (
    pending.signed.verifySignatures() !== true
    || pending.signed.signatures.length !== 1
    || !pending.signed.signatures[0].publicKey.equals(pending.signer)
  ) {
    throw new Error("Signed program transaction does not have one valid reviewed signer");
  }
  return encodeSignature(pending.signed.signatures[0].signature);
}

function broadcastAttemptFromPending(pending) {
  return {
    schema: IAT_V2_ATTENDED_PROGRAM_BROADCAST_ATTEMPT_SCHEMA,
    sourceCommit: pending.evidenceBinding.sourceCommit,
    programArtifactSha256: pending.evidenceBinding.programArtifactSha256,
    mint: pending.evidenceBinding.mint,
    action: programPromptAction(pending.action),
    messageSha256: pending.messageSha256,
    signer: pending.signer.toBase58(),
    localSignature: localSignatureFromPending(pending),
    blockhash: pending.latest.blockhash,
    lastValidBlockHeight: pending.latest.lastValidBlockHeight,
  };
}

function assertAttemptMatchesPending(attempt, pending) {
  const expected = broadcastAttemptFromPending(pending);
  if (JSON.stringify(attempt) !== JSON.stringify(expected)) {
    throw new Error("Permanent broadcast attempt does not match the verified signed program wire");
  }
  return expected;
}

function assertFinalizedProgramPostState({ pending, snapshot: post, transactionSlot }) {
  if (
    !Number.isSafeInteger(transactionSlot)
    || transactionSlot <= 0
    || !Number.isSafeInteger(post?.finalizedContextSlot)
    || post.finalizedContextSlot < transactionSlot
  ) {
    throw new Error("Finalized program post-state was not observed at or after the transaction slot");
  }
  if (JSON.stringify(post.evidenceBinding) !== JSON.stringify(pending.evidenceBinding)) {
    throw new Error("Finalized program post-state drifted from the source-bound evidence identity");
  }
  let reviewed;
  try {
    reviewed = JSON.parse(pending.actionBinding);
  } catch {
    throw new Error("Signed program action binding is not valid JSON");
  }
  const targetCapacity = Number(reviewed.targetProgramDataCapacityBytes);
  if (!Number.isSafeInteger(targetCapacity) || targetCapacity <= 0) {
    throw new Error("Signed program action has no exact target ProgramData capacity");
  }
  if (post.programDataCapacityBytes !== targetCapacity) {
    throw new Error("Finalized ProgramData capacity does not match the signed target");
  }
  if (pending.action === "extend-program") {
    if (post.action === "extend-program" || post.additionalProgramDataBytes !== 0) {
      throw new Error("Finalized ProgramData still requires the signed capacity extension");
    }
    return;
  }
  if (
    pending.action !== "upgrade"
    || post.action !== "complete"
    || post.alreadyUpgraded !== true
    || post.deployedHash !== pending.evidenceBinding.programArtifactSha256
    || post.programDataDeploymentSlot !== transactionSlot
  ) {
    throw new Error("Finalized program bytes do not match the signed CI-bound upgrade");
  }
}

export default function ProgramUpgradeAttendedActions({
  connection,
  finalizedCommitment,
  getHardwareProvider,
  inspectionBusy,
  loadBufferSnapshot,
  onLockChange,
  setError,
  setSnapshot,
  setStatus,
  sha256Hex,
  short,
  snapshot,
}) {
  const [promptCoordinator] = useState(createAttendedModelTPromptCoordinator);
  const [pending, setPending] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [receiptSet, setReceiptSet] = useState(null);
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [broadcastAttempt, setBroadcastAttempt] = useState(null);
  const [broadcastBlocked, setBroadcastBlocked] = useState(false);
  const [hasProgramBroadcastReservation, setHasProgramBroadcastReservation] = useState(false);
  const [checkedPendingBinding, setCheckedPendingBinding] = useState(null);
  const [blockedPendingBinding, setBlockedPendingBinding] = useState(null);
  const [blockhashWindow, setBlockhashWindow] = useState({ status: "INACTIVE" });
  const [terminalBlockhashBinding, setTerminalBlockhashBinding] = useState(null);
  const recoveryBinding = snapshot && SIGNABLE_ACTIONS.includes(snapshot.action)
    ? signedPendingBinding(snapshot.evidenceBinding, snapshot.action)
    : null;
  const recoveryBindingKey = programRecoveryBindingKey(snapshot);
  const pendingRecoveryReady = recoveryBindingKey !== null && checkedPendingBinding === recoveryBindingKey;
  const pendingRecoveryBlocked = recoveryBindingKey !== null && blockedPendingBinding === recoveryBindingKey;

  useEffect(() => {
    setReceiptSet(snapshot?.evidenceBinding
      ? loadAttendedReceiptSet(localStorage, snapshot.evidenceBinding)
      : null);
  }, [snapshot]);

  useEffect(() => {
    if (
      recoveryBindingKey === null
      || pending
      || checkedPendingBinding === recoveryBindingKey
      || blockedPendingBinding === recoveryBindingKey
    ) return;
    try {
      const currentReceiptSet = loadAttendedReceiptSet(localStorage, snapshot.evidenceBinding);
      const attempts = PROGRAM_PROMPT_ACTIONS
        .map((action) => loadAttendedProgramBroadcastAttempt(localStorage, {
          ...snapshot.evidenceBinding,
          action,
        }))
        .filter((attempt) => attempt !== null);
      setHasProgramBroadcastReservation(attempts.length > 0);
      const attemptsByAction = new Map(attempts.map((attempt) => [attempt.action, attempt]));
      for (const completedReceipt of currentReceiptSet.receipts) {
        if (!PROGRAM_PROMPT_ACTIONS.includes(completedReceipt.action)) continue;
        const receiptAttempt = attemptsByAction.get(completedReceipt.action);
        if (receiptAttempt === undefined) {
          throw new Error("Finalized program receipt has no permanent broadcast attempt");
        }
        if (
          completedReceipt.signature !== receiptAttempt.localSignature
          || completedReceipt.messageSha256 !== receiptAttempt.messageSha256
        ) {
          throw new Error("Finalized program receipt conflicts with its permanent broadcast attempt");
        }
      }
      const unresolvedAttempts = [];
      for (const attempt of attempts) {
        const completedReceipt = currentReceiptSet.receipts.find(({ action }) => action === attempt.action);
        if (completedReceipt && (
          completedReceipt.signature !== attempt.localSignature
          || completedReceipt.messageSha256 !== attempt.messageSha256
        )) {
          throw new Error("Finalized program receipt conflicts with its permanent broadcast attempt");
        }
        const attemptBinding = { ...snapshot.evidenceBinding, action: attempt.action };
        const record = loadAttendedProgramSignedPending(localStorage, attemptBinding);
        if (record === null) {
          if (!completedReceipt) {
            throw new Error("Permanent program broadcast attempt has neither signed wire nor finalized receipt");
          }
          continue;
        }
        const promptLatch = loadAttendedModelTPromptLatch(localStorage, {
          binding: snapshot.evidenceBinding,
          action: attempt.action,
        });
        if (
          promptLatch === null
          || !["PROMPT_ENTERED", "PROMPT_VERIFIED"].includes(promptLatch.status)
          || promptLatch.messageSha256 !== record.messageSha256
          || promptLatch.signer !== record.signer
        ) {
          throw new Error("Persisted signed program record does not match its entered or verified prompt latch");
        }
        const restored = pendingFromRecord(record);
        assertAttemptMatchesPending(attempt, restored);
        unresolvedAttempts.push({ attempt, restored });
      }
      if (unresolvedAttempts.length > 1) {
        throw new Error("Multiple unresolved permanent program broadcast attempts require independent reconciliation");
      }
      if (unresolvedAttempts.length === 1) {
        const [{ attempt, restored }] = unresolvedAttempts;
        setBroadcastAttempt(attempt);
        setPending(restored);
        setBroadcastBlocked(true);
        setStatus("RECONCILE ONLY // PERMANENT BROADCAST ATTEMPT FOUND; SEND IS DISABLED");
      } else if (recoveryBinding !== null) {
        const record = loadAttendedProgramSignedPending(localStorage, recoveryBinding);
        const promptLatch = loadAttendedModelTPromptLatch(localStorage, {
          binding: snapshot.evidenceBinding,
          action: recoveryBinding.action,
        });
        const recovery = classifyAttendedProgramRecovery({
          promptLatch,
          signedPending: record,
        });
        if (recovery.outcome === "HOLD") throw attendedProgramRecoveryHold(recovery);
        if (recovery.outcome === "RECOVERABLE") {
          if (record.actionBinding !== upgradeActionBinding(snapshot)) {
            throw new Error("Persisted signed program action no longer matches finalized state");
          }
          setPending(pendingFromRecord(record));
          setBroadcastBlocked(false);
          setStatus("RECOVERED SIGNED // NOT BROADCAST — REVIEW THEN PRESS THE SEPARATE BROADCAST BUTTON");
        }
      }
      setCheckedPendingBinding(recoveryBindingKey);
    } catch (caught) {
      setBlockedPendingBinding(recoveryBindingKey);
      setStatus(attendedProgramHoldStatus(caught) ?? "HOLD // SIGNED PROGRAM RECOVERY FAILED");
      setError(errorText(caught));
    }
  }, [
    blockedPendingBinding,
    checkedPendingBinding,
    pending,
    recoveryBinding,
    recoveryBindingKey,
    setError,
    setStatus,
    snapshot,
  ]);

  useEffect(() => {
    onLockChange(busy || Boolean(pending) || !pendingRecoveryReady || pendingRecoveryBlocked);
    return () => onLockChange(false);
  }, [busy, onLockChange, pending, pendingRecoveryBlocked, pendingRecoveryReady]);

  useEffect(() => {
    const bindingKey = pendingBlockhashWindowKey(pending);
    if (bindingKey === null || broadcastAttempt !== null) {
      setBlockhashWindow({ status: "INACTIVE" });
      return undefined;
    }
    if (terminalBlockhashBinding === bindingKey) return undefined;
    let cancelled = false;
    let requestEpoch = 0;
    let timer = null;
    let terminal = false;

    const schedule = () => {
      if (terminal || cancelled || document.visibilityState !== "visible") return;
      timer = window.setTimeout(observe, BLOCKHASH_WINDOW_POLL_MS);
    };
    const observe = async () => {
      if (terminal || cancelled || document.visibilityState !== "visible") return;
      const epoch = ++requestEpoch;
      setBlockhashWindow({ status: "CHECKING", bindingKey });
      try {
        const observed = await observeSignedBlockhashWindow({
          blockhash: pending.latest.blockhash,
          connection,
          lastValidBlockHeight: pending.latest.lastValidBlockHeight,
          minContextSlot: pending.finalizedContextSlot,
        });
        if (cancelled || epoch !== requestEpoch || document.visibilityState !== "visible") return;
        setBlockhashWindow({
          ...observed,
          bindingKey,
          observedAtMonotonicMs: performance.now(),
        });
        if (observed.status === "EXPIRED") {
          terminal = true;
          setTerminalBlockhashBinding(bindingKey);
          setStatus("HOLD // SIGNED BLOCKHASH EXPIRED; CEREMONY TERMINAL; NOTHING BROADCAST");
        } else if (observed.remainingBlocks < MIN_BROADCAST_REMAINING_BLOCKS) {
          terminal = true;
          setTerminalBlockhashBinding(bindingKey);
          setStatus("HOLD // SIGNED BLOCKHASH TOO CLOSE TO EXPIRY; CEREMONY TERMINAL; NOTHING BROADCAST");
        }
      } catch (caught) {
        if (cancelled || epoch !== requestEpoch) return;
        setBlockhashWindow({
          status: "UNKNOWN",
          bindingKey,
          error: errorText(caught),
        });
        setStatus("HOLD // SIGNED BLOCKHASH WINDOW UNKNOWN; BROADCAST DISABLED");
      } finally {
        if (!terminal && !cancelled && epoch === requestEpoch) schedule();
      }
    };
    const visibilityChanged = () => {
      if (terminal) return;
      requestEpoch += 1;
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      setBlockhashWindow({ status: "CHECKING", bindingKey });
      if (document.visibilityState === "visible") observe();
    };

    document.addEventListener("visibilitychange", visibilityChanged);
    observe();
    return () => {
      cancelled = true;
      requestEpoch += 1;
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, [broadcastAttempt, connection, pending, setStatus, terminalBlockhashBinding]);

  const activeBlockhashBinding = pendingBlockhashWindowKey(pending);
  const broadcastWindowTerminal = activeBlockhashBinding !== null
    && terminalBlockhashBinding === activeBlockhashBinding;
  const broadcastWindowReady = !broadcastWindowTerminal
    && isFreshBroadcastWindow(pending, blockhashWindow);

  async function simulateAndSign() {
    if (
      !snapshot
      || !SIGNABLE_ACTIONS.includes(snapshot.action)
      || pending
      || busy
      || inspectionBusy
      || !pendingRecoveryReady
      || pendingRecoveryBlocked
    ) return;
    let promptRecovery = null;
    setBusy(true);
    setError("");
    setLogs([]);
    setStatus("CONNECTING 7XZ MODEL T // NOTHING BROADCAST");
    try {
      const current = await loadBufferSnapshot(snapshot.finalizedContextSlot ?? 0);
      setSnapshot(current);
      if (!SIGNABLE_ACTIONS.includes(current.action)) {
        throw new Error("Finalized program state no longer has the reviewed signable action");
      }
      const promptAction = programPromptAction(current.action);
      attendedPromptLatchKey({ binding: current.evidenceBinding, action: promptAction });
      assertProgramPromptOrder(current, promptAction);
      const actionBinding = upgradeActionBinding(current);
      const { provider, publicKey } = await getHardwareProvider(IAT_V2_PROGRAM_ADMIN);
      if (!publicKey.equals(IAT_V2_PROGRAM_ADMIN)) {
        throw new Error("Connected hardware account is not the reviewed Model T payer");
      }
      const { simulationSlot: preflightSimulationSlot } = await buildAndSimulateFreshProgramTransaction({
        commitment: finalizedCommitment,
        connection,
        current,
        feePayer: publicKey,
        label: "Program action preflight",
        minContextSlot: current.finalizedContextSlot,
        sha256Hex,
      });
      const promptSnapshot = await loadBufferSnapshot(preflightSimulationSlot);
      const promptBinding = upgradeActionBinding(promptSnapshot);
      if (
        !SIGNABLE_ACTIONS.includes(promptSnapshot.action)
        || promptBinding !== actionBinding
      ) {
        setSnapshot(promptSnapshot);
        throw new Error("Finalized artifact, buffer, or program action changed before the hardware prompt");
      }
      if (document.visibilityState !== "visible") {
        throw new Error("Program prompt preparation requires a visible attended page");
      }
      const promptPreparationStartedAtMonotonicMs = performance.now();
      if (
        !Number.isFinite(promptPreparationStartedAtMonotonicMs)
        || promptPreparationStartedAtMonotonicMs < 0
      ) {
        throw new Error("Program prompt preparation monotonic clock is unavailable");
      }
      const {
        latest,
        messageBytes,
        messageSha256,
        simulation,
        simulationSlot,
        transaction: promptTransaction,
      } = await buildAndSimulateFreshProgramTransaction({
        commitment: finalizedCommitment,
        connection,
        current: promptSnapshot,
        feePayer: publicKey,
        label: "Program action prompt",
        minContextSlot: promptSnapshot.finalizedContextSlot,
        sha256Hex,
      });
      setLogs(simulation.value.logs ?? []);
      assertExactTransactionMessage(
        promptTransaction,
        messageBytes,
        "Freshly rebuilt program action",
      );
      setSnapshot(promptSnapshot);
      setStatus(`MODEL T // REVIEW EXACT ACTION; VALID TO HEIGHT ${latest.lastValidBlockHeight}; NOT BROADCAST`);
      assertProgramPromptOrder(promptSnapshot, promptAction);
      const promptRecoveryBindingKey = programRecoveryBindingKey(promptSnapshot);
      if (promptRecoveryBindingKey === null) {
        throw new Error("Attended program prompt has no exact recovery binding");
      }
      promptRecovery = {
        binding: promptSnapshot.evidenceBinding,
        action: promptAction,
        key: promptRecoveryBindingKey,
      };
      const pendingForSigned = (candidate) => ({
        signed: candidate,
        latest,
        signer: publicKey,
        messageBytes,
        messageSha256,
        action: promptSnapshot.action,
        actionBinding: promptBinding,
        evidenceBinding: promptSnapshot.evidenceBinding,
        finalizedContextSlot: simulationSlot,
        preUpgradeProgramDataCapacityBytes: promptSnapshot.programDataCapacityBytes,
      });
      const signed = await requestProgramModelTSignature({
        coordinator: promptCoordinator,
        binding: promptSnapshot.evidenceBinding,
        action: promptAction,
        messageSha256,
        provider,
        signer: publicKey,
        transaction: promptTransaction,
        prepare: async () => {
          const preparedSigningCapability = await provider.prepareDevnetTransactionSigning(
            promptTransaction,
          );
          await assertFreshProgramPromptBlockhashWindow({
            blockhash: latest.blockhash,
            connection,
            lastValidBlockHeight: latest.lastValidBlockHeight,
            minContextSlot: simulationSlot,
            preparationStartedAtMonotonicMs: promptPreparationStartedAtMonotonicMs,
          });
          assertExactTransactionMessage(promptTransaction, messageBytes, "Program action before prompt entry");
          return preparedSigningCapability;
        },
        verifySigned: (candidate) => assertSignedLegacyTransaction({
          expectedBlockhash: latest.blockhash,
          expectedMessageBytes: messageBytes,
          expectedMessageSha256: messageSha256,
          expectedSigner: publicKey,
          sha256Hex,
          signed: candidate,
        }),
        persistSigned: (candidate) => persistAttendedProgramSignedPending(
          localStorage,
          signedPendingRecord(pendingForSigned(candidate)),
        ),
      });
      const nextPending = pendingForSigned(signed);
      setPending(nextPending);
      setStatus(`SIGNED // NOT BROADCAST — RECOVERABLE; VALID TO HEIGHT ${latest.lastValidBlockHeight}; BROADCAST NOW`);
    } catch (caught) {
      if (promptRecovery !== null && shouldBlockProgramPromptRetry(promptRecovery)) {
        setBlockedPendingBinding(promptRecovery.key);
      }
      setStatus(attendedProgramHoldStatus(caught) ?? "HOLD // ATTENDED PROGRAM STEP STOPPED");
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function broadcastSigned() {
    if (!pending || broadcastAttempt || broadcastBlocked || busy || inspectionBusy) return;
    if (
      broadcastWindowTerminal
      || !isFreshBroadcastWindow(pending, blockhashWindow)
    ) {
      setStatus("HOLD // FRESH SIGNED BLOCKHASH WINDOW REQUIRED; NOTHING BROADCAST");
      return;
    }
    setBusy(true);
    setError("");
    setStatus("EXCLUSIVE PRE-SEND GATE // NOTHING BROADCAST");
    let preSendEntered = false;
    let preSendSnapshot = null;
    try {
      const result = await withAttendedProgramBroadcastOnce({
        storage: localStorage,
        attempt: broadcastAttemptFromPending(pending),
        beforePersist: async (candidateAttempt) => {
          preSendEntered = true;
          assertAttemptMatchesPending(candidateAttempt, pending);
          const retainedPending = loadAttendedProgramSignedPending(
            localStorage,
            signedPendingBinding(pending.evidenceBinding, pending.action),
          );
          if (
            retainedPending === null
            || JSON.stringify(retainedPending) !== JSON.stringify(signedPendingRecord(pending))
          ) {
            throw new Error("Exclusive pre-send gate cannot prove the exact durable signed wire");
          }
          const current = await loadBufferSnapshot(pending.finalizedContextSlot);
          setSnapshot(current);
          if (
            current.action !== pending.action
            || upgradeActionBinding(current) !== pending.actionBinding
          ) {
            throw new Error("Finalized artifact, buffer, or program action no longer matches the signature");
          }
          const rebuilt = buildAttendedProgramTransaction({
            blockhash: pending.latest.blockhash,
            current,
            feePayer: pending.signer,
          });
          assertExactTransactionMessage(
            rebuilt,
            pending.messageBytes,
            "Freshly rebuilt program action",
          );
          await assertSignedLegacyTransaction({
            expectedBlockhash: pending.latest.blockhash,
            expectedMessageBytes: pending.messageBytes,
            expectedMessageSha256: pending.messageSha256,
            expectedSigner: pending.signer,
            sha256Hex,
            signed: pending.signed,
          });
          const preReservationWindow = await observeSignedBlockhashWindow({
            blockhash: pending.latest.blockhash,
            connection,
            lastValidBlockHeight: pending.latest.lastValidBlockHeight,
            minContextSlot: current.finalizedContextSlot,
          });
          if (
            preReservationWindow.status !== "VALID"
            || preReservationWindow.remainingBlocks < MIN_BROADCAST_REMAINING_BLOCKS
          ) {
            setTerminalBlockhashBinding(pendingBlockhashWindowKey(pending));
            throw new Error("Signed transaction blockhash window is terminal before reservation");
          }
          preSendSnapshot = current;
        },
        afterPersist: async (retained) => {
          setBroadcastAttempt(retained);
          setBroadcastBlocked(true);
          setHasProgramBroadcastReservation(true);
          setStatus("ONE RAW DEVNET BROADCAST // LOCAL SIGNATURE PERSISTED // NO RETRY");
          const returnedSignature = await connection.sendRawTransaction(pending.signed.serialize(), {
            skipPreflight: false,
            preflightCommitment: finalizedCommitment,
            minContextSlot: preSendSnapshot.finalizedContextSlot,
            maxRetries: 0,
          });
          if (returnedSignature !== retained.localSignature) {
            throw new Error("RPC returned a signature different from the locally derived signature");
          }
          return returnedSignature;
        },
      });
      setBroadcastAttempt(result.attempt);
      setBroadcastBlocked(true);
      setHasProgramBroadcastReservation(true);
      if (result.status === "ALREADY_RESERVED") {
        setStatus("RECONCILE ONLY // PERMANENT BROADCAST ATTEMPT FOUND; NO SEND OCCURRED");
        await reconcileFinalizedAttempt(result.attempt, pending);
        return;
      }
      await reconcileFinalizedAttempt(result.attempt, pending);
    } catch (caught) {
      let retained = null;
      let storageError = null;
      try {
        retained = loadAttendedProgramBroadcastAttempt(localStorage, {
          ...pending.evidenceBinding,
          action: programPromptAction(pending.action),
        });
        if (retained !== null) assertAttemptMatchesPending(retained, pending);
      } catch (readError) {
        storageError = readError;
      }
      if (retained !== null) {
        setBroadcastAttempt(retained);
        setBroadcastBlocked(true);
        setHasProgramBroadcastReservation(true);
        setStatus("HOLD // PERMANENT ATTEMPT RETAINED; POLL ONLY AND NEVER RESEND");
      } else if (preSendEntered && storageError === null) {
        try {
          const terminalBinding = signedPendingBinding(pending.evidenceBinding, pending.action);
          await withNoAttendedProgramBroadcastAttempts({
            storage: localStorage,
            bindings: [terminalBinding],
            callback: async () => {
              const retainedPending = loadAttendedProgramSignedPending(localStorage, terminalBinding);
              if (
                retainedPending === null
                || JSON.stringify(retainedPending) !== JSON.stringify(signedPendingRecord(pending))
              ) {
                throw new Error("Pre-send terminalization cannot prove the exact retained signed wire");
              }
              removeAttendedProgramSignedPending(
                localStorage,
                terminalBinding,
                "PRE_SEND_FAILURE",
              );
            },
          });
          setPending(null);
          setBlockedPendingBinding(recoveryBindingKey);
          setStatus("HOLD // SIGNED PROGRAM TRANSACTION DISCARDED BEFORE BROADCAST");
        } catch (removeError) {
          setBroadcastBlocked(true);
          setStatus("HOLD // PRE-SEND TERMINALIZATION COULD NOT PROVE THAT NO BROADCAST ATTEMPT EXISTS");
          setError(`${errorText(caught)}; ${errorText(removeError)}`);
          return;
        }
      } else {
        setBroadcastBlocked(true);
        setStatus("HOLD // BROADCAST BOUNDARY COULD NOT BE PROVEN; RELOAD BEFORE ANY RETRY");
      }
      setError(storageError
        ? `${errorText(caught)}; ${errorText(storageError)}`
        : errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function reconcileFinalizedAttempt(attempt = broadcastAttempt, activePending = pending) {
    if (!attempt || !activePending) {
      throw new Error("Permanent broadcast attempt and signed wire are required for reconciliation");
    }
    assertAttemptMatchesPending(attempt, activePending);
    const statuses = await connection.getSignatureStatuses(
      [attempt.localSignature],
      { searchTransactionHistory: true },
    );
    const statusContextSlot = finalizedContextSlot(
      statuses,
      "Program signature status",
      activePending.finalizedContextSlot,
    );
    const signatureStatus = statuses.value?.[0];
    if (!signatureStatus) {
      throw new Error("Persisted program signature is not yet visible in transaction history");
    }
    if (signatureStatus.err !== null || signatureStatus.confirmationStatus !== "finalized") {
      throw new Error("Persisted program signature is not finalized successfully");
    }
    const transactionSlot = signatureStatus.slot;
    if (
      !Number.isSafeInteger(transactionSlot)
      || transactionSlot < activePending.finalizedContextSlot
      || transactionSlot > statusContextSlot
    ) {
      throw new Error("Finalized program signature slot is not exact");
    }
    const finalized = await connection.getTransaction(attempt.localSignature, {
      commitment: finalizedCommitment,
      maxSupportedTransactionVersion: 0,
    });
    if (
      !finalized
      || finalized.slot !== transactionSlot
      || finalized.meta?.err !== null
      || (finalized.version !== undefined && finalized.version !== "legacy")
    ) {
      throw new Error("Finalized program transaction result is missing, failed, or not legacy");
    }
    if (
      !Array.isArray(finalized.transaction?.signatures)
      || finalized.transaction.signatures.length !== 1
      || finalized.transaction.signatures[0] !== attempt.localSignature
    ) {
      throw new Error("Finalized program transaction carries a different signature roster");
    }
    const finalizedMessage = Buffer.from(finalized.transaction.message.serialize());
    if (
      !finalizedMessage.equals(activePending.messageBytes)
      || finalized.transaction.message.recentBlockhash !== attempt.blockhash
    ) {
      throw new Error("Finalized program transaction carries different reviewed message bytes");
    }
    if (!Number.isSafeInteger(finalized.blockTime) || finalized.blockTime <= 0) {
      throw new Error("Finalized program transaction has no exact block time");
    }
    const post = await loadBufferSnapshot(transactionSlot);
    assertFinalizedProgramPostState({
      pending: activePending,
      snapshot: post,
      transactionSlot,
    });
    const completedAction = activePending.action;
    const finalizedEvidence = await withAttendedProgramBroadcastReconciliation({
      storage: localStorage,
      attempt,
      callback: async (retainedAttempt) => {
        assertAttemptMatchesPending(retainedAttempt, activePending);
        const exactPendingBinding = signedPendingBinding(
          activePending.evidenceBinding,
          completedAction,
        );
        const retainedPending = loadAttendedProgramSignedPending(
          localStorage,
          exactPendingBinding,
        );
        const currentReceiptSet = loadAttendedReceiptSet(
          localStorage,
          activePending.evidenceBinding,
        );
        const retainedReceipt = currentReceiptSet.receipts.find(
          ({ action }) => action === programPromptAction(completedAction),
        );
        if (retainedPending === null && retainedReceipt === undefined) {
          throw new Error("Permanent program broadcast attempt has neither signed wire nor finalized receipt");
        }
        if (
          retainedPending !== null
          && JSON.stringify(retainedPending) !== JSON.stringify(signedPendingRecord(activePending))
        ) {
          throw new Error("Durable signed program record drifted during finalized reconciliation");
        }
        if (retainedReceipt && (
          retainedReceipt.signature !== retainedAttempt.localSignature
          || retainedReceipt.messageSha256 !== activePending.messageSha256
        )) {
          throw new Error("Finalized program receipt conflicts with its permanent broadcast attempt");
        }
        const canonicalReceipt = {
          action: programPromptAction(completedAction),
          title: completedAction === "extend-program"
            ? "Extend IAT V2 ProgramData capacity"
            : "Upgrade IAT V2 to the CI-bound migration artifact",
          signature: retainedAttempt.localSignature,
          messageSha256: activePending.messageSha256,
          explorerUrl: explorer("tx", retainedAttempt.localSignature),
          finalizedAtUtc: retainedReceipt?.finalizedAtUtc ?? new Date().toISOString(),
          kind: "program",
          week: null,
        };
        const nextReceiptSet = persistAttendedReceipt(
          localStorage,
          activePending.evidenceBinding,
          canonicalReceipt,
          { preUpgradeProgramDataCapacityBytes: activePending.preUpgradeProgramDataCapacityBytes },
        );
        if (retainedPending !== null) {
          removeAttendedProgramSignedPending(
            localStorage,
            exactPendingBinding,
            "FINALIZED_SUCCESS",
          );
        }
        return { canonicalReceipt, nextReceiptSet };
      },
    });
    const { canonicalReceipt, nextReceiptSet } = finalizedEvidence;
    setReceipt(canonicalReceipt);
    setReceiptSet(nextReceiptSet);
    setPending(null);
    setBroadcastAttempt(null);
    setBroadcastBlocked(false);
    setSnapshot(post);
    setStatus(completedAction === "extend-program"
      ? "CAPACITY EXTENSION FINALIZED // BUFFER UPLOAD REMAINS A SEPARATE STEP"
      : "UPGRADE FINALIZED // CORRECTED 7XZ PROGRAM IS LIVE ON DEVNET");
  }

  async function reconcileBroadcastAttempt() {
    if (!pending || !broadcastAttempt || busy || inspectionBusy) return;
    setBusy(true);
    setError("");
    setStatus("RECONCILE ONLY // POLLING PERSISTED SIGNATURE // NO SEND METHOD IS REACHABLE");
    try {
      await reconcileFinalizedAttempt(broadcastAttempt, pending);
    } catch (caught) {
      setStatus("HOLD // FINALIZED RECONCILIATION INCOMPLETE; BROADCAST REMAINS PERMANENTLY DISABLED");
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function discardSigned() {
    if (!pending || broadcastAttempt || broadcastBlocked || busy || inspectionBusy) return;
    setBusy(true);
    setError("");
    try {
      const discardBinding = signedPendingBinding(pending.evidenceBinding, pending.action);
      await withNoAttendedProgramBroadcastAttempts({
        storage: localStorage,
        bindings: [discardBinding],
        callback: async () => {
          const retainedPending = loadAttendedProgramSignedPending(localStorage, discardBinding);
          if (
            retainedPending === null
            || JSON.stringify(retainedPending) !== JSON.stringify(signedPendingRecord(pending))
          ) {
            throw new Error("Explicit discard cannot prove the exact retained signed wire");
          }
          removeAttendedProgramSignedPending(
            localStorage,
            discardBinding,
            "EXPLICIT_DISCARD",
          );
        },
      });
      setPending(null);
      setBlockedPendingBinding(recoveryBindingKey);
      setStatus("SIGNED TRANSACTION DISCARDED // NOTHING BROADCAST; CEREMONY ACTION REMAINS LATCHED");
    } catch (caught) {
      setBroadcastBlocked(true);
      setStatus("HOLD // DISCARD BOUNDARY COULD NOT PROVE THAT NO BROADCAST ATTEMPT EXISTS");
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  function downloadReceiptSet() {
    if (!receiptSet || receiptSet.receipts.length === 0) return;
    const blob = new Blob([`${JSON.stringify(receiptSet, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "iat-v2-current-source-program-receipts.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function clearReceiptSet() {
    if (!snapshot?.evidenceBinding || busy || inspectionBusy || pending) return;
    setBusy(true);
    setError("");
    try {
      await withNoAttendedProgramBroadcastAttempts({
        storage: localStorage,
        bindings: PROGRAM_PROMPT_ACTIONS.map((action) => ({
          ...snapshot.evidenceBinding,
          action,
        })),
        callback: async () => {
          clearAttendedReceipts(localStorage, snapshot.evidenceBinding);
        },
      });
      setReceiptSet(canonicalReceiptSet({ ...snapshot.evidenceBinding, receipts: [] }));
      setReceipt(null);
      setStatus("ALL LOCAL SOURCE-BOUND ATTENDED RECEIPTS CLEARED // ON-CHAIN STATE UNCHANGED");
    } catch (caught) {
      setHasProgramBroadcastReservation(true);
      setStatus("HOLD // PERMANENT PROGRAM BROADCAST EVIDENCE PREVENTS RECEIPT CLEARING");
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="sequence">
        <div className="sign-panel">
          <div>
            <small>EXACT SIGNER</small>
            <strong>{IAT_V2_PROGRAM_ADMIN.toBase58()}</strong>
            <p>The first click simulates and asks the Model T to sign. It cannot broadcast. A separate second click broadcasts.</p>
            <p>After signing, return here immediately to review and press the separate Broadcast button while it is enabled.</p>
          </div>
          {!pending ? (
            <button
              onClick={simulateAndSign}
              disabled={
                busy
                || inspectionBusy
                || !snapshot
                || !SIGNABLE_ACTIONS.includes(snapshot.action)
                || !pendingRecoveryReady
                || pendingRecoveryBlocked
              }
            >
              {snapshot?.action === "extend-program"
                ? "SIMULATE + SIGN SEPARATE CAPACITY EXTENSION"
                : snapshot?.action === "return-for-repair"
                  ? "CONNECT 7XZ + RETURN BUFFER FOR REPAIR"
                  : "CONNECT 7XZ MODEL T DIRECTLY + SIMULATE + SIGN"}
            </button>
          ) : broadcastAttempt ? (
            <div className="broadcast-panel">
              <code>MESSAGE {pending.messageSha256}</code>
              <code>SIGNATURE {broadcastAttempt.localSignature}</code>
              <button onClick={reconcileBroadcastAttempt} disabled={busy || inspectionBusy}>
                POLL FINALIZED SIGNATURE — NO SEND
              </button>
            </div>
          ) : (
            <div className="broadcast-panel">
              <code>MESSAGE {pending.messageSha256}</code>
              <code>VALID TO HEIGHT {pending.latest.lastValidBlockHeight}</code>
              <code>BLOCKHASH WINDOW {blockhashWindowLabel(blockhashWindow, broadcastWindowTerminal)}</code>
              <p>EXPIRY ENDS THIS CEREMONY.</p>
              <button
                onClick={broadcastSigned}
                disabled={busy || inspectionBusy || broadcastBlocked || !broadcastWindowReady}
              >
                {pending.action === "extend-program"
                  ? "BROADCAST SIGNED CAPACITY EXTENSION"
                  : pending.action === "upgrade"
                    ? "BROADCAST SIGNED DEVNET UPGRADE"
                    : "BROADCAST SIGNED BUFFER RECOVERY"}
              </button>
              <button
                className="discard"
                onClick={discardSigned}
                disabled={busy || inspectionBusy || broadcastBlocked}
              >
                DISCARD SIGNED TRANSACTION
              </button>
            </div>
          )}
        </div>
      </section>

      {receipt && (
        <section className="evidence">
          <div>
            <small>FINALIZED DEVNET {receipt.action.replaceAll("_", " ")}</small>
            <strong>{short(receipt.signature, 12)}</strong>
            <code>MESSAGE {receipt.messageSha256}</code>
          </div>
          <a href={explorer("tx", receipt.signature)} target="_blank" rel="noreferrer">OPEN EXPLORER ↗</a>
        </section>
      )}
      {receiptSet?.receipts.length > 0 && (
        <section className="command">
          <div className="command-status"><small>CANONICAL RECEIPTS</small><strong>{receiptSet.receipts.length} SOURCE-BOUND RECORD(S)</strong></div>
          <div className="command-actions">
            <button onClick={downloadReceiptSet} disabled={busy || inspectionBusy || Boolean(pending)}>EXPORT PROGRAM RECEIPTS</button>
            <button
              className="discard"
              onClick={clearReceiptSet}
              disabled={busy || inspectionBusy || Boolean(pending) || hasProgramBroadcastReservation}
            >
              CLEAR ALL LOCAL ATTENDED RECEIPTS
            </button>
          </div>
        </section>
      )}
      {logs.length > 0 && (
        <details className="logs">
          <summary>UPGRADE SIMULATION LOGS // {logs.length} LINES</summary>
          <pre>{logs.join("\n")}</pre>
        </details>
      )}
    </>
  );
}
