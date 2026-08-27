import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const consoleRoot = new URL("../tools/iat-v2-admin-console/", import.meta.url);
const [programSource, migrationSource, featureSource] = await Promise.all([
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
