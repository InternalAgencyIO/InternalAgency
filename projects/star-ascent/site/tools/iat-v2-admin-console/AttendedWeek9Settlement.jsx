import { useRef, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import {
  IAT_V2_WEEK9_STANDARD_ACCOUNT_METAS,
  IAT_V2_WEEK9_STANDARD_SETTLEMENT,
  assertIatV2Week9BroadcastReady,
  finalizeIatV2Week9StandardSettlement,
  prepareIatV2Week9StandardSettlement,
} from "../../programs/iat_v2/attended-settlement.mjs";
import {
  awaitFinalizedIatV2Week9Transaction,
  buildIatV2Week9StandardTransaction,
  canonicalizeIatV2Week9SignedTransaction,
  fetchFinalizedBlockhashAndFee,
  getFinalizedBlockHeight,
  observeFinalizedIatV2Week9State,
  sanitizedIatV2Week9Evidence,
  sendRawIatV2Week9TransactionOnce,
  signatureBase58FromSignedIatV2Week9Transaction,
  simulateExactIatV2Week9Transaction,
} from "./attended-settlement-browser.mjs";

const EVIDENCE_KEY = "iat-v2-week9-attended-standard-settlement-evidence/devnet/v1";
const BROADCAST_LATCH_KEY = "iat-v2-week9-attended-standard-settlement-broadcast-latch/devnet/v1";
const SIGN_LATCH_KEY = "iat-v2-week9-attended-standard-settlement-sign-latch/devnet/v1";
const WORKFLOW_KEY = "iat-v2-week9-attended-standard-settlement-reconcile/devnet/v1";
const REQUIRED_SIGNER = new PublicKey(IAT_V2_WEEK9_STANDARD_SETTLEMENT.requiredSigner);

function loadStoredEvidence() {
  try {
    const value = JSON.parse(localStorage.getItem(EVIDENCE_KEY) ?? "null");
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function loadBroadcastLatch() {
  try {
    const value = JSON.parse(localStorage.getItem(BROADCAST_LATCH_KEY) ?? "null");
    return value && typeof value === "object" ? value : null;
  } catch {
    return { status: "HOLD_MALFORMED_PERSISTENT_BROADCAST_LATCH" };
  }
}

function loadSignLatch() {
  try {
    const value = JSON.parse(localStorage.getItem(SIGN_LATCH_KEY) ?? "null");
    return value && typeof value === "object" ? value : null;
  } catch {
    return { status: "HOLD_MALFORMED_PERSISTENT_SIGN_LATCH" };
  }
}

function workflowJson(value) {
  return JSON.stringify(value, (key, item) => {
    if (/secret|private|path|wire|messageBytes|signedTransaction|serialized/iu.test(key)) return undefined;
    if (typeof item === "bigint") return { __iatBigInt: item.toString() };
    if (item instanceof PublicKey) return item.toBase58();
    if (item instanceof Uint8Array) return undefined;
    return item;
  });
}

function loadWorkflow() {
  try {
    const value = JSON.parse(localStorage.getItem(WORKFLOW_KEY) ?? "null", (_key, item) => (
      item
      && typeof item === "object"
      && Object.keys(item).length === 1
      && /^-?\d+$/u.test(item.__iatBigInt)
        ? BigInt(item.__iatBigInt)
        : item
    ));
    return value?.schema === "iat-v2-week9-attended-reconcile/v1" ? value : null;
  } catch {
    return null;
  }
}

function deepFreezePlain(value) {
  if (!value || typeof value !== "object" || ArrayBuffer.isView(value)) return value;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) return value;
  for (const child of Object.values(value)) deepFreezePlain(child);
  return Object.freeze(value);
}

function assertUnsignedExactTransaction(transaction) {
  const wireBytes = transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).length;
  if (transaction.instructions.length !== 1 || transaction.signatures.length !== 1) {
    throw new Error("Prepared legacy transaction does not have exactly one instruction and signer");
  }
  const [signature] = transaction.signatures;
  if (!signature.publicKey.equals(REQUIRED_SIGNER) || signature.signature !== null) {
    throw new Error("Prepared transaction is not exactly unsigned for 7XZ");
  }
  if (wireBytes > 1_232) throw new Error(`Prepared transaction is ${wireBytes} bytes, above Solana's limit`);
}

function stringify(value) {
  return JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item, 2);
}

function expectedDeltas(review) {
  const pre = review.preState;
  const post = review.expectedPost;
  return Object.freeze({
    rewardBaseUnits: post.reward,
    signerLamports: post.signerLamports - pre.signerLamports,
    positionPaid: post.position.paid - pre.position.paid,
    positionSettledMask: `${pre.position.settledMask} -> ${post.position.settledMask}`,
    positionTreasuryReserved: post.position.treasuryReserved - pre.position.treasuryReserved,
    treasuryLaneReserved: post.lanes.treasury.reserved - pre.lanes.treasury.reserved,
    treasuryLanePaid: post.lanes.treasury.paid - pre.lanes.treasury.paid,
    destinationTokens: post.tokenBalances.destination - pre.tokenBalances.destination,
    treasuryTokens: post.tokenBalances.treasury - pre.tokenBalances.treasury,
    ecosystemTokens: post.tokenBalances.ecosystem - pre.tokenBalances.ecosystem,
    liquidityTokens: post.tokenBalances.liquidity - pre.tokenBalances.liquidity,
  });
}

function evidencePayload({ review, phase, finalEvidence, signature }) {
  if (!review) return null;
  return sanitizedIatV2Week9Evidence({
    schema: "iat-v2-week9-attended-standard-settlement-browser-evidence/v1",
    status: finalEvidence?.status ?? phase,
    network: IAT_V2_WEEK9_STANDARD_SETTLEMENT.network,
    rpc: IAT_V2_WEEK9_STANDARD_SETTLEMENT.rpc,
    commitment: IAT_V2_WEEK9_STANDARD_SETTLEMENT.commitment,
    identity: review.identity,
    deploymentObservationSlot: review.preState.contextSlot,
    blockhashContextSlot: review.blockhash.contextSlot,
    simulationSlot: review.simulationSlot,
    revalidationSlot: review.revalidationSlot,
    preBroadcastSimulationSlot: review.preBroadcastSimulationSlot,
    finalizedSlot: finalEvidence?.finalizedSlot,
    replayCustomError: finalEvidence?.replayCustomError,
    signature,
    messageSha256: review.messageSha256,
    messageHex: review.messageHex,
    feeLamports: review.feeLamports,
    accountMetas: IAT_V2_WEEK9_STANDARD_ACCOUNT_METAS,
    expectedDeltas: expectedDeltas(review),
    exportedAtUtc: new Date().toISOString(),
    secretMaterialIncluded: false,
    signedTransactionIncluded: false,
    cccRoundAccountIncluded: false,
    broadcastIsUserAttended: true,
  });
}

export default function AttendedWeek9Settlement({
  explorer,
  getHardwareProvider,
  localOperator,
  sha256Hex,
}) {
  const [tabId] = useState(() => crypto.randomUUID());
  const [broadcastLatch, setBroadcastLatch] = useState(loadBroadcastLatch);
  const [signLatch, setSignLatch] = useState(loadSignLatch);
  const [storedWorkflow, setStoredWorkflow] = useState(loadWorkflow);
  const [phase, setPhase] = useState(broadcastLatch
    ? "RECONCILE_ONLY_PERSISTENT_BROADCAST_LATCH"
    : "IDLE_NOT_SIGNED_NOT_BROADCAST");
  const [status, setStatus] = useState(broadcastLatch
    ? "HOLD // A PRIOR BROADCAST ATTEMPT EXISTS; THIS PAGE WILL NOT SEND AGAIN"
    : "READY FOR FINALIZED READ-ONLY PREPARATION");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(broadcastLatch ? storedWorkflow?.review ?? null : null);
  const [preparedReview, setPreparedReview] = useState(null);
  const [unsignedTransaction, setUnsignedTransaction] = useState(null);
  const [signedTransaction, setSignedTransaction] = useState(null);
  const [finalEvidence, setFinalEvidence] = useState(null);
  const [signature, setSignature] = useState(null);
  const [logs, setLogs] = useState([]);
  const [storedEvidence, setStoredEvidence] = useState(loadStoredEvidence);
  const [signPromptUsed, setSignPromptUsed] = useState(false);
  const signPromptConsumed = useRef(false);
  const broadcastConsumed = useRef(Boolean(broadcastLatch));

  function persistWorkflow(nextReview) {
    const checkpoint = {
      schema: "iat-v2-week9-attended-reconcile/v1",
      review: nextReview,
      messageByteLength: nextReview.messageBytes?.length ?? Math.floor(nextReview.messageHex.length / 2),
      storedAtUtc: new Date().toISOString(),
      secretMaterialIncluded: false,
      signedWireIncluded: false,
    };
    localStorage.setItem(WORKFLOW_KEY, workflowJson(checkpoint));
    setStoredWorkflow(checkpoint);
  }

  function persist(nextReview, nextPhase, nextFinalEvidence = null, nextSignature = null) {
    const payload = evidencePayload({
      review: nextReview,
      phase: nextPhase,
      finalEvidence: nextFinalEvidence,
      signature: nextSignature,
    });
    if (!payload) return;
    localStorage.setItem(EVIDENCE_KEY, JSON.stringify(payload));
    setStoredEvidence(payload);
  }

  async function prepareReadOnly() {
    if (busy || !localOperator || broadcastLatch || signLatch) return;
    setBusy(true);
    setError("");
    setLogs([]);
    setStatus("FINALIZED READ // PINNING 634d DEPLOYMENT + WEEK-9 PRE-STATE");
    setReview(null);
    setPreparedReview(null);
    setUnsignedTransaction(null);
    setSignedTransaction(null);
    setFinalEvidence(null);
    setSignature(null);
    signPromptConsumed.current = false;
    setSignPromptUsed(false);
    try {
      const observed = await observeFinalizedIatV2Week9State({ sha256Hex });
      setStatus("FINALIZED READ // FRESH BLOCKHASH + EXACT MESSAGE FEE");
      const preparedMessage = await fetchFinalizedBlockhashAndFee({
        minContextSlot: observed.preState.contextSlot,
      });
      assertUnsignedExactTransaction(preparedMessage.transaction);
      setStatus("RAW RPC SIMULATION // UNSIGNED EXACT WIRE // NO BLOCKHASH REPLACEMENT");
      const simulated = await simulateExactIatV2Week9Transaction({
        transaction: preparedMessage.transaction,
        sha256Hex,
        sigVerify: false,
        minContextSlot: observed.preState.contextSlot,
      });
      setLogs(simulated.simulation.logs);
      const preparedReview = deepFreezePlain(await prepareIatV2Week9StandardSettlement({
        transaction: preparedMessage.transaction,
        sha256Hex,
        programDeployment: observed.programDeployment,
        preState: observed.preState,
        blockhash: preparedMessage.blockhash,
        feeLamports: preparedMessage.feeLamports,
        simulation: simulated.simulation,
      }));
      setReview(preparedReview);
      setPreparedReview(preparedReview);
      setUnsignedTransaction(preparedMessage.transaction);
      setPhase(preparedReview.status);
      setStatus("REVIEW COMPLETE // NOTHING SIGNED // NOTHING BROADCAST");
      persist(preparedReview, preparedReview.status);
    } catch (caught) {
      setPhase("HOLD_PREPARATION_FAILED");
      setStatus("HOLD // READ-ONLY PREPARATION FAILED");
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function requestOneTrezorSignature() {
    if (
      busy
      || !review
      || !preparedReview
      || !unsignedTransaction
      || signedTransaction
      || signPromptConsumed.current
      || signLatch
    ) return;
    signPromptConsumed.current = true;
    setSignPromptUsed(true);
    if (typeof navigator.locks?.request !== "function") {
      setPhase("HOLD_WEB_LOCKS_UNAVAILABLE");
      setStatus("HOLD // EXCLUSIVE CROSS-TAB SIGNING LOCK IS UNAVAILABLE");
      return;
    }
    try {
      await navigator.locks.request(SIGN_LATCH_KEY, {
        mode: "exclusive",
        ifAvailable: true,
      }, async (lock) => {
        if (!lock) {
          setPhase("HOLD_SIGN_LOCK_BUSY");
          setStatus("HOLD // ANOTHER TAB OWNS THE ATTENDED SIGNING LOCK");
          return;
        }
        const existingLatch = loadSignLatch();
        if (existingLatch) {
          setSignLatch(existingLatch);
          setPhase("HOLD_PERSISTENT_SIGN_LATCH");
          setStatus("HOLD // ANOTHER TAB ALREADY ENTERED THE TREZOR PROMPT");
          return;
        }
        const enteredLatch = {
          schema: "iat-v2-week9-attended-standard-settlement-sign-latch/v1",
          status: "TREZOR_SIGNATURE_PROMPT_ENTERED",
          messageSha256: preparedReview.messageSha256,
          tabId,
          enteredAtUtc: new Date().toISOString(),
        };
        localStorage.setItem(SIGN_LATCH_KEY, JSON.stringify(enteredLatch));
        setSignLatch(enteredLatch);
        await signUnderExclusiveLock(enteredLatch);
      });
    } catch (caught) {
      setPhase("HOLD_SIGN_LOCK_FAILED");
      setStatus("HOLD // EXCLUSIVE SIGNING LOCK FAILED");
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function signUnderExclusiveLock(enteredLatch) {
    setBusy(true);
    setError("");
    setStatus(`TREZOR // ONE SIGNATURE PROMPT FOR ${IAT_V2_WEEK9_STANDARD_SETTLEMENT.requiredSigner}`);
    try {
      const { provider, publicKey } = await getHardwareProvider(REQUIRED_SIGNER);
      if (!publicKey.equals(REQUIRED_SIGNER) || provider?.isTrezor !== true) {
        throw new Error("Exact required Model T account was not returned");
      }
      // This is deliberately the only hardware signing call in this component.
      const returnedSigned = await provider.signTransaction(unsignedTransaction);
      const signed = await canonicalizeIatV2Week9SignedTransaction({
        reviewedUnsignedTransaction: unsignedTransaction,
        returnedSignedTransaction: returnedSigned,
        expectedMessageSha256: review.messageSha256,
        expectedMessageHex: review.messageHex,
        sha256Hex,
      });
      setStatus("SIGNED LOCALLY // IMMEDIATE FINALIZED STATE REVALIDATION");
      const revalidated = await observeFinalizedIatV2Week9State({
        minContextSlot: review.preState.contextSlot,
        sha256Hex,
      });
      const latestBlockHeight = await getFinalizedBlockHeight();
      setStatus("SIGNED RAW RPC SIMULATION // SIGVERIFY TRUE // STILL NOT BROADCAST");
      const simulated = await simulateExactIatV2Week9Transaction({
        transaction: signed,
        sha256Hex,
        sigVerify: true,
        minContextSlot: revalidated.preState.contextSlot,
      });
      setLogs(simulated.simulation.logs);
      const readyReview = deepFreezePlain(await assertIatV2Week9BroadcastReady({
        review: preparedReview,
        signedTransaction: signed,
        sha256Hex,
        latestBlockHeight,
        revalidatedPreState: revalidated.preState,
        simulation: simulated.simulation,
      }));
      setReview(readyReview);
      setSignedTransaction(signed);
      setPhase(readyReview.status);
      setStatus("SIGNED + REVALIDATED + SIMULATED // SEPARATE BROADCAST CLICK REQUIRED");
      persist(readyReview, readyReview.status);
      persistWorkflow(readyReview);
      const completedSignLatch = { ...enteredLatch, status: "ONE_TREZOR_SIGNATURE_VERIFIED" };
      localStorage.setItem(SIGN_LATCH_KEY, JSON.stringify(completedSignLatch));
      setSignLatch(completedSignLatch);
    } catch (caught) {
      setSignedTransaction(null);
      setPhase("HOLD_SIGNATURE_OR_REVALIDATION_FAILED");
      setStatus("HOLD // SIGNATURE CONSUMED; PREPARE A FRESH MESSAGE TO RETRY");
      setError(caught instanceof Error ? caught.message : String(caught));
      const failedSignLatch = { ...enteredLatch, status: "TREZOR_PROMPT_FAILED_OR_RESULT_UNKNOWN" };
      localStorage.setItem(SIGN_LATCH_KEY, JSON.stringify(failedSignLatch));
      setSignLatch(failedSignLatch);
    } finally {
      setBusy(false);
    }
  }

  async function broadcastExactlyOnce() {
    if (busy || !review || !signedTransaction || broadcastConsumed.current) return;
    broadcastConsumed.current = true;
    if (typeof navigator.locks?.request !== "function") {
      setPhase("HOLD_WEB_LOCKS_UNAVAILABLE");
      setStatus("HOLD // EXCLUSIVE CROSS-TAB BROADCAST LOCK IS UNAVAILABLE");
      return;
    }
    try {
      await navigator.locks.request(BROADCAST_LATCH_KEY, {
        mode: "exclusive",
        ifAvailable: true,
      }, async (lock) => {
        if (!lock) {
          setPhase("HOLD_BROADCAST_LOCK_BUSY");
          setStatus("HOLD // ANOTHER TAB OWNS THE ATTENDED BROADCAST LOCK");
          return;
        }
        const existingLatch = loadBroadcastLatch();
        if (existingLatch) {
          setBroadcastLatch(existingLatch);
          setPhase("RECONCILE_ONLY_PERSISTENT_BROADCAST_LATCH");
          setStatus("HOLD // ANOTHER TAB ALREADY ENTERED THE BROADCAST BOUNDARY");
          return;
        }
        await broadcastUnderExclusiveLock();
      });
    } catch (caught) {
      setPhase("HOLD_BROADCAST_LOCK_FAILED");
      setStatus("HOLD // EXCLUSIVE BROADCAST LOCK FAILED");
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function broadcastUnderExclusiveLock() {
    setBusy(true);
    setError("");
    try {
      setStatus("FINAL PRE-SEND GATE // REVALIDATING DEPLOYMENT + STATE INSIDE EXCLUSIVE LOCK");
      const revalidated = await observeFinalizedIatV2Week9State({
        minContextSlot: review.revalidationSlot,
        sha256Hex,
      });
      const latestBlockHeight = await getFinalizedBlockHeight();
      setStatus("FINAL PRE-SEND GATE // SIGNED RAW SIMULATION INSIDE EXCLUSIVE LOCK");
      const simulated = await simulateExactIatV2Week9Transaction({
        transaction: signedTransaction,
        sha256Hex,
        sigVerify: true,
        minContextSlot: revalidated.preState.contextSlot,
      });
      const freshReview = deepFreezePlain(await assertIatV2Week9BroadcastReady({
        review: preparedReview,
        signedTransaction,
        sha256Hex,
        latestBlockHeight,
        revalidatedPreState: revalidated.preState,
        simulation: simulated.simulation,
      }));
      setReview(freshReview);
      setLogs(simulated.simulation.logs);
      persistWorkflow(freshReview);

      const expectedSignature = signatureBase58FromSignedIatV2Week9Transaction(signedTransaction);
      const signedWire = signedTransaction.serialize({ requireAllSignatures: true, verifySignatures: true });
      const enteredLatch = {
        schema: "iat-v2-week9-attended-standard-settlement-broadcast-latch/v1",
        status: "BROADCAST_RPC_ENTERED_RESULT_UNKNOWN",
        messageSha256: freshReview.messageSha256,
        signature: expectedSignature,
        enteredAtUtc: new Date().toISOString(),
      };
      localStorage.setItem(BROADCAST_LATCH_KEY, JSON.stringify(enteredLatch));
      setBroadcastLatch(enteredLatch);
      setSignature(expectedSignature);
      setStatus("ONE RAW DEVNET BROADCAST // DERIVED SIGNATURE PERSISTED // NO RETRY");
      let sendOutcomeError = null;
      try {
        const broadcast = await sendRawIatV2Week9TransactionOnce({
          signedTransaction,
          minContextSlot: freshReview.revalidationSlot,
        });
        if (broadcast.signature !== expectedSignature) {
          throw new Error("RPC returned a signature different from the locally derived signature");
        }
      } catch (caught) {
        sendOutcomeError = caught;
      }
      const reconcileLatch = {
        ...enteredLatch,
        status: sendOutcomeError
          ? "BROADCAST_RESULT_AMBIGUOUS_RECONCILE_ONLY"
          : "BROADCAST_RPC_RETURNED_RECONCILE_ONLY",
      };
      localStorage.setItem(BROADCAST_LATCH_KEY, JSON.stringify(reconcileLatch));
      setBroadcastLatch(reconcileLatch);
      setStatus("RECONCILE ONLY // POLLING LOCALLY DERIVED SIGNATURE // NEVER RESENDING");
      try {
        await completeFinalizedEvidence({
          activeReview: freshReview,
          activeSignedTransaction: signedTransaction,
          expectedSignature,
          signedWire,
          reconcileLatch,
        });
      } catch (caught) {
        if (sendOutcomeError) {
          throw new Error(
            `Broadcast result was ambiguous (${sendOutcomeError instanceof Error ? sendOutcomeError.message : String(sendOutcomeError)}); ${caught instanceof Error ? caught.message : String(caught)}`,
          );
        }
        throw caught;
      }
    } catch (caught) {
      const enteredBroadcast = Boolean(loadBroadcastLatch());
      setPhase(enteredBroadcast ? "HOLD_AFTER_BROADCAST_ATTEMPT" : "HOLD_PRE_BROADCAST_REVALIDATION");
      setStatus(enteredBroadcast
        ? "HOLD // POLL-ONLY RECONCILIATION REMAINS AVAILABLE; BROADCAST WILL NOT RETRY"
        : "HOLD // FRESHNESS CHECK FAILED BEFORE BROADCAST; DISCARD + SIGN A FRESH MESSAGE");
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function completeFinalizedEvidence({
    activeReview,
    activeSignedTransaction,
    expectedSignature,
    signedWire,
    reconcileLatch,
  }) {
    const finalized = await awaitFinalizedIatV2Week9Transaction({
      signature: expectedSignature,
      signedWire,
    });
    const canonicalFinalizedTransaction = await canonicalizeIatV2Week9SignedTransaction({
      reviewedUnsignedTransaction: buildIatV2Week9StandardTransaction(activeReview.blockhash.blockhash),
      returnedSignedTransaction: finalized.finalizedTransaction,
      expectedMessageSha256: activeReview.messageSha256,
      expectedMessageHex: activeReview.messageHex,
      expectedSignedWire: finalized.finalizedWire,
      sha256Hex,
    });
    setStatus("FINALIZED // READING EXACT POST-STATE");
    const post = await observeFinalizedIatV2Week9State({
      minContextSlot: finalized.transactionResult.slot,
      sha256Hex,
    });
    setStatus("FRESH BLOCKHASH REPLAY // EXPECTING CUSTOM 6041");
    const replayMessage = await fetchFinalizedBlockhashAndFee({
      minContextSlot: post.preState.contextSlot,
    });
    if (replayMessage.blockhash.blockhash === activeReview.blockhash.blockhash) {
      throw new Error("Replay blockhash was not fresh");
    }
    const replay = await simulateExactIatV2Week9Transaction({
      transaction: replayMessage.transaction,
      sha256Hex,
      sigVerify: false,
      minContextSlot: post.preState.contextSlot,
    });
    if (replay.simulation.err?.InstructionError?.[0] !== 0) {
      throw new Error("Replay rejection did not occur at the only reviewed instruction index");
    }
    setLogs(replay.simulation.logs);
    const completed = await finalizeIatV2Week9StandardSettlement({
      review: activeReview,
      signedTransaction: activeSignedTransaction ?? canonicalFinalizedTransaction,
      finalizedTransaction: canonicalFinalizedTransaction,
      sha256Hex,
      signature: expectedSignature,
      transactionResult: finalized.transactionResult,
      localBroadcastReceipts: [{ method: "sendRawTransaction", signature: expectedSignature }],
      postState: post.preState,
      replayTransaction: replayMessage.transaction,
      replaySimulation: replay.simulation,
    });
    setReview(activeReview);
    setSignature(expectedSignature);
    setFinalEvidence(completed);
    setPhase(completed.status);
    setStatus("COMPLETE // FINALIZED EXACT DELTAS + FRESH REPLAY CUSTOM 6041");
    persist(activeReview, completed.status, completed, expectedSignature);
    const completedLatch = { ...reconcileLatch, status: completed.status };
    localStorage.setItem(BROADCAST_LATCH_KEY, JSON.stringify(completedLatch));
    setBroadcastLatch(completedLatch);
  }

  async function reconcilePersistedBroadcast() {
    if (busy || !broadcastLatch?.signature || !storedWorkflow?.review) return;
    setBusy(true);
    setError("");
    setStatus("RECONCILE ONLY // POLLING PERSISTED SIGNATURE // NO SEND METHOD IS REACHABLE");
    try {
      if (broadcastLatch.messageSha256 !== storedWorkflow.review.messageSha256) {
        throw new Error("Persistent broadcast latch and reviewed message do not match");
      }
      await completeFinalizedEvidence({
        activeReview: storedWorkflow.review,
        activeSignedTransaction: null,
        expectedSignature: broadcastLatch.signature,
        signedWire: null,
        reconcileLatch: broadcastLatch,
      });
    } catch (caught) {
      setPhase("HOLD_RECONCILIATION_INCOMPLETE");
      setStatus("HOLD // SIGNATURE NOT YET FINALIZED; BROADCAST REMAINS PERMANENTLY DISABLED");
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  function discardAndRestart() {
    if (broadcastLatch) return;
    if (signLatch && signLatch.tabId !== tabId) {
      setPhase("HOLD_SIGN_LATCH_OWNED_BY_ANOTHER_TAB");
      setStatus("HOLD // ONLY THE TAB THAT ENTERED THE TREZOR PROMPT MAY DISCARD IT");
      return;
    }
    setReview(null);
    setPreparedReview(null);
    setUnsignedTransaction(null);
    setSignedTransaction(null);
    setFinalEvidence(null);
    setSignature(null);
    setLogs([]);
    setError("");
    setPhase("IDLE_NOT_SIGNED_NOT_BROADCAST");
    setStatus("DISCARDED IN MEMORY // PREPARE A FRESH FINALIZED MESSAGE");
    signPromptConsumed.current = false;
    setSignPromptUsed(false);
    broadcastConsumed.current = false;
    localStorage.removeItem(SIGN_LATCH_KEY);
    localStorage.removeItem(WORKFLOW_KEY);
    setSignLatch(null);
    setStoredWorkflow(null);
  }

  function downloadEvidence() {
    if (!storedEvidence) return;
    const blob = new Blob([`${stringify(storedEvidence)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "iat-v2-week9-attended-standard-settlement-evidence.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const deltas = review ? expectedDeltas(review) : null;
  return (
    <main className="console-shell attended-shell">
      <section className="console-frame">
        <header className="attended-hero">
          <p>ATTENDED DEVNET ONLY // STANDARD POSITION // POLICY WEEK 9</p>
          <h1>ONE MESSAGE.<br />ONE TREZOR PROMPT.<br />ONE BROADCAST.</h1>
          <div className="warning-band">
            <strong>634d DEPLOYMENT ONLY</strong>
            <span>CCC round accounts are excluded. No upgrade path is present.</span>
          </div>
        </header>

        <section className="feature-command attended-command">
          <div>
            <small>FAIL-CLOSED STATUS</small>
            <strong>{status}</strong>
            <code>{phase}</code>
            {error && <p role="alert">{error}</p>}
          </div>
          {!review ? (
            <button
              onClick={prepareReadOnly}
              disabled={busy || !localOperator || Boolean(broadcastLatch) || Boolean(signLatch)}
            >
              {busy ? "READING FINALIZED STATE…" : "PREPARE + RAW-SIMULATE (READ ONLY)"}
            </button>
          ) : (
            <button className="quiet" onClick={discardAndRestart} disabled={busy || Boolean(broadcastLatch)}>
              DISCARD + START WITH FRESH BLOCKHASH
            </button>
          )}
        </section>

        {!localOperator && (
          <p role="alert" className="attended-hold">HOLD: this attended console is enabled only on localhost.</p>
        )}

        {broadcastLatch && !finalEvidence && (
          <div role="alert" className="attended-hold">
            <p>
              PERSISTENT HOLD: {broadcastLatch.status}. A previous network-send boundary was entered, so this
              console is reconcile-only and will never retry the broadcast.
            </p>
            {broadcastLatch.signature && storedWorkflow?.review && (
              <button onClick={reconcilePersistedBroadcast} disabled={busy}>
                POLL FINALIZED SIGNATURE + COMPLETE EVIDENCE (NO SEND)
              </button>
            )}
          </div>
        )}

        {signLatch && !signedTransaction && !broadcastLatch && (
          <div role="alert" className="attended-hold">
            <p>PERSISTENT SIGN HOLD: {signLatch.status}. No second tab or rerender can prompt the Trezor again.</p>
            {signLatch.tabId === tabId && (
              <button onClick={discardAndRestart} disabled={busy}>
                EXPLICITLY DISCARD THIS MESSAGE + PREPARE A FRESH ONE
              </button>
            )}
          </div>
        )}

        {review && (
          <>
            <section className="attended-review">
              <div className="section-head compact">
                <div><p>EXACT MESSAGE REVIEW</p><h2>FULL BYTES, NOT A SUMMARY.</h2></div>
                <span>{review.messageBytes?.length ?? storedWorkflow?.messageByteLength ?? Math.floor(review.messageHex.length / 2)} BYTES</span>
              </div>
              <label>MESSAGE SHA-256</label>
              <code className="full-code">{review.messageSha256}</code>
              <label>MESSAGE HEX</label>
              <pre className="message-hex">{review.messageHex}</pre>
              <div className="feature-metrics attended-metrics">
                <div><small>FEE</small><strong>{review.feeLamports.toString()} LAMPORTS</strong></div>
                <div><small>METAS</small><strong>{IAT_V2_WEEK9_STANDARD_ACCOUNT_METAS.length}</strong></div>
                <div><small>PRE-STATE SLOT</small><strong>{review.preState.contextSlot}</strong></div>
                <div><small>SIMULATION SLOT</small><strong>{review.simulationSlot}</strong></div>
                <div><small>UNITS</small><strong>{review.unitsConsumed}</strong></div>
                <div><small>BLOCKHASH</small><strong>{review.blockhash.contextSlot}</strong></div>
              </div>
            </section>

            <section className="attended-grid">
              <div>
                <h3>14 EXACT ACCOUNT METAS</h3>
                <ol className="meta-list">
                  {IAT_V2_WEEK9_STANDARD_ACCOUNT_METAS.map((meta, index) => (
                    <li key={meta.address}>
                      <b>{String(index).padStart(2, "0")}</b>
                      <code>{meta.address}</code>
                      <span>{meta.signer ? "SIGNER" : "—"} // {meta.writable ? "WRITE" : "READ"}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <h3>EXPECTED EXACT DELTAS</h3>
                <dl className="delta-list">
                  {Object.entries(deltas).map(([label, value]) => (
                    <div key={label}><dt>{label}</dt><dd>{value.toString()}</dd></div>
                  ))}
                </dl>
              </div>
            </section>

            <section className="sign-panel attended-sign-panel">
              <div>
                <small>HARDWARE BOUNDARY</small>
                <strong>{IAT_V2_WEEK9_STANDARD_SETTLEMENT.requiredSigner}</strong>
                <p>Signing does not broadcast. The exact message above is rehashed and verified locally before any new RPC read.</p>
              </div>
              {!signedTransaction ? (
                <button
                  onClick={requestOneTrezorSignature}
                  disabled={busy || signPromptUsed || Boolean(signLatch) || phase !== "SIMULATED_NOT_SIGNED_NOT_BROADCAST"}
                >
                  {busy ? "ATTENDED CHECK RUNNING…" : "REQUEST ONE TREZOR SIGNATURE"}
                </button>
              ) : (
                <div className="broadcast-panel">
                  <code>LOCAL SIGNATURE VERIFIED</code>
                  <code>SIGNED RAW SIMULATION VERIFIED</code>
                  <button
                    onClick={broadcastExactlyOnce}
                    disabled={busy || Boolean(broadcastLatch) || phase !== "SIGNED_SIMULATED_READY_FOR_ONE_BROADCAST"}
                  >
                    BROADCAST EXACT SIGNED DEVNET WIRE ONCE
                  </button>
                </div>
              )}
            </section>
          </>
        )}

        {finalEvidence && signature && (
          <section className="evidence attended-complete">
            <div>
              <small>FINALIZED + REPLAY-PROTECTED</small>
              <strong>{finalEvidence.status}</strong>
              <a href={explorer("tx", signature)} target="_blank" rel="noreferrer">{signature} ↗</a>
            </div>
            <button onClick={downloadEvidence}>DOWNLOAD SANITIZED EVIDENCE</button>
          </section>
        )}

        {logs.length > 0 && (
          <details className="logs">
            <summary>LAST RAW RPC SIMULATION // {logs.length} LINES</summary>
            <pre>{logs.join("\n")}</pre>
          </details>
        )}

        <footer>
          <span>RPC // PINNED DEVNET</span>
          <span>COMMITMENT // FINALIZED</span>
          <span>AUTO-SIGN // IMPOSSIBLE</span>
          <span>AUTO-BROADCAST // IMPOSSIBLE</span>
        </footer>
      </section>
    </main>
  );
}
