import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const auditRoot = resolve("public/audits");
const packages = [
  { slug: "iat-hero-dlc-20260802", kind: "hero" },
  { slug: "iat-associates-dlc-20260802", kind: "associates" },
];
const artifacts = [
  "README.md",
  "findings.json",
  "scope.json",
  "attack-matrix.json",
  "THREAT-AND-GAME-THEORY.md",
  "checks.json",
];

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function bytes(path) {
  return readFileSync(path);
}

function readJson(path) {
  return JSON.parse(bytes(path).toString("utf8"));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function countSeverities(findings) {
  return findings.reduce((counts, finding) => {
    check(["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(finding.severity), `unknown severity ${finding.severity}`);
    check(["OPEN", "OPEN_INHERITED"].includes(finding.status), `${finding.id} must remain visibly open`);
    counts[finding.severity] += 1;
    return counts;
  }, { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 });
}

for (const entry of packages) {
  const root = resolve(auditRoot, entry.slug);
  const manifest = readJson(resolve(root, "manifest.json"));
  const register = readJson(resolve(root, "findings.json"));
  const scope = readJson(resolve(root, "scope.json"));
  const matrix = readJson(resolve(root, "attack-matrix.json"));
  const checks = readJson(resolve(root, "checks.json"));
  const readme = bytes(resolve(root, "README.md")).toString("utf8");
  const threat = bytes(resolve(root, "THREAT-AND-GAME-THEORY.md")).toString("utf8");

  check(manifest.launchDecision === "HOLD", `${entry.slug} must remain HOLD`);
  check(manifest.mainnetStatus === "HOLD", `${entry.slug} cannot move mainnet from HOLD`);
  check(manifest.assurance === "INTERNAL_CODEX_ASSISTED_NOT_INDEPENDENT", `${entry.slug} assurance drift`);
  check(manifest.clearance?.securityBlockersResolved === false, `${entry.slug} blockers cannot be declared resolved`);
  check(manifest.clearance?.independentAuditComplete === false, `${entry.slug} cannot claim independent review`);
  for (const capability of ["authorizesDeployment", "authorizesFunding", "authorizesActivation", "authorizesSigning", "authorizesBroadcast"]) {
    check(manifest.clearance?.[capability] === false, `${entry.slug} unexpectedly grants ${capability}`);
  }

  const identity = manifest.identityModel;
  check(identity?.unit === "UNIQUE_WALLET_PLUS_IMMUTABLE_X_ID_PLUS_X_PREMIUM", `${entry.slug} identity unit drift`);
  check(identity?.oneHumanPerAccountRequired === false, `${entry.slug} must not impose proof of personhood`);
  check(identity?.multipleQualifyingPairsPerPersonAllowed === true, `${entry.slug} must allow multiple qualifying pairs per person`);
  check(identity?.xPremiumRequiredForEveryPair === true, `${entry.slug} must require Premium for every pair`);

  check(register.auditedSourceCommit === manifest.sourceBinding.commit, `${entry.slug} source commit mismatch`);
  check(scope.sourceCommit === manifest.sourceBinding.commit, `${entry.slug} scope commit mismatch`);
  check(/^[0-9a-f]{40}$/u.test(scope.sourceCommit), `${entry.slug} source commit is not full SHA-1`);
  const ids = new Set();
  for (const finding of register.findings) {
    check(!ids.has(finding.id), `${entry.slug} repeats finding ${finding.id}`);
    ids.add(finding.id);
  }
  const counts = countSeverities(register.findings);
  check(register.findings.length === manifest.findingSummary.total, `${entry.slug} total count mismatch`);
  for (const severity of Object.keys(counts)) {
    check(counts[severity] === manifest.findingSummary.openBySeverity[severity], `${entry.slug} ${severity} count mismatch`);
  }
  check(counts.CRITICAL > 0 && counts.HIGH > 0, `${entry.slug} must preserve recorded blockers`);

  for (const testCase of matrix.cases) {
    if (testCase.finding) check(ids.has(testCase.finding), `${entry.slug} attack ${testCase.id} references unknown finding`);
  }
  check(checks.results.some((result) => result.result === "FAIL"), `${entry.slug} checks must record current failures`);

  for (const name of artifacts) {
    check(manifest.artifactSha256?.[name] === sha256(bytes(resolve(root, name))), `${entry.slug} artifact digest mismatch: ${name}`);
  }
  const labelText = `${readme}\n${threat}`;
  for (const label of ["FUTURE", "NOT PART OF GENESIS", "INACTIVE", "NOT DEPLOYED", "NO CLAIM ROUTE"]) {
    check(labelText.includes(label), `${entry.slug} missing public ${label} label`);
  }

  if (entry.kind === "hero") {
    check(manifest.featureBoundary.earliestOffsetSeconds === 28_800, "Hero offset must be exactly 8 hours");
    check(manifest.featureBoundary.automaticActivation === false, "Hero activation must never be automatic");
    check(manifest.featureBoundary.technicallyIsolatedFromGenesisCandidate === true, "Hero proposal isolation drift");
    check(manifest.featureBoundary.deployed === false && manifest.featureBoundary.claimRoute === null, "Hero deployment/claim gate drift");
  } else {
    check(manifest.featureBoundary.intendedPartOfGenesis === false, "Associates must remain intended future-only");
    check(manifest.featureBoundary.technicallyIsolatedFromGenesisCandidate === false, "Associates isolation finding cannot be masked");
    check(manifest.featureBoundary.separateDeployableDlcExists === false, "Associates separate-DLC claim is unsupported");
    check(manifest.featureBoundary.timeGateImplemented === false, "Associates time-gate finding cannot be masked");

    for (const [relativePath, expected] of Object.entries(scope.criticalSourceSha256)) {
      const actual = sha256(bytes(resolve(relativePath)));
      check(actual === expected, `Associates audited source drift: ${relativePath}`);
    }
    const lib = bytes(resolve("programs/iat_v2/src/lib.rs")).toString("utf8");
    const policy = bytes(resolve("programs/iat_v2/src/policy.rs")).toString("utf8");
    check(policy.includes("CCC_ASSOCIATE_RATE_BPS") && /2\s*=>\s*Some\(CCC_ASSOCIATE_RATE_BPS\)/u.test(policy), "Associate role mapping no longer matches report");
    check(lib.includes("pub fn set_eligibility") && lib.includes("pub fn open_position"), "Associate entry path no longer matches report");
    check(!/associates?_active|associate_activation_timestamp/iu.test(`${lib}\n${policy}`), "Associates gate added; refresh audit instead of retaining stale finding");
    check(!/subscription_type|x_premium/iu.test(`${lib}\n${policy}`), "Premium boundary changed; refresh audit");
  }
}

const index = bytes(resolve(auditRoot, "FUTURE-FEATURE-AUDIT-INDEX.md")).toString("utf8");
check(index.includes("NOT PART OF GENESIS") && index.includes("MAINNET HOLD"), "future-feature index labels drift");
check(index.includes("iat-hero-dlc-20260802") && index.includes("iat-associates-dlc-20260802"), "future-feature index links incomplete");

console.log("Future DLC audits validated: Hero 8 open findings; Associates 9 open findings; both future/inactive/no-claim, mainnet HOLD.");
