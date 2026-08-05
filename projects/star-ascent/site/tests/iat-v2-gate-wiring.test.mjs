import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const requiredOrder = [
  "npm run check:i18n:hydration-evidence",
  "npm run check:iat-v2-gate-wiring",
  "npm run check:i18n:provenance",
  "npm run check:i18n:provenance-regression",
  "node scripts/validate-iat-site-i18n-reconciliation.mjs",
];

function validateGate(script) {
  const commands = script.split(" && ");
  for (const required of requiredOrder) {
    assert.equal(
      commands.filter((command) => command === required).length,
      1,
      `IAT V2 gate must contain exactly one ${required}`,
    );
  }
  const positions = requiredOrder.map((required) => commands.indexOf(required));
  assert.deepEqual(positions, [...positions].sort((left, right) => left - right), "IAT V2 evidence gates are out of order");
}

test("IAT V2 validation directly enforces hydration and append-only localization provenance", () => {
  assert.equal(packageJson.scripts["check:iat-v2-gate-wiring"], "node --test tests/iat-v2-gate-wiring.test.mjs");
  assert.ok(packageJson.scripts.test.split(" && ").includes("npm run check:iat-v2-gate-wiring"));
  validateGate(packageJson.scripts["check:iat-v2"]);
});

test("gate wiring rejects missing, duplicate, or reordered provenance validation", () => {
  const canonical = packageJson.scripts["check:iat-v2"];
  for (const required of requiredOrder) {
    assert.throws(() => validateGate(canonical.replace(` && ${required}`, "")), /must contain exactly one/u);
  }
  assert.throws(
    () => validateGate(`${canonical} && npm run check:i18n:provenance`),
    /must contain exactly one/u,
  );
  assert.throws(
    () => validateGate(canonical
      .replace("npm run check:i18n:provenance && npm run check:i18n:provenance-regression", "PROVENANCE_PAIR")
      .replace("PROVENANCE_PAIR", "npm run check:i18n:provenance-regression && npm run check:i18n:provenance")),
    /out of order/u,
  );
});
