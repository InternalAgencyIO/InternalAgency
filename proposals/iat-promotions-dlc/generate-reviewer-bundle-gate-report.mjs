/**
 * Deterministic human-readable report for the public rejection-only bundle.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { lintReviewerBundle, renderReviewerBundleGateReport } from "./reviewer-bundle-linter.mjs";

const VECTOR_PATH = fileURLToPath(
  new URL("./independent-review-receipt-acceptance-vectors.v1.json", import.meta.url),
);
const TEMPLATE_PATH = fileURLToPath(new URL("./independent-review-receipt-template.v1.json", import.meta.url));
const OUTPUT_PATH = fileURLToPath(new URL("./reviewer-bundle-gate-report.v1.md", import.meta.url));

export function generateReviewerBundleGateReport() {
  const vectors = JSON.parse(readFileSync(VECTOR_PATH, "utf8"));
  const receiptTemplate = JSON.parse(readFileSync(TEMPLATE_PATH, "utf8"));
  const scenario = vectors.scenarios.find((entry) => entry.name === "UNRELATED_SIGNATURE_ONLY");
  if (!scenario) throw new Error("public rejection-only review candidate is missing");
  return renderReviewerBundleGateReport(
    lintReviewerBundle(scenario.candidate, scenario.expectedTarget, receiptTemplate),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rendered = generateReviewerBundleGateReport();
  if (process.argv.includes("--write")) {
    writeFileSync(OUTPUT_PATH, rendered, "utf8");
    console.log("Wrote rejection-only gate report; no receipt or signature was created.");
  } else {
    process.stdout.write(rendered);
  }
}
