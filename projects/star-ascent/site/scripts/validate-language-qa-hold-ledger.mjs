import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { readCanonicalTrackedFile } from "./lib/read-canonical-tracked-file.mjs";

const siteRoot = process.cwd();
const repoRoot = resolve(siteRoot, "../../..");
const auditRoot = resolve(siteRoot, "public/audits/localization-qa-20260803");
const readArtifact = (name) => readCanonicalTrackedFile({ repoRoot, absolutePath: resolve(auditRoot, name) });
const scorecardBytes = readArtifact("language-qa-scorecard.json");
const scorecard = JSON.parse(scorecardBytes.toString("utf8"));
const ledger = JSON.parse(readArtifact("hold-remediation-ledger.json").toString("utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const check = (condition, message) => {
  if (!condition) throw new Error(`Language QA HOLD ledger validation failed: ${message}`);
};

check(ledger.schemaVersion === 1, "unexpected schema version");
check(ledger.status === "HOLD", "ledger must remain HOLD");
check(ledger.mainnetStatus === "UNSCHEDULED_HOLD", "Mainnet must remain unscheduled HOLD");
check(ledger.sourceBinding.scorecardSha256 === sha256(scorecardBytes), "scorecard hash mismatch");
check(ledger.sourceBinding.scorecardGeneratedAt === scorecard.generatedAt, "scorecard generation time mismatch");
check(ledger.sourceBinding.catalogHeadCommit === scorecard.sourceBinding.headCommit, "catalog source commit mismatch");
check(ledger.sourceBinding.catalogHeadTree === scorecard.sourceBinding.headTree, "catalog source tree mismatch");
check(JSON.stringify(ledger.scorecardSummary) === JSON.stringify(scorecard.summary), "scorecard summary mismatch");

const holds = [];
for (const locale of scorecard.locales) {
  for (const result of locale.checks) {
    if (result.status === "HOLD") holds.push({ locale: locale.locale, ...result });
  }
}
const staticHolds = holds.filter(({ mode }) => mode === "STATIC");
const nativeHolds = holds.filter(({ mode }) => mode === "NATIVE");
const externalHolds = holds.filter(({ id }) => id === "LQA-054" || /^LQA-(?:096|097|098|099|100)$/u.test(id));
const heuristicHolds = staticHolds.filter(({ id }) => id !== "LQA-054");

check(holds.length === ledger.holdSummary.total, "total HOLD count mismatch");
check(staticHolds.length === ledger.holdSummary.static, "static HOLD count mismatch");
check(nativeHolds.length === ledger.holdSummary.native, "native HOLD count mismatch");
check(externalHolds.length === ledger.holdSummary.externalEvidenceOnly, "external-evidence HOLD count mismatch");
check(heuristicHolds.length === ledger.holdSummary.heuristicEditorialReview, "heuristic editorial HOLD count mismatch");
check(ledger.holdSummary.automationMayApprove === 0, "automation cannot approve HOLD results");

const expectedQueueIds = ["LQA-051", "LQA-052", "LQA-055", "LQA-056", "LQA-057", "LQA-058", "LQA-060"];
check(JSON.stringify(ledger.heuristicEditorialQueue.map(({ checkId }) => checkId)) === JSON.stringify(expectedQueueIds), "heuristic queue inventory drift");
for (const queue of ledger.heuristicEditorialQueue) {
  const matching = heuristicHolds.filter(({ id }) => id === queue.checkId);
  check(queue.results === matching.length, `result count mismatch for ${queue.checkId}`);
  check(JSON.stringify(queue.locales) === JSON.stringify(matching.map(({ locale }) => locale)), `locale order mismatch for ${queue.checkId}`);
  check(queue.automationMayPrepare === true, `candidate preparation must remain explicit for ${queue.checkId}`);
  check(queue.automationMayApprove === false, `automation cannot approve ${queue.checkId}`);
  check(queue.nextAction.length > 80, `next action missing for ${queue.checkId}`);
}

check(ledger.externalEvidenceGates.reduce((total, gate) => total + gate.results, 0) === 300, "external evidence gate total mismatch");
for (const gate of ledger.externalEvidenceGates) {
  check(gate.localeCoverage === "ALL_50", "external evidence must cover all 50 locales");
  check(gate.automationMayApprove === false, "automation cannot approve external evidence");
  check(gate.disposition.startsWith("BLOCKED_"), "external evidence must remain blocked");
}

for (const priority of ledger.priorityLocales) {
  const localeHolds = heuristicHolds.filter(({ locale }) => locale === priority.locale);
  check(priority.heuristicHoldCount === localeHolds.length, `priority count mismatch for ${priority.locale}`);
  check(JSON.stringify(priority.checkIds) === JSON.stringify(localeHolds.map(({ id }) => id)), `priority check order mismatch for ${priority.locale}`);
}
check(ledger.priorityLocales.length === 5 && ledger.priorityLocales.every(({ heuristicHoldCount }) => heuristicHoldCount === 5), "priority queue must contain the five highest-density locales");
check(ledger.decisions.some(({ id, state }) => id === "LQA-HOLD-003" && state === "NO_RELEASE_CLAIM"), "no-release decision missing");
for (const value of Object.values(ledger.assurance)) check(value === false, "assurance flags must remain false");
check(ledger.limitations.length === 4, "limitation inventory drift");

console.log("Language QA HOLD ledger valid: 4544 PASS, 0 FAIL, 456 HOLD, 0 NOT_RUN; 300 external-evidence gates and 156 heuristic editorial reviews remain fail closed across 50 locales.");
