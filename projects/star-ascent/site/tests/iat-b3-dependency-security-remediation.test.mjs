import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  DEPENDENCY_SECURITY_SOURCE_BINDINGS,
  parseDependencySecurityRemediationJson,
  REMEDIATION_COMMIT,
  validateDependencySecurityRemediationManifest,
} from "../scripts/validate-iat-b3-dependency-security-remediation.mjs";

const SITE = resolve(import.meta.dirname, "..");
const REPOSITORY = resolve(SITE, "../../..");
const MANIFEST_PATH = resolve(
  SITE,
  "docs/b3/iat-b3-dependency-security-remediation.v1.json",
);
const SCHEMA_PATH = resolve(
  SITE,
  "docs/b3/iat-b3-dependency-security-remediation.v1.schema.json",
);
const MANIFEST_SOURCE = readFileSync(MANIFEST_PATH, "utf8");
const MANIFEST = parseDependencySecurityRemediationJson(MANIFEST_SOURCE, MANIFEST_PATH);
const BOUND_FILES = new Map(DEPENDENCY_SECURITY_SOURCE_BINDINGS.map((binding) => [
  binding.path,
  execFileSync("git", ["show", `${REMEDIATION_COMMIT}:${binding.path}`], {
    cwd: REPOSITORY,
    encoding: "buffer",
    maxBuffer: 8 * 1024 * 1024,
  }),
]));
const clone = (value) => structuredClone(value);

test("canonical dependency packet proves technical remediation while retaining independent-review HOLD", () => {
  const result = validateDependencySecurityRemediationManifest(MANIFEST, {
    boundFiles: BOUND_FILES,
  });
  assert.deepEqual(result.violations, []);
  assert.equal(result.valid, true);
  assert.equal(result.technicalRemediationComplete, true);
  assert.equal(result.zeroKnownVulnerabilitiesObserved, true);
  assert.equal(result.zeroUnacceptedDependencyFindings, false);
  assert.equal(result.completionPredicateSatisfied, false);
  assert.equal(result.independentReviewAccepted, false);
  assert.equal(result.activationReady, false);
  assert.equal(result.releaseAuthorizationVerified, false);
  assert.equal(result.mainnetExecutionAuthorized, false);
  assert.equal(result.mainnetStatus, "HOLD");
});

test("schema is Draft 2020-12, closed at the root, and canonical manifest has exact root inventory", () => {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(Object.keys(MANIFEST).sort(), [...schema.required].sort());
  for (const key of schema.required) assert.ok(Object.hasOwn(schema.properties, key));
});

test("packet binds the exact remediation commit and all committed source bytes", () => {
  assert.equal(
    execFileSync("git", ["rev-parse", REMEDIATION_COMMIT], { cwd: REPOSITORY, encoding: "utf8" }).trim(),
    REMEDIATION_COMMIT,
  );
  assert.equal(DEPENDENCY_SECURITY_SOURCE_BINDINGS.length, 17);
  assert.equal(BOUND_FILES.size, 17);
  assert.equal(validateDependencySecurityRemediationManifest(MANIFEST, {
    boundFiles: BOUND_FILES,
  }).valid, true);
});

test("packet rejects missing, altered, or working-tree-substituted source bytes", () => {
  assert.equal(validateDependencySecurityRemediationManifest(MANIFEST).valid, false);
  for (const binding of DEPENDENCY_SECURITY_SOURCE_BINDINGS) {
    const missing = new Map(BOUND_FILES);
    missing.delete(binding.path);
    assert.equal(validateDependencySecurityRemediationManifest(MANIFEST, {
      boundFiles: missing,
    }).valid, false, binding.path);
    const changed = new Map(BOUND_FILES);
    changed.set(binding.path, Buffer.concat([changed.get(binding.path), Buffer.from([0])]));
    assert.equal(validateDependencySecurityRemediationManifest(MANIFEST, {
      boundFiles: changed,
    }).valid, false, binding.path);
  }
});

test("packet rejects technical audit, commit, remediation, and source-binding drift", () => {
  for (const mutate of [
    (value) => { value.remediationCommit.sha = value.remediationCommit.parentSha; },
    (value) => { value.beforeRemediation.siteNpmHigh = 0; },
    (value) => { value.auditToolchain.rustSecDatabaseCommit = "0".repeat(40); },
    (value) => { value.auditObservations[0].vulnerabilityCount = 1; },
    (value) => { value.auditObservations[2].informationalWarningCount = 0; },
    (value) => { value.remediations.pop(); },
    (value) => { value.sourceBindings.reverse(); },
    (value) => { value.sourceBindings[0].sha256 = "0".repeat(64); },
  ]) {
    const hostile = clone(MANIFEST);
    mutate(hostile);
    assert.equal(validateDependencySecurityRemediationManifest(hostile, {
      boundFiles: BOUND_FILES,
    }).valid, false);
  }
});

test("unmaintained transitive bincode finding cannot be erased, accepted, or silently waived", () => {
  for (const mutate of [
    (value) => { value.informationalFindings = []; },
    (value) => { value.informationalFindings[0].accepted = true; },
    (value) => { value.informationalFindings[0].disposition = "ACCEPTED"; },
    (value) => { value.informationalFindings[0].patchedVersions = ["1.3.4"]; },
    (value) => { value.zeroUnacceptedDependencyFindings = true; },
    (value) => { value.completionPredicateSatisfied = true; },
  ]) {
    const hostile = clone(MANIFEST);
    mutate(hostile);
    assert.equal(validateDependencySecurityRemediationManifest(hostile, {
      boundFiles: BOUND_FILES,
    }).valid, false);
  }
});

test("packet rejects self-accepted review and every release or Mainnet overclaim", () => {
  for (const mutate of [
    (value) => { value.independentReview.accepted = true; },
    (value) => { value.independentReview.reviewerIdentity = "SELF"; },
    (value) => { value.activationReady = true; },
    (value) => { value.releaseAuthorizationVerified = true; },
    (value) => { value.mainnetExecutionAuthorized = true; },
    (value) => { value.mainnetStatus = "GO"; },
  ]) {
    const hostile = clone(MANIFEST);
    mutate(hostile);
    assert.equal(validateDependencySecurityRemediationManifest(hostile, {
      boundFiles: BOUND_FILES,
    }).valid, false);
  }
});

test("descriptor-safe validation rejects getters without invoking them and rejects non-JSON graphs", () => {
  let getterCalls = 0;
  const getter = clone(MANIFEST);
  Object.defineProperty(getter, "status", {
    enumerable: true,
    get() { getterCalls += 1; throw new Error("must not execute"); },
  });
  assert.equal(validateDependencySecurityRemediationManifest(getter, {
    boundFiles: BOUND_FILES,
  }).valid, false);
  assert.equal(getterCalls, 0);

  const hostileValues = [];
  const symbol = clone(MANIFEST);
  symbol[Symbol("hidden")] = true;
  hostileValues.push(symbol);
  const hidden = clone(MANIFEST);
  Object.defineProperty(hidden, "hidden", { enumerable: false, value: true });
  hostileValues.push(hidden);
  hostileValues.push(Object.assign(Object.create(null), clone(MANIFEST)));
  const alias = clone(MANIFEST);
  alias.scope.certifies = alias.scope.doesNotCertify;
  hostileValues.push(alias);
  const cycle = clone(MANIFEST);
  cycle.scope.loop = cycle;
  hostileValues.push(cycle);
  const unsafe = clone(MANIFEST);
  unsafe.auditObservations[0].dependencyCount = Number.MAX_SAFE_INTEGER + 1;
  hostileValues.push(unsafe);
  for (const hostile of hostileValues) {
    assert.equal(validateDependencySecurityRemediationManifest(hostile, {
      boundFiles: BOUND_FILES,
    }).valid, false);
  }
});

test("strict parser rejects top-level, nested, and escape-equivalent duplicate members", () => {
  for (const source of [
    '{"schema":"a","schema":"b"}',
    '{"scope":{"predicate":"a","predicate":"b"}}',
    '{"schema":"a","schem\\u0061":"b"}',
  ]) {
    assert.throws(
      () => parseDependencySecurityRemediationJson(source),
      /duplicate JSON member/u,
    );
  }
});

test("canonical CLI validates committed bytes but never satisfies the release predicate", () => {
  const run = spawnSync(
    process.execPath,
    [resolve(SITE, "scripts/validate-iat-b3-dependency-security-remediation.mjs"), MANIFEST_PATH],
    { cwd: SITE, encoding: "utf8" },
  );
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout);
  assert.equal(result.valid, true);
  assert.equal(result.technicalRemediationComplete, true);
  assert.equal(result.zeroUnacceptedDependencyFindings, false);
  assert.equal(result.completionPredicateSatisfied, false);
  assert.equal(result.mainnetExecutionAuthorized, false);
  assert.equal(result.mainnetStatus, "HOLD");
});
