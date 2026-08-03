import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path));
const text = (path) => read(path).toString("utf8");
const json = (path) => JSON.parse(text(path));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const sourceConfig = json(".openai/hosting.json");
const builtConfig = json("dist/.openai/hosting.json");
assert.deepEqual(Object.keys(sourceConfig).sort(), ["d1", "project_id", "r2"]);
assert.match(sourceConfig.project_id, /^appgprj_[a-f0-9]{32}$/);
assert.equal(sourceConfig.d1, "DB");
assert.equal(sourceConfig.r2, null);
assert.deepEqual(builtConfig, sourceConfig, "built hosting config must exactly match its source");

const vite = text("vite.config.ts");
const plugin = text("build/sites-vite-plugin.ts");
const worker = text("worker/index.ts");
assert.match(vite, /sites\(\)/, "Sites packaging plugin must remain enabled");
assert.match(vite, /cloudflare\(\{/, "Cloudflare runtime plugin must remain enabled");
assert.match(vite, /binding:\s*d1/, "D1 binding must derive from hosting config");
assert.match(vite, /r2_buckets:\s*r2/, "R2 configuration must derive from hosting config");
assert.match(vite, /SITE_CREATOR_PLACEHOLDER_DATABASE_ID/, "local development must use the non-production placeholder database id");
assert.match(plugin, /cp\(hostingConfig, resolve\(outputDirectory, "hosting\.json"\)\)/);
assert.match(plugin, /cp\(drizzleSource, resolve\(outputDirectory, "drizzle"\)/);
assert.match(worker, /DB:\s*D1Database/, "worker binding type must expose the configured DB binding");

const sourceMigrations = readdirSync(resolve(root, "drizzle"), { withFileTypes: true })
  .filter((entry) => entry.isFile() && /^\d{4}_.+\.sql$/.test(entry.name))
  .map((entry) => entry.name)
  .sort();
const builtMigrations = readdirSync(resolve(root, "dist/.openai/drizzle"), { withFileTypes: true })
  .filter((entry) => entry.isFile() && /^\d{4}_.+\.sql$/.test(entry.name))
  .map((entry) => entry.name)
  .sort();
assert.ok(sourceMigrations.length > 0, "at least one D1 migration is required");
assert.deepEqual(builtMigrations, sourceMigrations, "built package must contain every D1 migration");
sourceMigrations.forEach((name, index) => {
  assert.equal(name.slice(0, 4), String(index).padStart(4, "0"), `migration sequence must be contiguous at ${name}`);
  assert.equal(sha256(read(`dist/.openai/drizzle/${name}`)), sha256(read(`drizzle/${name}`)), `${name} changed while packaging`);
});

const journal = json("drizzle/meta/_journal.json");
assert.equal(journal.entries.length, sourceMigrations.length, "Drizzle journal and migration count must agree");
assert.deepEqual(journal.entries.map((entry) => entry.idx), sourceMigrations.map((_, index) => index));

const publicConfigText = text(".openai/hosting.json");
assert.doesNotMatch(publicConfigText, /(?:api[_-]?key|access[_-]?token|private[_-]?key|password|secret)\s*[":=]/i);
assert.doesNotMatch(vite, /(?:api[_-]?key|access[_-]?token|private[_-]?key|password|secret)\s*[":=]\s*["'][^"']+["']/i);

console.log(`Site hosting config valid: project ${sourceConfig.project_id}, D1=${sourceConfig.d1}, R2=disabled, ${sourceMigrations.length} migrations packaged byte-for-byte.`);
