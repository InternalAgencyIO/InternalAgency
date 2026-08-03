import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const iconFiles = [
  ["public/favicon.ico", [0x00, 0x00, 0x01, 0x00]],
  ["public/favicon-16x16.png", [0x89, 0x50, 0x4e, 0x47]],
  ["public/favicon-radiance-32.png", [0x89, 0x50, 0x4e, 0x47]],
  ["public/favicon-radiance-48.png", [0x89, 0x50, 0x4e, 0x47]],
  ["public/favicon-radiance-192.png", [0x89, 0x50, 0x4e, 0x47]],
  ["public/favicon-radiance-512.png", [0x89, 0x50, 0x4e, 0x47]],
  ["public/apple-touch-icon.png", [0x89, 0x50, 0x4e, 0x47]],
];

test("Radiance favicon family is complete and source-bound", async () => {
  for (const [relativePath, signature] of iconFiles) {
    const file = new URL(relativePath, root);
    const [metadata, content] = await Promise.all([stat(file), readFile(file)]);
    assert.ok(metadata.size > 100, `${relativePath} is unexpectedly small`);
    assert.deepEqual([...content.subarray(0, signature.length)], signature, `${relativePath} has the wrong file signature`);
  }
});

test("global metadata advertises standard favicon, Apple, and manifest fallbacks", async () => {
  const [layout, manifest] = await Promise.all([
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("public/site.webmanifest", root), "utf8").then(JSON.parse),
  ]);
  for (const path of [
    "/favicon.ico",
    "/favicon-16x16.png",
    "/favicon-radiance-32.png",
    "/favicon-radiance-48.png",
    "/favicon-radiance-192.png",
    "/favicon-radiance-512.png",
    "/apple-touch-icon.png",
    "/site.webmanifest",
  ]) assert.ok(layout.includes(path) || JSON.stringify(manifest).includes(path), `${path} is not advertised`);
  assert.match(layout, /shortcut:\s*["']\/favicon\.ico["']/, "shortcut icon must remain a string for vinext compatibility");
  assert.equal(manifest.icons.length, 2);
});
