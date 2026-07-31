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
  IAT_V2_PROGRAM_ADMIN,
  IAT_V2_PROGRAM_ARTIFACT_BYTES,
  IAT_V2_PROGRAM_ARTIFACT_SHA256,
  IAT_V2_PROGRAM_DATA_ADDRESS,
  IAT_V2_PROGRAM_ID,
  parseUpgradeableProgramAccounts,
  parseUpgradeableProgramData,
} from "../../programs/iat_v2/instructions.mjs";

const DEVNET_RPC = "https://api.devnet.solana.com";
const connection = new Connection(DEVNET_RPC, "confirmed");
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
  const [signature, setSignature] = useState("");
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("WAITING FOR VERIFIED BUFFER ADDRESS");
  const [error, setError] = useState("");
  const local = isLocalOperatorHost(window.location.hostname);

  async function loadBufferSnapshot() {
    if (!local) throw new Error("Program upgrade console is localhost-only");
    const buffer = new PublicKey(bufferInput.trim());
    const [programInfo, programDataInfo, bufferInfo] = await connection.getMultipleAccountsInfo(
      [IAT_V2_PROGRAM_ID, IAT_V2_PROGRAM_DATA_ADDRESS, buffer],
      "confirmed",
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
    const deployedHash = await sha256Hex(deployed.programBytes);
    if (deployedHash === IAT_V2_PROGRAM_ARTIFACT_SHA256) {
      return {
        buffer,
        bufferHash: IAT_V2_PROGRAM_ARTIFACT_SHA256,
        deployedHash,
        alreadyUpgraded: true,
        bufferAuthority: IAT_V2_PROGRAM_ADMIN,
        action: "complete",
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
    if (parsedBuffer.programBytes.length !== IAT_V2_PROGRAM_ARTIFACT_BYTES) {
      throw new Error(
        `Buffer contains ${parsedBuffer.programBytes.length} bytes, expected ${IAT_V2_PROGRAM_ARTIFACT_BYTES}`,
      );
    }
    const bufferHash = await sha256Hex(parsedBuffer.programBytes);
    const bufferMatches = bufferHash === IAT_V2_PROGRAM_ARTIFACT_SHA256;
    return {
      buffer,
      bufferHash,
      bufferAuthority: parsedBuffer.authority,
      deployedHash,
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
    setStatus("VERIFYING PROGRAM + BUFFER // NO SIGNING");
    try {
      const next = await loadBufferSnapshot();
      setSnapshot(next);
      setStatus(statusForSnapshot(next));
      return next;
    } catch (caught) {
      setSnapshot(null);
      setStatus("HOLD // BUFFER VERIFICATION FAILED");
      setError(errorText(caught));
      throw caught;
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!local || !bufferInput) return;
    inspectBuffer().catch(() => {});
    // The URL-supplied buffer is inspected once on mount; later edits require
    // the explicit VERIFY BUFFER click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function simulateAndSign() {
    if (
      !snapshot
      || !["upgrade", "return-for-repair"].includes(snapshot.action)
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
      if (!["upgrade", "return-for-repair"].includes(current.action)) return;
      const { provider, publicKey } = await getHardwareProvider(IAT_V2_PROGRAM_ADMIN);
      const latest = await connection.getLatestBlockhash("confirmed");
      const buildTransaction = current.action === "upgrade"
        ? buildUpgradeTransaction
        : buildReturnBufferTransaction;
      const transaction = buildTransaction({
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
      setStatus(current.action === "upgrade"
        ? "MODEL T // REVIEW PROGRAM UPGRADE AND SIGN; STILL NOT BROADCAST"
        : "MODEL T // REVIEW BUFFER-ONLY AUTHORITY RETURN; STILL NOT BROADCAST");
      const signed = await provider.signTransaction(transaction);
      if (await sha256Hex(signed.serializeMessage()) !== messageSha256) {
        throw new Error("Wallet changed the reviewed upgrade transaction");
      }
      const walletSignature = signed.signatures.find(({ publicKey: signer }) => signer.equals(publicKey));
      if (!walletSignature?.signature) throw new Error("7XZ hardware signature is missing");
      if (!signed.verifySignatures()) throw new Error("Hardware-signed transaction failed local verification");
      setPending({ signed, latest, messageSha256, action: current.action });
      setStatus("SIGNED // NOT BROADCAST — PRESS THE SEPARATE BROADCAST BUTTON");
    } catch (caught) {
      setStatus("HOLD // UPGRADE PREPARATION STOPPED");
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function broadcastSigned() {
    if (!pending || busy) return;
    setBusy(true);
    setError("");
    setStatus(pending.action === "upgrade"
      ? "BROADCASTING USER-APPROVED DEVNET UPGRADE"
      : "BROADCASTING USER-APPROVED BUFFER RECOVERY");
    try {
      const nextSignature = await connection.sendRawTransaction(pending.signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 3,
      });
      const confirmation = await connection.confirmTransaction(
        {
          signature: nextSignature,
          blockhash: pending.latest.blockhash,
          lastValidBlockHeight: pending.latest.lastValidBlockHeight,
        },
        "confirmed",
      );
      if (confirmation.value.err) {
        throw new Error(`Upgrade confirmation failed: ${JSON.stringify(confirmation.value.err)}`);
      }
      setSignature(nextSignature);
      const completedAction = pending.action;
      setPending(null);
      const next = await loadBufferSnapshot();
      setSnapshot(next);
      setStatus(completedAction === "upgrade"
        ? "UPGRADE FINALIZED // CORRECTED 7XZ PROGRAM IS LIVE ON DEVNET"
        : "BUFFER RETURNED TO DEPLOYER // READY FOR IN-PLACE REPAIR");
    } catch (caught) {
      setStatus("HOLD // UPGRADE BROADCAST FAILED");
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
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
            <small>Only `7XZ…fzPH` can authorize this upgrade.</small>
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
            <button className="quiet" onClick={() => inspectBuffer().catch(() => {})} disabled={busy || !bufferInput}>
              VERIFY BUFFER
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
            <div><span>BUFFER</span><code>{snapshot?.buffer.toBase58() ?? "NOT VERIFIED"}</code></div>
            <div><span>BUFFER AUTHORITY</span><code>{snapshot?.bufferAuthority?.toBase58() ?? "NOT VERIFIED"}</code></div>
            <div><span>BUFFER HASH</span><code>{snapshot?.bufferHash ?? "NOT VERIFIED"}</code></div>
            <div><span>CURRENT HASH</span><code>{snapshot?.deployedHash ?? "NOT VERIFIED"}</code></div>
            <div><span>NEW REVIEWED HASH</span><code>{IAT_V2_PROGRAM_ARTIFACT_SHA256}</code></div>
            <div><span>PROGRAM BYTES</span><code>{IAT_V2_PROGRAM_ARTIFACT_BYTES}</code></div>
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
                  || !["upgrade", "return-for-repair"].includes(snapshot.action)
                }
              >
                {snapshot?.action === "return-for-repair"
                  ? "CONNECT 7XZ + RETURN BUFFER FOR REPAIR"
                  : "CONNECT 7XZ MODEL T DIRECTLY + SIMULATE + SIGN"}
              </button>
            ) : (
              <div className="broadcast-panel">
                <code>MESSAGE {pending.messageSha256}</code>
                <button onClick={broadcastSigned} disabled={busy}>
                  {pending.action === "upgrade"
                    ? "BROADCAST SIGNED DEVNET UPGRADE"
                    : "BROADCAST SIGNED BUFFER RECOVERY"}
                </button>
                {pending.action === "upgrade" && (
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
                )}
              </div>
            )}
          </div>
        </section>

        {signature && (
          <section className="evidence">
            <div>
              <small>FINALIZED DEVNET TRANSACTION</small>
              <strong>{short(signature, 12)}</strong>
            </div>
            <a href={explorer("tx", signature)} target="_blank" rel="noreferrer">OPEN EXPLORER ↗</a>
          </section>
        )}

        {snapshot?.alreadyUpgraded && (
          <section className="command">
            <div className="command-status">
              <small>NEXT</small>
              <strong>START THE FRESH 7XZ FEATURE REHEARSAL</strong>
            </div>
            <div className="command-actions">
              <a className="action-link" href="/?mode=features">OPEN FEATURE REHEARSAL</a>
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
