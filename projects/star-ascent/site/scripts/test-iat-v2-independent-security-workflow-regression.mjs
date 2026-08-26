#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

import {
  INDEPENDENT_SECURITY_ARTIFACT_NAME,
  INDEPENDENT_SECURITY_REGRESSION_PATHS,
  INDEPENDENT_SECURITY_REQUIRED_JOB_STEPS,
  INDEPENDENT_SECURITY_WORKFLOW_JOB_KEY,
  INDEPENDENT_SECURITY_WORKFLOW_JOB_NAME,
  INDEPENDENT_SECURITY_WORKFLOW_PATH,
} from "./lib/iat-v2-independent-security-evidence.mjs";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(siteRoot, "../../..");
const workflowPath = resolve(repositoryRoot, INDEPENDENT_SECURITY_WORKFLOW_PATH);
const workflowSource = readFileSync(workflowPath, "utf8");
const workflow = parse(workflowSource);
const job = workflow.jobs?.[INDEPENDENT_SECURITY_WORKFLOW_JOB_KEY];

assert.deepEqual(Object.keys(workflow.jobs ?? {}), [INDEPENDENT_SECURITY_WORKFLOW_JOB_KEY]);
assert.equal(workflow.permissions?.contents, "read");
assert.deepEqual(Object.keys(workflow.on ?? {}).sort(), ["pull_request", "push", "workflow_dispatch"]);
assert.equal("pull_request_target" in (workflow.on ?? {}), false);
assert.equal("workflow_run" in (workflow.on ?? {}), false);
assert.equal(workflow.concurrency?.["cancel-in-progress"], false);
assert.equal(job.name, INDEPENDENT_SECURITY_WORKFLOW_JOB_NAME);
assert.equal(job["runs-on"], "ubuntu-24.04");
assert.equal(job["timeout-minutes"], 45);
assert.equal("needs" in job, false);
assert.equal(
  job.env.IAT_V2_SECURITY_SOURCE_HEAD_SHA,
  "${{ github.event.pull_request.head.sha || github.sha }}",
);
assert.equal(
  job.env.IAT_V2_SECURITY_PROGRAM_ARTIFACT_SHA256,
  "771c87bcd9afacf7e8e6bf43cd7ba05915fceb11c45a6a89d8080f6b52778a01",
);

const stepsByName = new Map(job.steps.map((step) => [step.name, step]));
assert.equal(stepsByName.size, job.steps.length, "workflow step names must be unique");
for (const name of INDEPENDENT_SECURITY_REQUIRED_JOB_STEPS) {
  assert(stepsByName.has(name), `missing exact security workflow step ${name}`);
}

const checkout = stepsByName.get("Check out exact source head");
assert.equal(checkout.uses, "actions/checkout@11d5960a326750d5838078e36cf38b85af677262");
assert.equal(checkout.with["fetch-depth"], 0);
assert.equal(checkout.with["persist-credentials"], false);
assert.equal(checkout.with.ref, "${{ github.event.pull_request.head.sha || github.sha }}");

const setupNode = stepsByName.get("Set up pinned Node runtime");
assert.equal(setupNode.uses, "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020");
assert.equal(setupNode.with["node-version"], 24);

const installDependencies = stepsByName.get("Install exact site dependencies");
assert.equal(installDependencies["working-directory"], "projects/star-ascent/site");
assert.equal(installDependencies.run, "npm ci --ignore-scripts --no-audit --no-fund");

const cargoInstall = stepsByName.get("Install pinned Cargo audit tool");
assert.equal(cargoInstall.run, "cargo install cargo-audit --version 0.22.2 --locked");

const npmRoot = stepsByName.get("Run root npm advisory audit").run;
const npmSite = stepsByName.get("Run site npm advisory audit").run;
assert.match(npmRoot, /npm audit --package-lock-only --audit-level=high --json/u);
assert.match(npmSite, /npm audit --package-lock-only --audit-level=high --json/u);

const cargoAudits = stepsByName.get("Run Cargo advisory audits").run;
for (const path of [
  "projects/star-ascent/site/Cargo.lock",
  "projects/star-ascent/site/tests/fixtures/iat-b3-account-lifecycle/Cargo.lock",
  "projects/star-ascent/site/tests/fixtures/iat-b3-stake-ingress/Cargo.lock",
]) {
  assert(cargoAudits.includes(`--file ${path}`), `Cargo audit is not bound to ${path}`);
}

const regression = stepsByName.get("Run fixed security regression suite").run;
assert.match(regression, /node --test --test-reporter=tap/u);
assert.match(regression, /set -euo pipefail/u);
for (const path of INDEPENDENT_SECURITY_REGRESSION_PATHS) {
  assert(regression.includes(path), `security regression suite omitted ${path}`);
}

const assembler = stepsByName.get("Assemble canonical security evidence").run;
assert.match(assembler, /build-iat-v2-independent-security-evidence\.mjs/u);
for (const option of [
  "--node-version",
  "--npm-version",
  "--cargo-audit-version",
  "--npm-root-audit",
  "--npm-root-exit-code",
  "--npm-site-audit",
  "--npm-site-exit-code",
  "--cargo-site-audit",
  "--cargo-site-exit-code",
  "--cargo-account-lifecycle-audit",
  "--cargo-account-lifecycle-exit-code",
  "--cargo-stake-ingress-audit",
  "--cargo-stake-ingress-exit-code",
  "--security-regression-tap",
  "--security-regression-exit-code",
  "--program-artifact-sha256",
  "--output",
]) assert(assembler.includes(option), `assembler invocation omitted ${option}`);
assert.doesNotMatch(assembler, /--(?:pass|approved|verified|ready|go)\b/iu);
for (const stepName of [
  "Run root npm advisory audit",
  "Run site npm advisory audit",
  "Run Cargo advisory audits",
  "Run fixed security regression suite",
]) {
  const command = stepsByName.get(stepName).run;
  assert.match(command, /set -euo pipefail/u, `${stepName} must retain fail-fast pipe semantics`);
  assert.match(command, /printf '0\\n'.*\.exit-code\.txt/u, `${stepName} must emit exact zero exit receipt only after success`);
}

const upload = stepsByName.get("Upload immutable security evidence artifact");
assert.equal(upload.uses, "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02");
assert.equal(upload.with.name, INDEPENDENT_SECURITY_ARTIFACT_NAME);
assert.equal(upload.with["if-no-files-found"], "error");
assert.equal(upload.with["retention-days"], 30);
assert.match(upload.with.path, /target\/security\/iat-v2-independent-security-evidence\.json/u);
assert.match(upload.with.path, /target\/security\/raw/u);

assert.doesNotMatch(workflowSource, /\b(?:pull_request_target|workflow_run)\b/u);
assert.doesNotMatch(workflowSource, /\$\{\{\s*secrets\./u);
assert.doesNotMatch(workflowSource, /actions\/download-artifact|\b(?:trezor|solana|rpc|broadcast|deploy|mainnet-beta)\b/iu);

const builderSource = readFileSync(
  resolve(siteRoot, "scripts/build-iat-v2-independent-security-evidence.mjs"),
  "utf8",
);
const validatorSource = readFileSync(
  resolve(siteRoot, "scripts/lib/iat-v2-independent-security-evidence.mjs"),
  "utf8",
);
assert.doesNotMatch(builderSource, /--(?:pass|approved|verified|ready|go)\b/iu);
assert.match(builderSource, /summarizeNpmAuditBytes/u);
assert.match(builderSource, /summarizeCargoAuditBytes/u);
assert.match(builderSource, /summarizeTapBytes/u);
assert.match(validatorSource, /GitHub run receipt/u);
assert.match(validatorSource, /GitHub jobs receipt/u);
assert.match(validatorSource, /GitHub artifact receipt/u);
assert.match(validatorSource, /RUSTSEC-2025-0141/u);
assert.match(validatorSource, /mainnetStatus:\s*"HOLD"/u);

console.log(
  "IAT V2 independent-security workflow regression passed: one isolated public GitHub job, pinned actions/tools, five advisory inputs, fixed TAP suite, raw-byte assembler, immutable artifact, no caller PASS switch, and Mainnet HOLD remain exact.",
);
