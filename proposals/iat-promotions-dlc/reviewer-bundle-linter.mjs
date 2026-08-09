/**
 * Offline, verify-only independent-review bundle linter.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { evaluateIndependentReviewReceiptCandidate } from "./independent-review-receipt-acceptance.mjs";
import { preflightReviewerInputs, renderReviewerInputPreflight } from "./reviewer-bundle-preflight.mjs";

const TEMPLATE_PATH = fileURLToPath(new URL("./independent-review-receipt-template.v1.json", import.meta.url));
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];

export const REVIEW_GATE_DEFINITIONS = [
  ["EXACT_SHAPE", "Exact shape", "exactShape"],
  ["TARGET_BINDING", "Target binding", "targetBinding"],
  ["SCOPE_COMPLETE", "Complete scope", "scopeComplete"],
  ["REVIEWER_INDEPENDENCE", "Reviewer independence", "reviewerIndependent"],
  ["SEMANTIC_REVIEW", "Semantic review", "semanticReview"],
  ["CRYPTOGRAPHIC_ATTESTATION", "Cryptographic attestation", "cryptographicAttestation"],
];

function safeCanonicalSha256(value) {
  try {
    return canonicalSha256(value);
  } catch {
    return null;
  }
}

function failClosedEvaluation(error) {
  return {
    policyVersion: 1,
    evaluationOnly: true,
    accepted: false,
    gates: Object.fromEntries(REVIEW_GATE_DEFINITIONS.map(([, , field]) => [field, false])),
    failures: [{
      gate: "INPUT_VALIDATION",
      detail: error instanceof Error ? error.message : "review bundle evaluation failed",
    }],
    decision: "NOT_ACCEPTED",
    receiptIssued: false,
    reviewCompletedByThisEvaluator: false,
    activationAuthorized: false,
    activationEffect: "NONE",
  };
}

export function lintReviewerBundle(candidate, expectedTarget, receiptTemplate) {
  let evaluation;
  try {
    evaluation = evaluateIndependentReviewReceiptCandidate(candidate, expectedTarget, receiptTemplate);
  } catch (error) {
    evaluation = failClosedEvaluation(error);
  }

  const gates = REVIEW_GATE_DEFINITIONS.map(([id, label, field]) => ({
    id,
    label,
    result: evaluation.gates?.[field] === true ? "PASS" : "FAIL",
  }));
  const passedGateCount = gates.filter((gate) => gate.result === "PASS").length;

  return {
    reportVersion: 1,
    reportId: "iat-promotions-dlc-reviewer-bundle-gate-report-v1",
    status: {
      labels: HOLD_LABELS,
      network: "NONE",
      programId: null,
      deployable: false,
      acceptancePolicyApplied: false,
    },
    evaluationOnly: true,
    inputBindings: {
      candidateCanonicalSha256: safeCanonicalSha256(candidate),
      expectedTargetCanonicalSha256: safeCanonicalSha256(expectedTarget),
      receiptTemplateCanonicalSha256: safeCanonicalSha256(receiptTemplate),
    },
    summary: {
      outcome: evaluation.accepted === true ? "CANDIDATE_PASSES_ALL_GATES" : "CANDIDATE_REJECTED",
      passedGateCount: String(passedGateCount),
      failedGateCount: String(gates.length - passedGateCount),
      totalGateCount: String(gates.length),
    },
    gates,
    failures: Array.isArray(evaluation.failures) ? evaluation.failures : [],
    candidateSatisfiesPolicy: evaluation.accepted === true,
    decision: evaluation.accepted === true ? evaluation.decision : "NOT_ACCEPTED",
    receiptIssued: false,
    reviewCompletedByThisLinter: false,
    activationAuthorized: false,
    activationEffect: "NONE",
  };
}

function renderBinding(value) {
  return value ?? "UNAVAILABLE (input could not be canonicalized)";
}

export function renderReviewerBundleGateReport(report) {
  const failureLines = report.failures.length
    ? report.failures.map((failure) => `- \`${failure.gate}\`: ${failure.detail}`)
    : ["- None reported by the policy evaluator."];
  const gateRows = report.gates.map((gate) => `| ${gate.label} | **${gate.result}** |`);
  return [
    "# Offline independent-review bundle gate report",
    "",
    "> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**",
    "",
    "This deterministic report is evaluation-only. It does not complete an independent",
    "review, issue a receipt, create a signature, or authorize activation.",
    "",
    "## Verdict",
    "",
    `- Candidate policy result: **${report.summary.outcome}**`,
    `- Gates passed: **${report.summary.passedGateCount}/${report.summary.totalGateCount}**`,
    `- Receipt issued: **${report.receiptIssued}**`,
    `- Review completed by this linter: **${report.reviewCompletedByThisLinter}**`,
    `- Activation authorized: **${report.activationAuthorized}**`,
    `- Activation effect: **${report.activationEffect}**`,
    "",
    "## Input commitments",
    "",
    `- Candidate canonical SHA-256: \`${renderBinding(report.inputBindings.candidateCanonicalSha256)}\``,
    `- Expected-target canonical SHA-256: \`${renderBinding(report.inputBindings.expectedTargetCanonicalSha256)}\``,
    `- Receipt-template canonical SHA-256: \`${renderBinding(report.inputBindings.receiptTemplateCanonicalSha256)}\``,
    "",
    "The expected target must come from a separately trusted publication or reviewer",
    "workflow. A candidate cannot establish its own review target merely by repeating it.",
    "",
    "## Gate results",
    "",
    "| Gate | Result |",
    "| --- | --- |",
    ...gateRows,
    "",
    "## Failures",
    "",
    ...failureLines,
    "",
    "## Authority boundary",
    "",
    "A PASS result would mean only that the supplied candidate satisfies the draft review",
    "policy against the separately supplied expected target. This linter always issues no",
    "receipt, completes no review, and has no deployment, wallet, token, site, DNS, network,",
    "Genesis, or activation authority.",
    "",
  ].join("\n");
}

function parseCliArgs(args) {
  const parsed = { format: "markdown" };
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!value || !["--candidate", "--expected-target", "--format"].includes(flag)) {
      throw new Error(
        "usage: node reviewer-bundle-linter.mjs --candidate <json> --expected-target <json> [--format markdown|json]",
      );
    }
    if (flag === "--candidate") parsed.candidatePath = value;
    if (flag === "--expected-target") parsed.expectedTargetPath = value;
    if (flag === "--format") parsed.format = value;
  }
  if (!parsed.candidatePath || !parsed.expectedTargetPath) throw new Error("candidate and expected-target files are required");
  if (!["markdown", "json"].includes(parsed.format)) throw new Error("format must be markdown or json");
  return parsed;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = parseCliArgs(process.argv.slice(2));
    const candidate = JSON.parse(readFileSync(args.candidatePath, "utf8"));
    const expectedTarget = JSON.parse(readFileSync(args.expectedTargetPath, "utf8"));
    const receiptTemplate = JSON.parse(readFileSync(TEMPLATE_PATH, "utf8"));
    const preflight = preflightReviewerInputs(candidate, expectedTarget);
    if (!preflight.structuralValid) {
      process.stdout.write(
        args.format === "json"
          ? `${JSON.stringify(preflight, null, 2)}\n`
          : renderReviewerInputPreflight(preflight),
      );
      process.exitCode = 3;
    } else {
      const report = lintReviewerBundle(candidate, expectedTarget, receiptTemplate);
      process.stdout.write(
        args.format === "json"
          ? `${JSON.stringify(report, null, 2)}\n`
          : renderReviewerBundleGateReport(report),
      );
      if (!report.candidateSatisfiesPolicy) process.exitCode = 2;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "reviewer bundle lint failed");
    process.exitCode = 1;
  }
}
