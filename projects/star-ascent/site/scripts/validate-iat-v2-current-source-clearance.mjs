#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { validateSbfEvidence } from "./validate-iat-v2-ci-sbf-evidence.mjs";

const canonicalPath = "launch/iat-v2-current-source-clearance.json";
const inputPath = process.argv[2] ?? canonicalPath;
if (inputPath !== canonicalPath) {
  console.error(`FAIL: current-source clearance path must be ${canonicalPath}`);
  process.exit(1);
}

const record = JSON.parse(readFileSync(resolve(inputPath), "utf8"));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && JSON.stringify(Object.keys(value)) === JSON.stringify(keys);
const digest = (value) => typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
const utc = (value) => typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(value)
  && Number.isFinite(Date.parse(value));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const receiptUrl = (value) => {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase().replace(/\.+$/u, "");
    return parsed.protocol === "https:" && parsed.username === "" && parsed.password === ""
      && host !== "localhost" && host !== "example.com" && !host.startsWith("placeholder");
  } catch {
    return false;
  }
};
const base58Length = (value) => {
  if (typeof value !== "string" || !/^[1-9A-HJ-NP-Za-km-z]+$/u.test(value)) return -1;
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let number = 0n;
  for (const character of value) number = number * 58n + BigInt(alphabet.indexOf(character));
  let bytes = 0;
  while (number > 0n) { bytes += 1; number >>= 8n; }
  let zeroes = 0;
  while (zeroes < value.length && value[zeroes] === "1") zeroes += 1;
  return bytes + zeroes;
};
const signature = (value) => base58Length(value) === 64;

const topKeys = ["schema", "status", "mainnetStatus", "scope", "sourceBinding", "evidence", "clearance", "observedAtUtc", "limitations"];
const sourceKeys = ["commit", "tree", "programTree", "programArtifactSha256", "programArtifactBytes", "ciBuildEvidenceSha256"];
const evidenceKeys = ["currentSourceSbf", "signedDevnetRehearsal", "productionIdentityIntegration", "automatedSecurityClosure"];
const clearanceKeys = ["currentSourceSbfComplete", "freshSignedDevnetComplete", "productionIdentityIntegrationComplete", "zeroUnacceptedCriticalOrHigh", "automatedDirectEvidenceComplete"];
const refKeys = ["predicate", "path", "sha256"];
const directEvidenceKeys = ["schema", "predicate", "observationMode", "sourceCommit", "sourceTree", "programArtifactSha256", "network", "observedAtUtc", "receipts", "transactionSignatures", "checks"];
const checkReceiptKeys = ["schema", "predicate", "checkId", "result", "sourceCommit", "programArtifactSha256", "observedAtUtc", "detailsSha256"];
const predicates = {
  currentSourceSbf: { predicate: "CURRENT_SOURCE_REPRODUCIBLE_SBF", network: "build", signatures: false },
  signedDevnetRehearsal: { predicate: "CURRENT_SOURCE_SIGNED_DEVNET_REHEARSAL", network: "devnet", signatures: true },
  productionIdentityIntegration: { predicate: "PRODUCTION_IDENTITY_INTEGRATION_REHEARSAL", network: "production-integration", signatures: false },
  automatedSecurityClosure: { predicate: "AUTOMATED_SECURITY_CLOSURE", network: "source", signatures: false },
};
// V1's generic URL plus source-authored check-receipt envelope is sufficient for
// byte binding, but it cannot authenticate either an X/Cloudflare integration
// observation or an independently completed security run. Keep those predicates
// non-clearing until each has a predicate-specific validator for its external
// receipt/artifact. This prevents a repository author from manufacturing the two
// remaining assertions after obtaining an otherwise valid public CI SBF artifact.
const externalPredicateBlockers = Object.freeze({
  productionIdentityIntegration:
    "production identity integration cannot clear under v1 without a predicate-specific externally authenticated X/D1 receipt validator",
  automatedSecurityClosure:
    "automated security closure cannot clear under v1 without a predicate-specific independently completed CI security artifact validator",
});

check(exactKeys(record, topKeys), "record must contain only the canonical top-level fields");
check(record.schema === "iat-v2-current-source-clearance/v1", "unexpected current-source clearance schema");
check(["HOLD", "CLEAR"].includes(record.status), "status must be HOLD or CLEAR");
check(record.mainnetStatus === "HOLD", "current-source clearance must keep Mainnet on HOLD");
check(record.scope === "Current-source automated direct-evidence clearance only; this record never authorizes signing, broadcast, deployment, funding, scheduling, publication, or Mainnet execution.", "scope lost its non-authorizing boundary");
check(exactKeys(record.sourceBinding, sourceKeys), "sourceBinding must contain only canonical fields");
check(exactKeys(record.evidence, evidenceKeys), "evidence must contain only four canonical predicates");
check(exactKeys(record.clearance, clearanceKeys), "clearance must contain only canonical fields");
check(Array.isArray(record.limitations) && record.limitations.length === 4 && record.limitations.every((item) => typeof item === "string" && item.length > 30), "four explicit limitations are required");

if (record.status === "HOLD") {
  for (const [field, value] of Object.entries(record.sourceBinding ?? {})) check(value === null, `HOLD requires sourceBinding.${field} to be null`);
  for (const [field, value] of Object.entries(record.evidence ?? {})) check(value === null, `HOLD requires evidence.${field} to be null`);
  for (const [field, value] of Object.entries(record.clearance ?? {})) check(value === false, `HOLD requires clearance.${field} to be false`);
  check(record.observedAtUtc === null, "HOLD requires observedAtUtc to be null");
}

if (record.status === "CLEAR") {
  const binding = record.sourceBinding ?? {};
  check(/^[0-9a-f]{40}$/u.test(binding.commit ?? ""), "CLEAR requires a full lowercase source commit");
  check(/^[0-9a-f]{40}$/u.test(binding.tree ?? ""), "CLEAR requires the exact source tree");
  check(/^[0-9a-f]{40}$/u.test(binding.programTree ?? ""), "CLEAR requires the exact program tree");
  check(digest(binding.programArtifactSha256), "CLEAR requires the current program artifact SHA-256");
  check(Number.isSafeInteger(binding.programArtifactBytes) && binding.programArtifactBytes > 0, "CLEAR requires a positive program artifact byte count");
  check(digest(binding.ciBuildEvidenceSha256), "CLEAR requires the exact CI build-evidence manifest SHA-256");
  check(utc(record.observedAtUtc) && Date.parse(record.observedAtUtc) <= Date.now() + 60_000, "CLEAR requires a non-future canonical UTC observation time");
  for (const [field, value] of Object.entries(record.clearance ?? {})) check(value === true, `CLEAR requires clearance.${field} to be true`);

  const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 50_000_000 }).trim();
  try {
    check(git("rev-parse", `${binding.commit}^{tree}`) === binding.tree, "source tree does not match the bound commit");
    check(git("rev-parse", `${binding.commit}:projects/star-ascent/site/programs/iat_v2`) === binding.programTree, "program tree does not match the bound commit");
  } catch {
    check(false, "bound source commit and program tree must exist in the current repository");
  }

  let ciEvidence;
  let ciManifest;
  try {
    const ciManifestPath = resolve("target/verifiable/iat-v2-build-evidence.json");
    const ciManifestBytes = readFileSync(ciManifestPath);
    check(sha256(ciManifestBytes) === binding.ciBuildEvidenceSha256, "CI build-evidence manifest digest mismatch");
    ciManifest = JSON.parse(ciManifestBytes);
    ciEvidence = validateSbfEvidence({
      projectRoot: resolve("."),
      manifestPath: ciManifestPath,
      allowDescendantCheckout: true,
    });
    check(ciEvidence.sourceHeadCommit === binding.commit, "CI provenance source commit does not match the successor binding");
    check(ciManifest.sourceBinding?.sourceHeadTree === binding.tree, "CI provenance source tree does not match the successor binding");
    check(ciManifest.artifacts?.programBinary?.sha256 === binding.programArtifactSha256, "CI program artifact SHA-256 does not match the successor binding");
    check(ciManifest.artifacts?.programBinary?.bytes === binding.programArtifactBytes, "CI program artifact bytes do not match the successor binding");
  } catch (error) {
    check(false, `CLEAR requires canonical public-GitHub CI SBF provenance and exact local artifacts: ${error.message}`);
  }

  for (const [field, expected] of Object.entries(predicates)) {
    const ref = record.evidence?.[field];
    check(exactKeys(ref, refKeys), `CLEAR requires canonical evidence.${field}`);
    if (!ref || !exactKeys(ref, refKeys)) continue;
    check(ref.predicate === expected.predicate, `evidence.${field}.predicate is incorrect`);
    check(typeof ref.path === "string" && ref.path.startsWith("public/evidence/iat-v2/current-source/") && ref.path.endsWith(".json"), `evidence.${field}.path must use the current-source public evidence directory`);
    check(digest(ref.sha256), `evidence.${field}.sha256 must be lowercase SHA-256`);
    const absolute = resolve(ref.path ?? "");
    const allowedRoot = `${resolve("public/evidence/iat-v2/current-source")}${sep}`;
    check(absolute.startsWith(allowedRoot), `evidence.${field}.path escapes the current-source evidence directory`);
    let bytes;
    try { bytes = readFileSync(absolute); } catch { check(false, `evidence.${field} file is missing`); continue; }
    check(sha256(bytes) === ref.sha256, `evidence.${field} digest does not match its exact bytes`);
    let evidence;
    try { evidence = JSON.parse(bytes); } catch { check(false, `evidence.${field} must be valid JSON`); continue; }
    check(exactKeys(evidence, directEvidenceKeys), `evidence.${field} must contain only canonical direct-evidence fields`);
    check(evidence.schema === "iat-v2-current-source-direct-evidence/v1", `evidence.${field} schema is incorrect`);
    check(evidence.predicate === expected.predicate && evidence.predicate === ref.predicate, `evidence.${field} predicate mismatch`);
    check(evidence.observationMode === "AUTOMATED_SOURCE_BOUND_DIRECT_OBSERVATION", `evidence.${field} must use automated direct observation`);
    check(evidence.sourceCommit === binding.commit && evidence.sourceTree === binding.tree, `evidence.${field} source binding mismatch`);
    check(evidence.programArtifactSha256 === binding.programArtifactSha256, `evidence.${field} program artifact mismatch`);
    check(evidence.network === expected.network, `evidence.${field} network is incorrect`);
    check(utc(evidence.observedAtUtc) && Date.parse(evidence.observedAtUtc) <= Date.now() + 60_000, `evidence.${field} requires a non-future UTC observation`);
    check(Array.isArray(evidence.receipts) && evidence.receipts.length > 0 && evidence.receipts.every(receiptUrl), `evidence.${field} requires public HTTPS receipts`);
    check(Array.isArray(evidence.checks) && evidence.checks.length > 0, `evidence.${field} requires direct-evidence checks`);
    for (const item of evidence.checks ?? []) {
      check(exactKeys(item, ["id", "result", "evidencePath", "evidenceSha256"]), `evidence.${field} check fields are not exact`);
      check(/^[A-Z][A-Z0-9_]{2,63}$/u.test(item.id ?? "") && item.result === "PASS" && digest(item.evidenceSha256), `evidence.${field} requires exact passing direct-evidence checks`);
      check(typeof item.evidencePath === "string" && item.evidencePath.startsWith("public/evidence/iat-v2/current-source/checks/") && item.evidencePath.endsWith(".json"), `evidence.${field} check path is not canonical`);
      let checkBytes;
      try { checkBytes = readFileSync(resolve(item.evidencePath ?? "")); } catch { check(false, `evidence.${field} check evidence is missing`); continue; }
      check(sha256(checkBytes) === item.evidenceSha256, `evidence.${field} check digest does not match exact bytes`);
      let checkReceipt;
      try { checkReceipt = JSON.parse(checkBytes); } catch { check(false, `evidence.${field} check evidence must be JSON`); continue; }
      check(exactKeys(checkReceipt, checkReceiptKeys), `evidence.${field} check receipt fields are not exact`);
      check(checkReceipt.schema === "iat-v2-current-source-check-receipt/v1"
        && checkReceipt.predicate === expected.predicate
        && checkReceipt.checkId === item.id
        && checkReceipt.result === "PASS"
        && checkReceipt.sourceCommit === binding.commit
        && checkReceipt.programArtifactSha256 === binding.programArtifactSha256
        && utc(checkReceipt.observedAtUtc)
        && Date.parse(checkReceipt.observedAtUtc) <= Date.now() + 60_000
        && digest(checkReceipt.detailsSha256), `evidence.${field} check receipt is not source-bound passing evidence`);
    }
    if (field === "currentSourceSbf" && ciEvidence) {
      check(evidence.receipts.includes(ciEvidence.runUrl), "current-source SBF evidence must cite the exact validated public GitHub Actions run");
    }
    if (expected.signatures) {
      check(Array.isArray(evidence.transactionSignatures) && evidence.transactionSignatures.length > 0 && evidence.transactionSignatures.every(signature), `evidence.${field} requires finalized Solana transaction signatures`);
      check(evidence.receipts.some((url) => evidence.transactionSignatures.some((item) => url.includes(item))), `evidence.${field} requires a receipt bound to a transaction signature`);
      for (const item of evidence.transactionSignatures) {
        check(evidence.receipts.includes(`https://explorer.solana.com/tx/${item}?cluster=devnet`), `evidence.${field} requires the exact Devnet Explorer receipt for every signature`);
      }
    } else {
      check(Array.isArray(evidence.transactionSignatures) && evidence.transactionSignatures.length === 0, `evidence.${field} must not imply transaction signatures`);
    }
    if (Object.hasOwn(externalPredicateBlockers, field)) {
      check(false, externalPredicateBlockers[field]);
    }
  }
}

if (failures.length) {
  console.error("IAT V2 current-source clearance validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`IAT V2 current-source clearance passes in ${record.status}: historical HOLD audits remain immutable, direct evidence is fail-closed, and Mainnet remains HOLD.`);
