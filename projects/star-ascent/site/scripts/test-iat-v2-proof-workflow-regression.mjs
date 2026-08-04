#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workflowPath = resolve(
  process.cwd(),
  "../../..",
  ".github/workflows/iat-v2-proof.yml",
);
const workflow = readFileSync(workflowPath, "utf8").replaceAll("\r\n", "\n");
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

function validateConfiguration(workflowText, scripts) {
  const failures = [];
  const fail = (message) => failures.push(message);
  const commandLines = workflowText
    .split("\n")
    .map((line) => line.match(/^\s*- run:\s+(.+?)\s*$/)?.[1] ?? null)
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
  if (!/concurrency:\n\s+group:\s+iat-v2-proof-\$\{\{ github\.ref \}\}\n\s+cancel-in-progress:\s+true/m.test(workflowText)) {
    fail("release-proof workflow must retain branch-scoped concurrency cancellation");
  }
  if (/continue-on-error:\s+true/.test(workflowText)) {
    fail("release-proof workflow must not weaken a gate with continue-on-error");
  }
  if (!/node-version:\s+24(?:\.x)?\s*$/m.test(workflowText)) {
    fail("release-proof workflow must retain the reviewed Node 24 runtime");
  }
  if (!/fetch-depth:\s+0\s*$/m.test(workflowText)) {
    fail("release-proof workflow must retain full history for source-bound audit validation");
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

const failures = validateConfiguration(workflow, packageJson.scripts ?? {});
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
];

for (const probe of mutationProbes) {
  if (validateConfiguration(probe.workflow, probe.scripts).length === 0) {
    failures.push(`mutation probe did not fail closed: ${probe.name}`);
  }
}

if (failures.length) {
  failures.forEach((message) => console.error(`FAIL: ${message}`));
  process.exit(1);
}

console.log(
  `IAT V2 public release-proof workflow regression passed: ${requiredLaunchGateScripts.length} ordered launch gates, both signoff validators, read-only permissions, and 4 fail-closed mutation probes remain bound.`,
);
