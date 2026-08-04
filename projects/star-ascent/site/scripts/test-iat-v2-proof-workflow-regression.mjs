#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workflowPath = resolve(
  process.cwd(),
  "../../..",
  ".github/workflows/iat-v2-proof.yml",
);
const workflow = readFileSync(workflowPath, "utf8").replaceAll("\r\n", "\n");
const failures = [];
const fail = (message) => failures.push(message);

const requiredOrderedCommands = [
  "npm run check:iat-v2-proof-workflow",
  "npm run check:ui-regression",
  "npm run check:iat-v2",
  "npm run check:launch-gates",
  "npm run check:iat-v2-signoff",
  "npm test",
  "npm run lint",
];

const commandLines = workflow
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
if (!/^permissions:\n\s+contents:\s+read\s*$/m.test(workflow)) {
  fail("release-proof workflow must retain read-only repository permissions");
}
if (!/concurrency:\n\s+group:\s+iat-v2-proof-\$\{\{ github\.ref \}\}\n\s+cancel-in-progress:\s+true/m.test(workflow)) {
  fail("release-proof workflow must retain branch-scoped concurrency cancellation");
}
if (/continue-on-error:\s+true/.test(workflow)) {
  fail("release-proof workflow must not weaken a gate with continue-on-error");
}
if (!/node-version:\s+24(?:\.x)?\s*$/m.test(workflow)) {
  fail("release-proof workflow must retain the reviewed Node 24 runtime");
}
if (!/fetch-depth:\s+0\s*$/m.test(workflow)) {
  fail("release-proof workflow must retain full history for source-bound audit validation");
}

if (failures.length) {
  failures.forEach((message) => console.error(`FAIL: ${message}`));
  process.exit(1);
}

console.log(
  "IAT V2 public release-proof workflow regression passed: UI, policy, launch, independent-signoff, test, and lint gates remain ordered and fail closed with read-only permissions.",
);
