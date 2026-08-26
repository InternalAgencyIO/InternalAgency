#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const root = resolve(".");
const validator = resolve("scripts/validate-iat-v2-current-source-clearance.mjs");
const baseline = JSON.parse(readFileSync(resolve("launch/iat-v2-current-source-clearance.json"), "utf8"));
const sandbox = mkdtempSync(join(tmpdir(), "iat-v2-current-source-clearance-"));
const recordPath = "launch/iat-v2-current-source-clearance.json";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const now = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString().replace(".000Z", "Z");

function write(relativePath, value) {
  const target = join(sandbox, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, typeof value === "string" || Buffer.isBuffer(value)
    ? value
    : `${JSON.stringify(value, null, 2)}\n`);
}
function validate(record) {
  write(recordPath, record);
  return spawnSync(process.execPath, [validator], { cwd: sandbox, encoding: "utf8" });
}
function expectPass(name, record) {
  const result = validate(record);
  if (result.status !== 0) throw new Error(`${name} should pass:\n${result.stderr}${result.stdout}`);
}
function expectFail(name, record, needle) {
  const result = validate(record);
  if (result.status === 0 || !`${result.stderr}${result.stdout}`.includes(needle)) {
    throw new Error(`${name} should fail with ${JSON.stringify(needle)}:\n${result.stderr}${result.stdout}`);
  }
}
function base58(bytes) {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let value = 0n;
  for (const byte of bytes) value = value * 256n + BigInt(byte);
  let encoded = "";
  while (value > 0n) {
    encoded = alphabet[Number(value % 58n)] + encoded;
    value /= 58n;
  }
  for (const byte of bytes) { if (byte === 0) encoded = `1${encoded}`; else break; }
  return encoded || "1";
}

try {
  expectPass("canonical HOLD", structuredClone(baseline));

  const statusOnly = structuredClone(baseline);
  statusOnly.status = "CLEAR";
  expectFail("status-only synthetic clearance", statusOnly, "CLEAR requires a full lowercase source commit");

  execFileSync("git", ["init", "-q"], { cwd: sandbox });
  execFileSync("git", ["config", "user.email", "clearance-test@internalagency.invalid"], { cwd: sandbox });
  execFileSync("git", ["config", "user.name", "Clearance Regression"], { cwd: sandbox });
  write("projects/star-ascent/site/programs/iat_v2/lib.rs", "pub fn current_source() {}\n");
  execFileSync("git", ["add", "projects/star-ascent/site/programs/iat_v2/lib.rs"], { cwd: sandbox });
  execFileSync("git", ["commit", "-q", "-m", "current source fixture"], { cwd: sandbox });
  const git = (...args) => execFileSync("git", args, { cwd: sandbox, encoding: "utf8" }).trim();
  const commit = git("rev-parse", "HEAD");
  const tree = git("rev-parse", "HEAD^{tree}");
  const programTree = git("rev-parse", "HEAD:projects/star-ascent/site/programs/iat_v2");
  const artifact = Buffer.from("reviewed current-source SBF fixture", "utf8");
  const programArtifactSha256 = sha256(artifact);
  const txSignature = base58(Buffer.from(Array.from({ length: 64 }, (_, index) => index + 1)));
  const definitions = {
    currentSourceSbf: ["CURRENT_SOURCE_REPRODUCIBLE_SBF", "build", [], "https://github.com/InternalAgencyIO/InternalAgency/actions/runs/1"],
    signedDevnetRehearsal: ["CURRENT_SOURCE_SIGNED_DEVNET_REHEARSAL", "devnet", [txSignature], `https://explorer.solana.com/tx/${txSignature}?cluster=devnet`],
    productionIdentityIntegration: ["PRODUCTION_IDENTITY_INTEGRATION_REHEARSAL", "production-integration", [], "https://internalagency.io/evidence/identity-integration"],
    automatedSecurityClosure: ["AUTOMATED_SECURITY_CLOSURE", "source", [], "https://internalagency.io/evidence/security-closure"],
  };
  const evidenceRefs = {};
  for (const [field, [predicate, network, transactionSignatures, receipt]] of Object.entries(definitions)) {
    const evidence = {
      schema: "iat-v2-current-source-direct-evidence/v1",
      predicate,
      observationMode: "AUTOMATED_SOURCE_BOUND_DIRECT_OBSERVATION",
      sourceCommit: commit,
      sourceTree: tree,
      programArtifactSha256,
      network,
      observedAtUtc: now,
      receipts: [receipt],
      transactionSignatures,
      checks: [],
    };
    const checkPath = `public/evidence/iat-v2/current-source/checks/${field}.json`;
    write(checkPath, {
      schema: "iat-v2-current-source-check-receipt/v1",
      predicate,
      checkId: "DIRECT_EVIDENCE",
      result: "PASS",
      sourceCommit: commit,
      programArtifactSha256,
      observedAtUtc: now,
      detailsSha256: sha256(Buffer.from(field)),
    });
    evidence.checks.push({
      id: "DIRECT_EVIDENCE",
      result: "PASS",
      evidencePath: checkPath,
      evidenceSha256: sha256(readFileSync(join(sandbox, checkPath))),
    });
    const path = `public/evidence/iat-v2/current-source/${field}.json`;
    write(path, evidence);
    evidenceRefs[field] = { predicate, path, sha256: sha256(readFileSync(join(sandbox, path))) };
  }

  const clear = structuredClone(baseline);
  clear.status = "CLEAR";
  Object.assign(clear.sourceBinding, {
    commit,
    tree,
    programTree,
    programArtifactSha256,
    programArtifactBytes: artifact.length,
    ciBuildEvidenceSha256: sha256(Buffer.from("missing canonical CI manifest")),
  });
  clear.evidence = evidenceRefs;
  for (const field of Object.keys(clear.clearance)) clear.clearance[field] = true;
  clear.observedAtUtc = now;
  expectFail("self-authored evidence cannot clear without CI provenance", clear, "canonical public-GitHub CI SBF provenance");

  const digestDrift = structuredClone(clear);
  digestDrift.evidence.currentSourceSbf.sha256 = "f".repeat(64);
  expectFail("evidence digest drift", digestDrift, "digest does not match its exact bytes");

  const devnetPath = clear.evidence.signedDevnetRehearsal.path;
  const devnet = JSON.parse(readFileSync(join(sandbox, devnetPath), "utf8"));
  devnet.transactionSignatures = [];
  write(devnetPath, devnet);
  const unsignedDevnet = structuredClone(clear);
  unsignedDevnet.evidence.signedDevnetRehearsal.sha256 = sha256(readFileSync(join(sandbox, devnetPath)));
  expectFail("unsigned Devnet evidence", unsignedDevnet, "requires finalized Solana transaction signatures");

  console.log("IAT V2 current-source clearance regression passed: historical HOLD remains valid, status-only and self-authored evidence cannot clear without canonical public-GitHub CI provenance and exact artifacts, while digest or signed-Devnet drift fails closed.");
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}
