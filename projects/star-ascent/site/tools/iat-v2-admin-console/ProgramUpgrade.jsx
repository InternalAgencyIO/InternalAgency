import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Buffer } from "buffer";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  BPF_UPGRADEABLE_LOADER_ID,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BUILD_RUN_ID,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256,
  IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD,
  IAT_V2_MIGRATION_PROGRAM_EVIDENCE_MANIFEST_SHA256,
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
  createIatV2DevnetProgramCeremonyEvidenceBinding,
  parseIatV2DevnetProgramCeremonyBinding,
} from "../../programs/iat_v2/ceremony-binding.mjs";
import ceremonyRuntimeBindingJson from "../../scripts/data/iat-v2-devnet-program-ceremony-runtime-binding.json";
import {
  EXTEND_PROGRAM_CHECKED_FEATURE_ID,
  computeProgramDataExtension,
  inspectExtendProgramCheckedFeature,
} from "./program-extension.mjs";

const ProgramUpgradeAttendedActions = lazy(() => import("./ProgramUpgradeAttendedActions.jsx"));

const DEVNET_RPC = "https://api.devnet.solana.com";
const FINALIZED_COMMITMENT = "finalized";
const connection = new Connection(DEVNET_RPC, {
  commitment: FINALIZED_COMMITMENT,
  disableRetryOnRateLimit: true,
});
const BUFFER_METADATA_BYTES = 37;
const DEVNET_DEPLOYER = new PublicKey("DYURSZnNLak5YNt2vLJUnU5iWDUbAo53oUfzZ8dVc5d4");
const ATTENDED_CEREMONY_BINDING = parseIatV2DevnetProgramCeremonyBinding(
  ceremonyRuntimeBindingJson,
);

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
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
    owner: info.owner,
    authority: new PublicKey(data.subarray(5, 37)),
    programBytes: data.subarray(BUFFER_METADATA_BYTES),
  };
}

function statusForSnapshot(snapshot) {
  switch (snapshot.action) {
    case "complete":
      return "VERIFIED // CORRECTED PROGRAM ALREADY DEPLOYED";
    case "extend-program":
      return "CAPACITY EXTENSION REQUIRED // SIGNING RECOVERY NOT CHECKED";
    case "buffer-required":
      return "CAPACITY READY // VERIFIED BUFFER ADDRESS REQUIRED";
    case "return-for-repair":
      return "RECOVERY READY // RETURN INCOMPLETE BUFFER TO DEVNET DEPLOYER";
    case "repair-required":
      return "BUFFER RETURNED // RUN THE IN-PLACE REPAIR HELPER";
    case "handoff-required":
      return "BUFFER VERIFIED // HAND AUTHORITY BACK TO 7XZ";
    default:
      return "BUFFER VERIFIED // SIGNING RECOVERY NOT CHECKED";
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
  const [attendedLoaded, setAttendedLoaded] = useState(false);
  const [attendedLocked, setAttendedLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("WAITING FOR VERIFIED BUFFER ADDRESS");
  const [error, setError] = useState("");
  const local = isLocalOperatorHost(window.location.hostname);

  async function loadBufferSnapshot(minContextSlot = 0) {
    if (!local) throw new Error("Program upgrade console is localhost-only");
    if (!Number.isSafeInteger(minContextSlot) || minContextSlot < 0) {
      throw new Error("Program upgrade inspection requires a valid finalized minContextSlot");
    }
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
    const evidenceBinding = createIatV2DevnetProgramCeremonyEvidenceBinding({
      binding: ATTENDED_CEREMONY_BINDING,
      mint: evidenceMint.toBase58(),
    });
    const addresses = [
      IAT_V2_PROGRAM_ID,
      IAT_V2_PROGRAM_DATA_ADDRESS,
      EXTEND_PROGRAM_CHECKED_FEATURE_ID,
      ...(buffer ? [buffer] : []),
    ];
    const accountResult = await connection.getMultipleAccountsInfoAndContext(
      addresses,
      { commitment: FINALIZED_COMMITMENT, minContextSlot },
    );
    const finalizedContextSlot = accountResult.context?.slot;
    if (
      !Number.isSafeInteger(finalizedContextSlot)
      || finalizedContextSlot <= 0
      || finalizedContextSlot < minContextSlot
    ) {
      throw new Error("Program/buffer inspection did not return a monotonic finalized context slot");
    }
    const [programInfo, programDataInfo, extendFeatureInfo, bufferInfo = null] = accountResult.value;
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
    const programDataDeploymentSlot = Number(deployed.slot);
    if (
      !Number.isSafeInteger(programDataDeploymentSlot)
      || programDataDeploymentSlot <= 0
      || BigInt(programDataDeploymentSlot) !== deployed.slot
    ) {
      throw new Error("ProgramData deployment slot is outside the reviewed safe integer range");
    }
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
      bufferOwner: null,
      bufferProgramBytes: null,
      deployedRegionHash,
      programDataDeploymentSlot,
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
      finalizedContextSlot,
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
      bufferOwner: parsedBuffer.owner,
      bufferProgramBytes: parsedBuffer.programBytes.length,
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
    setError("");
    setStatus("VERIFYING PROGRAM CAPACITY + OPTIONAL BUFFER // NO SIGNING");
    try {
      const next = await loadBufferSnapshot();
      setSnapshot(next);
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
              disabled={busy || attendedLocked}
            />
            <button className="quiet" onClick={() => inspectBuffer().catch(() => {})} disabled={busy || attendedLocked}>
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
            <div><span>PROGRAMDATA</span><code className="full-code">{IAT_V2_PROGRAM_DATA_ADDRESS.toBase58()}</code></div>
            <div><span>UPGRADE AUTHORITY / ATTENDED SIGNER</span><code className="full-code">{IAT_V2_PROGRAM_ADMIN.toBase58()}</code></div>
            <div><span>ATTENDED CEREMONY SOURCE</span><code className="full-code">{ATTENDED_CEREMONY_BINDING.sourceHeadCommit ?? "UNBOUND // HOLD"}</code></div>
            <div><span>CEREMONY CI RUN / ATTEMPT</span><code>{ATTENDED_CEREMONY_BINDING.ciRunId ?? "UNBOUND"} / {ATTENDED_CEREMONY_BINDING.ciRunAttempt ?? "HOLD"}</code></div>
            <div><span>CEREMONY RUNTIME EVIDENCE SHA-256</span><code className="full-code">{ATTENDED_CEREMONY_BINDING.runtimeEvidenceManifestSha256 ?? "UNBOUND // HOLD"}</code></div>
            <div><span>IMMUTABLE ARTIFACT SOURCE</span><code className="full-code">{IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SOURCE_HEAD}</code></div>
            <div><span>ARTIFACT CI RUN / ATTEMPT</span><code>{IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BUILD_RUN_ID} / 1</code></div>
            <div><span>ARTIFACT EVIDENCE MANIFEST SHA-256</span><code className="full-code">{IAT_V2_MIGRATION_PROGRAM_EVIDENCE_MANIFEST_SHA256}</code></div>
            <div><span>BUFFER</span><code>{snapshot?.buffer?.toBase58() ?? "NOT PROVIDED"}</code></div>
            <div><span>FINALIZED BUFFER OWNER (OBSERVED)</span><code className="full-code">{snapshot?.bufferOwner?.toBase58() ?? "NOT VERIFIED"}</code></div>
            <div><span>FINALIZED BUFFER PROGRAM BYTES (OBSERVED)</span><code>{snapshot?.bufferProgramBytes ?? "NOT VERIFIED"}</code></div>
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
            <div><span>CI-BOUND ARTIFACT SHA-256</span><code className="full-code">{IAT_V2_MIGRATION_PROGRAM_ARTIFACT_SHA256}</code></div>
            <div><span>CI-BOUND ARTIFACT BYTES</span><code>{IAT_V2_MIGRATION_PROGRAM_ARTIFACT_BYTES}</code></div>
            <div><span>CURRENT PROGRAMDATA CAPACITY</span><code>{snapshot?.programDataCapacityBytes ?? "NOT VERIFIED"}</code></div>
            <div><span>ADDED CAPACITY</span><code>{snapshot?.additionalProgramDataBytes ?? "NOT VERIFIED"} BYTES</code></div>
            <div><span>EXACT RENT TOP-UP</span><code>{snapshot?.rentTopUpLamports ?? "NOT VERIFIED"} LAMPORTS</code></div>
            <div><span>EXTEND ABI</span><code>{snapshot ? (snapshot.extendProgramChecked ? "EXTEND_PROGRAM_CHECKED" : "EXTEND_PROGRAM") : "NOT VERIFIED"}</code></div>
          </div>
          {!attendedLoaded && (
            <div className="sign-panel">
              <div>
                <small>ATTENDED ACTION BOUNDARY</small>
                <strong>NOT LOADED</strong>
                <p>Buffer verification is not signing clearance. Loading checks retained ceremony records first; it does not request a signature or broadcast.</p>
              </div>
              <button onClick={() => setAttendedLoaded(true)} disabled={busy || !snapshot}>
                LOAD ATTENDED ACTIONS + RECEIPTS
              </button>
            </div>
          )}
        </section>

        {attendedLoaded && (
          <Suspense fallback={<section className="command"><strong>LOADING ISOLATED ATTENDED ACTIONS…</strong></section>}>
            <ProgramUpgradeAttendedActions
              connection={connection}
              finalizedCommitment={FINALIZED_COMMITMENT}
              getHardwareProvider={getHardwareProvider}
              inspectionBusy={busy}
              loadBufferSnapshot={loadBufferSnapshot}
              onLockChange={setAttendedLocked}
              setError={setError}
              setSnapshot={setSnapshot}
              setStatus={setStatus}
              sha256Hex={sha256Hex}
              short={short}
              snapshot={snapshot}
            />
          </Suspense>
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

      </section>
    </main>
  );
}
