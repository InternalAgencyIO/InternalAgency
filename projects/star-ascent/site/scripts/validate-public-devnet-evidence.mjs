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
check(Array.isArray(index.records) && index.records.length === 6, "expected six indexed records");

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
  await readFile(path.join(root, "v2-features-20260730T122300Z.json"), "utf8"),
);
const legacy = JSON.parse(
  await readFile(path.join(root, "legacy-v1-devnet-ceremony-20260729.json"), "utf8"),
);
const receipt = JSON.parse(
  await readFile(path.join(root, "chain-status-20260730T123453Z.json"), "utf8"),
);

check(init.network === "devnet" && init.mainnetStatus === "HOLD", "V2 initialization boundary drift");
check(init.transactions?.length === 7, "V2 initialization must retain seven transactions");
check(feature.network === "devnet" && feature.mainnetStatus === "HOLD", "V2 feature boundary drift");
check(feature.transactions?.length === 4, "latest V2 feature snapshot must retain four transactions");
check(
  feature.status === "PARTIAL_PENDING_ALL_TIME_GATES_AND_INDEPENDENT_REVIEW",
  "latest feature snapshot must remain explicitly partial",
);
check(feature.positions?.every((position) => position === null), "latest feature snapshot unexpectedly claims a position");
check(legacy.network === "devnet" && legacy.transactions?.length === 4, "legacy record boundary drift");
check(receipt.network === "devnet" && receipt.mainnetStatus === "HOLD", "chain receipt boundary drift");
check(receipt.signingOrBroadcastPerformed === false, "chain receipt must stay read-only");
check(receipt.results?.length === 15, "chain receipt must retain 15 transaction statuses");
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
check(expectedSignatures.size === 15, "expected signature union must contain 15 unique values");
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
  "Public devnet evidence validation passed: six indexed records, 15 finalized signatures, CC0, no secret-bearing fields, mainnet HOLD.",
);

