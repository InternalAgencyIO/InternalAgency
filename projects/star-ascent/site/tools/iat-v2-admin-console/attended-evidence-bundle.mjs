import {
  IAT_V2_DEVNET_CEREMONY_CCC_ROUND,
  IAT_V2_DEVNET_CEREMONY_POLICY_WEEK,
  IAT_V2_DEVNET_CEREMONY_ROSTER_VERSION,
  iatV2DevnetCeremonyTerminalActions,
} from "../../programs/iat_v2/ceremony-horizon.mjs";
import {
  canonicalAttendedEvidenceBinding,
  canonicalAttendedReceipt,
  completeAttendedRoster,
  parseAttendedReceiptSet,
} from "./attended-evidence.mjs";

const COMPLETE_BUNDLE_SCHEMA = "iat-v2-current-source-attended-devnet-console-bundle/v1";
const DEVNET_RPC = "https://api.devnet.solana.com";
const CCC_ROUND_TERMINAL_ACTIONS = iatV2DevnetCeremonyTerminalActions();

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function featureReceipts(featureExport) {
  check(featureExport?.schema === "iat-v2-devnet-on-chain-feature-rehearsal-evidence/v1", "Feature export schema is not reviewed");
  check(featureExport.network === "devnet" && featureExport.rpc === DEVNET_RPC, "Feature export is not canonical Devnet");
  check(Array.isArray(featureExport.transactions), "Feature export transactions are missing");
  return featureExport.transactions.map((receipt) => canonicalAttendedReceipt({
    action: receipt.action,
    title: receipt.title,
    signature: receipt.signature,
    messageSha256: receipt.messageSha256,
    explorerUrl: receipt.explorerUrl,
    finalizedAtUtc: receipt.finalizedAtUtc ?? receipt.confirmedAtUtc,
    kind: "feature",
    week: Number.isSafeInteger(receipt.week) ? receipt.week : null,
  }));
}

export function buildCompleteAttendedBundle({
  receiptSets = [],
  featureExport,
  expectedBinding,
  programId,
  participant,
  exportedAtUtc = new Date().toISOString(),
} = {}) {
  const expected = canonicalAttendedEvidenceBinding(expectedBinding);
  check(Array.isArray(receiptSets), "Receipt sets must be an array");
  const sets = receiptSets.map((set) => parseAttendedReceiptSet(set, expected));
  check(featureExport?.mint === expected.mint, "Feature export mint drifted");
  check(String(featureExport?.programId) === programId, "Feature export program ID drifted");
  check(String(featureExport?.participant) === participant, "Feature export participant drifted");
  const every = [
    ...sets.flatMap((set) => set.receipts),
    ...featureReceipts(featureExport),
  ];
  const byAction = new Map();
  for (const receipt of every) {
    const current = byAction.get(receipt.action);
    check(
      !current || JSON.stringify(current) === JSON.stringify(receipt),
      `Aggregate receipts conflict for action ${receipt.action}`,
    );
    byAction.set(receipt.action, receipt);
  }
  const uniqueReceipts = [...byAction.values()];
  check(
    new Set(uniqueReceipts.map((receipt) => receipt.signature)).size === uniqueReceipts.length,
    "Aggregate receipts reuse one transaction signature for multiple actions",
  );
  const programDataExtensionRequired = byAction.has("EXTEND_PROGRAM_DATA");
  const switchboardRandomnessCreationRequired = byAction.has("CREATE_SWITCHBOARD_RANDOMNESS");
  check(
    switchboardRandomnessCreationRequired,
    "Aggregate evidence is missing mandatory receipt CREATE_SWITCHBOARD_RANDOMNESS",
  );
  const terminalActions = CCC_ROUND_TERMINAL_ACTIONS
    .filter((action) => byAction.has(action));
  check(
    terminalActions.length === 1,
    `Aggregate receipts require exactly one round ${IAT_V2_DEVNET_CEREMONY_CCC_ROUND} terminal action`,
  );
  const capacities = [...new Set(sets
    .map((set) => set.preUpgradeProgramDataCapacityBytes)
    .filter((value) => value !== null))];
  check(capacities.length === 1, "Aggregate receipts require one exact pre-upgrade ProgramData capacity");
  const conditions = Object.freeze({
    programDataExtensionRequired,
    preUpgradeProgramDataCapacityBytes: capacities[0],
    switchboardRandomnessCreationRequired,
    policyWeek: IAT_V2_DEVNET_CEREMONY_POLICY_WEEK,
    cccRound: IAT_V2_DEVNET_CEREMONY_CCC_ROUND,
    cccRoundTerminalAction: terminalActions[0],
  });
  const roster = completeAttendedRoster(conditions);
  const extra = uniqueReceipts.find((receipt) => !roster.includes(receipt.action));
  check(!extra, `Aggregate evidence includes out-of-roster receipt ${extra?.action}`);
  const missing = roster.filter((action) => !byAction.has(action));
  check(missing.length === 0, `Aggregate evidence is missing receipt ${missing[0]}`);
  const transactions = roster.map((action) => byAction.get(action));
  check(Number.isFinite(Date.parse(exportedAtUtc)), "Aggregate export time is invalid");
  return Object.freeze({
    schema: COMPLETE_BUNDLE_SCHEMA,
    status: "COMPLETE_PENDING_AUTOMATED_DIRECT_EVIDENCE",
    rosterVersion: IAT_V2_DEVNET_CEREMONY_ROSTER_VERSION,
    sourceCommit: expected.sourceCommit,
    programArtifactSha256: expected.programArtifactSha256,
    network: "devnet",
    rpc: DEVNET_RPC,
    programId,
    mint: expected.mint,
    participant,
    conditions,
    transactions: Object.freeze(transactions),
    exportedAtUtc,
    mainnetStatus: "HOLD",
    automatedDirectEvidenceRequired: true,
    humanReviewerRequired: false,
    noSelfAttestation: true,
    secretMaterialIncluded: false,
  });
}

export const IAT_V2_COMPLETE_BUNDLE_SCHEMA = COMPLETE_BUNDLE_SCHEMA;
export const IAT_V2_COMPLETE_ROSTER_VERSION = IAT_V2_DEVNET_CEREMONY_ROSTER_VERSION;
