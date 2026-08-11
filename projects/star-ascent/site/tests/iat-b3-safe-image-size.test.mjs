import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { imageSize } from "../vendor/image-size-safe/dist/index.mjs";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vendorRoot = path.join(siteRoot, "vendor", "image-size-safe");
const moduleUrl = pathToFileURL(path.join(vendorRoot, "dist", "index.mjs")).href;

const writeBox = (buffer, offset, size, name) => {
  buffer.writeUInt32BE(size, offset);
  buffer.write(name, offset + 4, 4, "ascii");
};

const malformedIcns = () => {
  const buffer = Buffer.alloc(16);
  buffer.write("icns", 0, 4, "ascii");
  buffer.writeUInt32BE(buffer.length, 4);
  writeBox(buffer, 8, 0, "ic07");
  return buffer;
};

const malformedJxl = () => {
  const buffer = Buffer.alloc(32);
  writeBox(buffer, 0, 12, "JXL ");
  writeBox(buffer, 12, 12, "ftyp");
  buffer.write("jxl ", 20, 4, "ascii");
  writeBox(buffer, 24, 0, "jxlp");
  return buffer;
};

const malformedHeif = () => {
  const buffer = Buffer.alloc(64);
  writeBox(buffer, 0, 12, "ftyp");
  buffer.write("heic", 8, 4, "ascii");
  writeBox(buffer, 12, 12, "meta");
  writeBox(buffer, 24, 8, "iprp");
  writeBox(buffer, 32, 24, "ipco");
  writeBox(buffer, 40, 0, "ispe");
  return buffer;
};

const assertRejectedWithoutHang = (buffer, label) => {
  const source = `import { imageSize } from ${JSON.stringify(moduleUrl)}; imageSize(Buffer.from(${JSON.stringify([...buffer])}));`;
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
    encoding: "utf8",
    timeout: 2_000,
  });
  assert.equal(result.error?.code, undefined, `${label} parser timed out`);
  assert.notEqual(result.status, 0, `${label} parser unexpectedly accepted malformed input`);
  assert.match(result.stderr, /Invalid|No codestream|sizes found/u, `${label} rejection was not explicit`);
};

const walkCode = async (directory) => {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walkCode(absolute));
    else if (/\.(?:cjs|mjs)$/u.test(entry.name)) output.push(absolute);
  }
  return output;
};

test("the pinned image-size package records both advisory patches", async () => {
  const manifest = JSON.parse(await readFile(path.join(vendorRoot, "package.json"), "utf8"));
  assert.equal(manifest.name, "image-size");
  assert.equal(manifest.version, "2.0.3");
  assert.equal(manifest.private, true);
  assert.deepEqual(manifest.iatSecurityPatch.advisories, [
    "GHSA-w3rx-r6r6-pgpr",
    "GHSA-5p2g-fcmc-qvqq",
  ]);
});

test("every bundled box parser rejects nonadvancing and undersized boxes", async () => {
  const files = await walkCode(path.join(vendorRoot, "dist"));
  let guardedParsers = 0;
  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /box\.size > 0 \? box\.size : 8/u, file);
    assert.doesNotMatch(source, /imageOffset \+= imageHeader\[1\]/u, file);
    if (source.includes("function readBox(input, offset)")) {
      guardedParsers++;
      assert.match(source, /input\.length - offset < 8/u, file);
      assert.match(source, /boxSize < 8/u, file);
    }
  }
  assert.equal(guardedParsers, 18);
});

test("malformed ICNS, JXL, and HEIF zero-length entries reject without blocking the event loop", () => {
  assertRejectedWithoutHang(malformedIcns(), "ICNS");
  assertRejectedWithoutHang(malformedJxl(), "JXL");
  assertRejectedWithoutHang(malformedHeif(), "HEIF");
});

test("normal PNG dimensions remain exact", () => {
  const png = Buffer.alloc(24);
  Buffer.from("89504e470d0a1a0a", "hex").copy(png, 0);
  png.writeUInt32BE(13, 8);
  png.write("IHDR", 12, 4, "ascii");
  png.writeUInt32BE(640, 16);
  png.writeUInt32BE(360, 20);
  assert.deepEqual(imageSize(png), { width: 640, height: 360, type: "png" });
});
