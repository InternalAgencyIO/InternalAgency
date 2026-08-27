import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Connection } from "@solana/web3.js";

const consoleRoot = new URL("../tools/iat-v2-admin-console/", import.meta.url);
const [programShellSource, programSource, migrationSource, featureSource] = await Promise.all([
  readFile(new URL("ProgramUpgrade.jsx", consoleRoot), "utf8"),
  readFile(new URL("ProgramUpgradeAttendedActions.jsx", consoleRoot), "utf8"),
  readFile(new URL("LegacyRoundMigration.jsx", consoleRoot), "utf8"),
  readFile(new URL("FeatureRehearsal.jsx", consoleRoot), "utf8"),
]);

function section(source, start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first + start.length);
  assert.ok(first >= 0, `source section start is missing: ${start}`);
  assert.ok(last > first, `source section end is missing after ${start}: ${end}`);
  return source.slice(first, last);
}

function count(source, token) {
  return source.split(token).length - 1;
}

function assertBefore(source, first, second, label) {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  assert.ok(firstIndex >= 0, `${label}: missing ${first}`);
  assert.ok(secondIndex > firstIndex, `${label}: ${second} does not follow ${first}`);
}

test("each canonical surface owns one session coordinator and one verified hardware callback", () => {
  const surfaces = [
    [programSource, "async function requestProgramModelTSignature", "function errorText"],
    [migrationSource, "async function requestRoundModelTSignature", "export function canonicalCccSelectionTimestamp"],
    [featureSource, "async function requestFeatureModelTSignature", "function assertFeaturePromptOrder"],
  ];
  for (const [source, helperStart, helperEnd] of surfaces) {
    assert.equal(count(source, "useState(createAttendedModelTPromptCoordinator)"), 1);
    assert.equal(count(source, "provider.signTransaction(transaction)"), 1);
    const helper = section(source, helperStart, helperEnd);
    assert.match(
      helper,
      /coordinator\.request\(\{[\s\S]*binding,[\s\S]*action,[\s\S]*messageSha256,[\s\S]*signer: signer\.toBase58\(\),[\s\S]*prompt: async \(\) =>/u,
    );
    assertBefore(helper, "await provider.signTransaction(transaction)", "await verifySigned(signed)", helperStart);
    assertBefore(helper, "await verifySigned(signed)", "return signed", helperStart);
  }

  const programHelper = section(
    programSource,
    "async function requestProgramModelTSignature",
    "function errorText",
  );
  assertBefore(
    programHelper,
    "await verifySigned(signed)",
    "await persistSigned(signed)",
    "program signed-pending durability",
  );
  assertBefore(
    programHelper,
    "await persistSigned(signed)",
    "return signed",
    "program signed-pending durability",
  );
});

test("program prompting rejects repair and proves canonical order before provider load and prompt", () => {
  assert.match(programSource, /const SIGNABLE_ACTIONS = \["extend-program", "upgrade"\];/u);
  assert.doesNotMatch(
    section(programSource, "const SIGNABLE_ACTIONS", "function programPromptAction"),
    /return-for-repair/u,
  );
  const handler = section(programSource, "async function simulateAndSign()", "async function broadcastSigned()");
  assertBefore(handler, "attendedPromptLatchKey({", "assertProgramPromptOrder(current, promptAction)", "program early gate");
  assertBefore(handler, "assertProgramPromptOrder(current, promptAction)", "await getHardwareProvider", "program early gate");
  assertBefore(handler, "assertProgramPromptOrder(promptSnapshot, promptAction)", "await requestProgramModelTSignature({", "program prompt gate");

  const order = section(programSource, "function assertProgramPromptOrder", "async function requestProgramModelTSignature");
  assert.match(order, /receiptSet\.receipts\.length > 0[\s\S]*Number\.isSafeInteger\(frozenPreUpgradeCapacity\)/u);
  assert.match(order, /extensionReceiptPresent !== programDataExtensionRequired/u);
  assert.match(order, /assertCanonicalAttendedNextActionFromReceiptSet\(\{[\s\S]*receiptSet,[\s\S]*expectedBinding: snapshot\.evidenceBinding/u);
});

test("program reload probes permanent attempts and signed-pending state before another prompt", () => {
  assert.match(
    programSource,
    /const attempts = PROGRAM_PROMPT_ACTIONS[\s\S]*loadAttendedProgramBroadcastAttempt\(localStorage,[\s\S]*filter\(\(attempt\) => attempt !== null/u,
  );
  assert.match(
    programSource,
    /completedReceipt && \([\s\S]*completedReceipt\.signature !== attempt\.localSignature[\s\S]*completedReceipt\.messageSha256 !== attempt\.messageSha256/u,
  );
  assert.match(
    programSource,
    /for \(const completedReceipt of currentReceiptSet\.receipts\)[\s\S]*Finalized program receipt has no permanent broadcast attempt/u,
  );
  assert.match(
    programSource,
    /const unresolvedAttempts = \[\][\s\S]*loadAttendedProgramSignedPending\(localStorage, attemptBinding\)[\s\S]*unresolvedAttempts\.push\(\{ attempt, restored \}\)/u,
  );
  assert.match(
    programSource,
    /loadAttendedProgramSignedPending\(localStorage, attemptBinding\)[\s\S]*loadAttendedModelTPromptLatch\(localStorage[\s\S]*unresolvedAttempts\.length === 1/u,
  );
  assert.match(
    programSource,
    /assertAttemptMatchesPending\(attempt, restored\)[\s\S]*setBroadcastAttempt\(attempt\)[\s\S]*setPending\(restored\)/u,
  );
  assert.match(
    programSource,
    /RECONCILE ONLY \/\/ PERMANENT BROADCAST ATTEMPT FOUND; SEND IS DISABLED/u,
  );
  assert.match(
    programSource,
    /pendingRecoveryReady[\s\S]*pendingRecoveryBlocked[\s\S]*SIMULATE \+ SIGN SEPARATE CAPACITY EXTENSION/u,
  );
});

test("program broadcast is one reserved send with exact local signature and poll-only reconciliation", () => {
  const broadcast = section(programSource, "async function broadcastSigned()", "function discardSigned()");
  assert.match(broadcast, /withAttendedProgramBroadcastOnce\(\{/u);
  assert.match(broadcast, /attempt: broadcastAttemptFromPending\(pending\)/u);
  const guardedStart = broadcast.indexOf("withAttendedProgramBroadcastOnce({");
  const guarded = broadcast.slice(guardedStart);
  const beforePersistMatch = /beforePersist:\s*async \((?:[A-Za-z_$][A-Za-z0-9_$]*)?\) => \{/u.exec(guarded);
  assert.ok(beforePersistMatch, "program broadcast has no locked pre-reservation validation callback");
  const continuationMatch = /afterPersist:\s*async \(([A-Za-z_$][A-Za-z0-9_$]*)\) => \{/u.exec(broadcast);
  assert.ok(continuationMatch, "program broadcast has no guarded post-persistence continuation");
  assert.ok(
    guardedStart + beforePersistMatch.index < continuationMatch.index,
    "program post-persistence continuation precedes locked pre-reservation validation",
  );
  const beforePersist = broadcast.slice(
    guardedStart + beforePersistMatch.index,
    continuationMatch.index,
  );
  for (const required of [
    "loadBufferSnapshot",
    "upgradeActionBinding",
    "assertExactTransactionMessage",
    "assertSignedLegacyTransaction",
    "assertFreshFinalizedBlockhash",
    "assertAttemptMatchesPending",
    "loadAttendedProgramSignedPending",
    "signedPendingRecord",
  ]) {
    assert.match(beforePersist, new RegExp(required, "u"), `locked pre-reservation validation omits ${required}`);
  }
  assert.equal(count(beforePersist, "await assertFreshFinalizedBlockhash({"), 2);
  assert.match(
    beforePersist,
    /commitment: finalizedCommitment,[\s\S]*commitment: "processed",/u,
  );
  assert.doesNotMatch(beforePersist, /sendRawTransaction|getSignatureStatuses|confirmTransaction/u);
  const attemptName = continuationMatch[1];
  const continuation = broadcast.slice(continuationMatch.index);
  assert.match(
    continuation,
    /connection\.sendRawTransaction\(pending\.signed\.serialize\(\), \{[\s\S]*maxRetries: 0,/u,
  );
  assert.doesNotMatch(continuation, /maxRetries:\s*[1-9][0-9]*/u);
  const sendMatch = /const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*await connection\.sendRawTransaction/u.exec(continuation);
  assert.ok(sendMatch, "program broadcast does not capture the locally derived send signature");
  const returnedSignatureName = sendMatch[1];
  assertBefore(
    continuation,
    "connection.sendRawTransaction",
    `${returnedSignatureName} !== ${attemptName}.localSignature`,
    "program local signature equality",
  );
  assert.match(
    continuation,
    new RegExp(`${returnedSignatureName} !== ${attemptName}\\.localSignature[\\s\\S]*throw new Error`, "u"),
  );
  assert.equal(count(programSource, "connection.sendRawTransaction("), 1);
  assert.equal(count(programSource, "connection.getSignatureStatuses("), 1);
  assert.doesNotMatch(programSource, /connection\.confirmTransaction\(/u);
  assert.match(programSource, /post\.programDataDeploymentSlot !== transactionSlot/u);
  assert.match(
    programSource,
    /retainedReceipt\?\.finalizedAtUtc \?\? new Date\(\)\.toISOString\(\)/u,
  );
  assert.match(programSource, /withAttendedProgramBroadcastReconciliation\(\{/u);
  assertBefore(
    programSource,
    "withAttendedProgramBroadcastReconciliation({",
    "persistAttendedReceipt(",
    "program receipt persistence lock",
  );
  assert.match(
    programSource,
    /broadcastAttempt[\s\S]*getSignatureStatuses\([\s\S]*searchTransactionHistory: true/u,
  );
  const statusCall = programSource.indexOf("connection.getSignatureStatuses(");
  const precedingSource = programSource.slice(0, statusCall);
  const pollDefinitions = [...precedingSource.matchAll(/async function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/gu)];
  assert.ok(pollDefinitions.length > 0, "program broadcast status polling helper is missing");
  const pollName = pollDefinitions.at(-1)[1];
  assert.match(broadcast, /ALREADY_RESERVED/u);
  assert.match(broadcast, new RegExp(`ALREADY_RESERVED[\\s\\S]*${pollName}\\(`, "u"));
  assert.match(
    broadcast,
    new RegExp(`ALREADY_RESERVED[\\s\\S]*${pollName}\\(result\\.attempt, pending\\)[\\s\\S]*${pollName}\\(result\\.attempt, pending\\)`, "u"),
  );

  const actionUiStart = programSource.indexOf("{!pending ? (");
  const actionUiEnd = programSource.indexOf("</section>", actionUiStart);
  assert.ok(actionUiStart >= 0 && actionUiEnd > actionUiStart, "program pending-action UI is missing");
  const actionUi = programSource.slice(actionUiStart, actionUiEnd);
  const reservedStart = actionUi.indexOf(") : broadcastAttempt ? (");
  const sendStart = actionUi.indexOf(") : (", reservedStart + 1);
  assert.ok(reservedStart >= 0 && sendStart > reservedStart, "program UI has no reserved-attempt-only branch");
  const reservedUi = actionUi.slice(reservedStart, sendStart);
  const sendUi = actionUi.slice(sendStart);
  assert.match(reservedUi, /onClick=\{reconcileBroadcastAttempt\}[\s\S]*POLL[\s\S]*NO SEND/u);
  assert.doesNotMatch(reservedUi, /onClick=\{broadcastSigned\}|onClick=\{discardSigned\}/u);
  assert.match(sendUi, /onClick=\{broadcastSigned\}[\s\S]*onClick=\{discardSigned\}/u);
  assert.match(programSource, /async function discardSigned\(\) \{[\s\S]*broadcastBlocked[\s\S]*return;/u);
  assert.match(sendUi, /onClick=\{discardSigned\}[\s\S]*disabled=\{busy \|\| inspectionBusy \|\| broadcastBlocked\}/u);
  const preSendFailure = section(
    broadcast,
    "} else if (preSendEntered && storageError === null) {",
    "} else {",
  );
  assertBefore(
    preSendFailure,
    "withNoAttendedProgramBroadcastAttempts({",
    '"PRE_SEND_FAILURE"',
    "program pre-send terminalization lock",
  );
  assert.match(preSendFailure, /loadAttendedProgramSignedPending[\s\S]*signedPendingRecord\(pending\)/u);
  const discard = section(programSource, "async function discardSigned()", "function downloadReceiptSet()");
  assertBefore(
    discard,
    "withNoAttendedProgramBroadcastAttempts({",
    '"EXPLICIT_DISCARD"',
    "program explicit-discard lock",
  );
  assert.match(discard, /loadAttendedProgramSignedPending[\s\S]*signedPendingRecord\(pending\)/u);
  const clear = section(programSource, "async function clearReceiptSet()", "return (");
  assertBefore(
    clear,
    "withNoAttendedProgramBroadcastAttempts({",
    "clearAttendedReceipts",
    "program receipt-clear lock",
  );
  assert.match(clear, /PROGRAM_PROMPT_ACTIONS\.map/u);
  assert.match(
    programSource,
    /PERMANENT PROGRAM BROADCAST EVIDENCE PREVENTS RECEIPT CLEARING/u,
  );
  assert.doesNotMatch(programSource, /SIGNATURE NOT YET FINALIZED/u);
  assert.match(programSource, /FINALIZED RECONCILIATION INCOMPLETE/u);
});

test("attended program transport disables implicit HTTP 429 transaction retries", async () => {
  assert.match(
    programShellSource,
    /new Connection\(DEVNET_RPC, \{[\s\S]*commitment: FINALIZED_COMMITMENT,[\s\S]*disableRetryOnRateLimit: true,[\s\S]*\}\)/u,
  );
  let fetchCalls = 0;
  const noRetryConnection = new Connection("http://127.0.0.1:1", {
    commitment: "finalized",
    disableRetryOnRateLimit: true,
    fetch: async () => {
      fetchCalls += 1;
      return new Response("rate limited", {
        status: 429,
        statusText: "Too Many Requests",
      });
    },
  });
  await assert.rejects(
    noRetryConnection.sendRawTransaction(Uint8Array.of(1)),
    /429 Too Many Requests/u,
  );
  assert.equal(fetchCalls, 1);
});

test("migration and backfill prove exact receipt order before either hardware path", () => {
  for (const [start, end] of [
    ["async function simulateAndSignMigration(roundAddress)", "async function simulateAndSignBackfill(roundAddress)"],
    ["async function simulateAndSignBackfill(roundAddress)", "async function broadcastSigned()"],
  ]) {
    const handler = section(migrationSource, start, end);
    assertBefore(handler, "attendedPromptLatchKey({", "assertRoundPromptOrder(current, promptAction)", start);
    assertBefore(handler, "assertRoundPromptOrder(current, promptAction)", "await getHardwareProvider", start);
    assertBefore(handler, "assertRoundPromptOrder(promptSnapshot, promptAction)", "await requestRoundModelTSignature({", start);
  }
  const order = section(migrationSource, "function assertRoundPromptOrder", "async function requestRoundModelTSignature");
  assert.match(order, /Number\.isSafeInteger\(preUpgradeCapacity\)/u);
  assert.match(order, /extensionReceiptPresent !== programDataExtensionRequired/u);
  assert.match(order, /assertCanonicalAttendedNextActionFromReceiptSet\(\{[\s\S]*receiptSet,[\s\S]*expectedBinding: snapshot\.evidenceBinding/u);
});

test("feature prompting is canonical, locally verified inside the latch, and persisted into the unified set", () => {
  const loader = section(featureSource, "async function loadFeatureState", "function nextFeatureAction");
  assert.match(loader, /currentRoundInfo && !currentRoundInfo\.owner\.equals\(IAT_V2_PROGRAM_ID\)/u);
  assert.match(loader, /currentRound && !randomnessAddress[\s\S]*existing finalized CCC round has no verified source-bound randomness continuity/u);
  assert.match(loader, /currentRound[\s\S]*randomnessAddress[\s\S]*!currentRound\.randomnessAccount\.equals\(randomnessAddress\)/u);
  const handler = section(featureSource, "async function simulateAndRequestSignature()", "async function broadcastSigned()");
  assertBefore(handler, "currentAction.id === \"CREATE_SWITCHBOARD_RANDOMNESS\" && current.currentRound", "attendedPromptLatchKey({", "feature orphan-round gate");
  assertBefore(handler, "currentAction.id === \"CREATE_SWITCHBOARD_RANDOMNESS\" && current.currentRound", "await getHardwareProvider", "feature orphan-round gate");
  assertBefore(handler, "attendedPromptLatchKey({", "assertFeaturePromptOrder(promptBinding, currentAction.id)", "feature early gate");
  assertBefore(handler, "assertFeaturePromptOrder(promptBinding, currentAction.id)", "await getHardwareProvider", "feature early gate");
  assertBefore(handler, "await getHardwareProvider(currentAction.signer)", "publicKey.equals(currentAction.signer)", "feature exact signer");
  assertBefore(handler, "publicKey.equals(currentAction.signer)", "await buildActionTransaction", "feature exact signer");
  assertBefore(handler, "assertFeaturePromptOrder(promptBinding, promptAction.id)", "await requestFeatureModelTSignature({", "feature prompt gate");
  assert.match(handler, /verifySigned: async \(candidate\) => \{[\s\S]*sha256Hex\(candidate\.serializeMessage\(\)\)[\s\S]*walletSignature[\s\S]*candidate\.verifySignatures\(\)/u);

  const order = section(featureSource, "function assertFeaturePromptOrder", "export default function FeatureRehearsal");
  assert.match(order, /receiptSet\.receipts\.length === 0/u);
  assert.match(order, /Number\.isSafeInteger\(preUpgradeCapacity\)/u);
  assert.match(order, /extensionReceiptPresent !== programDataExtensionRequired/u);
  assert.match(order, /assertCanonicalAttendedNextActionFromReceiptSet/u);

  const broadcast = section(featureSource, "async function broadcastSigned()", "function discardPending()");
  assertBefore(
    broadcast,
    "canonicalRandomnessCreateJournal({",
    "persistRandomnessCreateJournal(localStorage, stagedCreateJournal)",
    "feature CREATE recovery journal",
  );
  assertBefore(
    broadcast,
    "persistRandomnessCreateJournal(localStorage, stagedCreateJournal)",
    "await connection.sendRawTransaction",
    "feature CREATE recovery journal",
  );
  assertBefore(
    broadcast,
    "signature !== stagedCreateJournal.createSignature",
    "await connection.confirmTransaction",
    "feature CREATE signature binding",
  );
  assertBefore(broadcast, "persistAttendedReceipt(localStorage, evidenceBinding(), {", "setEvidence((current)", "feature finalized evidence");
  assert.match(broadcast, /persistAttendedReceipt\(localStorage, evidenceBinding\(\), \{[\s\S]*\.\.\.record,[\s\S]*kind: "feature"/u);
});

test("Switchboard builders are build-only and cannot bypass the prompt coordinator", () => {
  const wallet = section(featureSource, "function switchboardBuildOnlyWallet", "let switchboardModulePromise");
  assert.match(wallet, /throw new Error\("Switchboard transaction builders cannot invoke the Model T signing provider"\)/u);
  assert.match(wallet, /signTransaction: rejectDirectSigning,[\s\S]*signAllTransactions: rejectDirectSigning/u);
  assert.doesNotMatch(
    section(featureSource, "async function buildActionTransaction", "async function requestFeatureModelTSignature"),
    /provider\.signTransaction|provider\.signAllTransactions/u,
  );
  assert.equal(count(featureSource, "provider.signTransaction("), 1);
});
