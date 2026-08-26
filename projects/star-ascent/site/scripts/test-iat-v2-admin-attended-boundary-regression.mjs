import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const sourceRoot = process.cwd();
const runner = resolve(sourceRoot, "scripts/test-iat-v2-admin-bundle-regression.mjs");
const sandbox = mkdtempSync(join(tmpdir(), "iat-v2-admin-attended-boundary-"));
const fixtureRoot = join(sandbox, "fixture");

function copy(relativePath) {
  const source = resolve(sourceRoot, relativePath);
  const target = resolve(fixtureRoot, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
}

function readJson(root, relativePath) {
  return JSON.parse(readFileSync(resolve(root, relativePath), "utf8"));
}

function writeJson(root, relativePath, value) {
  writeFileSync(resolve(root, relativePath), `${JSON.stringify(value, null, 2)}\n`);
}

function run(root) {
  return spawnSync(process.execPath, [runner], {
    cwd: sourceRoot,
    env: { ...process.env, IAT_V2_ADMIN_BUNDLE_SITE_ROOT: root },
    encoding: "utf8",
  });
}

function mutate(label, callback, expected) {
  const root = join(sandbox, label);
  cpSync(fixtureRoot, root, { recursive: true });
  callback(root);
  const result = run(root);
  assert.notEqual(result.status, 0, `${label} unexpectedly passed`);
  assert.match(`${result.stdout}\n${result.stderr}`, expected, `${label} failed for the wrong reason`);
}

try {
  copy("tools/iat-v2-admin-console/dist");
  copy("tools/iat-v2-admin-console/ProgramUpgrade.jsx");
  copy("tools/iat-v2-admin-console/ProgramUpgradeAttendedActions.jsx");
  copy("public/audits/iat-v2-admin-lazy-boundary-20260805/policy.json");
  copy("public/audits/iat-v2-admin-lazy-boundary-20260826/policy.json");

  const baseline = run(fixtureRoot);
  assert.equal(baseline.status, 0, baseline.stderr || baseline.stdout);

  const manifestPath = "tools/iat-v2-admin-console/dist/.vite/manifest.json";
  const policyPath = "public/audits/iat-v2-admin-lazy-boundary-20260826/policy.json";
  const sourcePath = "tools/iat-v2-admin-console/ProgramUpgrade.jsx";
  const aggregateMaximum = readJson(fixtureRoot, policyPath)
    .byteBudgets.programUpgradeIncrementalClosureMaximum;
  const locate = (manifest) => ({
    entryKey: Object.keys(manifest).find((key) => manifest[key].isEntry === true),
    upgradeKey: Object.keys(manifest).find((key) => manifest[key].src === "ProgramUpgrade.jsx"),
    attendedKey: Object.keys(manifest).find((key) => manifest[key].src === "ProgramUpgradeAttendedActions.jsx"),
    featureKey: Object.keys(manifest).find((key) => manifest[key].src === "FeatureRehearsal.jsx"),
    evidenceKey: Object.keys(manifest).find((key) => key.startsWith("_attended-evidence-")),
  });

  mutate("missing-attended-entry", (root) => {
    const manifest = readJson(root, manifestPath);
    const { attendedKey } = locate(manifest);
    delete manifest[attendedKey];
    writeJson(root, manifestPath, manifest);
  }, /expected one program upgrade attended actions manifest entry/u);

  mutate("duplicate-attended-entry", (root) => {
    const manifest = readJson(root, manifestPath);
    const { attendedKey } = locate(manifest);
    manifest["duplicate-attended-actions.jsx"] = { ...manifest[attendedKey] };
    writeJson(root, manifestPath, manifest);
  }, /expected one program upgrade attended actions manifest entry, found/u);

  mutate("eager-shell-edge", (root) => {
    const manifest = readJson(root, manifestPath);
    const { attendedKey, upgradeKey } = locate(manifest);
    manifest[upgradeKey].imports.push(attendedKey);
    writeJson(root, manifestPath, manifest);
  }, /program upgrade shell statically imports attended actions/u);

  mutate("eager-transaction-builder-edge", (root) => {
    const path = resolve(root, sourcePath);
    const source = readFileSync(path, "utf8");
    writeFileSync(path, `import { buildProgramDataExtensionTransaction } from "./program-extension-attended.mjs";\n${source}`);
  }, /program upgrade shell source imports attended transaction construction/u);

  mutate("direct-inspection-edge", (root) => {
    const manifest = readJson(root, manifestPath);
    const { attendedKey, entryKey } = locate(manifest);
    manifest[entryKey].dynamicImports.push(attendedKey);
    writeJson(root, manifestPath, manifest);
  }, /inspection entry must not directly import attended program actions/u);

  mutate("extra-shell-dynamic-edge", (root) => {
    const manifest = readJson(root, manifestPath);
    const { featureKey, upgradeKey } = locate(manifest);
    manifest[upgradeKey].dynamicImports.push(featureKey);
    writeJson(root, manifestPath, manifest);
  }, /program upgrade shell must have exactly one attended-actions dynamic edge/u);

  mutate("missing-attended-budget", (root) => {
    const policy = readJson(root, policyPath);
    delete policy.byteBudgets.programUpgradeAttendedMaximum;
    writeJson(root, policyPath, policy);
  }, /missing byte budget for programUpgradeAttended/u);

  mutate("aggregate-overflow", (root) => {
    const manifest = readJson(root, manifestPath);
    const { evidenceKey } = locate(manifest);
    appendFileSync(
      resolve(root, "tools/iat-v2-admin-console/dist", manifest[evidenceKey].file),
      "x".repeat(aggregateMaximum + 1),
    );
  }, new RegExp(`programUpgradeIncrementalClosure is \\d+ bytes; budget is ${aggregateMaximum}`, "u"));

  mutate("activation-bypass", (root) => {
    const path = resolve(root, sourcePath);
    const source = readFileSync(path, "utf8");
    writeFileSync(path, source.replace("setAttendedLoaded(true)", "setAttendedLoaded(false)"));
  }, /setAttendedLoaded/u);

  mutate("predecessor-tamper", (root) => {
    appendFileSync(resolve(root, "public/audits/iat-v2-admin-lazy-boundary-20260805/policy.json"), "\n");
  }, /successor policy must bind the immutable predecessor bytes/u);

  console.log("IAT V2 admin attended-boundary regression passed: baseline plus missing, duplicate, eager-action, eager-builder, direct, extra-edge, unbudgeted, aggregate-overflow, activation-bypass, and predecessor-tamper mutations fail closed.");
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}
