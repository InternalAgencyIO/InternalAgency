import { useEffect, useMemo, useState } from "react";
import { Buffer } from "buffer";
import {
  Connection,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  BPF_UPGRADEABLE_LOADER_ID,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD,
  IAT_V2_PROGRAM_ADMIN,
  IAT_V2_PROGRAM_DATA_ADDRESS,
  IAT_V2_PROGRAM_ID,
  inspectReviewedUpgradeableProgramArtifact,
  parseUpgradeableProgramAccounts,
  parseUpgradeableProgramData,
  deriveDeterministicDevnetMint,
  DEVNET_FEATURE_MINT_SEED,
} from "../../programs/iat_v2/instructions.mjs";
import {
  EXTEND_PROGRAM_CHECKED_FEATURE_ID,
  buildProgramDataExtensionTransaction,
  computeProgramDataExtension,
  inspectExtendProgramCheckedFeature,
} from "./program-extension.mjs";
import {
  canonicalReceiptSet,
  clearAttendedReceipts,
  loadAttendedReceiptSet,
  persistAttendedReceipt,
} from "./attended-evidence.mjs";

const DEVNET_RPC = "https://api.devnet.solana.com";
const FINALIZED_COMMITMENT = "finalized";
const connection = new Connection(DEVNET_RPC, FINALIZED_COMMITMENT);
const BUFFER_METADATA_BYTES = 37;
const UPGRADE_INSTRUCTION_DATA = Uint8Array.from([3, 0, 0, 0]);
const SET_AUTHORITY_INSTRUCTION_DATA = Uint8Array.from([4, 0, 0, 0]);
const DEVNET_DEPLOYER = new PublicKey("DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4");

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

function explorer(kind, value) {
  return `https://explorer.solana.com/${kind}/${value}?cluster=devnet`;
}

function parseBufferAccount(info) {
  if (!info.owner.equals(BPF_UPGRADEABLE_LOADER_ID)) {
    throw new Error("Upgrade buffer is not owned by the upgradeable loader");
  }
  const data = Buffer.from(info.data);
  if (data.length < BUFFER_METADATA_BYTES || data.readUInt32LE(0) !== 1) {
    throw new Error("Address is not an upgradeable-loader buffer");
  }
  if (data[4] !== 1) throw new Error("Upgrade buffer has no authority");
  return {
    authority: new PublicKey(data.subarray(5, 37)),
    programBytes: data.subarray(BUFFER_METADATA_BYTES),
  };
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
  return new Transaction({
    feePayer,
    recentBlockhash: blockhash,
  }).add(instruction);
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
  return new Transaction({
    feePayer,
    recentBlockhash: blockhash,
  }).add(instruction);
}

function statusForSnapshot(snapshot) {
  switch (snapshot.action) {
    case "complete":
      return "VERIFIED // CORRECTED PROGRAM ALREADY DEPLOYED";
    case "extend-program":
      return "CAPACITY EXTENSION REQUIRED // SEPARATE MODEL T SIGNATURE";
    case "buffer-required":
      return "CAPACITY READY // VERIFIED BUFFER ADDRESS REQUIRED";
    case "return-for-repair":
      return "RECOVERY READY // RETURN INCOMPLETE BUFFER TO DEVNET DEPLOYER";
    case "repair-required":
      return "BUFFER RETURNED // RUN THE IN-PLACE REPAIR HELPER";
    case "handoff-required":
      return "BUFFER VERIFIED // HAND AUTHORITY BACK TO 7XZ";
    default:
      return "READY // ONE 7XZ MODEL T SIGNATURE REQUIRED";
  }
}

export default function ProgramUpgrade({
  getHardwareProvider,
  isLocalOperatorHost,
  sha256Hex,
  short,
}) {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [bufferInput, setBufferInput] = useState(params.get("buffer") ?? "");
  const [snapshot, setSnapshot] = useState(null);
  const [pending, setPending] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [receiptSet, setReceiptSet] = useState(null);
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("WAITING FOR VERIFIED BUFFER ADDRESS");
  const [error, setError] = useState("");
  const local = isLocalOperatorHost(window.location.hostname);

  async function loadBufferSnapshot() {
    if (!local) throw new Error("Program upgrade console is localhost-only");
    if (
      !Number.isSafeInteger(IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES)
      || IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES <= 0
      || !/^[0-9a-f]{64}$/u.test(IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256 ?? "")
      || !/^[0-9a-f]{40}$/u.test(IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD ?? "")
    ) {
      throw new Error("Migration-capable program artifact is not yet bound to an exact public CI build");
    }
    const buffer = bufferInput.trim() ? new PublicKey(bufferInput.trim()) : null;
    const evidenceMint = await deriveDeterministicDevnetMint({ seed: DEVNET_FEATURE_MINT_SEED });
    const evidenceBinding = {
      sourceCommit: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD,
      programArtifactSha256: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256,
      mint: evidenceMint.toBase58(),
    };
    const addresses = [
      IAT_V2_PROGRAM_ID,
      IAT_V2_PROGRAM_DATA_ADDRESS,
      EXTEND_PROGRAM_CHECKED_FEATURE_ID,
      ...(buffer ? [buffer] : []),
    ];
    const [programInfo, programDataInfo, extendFeatureInfo, bufferInfo = null] =
      await connection.getMultipleAccountsInfo(
      addresses,
      FINALIZED_COMMITMENT,
    );
    if (!programInfo || !programDataInfo) throw new Error("Program or ProgramData is missing on Devnet");
    if (!programInfo.executable) throw new Error("IAT V2 program is not executable");
    if (!programInfo.owner.equals(BPF_UPGRADEABLE_LOADER_ID)) {
      throw new Error("IAT V2 program is not owned by the upgradeable loader");
    }
    if (!programDataInfo.owner.equals(BPF_UPGRADEABLE_LOADER_ID)) {
      throw new Error("IAT V2 ProgramData is not owned by the upgradeable loader");
    }
    parseUpgradeableProgramAccounts({
      programData: programInfo.data,
      programDataAddress: IAT_V2_PROGRAM_DATA_ADDRESS,
    });
    const deployed = parseUpgradeableProgramData(programDataInfo.data);
    if (!deployed.upgradeAuthority.equals(IAT_V2_PROGRAM_ADMIN)) {
      throw new Error(`Program upgrade authority is ${deployed.upgradeAuthority.toBase58()}`);
    }
    const extendFeature = inspectExtendProgramCheckedFeature(extendFeatureInfo);
    const currentCapacityBytes = deployed.programBytes.length;
    const preliminaryExtension = computeProgramDataExtension({
      artifactBytes: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES,
      currentCapacityBytes,
      currentAccountBytes: programDataInfo.data.length,
      currentLamports: programDataInfo.lamports,
      targetRentLamports: 0,
    });
    const targetRentLamports = await connection.getMinimumBalanceForRentExemption(
      preliminaryExtension.targetAccountBytes,
      FINALIZED_COMMITMENT,
    );
    const extension = computeProgramDataExtension({
      artifactBytes: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES,
      currentCapacityBytes,
      currentAccountBytes: programDataInfo.data.length,
      currentLamports: programDataInfo.lamports,
      targetRentLamports,
    });
    const deployedRegionHash = await sha256Hex(deployed.programBytes);
    const common = {
      buffer,
      deployedRegionHash,
      programDataCapacityBytes: extension.currentCapacityBytes,
      targetProgramDataCapacityBytes: extension.artifactBytes,
      additionalProgramDataBytes: extension.additionalBytes,
      targetProgramDataAccountBytes: extension.targetAccountBytes,
      currentProgramDataLamports: extension.currentLamports,
      targetProgramDataRentLamports: extension.targetRentLamports,
      rentTopUpLamports: extension.rentTopUpLamports,
      extendProgramChecked: extendFeature.active,
      extendProgramCheckedActivationSlot: extendFeature.activationSlot,
      evidenceBinding,
    };
    if (extension.extensionRequired) {
      return {
        ...common,
        bufferAuthority: null,
        bufferHash: null,
        deployedHash: null,
        loaderZeroPaddingBytes: null,
        loaderZeroPaddingVerified: false,
        alreadyUpgraded: false,
        action: "extend-program",
      };
    }
    const deployedArtifact = await inspectReviewedUpgradeableProgramArtifact({
      programBytes: deployed.programBytes,
      sha256Hex,
      expectedArtifactBytes: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES,
      expectedArtifactSha256: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256,
    });
    const deployedHash = deployedArtifact.artifactSha256;
    if (deployedArtifact.matchesReviewedArtifact) {
      return {
        ...common,
        bufferHash: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256,
        deployedHash,
        deployedRegionHash,
        loaderZeroPaddingBytes: deployedArtifact.loaderPaddingBytes,
        loaderZeroPaddingVerified: deployedArtifact.loaderPaddingIsZero,
        alreadyUpgraded: true,
        bufferAuthority: IAT_V2_PROGRAM_ADMIN,
        action: "complete",
      };
    }
    if (!buffer) {
      return {
        ...common,
        bufferAuthority: null,
        bufferHash: null,
        deployedHash,
        loaderZeroPaddingBytes: deployedArtifact.loaderPaddingBytes,
        loaderZeroPaddingVerified: deployedArtifact.loaderPaddingIsZero,
        alreadyUpgraded: false,
        action: "buffer-required",
      };
    }
    if (!bufferInfo) throw new Error("Upgrade buffer is missing on Devnet");
    const parsedBuffer = parseBufferAccount(bufferInfo);
    const adminControlsBuffer = parsedBuffer.authority.equals(IAT_V2_PROGRAM_ADMIN);
    const deployerControlsBuffer = parsedBuffer.authority.equals(DEVNET_DEPLOYER);
    if (!adminControlsBuffer && !deployerControlsBuffer) {
      throw new Error(
        `Buffer authority ${parsedBuffer.authority.toBase58()} is neither reviewed recovery party`,
      );
    }
    if (parsedBuffer.programBytes.length !== IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES) {
      throw new Error(
        `Buffer contains ${parsedBuffer.programBytes.length} bytes, expected ${IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES}`,
      );
    }
    const bufferHash = await sha256Hex(parsedBuffer.programBytes);
    const bufferMatches = bufferHash === IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256;
    return {
      ...common,
      bufferHash,
      bufferAuthority: parsedBuffer.authority,
      deployedHash,
      deployedRegionHash,
      loaderZeroPaddingBytes: deployedArtifact.loaderPaddingBytes,
      loaderZeroPaddingVerified: deployedArtifact.loaderPaddingIsZero,
      alreadyUpgraded: false,
      action: bufferMatches
        ? (adminControlsBuffer ? "upgrade" : "handoff-required")
        : (adminControlsBuffer ? "return-for-repair" : "repair-required"),
    };
  }

  async function inspectBuffer() {
    setBusy(true);
    setPending(null);
    setError("");
    setStatus("VERIFYING PROGRAM CAPACITY + OPTIONAL BUFFER // NO SIGNING");
    try {
      const next = await loadBufferSnapshot();
      setSnapshot(next);
      setReceiptSet(loadAttendedReceiptSet(localStorage, next.evidenceBinding));
      setStatus(statusForSnapshot(next));
      return next;
    } catch (caught) {
      setSnapshot(null);
      setStatus("HOLD // PROGRAM OR BUFFER VERIFICATION FAILED");
      setError(errorText(caught));
      throw caught;
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!local) return;
    inspectBuffer().catch(() => {});
    // Capacity is inspected once on mount even before a buffer exists. Later
    // input edits require the explicit read-only verification click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function simulateAndSign() {
    const signableActions = ["extend-program", "upgrade", "return-for-repair"];
    if (
      !snapshot
      || !signableActions.includes(snapshot.action)
      || pending
      || busy
    ) return;
    setBusy(true);
    setError("");
    setLogs([]);
    setStatus("CONNECTING 7XZ MODEL T // NOTHING BROADCAST");
    try {
      const current = await loadBufferSnapshot();
      setSnapshot(current);
      if (!signableActions.includes(current.action)) return;
      const { provider, publicKey } = await getHardwareProvider(IAT_V2_PROGRAM_ADMIN);
      if (!publicKey.equals(IAT_V2_PROGRAM_ADMIN)) {
        throw new Error("Connected hardware account is not the reviewed Model T payer");
      }
      const latest = await connection.getLatestBlockhash(FINALIZED_COMMITMENT);
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
        additionalProgramDataBytes: current.additionalProgramDataBytes,
        rentTopUpLamports: current.rentTopUpLamports,
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
    if (!pending || busy) return;
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
        preflightCommitment: FINALIZED_COMMITMENT,
        maxRetries: 3,
      });
      const confirmation = await connection.confirmTransaction(
        {
          signature: nextSignature,
          blockhash: pending.latest.blockhash,
          lastValidBlockHeight: pending.latest.lastValidBlockHeight,
        },
        FINALIZED_COMMITMENT,
      );
      if (confirmation.value.err) {
        throw new Error(`Upgrade confirmation failed: ${JSON.stringify(confirmation.value.err)}`);
      }
      const completedAction = pending.action;
      const canonicalAction = completedAction === "extend-program"
        ? "EXTEND_PROGRAM_DATA"
        : completedAction === "upgrade"
          ? "UPGRADE_PROGRAM"
          : "RETURN_BUFFER_AUTHORITY_TO_DEPLOYER";
      const canonicalTitle = completedAction === "extend-program"
        ? "Extend IAT V2 ProgramData capacity"
        : completedAction === "upgrade"
          ? "Upgrade IAT V2 to the CI-bound migration artifact"
          : "Return incomplete buffer authority to the Devnet deployer";
      const canonicalReceipt = {
        action: canonicalAction,
        title: canonicalTitle,
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
    <main className="console-shell">
      <aside className="rail">
        <a className="mark" href="https://internalagency.io/network" target="_blank" rel="noreferrer">
          IA<span>///</span>
        </a>
        <div className="rail-copy"><b>V2</b><span>UPGRADE</span><span>DEVNET</span></div>
        <div className="network-light"><i /> SOLANA DEVNET</div>
      </aside>
      <section className="workspace">
        <header className="hero">
          <div>
            <p>ONE-TIME SIGNER CORRECTION // DEVNET ONLY</p>
            <h1>FIX<br /><em>THE PROGRAM.</em></h1>
          </div>
          <div className="hero-state">
            <span>MAINNET</span><strong>HOLD</strong>
            <small>`7XZ…fzPH` is the reviewed attended authority and rent payer.</small>
          </div>
        </header>

        <section className="command">
          <div className="command-status">
            <small>STATUS</small>
            <strong>{status}</strong>
            {error && <p role="alert">{error}</p>}
          </div>
          <div className="command-actions">
            <input
              className="buffer-input"
              aria-label="Devnet upgrade buffer address"
              value={bufferInput}
              onChange={(event) => setBufferInput(event.target.value)}
              placeholder="PASTE DEVNET BUFFER ADDRESS"
              disabled={busy || Boolean(pending)}
            />
            <button className="quiet" onClick={() => inspectBuffer().catch(() => {})} disabled={busy || Boolean(pending)}>
              VERIFY CAPACITY + BUFFER
            </button>
          </div>
        </section>

        <section className="sequence">
          <div className="section-head compact">
            <div>
              <p>REVIEWED TRANSITION</p>
              <h2>ONE BINARY. ONE AUTHORITY.</h2>
            </div>
            <span>{snapshot?.alreadyUpgraded ? "COMPLETE" : "AWAITING 7XZ"}</span>
          </div>
          <div className="address-grid">
            <div><span>PROGRAM</span><code>{IAT_V2_PROGRAM_ID.toBase58()}</code></div>
            <div><span>UPGRADE AUTHORITY</span><code>{IAT_V2_PROGRAM_ADMIN.toBase58()}</code></div>
            <div><span>BUFFER</span><code>{snapshot?.buffer?.toBase58() ?? "NOT PROVIDED"}</code></div>
            <div><span>BUFFER AUTHORITY</span><code>{snapshot?.bufferAuthority?.toBase58() ?? "NOT VERIFIED"}</code></div>
            <div><span>BUFFER HASH</span><code>{snapshot?.bufferHash ?? "NOT VERIFIED"}</code></div>
            <div><span>CURRENT HASH</span><code>{snapshot?.deployedHash ?? "NOT VERIFIED"}</code></div>
            <div><span>CURRENT REGION HASH</span><code>{snapshot?.deployedRegionHash ?? "NOT VERIFIED"}</code></div>
            <div>
              <span>LOADER ZERO PADDING</span>
              <code>{snapshot
                ? `${snapshot.loaderZeroPaddingBytes} BYTES // ${snapshot.loaderZeroPaddingVerified ? "VERIFIED" : "NOT ZERO"}`
                : "NOT VERIFIED"}</code>
            </div>
            <div><span>NEW REVIEWED HASH</span><code>{IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256 ?? "NOT CI-BOUND"}</code></div>
            <div><span>PROGRAM BYTES</span><code>{IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES ?? "NOT CI-BOUND"}</code></div>
            <div><span>CURRENT PROGRAMDATA CAPACITY</span><code>{snapshot?.programDataCapacityBytes ?? "NOT VERIFIED"}</code></div>
            <div><span>ADDED CAPACITY</span><code>{snapshot?.additionalProgramDataBytes ?? "NOT VERIFIED"} BYTES</code></div>
            <div><span>EXACT RENT TOP-UP</span><code>{snapshot?.rentTopUpLamports ?? "NOT VERIFIED"} LAMPORTS</code></div>
            <div><span>EXTEND ABI</span><code>{snapshot ? (snapshot.extendProgramChecked ? "EXTEND_PROGRAM_CHECKED" : "EXTEND_PROGRAM") : "NOT VERIFIED"}</code></div>
          </div>
          <div className="sign-panel">
            <div>
              <small>EXACT SIGNER</small>
              <strong>{IAT_V2_PROGRAM_ADMIN.toBase58()}</strong>
              <p>The first click simulates and asks the Model T to sign. It cannot broadcast. A separate second click broadcasts.</p>
            </div>
            {!pending ? (
              <button
                onClick={simulateAndSign}
                disabled={
                  busy
                  || !snapshot
                  || !["extend-program", "upgrade", "return-for-repair"].includes(snapshot.action)
                }
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
                <button onClick={broadcastSigned} disabled={busy}>
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
                  disabled={busy}
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
              <button onClick={downloadReceiptSet} disabled={busy || Boolean(pending)}>EXPORT PROGRAM RECEIPTS</button>
              <button className="discard" onClick={clearReceiptSet} disabled={busy || Boolean(pending)}>CLEAR ALL LOCAL ATTENDED RECEIPTS</button>
            </div>
          </section>
        )}

        {snapshot?.action === "buffer-required" && (
          <section className="command">
            <div className="command-status">
              <small>NEXT // SEPARATE OPERATION</small>
              <strong>UPLOAD AND VERIFY THE CI-BOUND DEVNET BUFFER</strong>
              <p>The capacity transaction is complete. No buffer upload or upgrade was auto-started.</p>
            </div>
          </section>
        )}

        {snapshot?.alreadyUpgraded && (
          <section className="command">
            <div className="command-status">
              <small>NEXT</small>
              <strong>MIGRATE SETTLED LEGACY ROUNDS</strong>
            </div>
            <div className="command-actions">
              <a className="action-link" href="/?mode=migrate-rounds">OPEN ROUND MIGRATION</a>
            </div>
          </section>
        )}

        {logs.length > 0 && (
          <details className="logs">
            <summary>UPGRADE SIMULATION LOGS // {logs.length} LINES</summary>
            <pre>{logs.join("\n")}</pre>
          </details>
        )}
      </section>
    </main>
  );
}
