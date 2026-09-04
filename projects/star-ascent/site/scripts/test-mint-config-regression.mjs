#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  normalizeTextForDigest,
  sha256CanonicalText,
  sha256CanonicalTextFile,
} from "./canonical-text-digest.mjs";

const generator = resolve("scripts/generate-mint-ceremony-config.mjs");
const output = resolve("app/mint/ceremony-config.generated.json");
const run = () => {
  const result = spawnSync(process.execPath, [generator], { encoding: "utf8" });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return readFileSync(output, "utf8");
};
const committed = readFileSync(output, "utf8");
const first = run();
assert.equal(
  first,
  committed,
  "tracked mint ceremony configuration is stale; regenerate and commit exact output",
);
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
  const expected = sha256CanonicalTextFile(resolve(path));
  assert.equal(config.sourceDigests[name], expected, `${name} source digest must match`);
}
assert.equal(config.implementationPaths.length, 3);
for (const path of config.implementationPaths) {
  const expected = sha256CanonicalTextFile(resolve(path));
  assert.equal(config.implementationDigests[path], expected, `${path} implementation digest must match`);
}

const lineEndingFixture = "first line\nsecond line\n";
assert.equal(
  sha256CanonicalText(lineEndingFixture),
  sha256CanonicalText(lineEndingFixture.replace(/\n/g, "\r\n")),
  "ceremony digests must be identical across LF and CRLF checkouts",
);
assert.equal(
  normalizeTextForDigest("first\rsecond\r\nthird\n"),
  "first\nsecond\nthird\n",
);
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
assert.match(pageSource, /const V2_MINT_ONLY_PATH_SUPERSEDED = true;/);
assert.match(pageSource, /disabled=\{V2_MINT_ONLY_PATH_SUPERSEDED\}/);
assert.doesNotMatch(pageSource, /@solana\/|window\.backpack|signTransaction|sendRawTransaction/);
assert.doesNotMatch(pageSource, /signAndSendTransaction/);
assert.doesNotMatch(pageSource, /seedPhrase|privateKey|secretKey|mnemonic/i);
console.log("Mint configuration regression checks passed.");
