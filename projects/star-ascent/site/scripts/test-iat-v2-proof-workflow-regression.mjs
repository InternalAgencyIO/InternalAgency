#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TextDecoder } from "node:util";

const workflowPath = resolve(
  process.cwd(),
  "../../..",
  ".github/workflows/iat-v2-proof.yml",
);
const workflowBytes = readFileSync(workflowPath);
const workflow = decodeExactWorkflowBytes(workflowBytes);
if (workflow === null) throw new Error("WORKFLOW_RAW_BYTES_INVALID");
const sbfProofScriptPath = resolve(process.cwd(), "scripts/verify-iat-v2-sbf.sh");
const sbfProofScript = readFileSync(sbfProofScriptPath, "utf8").replaceAll("\r\n", "\n");
const currentB3LawEvidence = JSON.parse(readFileSync(
  resolve(
    process.cwd(),
    "docs/b3/evidence/local-validator-atomic-sealing-rehearsal-20260808.json",
  ),
  "utf8",
));
const b3DevnetWrapper = readFileSync(
  resolve(process.cwd(), "scripts/run-iat-b3-devnet-rehearsal.sh"),
  "utf8",
).replaceAll("\r\n", "\n");
const b3DevnetDriver = readFileSync(
  resolve(process.cwd(), "scripts/iat-b3-devnet-rehearsal-driver.mjs"),
  "utf8",
).replaceAll("\r\n", "\n");
const combinedLawStakeRunner = readFileSync(
  resolve(process.cwd(), "scripts/run-iat-b3-combined-law-stake-local-rehearsal.sh"),
  "utf8",
).replaceAll("\r\n", "\n");
const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));

const requiredOrderedCommands = [
  "npm run check:iat-v2-proof-workflow",
  "npm run check:iat-b3-spec",
  "node --test tests/iat-b3-combined-law-reproducible-build.test.mjs",
  "npm run check:release-surface",
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
  "node scripts/validate-iat-v2-independent-signoff.mjs && node scripts/validate-iat-v2-feature-signoff.mjs && node scripts/test-iat-v2-signoff-regression.mjs";
const exactArchitectureWorkCommand =
  "node scripts/test-iat-architecture-source-lineage-regression.mjs && node scripts/validate-iat-v2-architecture-work.mjs";
const requiredActionPins = new Map([
  ["actions/checkout@11d5960a326750d5838078e36cf38b85af677262", 5],
  ["actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020", 4],
  ["actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02", 1],
]);
const EXACT_TOP_LEVEL_WORKFLOW_LINES = Object.freeze([
  "name: IAT V2 release proof",
  "on:",
  "permissions:",
  "concurrency:",
  "jobs:",
]);
const exactSiteWorkingDirectory = "projects/star-ascent/site";
const nativePreflightCommand = "node scripts/build-iat-b3-mandatory-ci-containment.mjs";
const exactLinuxPreflightStep = [
  "      - name: Confirm the offline native containment preflight remains exact HOLD",
  "        shell: bash",
  "        run: |",
  "          set +e",
  `          output="$(node scripts/build-iat-b3-mandatory-ci-containment.mjs)"`,
  "          status=$?",
  "          set -e",
  "          printf '%s\\n' \"$output\"",
  "          if [[ \"$status\" -ne 2 ]]; then",
  "            echo \"Expected containment preflight exit 2/HOLD, got $status\" >&2",
  "            exit 1",
  "          fi",
  "          node -e '",
  "            const value = JSON.parse(process.argv[1]);",
  "            if (value.status !== \"HOLD\" || value.ready !== false || value.complete !== false ||",
  "                value.buildAuthorized !== false || value.buildExecuted !== false ||",
  "                value.outputRootTouched !== false || !Array.isArray(value.blockers) ||",
  "                !value.blockers.includes(\"PHASE_B_NATIVE_BUILD_HARD_DISABLED\")) {",
  "              throw new Error(\"containment preflight did not return the exact fail-closed HOLD projection\");",
  "            }",
  "          ' \"$output\"",
].join("\n");
const exactWindowsLongPathsStep = [
  "      - name: Enable repository long paths before checkout",
  "        shell: pwsh",
  "        run: git config --global core.longpaths true",
].join("\n");
const exactWindowsStructuralStep = [
  "      - name: Validate native containment structure (hosted smoke only; non-evidence)",
  "        run: node --test tests/iat-b3-mandatory-ci-containment.test.mjs",
  `        working-directory: ${exactSiteWorkingDirectory}`,
].join("\n");
const exactWindowsPreflightStep = [
  "      - name: Confirm native containment preflight HOLD (hosted smoke only; non-evidence)",
  "        shell: pwsh",
  "        run: |",
  "          $output = (& node scripts/build-iat-b3-mandatory-ci-containment.mjs 2>&1 | Out-String).Trim()",
  "          $status = $LASTEXITCODE",
  "          Write-Host $output",
  "          if ($status -ne 2) {",
  "            throw \"Expected containment preflight exit 2/HOLD, got $status\"",
  "          }",
  "          $value = $output | ConvertFrom-Json",
  "          if ($value.status -ne 'HOLD' -or $value.ready -ne $false -or",
  "              $value.complete -ne $false -or $value.buildAuthorized -ne $false -or",
  "              $value.buildExecuted -ne $false -or $value.outputRootTouched -ne $false -or",
  "              $value.blockers -notcontains 'PHASE_B_NATIVE_BUILD_HARD_DISABLED') {",
  "            throw 'containment preflight did not return the exact fail-closed HOLD projection'",
  "          }",
  `        working-directory: ${exactSiteWorkingDirectory}`,
].join("\n");
const exactSiteJobRunDefaults = [
  "    defaults:",
  "      run:",
  `        working-directory: ${exactSiteWorkingDirectory}`,
].join("\n");
const exactNonWindowsJobDefaultAnchors = [
  [
    "  web-and-policy:",
    "    name: Web, policy, and launch gates",
    "    runs-on: ubuntu-latest",
    "    timeout-minutes: 45",
    exactSiteJobRunDefaults,
    "    steps:",
  ].join("\n"),
  [
    "  rust-host:",
    "    name: Rust host tests",
    "    runs-on: ubuntu-latest",
    "    timeout-minutes: 30",
    exactSiteJobRunDefaults,
    "    steps:",
  ].join("\n"),
  [
    "  verifiable-sbf:",
    "    name: Verifiable Solana SBF build",
    "    runs-on: ubuntu-latest",
    "    timeout-minutes: 90",
    exactSiteJobRunDefaults,
    "    env:",
  ].join("\n"),
];
const exactNativeWindowsJob = [
  "  native-containment-windows:",
  "    name: HOSTED_CROSS_PLATFORM_SMOKE_ONLY (non-evidence)",
  "    runs-on: windows-2025",
  "    timeout-minutes: 15",
  "    steps:",
  exactWindowsLongPathsStep,
  "      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0",
  "        with:",
  "          fetch-depth: 0",
  "      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0",
  "        with:",
  "          node-version: 24",
  exactWindowsStructuralStep,
  exactWindowsPreflightStep,
  "",
].join("\n");
const exactPhaseBStructurePackageCommand =
  "node --test tests/iat-b3-mandatory-ci-phase-b-authority-state.test.mjs tests/iat-b3-mandatory-ci-phase-b-prerequisite.test.mjs";
const exactPhaseBHostedSmokePackageCommand =
  "node --test tests/iat-b3-mandatory-ci-gates.test.mjs";
const exactPhaseBStructureWorkflowCommand =
  "npm --prefix projects/star-ascent/site run check:iat-b3-mandatory-ci-phase-b-structure";
const exactPhaseBHostedSmokeWorkflowCommand =
  "npm --prefix projects/star-ascent/site run check:iat-b3-mandatory-ci-phase-b-hosted-smoke";
const exactPhaseBHostedSmokeJob = [
  "  phase-b-hosted-smoke:",
  "    name: PHASE_B_HOSTED_SMOKE_ONLY_ALL_FALSE_HOLD (non-evidence)",
  "    # Ordering only: no output or receipt from hosted Phase-A is consumed.",
  "    needs: native-containment-windows",
  "    runs-on: ubuntu-latest",
  "    timeout-minutes: 15",
  "    steps:",
  "      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0",
  "        with:",
  "          fetch-depth: 1",
  "          persist-credentials: false",
  "      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0",
  "        with:",
  "          node-version: 24",
  "      # Source-only Phase-B smoke: no cache/artifact download, helper/runtime",
  "      # execution, hosted-to-local provenance promotion, or release claim is admitted.",
  "      - name: Validate Phase-B source contracts (hosted smoke only; all-false HOLD; non-evidence)",
  `        run: ${exactPhaseBStructureWorkflowCommand}`,
  "        shell: bash",
  "        timeout-minutes: 5",
  "      - name: Confirm Phase-B canonical all-false HOLD (hosted smoke only; non-evidence)",
  `        run: ${exactPhaseBHostedSmokeWorkflowCommand}`,
  "        shell: bash",
  "        timeout-minutes: 5",
  "",
].join("\n");
const agaveInstallerUrl =
  "https://release.anza.xyz/v3.1.10/agave-install-init-x86_64-unknown-linux-gnu";
const agaveInstallerSha256 = "ffb25b5f2c9649a13b566b26e48d441a1eaf6d3c50d2198a70e19a5e1dfae96b";
const anchorSourceRevision = "1314a6b83b16e6a31947b372d57988fd0e81559c";
const expectedProgramId = "62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj";
const combinedLawFixtureBytes = 155_496;
const combinedLawFixtureSha256 =
  "39f95d13821aee92ad0bd3967ab3ab2365669deda6e0775be9dfe9f6dee84c12";
const combinedLawFixtureIdentities = Object.freeze({
  lawProgramId: "D6UucuMprPAYyCmr5UPU5h9YhRf2ZNtn23JTS32EjdjY",
  economyProgramId: "GLb6VMiKEhRRfYnD1p3a3iCAR3kgtRr8qdHxEHAzbdDU",
  canonicalMint: "3JF3sEqM796hk5WFqA6EtmEwJQ9quALszsfJyvXNQKy3",
});
const requiredSbfArtifactPaths = [
  "projects/star-ascent/site/target/verifiable/iat_v2.so",
  "projects/star-ascent/site/target/verifiable/iat-v2-build-evidence.json",
  "projects/star-ascent/site/target/verifiable/iat_b3_law.so",
  "projects/star-ascent/site/target/verifiable/iat-b3-law.sha256",
  "projects/star-ascent/site/target/verifiable/iat-b3-combined-law-stake-local-rehearsal.jsonl",
  "projects/star-ascent/site/target/idl/iat_v2.json",
  "projects/star-ascent/site/target/iat-v2-sbf-build.log",
];

function topLevelWorkflowGrammarIsExact(workflowText) {
  const observed = workflowText
    .split("\n")
    .filter((line) => line.length > 0 && line.charCodeAt(0) !== 0x20);
  return observed.length === EXACT_TOP_LEVEL_WORKFLOW_LINES.length
    && observed.every((line, index) => line === EXACT_TOP_LEVEL_WORKFLOW_LINES[index]);
}

function decodeExactWorkflowBytes(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.at(-1) !== 0x0a) return null;
  for (const byte of bytes) {
    if (byte !== 0x0a && (byte < 0x20 || byte > 0x7e)) return null;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function validateConfiguration(workflowInput, scripts) {
  const failures = [];
  const fail = (message) => failures.push(message);
  const workflowText = decodeExactWorkflowBytes(workflowInput);
  if (workflowText === null) {
    fail("workflow raw bytes must be final-LF ASCII with no control or non-ASCII bytes");
    return failures;
  }
  const commandLines = workflowText
    .split("\n")
    .map((line) => line.match(/^\s*- run:\s+(.+?)\s*$/)?.[1] ?? null)
    .filter(Boolean);
  const actionUses = workflowText
    .split("\n")
    .map((line) => line.match(/^\s*- uses:\s+([^\s#]+)(?:\s+#.*)?$/)?.[1] ?? null)
    .filter(Boolean);
  const orderedPositions = requiredOrderedCommands.map((command) => commandLines.indexOf(command));
  const nativeStructuralCommand =
    "node --test tests/iat-b3-mandatory-ci-containment.test.mjs";
  const exactRunCount = (command) => (
    workflowText.match(new RegExp(`^\\s+run: ${command.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&")}$`, "gmu"))
      ?? []
  ).length;
  if (workflowText.split(nativePreflightCommand).length - 1 !== 2
    || exactRunCount(nativeStructuralCommand) !== 2
    || !workflowText.includes(exactLinuxPreflightStep)
    || !workflowText.includes(exactWindowsPreflightStep)) {
    fail("Linux and Windows jobs must each structurally test and assert the exact Phase-A HOLD preflight");
  }
  const nativeWindowsStart = workflowText.indexOf("  native-containment-windows:\n");
  const nativeWindowsEnd = workflowText.indexOf("\n  rust-host:\n", nativeWindowsStart);
  const nativeWindowsJob = nativeWindowsStart >= 0 && nativeWindowsEnd > nativeWindowsStart
    ? workflowText.slice(nativeWindowsStart, nativeWindowsEnd)
    : "";
  const nativeWindowsJobCount = (
    workflowText.match(/^  native-containment-windows:$/gmu) ?? []
  ).length;
  const topLevelDefaultsCount = (
    workflowText.match(/^(?:defaults|["']defaults["'])\s*:/gmu) ?? []
  ).length;
  const jobDefaultsCount = (workflowText.match(/^    defaults\s*:/gmu) ?? []).length;
  const exactSiteJobDefaultsCount = workflowText.split(exactSiteJobRunDefaults).length - 1;
  const workingDirectoryLines = workflowText
    .split("\n")
    .filter((line) => /^\s+working-directory\s*:/u.test(line));
  if (!topLevelWorkflowGrammarIsExact(workflowText)
    || nativeWindowsJobCount !== 1
    || nativeWindowsJob !== exactNativeWindowsJob
    || topLevelDefaultsCount !== 0
    || jobDefaultsCount !== 3
    || exactSiteJobDefaultsCount !== 3
    || exactNonWindowsJobDefaultAnchors.some((anchor) => !workflowText.includes(anchor))
    || workingDirectoryLines.length !== 5
    || workingDirectoryLines.some(
      (line) => line !== `        working-directory: ${exactSiteWorkingDirectory}`,
    )) {
    fail("workflow cwd policy and Windows hosted smoke job must match the exact non-evidence blocks");
  }
  const nativeWebPreflight = workflowText.indexOf(exactLinuxPreflightStep);
  const nativeWebStructural = workflowText.indexOf(`        run: ${nativeStructuralCommand}\n`);
  const npmCiPosition = workflowText.indexOf("      - run: npm ci\n");
  if (!(npmCiPosition >= 0 && nativeWebStructural > npmCiPosition
    && nativeWebPreflight > nativeWebStructural)) {
    fail("Linux structural validation must precede the expected HOLD preflight");
  }
  const phaseBJobStart = workflowText.indexOf("  phase-b-hosted-smoke:\n");
  const phaseBJobEnd = workflowText.indexOf("\n  verifiable-sbf:\n", phaseBJobStart);
  const observedPhaseBJob = phaseBJobStart >= 0 && phaseBJobEnd > phaseBJobStart
    ? workflowText.slice(phaseBJobStart, phaseBJobEnd)
    : "";
  if (observedPhaseBJob !== exactPhaseBHostedSmokeJob
    || (workflowText.match(/^  phase-b-hosted-smoke:$/gmu) ?? []).length !== 1
    || exactRunCount(exactPhaseBStructureWorkflowCommand) !== 1
    || exactRunCount(exactPhaseBHostedSmokeWorkflowCommand) !== 1) {
    fail(
      "Phase-B hosted smoke must be the exact isolated source-only all-false HOLD job after K89 structural checks",
    );
  }
  if (/(?:setup-zig|ziglang|apt-get\s+install\s+zig|curl[^\n]*zig|npm\s+install[^\n]*zig)/iu.test(
    `${nativeWindowsJob}\n${workflowText.slice(npmCiPosition, nativeWebPreflight)}`,
  )) {
    fail("native containment workflow must not download or install a compiler");
  }

  const combinedBuildStart = workflowText.indexOf(
    "      - name: Build the B3 native law adapter without deploying it\n",
  );
  const combinedBuildEnd = workflowText.indexOf(
    "      - name: Rehearse B3 sealed account lifecycle on an isolated local validator\n",
    combinedBuildStart,
  );
  const combinedBuildStep = combinedBuildStart >= 0 && combinedBuildEnd > combinedBuildStart
    ? workflowText.slice(combinedBuildStart, combinedBuildEnd)
    : "";
  const requiredCombinedBuildBindings = [
    `IAT_B3_PRODUCTION_LAW_PROGRAM_ID: ${combinedLawFixtureIdentities.lawProgramId}`,
    `IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID: ${combinedLawFixtureIdentities.economyProgramId}`,
    `IAT_B3_PRODUCTION_CANONICAL_MINT: ${combinedLawFixtureIdentities.canonicalMint}`,
    "--arch v0",
    "--no-default-features",
    "--features production-combined-hook",
    "--optimize-size",
    "--offline",
    "--skip-tools-install",
    "--tools-version v1.52",
    "--locked",
  ];
  if (
    combinedBuildStep.length === 0
    || requiredCombinedBuildBindings.some((binding) => !combinedBuildStep.includes(binding))
  ) {
    fail("B3 law SBF step must build the exact pinned combined-hook fixture offline and without deployment");
  }
  const combinedPrefetchStart = workflowText.indexOf(
    "      - name: Prefetch the locked B3 combined-law and loopback-fixture crate graphs\n",
  );
  const combinedPrefetchStep = combinedPrefetchStart >= 0 && combinedBuildStart > combinedPrefetchStart
    ? workflowText.slice(combinedPrefetchStart, combinedBuildStart)
    : "";
  const requiredCombinedPrefetchBindings = [
    "run: |",
    "cargo +1.97.1 fetch",
    "--locked",
    "--manifest-path programs/iat_b3_law/Cargo.toml",
    "--manifest-path tests/fixtures/iat-b3-combined-law-stake/Cargo.toml",
  ];
  if (
    combinedPrefetchStep.length === 0
    || requiredCombinedPrefetchBindings.some((binding) => !combinedPrefetchStep.includes(binding))
    || (combinedPrefetchStep.match(/cargo \+1\.97\.1 fetch/gu) ?? []).length !== 2
    || (combinedPrefetchStep.match(/--locked/gu) ?? []).length !== 2
  ) {
    fail("B3 law and combined loopback fixture inputs must be checksum-prefetched from their exact locked manifests before offline builds");
  }
  const combinedToolsStart = workflowText.indexOf(
    "      - name: Install the pinned B3 SBF platform tools\n",
  );
  const combinedToolsStep = combinedToolsStart >= 0 && combinedPrefetchStart > combinedToolsStart
    ? workflowText.slice(combinedToolsStart, combinedPrefetchStart)
    : "";
  const requiredCombinedToolsBindings = [
    "run: >-",
    "cargo build-sbf",
    "--install-only",
    "--force-tools-install",
    "--tools-version v1.52",
  ];
  if (
    combinedToolsStep.length === 0
    || requiredCombinedToolsBindings.some((binding) => !combinedToolsStep.includes(binding))
  ) {
    fail("B3 law SBF build must force-install the exact pinned platform-tools version before offline use");
  }

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
  if (!/concurrency:\n(?:\s+#.*\n)*\s+group:\s+iat-v2-proof-\$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}\n\s+cancel-in-progress:\s+true/m.test(workflowText)) {
    fail("release-proof workflow must deduplicate events for one exact source head without cancelling another published head");
  }
  if (/continue-on-error:\s+true/.test(workflowText)) {
    fail("release-proof workflow must not weaken a gate with continue-on-error");
  }
  if (!/node-version:\s+24(?:\.x)?\s*$/m.test(workflowText)) {
    fail("release-proof workflow must retain the reviewed Node 24 runtime");
  }
  if ((workflowText.match(/fetch-depth:\s+0\s*$/gm) ?? []).length !== 3) {
    fail("web audit, native Windows, and verifiable SBF jobs must retain full source history");
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
  if (
    !workflowText.includes("Rehearse one combined B3 Law and stake-ingress artifact on isolated local validators")
    || !workflowText.includes("bash scripts/run-iat-b3-combined-law-stake-local-rehearsal.sh --require-tools \\")
    || !workflowText.includes("tee target/verifiable/iat-b3-combined-law-stake-local-rehearsal.jsonl")
  ) {
    fail("combined Law/stake local-validator evidence must run fail-closed and publish its complete JSONL transcript");
  }
  if (
    !workflowText.includes("cargo build-sbf \\")
    || !workflowText.includes("--manifest-path programs/iat_b3_law/Cargo.toml")
    || !workflowText.includes("--sbf-out-dir target/verifiable")
    || !workflowText.includes("test -s target/verifiable/iat_b3_law.so")
    || !workflowText.includes("sha256sum target/verifiable/iat_b3_law.so")
  ) {
    fail("B3 law adapter must retain its pinned build-only SBF and SHA-256 evidence step");
  }
  for (const identityFixture of [
    "IAT_B3_PRODUCTION_LAW_PROGRAM_ID: D6UucuMprPAYyCmr5UPU5h9YhRf2ZNtn23JTS32EjdjY",
    "IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID: GLb6VMiKEhRRfYnD1p3a3iCAR3kgtRr8qdHxEHAzbdDU",
    "IAT_B3_PRODUCTION_CANONICAL_MINT: 3JF3sEqM796hk5WFqA6EtmEwJQ9quALszsfJyvXNQKy3",
  ]) {
    if (!workflowText.includes(identityFixture)) {
      fail(`all-features host test is missing non-production combined-hook fixture ${identityFixture}`);
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
  if (scripts["preflight:iat-b3-mandatory-ci-containment"] !== nativePreflightCommand
    || scripts["build:iat-b3-mandatory-ci-containment"] !== `${nativePreflightCommand} --execute`
    || scripts["check:iat-b3-mandatory-ci-containment"] !==
      "node --test tests/iat-b3-mandatory-ci-containment.test.mjs") {
    fail("native containment package scripts must retain exact preflight/build/check bindings");
  }
  if (scripts["check:iat-b3-mandatory-ci-phase-b-structure"] !==
      exactPhaseBStructurePackageCommand
    || scripts["check:iat-b3-mandatory-ci-phase-b-hosted-smoke"] !==
      exactPhaseBHostedSmokePackageCommand) {
    fail(
      "Phase-B hosted smoke package scripts must remain exact source-only structural/all-false tests",
    );
  }
  if (scripts["check:iat-v2-ci-sbf-evidence"] !== "node scripts/test-iat-v2-ci-sbf-evidence-regression.mjs") {
    fail("SBF evidence regression package script must remain bound to the canonical validator");
  }
  if (!scripts["check:iat-v2"]?.includes("npm run check:iat-v2-ci-sbf-evidence")) {
    fail("main IAT V2 validation must retain the SBF evidence regression suite");
  }
  if (scripts["check:iat-v2-architecture-work"] !== exactArchitectureWorkCommand) {
    fail("architecture-work gate must run the B3 successor-lineage regression before validating retained V2 evidence");
  }
  if (!scripts["check:iat-v2"]?.includes("npm run check:iat-v2-architecture-work")) {
    fail("main IAT V2 validation must retain the V2-to-B3 source-lineage gate");
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
    "check:iat-b3-mandatory-ci-phase-b-structure",
    "check:iat-b3-mandatory-ci-phase-b-hosted-smoke",
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

  if (!scriptText.includes('anchor build --verifiable --program-name iat_v2 --ignore-keys --docker-image "$build_container_reference"')) {
    fail("Anchor verifiable build must be scoped to the Anchor-based iat_v2 program; native B3 programs use their dedicated cargo build-sbf step");
  }
  if (
    !scriptText.includes('tomllib.load(source)')
    || !scriptText.includes('document.get("workspace", {}).get("members") != ["programs/iat_v2"]')
  ) {
    fail("Anchor discovery must be fail-closed to the reviewed iat_v2 workspace before the verifiable build");
  }
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
  if (!scriptText.includes('"schema": "iat-v2-ci-verifiable-sbf-evidence/v5"') || !scriptText.includes('"status": "BUILD_ONLY_HOLD"')) {
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
    || !scriptText.includes('docker manifest inspect "$build_container_reference"')
    || !scriptText.includes('docker pull --platform "$build_container_platform" "$build_container_reference"')
    || !scriptText.includes("docker image inspect --format '{{.Os}}/{{.Architecture}}' \"$build_container_reference\"")
  ) {
    fail("SBF proof must verify and run Anchor with the reviewed immutable container index and platform digests");
  }

  return failures;
}

function validateB3LawArtifactBindings({
  workflowText,
  devnetWrapperText,
  devnetDriverText,
  evidence,
}) {
  const failures = [];
  const fail = (message) => failures.push(message);
  const artifact = evidence?.artifact;

  if (
    evidence?.schema !== "iat-b3-local-validator-rehearsal-record/v1"
    || evidence?.status !== "PASS"
    || artifact?.path !== "target/deploy/iat_b3_law.so"
  ) {
    fail("canonical B3 law candidate evidence must remain a PASS record for target/deploy/iat_b3_law.so");
  }

  const canonicalBytes = artifact?.sizeBytes;
  const canonicalSha256 = artifact?.sha256;
  if (!Number.isSafeInteger(canonicalBytes) || canonicalBytes <= 0) {
    fail("canonical B3 law candidate evidence contains an invalid artifact size");
  }
  if (!/^[0-9a-f]{64}$/u.test(canonicalSha256 ?? "")) {
    fail("canonical B3 law candidate evidence contains an invalid artifact SHA-256");
  }

  const singlePin = (text, pattern, label, normalize = (value) => value) => {
    const matches = [...text.matchAll(pattern)];
    if (matches.length !== 1) {
      fail(`${label} must appear exactly once; found ${matches.length}`);
      return null;
    }
    return normalize(matches[0][1]);
  };
  const decimal = (value) => Number(value.replaceAll("_", ""));

  const bindings = [
    {
      label: "release-proof workflow B3 law byte pin",
      actual: singlePin(
        workflowText,
        /^\s*expected_b3_law_bytes=(\d+)\s*$/gmu,
        "release-proof workflow B3 law byte pin",
        decimal,
      ),
      expected: combinedLawFixtureBytes,
    },
    {
      label: "release-proof workflow B3 law SHA-256 pin",
      actual: singlePin(
        workflowText,
        /^\s*expected_b3_law_sha256="([0-9a-f]{64})"\s*$/gmu,
        "release-proof workflow B3 law SHA-256 pin",
      ),
      expected: combinedLawFixtureSha256,
    },
    {
      label: "Devnet wrapper B3 law byte pin",
      actual: singlePin(
        devnetWrapperText,
        /^expected_artifact_size="(\d+)"\s*$/gmu,
        "Devnet wrapper B3 law byte pin",
        decimal,
      ),
      expected: canonicalBytes,
    },
    {
      label: "Devnet wrapper B3 law SHA-256 pin",
      actual: singlePin(
        devnetWrapperText,
        /^expected_artifact_sha256="([0-9a-f]{64})"\s*$/gmu,
        "Devnet wrapper B3 law SHA-256 pin",
      ),
      expected: canonicalSha256,
    },
    {
      label: "Devnet driver B3 law byte pin",
      actual: singlePin(
        devnetDriverText,
        /^export const EXPECTED_ARTIFACT_SIZE = ([\d_]+);\s*$/gmu,
        "Devnet driver B3 law byte pin",
        decimal,
      ),
      expected: canonicalBytes,
    },
    {
      label: "Devnet driver B3 law SHA-256 pin",
      actual: singlePin(
        devnetDriverText,
        /export const EXPECTED_ARTIFACT_SHA256\s*=\s*"([0-9a-f]{64})";/gu,
        "Devnet driver B3 law SHA-256 pin",
      ),
      expected: canonicalSha256,
    },
  ];

  for (const { label, actual, expected } of bindings) {
    if (actual !== null && expected !== undefined && actual !== expected) {
      fail(`${label} does not match its frozen artifact binding: expected ${expected}, got ${actual}`);
    }
  }

  return failures;
}

function validateCombinedLawStakeRunner(runnerText) {
  const failures = [];
  const fail = (message) => failures.push(message);
  for (const binding of [
    'rpc_url="http://127.0.0.1:${rpc_port}"',
    'law_id="D6UucuMprPAYyCmr5UPU5h9YhRf2ZNtn23JTS32EjdjY"',
    'economy_id="GLb6VMiKEhRRfYnD1p3a3iCAR3kgtRr8qdHxEHAzbdDU"',
    'IAT_B3_PRODUCTION_CANONICAL_MINT="$mint_pubkey"',
    "--features production-combined-hook",
    '--bpf-program "$law_id" "$law_artifact"',
    '--bpf-program "$economy_id" "$economy_artifact"',
    "for variant in missing stale open locked forged",
    'trap finish EXIT',
    'rm -rf -- "$temp_dir"',
    '"productionSourceIngressExecutorExercised":true',
    '"syntheticVariantsFinalizerProvenance":false',
    '"rawAndBalanceRollbackAsserted":true',
    '"fixtureProductionCandidate":false',
    '"finalBinary":false',
    '"mainnetExecutionAuthorized":false',
    '"statusGate":"HOLD"',
  ]) {
    if (!runnerText.includes(binding)) fail(`combined Law/stake runner lost binding: ${binding}`);
  }
  if (/api\.(?:devnet|mainnet-beta)\.solana\.com/iu.test(runnerText)) {
    fail("combined Law/stake runner must remain loopback-only");
  }
  if (runnerText.includes('IAT_B3_PRODUCTION_CANONICAL_MINT="3JF3')) {
    fail("combined Law/stake runner must compile against its disposable generated mint");
  }
  return failures;
}

const failures = [
  ...validateConfiguration(workflowBytes, packageJson.scripts ?? {}),
  ...validateSbfProofScript(sbfProofScript),
  ...validateCombinedLawStakeRunner(combinedLawStakeRunner),
  ...validateB3LawArtifactBindings({
    workflowText: workflow,
    devnetWrapperText: b3DevnetWrapper,
    devnetDriverText: b3DevnetDriver,
    evidence: currentB3LawEvidence,
  }),
];
const nativeWindowsMutationProbes = [
  ["Windows hosted job conditional", exactNativeWindowsJob.replace(
    "    runs-on: windows-2025\n",
    "    if: false\n    runs-on: windows-2025\n",
  )],
  ["Windows missing pre-checkout long-path guard", exactNativeWindowsJob.replace(
    `${exactWindowsLongPathsStep}\n`,
    "",
  )],
  ["Windows late long-path guard", exactNativeWindowsJob.replace(
    `${exactWindowsLongPathsStep}\n      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0`,
    `      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0\n${exactWindowsLongPathsStep}`,
  )],
  ["Windows structural step conditional", exactNativeWindowsJob.replace(
    "      - name: Validate native containment structure (hosted smoke only; non-evidence)\n",
    "      - name: Validate native containment structure (hosted smoke only; non-evidence)\n        if: false\n",
  )],
  ["Windows preflight step conditional", exactNativeWindowsJob.replace(
    "      - name: Confirm native containment preflight HOLD (hosted smoke only; non-evidence)\n",
    "      - name: Confirm native containment preflight HOLD (hosted smoke only; non-evidence)\n        if: false\n",
  )],
  ["Windows injected shell", exactNativeWindowsJob.replace(
    "        run: node --test tests/iat-b3-mandatory-ci-containment.test.mjs\n",
    "        run: node --test tests/iat-b3-mandatory-ci-containment.test.mjs\n        shell: cmd\n",
  )],
  ["Windows injected step environment", exactNativeWindowsJob.replace(
    "        run: node --test tests/iat-b3-mandatory-ci-containment.test.mjs\n",
    "        run: node --test tests/iat-b3-mandatory-ci-containment.test.mjs\n        env:\n          NODE_OPTIONS: --require attacker\n",
  )],
  ["Windows injected job environment", exactNativeWindowsJob.replace(
    "    steps:\n",
    "    env:\n      IAT_B3_OVERRIDE: attacker\n    steps:\n",
  )],
  ["Windows injected job defaults", exactNativeWindowsJob.replace(
    "    steps:\n",
    "    defaults:\n      run:\n        shell: cmd\n    steps:\n",
  )],
  ["Windows injected job working-directory defaults", exactNativeWindowsJob.replace(
    "    steps:\n",
    `    defaults:\n      run:\n        working-directory: ${exactSiteWorkingDirectory}\n    steps:\n`,
  )],
  ["Windows missing structural working directory", exactNativeWindowsJob.replace(
    `        working-directory: ${exactSiteWorkingDirectory}\n`,
    "",
  )],
  ["Windows wrong structural working directory", exactNativeWindowsJob.replace(
    `        working-directory: ${exactSiteWorkingDirectory}\n`,
    "        working-directory: projects/star-ascent/other\n",
  )],
  ["Windows duplicate structural working directory", exactNativeWindowsJob.replace(
    `        working-directory: ${exactSiteWorkingDirectory}\n`,
    `        working-directory: ${exactSiteWorkingDirectory}\n        working-directory: ${exactSiteWorkingDirectory}\n`,
  )],
  ["Windows case-drifted structural working directory", exactNativeWindowsJob.replace(
    `        working-directory: ${exactSiteWorkingDirectory}\n`,
    "        working-directory: Projects/star-ascent/site\n",
  )],
  ["Windows backslash structural working directory", exactNativeWindowsJob.replace(
    `        working-directory: ${exactSiteWorkingDirectory}\n`,
    "        working-directory: projects\\star-ascent\\site\n",
  )],
  ["Windows dot structural working directory", exactNativeWindowsJob.replace(
    `        working-directory: ${exactSiteWorkingDirectory}\n`,
    "        working-directory: .\n",
  )],
  ["Windows expression structural working directory", exactNativeWindowsJob.replace(
    `        working-directory: ${exactSiteWorkingDirectory}\n`,
    "        working-directory: ${{ github.workspace }}/projects/star-ascent/site\n",
  )],
  ["Windows step working-directory override", exactNativeWindowsJob.replace(
    `        working-directory: ${exactSiteWorkingDirectory}\n`,
    `        working-directory: ${exactSiteWorkingDirectory}\n        working-directory: .\n`,
  )],
  ["Windows reordered structural and preflight steps", exactNativeWindowsJob.replace(
    `${exactWindowsStructuralStep}\n${exactWindowsPreflightStep}`,
    `${exactWindowsPreflightStep}\n${exactWindowsStructuralStep}`,
  )],
  ["Windows expected-HOLD exit-code drift", exactNativeWindowsJob.replace(
    "          if ($status -ne 2) {",
    "          if ($status -ne 0) {",
  )],
  ["Windows missing hard-disable assertion", exactNativeWindowsJob.replace(
    "              $value.blockers -notcontains 'PHASE_B_NATIVE_BUILD_HARD_DISABLED') {",
    "              $false) {",
  )],
  ["Windows preflight continue-on-error", `${exactNativeWindowsJob}\n        continue-on-error: true`],
  ["Windows extra trailing step", `${exactNativeWindowsJob}\n      - run: node -e \"process.exit(0)\"`],
  ["Windows action working directory", exactNativeWindowsJob.replace(
    "          fetch-depth: 0\n",
    "          fetch-depth: 0\n        working-directory: projects/star-ascent/site\n",
  )],
  ["Windows checkout path", exactNativeWindowsJob.replace(
    "          fetch-depth: 0\n",
    "          fetch-depth: 0\n          path: projects/star-ascent/site\n",
  )],
  ["Windows renamed structural step", exactNativeWindowsJob.replace(
    "Validate native containment structure (hosted smoke only; non-evidence)",
    "Validate native containment release evidence",
  )],
].map(([name, mutatedJob]) => ({
  name,
  workflow: workflow.replace(exactNativeWindowsJob, mutatedJob),
  scripts: packageJson.scripts,
}));

nativeWindowsMutationProbes.push(
  {
    name: "duplicate Windows hosted job",
    workflow: workflow.replace("\n  rust-host:\n", `\n${exactNativeWindowsJob}\n\n  rust-host:\n`),
    scripts: packageJson.scripts,
  },
  {
    name: "workflow-level environment injection",
    workflow: workflow.replace("\npermissions:\n", "\nenv:\n  NODE_OPTIONS: --require attacker\n\npermissions:\n"),
    scripts: packageJson.scripts,
  },
  {
    name: "inline workflow-level environment injection",
    workflow: workflow.replace("\npermissions:\n", "\nenv: { NODE_OPTIONS: attacker }\n\npermissions:\n"),
    scripts: packageJson.scripts,
  },
  {
    name: "single-quoted workflow-level environment block injection",
    workflow: workflow.replace("\npermissions:\n", "\n'env':\n  NODE_OPTIONS: --require attacker\n\npermissions:\n"),
    scripts: packageJson.scripts,
  },
  {
    name: "single-quoted inline workflow-level environment injection",
    workflow: workflow.replace("\npermissions:\n", "\n'env': { NODE_OPTIONS: attacker }\n\npermissions:\n"),
    scripts: packageJson.scripts,
  },
  {
    name: "double-quoted workflow-level environment block injection",
    workflow: workflow.replace("\npermissions:\n", "\n\"env\":\n  NODE_OPTIONS: --require attacker\n\npermissions:\n"),
    scripts: packageJson.scripts,
  },
  {
    name: "double-quoted inline workflow-level environment injection",
    workflow: workflow.replace("\npermissions:\n", "\n\"env\": { NODE_OPTIONS: attacker }\n\npermissions:\n"),
    scripts: packageJson.scripts,
  },
  {
    name: "explicit mapping workflow-level environment injection",
    workflow: workflow.replace("\npermissions:\n", "\n? env\n: { NODE_OPTIONS: attacker }\n\npermissions:\n"),
    scripts: packageJson.scripts,
  },
  {
    name: "quoted explicit mapping workflow-level environment injection",
    workflow: workflow.replace("\npermissions:\n", "\n? \"env\"\n: { NODE_OPTIONS: attacker }\n\npermissions:\n"),
    scripts: packageJson.scripts,
  },
  {
    name: "Unicode-escaped workflow-level environment injection",
    workflow: workflow.replace("\npermissions:\n", "\n\"\\u0065nv\": { NODE_OPTIONS: attacker }\n\npermissions:\n"),
    scripts: packageJson.scripts,
  },
  {
    name: "tagged workflow-level environment injection",
    workflow: workflow.replace("\npermissions:\n", "\n!!str env: { NODE_OPTIONS: attacker }\n\npermissions:\n"),
    scripts: packageJson.scripts,
  },
  {
    name: "anchored workflow-level environment injection",
    workflow: workflow.replace("\npermissions:\n", "\nenv: &hostile { NODE_OPTIONS: attacker }\n\npermissions:\n"),
    scripts: packageJson.scripts,
  },
  {
    name: "aliased workflow-level environment injection",
    workflow: workflow.replace("\npermissions:\n", "\nx-env: &hostile { NODE_OPTIONS: attacker }\nenv: *hostile\n\npermissions:\n"),
    scripts: packageJson.scripts,
  },
  {
    name: "merged workflow-level environment injection",
    workflow: workflow.replace("\npermissions:\n", "\nx-template: &hostile { env: { NODE_OPTIONS: attacker } }\n<<: *hostile\n\npermissions:\n"),
    scripts: packageJson.scripts,
  },
  {
    name: "unknown column-zero workflow key injection",
    workflow: workflow.replace("\npermissions:\n", "\nunexpected: true\n\npermissions:\n"),
    scripts: packageJson.scripts,
  },
  {
    name: "top-level defaults block injection",
    workflow: workflow.replace(
      "\njobs:\n",
      `\ndefaults:\n  run:\n    working-directory: ${exactSiteWorkingDirectory}\n\njobs:\n`,
    ),
    scripts: packageJson.scripts,
  },
  {
    name: "top-level inline defaults injection",
    workflow: workflow.replace(
      "\njobs:\n",
      `\ndefaults: { run: { working-directory: ${exactSiteWorkingDirectory} } }\n\njobs:\n`,
    ),
    scripts: packageJson.scripts,
  },
  {
    name: "duplicate top-level defaults injection",
    workflow: workflow.replace(
      "\njobs:\n",
      `\ndefaults:\n  run:\n    working-directory: ${exactSiteWorkingDirectory}\ndefaults: { run: { shell: cmd } }\n\njobs:\n`,
    ),
    scripts: packageJson.scripts,
  },
  {
    name: "missing web job cwd defaults",
    workflow: workflow.replace(
      exactNonWindowsJobDefaultAnchors[0],
      exactNonWindowsJobDefaultAnchors[0].replace(`${exactSiteJobRunDefaults}\n`, ""),
    ),
    scripts: packageJson.scripts,
  },
  {
    name: "wrong rust job cwd defaults",
    workflow: workflow.replace(
      exactNonWindowsJobDefaultAnchors[1],
      exactNonWindowsJobDefaultAnchors[1].replace(
        exactSiteWorkingDirectory,
        "projects/star-ascent/other",
      ),
    ),
    scripts: packageJson.scripts,
  },
  {
    name: "non-Windows run-step cwd override",
    workflow: workflow.replace(
      "      - run: npm ci\n",
      "      - run: npm ci\n        working-directory: .\n",
    ),
    scripts: packageJson.scripts,
  },
);

const phaseBWorkflowMutationProbes = [
  [
    "missing Phase-B structural command",
    exactPhaseBHostedSmokeJob.replace(
      `        run: ${exactPhaseBStructureWorkflowCommand}\n`,
      "",
    ),
  ],
  [
    "reordered Phase-B structural and all-false commands",
    exactPhaseBHostedSmokeJob
      .replace(
        exactPhaseBStructureWorkflowCommand,
        "BP09_COMMAND_SWAP",
      )
      .replace(
        exactPhaseBHostedSmokeWorkflowCommand,
        exactPhaseBStructureWorkflowCommand,
      )
      .replace("BP09_COMMAND_SWAP", exactPhaseBHostedSmokeWorkflowCommand),
  ],
  [
    "Phase-B shell drift",
    exactPhaseBHostedSmokeJob.replace("        shell: bash\n", "        shell: sh\n"),
  ],
  [
    "Phase-B timeout drift",
    exactPhaseBHostedSmokeJob.replace("        timeout-minutes: 5\n", "        timeout-minutes: 6\n"),
  ],
  [
    "Phase-B working-directory override",
    exactPhaseBHostedSmokeJob.replace(
      "        shell: bash\n",
      "        working-directory: .\n        shell: bash\n",
    ),
  ],
  [
    "Phase-B environment injection",
    exactPhaseBHostedSmokeJob.replace(
      "        shell: bash\n",
      "        env:\n          NODE_OPTIONS: --require attacker\n        shell: bash\n",
    ),
  ],
  [
    "Phase-B fail-open continuation",
    exactPhaseBHostedSmokeJob.replace(
      "        timeout-minutes: 5\n",
      "        timeout-minutes: 5\n        continue-on-error: true\n",
    ),
  ],
  [
    "Phase-B helper execution promotion",
    exactPhaseBHostedSmokeJob.replace(
      exactPhaseBHostedSmokeWorkflowCommand,
      "node scripts/build-iat-b3-mandatory-ci-containment.mjs --execute",
    ),
  ],
  [
    "Phase-B hosted provenance output promotion",
    exactPhaseBHostedSmokeJob.replace(
      "        timeout-minutes: 5\n",
      "        timeout-minutes: 5\n        id: publish-runtime-evidence\n",
    ),
  ],
  [
    "Phase-B cache or artifact download step",
    `${exactPhaseBHostedSmokeJob}      - uses: actions/download-artifact@0000000000000000000000000000000000000000\n`,
  ],
  [
    "Phase-B release-claim label",
    exactPhaseBHostedSmokeJob.replace(
      "Confirm Phase-B canonical all-false HOLD (hosted smoke only; non-evidence)",
      "Publish Phase-B release evidence",
    ),
  ],
  [
    "Phase-B local provenance dependency removed",
    exactPhaseBHostedSmokeJob.replace("    needs: native-containment-windows\n", ""),
  ],
  [
    "Phase-B checkout credential persistence",
    exactPhaseBHostedSmokeJob.replace("          persist-credentials: false\n", ""),
  ],
  [
    "Phase-B setup-node cache injection",
    exactPhaseBHostedSmokeJob.replace(
      "          node-version: 24\n",
      "          node-version: 24\n          cache: npm\n",
    ),
  ],
].map(([name, mutatedBlock]) => ({
  name,
  workflow: workflow.replace(exactPhaseBHostedSmokeJob, mutatedBlock),
  scripts: packageJson.scripts,
}));

const mutationProbes = [
  ...nativeWindowsMutationProbes,
  ...phaseBWorkflowMutationProbes,
  {
    name: "diluted Phase-B structure package script",
    workflow,
    scripts: {
      ...packageJson.scripts,
      "check:iat-b3-mandatory-ci-phase-b-structure": "node -e \"process.exit(0)\"",
    },
  },
  {
    name: "runtime-promoted Phase-B hosted smoke package script",
    workflow,
    scripts: {
      ...packageJson.scripts,
      "check:iat-b3-mandatory-ci-phase-b-hosted-smoke":
        "node scripts/run-iat-b3-mandatory-ci-gate.mjs native-process-containment",
    },
  },
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
    name: "missing combined-law SBF feature",
    workflow: workflow.replace("            --features production-combined-hook \\\n", ""),
    scripts: packageJson.scripts,
  },
  {
    name: "unlocked combined-law crate prefetch",
    workflow: workflow.replace(
      "          cargo +1.97.1 fetch \\\n            --locked \\\n            --manifest-path programs/iat_b3_law/Cargo.toml\n",
      "          cargo +1.97.1 fetch \\\n            --manifest-path programs/iat_b3_law/Cargo.toml\n",
    ),
    scripts: packageJson.scripts,
  },
  {
    name: "combined-law fixture graph not prefetched",
    workflow: workflow.replace(
      "          cargo +1.97.1 fetch \\\n            --locked \\\n            --manifest-path tests/fixtures/iat-b3-combined-law-stake/Cargo.toml\n",
      "",
    ),
    scripts: packageJson.scripts,
  },
  {
    name: "combined-law loopback runner bypassed",
    workflow: workflow.replace(
      "          bash scripts/run-iat-b3-combined-law-stake-local-rehearsal.sh --require-tools \\\n",
      "          true \\\n",
    ),
    scripts: packageJson.scripts,
  },
  {
    name: "floating combined-law platform tools",
    workflow: workflow.replace(
      "          --force-tools-install\n          --tools-version v1.52\n",
      "          --force-tools-install\n",
    ),
    scripts: packageJson.scripts,
  },
  {
    name: "substituted combined-law fixture identity",
    workflow: workflow.replaceAll(
      combinedLawFixtureIdentities.canonicalMint,
      combinedLawFixtureIdentities.lawProgramId,
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
    name: "cross-head branch concurrency cancellation",
    workflow: workflow.replace(
      "github.event.pull_request.head.sha || github.sha",
      "github.event.pull_request.head.ref || github.ref_name",
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
    name: "B3 law SBF build bypassed",
    workflow: workflow.replace("test -s target/verifiable/iat_b3_law.so", "true"),
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
  {
    name: "B3 successor-lineage regression omitted",
    workflow,
    scripts: {
      ...packageJson.scripts,
      "check:iat-v2-architecture-work": "node scripts/validate-iat-v2-architecture-work.mjs",
    },
  },
];

for (const probe of mutationProbes) {
  if (validateConfiguration(Buffer.from(probe.workflow, "utf8"), probe.scripts).length === 0) {
    failures.push(`mutation probe did not fail closed: ${probe.name}`);
  }
}

const rawWorkflowMutationProbes = [
  {
    name: "CRLF workflow bytes",
    bytes: Buffer.from(workflow.replaceAll("\n", "\r\n"), "ascii"),
  },
  {
    name: "lone CR workflow byte",
    bytes: Buffer.from(workflow.replace("\n", "\r"), "ascii"),
  },
  {
    name: "tab indentation workflow byte",
    bytes: Buffer.from(workflow.replace("  push:", "\tpush:"), "ascii"),
  },
  {
    name: "NUL workflow byte",
    bytes: Buffer.concat([Buffer.from([0x00]), workflowBytes]),
  },
  {
    name: "UTF-8 BOM workflow bytes",
    bytes: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), workflowBytes]),
  },
  {
    name: "missing final LF workflow bytes",
    bytes: workflowBytes.subarray(0, -1),
  },
  ...[
    ["NBSP", "\u00a0"],
    ["OGHAM SPACE MARK", "\u1680"],
    ["EN QUAD", "\u2000"],
    ["EM SPACE", "\u2003"],
    ["LINE SEPARATOR", "\u2028"],
    ["PARAGRAPH SEPARATOR", "\u2029"],
    ["NARROW NO-BREAK SPACE", "\u202f"],
    ["MEDIUM MATHEMATICAL SPACE", "\u205f"],
    ["IDEOGRAPHIC SPACE", "\u3000"],
    ["ZERO WIDTH NO-BREAK SPACE", "\ufeff"],
  ].map(([name, prefix]) => ({
    name: `${name}-prefixed column-zero workflow line`,
    bytes: Buffer.from(`${prefix}env: { NODE_OPTIONS: attacker }\n${workflow}`, "utf8"),
  })),
];

for (const probe of rawWorkflowMutationProbes) {
  if (probe.bytes.equals(workflowBytes)) {
    failures.push(`raw mutation probe did not alter bytes: ${probe.name}`);
  } else if (validateConfiguration(probe.bytes, packageJson.scripts ?? {}).length === 0) {
    failures.push(`raw mutation probe did not fail closed: ${probe.name}`);
  }
}

const combinedLawStakeRunnerMutationProbes = [
  {
    name: "combined Law/stake feature omitted",
    runner: combinedLawStakeRunner.replace("  --features production-combined-hook \\\n", ""),
  },
  {
    name: "combined Law/stake dynamic mint replaced",
    runner: combinedLawStakeRunner.replace(
      'IAT_B3_PRODUCTION_CANONICAL_MINT="$mint_pubkey"',
      'IAT_B3_PRODUCTION_CANONICAL_MINT="3JF3sEqM796hk5WFqA6EtmEwJQ9quALszsfJyvXNQKy3"',
    ),
  },
  {
    name: "combined Law/stake HOLD flipped",
    runner: combinedLawStakeRunner.replace('"statusGate":"HOLD"', '"statusGate":"READY"'),
  },
  {
    name: "combined Law/stake rollback claim omitted",
    runner: combinedLawStakeRunner.replace('"rawAndBalanceRollbackAsserted":true', '"rawAndBalanceRollbackAsserted":false'),
  },
];

for (const probe of combinedLawStakeRunnerMutationProbes) {
  if (validateCombinedLawStakeRunner(probe.runner).length === 0) {
    failures.push(`mutation probe did not fail closed: ${probe.name}`);
  }
}

const sbfProofMutationProbes = [
  {
    name: "workspace-wide Anchor discovery reintroduced",
    script: sbfProofScript.replace('["programs/iat_v2"]', '["programs/*"]'),
  },
  {
    name: "workspace-wide Anchor build reintroduced",
    script: sbfProofScript.replace(" --program-name iat_v2", ""),
  },
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
  {
    name: "container platform descriptor verification omitted",
    script: sbfProofScript.replace('docker manifest inspect "$build_container_reference"', 'printf \'{}\''),
  },
];

for (const probe of sbfProofMutationProbes) {
  if (validateSbfProofScript(probe.script).length === 0) {
    failures.push(`mutation probe did not fail closed: ${probe.name}`);
  }
}

const canonicalB3LawBytes = currentB3LawEvidence.artifact.sizeBytes;
const canonicalB3LawSha256 = currentB3LawEvidence.artifact.sha256;
const driftedCombinedLawFixtureBytes = combinedLawFixtureBytes + 1;
const driftedCombinedLawFixtureSha256 = `${combinedLawFixtureSha256.slice(0, -1)}${
  combinedLawFixtureSha256.endsWith("0") ? "1" : "0"
}`;
const driftedB3LawBytes = canonicalB3LawBytes + 1;
const driftedB3LawSha256 = `${canonicalB3LawSha256.slice(0, -1)}${canonicalB3LawSha256.endsWith("0") ? "1" : "0"}`;
const driftedB3LawEvidenceBytes = structuredClone(currentB3LawEvidence);
driftedB3LawEvidenceBytes.artifact.sizeBytes = driftedB3LawBytes;
const driftedB3LawEvidenceSha256 = structuredClone(currentB3LawEvidence);
driftedB3LawEvidenceSha256.artifact.sha256 = driftedB3LawSha256;
const b3CandidateBindingMutationProbes = [
  {
    name: "drifted workflow B3 law byte pin",
    workflowText: workflow.replace(
      `expected_b3_law_bytes=${combinedLawFixtureBytes}`,
      `expected_b3_law_bytes=${driftedCombinedLawFixtureBytes}`,
    ),
    devnetWrapperText: b3DevnetWrapper,
    devnetDriverText: b3DevnetDriver,
    evidence: currentB3LawEvidence,
  },
  {
    name: "drifted workflow B3 law SHA-256 pin",
    workflowText: workflow.replace(
      combinedLawFixtureSha256,
      driftedCombinedLawFixtureSha256,
    ),
    devnetWrapperText: b3DevnetWrapper,
    devnetDriverText: b3DevnetDriver,
    evidence: currentB3LawEvidence,
  },
  {
    name: "drifted Devnet wrapper B3 law byte pin",
    workflowText: workflow,
    devnetWrapperText: b3DevnetWrapper.replace(
      `expected_artifact_size="${canonicalB3LawBytes}"`,
      `expected_artifact_size="${driftedB3LawBytes}"`,
    ),
    devnetDriverText: b3DevnetDriver,
    evidence: currentB3LawEvidence,
  },
  {
    name: "drifted Devnet wrapper B3 law SHA-256 pin",
    workflowText: workflow,
    devnetWrapperText: b3DevnetWrapper.replace(canonicalB3LawSha256, driftedB3LawSha256),
    devnetDriverText: b3DevnetDriver,
    evidence: currentB3LawEvidence,
  },
  {
    name: "drifted Devnet driver B3 law byte pin",
    workflowText: workflow,
    devnetWrapperText: b3DevnetWrapper,
    devnetDriverText: b3DevnetDriver.replace(
      `EXPECTED_ARTIFACT_SIZE = ${canonicalB3LawBytes.toLocaleString("en-US").replaceAll(",", "_")}`,
      `EXPECTED_ARTIFACT_SIZE = ${driftedB3LawBytes.toLocaleString("en-US").replaceAll(",", "_")}`,
    ),
    evidence: currentB3LawEvidence,
  },
  {
    name: "drifted Devnet driver B3 law SHA-256 pin",
    workflowText: workflow,
    devnetWrapperText: b3DevnetWrapper,
    devnetDriverText: b3DevnetDriver.replace(canonicalB3LawSha256, driftedB3LawSha256),
    evidence: currentB3LawEvidence,
  },
  {
    name: "drifted canonical evidence B3 law byte pin",
    workflowText: workflow,
    devnetWrapperText: b3DevnetWrapper,
    devnetDriverText: b3DevnetDriver,
    evidence: driftedB3LawEvidenceBytes,
  },
  {
    name: "drifted canonical evidence B3 law SHA-256 pin",
    workflowText: workflow,
    devnetWrapperText: b3DevnetWrapper,
    devnetDriverText: b3DevnetDriver,
    evidence: driftedB3LawEvidenceSha256,
  },
];

for (const probe of b3CandidateBindingMutationProbes) {
  if (validateB3LawArtifactBindings(probe).length === 0) {
    failures.push(`mutation probe did not fail closed: ${probe.name}`);
  }
}

if (failures.length) {
  failures.forEach((message) => console.error(`FAIL: ${message}`));
  process.exit(1);
}

console.log(
  `IAT V2/B3 public release-proof workflow regression passed: ${requiredLaunchGateScripts.length} ordered launch gates, both signoff validators, ${[...requiredActionPins.values()].reduce((sum, count) => sum + count, 0)} immutable action uses, isolated Phase-B all-false HOLD smoke, checksum-pinned Agave, revision-pinned Anchor, iat_v2-only Anchor discovery/build, exact head/checkout/public-run/container-bound binary/IDL evidence, fixture-combined B3 workflow and canonical-evidence Devnet SBF pins, V2-to-B3 successor-lineage validation, canonical manifest validation, exact-source-head concurrency, read-only permissions, and ${mutationProbes.length + rawWorkflowMutationProbes.length + combinedLawStakeRunnerMutationProbes.length + sbfProofMutationProbes.length + b3CandidateBindingMutationProbes.length} fail-closed mutation probes remain bound.`,
);
