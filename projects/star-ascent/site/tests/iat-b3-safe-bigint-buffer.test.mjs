import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vendorRoot = path.join(siteRoot, "vendor", "bigint-buffer-safe");
const installedRoot = path.join(siteRoot, "node_modules", "bigint-buffer");
const require = createRequire(import.meta.url);
const requireFromSolanaLayout = createRequire(require.resolve("@solana/buffer-layout-utils"));

test("the Solana layout dependency resolves to the repository-pinned pure JavaScript package", async () => {
  const manifest = JSON.parse(await readFile(path.join(vendorRoot, "package.json"), "utf8"));
  assert.equal(manifest.name, "bigint-buffer");
  assert.equal(manifest.version, "1.1.6");
  assert.equal(manifest.private, true);
  assert.equal(manifest.scripts, undefined);
  assert.equal(manifest.dependencies, undefined);

  const dependencyPath = requireFromSolanaLayout.resolve("bigint-buffer");
  assert.equal(path.normalize(dependencyPath), path.join(installedRoot, "index.cjs"));

  const source = await readFile(path.join(vendorRoot, "index.cjs"), "utf8");
  assert.equal(await readFile(path.join(installedRoot, "index.cjs"), "utf8"), source);
  assert.doesNotMatch(source, /bindings|node-gyp|\.node\b|allocUnsafe|child_process/u);

  const lock = JSON.parse(await readFile(path.join(siteRoot, "package-lock.json"), "utf8"));
  assert.equal(
    lock.packages["node_modules/bigint-buffer"].resolved,
    "file:vendor/bigint-buffer-1.1.6.tgz",
  );
  assert.match(lock.packages["node_modules/bigint-buffer"].integrity, /^sha512-[A-Za-z0-9+/]+={0,2}$/u);
  assert.equal(lock.packages["node_modules/@solana/buffer-layout-utils/node_modules/bigint-buffer"], undefined);
});

test("big-endian and little-endian conversions are exact and do not mutate input", () => {
  const { toBigIntBE, toBigIntLE, toBufferBE, toBufferLE } = requireFromSolanaLayout("bigint-buffer");
  const input = Buffer.from([0x12, 0x34, 0x56, 0x78]);
  const original = Buffer.from(input);

  assert.equal(toBigIntBE(input), 0x12345678n);
  assert.equal(toBigIntLE(input), 0x78563412n);
  assert.deepEqual(input, original);
  assert.deepEqual(toBufferBE(0x12345678n, 4), original);
  assert.deepEqual(toBufferLE(0x78563412n, 4), original);
  assert.equal(toBigIntBE(Buffer.alloc(0)), 0n);
  assert.equal(toBigIntLE(new Uint8Array()), 0n);
  assert.deepEqual(toBufferBE(0n, 0), Buffer.alloc(0));
});

test("invalid types, widths, negative integers, and truncating writes fail closed", () => {
  const { toBigIntBE, toBufferBE, toBufferLE } = requireFromSolanaLayout("bigint-buffer");
  assert.throws(() => toBigIntBE("00"), /Buffer or Uint8Array/u);
  assert.throws(() => toBufferBE(1, 1), /non-negative bigint/u);
  assert.throws(() => toBufferBE(-1n, 1), /non-negative bigint/u);
  assert.throws(() => toBufferBE(1n, -1), /non-negative safe integer/u);
  assert.throws(() => toBufferBE(1n, 1.5), /non-negative safe integer/u);
  assert.throws(() => toBufferBE(0x100n, 1), /does not fit/u);
  assert.throws(() => toBufferLE(0x1_0000_0000_0000_0000n, 8), /does not fit/u);
});

test("Solana u64 and u256 layouts retain exact round-trip behavior", () => {
  const { u64, u64be, u256 } = require("@solana/buffer-layout-utils");
  const vectors = [
    [u64(), 0x0123456789abcdefn, "efcdab8967452301"],
    [u64be(), 0x0123456789abcdefn, "0123456789abcdef"],
    [u256(), (1n << 255n) + 0x1234n, `3412${"00".repeat(29)}80`],
  ];

  for (const [layout, value, expectedHex] of vectors) {
    const encoded = Buffer.alloc(layout.span);
    assert.equal(layout.encode(value, encoded, 0), layout.span);
    assert.equal(encoded.toString("hex"), expectedHex);
    assert.equal(layout.decode(encoded), value);
  }
});
