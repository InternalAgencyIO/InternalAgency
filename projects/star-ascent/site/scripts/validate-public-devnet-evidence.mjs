#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public/evidence/iat-v2",
);
const index = JSON.parse(await readFile(path.join(root, "index.json"), "utf8"));
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function walk(value, trail = []) {
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    const next = [...trail, key];
    check(
      !/(private.?key|secret.?key|mnemonic|seed.?phrase|recovery.?phrase|wallet.?seed|keypair)/i.test(key),
      `credential-bearing field found: ${next.join(".")}`,
    );
    walk(item, next);
  }
}

check(index.schema === "iat-public-evidence-index/v1", "unexpected index schema");
check(index.license === "CC0-1.0", "public evidence must declare CC0-1.0");
check(index.network === "devnet", "public evidence index must remain devnet-only");
check(index.mainnetStatus === "HOLD", "public evidence must not clear mainnet HOLD");
check(index.independentReviewRequired === true, "independent review must remain required");
check(index.secretMaterialIncluded === false, "secret-material declaration must remain false");
check(Array.isArray(index.records) && index.records.length === 10, "expected ten indexed records");
check(
  JSON.stringify(index.canonicalAtPublication) === JSON.stringify([
    "v2-initialization-20260730T074603Z.json",
    "v2-features-20260731T101732Z.json",
    "chain-status-20260731T102046Z.json",
  ]),
  "canonical evidence set is not pinned to the latest reviewed records",
);

const indexedNames = new Set();
for (const record of index.records ?? []) {
  check(!indexedNames.has(record.file), `duplicate indexed file: ${record.file}`);
  indexedNames.add(record.file);
  const filePath = path.resolve(root, record.file);
  check(filePath.startsWith(`${root}${path.sep}`), `record escapes evidence directory: ${record.file}`);
  const bytes = await readFile(filePath);
  const details = await stat(filePath);
  const digest = createHash("sha256").update(bytes).digest("hex");
  check(details.size === record.bytes, `byte count mismatch: ${record.file}`);
  check(digest === record.sha256, `SHA-256 mismatch: ${record.file}`);
  if (record.file.endsWith(".json")) walk(JSON.parse(bytes.toString("utf8")));
}

const init = JSON.parse(
  await readFile(path.join(root, "v2-initialization-20260730T074603Z.json"), "utf8"),
);
const feature = JSON.parse(
  await readFile(path.join(root, "v2-features-20260731T101732Z.json"), "utf8"),
);
const legacy = JSON.parse(
  await readFile(path.join(root, "legacy-v1-devnet-ceremony-20260729.json"), "utf8"),
);
const legacyReceipt = JSON.parse(
  await readFile(path.join(root, "chain-status-20260730T123453Z.json"), "utf8"),
);
const receipt = JSON.parse(
  await readFile(path.join(root, "chain-status-20260731T102046Z.json"), "utf8"),
);

check(init.network === "devnet" && init.mainnetStatus === "HOLD", "V2 initialization boundary drift");
check(init.transactions?.length === 7, "V2 initialization must retain seven transactions");
check(feature.network === "devnet" && feature.mainnetStatus === "HOLD", "V2 feature boundary drift");
check(feature.transactions?.length === 14, "latest V2 feature snapshot must retain 14 transactions");
check(
  feature.status === "PARTIAL_PENDING_ALL_TIME_GATES_AND_INDEPENDENT_REVIEW",
  "latest feature snapshot must remain explicitly partial",
);
check(
  feature.positions?.length === 3 && feature.positions.every(Boolean),
  "latest feature snapshot must retain three real stake positions",
);
check(
  feature.positions?.[0]?.paid === "19230769" && feature.positions?.[0]?.settledMask === "1",
  "latest feature snapshot must retain the finalized standard week-8 settlement",
);
check(feature.coreReward?.paid === "326923076", "latest feature snapshot core APY payment drift");
check(
  feature.liquidityLane?.principalClaimed === "12500000000",
  "latest feature snapshot Genesis liquidity unlock drift",
);
check(
  feature.currentRound?.status === 1 && Number.isInteger(feature.currentRound.selectedAgencyIndex),
  "latest feature snapshot must retain a settled CCC round",
);
const expectedFeatureActions = new Set([
  "REGISTER_AGENCY_0",
  "REGISTER_AGENCY_1",
  "SET_STANDARD_ELIGIBILITY",
  "OPEN_STANDARD_POSITION",
  "SET_CCC_AGENT_ELIGIBILITY",
  "OPEN_CCC_AGENT_POSITION",
  "SET_CCC_ASSOCIATE_ELIGIBILITY",
  "OPEN_CCC_ASSOCIATE_POSITION",
  "SETTLE_CORE_WEEK_0",
  "CLAIM_LIQUIDITY_GENESIS_UNLOCK",
  "CREATE_SWITCHBOARD_RANDOMNESS",
  "COMMIT_CCC_ROUND_7",
  "REVEAL_CCC_ROUND_7",
  "SETTLE_STANDARD_POSITION_WEEK_8",
]);
const observedFeatureActions = new Set(feature.transactions.map(({ action }) => action));
check(
  expectedFeatureActions.size === observedFeatureActions.size
    && [...expectedFeatureActions].every((action) => observedFeatureActions.has(action)),
  "latest feature snapshot action set drift",
);
check(legacy.network === "devnet" && legacy.transactions?.length === 4, "legacy record boundary drift");
check(
  legacyReceipt.results?.length === 15
    && legacyReceipt.results.every(
      (result) => result.confirmationStatus === "finalized" && result.err === null,
    ),
  "historical 15-signature receipt drift",
);
check(receipt.network === "devnet" && receipt.mainnetStatus === "HOLD", "chain receipt boundary drift");
check(receipt.signingOrBroadcastPerformed === false, "chain receipt must stay read-only");
check(receipt.results?.length === 25, "chain receipt must retain 25 transaction statuses");
check(
  receipt.results?.every((result) => result.confirmationStatus === "finalized" && result.err === null),
  "chain receipt contains a non-finalized or failed transaction",
);

const expectedSignatures = new Set([
  ...legacy.transactions.map(({ signature }) => signature),
  ...init.transactions.map(({ signature }) => signature),
  ...feature.transactions.map(({ signature }) => signature),
]);
const receiptSignatures = new Set(receipt.results.map(({ signature }) => signature));
check(expectedSignatures.size === 25, "expected signature union must contain 25 unique values");
check(
  expectedSignatures.size === receiptSignatures.size
    && [...expectedSignatures].every((signature) => receiptSignatures.has(signature)),
  "chain receipt does not exactly cover the published canonical transaction set",
);

const files = await readdir(root);
for (const required of ["README.md", "CC0-1.0.md", "index.json"]) {
  check(files.includes(required), `missing public evidence companion: ${required}`);
}

if (failures.length) {
  console.error("Public devnet evidence validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "Public devnet evidence validation passed: ten indexed records, 25 finalized signatures, CC0, no secret-bearing fields, mainnet HOLD.",
);

