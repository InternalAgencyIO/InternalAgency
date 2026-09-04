#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import {
  IAT_B3_MANDATORY_CI_GATE_SCHEMA,
  IAT_B3_MANDATORY_CI_PROCESS_DIAGNOSTIC_SCHEMA,
  parseIatB3MandatoryCiGateArguments,
  runIatB3MandatoryCiGateCanonical,
} from "./run-iat-b3-mandatory-ci-gate.mjs";

const FALSE_REPORT_FIELDS = Object.freeze([
  "ready",
  "complete",
  "valid",
  "authorized",
  "sourceCheckpointObserved",
  "buildReceiptObserved",
  "buildReceiptValidated",
  "publicBuildInputObserved",
  "publicBuildInputAuthorized",
  "runtimeReceiptSourceObserved",
  "executionProvenanceObserved",
  "runtimeEvidenceObserved",
  "containmentProven",
  "tapObserved",
  "deadlineObserved",
  "cleanupObserved",
  "artifactBuilt",
  "nativeHelperExecuted",
  "processStarted",
  "callerInputAccepted",
  "injectedInputAccepted",
  "selfAuthoredReceiptAccepted",
  "automaticRetryAuthorized",
  "networkUsed",
  "rpcUsed",
  "keyRead",
  "transactionSigned",
  "transactionSent",
  "devnetExecuted",
  "mainnetExecuted",
  "mainnetAuthorized",
  "releaseAuthorized",
]);

function fail(message) {
  throw new Error(`IAT_B3_MANDATORY_CI_EXPECTED_HOLD_INVALID:${message}`);
}

export function assertIatB3MandatoryCiExpectedHold(report, gate) {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    fail("REPORT_SHAPE");
  }
  if (report.schema !== IAT_B3_MANDATORY_CI_GATE_SCHEMA
    || report.status !== "HOLD" || report.exitCode !== 2
    || report.gate !== gate) {
    fail("REPORT_IDENTITY");
  }
  for (const field of FALSE_REPORT_FIELDS) {
    if (report[field] !== false) fail(`REPORT_${field}`);
  }
  if (!Array.isArray(report.blockers)
    || !report.blockers.includes("SOURCE_BOUND_LIVE_BUILD_RECEIPT_UNAVAILABLE")
    || !report.blockers.includes("SOURCE_BOUND_LIVE_RUNTIME_RECEIPT_UNAVAILABLE")
    || !report.blockers.includes("CANONICAL_MANDATORY_CONTAINMENT_HOLD")
    || !report.blockers.includes("B27_NO_EXECUTION_API")) {
    fail("REPORT_BLOCKERS");
  }
  const diagnostic = report.diagnostic;
  if (!diagnostic || diagnostic.schema !== IAT_B3_MANDATORY_CI_PROCESS_DIAGNOSTIC_SCHEMA
    || diagnostic.status !== "HOLD" || diagnostic.exitCode !== 2
    || diagnostic.gate !== gate
    || diagnostic.reason !== "SOURCE_BOUND_LIVE_RECEIPTS_UNAVAILABLE"
    || diagnostic.sourceBoundReceiptObserved !== false
    || diagnostic.executionProvenanceObserved !== false
    || diagnostic.runtimeEvidenceObserved !== false
    || diagnostic.containmentProven !== false
    || diagnostic.ready !== false || diagnostic.complete !== false) {
    fail("REPORT_DIAGNOSTIC");
  }
  if (!Array.isArray(report.testSourceIdentity)
    || report.testSourceIdentity.length < 1
    || report.testSourceIdentity.some((source) =>
      typeof source?.sourcePath !== "string"
      || !/^[0-9a-f]{64}$/u.test(source?.sha256 ?? "")
      || !Number.isSafeInteger(source?.byteLength) || source.byteLength < 1)) {
    fail("REPORT_TEST_SOURCE_IDENTITY");
  }
  return report;
}

async function main() {
  const gate = parseIatB3MandatoryCiGateArguments(process.argv.slice(2));
  const report = await runIatB3MandatoryCiGateCanonical(gate);
  assertIatB3MandatoryCiExpectedHold(report, gate);
  process.stdout.write(`${JSON.stringify(report)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
