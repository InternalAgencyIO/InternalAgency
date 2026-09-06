#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = process.cwd();
const independentValidator = resolve(projectRoot, "scripts/validate-iat-v2-independent-signoff.mjs");
const featureValidator = resolve(projectRoot, "scripts/validate-iat-v2-feature-signoff.mjs");

const independentFixtures = [
  "launch/iat-v2-devnet-independent-signoff.template.json",
  "public/evidence/iat-v2/v2-initialization-20260730T074603Z.json",
];
const featureFixtures = [
  "launch/iat-v2-devnet-feature-independent-signoff.template.json",
  "public/evidence/iat-v2/v2-features-20260801T053340Z.json",
  "public/evidence/iat-v2/chain-status-20260801T053947Z.json",
  "public/evidence/iat-v2/v2-initialization-20260730T074603Z.json",
  "public/evidence/iat-v2/legacy-v1-devnet-ceremony-20260729.json",
  "public/audits/iat-v2-remediation-20260802/scope.json",
];

function copyFixtures(root, fixtures) {
  for (const relativePath of fixtures) {
    const destination = resolve(root, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(resolve(projectRoot, relativePath), destination);
  }
}

function mutateJson(root, relativePath, mutate) {
  const path = resolve(root, relativePath);
  const value = JSON.parse(readFileSync(path, "utf8"));
  mutate(value);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function runProbe({
  name,
  validator,
  fixtures,
  mutate,
  args = [],
  expectedStatus,
  expectedMessage,
}) {
  const root = mkdtempSync(join(tmpdir(), "iat-v2-signoff-regression-"));
  try {
    copyFixtures(root, fixtures);
    mutate?.(root);
    const result = spawnSync(process.execPath, [validator, ...args], {
      cwd: root,
      encoding: "utf8",
      timeout: 15_000,
      windowsHide: true,
    });
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    assert.equal(result.error, undefined, `${name}: validator process failed to start: ${result.error?.message}`);
    assert.equal(result.signal, null, `${name}: validator was terminated by ${result.signal}`);
    assert.equal(
      result.status,
      expectedStatus,
      `${name}: expected exit ${expectedStatus}, got ${result.status}\n${output}`,
    );
    assert.match(output, expectedMessage, `${name}: expected diagnostic ${expectedMessage}, got:\n${output}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const probes = [
  {
    name: "canonical pending initialization signoff",
    validator: independentValidator,
    fixtures: independentFixtures,
    expectedStatus: 0,
    expectedMessage: /initialization automated observation is PENDING/u,
  },
  {
    name: "pending initialization signoff with a claimed completed check",
    validator: independentValidator,
    fixtures: independentFixtures,
    mutate: (root) => mutateJson(
      root,
      "launch/iat-v2-devnet-independent-signoff.template.json",
      (signoff) => { signoff.checks.evidenceSha256Matched = true; },
    ),
    expectedStatus: 1,
    expectedMessage: /PENDING observation must not contain partial or self-asserted completion evidence/u,
  },
  {
    name: "pending initialization observation with a human reviewer gate",
    validator: independentValidator,
    fixtures: independentFixtures,
    mutate: (root) => mutateJson(
      root,
      "launch/iat-v2-devnet-independent-signoff.template.json",
      (signoff) => { signoff.observationPolicy.humanReviewerRequired = true; },
    ),
    expectedStatus: 1,
    expectedMessage: /observationPolicy must preserve automated evidence/u,
  },
  {
    name: "initialization signoff credential-field injection",
    validator: independentValidator,
    fixtures: independentFixtures,
    mutate: (root) => mutateJson(
      root,
      "launch/iat-v2-devnet-independent-signoff.template.json",
      (signoff) => { signoff.observationPolicy.seedPhrase = "forbidden"; },
    ),
    expectedStatus: 1,
    expectedMessage: /forbidden credential field signoff\.observationPolicy\.seedPhrase/u,
  },
  {
    name: "substituted initialization signoff path",
    validator: independentValidator,
    fixtures: independentFixtures,
    args: ["launch/substituted-signoff.json"],
    expectedStatus: 1,
    expectedMessage: /sign-off path must be launch\/iat-v2-devnet-independent-signoff\.template\.json/u,
  },
  {
    name: "canonical historical feature signoff",
    validator: featureValidator,
    fixtures: featureFixtures,
    expectedStatus: 0,
    expectedMessage: /historical corrected-program feature automated observation validates for its prior artifact/u,
  },
  {
    name: "feature signoff with a false canonical check",
    validator: featureValidator,
    fixtures: featureFixtures,
    mutate: (root) => mutateJson(
      root,
      "launch/iat-v2-devnet-feature-independent-signoff.template.json",
      (signoff) => { signoff.checks.chainReceipt29Of29Finalized = false; },
    ),
    expectedStatus: 1,
    expectedMessage: /VERIFIED observation requires every canonical check to be true/u,
  },
  {
    name: "feature signoff with a future completion time",
    validator: featureValidator,
    fixtures: featureFixtures,
    mutate: (root) => mutateJson(
      root,
      "launch/iat-v2-devnet-feature-independent-signoff.template.json",
      (signoff) => { signoff.completedAtUtc = "2999-01-01T00:00:00Z"; },
    ),
    expectedStatus: 1,
    expectedMessage: /automated observation completion cannot be in the future/u,
  },
  {
    name: "feature observation permitting self-attestation",
    validator: featureValidator,
    fixtures: featureFixtures,
    mutate: (root) => mutateJson(
      root,
      "launch/iat-v2-devnet-feature-independent-signoff.template.json",
      (signoff) => { signoff.observationPolicy.noSelfAttestation = false; },
    ),
    expectedStatus: 1,
    expectedMessage: /observationPolicy must preserve automated evidence/u,
  },
  {
    name: "feature signoff evidence digest drift",
    validator: featureValidator,
    fixtures: featureFixtures,
    mutate: (root) => mutateJson(
      root,
      "launch/iat-v2-devnet-feature-independent-signoff.template.json",
      (signoff) => { signoff.evidence.sha256 = "0".repeat(64); },
    ),
    expectedStatus: 1,
    expectedMessage: /feature evidence binding does not match the canonical export/u,
  },
  {
    name: "feature signoff chain-receipt digest drift",
    validator: featureValidator,
    fixtures: featureFixtures,
    mutate: (root) => mutateJson(
      root,
      "launch/iat-v2-devnet-feature-independent-signoff.template.json",
      (signoff) => { signoff.chainReceipt.sha256 = "0".repeat(64); },
    ),
    expectedStatus: 1,
    expectedMessage: /chain receipt does not prove 29 finalized, error-free canonical signatures/u,
  },
  {
    name: "feature signoff with an exception",
    validator: featureValidator,
    fixtures: featureFixtures,
    mutate: (root) => mutateJson(
      root,
      "launch/iat-v2-devnet-feature-independent-signoff.template.json",
      (signoff) => { signoff.exceptions = ["unresolved"]; },
    ),
    expectedStatus: 1,
    expectedMessage: /VERIFIED observation cannot contain exceptions/u,
  },
  {
    name: "feature signoff credential-field injection",
    validator: featureValidator,
    fixtures: featureFixtures,
    mutate: (root) => mutateJson(
      root,
      "launch/iat-v2-devnet-feature-independent-signoff.template.json",
      (signoff) => { signoff.observationPolicy.privateKey = "forbidden"; },
    ),
    expectedStatus: 1,
    expectedMessage: /forbidden credential field signoff\.observationPolicy\.privateKey/u,
  },
  {
    name: "feature signoff reclassified as current-source proof",
    validator: featureValidator,
    fixtures: featureFixtures,
    mutate: (root) => mutateJson(
      root,
      "public/audits/iat-v2-remediation-20260802/scope.json",
      (scope) => { scope.historicalDevnetEvidence.coversThisSourceCommit = true; },
    ),
    expectedStatus: 1,
    expectedMessage: /remediation audit must classify this feature sign-off as historical and require a fresh run/u,
  },
  {
    name: "verified feature signoff downgraded without clearing claims",
    validator: featureValidator,
    fixtures: featureFixtures,
    mutate: (root) => mutateJson(
      root,
      "launch/iat-v2-devnet-feature-independent-signoff.template.json",
      (signoff) => { signoff.status = "PENDING"; },
    ),
    expectedStatus: 1,
    expectedMessage: /PENDING observation must not contain partial or self-asserted completion evidence/u,
  },
];

for (const probe of probes) runProbe(probe);

console.log(
  `IAT V2 observation regression passed: both canonical validators and ${probes.length - 2} adversarial mutations fail closed without changing canonical evidence. Historical feature evidence remains historical; current-source and Mainnet authorization remain HOLD.`,
);
