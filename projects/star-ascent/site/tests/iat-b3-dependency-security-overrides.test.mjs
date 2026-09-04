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
const requireFromAnchor = createRequire(require.resolve("@coral-xyz/anchor"));
const requireFromAnchorAlias = createRequire(require.resolve("@coral-xyz/anchor-31"));

test("security overrides resolve to the exact reviewed dependency versions", async () => {
  const manifest = JSON.parse(await readFile(path.join(siteRoot, "package.json"), "utf8"));
  const lock = JSON.parse(await readFile(path.join(siteRoot, "package-lock.json"), "utf8"));

  assert.deepEqual(manifest.overrides["@esbuild-kit/core-utils"], { esbuild: "0.25.12" });
  assert.equal(manifest.overrides["fast-uri"], "3.1.6");
  assert.deepEqual(manifest.overrides.jayson, { uuid: "11.1.1" });
  assert.equal(manifest.overrides.toml, "4.2.0");
  assert.equal(lock.packages["node_modules/@esbuild-kit/core-utils/node_modules/esbuild"].version, "0.25.12");
  assert.equal(lock.packages["node_modules/fast-uri"].version, "3.1.6");
  assert.deepEqual(
    {
      version: lock.packages["node_modules/toml"].version,
      resolved: lock.packages["node_modules/toml"].resolved,
      integrity: lock.packages["node_modules/toml"].integrity,
      engines: lock.packages["node_modules/toml"].engines,
    },
    {
      version: "4.2.0",
      resolved: "https://registry.npmjs.org/toml/-/toml-4.2.0.tgz",
      integrity: "sha512-TvAJjbHZlYmI323+srtqHQFyJsoWy6mI09ppkuj9+iRsqsVKG9fvTcOP7FHF2UCb0QSYtjEavffrKzdd0XgClg==",
      engines: { node: ">=20" },
    },
  );
  assert.equal(lock.packages["node_modules/uuid"].version, "11.1.1");
  assert.equal(lock.packages["node_modules/rpc-websockets/node_modules/uuid"].version, "14.0.1");
  assert.equal(
    requireFromJayson.resolve("uuid"),
    path.join(siteRoot, "node_modules", "uuid", "dist", "cjs", "index.js"),
  );
  assert.equal(requireFromAnchor.resolve("toml"), path.join(siteRoot, "node_modules", "toml", "index.js"));
  assert.equal(requireFromAnchorAlias.resolve("toml"), path.join(siteRoot, "node_modules", "toml", "index.js"));
  assert.deepEqual(
    Object.keys(lock.packages).filter((packagePath) => packagePath.endsWith("node_modules/toml")),
    ["node_modules/toml"],
  );
});

test("Anchor's direct and aliased workspaces remain compatible with the bounded TOML replacement", async () => {
  const anchorToml = await readFile(path.join(siteRoot, "Anchor.toml"));
  const tomlCommonJs = requireFromAnchor("toml");
  const tomlEsm = await import("toml");

  const direct = tomlCommonJs.parse(anchorToml);
  const aliased = tomlEsm.parse(anchorToml);
  assert.deepEqual(aliased, direct);
  assert.equal(direct.provider.cluster, "Localnet");
  assert.match(direct.programs.localnet.iat_v2, /^[1-9A-HJ-NP-Za-km-z]{32,44}$/u);
});

test("TOML remediation rejects the reviewed prototype-pollution and recursion shapes", () => {
  const toml = requireFromAnchor("toml");
  const pollutionPayloads = [
    "[a.b]\ny = 1\n[a.b.y.__proto__.__proto__]\npolluted = \"yes\"\n",
    "aa = 1\n[[a]]\n[aa.__proto__.__proto__]\npolluted = \"yes\"\n",
    "[a.b]\ny = 1\n[a.b.y.__proto__.__proto__.code]\nval = \"arbitrary\"\n",
  ];
  for (const payload of pollutionPayloads) {
    delete Object.prototype.polluted;
    delete Object.prototype.code;
    assert.throws(() => toml.parse(payload), /Cannot redefine existing key/u);
    assert.equal(Object.prototype.polluted, undefined);
    assert.equal(Object.prototype.code, undefined);
  }

  const deeplyNested = `a=${"[".repeat(3_000)}1${"]".repeat(3_000)}`;
  assert.throws(
    () => toml.parse(deeplyNested),
    (error) => {
      assert.equal(error instanceof RangeError, false);
      assert.match(error.message, /Maximum nesting depth of 500 exceeded/u);
      return true;
    },
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
