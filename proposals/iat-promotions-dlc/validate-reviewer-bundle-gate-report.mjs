/**
 * Validator for the offline reviewer-bundle linter and public gate report.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { generateReviewerBundleGateReport } from "./generate-reviewer-bundle-gate-report.mjs";

const REPORT_PATH = fileURLToPath(new URL("./reviewer-bundle-gate-report.v1.md", import.meta.url));
const LINTER_PATH = fileURLToPath(new URL("./reviewer-bundle-linter.mjs", import.meta.url));
const HOLD_BANNER = "> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**";

export function validateReviewerBundleGateReport() {
  const report = readFileSync(REPORT_PATH, "utf8");
  const linterSource = readFileSync(LINTER_PATH, "utf8");
  const errors = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };

  expect(report === generateReviewerBundleGateReport(), "reviewer-bundle gate report differs from deterministic generation");
  expect(report.includes(HOLD_BANNER), "reviewer-bundle gate report HOLD banner drift");
  expect(report.includes("Candidate policy result: **CANDIDATE_REJECTED**"), "public report no longer rejects the candidate");
  expect(report.includes("Gates passed: **5/6**"), "public report gate count drift");
  expect(report.includes("| Cryptographic attestation | **FAIL** |"), "public report hides the cryptographic failure");
  expect(report.includes("`CRYPTOGRAPHIC_ATTESTATION`: INVALID_EXTERNAL_SIGNATURE"), "public report failure detail drift");
  expect(report.includes("Receipt issued: **false**"), "public report claims receipt issuance");
  expect(report.includes("Review completed by this linter: **false**"), "public report claims completed review");
  expect(report.includes("Activation authorized: **false**"), "public report claims activation authority");
  expect(report.includes("Activation effect: **NONE**"), "public report has activation effect");
  expect(!/signaturehex|private.?key|oauth.?token/i.test(report), "public report exposes signature or secret material");
  expect(
    !/\bgenerateKeyPair(?:Sync)?\s*\(|\bcreatePrivateKey\s*\(|\bsign\s*\(|\bfetch\s*\(|\bWebSocket\s*\(/.test(linterSource),
    "reviewer-bundle linter contains signing, keygen, or network capability",
  );
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateReviewerBundleGateReport();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Offline reviewer-bundle gate report reproduces and remains rejected, unissued, and non-activating.");
  }
}
