import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const scorecardPath = resolve(root, "public/audits/localization-qa-20260803/language-qa-scorecard.json");
const policyPath = resolve(root, "app/i18n/reviewed-localization-policy.json");
const defaultOutput = resolve(root, "public/audits/localization-qa-20260803/hold-remediation-ledger.json");
const outputIndex = process.argv.indexOf("--output");
const outputPath = outputIndex >= 0 ? resolve(root, process.argv[outputIndex + 1] ?? "") : defaultOutput;
if (outputIndex >= 0 && !process.argv[outputIndex + 1]) throw new Error("--output requires a path");

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
};

const scorecardBytes = await readFile(scorecardPath);
const scorecard = JSON.parse(scorecardBytes.toString("utf8"));
const policy = JSON.parse(await readFile(policyPath, "utf8"));
if (scorecard.status !== "HOLD" || scorecard.summary?.FAIL !== 0 || scorecard.summary?.NOT_RUN !== 0) {
  throw new Error("Refusing to generate a HOLD ledger from a red or incomplete scorecard");
}
if (
  policy.schema !== "iat-reviewed-localization-policy/v1"
  || policy.mode !== "GLOBAL_FAIL_CLOSED"
  || policy.fallback !== "canonical-english"
  || policy.machineDraftRuntimeAllowed !== false
  || policy.unreviewedTargetLanguageBundleAllowed !== false
  || policy.unreviewedLocaleAutonymsAllowed !== false
  || policy.directComponentReviewBundleComplete !== false
) {
  throw new Error("Refusing to generate a HOLD ledger without GLOBAL_FAIL_CLOSED policy");
}
if (scorecard.sourceBinding?.reviewedPolicySha256 !== sha256(canonical(policy))) {
  throw new Error("Refusing to generate a HOLD ledger from a scorecard bound to a different reviewed-localization policy");
}

const results = scorecard.locales.flatMap((row) => row.checks.map((check) => ({ locale: row.locale, ...check })));
const holds = results.filter((result) => result.status === "HOLD");
const staticHolds = holds.filter((result) => result.mode === "STATIC");
const nativeHolds = holds.filter((result) => result.mode === "NATIVE");
const externalHolds = holds.filter((result) => result.id === "LQA-054" || /^LQA-(?:096|097|098|099|100)$/u.test(result.id));
const heuristicHolds = staticHolds.filter((result) => result.id !== "LQA-054");
const heuristicIds = [...new Set(heuristicHolds.map((result) => result.id))];
const heuristicEditorialQueue = heuristicIds.map((checkId) => {
  const matching = heuristicHolds.filter((result) => result.id === checkId);
  return {
    checkId,
    results: matching.length,
    locales: matching.map((result) => result.locale),
    reason: matching[0]?.detail ?? "Evidence-backed target-language cells require editorial review.",
    nextAction: "Inspect the source-bound samples, prepare a corrected candidate, attach accountable human review evidence, and regenerate the catalog and scorecard without weakening any HOLD boundary.",
    automationMayPrepare: true,
    automationMayApprove: false,
  };
});
const priorityLocales = [...new Set(heuristicHolds.map((result) => result.locale))]
  .map((locale) => {
    const matching = heuristicHolds.filter((result) => result.locale === locale);
    return { locale, heuristicHoldCount: matching.length, checkIds: matching.map((result) => result.id) };
  })
  .sort((left, right) => right.heuristicHoldCount - left.heuristicHoldCount)
  .slice(0, 5);

const ledger = {
  schemaVersion: 1,
  title: "IAT 50-locale QA HOLD remediation ledger",
  generatedAt: scorecard.generatedAt,
  status: "HOLD",
  mainnetStatus: "UNSCHEDULED_HOLD",
  sourceBinding: {
    scorecardPath: "projects/star-ascent/site/public/audits/localization-qa-20260803/language-qa-scorecard.json",
    scorecardSha256: sha256(scorecardBytes),
    scorecardGeneratedAt: scorecard.generatedAt,
    catalogHeadCommit: scorecard.sourceBinding.headCommit,
    catalogHeadTree: scorecard.sourceBinding.headTree,
    reviewedPolicySha256: sha256(canonical(policy)),
  },
  scorecardSummary: scorecard.summary,
  holdSummary: {
    total: holds.length,
    static: staticHolds.length,
    native: nativeHolds.length,
    externalEvidenceOnly: externalHolds.length,
    heuristicEditorialReview: heuristicHolds.length,
    automationMayApprove: 0,
  },
  externalEvidenceGates: [
    {
      checkIds: ["LQA-054"], results: 50, localeCoverage: "ALL_50",
      requiredEvidence: "Independent language-identification evidence bound to each locale catalog digest, including engine, threshold, identified locale, and confidence.",
      owner: "independent-language-id-reviewer", automationMayPrepare: true, automationMayApprove: false,
      disposition: "BLOCKED_EXTERNAL_EVIDENCE",
    },
    {
      checkIds: ["LQA-096", "LQA-097", "LQA-098", "LQA-099", "LQA-100"], results: 250, localeCoverage: "ALL_50",
      requiredEvidence: "Accountable native-language review records for meaning, cadence/register, regional fit, safety terminology, and all 25 canonical routes.",
      owner: "accountable-native-reviewers", automationMayPrepare: true, automationMayApprove: false,
      disposition: "BLOCKED_NATIVE_REVIEW",
    },
  ],
  heuristicEditorialQueue,
  priorityLocales,
  decisions: [
    { id: "LQA-HOLD-001", state: "HOLD", decision: "Automation may prepare candidates and evidence inventories but cannot approve LQA-054 or LQA-096 through LQA-100." },
    { id: "LQA-HOLD-002", state: heuristicHolds.length ? "ORDERED_REVIEW" : "NO_ACTIVE_HEURISTIC_QUEUE", decision: heuristicHolds.length ? "Prioritize the highest-density evidence-backed editorial queues while retaining all native-review gates." : "Unreviewed target-language drafts are inactive; no heuristic queue is presented as reviewed or approved." },
    { id: "LQA-HOLD-003", state: "NO_RELEASE_CLAIM", decision: "Zero FAIL and zero NOT_RUN do not convert the scorecard HOLD into native-language approval or Mainnet readiness." },
  ],
  assurance: {
    allFiveThousandPassed: false,
    nativeQualityClaimAllowed: false,
    languageIdIndependentlyVerified: false,
    heuristicHoldsResolved: false,
    releaseApproved: false,
    mainnetStateChanged: false,
  },
  limitations: [
    "This ledger reorganizes source-bound HOLD results; it does not close or downgrade any result.",
    "Canonical English fallback removes unsafe drafts from runtime but does not approve a target-language translation.",
    "Native meaning, cadence, slang, regional fit, and safety terminology remain unapproved without accountable native evidence.",
    "No site deployment, wallet, signing, funding, or chain state is changed by this ledger.",
  ],
};

await writeFile(outputPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
console.log(`Language QA HOLD ledger generated: ${holds.length} HOLD (${externalHolds.length} external, ${heuristicHolds.length} heuristic).`);
