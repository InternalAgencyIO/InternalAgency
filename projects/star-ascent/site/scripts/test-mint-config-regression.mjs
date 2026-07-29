#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const generator = resolve("scripts/generate-mint-ceremony-config.mjs");
const output = resolve("app/mint/ceremony-config.generated.json");
const run = () => {
  const result = spawnSync(process.execPath, [generator], { encoding: "utf8" });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return readFileSync(output, "utf8");
};
const first = run();
const second = run();
assert.equal(second, first, "generated ceremony configuration must be deterministic");

const config = JSON.parse(first);
assert.equal(config.version, 1);
assert.deepEqual(config.transactionOrder, [
  "CREATE_INITIALIZE_IMMUTABLE_METADATA",
  "MINT_FIVE_ALLOCATION_DESTINATIONS",
  "REVOKE_MINT_AUTHORITY",
  "REVOKE_FREEZE_AUTHORITY",
]);
assert.equal(config.safety.localOperatorHostOnly, true);
assert.equal(config.safety.noAutomaticTransactions, true);
assert.equal(config.safety.noSecretPersistence, true);
assert.equal(config.networks.devnet.allocations.length, 5);
assert.equal(config.networks.mainnetBeta.allocations.length, 5);

for (const [name, path] of Object.entries(config.sourcePaths)) {
  const expected = createHash("sha256").update(readFileSync(resolve(path))).digest("hex");
  assert.equal(config.sourceDigests[name], expected, `${name} source digest must match`);
}
assert.equal(config.implementationPaths.length, 3);
for (const path of config.implementationPaths) {
  const expected = createHash("sha256").update(readFileSync(resolve(path))).digest("hex");
  assert.equal(config.implementationDigests[path], expected, `${path} implementation digest must match`);
}
assert.equal(
  config.implementationSha256,
  createHash("sha256").update(
    Object.entries(config.implementationDigests).map(([path, digest]) => `${path}:${digest}`).join("\n"),
  ).digest("hex"),
);
const { configurationSha256, ...body } = config;
assert.equal(
  configurationSha256,
  createHash("sha256").update(JSON.stringify(body)).digest("hex"),
  "configuration digest must bind every generated field",
);

if (config.status === "LOCKED") {
  assert.ok(config.blockers.length > 0);
  assert.ok(config.networks.mainnetBeta.allocations.every(({ owner }) => owner === null));
} else {
  assert.equal(config.status, "READY");
  assert.equal(config.blockers.length, 0);
  assert.ok(config.networks.mainnetBeta.allocations.every(({ owner }) => typeof owner === "string"));
}

const pageSource = readFileSync(resolve("app/mint/page.tsx"), "utf8");
assert.match(pageSource, /isLocalOperatorHost\(window\.location\.hostname\)/);
assert.doesNotMatch(pageSource, /signAndSendTransaction/);
assert.doesNotMatch(pageSource, /seedPhrase|privateKey|secretKey|mnemonic/i);
console.log("Mint configuration regression checks passed.");
