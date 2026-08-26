const RECEIPT_SET_SCHEMA = "iat-v2-current-source-attended-receipt-set/v1";
const COMPLETE_BUNDLE_SCHEMA = "iat-v2-current-source-attended-devnet-console-bundle/v1";
const COMPLETE_ROSTER_VERSION = "IAT_V2_MIGRATION_BACKFILL_WEEK11_V1";
const DEVNET_RPC = "https://api.devnet.solana.com";
const hex40 = /^[0-9a-f]{40}$/u;
const hex64 = /^[0-9a-f]{64}$/u;
const base58 = /^[1-9A-HJ-NP-Za-km-z]+$/u;
const base58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

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
  check(base58.test(mint ?? ""), "Attended evidence requires the exact Devnet mint");
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
  const next = canonicalReceiptSet({
    ...expectedBinding,
    preUpgradeProgramDataCapacityBytes:
      current.preUpgradeProgramDataCapacityBytes ?? preUpgradeProgramDataCapacityBytes,
    receipts: [
      ...current.receipts.filter((item) => item.action !== nextReceipt.action),
      nextReceipt,
    ],
  });
  storage.setItem(attendedReceiptStorageKey(expectedBinding), JSON.stringify(next));
  return next;
}

export function clearAttendedReceipts(storage, expectedBinding) {
  storage.removeItem(attendedReceiptStorageKey(expectedBinding));
}

export function completeAttendedRoster({
  programDataExtensionRequired,
  switchboardRandomnessCreationRequired,
  cccRound11TerminalAction,
} = {}) {
  check(typeof programDataExtensionRequired === "boolean", "Extension condition is required");
  check(typeof switchboardRandomnessCreationRequired === "boolean", "Switchboard creation condition is required");
  check(
    ["REVEAL_CCC_ROUND_11", "EXPIRE_CCC_ROUND_11"].includes(cccRound11TerminalAction),
    "Round 11 terminal action is not reviewed",
  );
  return Object.freeze([
    ...(programDataExtensionRequired ? ["EXTEND_PROGRAM_DATA"] : []),
    "UPGRADE_PROGRAM",
    "MIGRATE_LEGACY_ROUND_WEEK_7",
    "MIGRATE_LEGACY_ROUND_WEEK_8",
    "BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_9",
    "BACKFILL_HISTORICAL_NEUTRAL_ROUND_WEEK_10",
    "SETTLE_STANDARD_POSITION_WEEK_10",
    "SETTLE_STANDARD_POSITION_WEEK_11",
    "SETTLE_LINKED_POSITION_2_WEEK_9",
    "SETTLE_LINKED_POSITION_2_WEEK_10",
    "SETTLE_LINKED_POSITION_3_WEEK_9",
    "SETTLE_LINKED_POSITION_3_WEEK_10",
    ...(switchboardRandomnessCreationRequired ? ["CREATE_SWITCHBOARD_RANDOMNESS"] : []),
    "COMMIT_CCC_ROUND_11",
    cccRound11TerminalAction,
    "SETTLE_LINKED_POSITION_2_WEEK_11",
    "SETTLE_LINKED_POSITION_3_WEEK_11",
  ]);
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
  const terminalActions = ["REVEAL_CCC_ROUND_11", "EXPIRE_CCC_ROUND_11"]
    .filter((action) => byAction.has(action));
  check(terminalActions.length === 1, "Aggregate receipts require exactly one round 11 terminal action");
  const capacities = [...new Set(sets
    .map((set) => set.preUpgradeProgramDataCapacityBytes)
    .filter((value) => value !== null))];
  check(capacities.length === 1, "Aggregate receipts require one exact pre-upgrade ProgramData capacity");
  const conditions = Object.freeze({
    programDataExtensionRequired,
    preUpgradeProgramDataCapacityBytes: capacities[0],
    switchboardRandomnessCreationRequired,
    cccRound11TerminalAction: terminalActions[0],
  });
  const roster = completeAttendedRoster(conditions);
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
