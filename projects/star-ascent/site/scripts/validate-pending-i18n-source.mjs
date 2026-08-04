import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const repoRoot = join(root, "../../..");
const pending = JSON.parse(await readFile(join(root, "app/i18n/pending-visible-source.json"), "utf8"));
const catalogBytes = await readFile(join(root, "app/i18n/messages.json"));
const catalog = JSON.parse(catalogBytes.toString("utf8"));
const activeSources = new Set(Object.keys(catalog.messages.en));
const locales = Object.keys(catalog.messages);

assert.equal(pending.schema, "iat-pending-visible-i18n-source/v1");
assert.equal(pending.status, "DRAFT_TRANSLATION_AND_NATIVE_REVIEW_HOLD");
assert.equal(pending.sourceBinding.activeCatalogSha256, createHash("sha256").update(catalogBytes).digest("hex"));
assert.equal(execFileSync("git", ["cat-file", "-t", pending.sourceBinding.commit], { cwd: repoRoot, encoding: "utf8" }).trim(), "commit");
assert.equal(pending.capture.routeCount, 25);
assert.equal(pending.capture.routesWithPendingSource, Object.keys(pending.capture.byRoute).length);
assert.equal(pending.capture.pendingSourceCount, pending.sources.length);
assert.deepEqual(Object.keys(pending.localeWorkflow), locales);
assert.equal(pending.localeWorkflow.en, "SOURCE_CAPTURED_PENDING_RUNTIME_ACTIVATION");
for (const locale of locales.slice(1)) {
  assert.equal(pending.localeWorkflow[locale], "TRANSLATION_AND_NATIVE_REVIEW_REQUIRED");
}
assert.deepEqual(pending.runtime, {
  active: false,
  automaticEnglishFallbackApproved: false,
  translationComplete: false,
  nativeReviewComplete: false,
});

const sources = pending.sources.map(({ source }) => source);
assert.equal(new Set(sources).size, sources.length, "pending source inventory contains duplicates");
assert.deepEqual([...sources].sort((left, right) => left.localeCompare(right, "en")), sources, "pending source inventory is not stable-sorted");
for (const entry of pending.sources) {
  assert.ok(entry.source.trim().length >= 2 && /\p{L}/u.test(entry.source), `invalid pending source: ${entry.source}`);
  assert.equal(activeSources.has(entry.source), false, `pending source is already active: ${entry.source}`);
  assert.ok(entry.routes.length > 0, `pending source has no route: ${entry.source}`);
  assert.deepEqual([...new Set(entry.routes)].sort(), entry.routes, `pending route inventory is unstable for ${entry.source}`);
}
for (const [route, count] of Object.entries(pending.capture.byRoute)) {
  assert.equal(pending.sources.filter((entry) => entry.routes.includes(route)).length, count, `${route} pending count mismatch`);
}

console.log(`Pending i18n source valid: ${pending.sources.length} strings tracked for ${locales.length} locales; translation/native review HOLD; runtime inactive.`);
