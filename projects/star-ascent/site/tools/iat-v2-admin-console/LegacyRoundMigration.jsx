import { useEffect, useState } from "react";
import {
  Connection,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
  createIatV2DeploymentPlan,
  deriveRoundAddress,
} from "../../programs/iat_v2/client.mjs";
import {
  IAT_V2_ROUND_LAYOUT,
  IAT_V2_ROUND_STATUS,
  buildBackfillHistoricalNeutralRoundInstruction,
  buildMigrateLegacyRoundInstruction,
  parseRoundAccount,
} from "../../programs/iat_v2/feature-instructions.mjs";
import {
  BPF_UPGRADEABLE_LOADER_ID,
  DEVNET_FEATURE_MINT_SEED,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD,
  IAT_V2_PROGRAM_ADMIN,
  IAT_V2_PROGRAM_DATA_ADDRESS,
  IAT_V2_PROGRAM_ID,
  deriveDeterministicDevnetMint,
  inspectReviewedUpgradeableProgramArtifact,
  parseV2ConfigAccount,
  parseUpgradeableProgramAccounts,
  parseUpgradeableProgramData,
} from "../../programs/iat_v2/instructions.mjs";
import {
  canonicalReceiptSet,
  clearAttendedReceipts,
  loadAttendedReceiptSet,
  persistAttendedReceipt,
} from "./attended-evidence.mjs";

const DEVNET_RPC = "https://api.devnet.solana.com";
const FINALIZED_COMMITMENT = "finalized";
const HISTORICAL_NEUTRAL_WEEKS = Object.freeze([9n, 10n]);
const CCC_FIRST_SELECTION_DELAY_SECONDS = 86_400n;
const CCC_REVEAL_TIMEOUT_SECONDS = 86_400n;
const SECONDS_PER_WEEK = 604_800n;
const connection = new Connection(DEVNET_RPC, FINALIZED_COMMITMENT);

export function canonicalCccSelectionTimestamp(genesisTimestamp, week) {
  return BigInt(genesisTimestamp)
    + CCC_FIRST_SELECTION_DELAY_SECONDS
    + BigInt(week) * SECONDS_PER_WEEK;
}

function currentCccRound(genesisTimestamp, nowTimestamp) {
  const first = BigInt(genesisTimestamp) + CCC_FIRST_SELECTION_DELAY_SECONDS;
  return BigInt(nowTimestamp) < first ? null : (BigInt(nowTimestamp) - first) / SECONDS_PER_WEEK;
}

function snapshotStatus(snapshot) {
  if (snapshot.legacy.length > 0) {
    return `READY // ${snapshot.legacy.length} SETTLED LEGACY ROUND${snapshot.legacy.length === 1 ? "" : "S"}`;
  }
  const missing = snapshot.recoveries.filter((round) => !round.complete);
  if (missing.length > 0) {
    return `READY // ${missing.length} HISTORICAL NEUTRAL ROUND${missing.length === 1 ? "" : "S"} REQUIRE SEPARATE SIGNATURES`;
  }
  return "COMPLETE // LEGACY MIGRATION + HISTORICAL NEUTRAL RECOVERY VERIFIED";
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

function explorer(kind, value) {
  return `https://explorer.solana.com/${kind}/${value}?cluster=devnet`;
}

async function loadMigrationSnapshot(sha256Hex) {
  if (
    !Number.isSafeInteger(IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES)
    || IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES <= 0
    || !/^[0-9a-f]{64}$/u.test(IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256 ?? "")
    || !/^[0-9a-f]{40}$/u.test(IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD ?? "")
  ) {
    throw new Error("Migration-capable program artifact is not yet bound to an exact public CI build");
  }
  const mint = await deriveDeterministicDevnetMint({ seed: DEVNET_FEATURE_MINT_SEED });
  const plan = createIatV2DeploymentPlan({
    network: "devnet",
    mint,
    programId: IAT_V2_PROGRAM_ID,
    randomnessProgramId: SWITCHBOARD_ON_DEMAND_DEVNET_PROGRAM_ID,
    rehearsal: true,
  });
  const recoveryAddresses = HISTORICAL_NEUTRAL_WEEKS.map((week) => deriveRoundAddress({
    config: plan.config,
    programId: IAT_V2_PROGRAM_ID,
    week: Number(week),
  }));
  const [programRows, configInfo, recoveryInfos, legacyAccounts, hardenedAccounts, chainSlot] = await Promise.all([
    connection.getMultipleAccountsInfo(
      [IAT_V2_PROGRAM_ID, IAT_V2_PROGRAM_DATA_ADDRESS],
      FINALIZED_COMMITMENT,
    ),
    connection.getAccountInfo(plan.config, FINALIZED_COMMITMENT),
    connection.getMultipleAccountsInfo(recoveryAddresses, FINALIZED_COMMITMENT),
    connection.getProgramAccounts(IAT_V2_PROGRAM_ID, {
      commitment: FINALIZED_COMMITMENT,
      filters: [
        { dataSize: IAT_V2_ROUND_LAYOUT.LEGACY_V1_BYTES },
        { memcmp: { offset: 8, bytes: plan.config.toBase58() } },
      ],
    }),
    connection.getProgramAccounts(IAT_V2_PROGRAM_ID, {
      commitment: FINALIZED_COMMITMENT,
      filters: [
        { dataSize: IAT_V2_ROUND_LAYOUT.HARDENED_V2_BYTES },
        { memcmp: { offset: 8, bytes: plan.config.toBase58() } },
      ],
    }),
    connection.getSlot(FINALIZED_COMMITMENT),
  ]);
  const chainTimestampValue = await connection.getBlockTime(chainSlot);
  if (!Number.isSafeInteger(chainTimestampValue)) {
    throw new Error("Finalized Devnet clock timestamp is unavailable");
  }
  const chainTimestamp = BigInt(chainTimestampValue);
  const [programInfo, programDataInfo] = programRows;
  if (!programInfo || !programDataInfo) {
    throw new Error("IAT V2 Program or ProgramData is missing on Devnet");
  }
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
  if (!deployed.upgradeAuthority?.equals(IAT_V2_PROGRAM_ADMIN)) {
    throw new Error("IAT V2 upgrade authority is not the reviewed Model T administrator");
  }
  const artifact = await inspectReviewedUpgradeableProgramArtifact({
    programBytes: deployed.programBytes,
    sha256Hex,
    expectedArtifactBytes: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES,
    expectedArtifactSha256: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256,
  });
  if (!artifact.matchesReviewedArtifact) {
    throw new Error("The reviewed migration-capable program artifact is not deployed on Devnet");
  }
  if (!configInfo || !configInfo.owner.equals(IAT_V2_PROGRAM_ID)) {
    throw new Error("The exact rehearsal config is missing or has an unexpected owner");
  }
  const configState = parseV2ConfigAccount(configInfo.data);
  if (!configState.admin.equals(IAT_V2_PROGRAM_ADMIN) || !configState.mint.equals(mint)) {
    throw new Error("The rehearsal config is not bound to the reviewed mint and Model T administrator");
  }
  if (!configState.rehearsalMode) {
    throw new Error("Historical neutral recovery is forbidden because this is not a rehearsal config");
  }
  if (!configState.active || configState.agencyCount === 0) {
    throw new Error("Historical neutral recovery requires the active rehearsal config and agency snapshot");
  }

  const parseAndVerify = ({ pubkey, account }, expectedLayout) => {
    if (!account.owner.equals(IAT_V2_PROGRAM_ID)) {
      throw new Error(`Round ${pubkey.toBase58()} has an unexpected owner`);
    }
    const round = parseRoundAccount(account.data);
    if (round.layoutVersion !== expectedLayout) {
      throw new Error(`Round ${pubkey.toBase58()} has an unexpected layout`);
    }
    if (!round.config.equals(plan.config)) {
      throw new Error(`Round ${pubkey.toBase58()} belongs to another config`);
    }
    if (round.week > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error(`Round ${pubkey.toBase58()} has an unsafe week number`);
    }
    const expected = deriveRoundAddress({
      config: plan.config,
      programId: IAT_V2_PROGRAM_ID,
      week: Number(round.week),
    });
    if (!pubkey.equals(expected)) {
      throw new Error(`Round ${pubkey.toBase58()} is not the canonical week PDA`);
    }
    return { address: pubkey, ...round };
  };
  const legacy = legacyAccounts
    .map((entry) => parseAndVerify(entry, IAT_V2_ROUND_LAYOUT.LEGACY_V1))
    .sort((left, right) => Number(left.week - right.week));
  const hardened = hardenedAccounts
    .map((entry) => parseAndVerify(entry, IAT_V2_ROUND_LAYOUT.HARDENED_V2))
    .sort((left, right) => Number(left.week - right.week));
  const unsafeLegacy = legacy.find((round) => round.status !== IAT_V2_ROUND_STATUS.SETTLED);
  if (unsafeLegacy) {
    throw new Error(
      `Legacy week ${unsafeLegacy.week} is not SETTLED; migration is intentionally unavailable`,
    );
  }
  const liveRound = currentCccRound(configState.genesisTimestamp, chainTimestamp);
  if (liveRound === null) throw new Error("The rehearsal CCC cadence has not opened");
  const recoveries = HISTORICAL_NEUTRAL_WEEKS.map((week, index) => {
    const address = recoveryAddresses[index];
    const info = recoveryInfos[index];
    const previousWeek = week - 1n;
    const previousRoundAddress = deriveRoundAddress({
      config: plan.config,
      programId: IAT_V2_PROGRAM_ID,
      week: Number(previousWeek),
    });
    const previousRound = [...legacy, ...hardened].find((candidate) => (
      candidate.week === previousWeek && candidate.address.equals(previousRoundAddress)
    ));
    const previousTerminal = previousRound
      && [IAT_V2_ROUND_STATUS.SETTLED, IAT_V2_ROUND_STATUS.EXPIRED_NEUTRAL]
        .includes(previousRound.status);
    if (previousRound && (
      !previousTerminal
      || previousRound.agencyCountSnapshot !== configState.agencyCount
      || !previousRound.agencyRegistryHashSnapshot.equals(configState.agencyRegistryHash)
    )) {
      throw new Error(`Historical week ${week} prior-round agency snapshot is not exact and terminal`);
    }
    const previousProofReady = Boolean(
      previousTerminal
      && previousRound.layoutVersion === IAT_V2_ROUND_LAYOUT.HARDENED_V2,
    );
    const canonicalSelectionTimestamp = canonicalCccSelectionTimestamp(
      configState.genesisTimestamp,
      week,
    );
    const neutralRecoveryTimestamp = canonicalSelectionTimestamp + CCC_REVEAL_TIMEOUT_SECONDS;
    const historical = week < liveRound;
    const timeoutElapsed = chainTimestamp >= neutralRecoveryTimestamp;
    if (!info) {
      return {
        address,
        week,
        canonicalSelectionTimestamp,
        neutralRecoveryTimestamp,
        previousRoundAddress,
        previousProofReady,
        historical,
        timeoutElapsed,
        complete: false,
        eligible: historical && timeoutElapsed && previousProofReady,
      };
    }
    if (!info.owner.equals(IAT_V2_PROGRAM_ID)) {
      throw new Error(`Historical week ${week} PDA has an unexpected owner`);
    }
    const round = parseAndVerify({ pubkey: address, account: info }, IAT_V2_ROUND_LAYOUT.HARDENED_V2);
    const exactNeutralBackfill = round.status === IAT_V2_ROUND_STATUS.EXPIRED_NEUTRAL
      && round.randomnessAccount.equals(SystemProgram.programId)
      && round.commitSlot === 0n
      && round.commitTimestamp === canonicalSelectionTimestamp
      && round.randomness.every((byte) => byte === 0)
      && round.agencyRegistryHashSnapshot.equals(configState.agencyRegistryHash)
      && round.agencyCountSnapshot === configState.agencyCount
      && round.selectedAgencyIndex === 0xffff_ffff
      && round.derivationCounter === 0xffff_ffff;
    if (!exactNeutralBackfill) {
      throw new Error(`Historical week ${week} exists but is not the exact terminal-neutral backfill`);
    }
    return {
      address,
      week,
      canonicalSelectionTimestamp,
      neutralRecoveryTimestamp,
      previousRoundAddress,
      previousProofReady,
      historical,
      timeoutElapsed,
      complete: true,
      eligible: false,
    };
  });
  return {
    mint,
    config: plan.config,
    artifactSha256: artifact.artifactSha256,
    chainTimestamp,
    currentRound: liveRound,
    configState,
    legacy,
    hardened,
    recoveries,
    evidenceBinding: {
      sourceCommit: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD,
      programArtifactSha256: IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256,
      mint: mint.toBase58(),
    },
  };
}

export default function LegacyRoundMigration({
  getHardwareProvider,
  isLocalOperatorHost,
  sha256Hex,
  short,
}) {
  const local = isLocalOperatorHost(window.location.hostname);
  const [snapshot, setSnapshot] = useState(null);
  const [pending, setPending] = useState(null);
  const [receiptSet, setReceiptSet] = useState(null);
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("VERIFYING SETTLED LEGACY ROUNDS // NO SIGNING");
  const [error, setError] = useState("");

  async function refresh() {
    if (!local) throw new Error("Legacy-round migration console is localhost-only");
    setError("");
    const next = await loadMigrationSnapshot(sha256Hex);
    setSnapshot(next);
    setReceiptSet(loadAttendedReceiptSet(localStorage, next.evidenceBinding));
    setStatus(snapshotStatus(next));
    return next;
  }

  useEffect(() => {
    refresh().catch((caught) => {
      setStatus("HOLD // MIGRATION PREFLIGHT FAILED");
      setError(errorText(caught));
    });
    // Read-only inspection once on mount. Every signing action refreshes again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function simulateAndSignMigration(roundAddress) {
    if (busy || pending) return;
    setBusy(true);
    setError("");
    setLogs([]);
    setStatus("REFRESHING EXACT ROUND + PROGRAM STATE // NOTHING BROADCAST");
    try {
      const current = await loadMigrationSnapshot(sha256Hex);
      setSnapshot(current);
      const round = current.legacy.find((candidate) => candidate.address.equals(roundAddress));
      if (!round) throw new Error("Selected legacy round is no longer pending migration");
      const { provider, publicKey } = await getHardwareProvider(IAT_V2_PROGRAM_ADMIN);
      if (!publicKey.equals(IAT_V2_PROGRAM_ADMIN)) {
        throw new Error("Connected hardware account is not the reviewed administrator");
      }
      const latest = await connection.getLatestBlockhash(FINALIZED_COMMITMENT);
      const transaction = new Transaction({
        feePayer: publicKey,
        recentBlockhash: latest.blockhash,
      }).add(buildMigrateLegacyRoundInstruction({
        admin: publicKey,
        mint: current.mint,
        week: round.week,
      }));
      const messageSha256 = await sha256Hex(transaction.serializeMessage());
      const simulation = await connection.simulateTransaction(transaction);
      setLogs(simulation.value.logs ?? []);
      if (simulation.value.err) {
        throw new Error(`Migration simulation failed: ${JSON.stringify(simulation.value.err)}`);
      }
      setStatus(`MODEL T // REVIEW WEEK ${round.week} MIGRATION AND SIGN; STILL NOT BROADCAST`);
      const signed = await provider.signTransaction(transaction);
      if (await sha256Hex(signed.serializeMessage()) !== messageSha256) {
        throw new Error("Model T changed the simulated migration message");
      }
      const hardwareSignature = signed.signatures.find(({ publicKey: signer }) => signer.equals(publicKey));
      if (!hardwareSignature?.signature) throw new Error("Reviewed Model T signature is missing");
      if (!signed.verifySignatures()) throw new Error("Hardware-signed migration failed local verification");
      setPending({
        signed,
        latest,
        messageSha256,
        round,
        kind: "migration",
        evidenceBinding: current.evidenceBinding,
      });
      setStatus(`SIGNED WEEK ${round.week} // NOT BROADCAST — USE THE SEPARATE BUTTON`);
    } catch (caught) {
      setStatus("HOLD // MIGRATION PREPARATION STOPPED");
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function simulateAndSignBackfill(roundAddress) {
    if (busy || pending) return;
    setBusy(true);
    setError("");
    setLogs([]);
    setStatus("REFRESHING EXACT ABSENT PDA + CANONICAL TIMEOUT // NOTHING BROADCAST");
    try {
      const current = await loadMigrationSnapshot(sha256Hex);
      setSnapshot(current);
      if (current.legacy.length !== 0) {
        throw new Error("Every settled legacy round must be migrated before historical recovery");
      }
      const round = current.recoveries.find((candidate) => candidate.address.equals(roundAddress));
      if (!round || round.complete || !round.eligible) {
        throw new Error("Selected historical round is not absent and eligible for neutral recovery");
      }
      const { provider, publicKey } = await getHardwareProvider(IAT_V2_PROGRAM_ADMIN);
      if (!publicKey.equals(IAT_V2_PROGRAM_ADMIN)) {
        throw new Error("Connected hardware account is not the reviewed administrator");
      }
      const latest = await connection.getLatestBlockhash(FINALIZED_COMMITMENT);
      const transaction = new Transaction({
        feePayer: publicKey,
        recentBlockhash: latest.blockhash,
      }).add(buildBackfillHistoricalNeutralRoundInstruction({
        admin: publicKey,
        mint: current.mint,
        week: round.week,
      }));
      if (transaction.instructions.length !== 1) {
        throw new Error("Historical neutral recovery transaction must contain exactly one instruction");
      }
      const messageSha256 = await sha256Hex(transaction.serializeMessage());
      const simulation = await connection.simulateTransaction(transaction);
      setLogs(simulation.value.logs ?? []);
      if (simulation.value.err) {
        throw new Error(`Historical neutral recovery simulation failed: ${JSON.stringify(simulation.value.err)}`);
      }
      setStatus(`MODEL T // REVIEW TERMINAL-NEUTRAL WEEK ${round.week}; NO RANDOMNESS OR WINNER`);
      const signed = await provider.signTransaction(transaction);
      if (await sha256Hex(signed.serializeMessage()) !== messageSha256) {
        throw new Error("Model T changed the simulated historical neutral recovery message");
      }
      const hardwareSignature = signed.signatures.find(({ publicKey: signer }) => signer.equals(publicKey));
      if (!hardwareSignature?.signature) throw new Error("Reviewed Model T signature is missing");
      if (!signed.verifySignatures()) throw new Error("Hardware-signed recovery failed local verification");
      setPending({
        signed,
        latest,
        messageSha256,
        round,
        kind: "neutral-backfill",
        evidenceBinding: current.evidenceBinding,
      });
      setStatus(`SIGNED NEUTRAL WEEK ${round.week} // NOT BROADCAST — USE THE SEPARATE BUTTON`);
    } catch (caught) {
      setStatus("HOLD // HISTORICAL NEUTRAL RECOVERY PREPARATION STOPPED");
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function broadcastSigned() {
    if (!pending || busy) return;
    setBusy(true);
    setError("");
    const action = pending.kind === "migration" ? "MIGRATION" : "TERMINAL-NEUTRAL RECOVERY";
    setStatus(`BROADCASTING USER-APPROVED DEVNET WEEK ${pending.round.week} ${action}`);
    try {
      const signature = await connection.sendRawTransaction(pending.signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: FINALIZED_COMMITMENT,
        maxRetries: 3,
      });
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash: pending.latest.blockhash,
        lastValidBlockHeight: pending.latest.lastValidBlockHeight,
      }, FINALIZED_COMMITMENT);
      if (confirmation.value.err) {
        throw new Error(`Migration confirmation failed: ${JSON.stringify(confirmation.value.err)}`);
      }
      const week = Number(pending.round.week);
      const canonicalAction = pending.kind === "migration"
        ? `MIGRATE_LEGACY_ROUND_WEEK_${week}`
        : `BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_${week}`;
      const canonicalTitle = pending.kind === "migration"
        ? `Migrate settled legacy CCC round week ${week}`
        : `Backfill terminal-neutral historical CCC round week ${week}`;
      const nextReceiptSet = persistAttendedReceipt(localStorage, pending.evidenceBinding, {
        action: canonicalAction,
        title: canonicalTitle,
        signature,
        messageSha256: pending.messageSha256,
        explorerUrl: explorer("tx", signature),
        finalizedAtUtc: new Date().toISOString(),
        kind: pending.kind,
        week,
      });
      setReceiptSet(nextReceiptSet);
      setPending(null);
      const next = await loadMigrationSnapshot(sha256Hex);
      setSnapshot(next);
      setStatus(snapshotStatus(next));
    } catch (caught) {
      setStatus("HOLD // MIGRATION BROADCAST FAILED");
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
    anchor.download = "iat-v2-current-source-migration-backfill-receipts.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function clearReceiptSet() {
    if (!snapshot?.evidenceBinding) return;
    clearAttendedReceipts(localStorage, snapshot.evidenceBinding);
    setReceiptSet(canonicalReceiptSet({ ...snapshot.evidenceBinding, receipts: [] }));
    setStatus("ALL LOCAL SOURCE-BOUND ATTENDED RECEIPTS CLEARED // ON-CHAIN STATE UNCHANGED");
  }

  return (
    <main className="console-shell">
      <aside className="rail">
        <a className="mark" href="https://internalagency.io/network" target="_blank" rel="noreferrer">
          IA<span>///</span>
        </a>
        <div className="rail-copy"><b>V2</b><span>MIGRATE</span><span>DEVNET</span></div>
        <div className="network-light"><i /> SOLANA DEVNET</div>
      </aside>
      <section className="workspace">
        <header className="hero">
          <div>
            <p>SETTLED ROUND COMPATIBILITY // DEVNET ONLY</p>
            <h1>MIGRATE<br /><em>WITHOUT GUESSING.</em></h1>
          </div>
          <div className="hero-state">
            <span>MAINNET</span><strong>HOLD</strong>
            <small>One physical Model T approval and one separate broadcast per round.</small>
          </div>
        </header>

        <section className="command">
          <div className="command-status">
            <small>STATUS</small>
            <strong>{status}</strong>
            {error && <p role="alert">{error}</p>}
          </div>
          <div className="command-actions">
            <button className="quiet" onClick={() => refresh().catch((caught) => setError(errorText(caught)))} disabled={busy || Boolean(pending)}>
              REFRESH READ-ONLY STATE
            </button>
          </div>
        </section>

        <section className="sequence">
          <div className="section-head compact">
            <div><p>EXACT INVENTORY</p><h2>MIGRATE SETTLED. NEUTRALIZE ABSENT.</h2></div>
            <span>{snapshot ? `${snapshot.legacy.length} LEGACY / ${snapshot.recoveries.filter((round) => !round.complete).length} ABSENT` : "VERIFYING"}</span>
          </div>
          <div className="address-grid">
            <div><span>PROGRAM</span><code>{IAT_V2_PROGRAM_ID.toBase58()}</code></div>
            <div><span>ADMIN</span><code>{IAT_V2_PROGRAM_ADMIN.toBase58()}</code></div>
            <div><span>CONFIG</span><code>{snapshot?.config.toBase58() ?? "NOT VERIFIED"}</code></div>
            <div><span>DEPLOYED ARTIFACT</span><code>{snapshot?.artifactSha256 ?? "NOT VERIFIED"}</code></div>
            <div><span>CURRENT CCC ROUND</span><code>{snapshot?.currentRound.toString() ?? "NOT VERIFIED"}</code></div>
            <div><span>FINALIZED DEVNET CLOCK</span><code>{snapshot?.chainTimestamp.toString() ?? "NOT VERIFIED"}</code></div>
          </div>
          {snapshot?.legacy.map((round) => (
            <div className="sign-panel" key={round.address.toBase58()}>
              <div>
                <small>SETTLED LEGACY WEEK {round.week.toString()}</small>
                <strong>{round.address.toBase58()}</strong>
                <p>Exact PDA, config, discriminator, 198-byte layout, and SETTLED status verified.</p>
              </div>
              {!pending && (
                <button onClick={() => simulateAndSignMigration(round.address)} disabled={busy}>
                  SIMULATE + SIGN WEEK {round.week.toString()}
                </button>
              )}
            </div>
          ))}
          {snapshot?.recoveries.map((round) => (
            <div className="sign-panel" key={round.address.toBase58()}>
              <div>
                <small>HISTORICAL WEEK {round.week.toString()} // {round.complete ? "TERMINAL NEUTRAL VERIFIED" : "PDA ABSENT"}</small>
                <strong>{round.address.toBase58()}</strong>
                <p>
                  Canonical selection {round.canonicalSelectionTimestamp.toString()} // neutral timeout {round.neutralRecoveryTimestamp.toString()}.
                  No oracle value, reroll, or selected winner; reward settlement uses the existing fair expected-value neutral rule.
                </p>
                <p>
                  PRIOR-WEEK PROOF {round.previousRoundAddress.toBase58()} // {round.previousProofReady ? "TERMINAL SNAPSHOT MATCH" : "HOLD UNTIL PRIOR ROUND IS HARDENED + TERMINAL"}
                </p>
              </div>
              {!pending && !round.complete && snapshot.legacy.length === 0 && (
                <button onClick={() => simulateAndSignBackfill(round.address)} disabled={busy || !round.eligible}>
                  {round.eligible
                    ? `SIMULATE + SIGN NEUTRAL WEEK ${round.week.toString()}`
                    : `HOLD WEEK ${round.week.toString()} // NOT HISTORICAL OR TIMEOUT PENDING`}
                </button>
              )}
            </div>
          ))}
          {pending && (
            <div className="sign-panel">
              <div>
                <small>SIGNED // NOT BROADCAST</small>
                <strong>WEEK {pending.round.week.toString()}</strong>
                <p><code>MESSAGE {pending.messageSha256}</code></p>
              </div>
              <div className="broadcast-panel">
                <button onClick={broadcastSigned} disabled={busy}>
                  BROADCAST SIGNED DEVNET {pending.kind === "migration" ? "MIGRATION" : "NEUTRAL RECOVERY"}
                </button>
                <button className="discard" onClick={() => {
                  setPending(null);
                  setStatus("SIGNED TRANSACTION DISCARDED // NOTHING BROADCAST");
                }} disabled={busy}>DISCARD SIGNED TRANSACTION</button>
              </div>
            </div>
          )}
        </section>

        {receiptSet?.receipts
          .filter((receipt) => ["migration", "neutral-backfill"].includes(receipt.kind))
          .map((receipt) => (
          <section className="evidence" key={receipt.signature}>
            <div><small>FINALIZED DEVNET {receipt.kind === "migration" ? "MIGRATION" : "NEUTRAL RECOVERY"} // WEEK {receipt.week}</small><strong>{short(receipt.signature, 12)}</strong></div>
            <a href={explorer("tx", receipt.signature)} target="_blank" rel="noreferrer">OPEN EXPLORER ↗</a>
          </section>
        ))}
        {receiptSet?.receipts.length > 0 && (
          <section className="command">
            <div className="command-status"><small>CANONICAL RECEIPTS</small><strong>{receiptSet.receipts.length} SOURCE-BOUND RECORD(S)</strong></div>
            <div className="command-actions">
              <button onClick={downloadReceiptSet} disabled={busy || Boolean(pending)}>EXPORT MIGRATION RECEIPTS</button>
              <button className="discard" onClick={clearReceiptSet} disabled={busy || Boolean(pending)}>CLEAR ALL LOCAL ATTENDED RECEIPTS</button>
            </div>
          </section>
        )}
        {snapshot?.legacy.length === 0 && snapshot.recoveries.every((round) => round.complete) && (
          <section className="command">
            <div className="command-status"><small>NEXT</small><strong>RUN THE FEATURE REHEARSAL</strong></div>
            <div className="command-actions"><a className="action-link" href="/?mode=features">OPEN FEATURE REHEARSAL</a></div>
          </section>
        )}
        {logs.length > 0 && (
          <details className="logs"><summary>LAST SIMULATION LOGS // {logs.length} LINES</summary><pre>{logs.join("\n")}</pre></details>
        )}
      </section>
    </main>
  );
}
