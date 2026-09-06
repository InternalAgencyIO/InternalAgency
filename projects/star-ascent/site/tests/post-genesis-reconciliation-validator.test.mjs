import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const validatorPath = resolve(repoRoot, "scripts/validate-post-genesis-reconciliation.mjs");
const templatePath = resolve(repoRoot, "launch/post-genesis-reconciliation.template.json");
const template = JSON.parse(readFileSync(templatePath, "utf8"));

const validateCanonical = () => spawnSync(process.execPath, [validatorPath], {
  cwd: repoRoot,
  encoding: "utf8",
});

test("post-Genesis reconciliation accepts the canonical HOLD template", () => {
  const result = validateCanonical();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /structure passes/);
});

test("post-Genesis reconciliation rejects extra, credential-bearing, and human-gate content", () => {
  assert.deepEqual(Object.keys(template.reconciliation), [
    "checkedAtUtc", "evidenceArchiveUrl", "publicChangelogUrl",
    "correctionStatus", "correctionRecords", "channelRecords",
  ]);
  assert.equal(template.controls.observationMode, "AUTOMATED_SOURCE_RECEIPT_STATE_OBSERVATION");
  assert.equal(template.controls.humanReviewerRequired, false);
  assert.equal(template.controls.noSelfAttestation, true);

  const regression = spawnSync(
    process.execPath,
    [resolve(repoRoot, "scripts/test-post-genesis-reconciliation-regression.mjs")],
    { cwd: repoRoot, encoding: "utf8" },
  );
  assert.equal(regression.status, 0, regression.stderr);
  assert.match(regression.stdout, /rejects an unreviewed extra reconciliation assertion/);
  assert.match(regression.stdout, /rejects credential-bearing archive evidence/);
  assert.match(regression.stdout, /rejects a human-review requirement injected into the archive gate/);
});
