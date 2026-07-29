/*
 * STAR ASCENT CHANGE-FREEZE MANIFEST VALIDATOR
 * Version 0.1 — 27 July 2026
 *
 * LOCAL, DETERMINISTIC QA ONLY. This module hashes a supplied public bundle
 * and compares it with a human-approved manifest. It makes no network calls,
 * inspects no wallet or Solana state, handles no secrets or payments, and
 * cannot approve a launch or change HOLD to READY.
 */

import { createHash } from "node:crypto";

function requireRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function requireText(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be non-empty text`);
  }
  return value.trim();
}

function requireUtcTimestamp(value, label) {
  const timestamp = requireText(value, label);
  if (!timestamp.endsWith("Z") || !Number.isFinite(Date.parse(timestamp))) {
    throw new Error(`${label} must be a valid UTC timestamp ending in Z`);
  }
  return timestamp;
}

function readBundleFile(bundle, path) {
  const value = bundle instanceof Map ? bundle.get(path) : bundle?.[path];
  if (typeof value !== "string" && !(value instanceof Uint8Array)) {
    throw new TypeError(`missing or invalid frozen asset: ${path}`);
  }
  return value;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sortedBundlePaths(bundle) {
  const paths = bundle instanceof Map ? [...bundle.keys()] : Object.keys(requireRecord(bundle, "public bundle"));
  return paths.map((path) => requireText(path, "asset path")).sort();
}

export function createChangeFreezeManifest(bundle, frozenAtUtc) {
  const timestamp = requireUtcTimestamp(frozenAtUtc, "frozenAtUtc");

  const paths = sortedBundlePaths(bundle);
  if (paths.length === 0) {
    throw new Error("public bundle must contain at least one frozen asset");
  }

  return Object.freeze({
    lifecycle: "pre-launch",
    readinessDecision: "HOLD",
    frozenAtUtc: timestamp,
    assets: Object.freeze(paths.map((path) => Object.freeze({
      path,
      sha256: sha256(readBundleFile(bundle, path)),
    }))),
  });
}

export function validateChangeFreezeManifest(manifest, bundle) {
  const input = requireRecord(manifest, "change-freeze manifest");
  if (input.lifecycle !== "pre-launch") {
    throw new Error("lifecycle must remain pre-launch");
  }
  if (input.readinessDecision !== "HOLD") {
    throw new Error("readiness decision must remain HOLD");
  }
  const frozenAtUtc = requireUtcTimestamp(input.frozenAtUtc, "frozenAtUtc");
  if (!Array.isArray(input.assets) || input.assets.length === 0) {
    throw new TypeError("assets must be a non-empty array");
  }

  const expected = new Map();
  for (const [index, value] of input.assets.entries()) {
    const asset = requireRecord(value, `assets[${index}]`);
    const path = requireText(asset.path, `assets[${index}].path`);
    const digest = requireText(asset.sha256, `assets[${index}].sha256`).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(digest)) {
      throw new Error(`${path}.sha256 must be a 64-character hexadecimal digest`);
    }
    if (expected.has(path)) {
      throw new Error(`duplicate frozen asset path: ${path}`);
    }
    expected.set(path, digest);
  }

  const observedPaths = sortedBundlePaths(bundle);
  const unexpected = observedPaths.filter((path) => !expected.has(path));
  if (unexpected.length > 0) {
    throw new Error(`unexpected public asset outside freeze: ${unexpected[0]}`);
  }
  for (const path of expected.keys()) {
    if (!observedPaths.includes(path)) {
      throw new Error(`missing frozen asset: ${path}`);
    }
    if (sha256(readBundleFile(bundle, path)) !== expected.get(path)) {
      throw new Error(`content digest mismatch for frozen asset: ${path}`);
    }
  }

  return Object.freeze({
    assetCount: expected.size,
    digestAlgorithm: "sha256",
    frozenAtUtc,
    launchApproved: false,
    networkChecked: false,
    readinessDecision: "HOLD",
  });
}
