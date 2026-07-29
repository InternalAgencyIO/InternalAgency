import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const validatorPath = resolve(repoRoot, "scripts/validate-post-genesis-reconciliation.mjs");
const templatePath = resolve(repoRoot, "launch/post-genesis-reconciliation.template.json");
const template = JSON.parse(readFileSync(templatePath, "utf8"));

const validate = (record) => {
  const fixtureDirectory = mkdtempSync(resolve(tmpdir(), "star-ascent-reconciliation-"));
  const fixturePath = resolve(fixtureDirectory, "reconciliation.json");
  try {
    writeFileSync(fixturePath, `${JSON.stringify(record, null, 2)}\n`);
    return spawnSync(process.execPath, [validatorPath, fixturePath], {
      cwd: repoRoot,
      encoding: "utf8",
    });
  } finally {
    rmSync(fixtureDirectory, { recursive: true, force: true });
  }
};

test("post-Genesis reconciliation accepts the canonical HOLD template", () => {
  const result = validate(template);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /structure passes/);
});

test("post-Genesis reconciliation rejects unreviewed or credential-bearing record content", () => {
  const extraField = structuredClone(template);
  extraField.reconciliation.operatorNote = "unreviewed assertion";
  const extraFieldResult = validate(extraField);
  assert.notEqual(extraFieldResult.status, 0);
  assert.match(extraFieldResult.stderr, /exactly the reviewed archive fields/);

  const credentialValue = structuredClone(template);
  credentialValue.reconciliation.archiveOwnerLabel = "seed phrase must never be recorded here";
  const credentialValueResult = validate(credentialValue);
  assert.notEqual(credentialValueResult.status, 0);
  assert.match(credentialValueResult.stderr, /credential-bearing field names or values/);
});
