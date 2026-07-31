/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  generateReviewManifest,
  reviewLeafSha256,
  reviewTreeRootSha256,
} from "../generate-review-manifest.mjs";
import { loadReviewManifest, validateReviewManifest } from "../validate-review-manifest.mjs";

const clone = (value) => structuredClone(value);
const manifest = loadReviewManifest();

test("review manifest deterministically covers every non-self proposal file", () => {
  assert.deepEqual(validateReviewManifest(manifest), []);
  assert.deepEqual(generateReviewManifest(), manifest);
  assert.equal(manifest.entries.some((entry) => entry.path === "review-manifest.v1.json"), false);
  assert.equal(manifest.selfReference.includedInTree, false);
  assert.match(manifest.selfReference.reason, /recursive fixed-point/);
});

test("all validator, generator, test, artifact, and supporting-source roles are represented", () => {
  const roles = new Set(manifest.entries.map((entry) => entry.role));
  assert.deepEqual(
    [...roles].sort(),
    ["ARTIFACT", "GENERATOR", "SUPPORTING_SOURCE", "TEST", "VALIDATOR"],
  );
  for (const role of roles) {
    assert.equal(
      manifest.summary.countsByRole[role],
      String(manifest.entries.filter((entry) => entry.role === role).length),
    );
  }
});

test("CRLF and LF checkouts produce the same normalized content address", () => {
  const root = mkdtempSync(join(tmpdir(), "iat-review-manifest-"));
  try {
    mkdirSync(join(root, "tests"));
    writeFileSync(join(root, "README.md"), "line one\r\nline two\r\n", "utf8");
    writeFileSync(join(root, "validate-sample.mjs"), "export const held = true;\r\n", "utf8");
    writeFileSync(join(root, "generate-sample.mjs"), "export const draft = true;\r\n", "utf8");
    writeFileSync(join(root, "source.mjs"), "export const network = 'NONE';\r\n", "utf8");
    writeFileSync(join(root, "tests", "sample.test.mjs"), "// held\r\n", "utf8");
    const crlf = generateReviewManifest(root);
    for (const entry of crlf.entries) {
      const path = join(root, ...entry.path.split("/"));
      writeFileSync(path, readFileSync(path, "utf8").replace(/\r\n/g, "\n"), "utf8");
    }
    const lf = generateReviewManifest(root);
    assert.deepEqual(lf, crlf);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("path order, content changes, lengths, and role changes alter or invalidate the root", () => {
  const reordered = clone(manifest);
  [reordered.entries[0], reordered.entries[1]] = [reordered.entries[1], reordered.entries[0]];
  assert.ok(validateReviewManifest(reordered).some((error) => error.includes("UTF-8 byte order")));

  const contentChanged = clone(manifest);
  contentChanged.entries[0].contentSha256 = "f".repeat(64);
  contentChanged.entries[0].leafSha256 = reviewLeafSha256(contentChanged.entries[0]);
  contentChanged.treeRootSha256 = reviewTreeRootSha256(contentChanged.entries);
  assert.ok(validateReviewManifest(contentChanged).some((error) => error.includes("deterministic generation")));

  const lengthChanged = clone(manifest);
  lengthChanged.entries[0].normalizedByteLength = String(BigInt(lengthChanged.entries[0].normalizedByteLength) + 1n);
  assert.ok(validateReviewManifest(lengthChanged).some((error) => error.includes("leaf digest drift")));

  const roleChanged = clone(manifest);
  roleChanged.entries[0].role = "VALIDATOR";
  assert.ok(validateReviewManifest(roleChanged).some((error) => error.includes("role drift")));
});

test("absolute, traversing, duplicate, malformed, and recursive-self entries fail closed", () => {
  const cases = [
    ["absolute", (draft) => { draft.entries[0].path = "/escape.md"; }, "absolute"],
    ["traversal", (draft) => { draft.entries[0].path = "../escape.md"; }, "traverses upward"],
    ["duplicate", (draft) => { draft.entries[1].path = draft.entries[0].path; }, "path collision"],
    ["malformed", (draft) => { draft.entries[0].contentSha256 = "ABC"; }, "digest malformed"],
    ["length", (draft) => { draft.entries[0].normalizedByteLength = "01"; }, "byte length is not canonical"],
    ["path type", (draft) => { draft.entries[0].path = null; }, "non-string path"],
    ["self", (draft) => { draft.entries[0].path = "review-manifest.v1.json"; }, "recursive self entry"],
  ];
  for (const [name, mutate, expected] of cases) {
    const draft = clone(manifest);
    mutate(draft);
    assert.ok(validateReviewManifest(draft).some((error) => error.includes(expected)), name);
  }
});

test("manifest status cannot claim deployment, a network, a program, or application", () => {
  const released = clone(manifest);
  released.status.network = "mainnet-beta";
  released.status.programId = "example-program";
  released.status.deployable = true;
  released.status.manifestApplied = true;
  const errors = validateReviewManifest(released);
  assert.ok(errors.includes("review manifest must remain network-free"));
  assert.ok(errors.includes("review manifest must not claim a program ID"));
  assert.ok(errors.includes("review manifest must remain undeployable"));
  assert.ok(errors.includes("review manifest must remain unapplied"));
});

test("manifest publishes only paths, roles, sizes, and hashes—not private evidence", () => {
  const allowedKeys = new Set([
    "path",
    "role",
    "normalizedByteLength",
    "contentSha256",
    "leafSha256",
  ]);
  for (const entry of manifest.entries) assert.deepEqual(new Set(Object.keys(entry)), allowedKeys);
  assert.doesNotMatch(
    JSON.stringify(manifest),
    /raw_x|x_user_id|x_handle|oauth|private_key|seed_phrase|mnemonic|signature/i,
  );
});
