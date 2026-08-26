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
  canonicalReceiptSet,
  clearAttendedReceipts,
  loadAttendedReceiptSet,
  persistAttendedReceipt,
} from "./attended-evidence.mjs";
import {
  assertExactTransactionMessage,
  assertFreshFinalizedBlockhash,
  assertSignedLegacyTransaction,
  finalizedContextSlot,
  simulateExactLegacyTransaction,
} from "./attended-transaction-boundary.mjs";

const UPGRADE_INSTRUCTION_DATA = Uint8Array.from([3, 0, 0, 0]);
const SET_AUTHORITY_INSTRUCTION_DATA = Uint8Array.from([4, 0, 0, 0]);
const DEVNET_DEPLOYER = new PublicKey("DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4");
const SIGNABLE_ACTIONS = ["extend-program", "upgrade", "return-for-repair"];

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
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
  const [pending, setPending] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [receiptSet, setReceiptSet] = useState(null);
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setReceiptSet(snapshot?.evidenceBinding
      ? loadAttendedReceiptSet(localStorage, snapshot.evidenceBinding)
      : null);
  }, [snapshot]);

  useEffect(() => {
    onLockChange(busy || Boolean(pending));
    return () => onLockChange(false);
  }, [busy, onLockChange, pending]);

  async function simulateAndSign() {
    if (
      !snapshot
      || !SIGNABLE_ACTIONS.includes(snapshot.action)
      || pending
      || busy
      || inspectionBusy
    ) return;
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
      const actionBinding = upgradeActionBinding(current);
      const { provider, publicKey } = await getHardwareProvider(IAT_V2_PROGRAM_ADMIN);
      if (!publicKey.equals(IAT_V2_PROGRAM_ADMIN)) {
        throw new Error("Connected hardware account is not the reviewed Model T payer");
      }
      const latestResult = await connection.getLatestBlockhashAndContext({
        commitment: finalizedCommitment,
        minContextSlot: current.finalizedContextSlot,
      });
      const latestContextSlot = finalizedContextSlot(
        latestResult,
        "Program action blockhash",
        current.finalizedContextSlot,
      );
      const latest = latestResult.value;
      const transaction = buildAttendedProgramTransaction({
        blockhash: latest.blockhash,
        current,
        feePayer: publicKey,
      });
      const {
        messageBytes,
        messageSha256,
        simulation,
        simulationSlot,
      } = await simulateExactLegacyTransaction({
        commitment: finalizedCommitment,
        connection,
        minContextSlot: latestContextSlot,
        sha256Hex,
        transaction,
      });
      setLogs(simulation.value.logs ?? []);
      if (simulation.value.err) {
        throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
      }
      const promptSnapshot = await loadBufferSnapshot(simulationSlot);
      const promptBinding = upgradeActionBinding(promptSnapshot);
      if (
        !SIGNABLE_ACTIONS.includes(promptSnapshot.action)
        || promptBinding !== actionBinding
      ) {
        setSnapshot(promptSnapshot);
        throw new Error("Finalized artifact, buffer, or program action changed before the hardware prompt");
      }
      const promptTransaction = buildAttendedProgramTransaction({
        blockhash: latest.blockhash,
        current: promptSnapshot,
        feePayer: publicKey,
      });
      assertExactTransactionMessage(
        promptTransaction,
        messageBytes,
        "Freshly rebuilt program action",
      );
      setSnapshot(promptSnapshot);
      setStatus(promptSnapshot.action === "extend-program"
        ? `MODEL T // REVIEW ${promptSnapshot.additionalProgramDataBytes} BYTE CAPACITY EXTENSION + ${promptSnapshot.rentTopUpLamports} LAMPORT RENT TOP-UP; STILL NOT BROADCAST`
        : promptSnapshot.action === "upgrade"
          ? "MODEL T // REVIEW PROGRAM UPGRADE AND SIGN; STILL NOT BROADCAST"
          : "MODEL T // REVIEW BUFFER-ONLY AUTHORITY RETURN; STILL NOT BROADCAST");
      const signed = await provider.signTransaction(transaction);
      await assertSignedLegacyTransaction({
        expectedBlockhash: latest.blockhash,
        expectedMessageBytes: messageBytes,
        expectedMessageSha256: messageSha256,
        expectedSigner: publicKey,
        sha256Hex,
        signed,
      });
      setPending({
        signed,
        latest,
        signer: publicKey,
        messageBytes,
        messageSha256,
        action: promptSnapshot.action,
        actionBinding: promptBinding,
        evidenceBinding: promptSnapshot.evidenceBinding,
        finalizedContextSlot: promptSnapshot.finalizedContextSlot,
        preUpgradeProgramDataCapacityBytes: promptSnapshot.programDataCapacityBytes,
      });
      setStatus("SIGNED // NOT BROADCAST — PRESS THE SEPARATE BROADCAST BUTTON");
    } catch (caught) {
      setStatus("HOLD // ATTENDED PROGRAM STEP STOPPED");
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function broadcastSigned() {
    if (!pending || busy || inspectionBusy) return;
    setBusy(true);
    setError("");
    setStatus("REVERIFYING FINALIZED ARTIFACT + BUFFER + ACTION // NOTHING BROADCAST");
    let broadcastBoundaryValidated = false;
    try {
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
      await assertFreshFinalizedBlockhash({
        blockhash: pending.latest.blockhash,
        commitment: finalizedCommitment,
        connection,
        minContextSlot: current.finalizedContextSlot,
      });
      broadcastBoundaryValidated = true;
      setStatus(pending.action === "extend-program"
        ? "BROADCASTING USER-APPROVED DEVNET CAPACITY EXTENSION"
        : pending.action === "upgrade"
          ? "BROADCASTING USER-APPROVED DEVNET UPGRADE"
          : "BROADCASTING USER-APPROVED BUFFER RECOVERY");
      const nextSignature = await connection.sendRawTransaction(pending.signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: finalizedCommitment,
        maxRetries: 3,
      });
      const confirmation = await connection.confirmTransaction(
        {
          signature: nextSignature,
          blockhash: pending.latest.blockhash,
          lastValidBlockHeight: pending.latest.lastValidBlockHeight,
        },
        finalizedCommitment,
      );
      if (confirmation.value.err) {
        throw new Error(`Upgrade confirmation failed: ${JSON.stringify(confirmation.value.err)}`);
      }
      const confirmationSlot = finalizedContextSlot(
        confirmation,
        "Program action confirmation",
        current.finalizedContextSlot,
      );
      const completedAction = pending.action;
      const canonicalReceipt = {
        action: completedAction === "extend-program"
          ? "EXTEND_PROGRAM_DATA"
          : completedAction === "upgrade"
            ? "UPGRADE_PROGRAM"
            : "RETURN_BUFFER_AUTHORITY_TO_DEPLOYER",
        title: completedAction === "extend-program"
          ? "Extend IAT V2 ProgramData capacity"
          : completedAction === "upgrade"
            ? "Upgrade IAT V2 to the CI-bound migration artifact"
            : "Return incomplete buffer authority to the Devnet deployer",
        signature: nextSignature,
        messageSha256: pending.messageSha256,
        explorerUrl: explorer("tx", nextSignature),
        finalizedAtUtc: new Date().toISOString(),
        kind: "program",
        week: null,
      };
      const nextReceiptSet = persistAttendedReceipt(
        localStorage,
        pending.evidenceBinding,
        canonicalReceipt,
        { preUpgradeProgramDataCapacityBytes: pending.preUpgradeProgramDataCapacityBytes },
      );
      setReceipt(canonicalReceipt);
      setReceiptSet(nextReceiptSet);
      setPending(null);
      const next = await loadBufferSnapshot(confirmationSlot);
      setSnapshot(next);
      setStatus(completedAction === "extend-program"
        ? "CAPACITY EXTENSION FINALIZED // BUFFER UPLOAD REMAINS A SEPARATE STEP"
        : completedAction === "upgrade"
          ? "UPGRADE FINALIZED // CORRECTED 7XZ PROGRAM IS LIVE ON DEVNET"
          : "BUFFER RETURNED TO DEPLOYER // READY FOR IN-PLACE REPAIR");
    } catch (caught) {
      if (!broadcastBoundaryValidated) {
        setPending(null);
        setStatus("HOLD // SIGNED PROGRAM TRANSACTION DISCARDED BEFORE BROADCAST");
      } else {
        setStatus("HOLD // ATTENDED PROGRAM BROADCAST FAILED");
      }
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

  function clearReceiptSet() {
    if (!snapshot?.evidenceBinding) return;
    clearAttendedReceipts(localStorage, snapshot.evidenceBinding);
    setReceiptSet(canonicalReceiptSet({ ...snapshot.evidenceBinding, receipts: [] }));
    setReceipt(null);
    setStatus("ALL LOCAL SOURCE-BOUND ATTENDED RECEIPTS CLEARED // ON-CHAIN STATE UNCHANGED");
  }

  return (
    <>
      <section className="sequence">
        <div className="sign-panel">
          <div>
            <small>EXACT SIGNER</small>
            <strong>{IAT_V2_PROGRAM_ADMIN.toBase58()}</strong>
            <p>The first click simulates and asks the Model T to sign. It cannot broadcast. A separate second click broadcasts.</p>
          </div>
          {!pending ? (
            <button
              onClick={simulateAndSign}
              disabled={busy || inspectionBusy || !snapshot || !SIGNABLE_ACTIONS.includes(snapshot.action)}
            >
              {snapshot?.action === "extend-program"
                ? "SIMULATE + SIGN SEPARATE CAPACITY EXTENSION"
                : snapshot?.action === "return-for-repair"
                  ? "CONNECT 7XZ + RETURN BUFFER FOR REPAIR"
                  : "CONNECT 7XZ MODEL T DIRECTLY + SIMULATE + SIGN"}
            </button>
          ) : (
            <div className="broadcast-panel">
              <code>MESSAGE {pending.messageSha256}</code>
              <button onClick={broadcastSigned} disabled={busy || inspectionBusy}>
                {pending.action === "extend-program"
                  ? "BROADCAST SIGNED CAPACITY EXTENSION"
                  : pending.action === "upgrade"
                    ? "BROADCAST SIGNED DEVNET UPGRADE"
                    : "BROADCAST SIGNED BUFFER RECOVERY"}
              </button>
              <button
                className="discard"
                onClick={() => {
                  setPending(null);
                  setStatus("SIGNED TRANSACTION DISCARDED // NOTHING BROADCAST");
                }}
                disabled={busy || inspectionBusy}
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
            <button className="discard" onClick={clearReceiptSet} disabled={busy || inspectionBusy || Boolean(pending)}>CLEAR ALL LOCAL ATTENDED RECEIPTS</button>
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
