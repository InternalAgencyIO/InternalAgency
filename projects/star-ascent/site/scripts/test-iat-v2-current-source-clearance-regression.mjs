#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { INDEPENDENT_SECURITY_SOURCE_PATHS } from "./lib/iat-v2-independent-security-evidence.mjs";

const root = resolve(".");
const repositoryRoot = resolve(root, "../../..");
const validator = resolve("scripts/validate-iat-v2-current-source-clearance.mjs");
const validatorSource = readFileSync(validator, "utf8");
const baselineBytes = readFileSync(resolve("launch/iat-v2-current-source-clearance.json"));
const baseline = JSON.parse(baselineBytes);
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
function validateBytes(bytes) {
  write(recordPath, bytes);
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
function expectRawFail(name, bytes, needle) {
  const result = validateBytes(bytes);
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
  if (!/const evaluationUnixSeconds = BigInt\(Math\.floor\(Date\.now\(\) \/ 1_000\)\);/u.test(validatorSource)) {
    throw new Error("predicate freshness must use the current evaluation time, not a self-authored record time");
  }
  expectPass("canonical HOLD", structuredClone(baseline));
  expectRawFail(
    "duplicate canonical record member",
    Buffer.from(baselineBytes.toString("utf8").replace(
      '  "schema": "iat-v2-current-source-clearance/v1",',
      '  "schema": "iat-v2-current-source-clearance/v1",\n  "schema": "iat-v2-current-source-clearance/v1",',
    )),
    "duplicate JSON member $root.schema",
  );

  const statusOnly = structuredClone(baseline);
  statusOnly.status = "CLEAR";
  expectFail("status-only synthetic clearance", statusOnly, "CLEAR requires a full lowercase source commit");

  execFileSync("git", ["init", "-q"], { cwd: sandbox });
  execFileSync("git", ["config", "user.email", "clearance-test@internalagency.invalid"], { cwd: sandbox });
  execFileSync("git", ["config", "user.name", "Clearance Regression"], { cwd: sandbox });
  write("projects/star-ascent/site/programs/iat_v2/lib.rs", "pub fn current_source() {}\n");
  for (const path of INDEPENDENT_SECURITY_SOURCE_PATHS) {
    write(path, execFileSync("git", ["show", `HEAD:${path}`], { cwd: repositoryRoot, encoding: "buffer" }));
  }
  write(
    "projects/star-ascent/site/docs/b3/iat-v2-production-identity-integration-trust.v1.json",
    readFileSync(resolve(root, "docs/b3/iat-v2-production-identity-integration-trust.v1.json")),
  );
  execFileSync("git", ["add", "."], { cwd: sandbox });
  execFileSync("git", ["commit", "-q", "-m", "current source fixture"], { cwd: sandbox });
  const git = (...args) => execFileSync("git", args, { cwd: sandbox, encoding: "utf8" }).trim();
  const commit = git("rev-parse", "HEAD");
  const tree = git("rev-parse", "HEAD^{tree}");
  const programTree = git("rev-parse", "HEAD:projects/star-ascent/site/programs/iat_v2");
  const artifact = Buffer.from("reviewed current-source SBF fixture", "utf8");
  const programArtifactSha256 = sha256(artifact);
  const txSignature = base58(Buffer.from(Array.from({ length: 64 }, (_, index) => index + 1)));
  const productionIdentityPredicateBytes = Buffer.from("{}\n");
  const independentSecurityPredicateBytes = Buffer.from("{}\n");
  write(
    "target/identity-integration/iat-v2-production-identity-integration-evidence.json",
    productionIdentityPredicateBytes,
  );
  write("target/security/iat-v2-independent-security-evidence-v2.json", independentSecurityPredicateBytes);
  write("target/security/github-run-receipt.json", "{}\n");
  write("target/security/github-jobs-receipt.json", "{}\n");
  write("target/security/github-artifact-receipt.json", "{}\n");
  write("target/security/iat-v2-independent-security-evidence-v2.zip", Buffer.from("invalid archive"));
  const definitions = {
    currentSourceSbf: ["CURRENT_SOURCE_REPRODUCIBLE_SBF", "build", [], "https://github.com/InternalAgencyIO/InternalAgency/actions/runs/1", "DIRECT_EVIDENCE", sha256(Buffer.from("currentSourceSbf"))],
    signedDevnetRehearsal: ["CURRENT_SOURCE_SIGNED_DEVNET_REHEARSAL", "devnet", [txSignature], `https://explorer.solana.com/tx/${txSignature}?cluster=devnet`, "DIRECT_EVIDENCE", sha256(Buffer.from("signedDevnetRehearsal"))],
    productionIdentityIntegration: ["PRODUCTION_IDENTITY_INTEGRATION_REHEARSAL", "production-integration", [], "https://internalagency.io/evidence/identity-integration", "PRODUCTION_IDENTITY_STRUCTURE_CHECKED_HOLD", sha256(productionIdentityPredicateBytes)],
    automatedSecurityClosure: ["AUTOMATED_SECURITY_CLOSURE", "source", [], "https://internalagency.io/evidence/security-closure", "INDEPENDENT_SECURITY_STRUCTURE_CHECKED_HOLD", sha256(independentSecurityPredicateBytes)],
  };
  const evidenceRefs = {};
  for (const [field, [predicate, network, transactionSignatures, receipt, checkId, detailsSha256]] of Object.entries(definitions)) {
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
      checkId,
      result: "PASS",
      sourceCommit: commit,
      programArtifactSha256,
      observedAtUtc: now,
      detailsSha256,
    });
    evidence.checks.push({
      id: checkId,
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

  const duplicateCiManifestBytes = Buffer.from('{"schema":"one","schema":"two"}\n');
  write("target/verifiable/iat-v2-build-evidence.json", duplicateCiManifestBytes);
  const duplicateCiManifest = structuredClone(clear);
  duplicateCiManifest.sourceBinding.ciBuildEvidenceSha256 = sha256(duplicateCiManifestBytes);
  expectFail(
    "duplicate CI manifest member",
    duplicateCiManifest,
    "CI build-evidence manifest: duplicate JSON member $root.schema",
  );
  rmSync(join(sandbox, "target/verifiable/iat-v2-build-evidence.json"));

  expectFail("self-authored evidence cannot clear without CI provenance", clear, "canonical public-GitHub CI SBF provenance");
  expectFail(
    "self-authored identity integration cannot clear",
    clear,
    "production identity integration cannot clear until evidence freshness is anchored by an externally authenticated evaluation time",
  );
  expectFail(
    "caller-supplied security closure cannot clear",
    clear,
    "automated security closure cannot clear from caller-supplied GitHub JSON and archive bytes without direct authenticated hosted-state verification",
  );
  const sourceBoundTrustResult = validate(clear);
  write("docs/b3/iat-v2-production-identity-integration-trust.v1.json", "{}\n");
  const substitutedWorkingTrustResult = validate(clear);
  if (`${substitutedWorkingTrustResult.stderr}${substitutedWorkingTrustResult.stdout}`
    !== `${sourceBoundTrustResult.stderr}${sourceBoundTrustResult.stdout}`) {
    throw new Error("working-tree production trust substitution changed source-bound validation");
  }

  const identityEvidencePath = clear.evidence.productionIdentityIntegration.path;
  const identityEvidence = JSON.parse(readFileSync(join(sandbox, identityEvidencePath), "utf8"));
  const identityCheckPath = identityEvidence.checks[0].evidencePath;
  const originalIdentityCheckBytes = readFileSync(join(sandbox, identityCheckPath));
  const originalIdentityEvidenceBytes = readFileSync(join(sandbox, identityEvidencePath));

  const duplicateIdentityEvidenceBytes = Buffer.from(originalIdentityEvidenceBytes.toString("utf8").replace(
    '  "schema": "iat-v2-current-source-direct-evidence/v1",',
    '  "schema": "iat-v2-current-source-direct-evidence/v1",\n  "schema": "iat-v2-current-source-direct-evidence/v1",',
  ));
  write(identityEvidencePath, duplicateIdentityEvidenceBytes);
  const duplicateIdentityEvidence = structuredClone(clear);
  duplicateIdentityEvidence.evidence.productionIdentityIntegration.sha256 = sha256(duplicateIdentityEvidenceBytes);
  expectFail(
    "duplicate direct-evidence member",
    duplicateIdentityEvidence,
    "evidence.productionIdentityIntegration must be strict JSON",
  );
  write(identityEvidencePath, originalIdentityEvidenceBytes);

  const duplicateIdentityCheckBytes = Buffer.from(originalIdentityCheckBytes.toString("utf8").replace(
    '  "schema": "iat-v2-current-source-check-receipt/v1",',
    '  "schema": "iat-v2-current-source-check-receipt/v1",\n  "schema": "iat-v2-current-source-check-receipt/v1",',
  ));
  write(identityCheckPath, duplicateIdentityCheckBytes);
  const duplicateCheckEvidence = structuredClone(identityEvidence);
  duplicateCheckEvidence.checks[0].evidenceSha256 = sha256(duplicateIdentityCheckBytes);
  write(identityEvidencePath, duplicateCheckEvidence);
  const duplicateIdentityCheck = structuredClone(clear);
  duplicateIdentityCheck.evidence.productionIdentityIntegration.sha256 = sha256(readFileSync(join(sandbox, identityEvidencePath)));
  expectFail(
    "duplicate check-receipt member",
    duplicateIdentityCheck,
    "evidence.productionIdentityIntegration check evidence must be strict JSON",
  );
  write(identityCheckPath, originalIdentityCheckBytes);
  write(identityEvidencePath, originalIdentityEvidenceBytes);

  identityEvidence.checks[0].evidencePath = "public/evidence/iat-v2/current-source/checks/../../../../../outside.json";
  write(identityEvidencePath, identityEvidence);
  const checkPathTraversal = structuredClone(clear);
  checkPathTraversal.evidence.productionIdentityIntegration.sha256 = sha256(readFileSync(join(sandbox, identityEvidencePath)));
  expectFail(
    "check receipt path traversal",
    checkPathTraversal,
    "check path escapes the current-source checks directory",
  );
  identityEvidence.checks[0].evidencePath = identityCheckPath;
  write(identityEvidencePath, originalIdentityEvidenceBytes);

  const identityCheck = JSON.parse(originalIdentityCheckBytes);
  identityCheck.detailsSha256 = "e".repeat(64);
  write(identityCheckPath, identityCheck);
  identityEvidence.checks[0].evidenceSha256 = sha256(readFileSync(join(sandbox, identityCheckPath)));
  write(identityEvidencePath, identityEvidence);
  const identityDigestDrift = structuredClone(clear);
  identityDigestDrift.evidence.productionIdentityIntegration.sha256 = sha256(readFileSync(join(sandbox, identityEvidencePath)));
  expectFail(
    "production identity predicate digest drift",
    identityDigestDrift,
    "the exact predicate-specific evidence digest must be bound once",
  );
  write(identityCheckPath, originalIdentityCheckBytes);
  write(identityEvidencePath, originalIdentityEvidenceBytes);

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

  console.log("IAT V2 current-source clearance regression passed: historical HOLD remains valid; status-only, duplicate-member JSON, stale/unanchored X/D1, caller-supplied GitHub evidence, working-trust substitution, path traversal, digest drift, and unsigned evidence all fail closed.");
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}
