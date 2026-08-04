#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workflowPath = resolve(
  process.cwd(),
  "../../..",
  ".github/workflows/iat-v2-proof.yml",
);
const workflow = readFileSync(workflowPath, "utf8").replaceAll("\r\n", "\n");
const sbfProofScriptPath = resolve(process.cwd(), "scripts/verify-iat-v2-sbf.sh");
const sbfProofScript = readFileSync(sbfProofScriptPath, "utf8").replaceAll("\r\n", "\n");
const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));

const requiredOrderedCommands = [
  "npm run check:iat-v2-proof-workflow",
  "npm run check:ui-regression",
  "npm run check:iat-v2",
  "npm run check:launch-gates",
  "npm run check:iat-v2-signoff",
  "npm test",
  "npm run lint",
];
const requiredLaunchGateScripts = [
  "check:tokenomics",
  "check:iat-v2-mainnet-readiness",
  "check:iat-v2-ceremony-review",
  "check:iat-v2-ceremony-entry",
  "check:iat-v2-canonical-json",
  "check:iat-v2-stage-journal",
  "check:label-normalization",
  "check:canonical-digest",
  "check:manifest-gate",
  "check:publication-payload",
  "check:release-evidence-chain",
  "check:token-metadata",
  "check:allocation-lock-plan",
  "check:devnet-rehearsal",
  "check:signer-checklist",
  "check:mainnet-handoff",
  "check:release-packet",
  "check:pre-publication-packet",
  "check:release-snapshot",
  "check:post-genesis-reconciliation",
  "check:incoming-artwork",
  "check:operator-cards",
  "check:launch-clock",
  "check:mint-config",
  "check:mint-ceremony",
];
const exactSignoffCommand =
  "node scripts/validate-iat-v2-independent-signoff.mjs && node scripts/validate-iat-v2-feature-signoff.mjs";
const requiredActionPins = new Map([
  ["actions/checkout@11d5960a326750d5838078e36cf38b85af677262", 3],
  ["actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020", 2],
  ["actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02", 1],
]);
const agaveInstallerUrl =
  "https://release.anza.xyz/v3.1.10/agave-install-init-x86_64-unknown-linux-gnu";
const agaveInstallerSha256 = "ffb25b5f2c9649a13b566b26e48d441a1eaf6d3c50d2198a70e19a5e1dfae96b";
const anchorSourceRevision = "1314a6b83b16e6a31947b372d57988fd0e81559c";
const expectedProgramId = "62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj";
const requiredSbfArtifactPaths = [
  "projects/star-ascent/site/target/verifiable/iat_v2.so",
  "projects/star-ascent/site/target/verifiable/iat-v2-build-evidence.json",
  "projects/star-ascent/site/target/idl/iat_v2.json",
  "projects/star-ascent/site/target/iat-v2-sbf-build.log",
];

function validateConfiguration(workflowText, scripts) {
  const failures = [];
  const fail = (message) => failures.push(message);
  const commandLines = workflowText
    .split("\n")
    .map((line) => line.match(/^\s*- run:\s+(.+?)\s*$/)?.[1] ?? null)
    .filter(Boolean);
  const actionUses = workflowText
    .split("\n")
    .map((line) => line.match(/^\s*- uses:\s+([^\s#]+)(?:\s+#.*)?$/)?.[1] ?? null)
    .filter(Boolean);
  const orderedPositions = requiredOrderedCommands.map((command) => commandLines.indexOf(command));

  if (orderedPositions.some((position) => position === -1)) {
    const missing = requiredOrderedCommands.filter((_, index) => orderedPositions[index] === -1);
    fail(`release-proof workflow is missing required commands: ${missing.join(", ")}`);
  }
  if (orderedPositions.some((position, index) => index > 0 && position <= orderedPositions[index - 1])) {
    fail("release-proof workflow gates are not in the required fail-closed order");
  }
  if (commandLines.filter((command) => command === "npm run check:iat-v2-signoff").length !== 1) {
    fail("independent-signoff validation must occur exactly once in the web-and-policy job");
  }
  if (!/^permissions:\n\s+contents:\s+read\s*$/m.test(workflowText)) {
    fail("release-proof workflow must retain read-only repository permissions");
  }
  if (!/concurrency:\n(?:\s+#.*\n)*\s+group:\s+iat-v2-proof-\$\{\{ github\.event\.pull_request\.head\.ref \|\| github\.ref_name \}\}\n\s+cancel-in-progress:\s+true/m.test(workflowText)) {
    fail("release-proof workflow must deduplicate push and pull-request runs for one source branch");
  }
  if (/continue-on-error:\s+true/.test(workflowText)) {
    fail("release-proof workflow must not weaken a gate with continue-on-error");
  }
  if (!/node-version:\s+24(?:\.x)?\s*$/m.test(workflowText)) {
    fail("release-proof workflow must retain the reviewed Node 24 runtime");
  }
  if ((workflowText.match(/fetch-depth:\s+0\s*$/gm) ?? []).length !== 2) {
    fail("web audit and verifiable SBF jobs must both retain full source history");
  }
  if (
    !workflowText.includes("IAT_V2_SOURCE_HEAD_SHA: ${{ github.event.pull_request.head.sha || github.sha }}")
    || !workflowText.includes("IAT_V2_WORKFLOW_EVENT: ${{ github.event_name }}")
  ) {
    fail("verifiable SBF job must receive the exact source-head SHA and workflow event");
  }
  if (actionUses.some((action) => !/^[a-z0-9_.-]+\/[a-z0-9_.-]+@[0-9a-f]{40}$/.test(action))) {
    fail("every third-party action must be pinned to an immutable 40-character commit SHA");
  }
  for (const [action, expectedCount] of requiredActionPins) {
    const actualCount = actionUses.filter((candidate) => candidate === action).length;
    if (actualCount !== expectedCount) {
      fail(`required action pin ${action} appears ${actualCount} times; expected ${expectedCount}`);
    }
  }
  if (actionUses.length !== [...requiredActionPins.values()].reduce((sum, count) => sum + count, 0)) {
    fail("release-proof workflow contains an unreviewed third-party action");
  }
  if (
    !workflowText.includes(agaveInstallerUrl)
    || !workflowText.includes(`${agaveInstallerSha256}  $agave_install_init`)
    || !workflowText.includes("sha256sum --check --strict -")
    || !workflowText.includes('"$agave_install_init" v3.1.10')
  ) {
    fail("Agave installer must remain URL-, version-, and SHA-256-bound before execution");
  }
  if (
    !workflowText.includes(`--rev ${anchorSourceRevision}`)
    || !workflowText.includes("            anchor-cli")
  ) {
    fail("Anchor CLI must remain bound to the reviewed source revision");
  }
  if (/sh -c "\$\(curl|--tag\s+v1\.0\.2|\bavm\s+(?:install|use)\b/.test(workflowText)) {
    fail("release-proof workflow reintroduced a mutable toolchain bootstrap path");
  }
  for (const artifactPath of requiredSbfArtifactPaths) {
    if (!workflowText.includes(artifactPath)) {
      fail(`release-proof workflow does not publish required SBF evidence artifact ${artifactPath}`);
    }
  }

  for (const command of commandLines) {
    const scriptName = command.match(/^npm run ([^\s]+)$/)?.[1];
    if (scriptName && !Object.hasOwn(scripts, scriptName)) {
      fail(`workflow references undefined package script ${scriptName}`);
    }
  }
  if (!Object.hasOwn(scripts, "test") || !Object.hasOwn(scripts, "lint")) {
    fail("workflow test and lint commands must resolve to package scripts");
  }
  if (scripts["check:iat-v2-proof-workflow"] !== "node scripts/test-iat-v2-proof-workflow-regression.mjs") {
    fail("workflow regression package script must remain bound to the canonical validator");
  }
  if (scripts["check:iat-v2-ci-sbf-evidence"] !== "node scripts/test-iat-v2-ci-sbf-evidence-regression.mjs") {
    fail("SBF evidence regression package script must remain bound to the canonical validator");
  }
  if (!scripts["check:iat-v2"]?.includes("npm run check:iat-v2-ci-sbf-evidence")) {
    fail("main IAT V2 validation must retain the SBF evidence regression suite");
  }
  if (scripts["check:iat-v2-signoff"] !== exactSignoffCommand) {
    fail("signoff package script must retain both canonical validators in order");
  }

  const actualLaunchGateScripts = typeof scripts["check:launch-gates"] === "string"
    ? scripts["check:launch-gates"]
      .split(/\s*&&\s*/)
      .map((command) => command.match(/^npm run ([^\s]+)$/)?.[1] ?? null)
    : [];
  if (
    actualLaunchGateScripts.length !== requiredLaunchGateScripts.length
    || requiredLaunchGateScripts.some((scriptName, index) => actualLaunchGateScripts[index] !== scriptName)
  ) {
    fail("launch-gates package script does not retain the exact reviewed command sequence");
  }

  for (const scriptName of [
    "check:iat-v2-proof-workflow",
    "check:iat-v2",
    "check:launch-gates",
    "check:iat-v2-signoff",
    "test",
    "lint",
  ]) {
    const command = scripts[scriptName];
    if (typeof command !== "string" || /(?:\|\|\s*true|--if-present|continue-on-error|;\s*exit\s+0)/.test(command)) {
      fail(`${scriptName} is missing or contains a fail-open command fragment`);
    }
  }

  return failures;
}

function validateSbfProofScript(scriptText) {
  const failures = [];
  const fail = (message) => failures.push(message);

  if (!scriptText.includes('idl="target/idl/iat_v2.json"') || !scriptText.includes('[[ ! -s "$idl" ]]')) {
    fail("SBF proof must reject a missing or empty generated IDL");
  }
  if (!scriptText.includes(`expected_program_id="${expectedProgramId}"`)) {
    fail("SBF proof must remain bound to the reviewed IAT V2 program ID");
  }
  if (!scriptText.includes("json.loads") || !scriptText.includes('document.get("address") != expected_program_id')) {
    fail("SBF proof must parse the IDL and reject a mismatched program address");
  }
  if (!scriptText.includes('sha256sum "$binary" "$idl"')) {
    fail("SBF proof must publish both binary and IDL SHA-256 digests");
  }
  if (!scriptText.includes('expected_rustc_prefix="rustc 1.97.1 "') || !scriptText.includes('actual_rustc="$(rustc --version)"')) {
    fail("SBF proof must verify the actual pinned Rust compiler version");
  }
  if (
    !scriptText.includes('git status --porcelain=v1 --untracked-files=no')
    || !scriptText.includes('git rev-parse "${source_head_commit}^{tree}"')
    || !scriptText.includes("git rev-parse 'HEAD^{tree}'")
  ) {
    fail("SBF proof must bind a clean tracked worktree to both source-head and checkout trees");
  }
  if (!scriptText.includes('"schema": "iat-v2-ci-verifiable-sbf-evidence/v4"') || !scriptText.includes('"status": "BUILD_ONLY_HOLD"')) {
    fail("SBF proof must emit the reviewed machine-readable HOLD evidence schema");
  }
  if (
    !scriptText.includes('ci_repository="${GITHUB_REPOSITORY:-}"')
    || !scriptText.includes('ci_repository_id="${GITHUB_REPOSITORY_ID:-}"')
    || !scriptText.includes('ci_workflow_ref="${GITHUB_WORKFLOW_REF:-}"')
    || !scriptText.includes('ci_run_id="${GITHUB_RUN_ID:-}"')
    || !scriptText.includes('ci_run_attempt="${GITHUB_RUN_ATTEMPT:-}"')
    || !scriptText.includes('"ciProvenance": {')
  ) {
    fail("SBF proof must bind the public repository, workflow, run, and attempt provenance");
  }
  if (
    !scriptText.includes('git rev-parse \'HEAD^2\'')
    || !scriptText.includes('checkout_relation="PR_MERGE_SECOND_PARENT"')
    || !scriptText.includes('checkout_relation="IDENTICAL"')
  ) {
    fail("SBF proof must distinguish an exact PR merge checkout from an identical branch head");
  }
  if (!scriptText.includes('"programId": program_id') || !scriptText.includes('"buildLog": {')) {
    fail("SBF evidence manifest must bind the reviewed program ID and complete build log");
  }
  if (!scriptText.includes('sha256sum "$binary" "$idl" "$evidence" "$sbf_log"')) {
    fail("SBF proof must digest the binary, IDL, manifest, and complete build log");
  }
  if (!scriptText.includes('node scripts/validate-iat-v2-ci-sbf-evidence.mjs "$evidence"')) {
    fail("SBF proof must run the canonical independent manifest validator before upload");
  }
  if (
    !scriptText.includes('build_container_index_digest="sha256:05a13b9f0a6d7dd5dc86955dd0e14a098110f12d2862ac5e0cf588049a48841b"')
    || !scriptText.includes('build_container_platform_digest="sha256:28fde4e63a063727c9520a925de4e9a3be29fcc717b5d759363c23ddea28f59d"')
    || !scriptText.includes('--docker-image "$build_container_reference"')
    || !scriptText.includes('Using image \\"$build_container_reference\\"')
  ) {
    fail("SBF proof must run Anchor with the reviewed immutable container index and platform digests");
  }

  return failures;
}

const failures = [
  ...validateConfiguration(workflow, packageJson.scripts ?? {}),
  ...validateSbfProofScript(sbfProofScript),
];
const mutationProbes = [
  {
    name: "missing workflow signoff step",
    workflow: workflow.replace("      - run: npm run check:iat-v2-signoff\n", ""),
    scripts: packageJson.scripts,
  },
  {
    name: "diluted signoff package script",
    workflow,
    scripts: { ...packageJson.scripts, "check:iat-v2-signoff": "node -e \"process.exit(0)\"" },
  },
  {
    name: "missing stage-journal launch gate",
    workflow,
    scripts: {
      ...packageJson.scripts,
      "check:launch-gates": packageJson.scripts["check:launch-gates"]
        .replace(" && npm run check:iat-v2-stage-journal", ""),
    },
  },
  {
    name: "continue-on-error workflow bypass",
    workflow: workflow.replace("      - run: npm run check:iat-v2-signoff\n", "      - run: npm run check:iat-v2-signoff\n        continue-on-error: true\n"),
    scripts: packageJson.scripts,
  },
  {
    name: "floating checkout tag",
    workflow: workflow.replace(
      "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
      "actions/checkout@v4",
    ),
    scripts: packageJson.scripts,
  },
  {
    name: "drifted Agave installer checksum",
    workflow: workflow.replace(agaveInstallerSha256, `${agaveInstallerSha256.slice(0, -1)}0`),
    scripts: packageJson.scripts,
  },
  {
    name: "floating Anchor source tag",
    workflow: workflow.replace(`--rev ${anchorSourceRevision}`, "--tag v1.0.2"),
    scripts: packageJson.scripts,
  },
  {
    name: "duplicate push and pull-request concurrency groups",
    workflow: workflow.replace(
      "github.event.pull_request.head.ref || github.ref_name",
      "github.ref",
    ),
    scripts: packageJson.scripts,
  },
  {
    name: "missing published SBF build log",
    workflow: workflow.replace(
      "            projects/star-ascent/site/target/iat-v2-sbf-build.log\n",
      "",
    ),
    scripts: packageJson.scripts,
  },
  {
    name: "missing exact SBF source-head environment",
    workflow: workflow.replace(
      "      IAT_V2_SOURCE_HEAD_SHA: ${{ github.event.pull_request.head.sha || github.sha }}\n",
      "",
    ),
    scripts: packageJson.scripts,
  },
  {
    name: "shallow SBF checkout cannot verify PR head parent",
    workflow: workflow.replace(
      "          # Pull-request builds test GitHub's synthetic merge commit. Full\n          # history is required to bind that checkout to its exact head parent.\n          fetch-depth: 0",
      "          fetch-depth: 1",
    ),
    scripts: packageJson.scripts,
  },
  {
    name: "main validation omits SBF evidence regression",
    workflow,
    scripts: {
      ...packageJson.scripts,
      "check:iat-v2": packageJson.scripts["check:iat-v2"]
        .replace(" && npm run check:iat-v2-ci-sbf-evidence", ""),
    },
  },
];

for (const probe of mutationProbes) {
  if (validateConfiguration(probe.workflow, probe.scripts).length === 0) {
    failures.push(`mutation probe did not fail closed: ${probe.name}`);
  }
}

const sbfProofMutationProbes = [
  {
    name: "missing generated IDL size gate",
    script: sbfProofScript.replace('if [[ ! -s "$idl" ]]; then', 'if [[ -s "$idl" ]]; then'),
  },
  {
    name: "drifted generated IDL program ID",
    script: sbfProofScript.replace(expectedProgramId, "Vote111111111111111111111111111111111111111"),
  },
  {
    name: "missing generated IDL digest",
    script: sbfProofScript.replace('sha256sum "$binary" "$idl"', 'sha256sum "$binary"'),
  },
  {
    name: "missing actual Rust compiler gate",
    script: sbfProofScript.replace('actual_rustc="$(rustc --version)"', 'actual_rustc="$expected_rustc_prefix"'),
  },
  {
    name: "missing source-tree binding",
    script: sbfProofScript.replace('git rev-parse "${source_head_commit}^{tree}"', "printf '%040d' 0"),
  },
  {
    name: "launch-authorizing build status",
    script: sbfProofScript.replace('"status": "BUILD_ONLY_HOLD"', '"status": "READY"'),
  },
  {
    name: "missing machine-readable evidence digest",
    script: sbfProofScript.replace(
      'sha256sum "$binary" "$idl" "$evidence" "$sbf_log"',
      'sha256sum "$binary" "$idl" "$sbf_log"',
    ),
  },
  {
    name: "PR merge accepted without exact head parent",
    script: sbfProofScript.replace("git rev-parse 'HEAD^2'", "printf '%s' \"$source_head_commit\""),
  },
  {
    name: "canonical manifest validator bypassed",
    script: sbfProofScript.replace('node scripts/validate-iat-v2-ci-sbf-evidence.mjs "$evidence"', "true"),
  },
  {
    name: "public Actions run provenance omitted",
    script: sbfProofScript.replace('ci_run_id="${GITHUB_RUN_ID:-}"', 'ci_run_id="1"'),
  },
  {
    name: "floating Anchor build-container tag",
    script: sbfProofScript.replace('--docker-image "$build_container_reference"', '--docker-image "$build_container_image:$build_container_tag"'),
  },
];

for (const probe of sbfProofMutationProbes) {
  if (validateSbfProofScript(probe.script).length === 0) {
    failures.push(`mutation probe did not fail closed: ${probe.name}`);
  }
}

if (failures.length) {
  failures.forEach((message) => console.error(`FAIL: ${message}`));
  process.exit(1);
}

console.log(
  `IAT V2 public release-proof workflow regression passed: ${requiredLaunchGateScripts.length} ordered launch gates, both signoff validators, 6 immutable action uses, checksum-pinned Agave, revision-pinned Anchor, exact head/checkout/public-run/container-bound binary/IDL evidence, canonical manifest validation, deduplicated branch concurrency, read-only permissions, and 23 fail-closed mutation probes remain bound.`,
);
