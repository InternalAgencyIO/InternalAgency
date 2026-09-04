import {
  IAT_V2_DEVNET_CEREMONY_BACKFILL_WEEKS,
  IAT_V2_DEVNET_CEREMONY_CCC_ROUND,
  IAT_V2_DEVNET_CEREMONY_LINKED_HISTORICAL_WEEKS,
  IAT_V2_DEVNET_CEREMONY_MIGRATION_WEEKS,
  IAT_V2_DEVNET_CEREMONY_POLICY_WEEK,
  IAT_V2_DEVNET_CEREMONY_ROSTER_VERSION,
  IAT_V2_DEVNET_CEREMONY_STANDARD_SETTLEMENT_WEEKS,
  iatV2DevnetCeremonyTerminalActions,
} from "../../programs/iat_v2/ceremony-horizon.mjs";

const RECEIPT_SET_SCHEMA = "iat-v2-current-source-attended-receipt-set/v1";
const COMPLETE_BUNDLE_SCHEMA = "iat-v2-current-source-attended-devnet-console-bundle/v1";
const COMPLETE_ROSTER_VERSION = IAT_V2_DEVNET_CEREMONY_ROSTER_VERSION;
const DEVNET_RPC = "https://api.devnet.solana.com";
const hex40 = /^[0-9a-f]{40}$/u;
const hex64 = /^[0-9a-f]{64}$/u;
const base58 = /^[1-9A-HJ-NP-Za-km-z]+$/u;
const base58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const CCC_ROUND_TERMINAL_ACTIONS = iatV2DevnetCeremonyTerminalActions();
const ROSTER_BEFORE_RANDOMNESS = Object.freeze([
  "UPGRADE_PROGRAM",
  ...IAT_V2_DEVNET_CEREMONY_MIGRATION_WEEKS
    .map((week) => `MIGRATE_LEGACY_ROUND_WEEK_${week}`),
  ...IAT_V2_DEVNET_CEREMONY_BACKFILL_WEEKS
    .map((week) => `BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_${week}`),
  ...IAT_V2_DEVNET_CEREMONY_STANDARD_SETTLEMENT_WEEKS
    .map((week) => `SETTLE_STANDARD_POSITION_WEEK_${week}`),
  ...IAT_V2_DEVNET_CEREMONY_LINKED_HISTORICAL_WEEKS
    .map((week) => `SETTLE_LINKED_POSITION_2_WEEK_${week}`),
  ...IAT_V2_DEVNET_CEREMONY_LINKED_HISTORICAL_WEEKS
    .map((week) => `SETTLE_LINKED_POSITION_3_WEEK_${week}`),
]);
const ROSTER_AFTER_RANDOMNESS = Object.freeze([
  `COMMIT_CCC_ROUND_${IAT_V2_DEVNET_CEREMONY_CCC_ROUND}`,
  CCC_ROUND_TERMINAL_ACTIONS,
  `SETTLE_LINKED_POSITION_2_WEEK_${IAT_V2_DEVNET_CEREMONY_CCC_ROUND}`,
  `SETTLE_LINKED_POSITION_3_WEEK_${IAT_V2_DEVNET_CEREMONY_CCC_ROUND}`,
]);
const CANONICAL_ATTENDED_ACTIONS = new Set([
  "EXTEND_PROGRAM_DATA",
  ...ROSTER_BEFORE_RANDOMNESS,
  "CREATE_SWITCHBOARD_RANDOMNESS",
  `COMMIT_CCC_ROUND_${IAT_V2_DEVNET_CEREMONY_CCC_ROUND}`,
  ...CCC_ROUND_TERMINAL_ACTIONS,
  `SETTLE_LINKED_POSITION_2_WEEK_${IAT_V2_DEVNET_CEREMONY_CCC_ROUND}`,
  `SETTLE_LINKED_POSITION_3_WEEK_${IAT_V2_DEVNET_CEREMONY_CCC_ROUND}`,
]);

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function exactKeys(value, expected, label) {
  check(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  check(JSON.stringify(Object.keys(value)) === JSON.stringify(expected), `${label} fields are not exact`);
}

function base58ByteLength(value) {
  if (!base58.test(value ?? "")) return -1;
  let number = 0n;
  for (const character of value) number = number * 58n + BigInt(base58Alphabet.indexOf(character));
  let bytes = 0;
  while (number > 0n) {
    bytes += 1;
    number >>= 8n;
  }
  let zeroes = 0;
  while (zeroes < value.length && value[zeroes] === "1") zeroes += 1;
  return bytes + zeroes;
}

function binding({ sourceCommit, programArtifactSha256, mint }) {
  check(hex40.test(sourceCommit ?? ""), "Attended evidence requires the exact CI source commit");
  check(hex64.test(programArtifactSha256 ?? ""), "Attended evidence requires the exact CI artifact SHA-256");
  check(base58ByteLength(mint) === 32, "Attended evidence requires the exact 32-byte Devnet mint");
  return { sourceCommit, programArtifactSha256, mint };
}

export function canonicalAttendedActionClassification(action) {
  if ([
    "EXTEND_PROGRAM_DATA",
    "UPGRADE_PROGRAM",
    "RETURN_BUFFER_AUTHORITY_TO_DEPLOYER",
  ].includes(action)) return Object.freeze({ kind: "program", week: null });
  let match = /^MIGRATE_LEGACY_ROUND_WEEK_([0-9]+)$/u.exec(action ?? "");
  if (match) {
    const week = Number(match[1]);
    check(Number.isSafeInteger(week), "Receipt action week is unsafe");
    return Object.freeze({ kind: "migration", week });
  }
  match = /^BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_([0-9]+)$/u.exec(action ?? "");
  if (match) {
    const week = Number(match[1]);
    check(Number.isSafeInteger(week), "Receipt action week is unsafe");
    return Object.freeze({ kind: "neutral-backfill", week });
  }
  const fixedFeatureActions = [
    "REGISTER_AGENCY_0",
    "REGISTER_AGENCY_1",
    "SET_STANDARD_ELIGIBILITY",
    "FUND_PARTICIPANT_RENT",
    "OPEN_STANDARD_POSITION",
    "SET_CCC_AGENT_ELIGIBILITY",
    "OPEN_CCC_AGENT_POSITION",
    "SET_CCC_ASSOCIATE_ELIGIBILITY",
    "OPEN_CCC_ASSOCIATE_POSITION",
    "SETTLE_CORE_WEEK_0",
    "CLAIM_LIQUIDITY_GENESIS_UNLOCK",
    "CREATE_SWITCHBOARD_RANDOMNESS",
  ];
  if (fixedFeatureActions.includes(action)) return Object.freeze({ kind: "feature", week: null });
  const numberedFeatureAction = /^(?:SETTLE_STANDARD_POSITION_WEEK_[0-9]+|SETTLE_LINKED_POSITION_[1-3]_WEEK_[0-9]+|COMMIT_CCC_ROUND_[0-9]+|REVEAL_CCC_ROUND_[0-9]+|EXPIRE_CCC_ROUND_[0-9]+)$/u;
  check(numberedFeatureAction.test(action ?? ""), "Receipt action is not reviewed");
  match = /(?:WEEK|ROUND)_([0-9]+)$/u.exec(action);
  const week = Number(match[1]);
  check(Number.isSafeInteger(week), "Receipt action week is unsafe");
  return Object.freeze({ kind: "feature", week });
}

export function attendedReceiptStorageKey(values) {
  const exact = binding(values);
  return `iat-v2-current-source-attended-receipts/${exact.sourceCommit}/${exact.programArtifactSha256}/${exact.mint}/v1`;
}

export function canonicalAttendedReceipt({
  action,
  title,
  signature,
  messageSha256,
  explorerUrl,
  finalizedAtUtc,
  kind,
  week = null,
} = {}) {
  check(typeof action === "string" && action.length > 0, "Receipt action is required");
  check(typeof title === "string" && title.length > 0, "Receipt title is required");
  check(base58ByteLength(signature) === 64, "Receipt signature is not an exact Solana signature");
  check(hex64.test(messageSha256 ?? ""), "Receipt message SHA-256 is invalid");
  check(explorerUrl === `https://explorer.solana.com/tx/${signature}?cluster=devnet`, "Receipt Explorer URL is not canonical Devnet");
  check(Number.isFinite(Date.parse(finalizedAtUtc ?? "")), "Receipt finalized time is invalid");
  check(["program", "migration", "neutral-backfill", "feature"].includes(kind), "Receipt kind is not reviewed");
  check(week === null || (Number.isSafeInteger(week) && week >= 0), "Receipt week is invalid");
  const expected = canonicalAttendedActionClassification(action);
  check(kind === expected.kind && week === expected.week, "Receipt action/kind/week mismatch");
  return Object.freeze({
    action,
    title,
    signature,
    messageSha256,
    explorerUrl,
    finalizedAtUtc,
    kind,
    week,
  });
}

export function canonicalReceiptSet({
  sourceCommit,
  programArtifactSha256,
  mint,
  preUpgradeProgramDataCapacityBytes = null,
  receipts = [],
} = {}) {
  const exact = binding({ sourceCommit, programArtifactSha256, mint });
  check(
    preUpgradeProgramDataCapacityBytes === null
      || (Number.isSafeInteger(preUpgradeProgramDataCapacityBytes) && preUpgradeProgramDataCapacityBytes > 0),
    "Pre-upgrade ProgramData capacity is invalid",
  );
  check(Array.isArray(receipts), "Attended receipts must be an array");
  const normalized = receipts.map((receipt) => canonicalAttendedReceipt(receipt));
  check(new Set(normalized.map((receipt) => receipt.action)).size === normalized.length, "Attended receipt actions must be unique");
  check(new Set(normalized.map((receipt) => receipt.signature)).size === normalized.length, "Attended receipt signatures must be unique");
  return Object.freeze({
    schema: RECEIPT_SET_SCHEMA,
    ...exact,
    preUpgradeProgramDataCapacityBytes,
    receipts: Object.freeze(normalized),
  });
}

export function parseAttendedReceiptSet(value, expectedBinding = null) {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  exactKeys(parsed, [
    "schema",
    "sourceCommit",
    "programArtifactSha256",
    "mint",
    "preUpgradeProgramDataCapacityBytes",
    "receipts",
  ], "attended receipt set");
  check(parsed.schema === RECEIPT_SET_SCHEMA, "Attended receipt-set schema is not reviewed");
  const normalized = canonicalReceiptSet(parsed);
  if (expectedBinding) {
    const expected = binding(expectedBinding);
    check(normalized.sourceCommit === expected.sourceCommit, "Receipt-set source commit drifted");
    check(normalized.programArtifactSha256 === expected.programArtifactSha256, "Receipt-set artifact digest drifted");
    check(normalized.mint === expected.mint, "Receipt-set mint drifted");
  }
  return normalized;
}

export function loadAttendedReceiptSet(storage, expectedBinding) {
  const key = attendedReceiptStorageKey(expectedBinding);
  const serialized = storage.getItem(key);
  return serialized
    ? parseAttendedReceiptSet(serialized, expectedBinding)
    : canonicalReceiptSet({ ...expectedBinding, receipts: [] });
}

export function persistAttendedReceipt(storage, expectedBinding, receipt, {
  preUpgradeProgramDataCapacityBytes = null,
} = {}) {
  const current = loadAttendedReceiptSet(storage, expectedBinding);
  const nextReceipt = canonicalAttendedReceipt(receipt);
  const existing = current.receipts.find((item) => item.action === nextReceipt.action);
  if (existing) {
    check(
      JSON.stringify(existing) === JSON.stringify(nextReceipt),
      `Attended receipt action ${nextReceipt.action} is already recorded with different evidence`,
    );
    return current;
  }
  const next = canonicalReceiptSet({
    ...expectedBinding,
    preUpgradeProgramDataCapacityBytes:
      current.preUpgradeProgramDataCapacityBytes ?? preUpgradeProgramDataCapacityBytes,
    receipts: [...current.receipts, nextReceipt],
  });
  const key = attendedReceiptStorageKey(expectedBinding);
  const serialized = JSON.stringify(next);
  try {
    storage.setItem(key, serialized);
    check(storage.getItem(key) === serialized, "Attended receipt-set storage readback disagrees with the write");
  } catch (error) {
    throw new Error("Attended receipt-set storage is unavailable or non-durable", { cause: error });
  }
  return parseAttendedReceiptSet(serialized, expectedBinding);
}

export function clearAttendedReceipts(storage, expectedBinding) {
  const key = attendedReceiptStorageKey(expectedBinding);
  try {
    check(typeof storage?.removeItem === "function", "Attended receipt-set storage cannot remove records");
    storage.removeItem(key);
    check(storage.getItem(key) === null, "Attended receipt-set storage readback disagrees with clearing");
  } catch (error) {
    throw new Error("Attended receipt-set storage is unavailable for clearing", { cause: error });
  }
}

export function completeAttendedRoster({
  programDataExtensionRequired,
  switchboardRandomnessCreationRequired = true,
  policyWeek = IAT_V2_DEVNET_CEREMONY_POLICY_WEEK,
  cccRound = IAT_V2_DEVNET_CEREMONY_CCC_ROUND,
  cccRoundTerminalAction,
} = {}) {
  check(typeof programDataExtensionRequired === "boolean", "Extension condition is required");
  check(
    switchboardRandomnessCreationRequired === true,
    "Fresh Switchboard randomness creation is mandatory for the canonical attended roster",
  );
  check(
    policyWeek === IAT_V2_DEVNET_CEREMONY_POLICY_WEEK,
    "Policy week drifted from the source-bound attended roster",
  );
  check(
    cccRound === IAT_V2_DEVNET_CEREMONY_CCC_ROUND,
    "CCC round drifted from the source-bound attended roster",
  );
  check(
    CCC_ROUND_TERMINAL_ACTIONS.includes(cccRoundTerminalAction),
    `Round ${IAT_V2_DEVNET_CEREMONY_CCC_ROUND} terminal action is not reviewed`,
  );
  return Object.freeze([
    ...(programDataExtensionRequired ? ["EXTEND_PROGRAM_DATA"] : []),
    ...ROSTER_BEFORE_RANDOMNESS,
    "CREATE_SWITCHBOARD_RANDOMNESS",
    `COMMIT_CCC_ROUND_${IAT_V2_DEVNET_CEREMONY_CCC_ROUND}`,
    cccRoundTerminalAction,
    `SETTLE_LINKED_POSITION_2_WEEK_${IAT_V2_DEVNET_CEREMONY_CCC_ROUND}`,
    `SETTLE_LINKED_POSITION_3_WEEK_${IAT_V2_DEVNET_CEREMONY_CCC_ROUND}`,
  ]);
}

function exactCompletedActions(completedActions) {
  check(Array.isArray(completedActions), "Canonical attended progress must be an action array");
  check(
    completedActions.every((action) => typeof action === "string" && action.length > 0),
    "Canonical attended progress contains an invalid action",
  );
  check(
    new Set(completedActions).size === completedActions.length,
    "Canonical attended progress repeats an action",
  );
  return completedActions;
}

function expectedLabel(actions) {
  return actions.join(" or ");
}

/**
 * Derive the only action(s) that a canonical current-source ceremony may expose
 * next. This is intentionally independent of legacy/recovery tooling: callers
 * opt into it only for the canonical aggregate path, immediately before loading
 * a signer.
 */
export function canonicalAttendedNextActionPolicy({
  completedActions = [],
  programDataExtensionRequired,
  switchboardRandomnessCreationRequired = true,
  policyWeek = IAT_V2_DEVNET_CEREMONY_POLICY_WEEK,
  cccRound = IAT_V2_DEVNET_CEREMONY_CCC_ROUND,
} = {}) {
  const completed = exactCompletedActions(completedActions);
  check(typeof programDataExtensionRequired === "boolean", "Canonical extension condition is required");
  check(
    switchboardRandomnessCreationRequired === true,
    "Fresh Switchboard randomness creation is mandatory for canonical attended progress",
  );
  check(
    policyWeek === IAT_V2_DEVNET_CEREMONY_POLICY_WEEK,
    "Canonical attended progress policy week drifted",
  );
  check(
    cccRound === IAT_V2_DEVNET_CEREMONY_CCC_ROUND,
    "Canonical attended progress CCC round drifted",
  );

  const beforeRandomness = [
    ...(programDataExtensionRequired ? ["EXTEND_PROGRAM_DATA"] : []),
    ...ROSTER_BEFORE_RANDOMNESS,
  ];
  const totalActionCount = beforeRandomness.length + 1 + ROSTER_AFTER_RANDOMNESS.length;
  const firstMismatch = completed
    .slice(0, Math.min(completed.length, beforeRandomness.length))
    .findIndex((action, index) => action !== beforeRandomness[index]);
  if (firstMismatch >= 0) {
    throw new Error(
      `Canonical attended progress expected ${beforeRandomness[firstMismatch]} at index ${firstMismatch}, received ${completed[firstMismatch]}`,
    );
  }
  if (completed.length < beforeRandomness.length) {
    const next = Object.freeze([beforeRandomness[completed.length]]);
    return Object.freeze({
      complete: false,
      completedActionCount: completed.length,
      totalActionCount,
      switchboardRandomnessCreationRequired: true,
      allowedNextActions: next,
      expectedAction: next[0],
    });
  }

  const steps = [
    ...beforeRandomness.map((action) => Object.freeze([action])),
    Object.freeze(["CREATE_SWITCHBOARD_RANDOMNESS"]),
    ...ROSTER_AFTER_RANDOMNESS.map((step) => (
      Array.isArray(step) ? step : Object.freeze([step])
    )),
  ];
  check(completed.length <= steps.length, "Canonical attended progress continues after the roster is complete");
  for (let index = beforeRandomness.length; index < completed.length; index += 1) {
    const allowed = steps[index];
    check(
      allowed.includes(completed[index]),
      `Canonical attended progress expected ${expectedLabel(allowed)} at index ${index}, received ${completed[index]}`,
    );
  }
  if (completed.length === steps.length) {
    return Object.freeze({
      complete: true,
      completedActionCount: completed.length,
      totalActionCount: steps.length,
      switchboardRandomnessCreationRequired: true,
      allowedNextActions: Object.freeze([]),
      expectedAction: null,
    });
  }
  const allowedNextActions = Object.freeze([...steps[completed.length]]);
  return Object.freeze({
    complete: false,
    completedActionCount: completed.length,
    totalActionCount: steps.length,
    switchboardRandomnessCreationRequired: true,
    allowedNextActions,
    expectedAction: allowedNextActions.length === 1 ? allowedNextActions[0] : null,
  });
}

export function assertCanonicalAttendedNextAction({ nextAction, ...progress } = {}) {
  const policy = canonicalAttendedNextActionPolicy(progress);
  check(!policy.complete, "Canonical attended roster is already complete");
  check(typeof nextAction === "string" && nextAction.length > 0, "Canonical next action is required");
  check(
    policy.allowedNextActions.includes(nextAction),
    `Canonical attended roster expected ${expectedLabel(policy.allowedNextActions)}, received ${nextAction}`,
  );
  return policy;
}

/**
 * Bind canonical progress to finalized public receipts, preserving their
 * recorded order. Callers must supply the exact reviewed source/artifact/mint
 * binding and a ceremony-stable extension condition.
 */
export function assertCanonicalAttendedNextActionFromReceiptSet({
  receiptSet,
  expectedBinding,
  programDataExtensionRequired,
  nextAction,
} = {}) {
  const exact = binding(expectedBinding ?? {});
  const normalized = parseAttendedReceiptSet(receiptSet, exact);
  const extra = normalized.receipts.find(({ action }) => !CANONICAL_ATTENDED_ACTIONS.has(action));
  check(!extra, `Canonical attended progress includes out-of-roster receipt ${extra?.action}`);
  const completedActions = Object.freeze(normalized.receipts.map(({ action }) => action));
  const policy = assertCanonicalAttendedNextAction({
    completedActions,
    programDataExtensionRequired,
    nextAction,
  });
  return Object.freeze({ completedActions, policy });
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
  const expected = binding(expectedBinding);
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
    rosterVersion: COMPLETE_ROSTER_VERSION,
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

export const IAT_V2_ATTENDED_RECEIPT_SET_SCHEMA = RECEIPT_SET_SCHEMA;
export const IAT_V2_COMPLETE_BUNDLE_SCHEMA = COMPLETE_BUNDLE_SCHEMA;
export const IAT_V2_COMPLETE_ROSTER_VERSION = COMPLETE_ROSTER_VERSION;
