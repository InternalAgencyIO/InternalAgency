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
      const current = await loadBufferSnapshot();
      setSnapshot(current);
      if (!SIGNABLE_ACTIONS.includes(current.action)) return;
      const { provider, publicKey } = await getHardwareProvider(IAT_V2_PROGRAM_ADMIN);
      if (!publicKey.equals(IAT_V2_PROGRAM_ADMIN)) {
        throw new Error("Connected hardware account is not the reviewed Model T payer");
      }
      const latest = await connection.getLatestBlockhash(finalizedCommitment);
      const transaction = current.action === "extend-program"
        ? buildProgramDataExtensionTransaction({
            additionalBytes: current.additionalProgramDataBytes,
            authority: publicKey,
            blockhash: latest.blockhash,
            checked: current.extendProgramChecked,
            feePayer: publicKey,
            loaderProgramId: BPF_UPGRADEABLE_LOADER_ID,
            programDataAddress: IAT_V2_PROGRAM_DATA_ADDRESS,
            programId: IAT_V2_PROGRAM_ID,
          })
        : (current.action === "upgrade" ? buildUpgradeTransaction : buildReturnBufferTransaction)({
            buffer: current.buffer,
            feePayer: publicKey,
            blockhash: latest.blockhash,
          });
      const messageSha256 = await sha256Hex(transaction.serializeMessage());
      const simulation = await connection.simulateTransaction(transaction);
      setLogs(simulation.value.logs ?? []);
      if (simulation.value.err) {
        throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
      }
      setStatus(current.action === "extend-program"
        ? `MODEL T // REVIEW ${current.additionalProgramDataBytes} BYTE CAPACITY EXTENSION + ${current.rentTopUpLamports} LAMPORT RENT TOP-UP; STILL NOT BROADCAST`
        : current.action === "upgrade"
          ? "MODEL T // REVIEW PROGRAM UPGRADE AND SIGN; STILL NOT BROADCAST"
          : "MODEL T // REVIEW BUFFER-ONLY AUTHORITY RETURN; STILL NOT BROADCAST");
      const signed = await provider.signTransaction(transaction);
      if (await sha256Hex(signed.serializeMessage()) !== messageSha256) {
        throw new Error("Wallet changed the reviewed upgrade transaction");
      }
      const walletSignature = signed.signatures.find(({ publicKey: signer }) => signer.equals(publicKey));
      if (!walletSignature?.signature) throw new Error("7XZ hardware signature is missing");
      if (!signed.verifySignatures()) throw new Error("Hardware-signed transaction failed local verification");
      setPending({
        signed,
        latest,
        messageSha256,
        action: current.action,
        evidenceBinding: current.evidenceBinding,
        preUpgradeProgramDataCapacityBytes: current.programDataCapacityBytes,
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
    setStatus(pending.action === "extend-program"
      ? "BROADCASTING USER-APPROVED DEVNET CAPACITY EXTENSION"
      : pending.action === "upgrade"
        ? "BROADCASTING USER-APPROVED DEVNET UPGRADE"
        : "BROADCASTING USER-APPROVED BUFFER RECOVERY");
    try {
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
      const next = await loadBufferSnapshot();
      setSnapshot(next);
      setStatus(completedAction === "extend-program"
        ? "CAPACITY EXTENSION FINALIZED // BUFFER UPLOAD REMAINS A SEPARATE STEP"
        : completedAction === "upgrade"
          ? "UPGRADE FINALIZED // CORRECTED 7XZ PROGRAM IS LIVE ON DEVNET"
          : "BUFFER RETURNED TO DEPLOYER // READY FOR IN-PLACE REPAIR");
    } catch (caught) {
      setStatus("HOLD // ATTENDED PROGRAM BROADCAST FAILED");
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
