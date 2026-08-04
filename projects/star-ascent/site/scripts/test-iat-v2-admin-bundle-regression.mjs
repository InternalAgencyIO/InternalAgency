import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const distRoot = resolve(process.cwd(), "tools/iat-v2-admin-console/dist");
const assetsRoot = resolve(distRoot, "assets");
const html = readFileSync(resolve(distRoot, "index.html"), "utf8");
const assetNames = readdirSync(assetsRoot);
const size = (name) => statSync(resolve(assetsRoot, name)).size;
const exactlyOne = (pattern, label) => {
  const matches = assetNames.filter((name) => pattern.test(name));
  assert.equal(matches.length, 1, `expected one ${label} chunk, found ${matches.join(", ") || "none"}`);
  return matches[0];
};

const entryMatch = html.match(/src="\/assets\/(index-[^"]+\.js)"/u);
assert.ok(entryMatch, "admin HTML does not name one JavaScript entry chunk");
const entryChunk = entryMatch[1];
const featureChunk = exactlyOne(/^FeatureRehearsal-.*\.js$/u, "feature-rehearsal");
const trezorChunk = exactlyOne(/^lib-.*\.js$/u, "Trezor-only");
const upgradeChunk = exactlyOne(/^ProgramUpgrade-.*\.js$/u, "program-upgrade");

const budgets = {
  [entryChunk]: 1_100_000,
  [featureChunk]: 950_000,
  [trezorChunk]: 180_000,
  [upgradeChunk]: 15_000,
};
for (const [name, maximumBytes] of Object.entries(budgets)) {
  assert.ok(size(name) <= maximumBytes, `${name} is ${size(name)} bytes; budget is ${maximumBytes}`);
}

const javascript = assetNames
  .filter((name) => name.endsWith(".js"))
  .map((name) => readFileSync(resolve(assetsRoot, name), "utf8"))
  .join("\n");
for (const forbidden of [
  "__vite-browser-external",
  "externalized for browser compatibility",
]) {
  assert.equal(javascript.includes(forbidden), false, `admin bundle contains forbidden Node externalization marker: ${forbidden}`);
}

const entrySource = readFileSync(resolve(assetsRoot, entryChunk), "utf8");
const featureSource = readFileSync(resolve(assetsRoot, featureChunk), "utf8");
for (const marker of ["Unsupported hash algorithm", "nodejs.util.inspect.custom"]) {
  assert.equal(featureSource.includes(marker), true, `feature chunk lacks compatibility marker: ${marker}`);
}
assert.equal(entrySource.includes("Unsupported hash algorithm"), false, "SHA-256 compatibility code leaked into initial entry");

console.log(`IAT V2 admin bundle regression passed: entry ${size(entryChunk)} bytes, feature ${size(featureChunk)} bytes, Trezor ${size(trezorChunk)} bytes, upgrade ${size(upgradeChunk)} bytes; no Node externalization markers.`);
