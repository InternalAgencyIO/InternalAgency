import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const requireFromJayson = createRequire(require.resolve("jayson"));

test("security overrides resolve to the exact reviewed dependency versions", async () => {
  const manifest = JSON.parse(await readFile(path.join(siteRoot, "package.json"), "utf8"));
  const lock = JSON.parse(await readFile(path.join(siteRoot, "package-lock.json"), "utf8"));

  assert.deepEqual(manifest.overrides["@esbuild-kit/core-utils"], { esbuild: "0.25.12" });
  assert.equal(manifest.overrides["fast-uri"], "3.1.6");
  assert.deepEqual(manifest.overrides.jayson, { uuid: "11.1.1" });
  assert.equal(lock.packages["node_modules/@esbuild-kit/core-utils/node_modules/esbuild"].version, "0.25.12");
  assert.equal(lock.packages["node_modules/fast-uri"].version, "3.1.6");
  assert.equal(lock.packages["node_modules/uuid"].version, "11.1.1");
  assert.equal(lock.packages["node_modules/rpc-websockets/node_modules/uuid"].version, "14.0.1");
  assert.equal(
    requireFromJayson.resolve("uuid"),
    path.join(siteRoot, "node_modules", "uuid", "dist", "cjs", "index.js"),
  );
});

test("jayson remains compatible with the bounded uuid replacement", () => {
  const generateRequest = require("jayson/lib/generateRequest");
  const request = generateRequest("getHealth", []);
  assert.deepEqual(Object.keys(request).sort(), ["id", "jsonrpc", "method", "params"]);
  assert.equal(request.method, "getHealth");
  assert.deepEqual(request.params, []);
  assert.equal(request.jsonrpc, "2.0");
  assert.match(request.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
});

test("esbuild-kit remains compatible with the bounded esbuild replacement", async () => {
  const { transform, transformSync } = await import("@esbuild-kit/core-utils");
  const source = "const answer: number = 42";
  assert.match((await transform(source, "fixture.ts")).code, /const answer=42;/u);
  assert.match(transformSync(source, "fixture.ts").code, /const answer=42;/u);
});

test("drizzle migration validation runs read-only with the remediated loader", () => {
  const result = spawnSync(
    process.execPath,
    [path.join(siteRoot, "node_modules", "drizzle-kit", "bin.cjs"), "check", "--config", "drizzle.config.ts"],
    { cwd: siteRoot, encoding: "utf8", timeout: 30_000 },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Everything's fine/u);
});
