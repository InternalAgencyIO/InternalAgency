import { spawnSync } from "node:child_process";

const EXPECTED_REPOSITORY = "InternalAgencyIO/InternalAgency";
const EXPECTED_HISTORICAL_AUDIT_PATH = "public/audits/iat-v2-architecture-work-20260805/manifest.json";
const LOCAL_GIT_ENVIRONMENT = new Set([
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_COMMON_DIR",
  "GIT_CONFIG",
  "GIT_CONFIG_COUNT",
  "GIT_CONFIG_PARAMETERS",
  "GIT_DIR",
  "GIT_GRAFT_FILE",
  "GIT_IMPLICIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_NO_REPLACE_OBJECTS",
  "GIT_OBJECT_DIRECTORY",
  "GIT_PREFIX",
  "GIT_REPLACE_REF_BASE",
  "GIT_SHALLOW_FILE",
  "GIT_WORK_TREE",
]);

export function createArchitectureGitEnvironment(environment = process.env) {
  return Object.fromEntries([
    ...Object.entries(environment)
      .filter(([name]) => !LOCAL_GIT_ENVIRONMENT.has(name.toUpperCase())),
    ["GIT_NO_REPLACE_OBJECTS", "1"],
  ]);
}

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

function runGit(repositoryRoot, args) {
  return spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
    env: createArchitectureGitEnvironment(),
  });
}

function observation(result) {
  return {
    status: Number.isInteger(result?.status) ? result.status : null,
    signal: typeof result?.signal === "string" ? result.signal : null,
    stdout: typeof result?.stdout === "string" ? result.stdout.trim() : "",
    stderr: typeof result?.stderr === "string" ? result.stderr.trim() : "",
    error: result?.error instanceof Error ? result.error.message : null,
  };
}

export function inspectArchitectureSourceAncestry({
  repositoryRoot,
  ancestor,
  descendant = "HEAD",
  executeGit = (args) => runGit(repositoryRoot, args),
}) {
  const head = observation(executeGit(["rev-parse", "--verify", "HEAD^{commit}"]));
  const shallow = observation(executeGit(["rev-parse", "--is-shallow-repository"]));
  const mergeBase = observation(executeGit(["merge-base", "--is-ancestor", ancestor, descendant]));
  return {
    observedHead: head.status === 0 && /^[0-9a-f]{40}$/u.test(head.stdout) ? head.stdout : null,
    headStatus: head.status,
    headSignal: head.signal,
    headStderr: head.stderr,
    headError: head.error,
    shallowRepository: shallow.status === 0 && /^(?:true|false)$/u.test(shallow.stdout)
      ? shallow.stdout === "true"
      : null,
    shallowStatus: shallow.status,
    shallowSignal: shallow.signal,
    shallowStderr: shallow.stderr,
    shallowError: shallow.error,
    status: mergeBase.status,
    signal: mergeBase.signal,
    stderr: mergeBase.stderr,
    error: mergeBase.error,
  };
}

function diagnosticValue(value) {
  if (value === null || value === "") return "<none>";
  return JSON.stringify(value);
}

function ancestryDiagnostic(inspection) {
  const shallowState = inspection.shallowRepository === true
    ? "shallow"
    : inspection.shallowRepository === false
      ? "full"
      : "unknown";
  return [
    `observedHead=${diagnosticValue(inspection.observedHead)}`,
    `headStatus=${diagnosticValue(inspection.headStatus)}`,
    `headSignal=${diagnosticValue(inspection.headSignal)}`,
    `headStderr=${diagnosticValue(inspection.headStderr)}`,
    `headError=${diagnosticValue(inspection.headError)}`,
    `shallowState=${shallowState}`,
    `shallowStatus=${diagnosticValue(inspection.shallowStatus)}`,
    `shallowSignal=${diagnosticValue(inspection.shallowSignal)}`,
    `shallowStderr=${diagnosticValue(inspection.shallowStderr)}`,
    `shallowError=${diagnosticValue(inspection.shallowError)}`,
    `mergeBaseStatus=${diagnosticValue(inspection.status)}`,
    `mergeBaseSignal=${diagnosticValue(inspection.signal)}`,
    `mergeBaseStderr=${diagnosticValue(inspection.stderr)}`,
    `mergeBaseError=${diagnosticValue(inspection.error)}`,
  ].join(", ");
}

function assertFullHistoryAncestry(inspection, expectedHead) {
  assert(inspection && typeof inspection === "object" && !Array.isArray(inspection), "B3 successor ancestry inspection is absent");
  const diagnostic = ancestryDiagnostic(inspection);
  if (
    inspection.observedHead === null
    || inspection.headStatus !== 0
    || inspection.headSignal !== null
    || inspection.headError !== null
  ) {
    fail(`B3 successor HEAD observation failed (${diagnostic})`);
  }
  if (/^[0-9a-f]{40}$/u.test(expectedHead) && inspection.observedHead !== expectedHead) {
    fail(`B3 successor checkout HEAD does not match the declared source head ${expectedHead} (${diagnostic})`);
  }
  if (
    inspection.shallowRepository !== false
    || inspection.shallowStatus !== 0
    || inspection.shallowSignal !== null
    || inspection.shallowError !== null
  ) {
    fail(`B3 successor ancestry requires a complete Git history (${diagnostic})`);
  }
  if (inspection.status === 0 && inspection.error === null && inspection.signal === null) return;
  if (inspection.status === 1 && inspection.error === null && inspection.signal === null) {
    fail(`B3 successor source commit is not an ancestor of HEAD (${diagnostic})`);
  }
  fail(`B3 successor ancestry command failed (${diagnostic})`);
}

export function validateArchitectureSourceLineage({
  historicalManifest,
  historicalLedger,
  historicalManifestSha256,
  successorManifest,
  commitExists,
  treeForCommit,
  inspectAncestry,
  currentHead = "HEAD",
}) {
  assert(currentHead === "HEAD" || /^[0-9a-f]{40}$/u.test(currentHead), "current source head is not HEAD or a lowercase 40-character commit");
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
  assertFullHistoryAncestry(inspectAncestry(successorBinding.commit, currentHead), currentHead);

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
