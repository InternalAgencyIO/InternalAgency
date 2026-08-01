#!/usr/bin/env node

import assert from "node:assert/strict";
import { canonicalizeRfc8785, sha256CanonicalJson } from "./iat-v2-canonical-json.mjs";

const rfcNumberAndStringSample = {
  numbers: [333333333.33333329, 1E30, 4.50, 2e-3, 0.000000000000000000000000001],
  string: "€$\u000f\nA'B\"\\\"/",
  literals: [null, true, false],
};
assert.equal(
  canonicalizeRfc8785(rfcNumberAndStringSample),
  "{\"literals\":[null,true,false],\"numbers\":[333333333.3333333,1e+30,4.5,0.002,1e-27],\"string\":\"€$\\u000f\\nA'B\\\"\\\\\\\"/\"}",
  "RFC 8785 number and string serialization drifted",
);

const differentlyOrderedA = { z: 1, nested: { beta: true, alpha: "IAT" }, a: 2 };
const differentlyOrderedB = { a: 2, nested: { alpha: "IAT", beta: true }, z: 1 };
assert.equal(canonicalizeRfc8785(differentlyOrderedA), canonicalizeRfc8785(differentlyOrderedB));
assert.equal(sha256CanonicalJson(differentlyOrderedA), sha256CanonicalJson(differentlyOrderedB));
assert.notEqual(sha256CanonicalJson([1, 2]), sha256CanonicalJson([2, 1]));
assert.equal(canonicalizeRfc8785({ negativeZero: -0 }), '{"negativeZero":0}');

const unicodeOrdering = {
  "€": "Euro Sign",
  "\r": "Carriage Return",
  "דּ": "Hebrew Letter Dalet With Dagesh",
  "1": "One",
  "😀": "Emoji: Grinning Face",
  "\u0080": "Control",
  "ö": "Latin Small Letter O With Diaeresis",
};
const canonicalUnicodeOrdering = canonicalizeRfc8785(unicodeOrdering);
let priorKeyOffset = -1;
for (const key of ["\r", "1", "\u0080", "ö", "€", "😀", "דּ"]) {
  const offset = canonicalUnicodeOrdering.indexOf(`${JSON.stringify(key)}:`);
  assert.ok(offset > priorKeyOffset, `UTF-16 property sorting drifted at ${JSON.stringify(key)}`);
  priorKeyOffset = offset;
}

for (const [label, value, expected] of [
  ["undefined", { unsafe: undefined }, /unsupported undefined data/u],
  ["bigint", { unsafe: 1n }, /unsupported bigint data/u],
  ["non-finite", { unsafe: Number.POSITIVE_INFINITY }, /non-finite number/u],
  ["lone surrogate", { unsafe: "\uD800" }, /lone Unicode surrogate/u],
  ["non-plain object", { unsafe: new Date(0) }, /plain JSON objects/u],
]) {
  assert.throws(() => canonicalizeRfc8785(value), expected, label);
}
const sparse = [];
sparse.length = 1;
assert.throws(() => canonicalizeRfc8785(sparse), /sparse array entry/u);
const cyclic = {};
cyclic.self = cyclic;
assert.throws(() => canonicalizeRfc8785(cyclic), /contains a cycle/u);
const accessor = {};
Object.defineProperty(accessor, "unsafe", { enumerable: true, get: () => "dynamic" });
assert.throws(() => canonicalizeRfc8785(accessor), /must be a data property/u);
const hidden = {};
Object.defineProperty(hidden, "unsafe", { enumerable: false, value: "hidden" });
assert.throws(() => canonicalizeRfc8785(hidden), /non-enumerable data/u);
const extendedArray = [1];
extendedArray.label = "not JSON";
assert.throws(() => canonicalizeRfc8785(extendedArray), /non-JSON array properties/u);
const symbolKeyed = { safe: true, [Symbol("unsafe")]: false };
assert.throws(() => canonicalizeRfc8785(symbolKeyed), /symbol keys/u);

console.log("IAT V2 RFC 8785 canonical JSON regression passes: official serialization, UTF-16 sorting, stable digests, and fail-closed non-I-JSON inputs.");
