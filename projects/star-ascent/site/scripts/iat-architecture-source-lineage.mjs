const EXPECTED_REPOSITORY = "InternalAgencyIO/InternalAgency";
const EXPECTED_HISTORICAL_AUDIT_PATH = "public/audits/iat-v2-architecture-work-20260805/manifest.json";

function fail(message) {
  throw new Error(`IAT architecture source lineage validation failed: ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertExactKeys(value, expected, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} is not an object`);
  assert(
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort()),
    `${label} fields are not exact`,
  );
}

function assertCommit(value, label) {
  assert(/^[0-9a-f]{40}$/u.test(value ?? ""), `${label} is not a lowercase 40-character commit`);
}

function assertTree(value, label) {
  assert(/^[0-9a-f]{40}$/u.test(value ?? ""), `${label} is not a lowercase 40-character tree`);
}

export function validateArchitectureSourceLineage({
  historicalManifest,
  historicalLedger,
  historicalManifestSha256,
  successorManifest,
  commitExists,
  treeForCommit,
  isAncestor,
  currentHead = "HEAD",
}) {
  assertExactKeys(
    successorManifest,
    [
      "schema",
      "status",
      "generatedAtUtc",
      "mainnetStatus",
      "relationship",
      "historicalV2Audit",
      "b3SuccessorBinding",
      "releaseBoundary",
    ],
    "successor manifest",
  );
  assert(successorManifest.schema === "iat-b3-canonical-source-lineage/v1", "unexpected successor schema");
  assert(successorManifest.status === "B3_PRIMARY_FORWARD_ARCHITECTURE", "successor status is not the B3 primary forward architecture");
  assert(/^2026-08-08T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$/u.test(successorManifest.generatedAtUtc ?? ""), "successor timestamp is invalid");
  assert(successorManifest.mainnetStatus === "UNSCHEDULED_HOLD", "successor manifest must retain Mainnet UNSCHEDULED_HOLD");
  assert(
    successorManifest.relationship === "EXPLICIT_SUCCESSOR_RETAINING_HISTORICAL_V2_EVIDENCE_WITHOUT_HEAD_ANCESTRY_REQUIREMENT",
    "successor relationship is not the reviewed historical-evidence boundary",
  );

  const historicalAudit = successorManifest.historicalV2Audit;
  assertExactKeys(
    historicalAudit,
    ["path", "manifestSha256", "status", "sourceBinding"],
    "historical V2 audit binding",
  );
  assert(historicalAudit.path === EXPECTED_HISTORICAL_AUDIT_PATH, "historical V2 audit path drifted");
  assert(/^[0-9a-f]{64}$/u.test(historicalAudit.manifestSha256 ?? ""), "historical V2 manifest digest is invalid");
  assert(historicalAudit.manifestSha256 === historicalManifestSha256, "historical V2 manifest digest differs");
  assert(historicalAudit.status === "RETAINED_HISTORICAL_EVIDENCE", "historical V2 evidence status drifted");

  const historicalBinding = historicalManifest?.sourceBinding;
  assertExactKeys(historicalBinding, ["repository", "branch", "commit", "gitTree"], "historical manifest source binding");
  assert(
    JSON.stringify(historicalBinding) === JSON.stringify(historicalLedger?.sourceBinding && {
      repository: historicalLedger.sourceBinding.repository,
      branch: historicalLedger.sourceBinding.branch,
      commit: historicalLedger.sourceBinding.commit,
      gitTree: historicalLedger.sourceBinding.gitTree,
    }),
    "historical manifest and ledger source bindings differ",
  );
  assert(
    JSON.stringify(historicalAudit.sourceBinding) === JSON.stringify(historicalBinding),
    "successor does not retain the exact historical V2 source binding",
  );
  assert(historicalBinding.repository === EXPECTED_REPOSITORY, "historical repository binding drifted");
  assertCommit(historicalBinding.commit, "historical V2 source commit");
  assertTree(historicalBinding.gitTree, "historical V2 source tree");
  assert(commitExists(historicalBinding.commit), "historical V2 source commit is absent");
  assert(treeForCommit(historicalBinding.commit) === historicalBinding.gitTree, "historical V2 source tree differs");

  const successorBinding = successorManifest.b3SuccessorBinding;
  assertExactKeys(
    successorBinding,
    ["repository", "branch", "commit", "gitTree", "status"],
    "B3 successor source binding",
  );
  assert(successorBinding.repository === EXPECTED_REPOSITORY, "B3 successor repository binding drifted");
  assert(successorBinding.branch === "agent/iat-b3-architecture", "B3 successor branch binding drifted");
  assert(successorBinding.status === "PRIMARY_FORWARD_SOURCE", "B3 successor source status drifted");
  assertCommit(successorBinding.commit, "B3 successor source commit");
  assertTree(successorBinding.gitTree, "B3 successor source tree");
  assert(successorBinding.commit !== historicalBinding.commit, "B3 successor cannot reuse the historical V2 source commit");
  assert(commitExists(successorBinding.commit), "B3 successor source commit is absent");
  assert(treeForCommit(successorBinding.commit) === successorBinding.gitTree, "B3 successor source tree differs");
  assert(isAncestor(successorBinding.commit, currentHead), "B3 successor source commit is not an ancestor of HEAD");

  const releaseBoundary = successorManifest.releaseBoundary;
  assertExactKeys(
    releaseBoundary,
    ["deploymentApproved", "fundingApproved", "signingApproved", "broadcastApproved", "mainnetApproved"],
    "successor release boundary",
  );
  assert(Object.values(releaseBoundary).every((value) => value === false), "successor lineage improperly grants release authority");

  return {
    historicalSourceCommit: historicalBinding.commit,
    b3SourceCommit: successorBinding.commit,
  };
}
