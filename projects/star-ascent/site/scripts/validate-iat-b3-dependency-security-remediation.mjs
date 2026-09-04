#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DEPENDENCY_SECURITY_REMEDIATION_SCHEMA =
  "iat-b3-dependency-security-remediation/v2";
export const DEPENDENCY_SECURITY_REMEDIATION_STATUS =
  "TECHNICAL_REMEDIATION_COMPLETE_AUTOMATED_DIRECT_EVIDENCE_PENDING";
export const REMEDIATION_COMMIT = "57478cd8e2dff3e91cccbf976895f93b63b2cc9b";
export const REMEDIATION_PARENT = "1bc5155d0e3009b728e41b4b607113b0d253f210";

const SCRIPT_ROOT = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(SCRIPT_ROOT, "..");
const REPOSITORY_ROOT = resolve(SCRIPT_ROOT, "../../../..");
const DEFAULT_MANIFEST_PATH = resolve(
  SITE_ROOT,
  "docs/b3/iat-b3-dependency-security-remediation.v1.json",
);

const TOP_LEVEL_KEYS = Object.freeze([
  "$schema",
  "schema",
  "status",
  "scope",
  "remediationCommit",
  "sourceBindings",
  "observedAtUtc",
  "auditToolchain",
  "beforeRemediation",
  "auditObservations",
  "remediations",
  "informationalFindings",
  "automatedDirectEvidence",
  "technicalRemediationComplete",
  "zeroKnownVulnerabilitiesObserved",
  "zeroUnacceptedDependencyFindings",
  "completionPredicateSatisfied",
  "activationReady",
  "releaseAuthorizationVerified",
  "mainnetExecutionAuthorized",
  "mainnetStatus",
]);

const CERTIFIES = Object.freeze([
  "EXACT_REMEDIATION_COMMIT_AND_LOCKFILE_BINDING",
  "ZERO_NPM_AUDIT_VULNERABILITIES_AT_OBSERVATION",
  "ZERO_CARGO_AUDIT_VULNERABILITIES_AT_OBSERVATION",
  "EXPLICIT_INFORMATIONAL_FINDING_INVENTORY",
]);

const DOES_NOT_CERTIFY = Object.freeze([
  "FUTURE_REGISTRY_OR_ADVISORY_DATABASE_STATE",
  "TRANSITIVE_UNMAINTAINED_DEPENDENCY_RISK_ACCEPTANCE",
  "SOURCE_BOUND_AUTOMATED_SECURITY_EVIDENCE_CLOSURE",
  "PRODUCTION_BINARY_DEVNET_RELEASE_OR_MAINNET_AUTHORIZATION",
]);

export const DEPENDENCY_SECURITY_SOURCE_BINDINGS = Object.freeze([
  ["package-lock.json", "0dfd49b12e400d874af6a4da5cd156196837cf18bab41691eca9ee8976360eb0", 143731],
  ["projects/star-ascent/site/package.json", "de4981304d3061bdd46c380134ce583f4c89ba37da054b0de0715c3bcab7ed26", 16752],
  ["projects/star-ascent/site/package-lock.json", "0d9fa00ab4bad2ea159cb602961bf0a0344b67f26f393f41bc17a3f85bbf4170", 458039],
  ["projects/star-ascent/site/Cargo.lock", "83b98114ddef72cd0a1dfd41b44859075a1ee5870e2bcf5fedb28e12653bd905", 62772],
  ["projects/star-ascent/site/tests/fixtures/iat-b3-account-lifecycle/Cargo.lock", "77965964970f9ef1fb4e43dd86c2e59f4cc29e2382b202d506041872e0be22cc", 48126],
  ["projects/star-ascent/site/tests/fixtures/iat-b3-stake-ingress/Cargo.lock", "54608994b8d349adf7b802794173b63648aa29ef1afb840a0c4e36eed765da1a", 50158],
  ["projects/star-ascent/site/tests/iat-b3-dependency-security-overrides.test.mjs", "145b9a3b85b1e6664dcdebd701d938c45441a903c67e5647a7a1f34a4426fcfb", 2714],
  ["projects/star-ascent/site/tests/iat-b3-safe-bigint-buffer.test.mjs", "2831e4720d21285b712c85a719d883921eac443209d3b678200127cc92e069a0", 3899],
  ["projects/star-ascent/site/tests/iat-b3-safe-image-size.test.mjs", "675f955ef8d9de2a1f5a1c0da8bd7d9eedb6579e3e4ee2d80f34c24d1af447e6", 4108],
  ["projects/star-ascent/site/vendor/bigint-buffer-1.1.6.tgz", "1bd899ffcb225326bfc75cccf3dba51402ab7893c665506ffe60b8548fbf99c9", 1334],
  ["projects/star-ascent/site/vendor/bigint-buffer-safe/package.json", "618eaf84147d588de4890a903e6a77644c456d6be19452d5573ed271aec5a1e0", 356],
  ["projects/star-ascent/site/vendor/bigint-buffer-safe/index.cjs", "d1304b498602eced0cb2cb5111f1a55d2cc7087d0d2680f6eb300f738ddf3f22", 1559],
  ["projects/star-ascent/site/vendor/image-size-safe/package.json", "8a0ad356309bfe2ebf828671de609bcf573ade8bf8539ae0998d49542d709ad8", 1757],
  ["projects/star-ascent/site/vendor/image-size-safe/dist/types/heif.mjs", "30e9ef642aece578182496b3acbfb7abd2c6dab5e4d536d0acf940ac5645831b", 2788],
  ["projects/star-ascent/site/vendor/image-size-safe/dist/types/icns.mjs", "e97adf289187be3b446a25fa44172dac6126b95b940f4635fd1f234f81b2954f", 2513],
  ["projects/star-ascent/site/vendor/image-size-safe/dist/types/jxl.mjs", "cbcb05ee94848bb085a667b53f13411f60a37f289c4cf26eac1916ce2ab4b0bb", 5068],
  ["projects/star-ascent/site/vendor/image-size-safe/dist/types/jxl-stream.mjs", "551aaf0ad6a7729baa606962ac5316f24317681eba7f31c5237d0a50b92c2d66", 2592],
].map(([path, sha256, byteLength]) => Object.freeze({ path, sha256, byteLength })));

const EXPECTED_COMMIT = Object.freeze({
  sha: REMEDIATION_COMMIT,
  parentSha: REMEDIATION_PARENT,
  subject: "fix(b3): remediate dependency security findings",
});

const EXPECTED_TOOLCHAIN = Object.freeze({
  npmVersion: "10.8.2",
  cargoAuditVersion: "0.22.2",
  rustSecDatabaseCommit: "2ae3ea41b89902e846595002ca29a91df471097d",
  rustSecDatabaseUpdatedAt: "2026-08-10T21:33:56+02:00",
  rustSecAdvisoryCount: 1207,
});

const EXPECTED_BEFORE = Object.freeze({
  siteNpmHigh: 6,
  siteNpmModerate: 13,
  siteNpmTotal: 19,
});

const EXPECTED_AUDITS = Object.freeze([
  { kind: "NPM_LOCKFILE", path: "package-lock.json", dependencyCount: 320, vulnerabilityCount: 0, informationalWarningCount: 0 },
  { kind: "NPM_LOCKFILE", path: "projects/star-ascent/site/package-lock.json", dependencyCount: 866, vulnerabilityCount: 0, informationalWarningCount: 0 },
  { kind: "CARGO_LOCKFILE", path: "projects/star-ascent/site/Cargo.lock", dependencyCount: 234, vulnerabilityCount: 0, informationalWarningCount: 1 },
  { kind: "CARGO_LOCKFILE", path: "projects/star-ascent/site/tests/fixtures/iat-b3-account-lifecycle/Cargo.lock", dependencyCount: 188, vulnerabilityCount: 0, informationalWarningCount: 1 },
  { kind: "CARGO_LOCKFILE", path: "projects/star-ascent/site/tests/fixtures/iat-b3-stake-ingress/Cargo.lock", dependencyCount: 192, vulnerabilityCount: 0, informationalWarningCount: 1 },
].map(Object.freeze));

const EXPECTED_REMEDIATIONS = Object.freeze([
  "LOCAL_PURE_JAVASCRIPT_BIGINT_BUFFER_1_1_6_WITH_API_REGRESSION",
  "LOCAL_IMAGE_SIZE_2_0_3_NONADVANCING_LENGTH_FIX_WITH_HOSTILE_REGRESSION",
  "JAYSON_UUID_OVERRIDE_11_1_1",
  "ESBUILD_KIT_CORE_UTILS_ESBUILD_OVERRIDE_0_25_12",
]);

const EXPECTED_INFORMATIONAL = Object.freeze([Object.freeze({
  id: "RUSTSEC-2025-0141",
  package: "bincode",
  version: "1.3.3",
  classification: "UNMAINTAINED_NOT_KNOWN_VULNERABLE",
  transitiveThrough: ["ANCHOR", "SOLANA"],
  patchedVersions: [],
  unaffectedVersions: [],
  accepted: false,
  disposition: "PENDING_EXPLICIT_OWNER_RISK_DECISION",
})]);

const EMPTY_AUTOMATED_DIRECT_EVIDENCE = Object.freeze({
  schema: "iat-b3-dependency-security-automated-direct-evidence/v1",
  status: "SOURCE_BOUND_RECEIPT_STATE_ENDPOINT_EVIDENCE_UNOBSERVED",
  receiptSha256: null,
  stateDigestSha256: null,
  endpointEvidenceSha256: null,
  observedAtUtc: null,
  freshnessWindowSeconds: 900,
  directEvidenceOnly: true,
  packetMaySelectEvidenceSources: false,
  noSelfAttestation: true,
  humanReviewerRequired: false,
});

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const exactJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const exactKeys = (value, keys) => value !== null
  && typeof value === "object"
  && !Array.isArray(value)
  && Object.keys(value).sort().join("\0") === [...keys].sort().join("\0");

function canonicalDataError(root) {
  const seen = new WeakSet();
  const visit = (value, path) => {
    if (value === null || typeof value === "string" || typeof value === "boolean") return null;
    if (typeof value === "number") {
      if (!Number.isSafeInteger(value) || Object.is(value, -0)) return `${path}: number must be a safe canonical integer`;
      return null;
    }
    if (typeof value !== "object") return `${path}: non-JSON value`;
    if (seen.has(value)) return `${path}: cycle or alias`;
    seen.add(value);
    const expectedPrototype = Array.isArray(value) ? Array.prototype : Object.prototype;
    if (Object.getPrototypeOf(value) !== expectedPrototype) return `${path}: custom or null prototype`;
    if (Object.getOwnPropertySymbols(value).length !== 0) return `${path}: symbol property`;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (Array.isArray(value)) {
      const dataKeys = keys.filter((key) => key !== "length");
      if (dataKeys.length !== value.length) return `${path}: sparse or decorated array`;
      for (let index = 0; index < value.length; index += 1) {
        if (dataKeys[index] !== String(index)) return `${path}: noncanonical array keys`;
      }
    }
    for (const key of keys) {
      if (key === "length" && Array.isArray(value)) continue;
      const descriptor = descriptors[key];
      if (!("value" in descriptor) || descriptor.enumerable !== true) return `${path}.${String(key)}: accessor or hidden property`;
      const error = visit(descriptor.value, `${path}.${String(key)}`);
      if (error) return error;
    }
    return null;
  };
  return visit(root, "$root");
}

function result(violations) {
  return Object.freeze({
    valid: violations.length === 0,
    technicalRemediationComplete: violations.length === 0,
    zeroKnownVulnerabilitiesObserved: violations.length === 0,
    zeroUnacceptedDependencyFindings: false,
    completionPredicateSatisfied: false,
    automatedDirectEvidenceComplete: false,
    activationReady: false,
    releaseAuthorizationVerified: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: "HOLD",
    violations: Object.freeze([...violations]),
  });
}

export function validateDependencySecurityRemediationManifest(
  manifest,
  { boundFiles = null } = {},
) {
  const dataError = canonicalDataError(manifest);
  if (dataError) return result([`manifest: ${dataError}`]);
  const violations = [];
  if (!exactKeys(manifest, TOP_LEVEL_KEYS)) {
    return result([`manifest: expected exact keys ${[...TOP_LEVEL_KEYS].sort().join(",")}`]);
  }
  if (manifest.$schema !== "./iat-b3-dependency-security-remediation.v1.schema.json"
    || manifest.schema !== DEPENDENCY_SECURITY_REMEDIATION_SCHEMA
    || manifest.status !== DEPENDENCY_SECURITY_REMEDIATION_STATUS) {
    violations.push("manifest: schema or status drifted");
  }
  if (!exactKeys(manifest.scope, ["predicate", "certifies", "doesNotCertify"])
    || manifest.scope.predicate !== "ZERO_UNACCEPTED_DEPENDENCY_FINDINGS_PACKET"
    || !exactJson(manifest.scope.certifies, CERTIFIES)
    || !exactJson(manifest.scope.doesNotCertify, DOES_NOT_CERTIFY)) {
    violations.push("scope: exact certification and non-certification boundary drifted");
  }
  if (!exactJson(manifest.remediationCommit, EXPECTED_COMMIT)) {
    violations.push("remediationCommit: exact commit, parent, or subject drifted");
  }
  if (!exactJson(manifest.sourceBindings, DEPENDENCY_SECURITY_SOURCE_BINDINGS)) {
    violations.push("sourceBindings: exact ordered committed path, digest, or length drifted");
  }
  if (manifest.observedAtUtc !== "2026-08-11T07:32:18.212Z"
    || !exactJson(manifest.auditToolchain, EXPECTED_TOOLCHAIN)
    || !exactJson(manifest.beforeRemediation, EXPECTED_BEFORE)
    || !exactJson(manifest.auditObservations, EXPECTED_AUDITS)
    || !exactJson(manifest.remediations, EXPECTED_REMEDIATIONS)
    || !exactJson(manifest.informationalFindings, EXPECTED_INFORMATIONAL)) {
    violations.push("technical evidence: exact toolchain, before/after inventory, or finding ledger drifted");
  }
  if (!exactJson(manifest.automatedDirectEvidence, EMPTY_AUTOMATED_DIRECT_EVIDENCE)) {
    violations.push("automatedDirectEvidence: exact source-bound receipt/state/endpoint evidence remains unobserved");
  }
  if (manifest.technicalRemediationComplete !== true
    || manifest.zeroKnownVulnerabilitiesObserved !== true
    || manifest.zeroUnacceptedDependencyFindings !== false
    || manifest.completionPredicateSatisfied !== false
    || manifest.activationReady !== false
    || manifest.releaseAuthorizationVerified !== false
    || manifest.mainnetExecutionAuthorized !== false
    || manifest.mainnetStatus !== "HOLD") {
    violations.push("terminal truth: technical closure must not self-accept risk or authorize release/Mainnet");
  }
  if (!(boundFiles instanceof Map)) {
    violations.push("sourceBindings: exact committed bytes were not supplied");
  } else {
    for (const binding of DEPENDENCY_SECURITY_SOURCE_BINDINGS) {
      const bytes = boundFiles.get(binding.path);
      if (!Buffer.isBuffer(bytes)) {
        violations.push(`sourceBindings: missing committed bytes for ${binding.path}`);
      } else if (bytes.length !== binding.byteLength || sha256(bytes) !== binding.sha256) {
        violations.push(`sourceBindings: committed byte length or SHA-256 mismatch for ${binding.path}`);
      }
    }
  }
  return result(violations);
}

export function parseDependencySecurityRemediationJson(text, label = "manifest") {
  if (typeof text !== "string") throw new TypeError(`${label}: JSON source must be a string`);
  let index = 0;
  const whitespace = /[\t\n\r ]/u;
  const skipWhitespace = () => {
    while (index < text.length && whitespace.test(text[index])) index += 1;
  };
  const fail = (message) => {
    throw new SyntaxError(`${label}: ${message} at byte ${index}`);
  };
  const parseStringToken = () => {
    if (text[index] !== "\"") fail("expected JSON string");
    const start = index;
    index += 1;
    while (index < text.length) {
      const character = text[index];
      if (character === "\"") {
        index += 1;
        return JSON.parse(text.slice(start, index));
      }
      if (character === "\\") index += 2;
      else {
        if (character < " ") fail("unescaped control character");
        index += 1;
      }
    }
    fail("unterminated JSON string");
  };
  const parseValue = (path) => {
    skipWhitespace();
    if (text[index] === "{") {
      index += 1;
      skipWhitespace();
      const keys = new Set();
      if (text[index] === "}") { index += 1; return; }
      while (index < text.length) {
        skipWhitespace();
        const key = parseStringToken();
        if (keys.has(key)) throw new SyntaxError(`${label}: duplicate JSON member ${path}.${key}`);
        keys.add(key);
        skipWhitespace();
        if (text[index] !== ":") fail("expected colon");
        index += 1;
        parseValue(`${path}.${key}`);
        skipWhitespace();
        if (text[index] === "}") { index += 1; return; }
        if (text[index] !== ",") fail("expected comma or closing brace");
        index += 1;
      }
      fail("unterminated JSON object");
    }
    if (text[index] === "[") {
      index += 1;
      skipWhitespace();
      if (text[index] === "]") { index += 1; return; }
      let item = 0;
      while (index < text.length) {
        parseValue(`${path}[${item}]`);
        item += 1;
        skipWhitespace();
        if (text[index] === "]") { index += 1; return; }
        if (text[index] !== ",") fail("expected comma or closing bracket");
        index += 1;
      }
      fail("unterminated JSON array");
    }
    if (text[index] === "\"") { parseStringToken(); return; }
    const start = index;
    while (index < text.length && !/[\t\n\r ,\]}]/u.test(text[index])) index += 1;
    if (start === index) fail("expected JSON value");
    JSON.parse(text.slice(start, index));
  };
  skipWhitespace();
  parseValue("$root");
  skipWhitespace();
  if (index !== text.length) fail("unexpected trailing data");
  return JSON.parse(text);
}

function committedBindings() {
  const objectType = execFileSync("git", ["cat-file", "-t", REMEDIATION_COMMIT], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
  }).trim();
  if (objectType !== "commit") throw new Error("remediation commit is not available as a commit object");
  execFileSync("git", ["merge-base", "--is-ancestor", REMEDIATION_COMMIT, "HEAD"], {
    cwd: REPOSITORY_ROOT,
    stdio: "ignore",
  });
  const parent = execFileSync("git", ["rev-parse", `${REMEDIATION_COMMIT}^`], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
  }).trim();
  const subject = execFileSync("git", ["show", "-s", "--format=%s", REMEDIATION_COMMIT], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
  }).trim();
  if (parent !== REMEDIATION_PARENT || subject !== EXPECTED_COMMIT.subject) {
    throw new Error("remediation commit parent or subject drifted");
  }
  return new Map(DEPENDENCY_SECURITY_SOURCE_BINDINGS.map((binding) => [
    binding.path,
    execFileSync("git", ["show", `${REMEDIATION_COMMIT}:${binding.path}`], {
      cwd: REPOSITORY_ROOT,
      encoding: "buffer",
      maxBuffer: 8 * 1024 * 1024,
    }),
  ]));
}

function main() {
  const manifestPath = resolve(process.argv[2] ?? DEFAULT_MANIFEST_PATH);
  const manifest = parseDependencySecurityRemediationJson(
    readFileSync(manifestPath, "utf8"),
    manifestPath,
  );
  const validation = validateDependencySecurityRemediationManifest(manifest, {
    boundFiles: committedBindings(),
  });
  process.stdout.write(`${JSON.stringify(validation, null, 2)}\n`);
  process.exitCode = validation.valid ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
