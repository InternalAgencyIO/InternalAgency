import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SITE = fileURLToPath(new URL("../", import.meta.url));
const GENERATOR = fileURLToPath(new URL("../engagement/generate-epoch-manifest.mjs", import.meta.url));
const POLICY = fileURLToPath(new URL("../engagement/reward-policy.v1.json", import.meta.url));

test("the owner-directed v2 policy cannot publish a manifest before the global waterfall exists", () => {
  const directory = mkdtempSync(join(tmpdir(), "iat-reward-hold-"));
  try {
    const input = join(directory, "candidate.json");
    const output = join(directory, "manifest.json");
    writeFileSync(input, "{}\n");
    const result = spawnSync(
      process.execPath,
      [GENERATOR, input, POLICY, output],
      { cwd: SITE, encoding: "utf8" },
    );
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /v2 10\/90 policy requires a separate reviewed allocator-bound publisher/u);
    assert.equal(existsSync(output), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the committed policy and generator contain no hidden publication override", () => {
  const policy = JSON.parse(readFileSync(POLICY, "utf8"));
  const source = readFileSync(GENERATOR, "utf8");
  assert.equal(policy.publicationAllowed, false);
  assert.equal(policy.globalRewardWaterfall.implemented, false);
  assert.equal(policy.globalRewardWaterfall.publicationAllowed, false);
  assert.match(source, /policy\.schema !== "star-ascent-daily-rewards-policy\/v1"/u);
  assert.match(source, /policy\.publicationAllowed !== true/u);
  assert.match(source, /globalRewardWaterfall\?\.implemented !== true/u);
  assert.doesNotMatch(source, /process\.env|--force|allowHold|bypass/iu);
});

test("flipping the v2 HOLD flags cannot route 10/90 rewards through the legacy full-amount publisher", () => {
  const directory = mkdtempSync(join(tmpdir(), "iat-reward-schema-hold-"));
  try {
    const input = join(directory, "candidate.json");
    const policyPath = join(directory, "forged-v2-policy.json");
    const output = join(directory, "manifest.json");
    writeFileSync(input, "{}\n");
    const forged = JSON.parse(readFileSync(POLICY, "utf8"));
    forged.publicationAllowed = true;
    forged.globalRewardWaterfall.implemented = true;
    forged.globalRewardWaterfall.publicationAllowed = true;
    writeFileSync(policyPath, `${JSON.stringify(forged, null, 2)}\n`);
    const result = spawnSync(process.execPath, [GENERATOR, input, policyPath, output], { cwd: SITE, encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /v2 10\/90 policy requires a separate reviewed allocator-bound publisher/u);
    assert.equal(existsSync(output), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
