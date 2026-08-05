import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const siteRoot = process.cwd();
const distRoot = resolve(siteRoot, "tools/iat-v2-admin-console/dist");
const assetsRoot = resolve(distRoot, "assets");
const manifest = JSON.parse(readFileSync(resolve(distRoot, ".vite/manifest.json"), "utf8"));
const policy = JSON.parse(readFileSync(resolve(siteRoot, "public/audits/iat-v2-admin-lazy-boundary-20260805/policy.json"), "utf8"));
const assetNames = readdirSync(assetsRoot);
const normalize = (value) => value.replaceAll("\\", "/");
const size = (file) => statSync(resolve(distRoot, file)).size;

assert.equal(policy.schema, "iat-v2-admin-lazy-boundary-policy/v1", "unexpected admin lazy-boundary policy schema");
assert.equal(policy.status, "DRAFT_PARTIAL_REMEDIATION_QA_HOLD", "admin lazy-boundary policy must remain QA HOLD");
assert.equal(policy.mainnetStatus, "UNSCHEDULED_HOLD", "admin lazy-boundary policy must keep Mainnet unscheduled HOLD");
assert.equal(policy.buildManifestRequired, true, "admin build manifest cannot be optional");
assert.deepEqual(policy.boundaries.inspectionEntryStaticClosureExcludes, [
  "FEATURE_REHEARSAL",
  "PROGRAM_UPGRADE",
  "TREZOR_CONNECT",
  "SWITCHBOARD_ON_DEMAND",
], "inspection-entry exclusion policy drifted");
assert.deepEqual(policy.boundaries.featureShellStaticClosureExcludes, ["SWITCHBOARD_ON_DEMAND"], "feature-shell exclusion policy drifted");
assert.deepEqual(policy.boundaries.featureShellDynamicImports, ["SWITCHBOARD_ON_DEMAND"], "feature-shell dynamic policy drifted");
assert.equal(policy.baseline.priorCombinedFeatureChunkBytes, 912_348, "feature baseline drifted");
for (const value of Object.values(policy.assurance)) {
  assert.equal(value, false, "admin lazy-boundary policy cannot grant operational clearance");
}

const entries = Object.entries(manifest);
const exactlyOneEntry = (predicate, label) => {
  const matches = entries.filter(([key, value]) => predicate(normalize(key), value));
  assert.equal(matches.length, 1, `expected one ${label} manifest entry, found ${matches.map(([key]) => key).join(", ") || "none"}`);
  return matches[0];
};

const [entryKey, entry] = exactlyOneEntry((_key, value) => value.isEntry === true, "admin entry");
const [featureKey, feature] = exactlyOneEntry((key) => key === "FeatureRehearsal.jsx", "feature shell");
const [upgradeKey, upgrade] = exactlyOneEntry((key) => key === "ProgramUpgrade.jsx", "program upgrade");
const [trezorKey, trezor] = exactlyOneEntry((key) => key.endsWith("/node_modules/@trezor/connect-web/lib/index.js"), "Trezor Connect");
const [switchboardKey, switchboard] = exactlyOneEntry((key) => key.endsWith("/node_modules/@switchboard-xyz/on-demand/dist/esm/index.js"), "Switchboard on-demand");

for (const [label, value] of [["feature shell", feature], ["program upgrade", upgrade], ["Trezor Connect", trezor], ["Switchboard on-demand", switchboard]]) {
  assert.equal(value.isDynamicEntry, true, `${label} must remain a dynamic entry`);
}

const staticClosure = (rootKey) => {
  const visited = new Set();
  const pending = [...(manifest[rootKey].imports ?? [])];
  while (pending.length > 0) {
    const key = pending.pop();
    if (visited.has(key)) continue;
    assert.ok(manifest[key], `manifest import ${key} is missing`);
    visited.add(key);
    pending.push(...(manifest[key].imports ?? []));
  }
  return visited;
};

const operatorEntries = new Set([featureKey, upgradeKey, trezorKey, switchboardKey]);
const entryStaticClosure = staticClosure(entryKey);
for (const key of operatorEntries) {
  assert.equal(entryStaticClosure.has(key), false, `inspection entry statically imports operator-only surface ${key}`);
}
assert.ok(entry.dynamicImports?.includes(featureKey), "feature shell must be a direct lazy entry");
assert.ok(entry.dynamicImports?.includes(upgradeKey), "program upgrade must be a direct lazy entry");
assert.ok(entry.dynamicImports?.includes(trezorKey), "Trezor Connect must be a direct lazy entry");
assert.equal(entry.dynamicImports?.includes(switchboardKey), false, "inspection entry must not directly import Switchboard");

const featureStaticClosure = staticClosure(featureKey);
assert.equal(featureStaticClosure.has(switchboardKey), false, "feature shell statically imports Switchboard");
assert.ok(feature.dynamicImports?.includes(switchboardKey), "feature shell must defer Switchboard to a second dynamic boundary");

const budgets = policy.byteBudgets;
const measured = {
  initialEntry: size(entry.file),
  featureShell: size(feature.file),
  switchboardOnDemand: size(switchboard.file),
  trezorConnect: size(trezor.file),
  programUpgrade: size(upgrade.file),
};
for (const [name, bytes] of Object.entries(measured)) {
  const maximum = budgets[`${name}Maximum`];
  assert.ok(Number.isSafeInteger(maximum), `missing byte budget for ${name}`);
  assert.ok(bytes <= maximum, `${name} is ${bytes} bytes; budget is ${maximum}`);
}

const javascript = assetNames
  .filter((name) => name.endsWith(".js"))
  .map((name) => readFileSync(resolve(assetsRoot, name), "utf8"))
  .join("\n");
for (const forbidden of ["__vite-browser-external", "externalized for browser compatibility"]) {
  assert.equal(javascript.includes(forbidden), false, `admin bundle contains forbidden Node externalization marker: ${forbidden}`);
}

const entrySource = readFileSync(resolve(distRoot, entry.file), "utf8");
const switchboardSource = readFileSync(resolve(distRoot, switchboard.file), "utf8");
for (const marker of ["Unsupported hash algorithm", "nodejs.util.inspect.custom"]) {
  assert.equal(switchboardSource.includes(marker), true, `Switchboard chunk lacks compatibility marker: ${marker}`);
}
assert.equal(entrySource.includes("Unsupported hash algorithm"), false, "SHA-256 compatibility code leaked into initial entry");

const featureReductionPercent = ((1 - (measured.featureShell / policy.baseline.priorCombinedFeatureChunkBytes)) * 100).toFixed(2);
console.log(
  `IAT V2 admin bundle regression passed: entry ${measured.initialEntry} bytes, feature shell ${measured.featureShell} bytes ` +
    `(${featureReductionPercent}% below the prior ${policy.baseline.priorCombinedFeatureChunkBytes}-byte combined feature chunk), ` +
    `Switchboard ${measured.switchboardOnDemand} bytes, ` +
    `Trezor ${measured.trezorConnect} bytes, upgrade ${measured.programUpgrade} bytes; all operator surfaces remain outside the entry static closure.`,
);
