import assert from "node:assert/strict";
import { createHash as createNodeHash } from "node:crypto";
import test from "node:test";

import { createHash } from "../tools/iat-v2-admin-console/crypto-browser-shim.mjs";
import { inspect } from "../tools/iat-v2-admin-console/util-browser-shim.mjs";

const vectors = [
  "",
  "abc",
  "IAT V2 browser compatibility",
  "blockhash-example:1785690000000",
];

test("SHA-256 browser compatibility matches Node for known message shapes", () => {
  for (const message of vectors) {
    const expected = createNodeHash("sha256").update(message, "utf8").digest("hex");
    const actual = createHash("sha256").update(message, "utf8").digest("hex");
    assert.equal(actual, expected, message);
  }
});

test("SHA-256 browser compatibility preserves bytes and chunk boundaries", () => {
  const bytes = Uint8Array.from([0, 1, 2, 127, 128, 254, 255]);
  const expected = createNodeHash("sha256")
    .update(bytes.subarray(0, 3))
    .update(bytes.subarray(3))
    .digest("hex");
  const digest = createHash("sha256")
    .update(bytes.subarray(0, 3))
    .update(bytes.subarray(3))
    .digest();
  assert.ok(digest instanceof Uint8Array);
  assert.equal(Buffer.from(digest).toString("hex"), expected);
});

test("SHA-256 browser compatibility fails closed outside its narrow contract", () => {
  assert.throws(() => createHash("sha512"), /Unsupported hash algorithm/);
  assert.throws(() => createHash("sha256").update("abc", "latin1"), /Unsupported string encoding/);
  assert.throws(() => createHash("sha256").update({}), /Hash input must/);

  const hash = createHash("sha256").update("abc");
  hash.digest();
  assert.throws(() => hash.update("def"), /already finalized/);
  assert.throws(() => hash.digest(), /already finalized/);
});

test("util compatibility exposes Node's inspect.custom symbol and safe debug text", () => {
  assert.equal(inspect.custom, Symbol.for("nodejs.util.inspect.custom"));
  assert.equal(inspect({ slot: 7n, bytes: Uint8Array.from([1, 2]) }), '{"slot":"7n","bytes":[1,2]}');

  const circular = { quote: "draft" };
  circular.self = circular;
  assert.equal(inspect(circular), '{"quote":"draft","self":"[Circular]"}');
});
