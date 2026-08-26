import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";

import { canonicalizeRfc8785 } from "../iat-v2-canonical-json.mjs";
import { parseB3OwnerPolicyFreezeJson } from "../validate-iat-b3-owner-policy-freeze.mjs";

export const INDEPENDENT_SECURITY_EVIDENCE_SCHEMA =
  "iat-v2-independent-security-evidence/v2";
export const INDEPENDENT_SECURITY_EVIDENCE_STATUS =
  "SECURITY_SUITE_COMPLETE_HOLD";
export const INDEPENDENT_SECURITY_PREDICATE = "AUTOMATED_SECURITY_CLOSURE";
export const INDEPENDENT_SECURITY_MAINNET_STATUS = "HOLD";
export const INDEPENDENT_SECURITY_WORKFLOW_PATH =
  ".github/workflows/iat-v2-independent-security-evidence.yml";
export const INDEPENDENT_SECURITY_WORKFLOW_JOB_KEY = "security-evidence";
export const INDEPENDENT_SECURITY_WORKFLOW_JOB_NAME =
  "Independent IAT-surface current-source security evidence (Mainnet HOLD)";
export const INDEPENDENT_SECURITY_ARTIFACT_NAME =
  "iat-v2-independent-security-evidence-v2";
export const INDEPENDENT_SECURITY_MANIFEST_PATH =
  "iat-v2-independent-security-evidence-v2.json";
export const INDEPENDENT_SECURITY_REPOSITORY = "InternalAgencyIO/InternalAgency";
export const INDEPENDENT_SECURITY_REPOSITORY_ID = 1_313_660_798;
export const INDEPENDENT_SECURITY_FRESHNESS_SECONDS = 900n;

export const INDEPENDENT_SECURITY_LOCKFILE_PATHS = Object.freeze([
  "projects/star-ascent/site/package-lock.json",
  "projects/star-ascent/site/Cargo.lock",
  "projects/star-ascent/site/tests/fixtures/iat-b3-account-lifecycle/Cargo.lock",
  "projects/star-ascent/site/tests/fixtures/iat-b3-stake-ingress/Cargo.lock",
]);

export const INDEPENDENT_SECURITY_REGRESSION_PATHS = Object.freeze([
  "projects/star-ascent/site/tests/iat-b3-dependency-security-overrides.test.mjs",
  "projects/star-ascent/site/tests/iat-b3-dependency-security-remediation.test.mjs",
  "projects/star-ascent/site/tests/iat-b3-safe-bigint-buffer.test.mjs",
  "projects/star-ascent/site/tests/iat-b3-safe-image-size.test.mjs",
  "projects/star-ascent/site/tests/node-binding-security.test.mjs",
  "projects/star-ascent/site/tests/daily-budget-security.test.mjs",
  "projects/star-ascent/site/tests/iat-v2-program-binding.test.mjs",
]);

export const INDEPENDENT_SECURITY_SOURCE_PATHS = Object.freeze([
  ...INDEPENDENT_SECURITY_LOCKFILE_PATHS,
  INDEPENDENT_SECURITY_WORKFLOW_PATH,
  ...INDEPENDENT_SECURITY_REGRESSION_PATHS,
]);

export const INDEPENDENT_SECURITY_CHECK_SPECS = Object.freeze([
  Object.freeze({
    id: "NPM_SITE_AUDIT",
    kind: "NPM_AUDIT",
    rawPath: "raw/npm-site-audit.json",
    exitCodePath: "raw/npm-site-audit.exit-code.txt",
    inputPath: INDEPENDENT_SECURITY_LOCKFILE_PATHS[0],
  }),
  Object.freeze({
    id: "CARGO_SITE_AUDIT",
    kind: "CARGO_AUDIT",
    rawPath: "raw/cargo-site-audit.json",
    exitCodePath: "raw/cargo-site-audit.exit-code.txt",
    inputPath: INDEPENDENT_SECURITY_LOCKFILE_PATHS[1],
  }),
  Object.freeze({
    id: "CARGO_ACCOUNT_LIFECYCLE_AUDIT",
    kind: "CARGO_AUDIT",
    rawPath: "raw/cargo-account-lifecycle-audit.json",
    exitCodePath: "raw/cargo-account-lifecycle-audit.exit-code.txt",
    inputPath: INDEPENDENT_SECURITY_LOCKFILE_PATHS[2],
  }),
  Object.freeze({
    id: "CARGO_STAKE_INGRESS_AUDIT",
    kind: "CARGO_AUDIT",
    rawPath: "raw/cargo-stake-ingress-audit.json",
    exitCodePath: "raw/cargo-stake-ingress-audit.exit-code.txt",
    inputPath: INDEPENDENT_SECURITY_LOCKFILE_PATHS[3],
  }),
  Object.freeze({
    id: "SECURITY_REGRESSION_SUITE",
    kind: "NODE_TEST_TAP",
    rawPath: "raw/security-regression.tap",
    exitCodePath: "raw/security-regression.exit-code.txt",
    inputPath: null,
  }),
]);

export const INDEPENDENT_SECURITY_TOOL_OUTPUT_PATHS = Object.freeze([
  "raw/node-version.txt",
  "raw/npm-version.txt",
  "raw/cargo-audit-version.txt",
]);

export const INDEPENDENT_SECURITY_ARTIFACT_ENTRIES = Object.freeze([
  INDEPENDENT_SECURITY_MANIFEST_PATH,
  ...INDEPENDENT_SECURITY_TOOL_OUTPUT_PATHS,
  ...INDEPENDENT_SECURITY_CHECK_SPECS.flatMap(({ rawPath, exitCodePath }) => [
    rawPath,
    exitCodePath,
  ]),
].sort());

export const INDEPENDENT_SECURITY_REQUIRED_JOB_STEPS = Object.freeze([
  "Check out exact source head",
  "Set up pinned Node runtime",
  "Install exact site dependencies",
  "Install pinned Cargo audit tool",
  "Capture exact tool versions",
  "Run site npm advisory audit",
  "Run Cargo advisory audits",
  "Run fixed security regression suite",
  "Assemble canonical security evidence",
  "Upload immutable security evidence artifact",
]);

export const INDEPENDENT_SECURITY_LIMITATIONS = Object.freeze([
  "Exact current-source IAT-site dependency audits and fixed IAT security regressions only; the unrelated repository-root Radiance package is outside this evidence contract, and this is not a comprehensive economic, privacy, legal, or human review.",
  "Evidence remains bounded to its public GitHub run, advisory snapshot, source commit, source tree, and reviewed program artifact.",
  "Does not prove a signed Devnet rehearsal and does not authorize funding, signing, broadcast, deployment, release, scheduling, or Mainnet execution.",
]);

export const INDEPENDENT_SECURITY_SAFETY = Object.freeze({
  credentialMaterialIncluded: false,
  walletAccessed: false,
  deviceAccessed: false,
  signingPerformed: false,
  simulationForSigningPerformed: false,
  broadcastingPerformed: false,
  deploymentPerformed: false,
  productionResourceMutationPerformed: false,
  mainnetRequestPerformed: false,
  scannerNetworkRequestsPermitted: true,
  authorizesMainnet: false,
});

export const RUSTSEC_2025_0141_FINDING = Object.freeze({
  id: "RUSTSEC-2025-0141",
  package: "bincode",
  version: "1.3.3",
  classification: "UNMAINTAINED_NOT_KNOWN_VULNERABLE",
  accepted: false,
  disposition: "UNRESOLVED_INFORMATIONAL",
});

const HEX_40 = /^[0-9a-f]{40}$/u;
const HEX_64 = /^[0-9a-f]{64}$/u;
const NPM_VERSION = /^(?:v)?[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/u;
const CARGO_AUDIT_VERSION = /^cargo-audit\s+0\.22\.2$/u;
const EXPECTED_WORKFLOW_REF =
  /^InternalAgencyIO\/InternalAgency\/\.github\/workflows\/iat-v2-independent-security-evidence\.yml@refs\/(?:heads\/.+|pull\/[1-9][0-9]*\/merge)$/u;
const MAX_JSON_BYTES = 4 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;
const MAX_ENTRY_BYTES = 8 * 1024 * 1024;
const MAX_FUTURE_SKEW_SECONDS = 30n;

const TOP_KEYS = Object.freeze([
  "schema",
  "status",
  "predicate",
  "sourceBinding",
  "ciProvenance",
  "inputBindings",
  "toolchain",
  "checks",
  "findingSummary",
  "artifactContract",
  "observedAtUtc",
  "expiresAtUtc",
  "safety",
  "limitations",
  "mainnetStatus",
]);
const SOURCE_KEYS = Object.freeze(["commit", "tree", "programArtifactSha256"]);
const CI_KEYS = Object.freeze([
  "serverUrl",
  "repository",
  "repositoryId",
  "workflowRef",
  "workflowPath",
  "workflowSha256",
  "runId",
  "runAttempt",
  "eventName",
  "sourceHeadSha",
  "checkoutSha",
  "checkoutRelation",
  "jobKey",
  "jobName",
  "runnerOs",
  "runnerArch",
  "artifactName",
]);
const INPUT_KEYS = Object.freeze(["path", "kind", "sha256", "bytes"]);
const TOOLCHAIN_KEYS = Object.freeze([
  "nodeVersion",
  "npmVersion",
  "cargoAuditVersion",
  "rustSecDatabaseCommit",
  "rustSecDatabaseUpdatedAtUtc",
  "rustSecAdvisoryCount",
]);
const CHECK_KEYS = Object.freeze([
  "id",
  "kind",
  "inputPath",
  "rawPath",
  "rawSha256",
  "rawBytes",
  "exitCodePath",
  "exitCodeSha256",
  "exitCodeBytes",
  "exitCode",
  "observation",
]);
const NPM_OBSERVATION_KEYS = Object.freeze([
  "auditReportVersion",
  "critical",
  "high",
  "moderate",
  "low",
  "info",
  "total",
]);
const CARGO_OBSERVATION_KEYS = Object.freeze([
  "dependencyCount",
  "vulnerabilityCount",
  "informationalFindingIds",
]);
const TAP_OBSERVATION_KEYS = Object.freeze(["testCount", "passCount", "failCount"]);
const FINDING_KEYS = Object.freeze([
  "critical",
  "high",
  "moderate",
  "low",
  "informational",
  "total",
  "unresolvedCritical",
  "unresolvedHigh",
  "zeroUnacceptedCriticalOrHigh",
  "unresolvedInformational",
]);
const RUSTSEC_FINDING_KEYS = Object.freeze([
  "id",
  "package",
  "version",
  "classification",
  "accepted",
  "disposition",
]);
const ARTIFACT_KEYS = Object.freeze(["name", "manifestPath", "entries"]);

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const exactJson = (left, right) => canonicalizeRfc8785(left) === canonicalizeRfc8785(right);
const isPlainObject = (value) => value !== null
  && typeof value === "object"
  && !Array.isArray(value)
  && Object.getPrototypeOf(value) === Object.prototype;

function exactKeys(value, keys, path, violations) {
  const actual = isPlainObject(value) ? Object.keys(value).sort() : [];
  const expected = [...keys].sort();
  if (!isPlainObject(value) || !exactJson(actual, expected)) {
    violations.push(`${path}: keys must be exactly ${keys.join(", ")}`);
    return false;
  }
  return true;
}

function boundedBytes(value, label, maximum = MAX_JSON_BYTES) {
  if (!(value instanceof Uint8Array) || value.byteLength < 2 || value.byteLength > maximum) {
    throw new TypeError(`${label}: expected bounded direct bytes`);
  }
  return Buffer.from(value);
}

function decodeUtf8(bytes, label) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new TypeError(`${label}: bytes are not canonical UTF-8`);
  }
}

function parseJsonBytes(value, label, { canonical = false } = {}) {
  const bytes = boundedBytes(value, label);
  const text = decodeUtf8(bytes, label);
  const parsed = parseB3OwnerPolicyFreezeJson(text, label);
  if (canonical && text !== `${canonicalizeRfc8785(parsed)}\n`) {
    throw new TypeError(`${label}: expected RFC8785 canonical JSON plus one newline`);
  }
  return parsed;
}

function unsignedInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function canonicalUtc(value, path, violations) {
  if (typeof value !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(value)) {
    violations.push(`${path}: expected canonical whole-second UTC`);
    return null;
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)
    || new Date(milliseconds).toISOString().replace(".000Z", "Z") !== value) {
    violations.push(`${path}: invalid canonical UTC`);
    return null;
  }
  return BigInt(milliseconds / 1_000);
}

function evaluationTime(value, violations) {
  if (typeof value === "bigint" && value >= 0n) return value;
  if (typeof value === "string" && /^(?:0|[1-9][0-9]*)$/u.test(value)) return BigInt(value);
  violations.push("evaluationUnixSeconds: explicit canonical unsigned time is required");
  return null;
}

function normalizedVersionBytes(value, label) {
  const text = decodeUtf8(boundedBytes(value, label, 512), label);
  if (!text.endsWith("\n") || text.slice(0, -1).includes("\n") || text.includes("\r")) {
    throw new TypeError(`${label}: expected exactly one LF-terminated version line`);
  }
  return text.slice(0, -1);
}

export function parseIndependentSecurityExitCodeBytes(value, label = "tool exit code") {
  const text = decodeUtf8(boundedBytes(value, label, 32), label);
  if (text !== "0\n") {
    throw new Error(`${label}: exact zero exit-code receipt required`);
  }
  return 0;
}

function npmVulnerabilityCounts(report, label) {
  const counts = report?.metadata?.vulnerabilities;
  if (!isPlainObject(report) || report.auditReportVersion !== 2 || !isPlainObject(report.vulnerabilities)
    || !isPlainObject(counts)) {
    throw new TypeError(`${label}: expected npm audit report v2 with vulnerability metadata`);
  }
  const normalized = {
    auditReportVersion: 2,
    critical: counts.critical,
    high: counts.high,
    moderate: counts.moderate,
    low: counts.low,
    info: counts.info,
    total: counts.total,
  };
  for (const [field, count] of Object.entries(normalized)) {
    if (!unsignedInteger(count)) throw new TypeError(`${label}: ${field} count is invalid`);
  }
  if (normalized.total !== normalized.critical + normalized.high + normalized.moderate
    + normalized.low + normalized.info) {
    throw new TypeError(`${label}: severity counts do not add to total`);
  }
  return normalized;
}

export function summarizeNpmAuditBytes(bytes, label = "npm audit") {
  const report = parseJsonBytes(bytes, label);
  const observation = npmVulnerabilityCounts(report, label);
  if (observation.critical !== 0 || observation.high !== 0) {
    throw new Error(`${label}: observed Critical or High vulnerabilities`);
  }
  return Object.freeze(observation);
}

function collectRustSecIds(value, ids = new Set(), seen = new Set()) {
  if (typeof value === "string") {
    if (/^RUSTSEC-[0-9]{4}-[0-9]{4}$/u.test(value)) ids.add(value);
    return ids;
  }
  if (!value || typeof value !== "object" || seen.has(value)) return ids;
  seen.add(value);
  for (const child of Object.values(value)) collectRustSecIds(child, ids, seen);
  return ids;
}

function cargoDatabase(report, label) {
  const database = report?.database;
  const commit = database?.["last-commit"] ?? database?.lastCommit;
  const updatedAt = database?.["last-updated"] ?? database?.lastUpdated;
  const advisoryCount = database?.["advisory-count"] ?? database?.advisoryCount;
  if (!HEX_40.test(commit ?? "") || !positiveInteger(advisoryCount)
    || typeof updatedAt !== "string" || !Number.isFinite(Date.parse(updatedAt))) {
    throw new TypeError(`${label}: exact RustSec advisory database snapshot is required`);
  }
  return {
    rustSecDatabaseCommit: commit,
    rustSecDatabaseUpdatedAtUtc: new Date(Date.parse(updatedAt)).toISOString(),
    rustSecAdvisoryCount: advisoryCount,
  };
}

export function summarizeCargoAuditBytes(bytes, label = "cargo audit") {
  const report = parseJsonBytes(bytes, label);
  const count = report?.vulnerabilities?.count;
  const list = report?.vulnerabilities?.list;
  const dependencyCount = report?.lockfile?.["dependency-count"]
    ?? report?.lockfile?.dependencyCount;
  if (!unsignedInteger(count) || !Array.isArray(list) || count !== list.length
    || !unsignedInteger(dependencyCount)) {
    throw new TypeError(`${label}: malformed Cargo audit vulnerability or lockfile counts`);
  }
  if (count !== 0) throw new Error(`${label}: observed Cargo vulnerabilities`);
  const informationalFindingIds = [...collectRustSecIds(report.warnings)].sort();
  if (!informationalFindingIds.includes(RUSTSEC_2025_0141_FINDING.id)) {
    throw new Error(`${label}: unresolved RUSTSEC-2025-0141 informational truth is missing`);
  }
  return Object.freeze({
    observation: Object.freeze({
      dependencyCount,
      vulnerabilityCount: count,
      informationalFindingIds: Object.freeze(informationalFindingIds),
    }),
    database: Object.freeze(cargoDatabase(report, label)),
  });
}

function finalTapCount(text, name, label) {
  const matches = [...text.matchAll(new RegExp(`^# ${name} ([0-9]+)$`, "gmu"))];
  if (matches.length !== 1) throw new TypeError(`${label}: expected one top-level TAP ${name} count`);
  return Number(matches[0][1]);
}

export function summarizeTapBytes(bytes, label = "security regression TAP") {
  const text = decodeUtf8(boundedBytes(bytes, label, MAX_ENTRY_BYTES), label);
  if (!text.startsWith("TAP version 13\n") || /^(?:not ok|Bail out!)/mu.test(text)) {
    throw new Error(`${label}: TAP contains a failing or aborted test`);
  }
  const testCount = finalTapCount(text, "tests", label);
  const passCount = finalTapCount(text, "pass", label);
  const failCount = finalTapCount(text, "fail", label);
  if (testCount <= 0 || failCount !== 0 || passCount !== testCount) {
    throw new Error(`${label}: TAP summary is not an all-pass result`);
  }
  return Object.freeze({ testCount, passCount, failCount });
}

export function deriveIndependentSecurityFindingSummary(checks) {
  if (!Array.isArray(checks)) throw new TypeError("checks must be an array");
  const npm = checks.filter(({ kind }) => kind === "NPM_AUDIT");
  const cargo = checks.filter(({ kind }) => kind === "CARGO_AUDIT");
  if (npm.length !== 1 || cargo.length !== 3
    || !cargo.every(({ observation }) => observation.informationalFindingIds
      .includes(RUSTSEC_2025_0141_FINDING.id))) {
    throw new TypeError("exact one IAT-site npm and three Cargo audit observations are required");
  }
  const sum = (field) => npm.reduce((total, check) => total + check.observation[field], 0);
  const critical = sum("critical");
  const high = sum("high");
  const moderate = sum("moderate");
  const low = sum("low");
  const informational = sum("info") + 1;
  return Object.freeze({
    critical,
    high,
    moderate,
    low,
    informational,
    total: critical + high + moderate + low + informational,
    unresolvedCritical: critical,
    unresolvedHigh: high,
    zeroUnacceptedCriticalOrHigh: critical === 0 && high === 0,
    unresolvedInformational: Object.freeze([RUSTSEC_2025_0141_FINDING]),
  });
}

export function independentSecurityCanonicalBytes(value) {
  return Buffer.from(`${canonicalizeRfc8785(value)}\n`, "utf8");
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function safeArchiveName(name) {
  if (typeof name !== "string" || name.length === 0 || name.length > 240
    || name.includes("\\") || name.startsWith("/")) return false;
  const directory = name.endsWith("/");
  const parts = (directory ? name.slice(0, -1) : name).split("/");
  return parts.every((part) => part !== "" && part !== "." && part !== "..");
}

export function readIndependentSecurityArtifactArchive(value) {
  const bytes = boundedBytes(value, "artifact archive", MAX_ARCHIVE_BYTES);
  let eocd = -1;
  const minimum = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0 || eocd + 22 > bytes.length) throw new Error("artifact archive: ZIP end record missing");
  const disk = bytes.readUInt16LE(eocd + 4);
  const centralDisk = bytes.readUInt16LE(eocd + 6);
  const diskEntries = bytes.readUInt16LE(eocd + 8);
  const entryCount = bytes.readUInt16LE(eocd + 10);
  const centralSize = bytes.readUInt32LE(eocd + 12);
  const centralOffset = bytes.readUInt32LE(eocd + 16);
  const commentLength = bytes.readUInt16LE(eocd + 20);
  if (disk !== 0 || centralDisk !== 0 || diskEntries !== entryCount || entryCount === 0
    || entryCount > 64 || eocd + 22 + commentLength !== bytes.length
    || centralOffset + centralSize !== eocd) {
    throw new Error("artifact archive: unsupported disk, count, comment, or central-directory layout");
  }
  const entries = new Map();
  const names = new Set();
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > eocd || bytes.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error("artifact archive: malformed central-directory entry");
    }
    const flags = bytes.readUInt16LE(cursor + 8);
    const method = bytes.readUInt16LE(cursor + 10);
    const expectedCrc = bytes.readUInt32LE(cursor + 16);
    const compressedSize = bytes.readUInt32LE(cursor + 20);
    const uncompressedSize = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const entryCommentLength = bytes.readUInt16LE(cursor + 32);
    const diskStart = bytes.readUInt16LE(cursor + 34);
    const externalAttributes = bytes.readUInt32LE(cursor + 38);
    const localOffset = bytes.readUInt32LE(cursor + 42);
    const next = cursor + 46 + nameLength + extraLength + entryCommentLength;
    if ((flags & 1) !== 0 || ![0, 8].includes(method) || diskStart !== 0
      || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff
      || uncompressedSize > MAX_ENTRY_BYTES || next > eocd) {
      throw new Error("artifact archive: encrypted, ZIP64, oversized, or unsupported entry");
    }
    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = decodeUtf8(nameBytes, "artifact archive entry name");
    if (!safeArchiveName(name) || names.has(name)) {
      throw new Error("artifact archive: unsafe or duplicate entry name");
    }
    names.add(name);
    const unixMode = externalAttributes >>> 16;
    if ((unixMode & 0xf000) === 0xa000) throw new Error("artifact archive: symlink entries are forbidden");
    if (localOffset + 30 > centralOffset || bytes.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error("artifact archive: local entry header is invalid");
    }
    const localFlags = bytes.readUInt16LE(localOffset + 6);
    const localMethod = bytes.readUInt16LE(localOffset + 8);
    const localNameLength = bytes.readUInt16LE(localOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const localName = decodeUtf8(
      bytes.subarray(localOffset + 30, localOffset + 30 + localNameLength),
      "artifact archive local entry name",
    );
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    if (localFlags !== flags || localMethod !== method || localName !== name
      || dataOffset + compressedSize > centralOffset) {
      throw new Error("artifact archive: local and central entry bindings differ");
    }
    const compressed = bytes.subarray(dataOffset, dataOffset + compressedSize);
    const output = method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed, {
      maxOutputLength: MAX_ENTRY_BYTES,
    });
    if (output.length !== uncompressedSize || crc32(output) !== expectedCrc) {
      throw new Error("artifact archive: decompressed length or CRC-32 mismatch");
    }
    if (name.endsWith("/")) {
      if (name !== "raw/" || output.length !== 0) {
        throw new Error("artifact archive: unexpected or nonempty directory entry");
      }
    } else {
      entries.set(name, output);
    }
    cursor = next;
  }
  if (cursor !== eocd) throw new Error("artifact archive: central-directory length mismatch");
  return entries;
}

function validateSourceBinding(evidence, expected, violations) {
  if (!exactKeys(evidence.sourceBinding, SOURCE_KEYS, "evidence.sourceBinding", violations)) return false;
  const binding = evidence.sourceBinding;
  if (!HEX_40.test(binding.commit ?? "") || !HEX_40.test(binding.tree ?? "")
    || !HEX_64.test(binding.programArtifactSha256 ?? "")
    || /^0{64}$/u.test(binding.programArtifactSha256)) {
    violations.push("evidence.sourceBinding: malformed or placeholder identity");
  }
  const sourceBound = binding.commit === expected.commit && binding.tree === expected.tree
    && binding.programArtifactSha256 === expected.programArtifactSha256;
  if (!sourceBound) violations.push("evidence.sourceBinding: expected current-source binding mismatch");
  return sourceBound;
}

function validateCiProvenance(evidence, sourceFiles, violations) {
  if (!exactKeys(evidence.ciProvenance, CI_KEYS, "evidence.ciProvenance", violations)) return false;
  const ci = evidence.ciProvenance;
  const workflowBytes = sourceFiles.get(INDEPENDENT_SECURITY_WORKFLOW_PATH);
  if (ci.serverUrl !== "https://github.com" || ci.repository !== INDEPENDENT_SECURITY_REPOSITORY
    || ci.repositoryId !== INDEPENDENT_SECURITY_REPOSITORY_ID
    || ci.workflowPath !== INDEPENDENT_SECURITY_WORKFLOW_PATH
    || !EXPECTED_WORKFLOW_REF.test(ci.workflowRef ?? "")
    || !(workflowBytes instanceof Uint8Array) || ci.workflowSha256 !== sha256(workflowBytes)
    || !positiveInteger(ci.runId) || !positiveInteger(ci.runAttempt)
    || !["pull_request", "push", "workflow_dispatch"].includes(ci.eventName)
    || ci.sourceHeadSha !== evidence.sourceBinding?.commit || ci.checkoutSha !== ci.sourceHeadSha
    || ci.checkoutRelation !== "IDENTICAL" || ci.jobKey !== INDEPENDENT_SECURITY_WORKFLOW_JOB_KEY
    || ci.jobName !== INDEPENDENT_SECURITY_WORKFLOW_JOB_NAME || ci.runnerOs !== "Linux"
    || ci.runnerArch !== "X64" || ci.artifactName !== INDEPENDENT_SECURITY_ARTIFACT_NAME) {
    violations.push("evidence.ciProvenance: exact public GitHub workflow/source/job/artifact binding required");
    return false;
  }
  return true;
}

function validateInputBindings(evidence, sourceFiles, violations) {
  if (!Array.isArray(evidence.inputBindings)
    || evidence.inputBindings.length !== INDEPENDENT_SECURITY_SOURCE_PATHS.length) {
    violations.push("evidence.inputBindings: exact source input inventory required");
    return false;
  }
  let valid = true;
  for (let index = 0; index < INDEPENDENT_SECURITY_SOURCE_PATHS.length; index += 1) {
    const record = evidence.inputBindings[index];
    const expectedPath = INDEPENDENT_SECURITY_SOURCE_PATHS[index];
    if (!exactKeys(record, INPUT_KEYS, `evidence.inputBindings[${index}]`, violations)) {
      valid = false;
      continue;
    }
    const expectedKind = INDEPENDENT_SECURITY_LOCKFILE_PATHS.includes(expectedPath)
      ? "LOCKFILE" : expectedPath === INDEPENDENT_SECURITY_WORKFLOW_PATH
        ? "WORKFLOW" : "SECURITY_REGRESSION";
    const bytes = sourceFiles.get(expectedPath);
    if (record.path !== expectedPath || record.kind !== expectedKind
      || !(bytes instanceof Uint8Array) || record.bytes !== bytes?.byteLength
      || record.sha256 !== (bytes instanceof Uint8Array ? sha256(bytes) : null)) {
      violations.push(`evidence.inputBindings[${index}]: exact committed source bytes are not bound`);
      valid = false;
    }
  }
  return valid;
}

function validateToolchain(evidence, archive, cargoDatabases, violations) {
  if (!exactKeys(evidence.toolchain, TOOLCHAIN_KEYS, "evidence.toolchain", violations)) return false;
  let nodeVersion;
  let npmVersion;
  let cargoAuditVersion;
  try {
    nodeVersion = normalizedVersionBytes(archive.get(INDEPENDENT_SECURITY_TOOL_OUTPUT_PATHS[0]), "node version");
    npmVersion = normalizedVersionBytes(archive.get(INDEPENDENT_SECURITY_TOOL_OUTPUT_PATHS[1]), "npm version");
    cargoAuditVersion = normalizedVersionBytes(archive.get(INDEPENDENT_SECURITY_TOOL_OUTPUT_PATHS[2]), "cargo audit version");
  } catch (error) {
    violations.push(error.message);
    return false;
  }
  const firstDatabase = cargoDatabases[0];
  const sameDatabase = cargoDatabases.length === 3
    && cargoDatabases.every((value) => exactJson(value, firstDatabase));
  if (!/^v24\.[0-9]+\.[0-9]+$/u.test(nodeVersion) || !NPM_VERSION.test(npmVersion)
    || !CARGO_AUDIT_VERSION.test(cargoAuditVersion) || !sameDatabase
    || evidence.toolchain.nodeVersion !== nodeVersion
    || evidence.toolchain.npmVersion !== npmVersion
    || evidence.toolchain.cargoAuditVersion !== cargoAuditVersion
    || evidence.toolchain.rustSecDatabaseCommit !== firstDatabase?.rustSecDatabaseCommit
    || evidence.toolchain.rustSecDatabaseUpdatedAtUtc !== firstDatabase?.rustSecDatabaseUpdatedAtUtc
    || evidence.toolchain.rustSecAdvisoryCount !== firstDatabase?.rustSecAdvisoryCount) {
    violations.push("evidence.toolchain: exact tool bytes and one shared RustSec snapshot required");
    return false;
  }
  return true;
}

function validateChecks(evidence, archive, violations) {
  if (!Array.isArray(evidence.checks)
    || evidence.checks.length !== INDEPENDENT_SECURITY_CHECK_SPECS.length) {
    violations.push("evidence.checks: exact ordered security check set required");
    return { valid: false, checks: [], cargoDatabases: [] };
  }
  const checks = [];
  const cargoDatabases = [];
  let valid = true;
  for (let index = 0; index < INDEPENDENT_SECURITY_CHECK_SPECS.length; index += 1) {
    const expected = INDEPENDENT_SECURITY_CHECK_SPECS[index];
    const record = evidence.checks[index];
    if (!exactKeys(record, CHECK_KEYS, `evidence.checks[${index}]`, violations)) {
      valid = false;
      continue;
    }
    const raw = archive.get(expected.rawPath);
    const exitCodeBytes = archive.get(expected.exitCodePath);
    if (!(raw instanceof Uint8Array) || record.id !== expected.id || record.kind !== expected.kind
      || record.inputPath !== expected.inputPath || record.rawPath !== expected.rawPath
      || record.rawSha256 !== (raw instanceof Uint8Array ? sha256(raw) : null)
      || record.rawBytes !== raw?.byteLength || record.exitCodePath !== expected.exitCodePath
      || !(exitCodeBytes instanceof Uint8Array)
      || record.exitCodeSha256 !== (exitCodeBytes instanceof Uint8Array ? sha256(exitCodeBytes) : null)
      || record.exitCodeBytes !== exitCodeBytes?.byteLength) {
      violations.push(`evidence.checks[${index}]: exact raw artifact bytes are not bound`);
      valid = false;
      continue;
    }
    let observation;
    try {
      const exitCode = parseIndependentSecurityExitCodeBytes(
        exitCodeBytes,
        `${expected.id} exit code`,
      );
      if (record.exitCode !== exitCode) {
        throw new Error(`${expected.id}: derived exit code mismatch`);
      }
      if (expected.kind === "NPM_AUDIT") observation = summarizeNpmAuditBytes(raw, expected.id);
      else if (expected.kind === "CARGO_AUDIT") {
        const summary = summarizeCargoAuditBytes(raw, expected.id);
        observation = summary.observation;
        cargoDatabases.push(summary.database);
      } else observation = summarizeTapBytes(raw, expected.id);
    } catch (error) {
      violations.push(error.message);
      valid = false;
      continue;
    }
    const observationKeys = expected.kind === "NPM_AUDIT" ? NPM_OBSERVATION_KEYS
      : expected.kind === "CARGO_AUDIT" ? CARGO_OBSERVATION_KEYS : TAP_OBSERVATION_KEYS;
    if (!exactKeys(record.observation, observationKeys, `evidence.checks[${index}].observation`, violations)
      || !exactJson(record.observation, observation)) {
      violations.push(`evidence.checks[${index}].observation: derived raw-output summary mismatch`);
      valid = false;
    }
    checks.push({ ...record, observation });
  }
  return { valid, checks, cargoDatabases };
}

function validateFindingSummary(evidence, checks, violations) {
  if (!exactKeys(evidence.findingSummary, FINDING_KEYS, "evidence.findingSummary", violations)) {
    return false;
  }
  let expected;
  try {
    expected = deriveIndependentSecurityFindingSummary(checks);
  } catch (error) {
    violations.push(`evidence.findingSummary: ${error.message}`);
    return false;
  }
  const finding = evidence.findingSummary.unresolvedInformational?.[0];
  if (!Array.isArray(evidence.findingSummary.unresolvedInformational)
    || evidence.findingSummary.unresolvedInformational.length !== 1
    || !exactKeys(finding, RUSTSEC_FINDING_KEYS, "evidence.findingSummary.unresolvedInformational[0]", violations)
    || !exactJson(evidence.findingSummary, expected) || expected.critical !== 0
    || expected.high !== 0 || expected.unresolvedCritical !== 0
    || expected.unresolvedHigh !== 0 || expected.zeroUnacceptedCriticalOrHigh !== true) {
    violations.push("evidence.findingSummary: exact zero-Critical/zero-High result and unresolved RUSTSEC-2025-0141 truth required");
    return false;
  }
  return true;
}

function validateArtifactContract(evidence, archive, evidenceBytes, violations) {
  if (!exactKeys(evidence.artifactContract, ARTIFACT_KEYS, "evidence.artifactContract", violations)
    || evidence.artifactContract.name !== INDEPENDENT_SECURITY_ARTIFACT_NAME
    || evidence.artifactContract.manifestPath !== INDEPENDENT_SECURITY_MANIFEST_PATH
    || !exactJson(evidence.artifactContract.entries, INDEPENDENT_SECURITY_ARTIFACT_ENTRIES)
    || !exactJson([...archive.keys()].sort(), INDEPENDENT_SECURITY_ARTIFACT_ENTRIES)
    || !Buffer.from(archive.get(INDEPENDENT_SECURITY_MANIFEST_PATH) ?? []).equals(evidenceBytes)) {
    violations.push("evidence.artifactContract: exact archive inventory and manifest bytes required");
    return false;
  }
  return true;
}

function validReceiptUrl(value, expected) {
  return typeof value === "string" && value === expected;
}

function githubReceiptUtc(value, path, violations) {
  return canonicalUtc(value, path, violations);
}

function validateGithubRun(receipt, evidence, violations) {
  const ci = evidence.ciProvenance;
  const expectedUrl = `https://github.com/${ci.repository}/actions/runs/${ci.runId}`;
  if (!isPlainObject(receipt) || receipt.id !== ci.runId || receipt.run_attempt !== ci.runAttempt
    || receipt.event !== ci.eventName || receipt.status !== "completed" || receipt.conclusion !== "success"
    || receipt.head_sha !== ci.sourceHeadSha || receipt.path !== ci.workflowPath
    || receipt.repository?.id !== ci.repositoryId || receipt.repository?.full_name !== ci.repository
    || !validReceiptUrl(receipt.html_url, expectedUrl)) {
    violations.push("GitHub run receipt: exact successful public run/source/workflow/repository binding required");
    return null;
  }
  return {
    created: githubReceiptUtc(receipt.created_at, "GitHub run receipt.created_at", violations),
    updated: githubReceiptUtc(receipt.updated_at, "GitHub run receipt.updated_at", violations),
    url: expectedUrl,
  };
}

function validateGithubJob(receipt, evidence, violations) {
  const ci = evidence.ciProvenance;
  const jobs = Array.isArray(receipt?.jobs) ? receipt.jobs.filter((job) => job.name === ci.jobName) : [];
  if (!isPlainObject(receipt) || jobs.length !== 1) {
    violations.push("GitHub jobs receipt: exactly one bound security job is required");
    return null;
  }
  const job = jobs[0];
  const expectedUrl = `https://github.com/${ci.repository}/actions/runs/${ci.runId}/job/${job.id}`;
  const steps = Array.isArray(job.steps) ? job.steps : [];
  const requiredStepsValid = INDEPENDENT_SECURITY_REQUIRED_JOB_STEPS.every((name) => {
    const matches = steps.filter((step) => step.name === name);
    return matches.length === 1 && matches[0].status === "completed" && matches[0].conclusion === "success";
  });
  if (!positiveInteger(job.id) || job.run_id !== ci.runId || job.run_attempt !== ci.runAttempt
    || job.head_sha !== ci.sourceHeadSha || job.status !== "completed" || job.conclusion !== "success"
    || !Array.isArray(job.labels) || !job.labels.includes("ubuntu-24.04")
    || !validReceiptUrl(job.html_url, expectedUrl) || !requiredStepsValid) {
    violations.push("GitHub jobs receipt: exact successful hosted job, runner label, and step set required");
    return null;
  }
  return {
    id: job.id,
    started: githubReceiptUtc(job.started_at, "GitHub job.started_at", violations),
    completed: githubReceiptUtc(job.completed_at, "GitHub job.completed_at", violations),
    url: expectedUrl,
  };
}

function validateGithubArtifact(receipt, archiveBytes, evidence, job, violations) {
  const ci = evidence.ciProvenance;
  const expectedArchiveUrl = `https://api.github.com/repos/${ci.repository}/actions/artifacts/${receipt?.id}/zip`;
  const digest = `sha256:${sha256(archiveBytes)}`;
  const created = typeof receipt?.created_at === "string" ? Date.parse(receipt.created_at) : Number.NaN;
  const expires = typeof receipt?.expires_at === "string" ? Date.parse(receipt.expires_at) : Number.NaN;
  if (!isPlainObject(receipt) || !positiveInteger(receipt.id) || receipt.name !== ci.artifactName
    || receipt.size_in_bytes !== archiveBytes.byteLength || receipt.expired !== false
    || receipt.digest !== digest || receipt.workflow_run?.id !== ci.runId
    || receipt.workflow_run?.head_sha !== ci.sourceHeadSha
    || receipt.archive_download_url !== expectedArchiveUrl
    || !Number.isFinite(created) || !Number.isFinite(expires) || expires <= created
    || (job && job.started !== null && BigInt(Math.floor(created / 1_000)) < job.started)
    || (job && job.completed !== null
      && BigInt(Math.floor(created / 1_000)) > job.completed + 60n)) {
    violations.push("GitHub artifact receipt: exact unexpired run-bound archive digest, size, and identity required");
    return null;
  }
  return {
    id: receipt.id,
    digest,
    archiveUrl: expectedArchiveUrl,
    created: BigInt(Math.floor(created / 1_000)),
  };
}

function invalidResult(violations, evidence = null, extra = {}) {
  return Object.freeze({
    status: "LIVE_AUTH_REQUIRED_HOLD",
    valid: false,
    structurallyValid: false,
    authenticated: false,
    clearanceValid: false,
    predicate: evidence?.predicate ?? null,
    sourceBound: false,
    ciReceiptStructureBound: false,
    artifactBytesBound: false,
    allRequiredChecksPassed: false,
    zeroUnacceptedCriticalOrHigh: false,
    evidenceSha256: null,
    sourceCommit: evidence?.sourceBinding?.commit ?? null,
    sourceTree: evidence?.sourceBinding?.tree ?? null,
    programArtifactSha256: evidence?.sourceBinding?.programArtifactSha256 ?? null,
    runUrl: null,
    jobUrl: null,
    mainnetStatus: "HOLD",
    blocker: "LIVE_GITHUB_RUN_JOB_ARTIFACT_ARCHIVE_AUTHENTICATION_REQUIRED",
    ...extra,
    violations: Object.freeze([...violations]),
  });
}

export function validateIndependentSecurityEvidence({
  evidenceBytes,
  githubRunBytes,
  githubJobsBytes,
  githubArtifactBytes,
  artifactArchiveBytes,
  sourceFiles,
  expectedSourceCommit,
  expectedSourceTree,
  expectedProgramArtifactSha256,
  evaluationUnixSeconds,
} = {}) {
  const violations = [];
  let evidence;
  let githubRun;
  let githubJobs;
  let githubArtifact;
  let archive;
  let normalizedEvidenceBytes;
  try {
    normalizedEvidenceBytes = boundedBytes(evidenceBytes, "evidence");
    evidence = parseJsonBytes(normalizedEvidenceBytes, "evidence", { canonical: true });
    githubRun = parseJsonBytes(githubRunBytes, "GitHub run receipt");
    githubJobs = parseJsonBytes(githubJobsBytes, "GitHub jobs receipt");
    githubArtifact = parseJsonBytes(githubArtifactBytes, "GitHub artifact receipt");
    archive = readIndependentSecurityArtifactArchive(artifactArchiveBytes);
  } catch (error) {
    return invalidResult([error.message], evidence);
  }
  if (!(sourceFiles instanceof Map)
    || !exactJson([...sourceFiles.keys()].sort(), [...INDEPENDENT_SECURITY_SOURCE_PATHS].sort())) {
    return invalidResult(["sourceFiles: exact committed byte map required"], evidence);
  }
  if (!exactKeys(evidence, TOP_KEYS, "evidence", violations)) return invalidResult(violations, evidence);
  if (evidence.schema !== INDEPENDENT_SECURITY_EVIDENCE_SCHEMA
    || evidence.status !== INDEPENDENT_SECURITY_EVIDENCE_STATUS
    || evidence.predicate !== INDEPENDENT_SECURITY_PREDICATE
    || evidence.mainnetStatus !== INDEPENDENT_SECURITY_MAINNET_STATUS) {
    violations.push("evidence: exact security predicate, complete-HOLD status, and Mainnet HOLD required");
  }
  const sourceBound = validateSourceBinding(evidence, {
    commit: expectedSourceCommit,
    tree: expectedSourceTree,
    programArtifactSha256: expectedProgramArtifactSha256,
  }, violations);
  const ciManifestBound = validateCiProvenance(evidence, sourceFiles, violations);
  const inputsBound = validateInputBindings(evidence, sourceFiles, violations);
  const artifactContractBound = validateArtifactContract(
    evidence,
    archive,
    normalizedEvidenceBytes,
    violations,
  );
  const checksResult = validateChecks(evidence, archive, violations);
  const toolchainBound = validateToolchain(evidence, archive, checksResult.cargoDatabases, violations);
  const findingsValid = validateFindingSummary(evidence, checksResult.checks, violations);
  if (!exactKeys(evidence.safety, Object.keys(INDEPENDENT_SECURITY_SAFETY), "evidence.safety", violations)
    || !exactJson(evidence.safety, INDEPENDENT_SECURITY_SAFETY)) {
    violations.push("evidence.safety: exact non-signing, non-deploying, Mainnet-HOLD safety boundary required");
  }
  if (!exactJson(evidence.limitations, INDEPENDENT_SECURITY_LIMITATIONS)) {
    violations.push("evidence.limitations: exact nonauthorizing scope limitations required");
  }
  const observed = canonicalUtc(evidence.observedAtUtc, "evidence.observedAtUtc", violations);
  const expires = canonicalUtc(evidence.expiresAtUtc, "evidence.expiresAtUtc", violations);
  const evaluation = evaluationTime(evaluationUnixSeconds, violations);
  if (observed !== null && expires !== null
    && (expires <= observed || expires - observed !== INDEPENDENT_SECURITY_FRESHNESS_SECONDS)) {
    violations.push("evidence timing: exact 900-second freshness interval required");
  }
  if (evaluation !== null && observed !== null && expires !== null
    && (observed > evaluation + MAX_FUTURE_SKEW_SECONDS || evaluation >= expires)) {
    violations.push("evidence timing: evidence is future-dated or expired");
  }
  const run = validateGithubRun(githubRun, evidence, violations);
  const job = validateGithubJob(githubJobs, evidence, violations);
  if (run && job && run.created !== null && run.updated !== null
    && job.started !== null && job.completed !== null
    && (run.created > job.started || job.started > job.completed || job.completed > run.updated + 60n)) {
    violations.push("GitHub run/job receipt timing is inconsistent");
  }
  const artifact = validateGithubArtifact(
    githubArtifact,
    boundedBytes(artifactArchiveBytes, "artifact archive", MAX_ARCHIVE_BYTES),
    evidence,
    job,
    violations,
  );
  if (job && artifact && observed !== null && job.started !== null && job.completed !== null
    && (observed < job.started || observed > job.completed
      || artifact.created < observed || artifact.created > job.completed + 60n)) {
    violations.push("evidence/GitHub timing: observation and artifact must occur inside the bound job");
  }
  const ciReceiptStructureBound = ciManifestBound && run !== null && job !== null && artifact !== null;
  const artifactBytesBound = artifactContractBound && artifact !== null;
  const allRequiredChecksPassed = checksResult.valid && toolchainBound && findingsValid;
  const zeroUnacceptedCriticalOrHigh = findingsValid
    && evidence.findingSummary.zeroUnacceptedCriticalOrHigh === true;
  const structurallyValid = violations.length === 0 && sourceBound && inputsBound && ciReceiptStructureBound
    && artifactBytesBound && allRequiredChecksPassed && zeroUnacceptedCriticalOrHigh;
  return Object.freeze({
    status: "LIVE_AUTH_REQUIRED_HOLD",
    valid: false,
    structurallyValid,
    authenticated: false,
    clearanceValid: false,
    predicate: evidence.predicate,
    sourceBound,
    ciReceiptStructureBound,
    artifactBytesBound,
    allRequiredChecksPassed,
    zeroUnacceptedCriticalOrHigh,
    evidenceSha256: structurallyValid ? sha256(normalizedEvidenceBytes) : null,
    sourceCommit: evidence.sourceBinding.commit,
    sourceTree: evidence.sourceBinding.tree,
    programArtifactSha256: evidence.sourceBinding.programArtifactSha256,
    runUrl: structurallyValid ? run.url : null,
    jobUrl: structurallyValid ? job.url : null,
    mainnetStatus: "HOLD",
    blocker: "LIVE_GITHUB_RUN_JOB_ARTIFACT_ARCHIVE_AUTHENTICATION_REQUIRED",
    violations: Object.freeze([...violations]),
  });
}
