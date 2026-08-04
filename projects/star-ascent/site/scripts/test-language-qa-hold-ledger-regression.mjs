import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { validateLanguageQaHoldLedgerArtifacts } from "./validate-language-qa-hold-ledger.mjs";

const auditRoot = resolve("public/audits/localization-qa-20260803");
const baselineScorecard = JSON.parse(readFileSync(resolve(auditRoot, "language-qa-scorecard.json"), "utf8"));
const baselineLedger = JSON.parse(readFileSync(resolve(auditRoot, "hold-remediation-ledger.json"), "utf8"));
const serialize = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const bindLedger = (scorecard, ledger) => {
  const scorecardBytes = serialize(scorecard);
  ledger.sourceBinding.scorecardSha256 = createHash("sha256").update(scorecardBytes).digest("hex");
  ledger.sourceBinding.scorecardGeneratedAt = scorecard.generatedAt;
  ledger.sourceBinding.catalogHeadCommit = scorecard.sourceBinding.headCommit;
  ledger.sourceBinding.catalogHeadTree = scorecard.sourceBinding.headTree;
  ledger.scorecardSummary = structuredClone(scorecard.summary);
  return { scorecardBytes, ledgerBytes: serialize(ledger) };
};
const artifacts = (mutate) => {
  const scorecard = structuredClone(baselineScorecard);
  const ledger = structuredClone(baselineLedger);
  mutate(scorecard, ledger);
  return bindLedger(scorecard, ledger);
};
const expectFail = (name, mutate, pattern) => {
  try {
    validateLanguageQaHoldLedgerArtifacts(artifacts(mutate));
    throw new Error(`${name} unexpectedly passed`);
  } catch (error) {
    if (!pattern.test(error.message)) throw error;
  }
};

validateLanguageQaHoldLedgerArtifacts(bindLedger(structuredClone(baselineScorecard), structuredClone(baselineLedger)));

expectFail("truncated locale inventory", (scorecard) => { scorecard.locales.pop(); }, /exactly 50 locale rows/u);
expectFail("duplicate locale", (scorecard) => { scorecard.locales[1].locale = scorecard.locales[0].locale; }, /exact reviewed order/u);
expectFail("missing check", (scorecard) => { scorecard.locales[0].checks.pop(); }, /exactly 100 checks/u);
expectFail("duplicate check ID", (scorecard) => { scorecard.locales[0].checks[1].id = "LQA-001"; }, /check ID order/u);
expectFail("invented status", (scorecard) => { scorecard.locales[0].checks[0].status = "READY"; }, /invalid status READY/u);
expectFail("mode drift", (scorecard) => { scorecard.locales[0].checks[70].mode = "STATIC"; }, /mode drift/u);
expectFail("locale summary drift", (scorecard) => { scorecard.locales[0].summary.PASS -= 1; }, /en summary mismatch/u);
expectFail("global summary drift", (scorecard) => { scorecard.summary.PASS -= 1; }, /global summary mismatch/u);
expectFail("lane summary drift", (scorecard) => { scorecard.lanes.render.summary.PASS -= 1; }, /render lane summary mismatch/u);
expectFail("invalid locale digest", (scorecard) => { scorecard.locales[0].localeMessagesSha256 = "0"; }, /invalid locale digest/u);
expectFail("release assurance bypass", (scorecard) => { scorecard.assurance.releaseApproved = true; }, /assurance flags must remain false/u);
expectFail("missing source commit", (scorecard) => { scorecard.sourceBinding.headCommit = "0".repeat(40); }, /source commit is unavailable/u);
expectFail("source tree substitution", (scorecard) => { scorecard.sourceBinding.headTree = "0".repeat(40); }, /source tree mismatch/u);
expectFail("source digest substitution", (scorecard) => { scorecard.sourceBinding.definitionSha256 = "0".repeat(64); }, /definitionSha256 mismatch/u);
expectFail("dirty source claim", (scorecard) => { scorecard.sourceBinding.worktreeDirty = true; }, /clean source worktree/u);

console.log("Language QA HOLD ledger regression passed: exact 50 x 100 topology, unique ordered locale/check identities, status/mode/evidence structure, recomputed summaries, Git-resolved commit/tree/input digests, and fail-closed assurances survived 15 mutation probes.");
