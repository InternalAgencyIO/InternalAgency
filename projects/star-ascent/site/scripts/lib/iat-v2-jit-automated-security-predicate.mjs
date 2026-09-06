import { createHash } from "node:crypto";
import { isProxy } from "node:util/types";

import { parseB3OwnerPolicyFreezeJson } from "../validate-iat-b3-owner-policy-freeze.mjs";
import {
  INDEPENDENT_SECURITY_PREDICATE,
  validateIndependentSecurityEvidence,
} from "./iat-v2-independent-security-evidence.mjs";
import {
  CURRENT_SOURCE_PREDICATE_CHECK_IDS,
  CURRENT_SOURCE_PREDICATE_HOLD_STATUS,
  validateIndependentSecurityClearancePredicate,
} from "./iat-v2-current-source-predicate-wiring.mjs";
import {
  consumeGitHubHostedStateAuthenticationCapability,
} from "./iat-v2-github-hosted-state-authenticator.mjs";

export const JIT_AUTOMATED_SECURITY_OBSERVED_STATUS =
  "AUTOMATED_SECURITY_PREDICATE_LIVE_OBSERVED_HOLD";
export const JIT_AUTOMATED_SECURITY_HOLD_STATUS = "LIVE_AUTH_REQUIRED_HOLD";

const INPUT_KEYS = Object.freeze([
  "capability",
  "directEvidence",
  "checkReceiptBytes",
  "evidenceBytes",
  "githubRunBytes",
  "githubJobsBytes",
  "githubArtifactBytes",
  "artifactArchiveBytes",
  "sourceFiles",
  "binding",
]);
const BINDING_KEYS = Object.freeze(["commit", "tree", "programArtifactSha256"]);
const DIRECT_EVIDENCE_KEYS = Object.freeze([
  "schema",
  "predicate",
  "observationMode",
  "sourceCommit",
  "sourceTree",
  "programArtifactSha256",
  "network",
  "observedAtUtc",
  "receipts",
  "transactionSignatures",
  "checks",
]);
const DIRECT_CHECK_KEYS = Object.freeze(["id", "result", "evidencePath", "evidenceSha256"]);
const CHECK_RECEIPT_KEYS = Object.freeze([
  "schema",
  "predicate",
  "checkId",
  "result",
  "sourceCommit",
  "programArtifactSha256",
  "observedAtUtc",
  "detailsSha256",
]);
const HEX_40 = /^[0-9a-f]{40}$/u;
const HEX_64 = /^[0-9a-f]{64}$/u;
const WHOLE_SECOND_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
const CHECK_EVIDENCE_PATH =
  /^public\/evidence\/iat-v2\/current-source\/checks\/[A-Za-z0-9][A-Za-z0-9._-]*\.json$/u;
const MAX_CHECK_RECEIPT_BYTES = 64 * 1024;

function snapshotDataRecord(value, expectedKeys) {
  try {
    if (value === null || typeof value !== "object" || isProxy(value)
      || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
      return null;
    }
    const actualKeys = Reflect.ownKeys(value);
    const expected = [...expectedKeys].sort();
    if (actualKeys.some((key) => typeof key !== "string")) return null;
    actualKeys.sort();
    if (actualKeys.length !== expected.length
      || actualKeys.some((key, index) => key !== expected[index])) {
      return null;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (!expectedKeys.every((key) => Object.hasOwn(descriptors[key], "value")
      && descriptors[key].enumerable === true)) {
      return null;
    }
    return Object.freeze(Object.fromEntries(
      expectedKeys.map((key) => [key, descriptors[key].value]),
    ));
  } catch {
    return null;
  }
}

function snapshotArray(value, snapshotItem) {
  try {
    if (!Array.isArray(value) || isProxy(value)) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const ownKeys = Reflect.ownKeys(descriptors);
    if (ownKeys.some((key) => typeof key !== "string")) return null;
    const expectedKeys = [...Array.from({ length: value.length }, (_, index) => String(index)), "length"];
    ownKeys.sort();
    expectedKeys.sort();
    if (ownKeys.length !== expectedKeys.length
      || ownKeys.some((key, index) => key !== expectedKeys[index])) {
      return null;
    }
    const snapshot = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors[index];
      if (!descriptor || !Object.hasOwn(descriptor, "value") || descriptor.enumerable !== true) {
        return null;
      }
      const item = snapshotItem(descriptor.value, index);
      if (item === null) return null;
      snapshot.push(item);
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function snapshotStringArray(value) {
  return snapshotArray(value, (item) => typeof item === "string" ? item : null);
}

function snapshotDirectEvidence(value) {
  const record = snapshotDataRecord(value, DIRECT_EVIDENCE_KEYS);
  if (record === null) return null;
  const receipts = snapshotStringArray(record.receipts);
  const transactionSignatures = snapshotStringArray(record.transactionSignatures);
  const checks = snapshotArray(record.checks, (item) => snapshotDataRecord(item, DIRECT_CHECK_KEYS));
  if (receipts === null || transactionSignatures === null || checks === null) return null;
  return Object.freeze({ ...record, receipts, transactionSignatures, checks });
}

function canonicalUtc(value) {
  if (typeof value !== "string" || !WHOLE_SECOND_UTC.test(value)) return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds)
    && new Date(milliseconds).toISOString().replace(".000Z", "Z") === value;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function publicReceiptUrl(value) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase().replace(/\.+$/u, "");
    return parsed.protocol === "https:" && parsed.username === "" && parsed.password === ""
      && parsed.port === "" && parsed.hash === "" && host !== "localhost"
      && host !== "example.com" && !host.startsWith("placeholder");
  } catch {
    return false;
  }
}

function parseExactCheckReceiptBytes(value) {
  try {
    if (!(value instanceof Uint8Array) || isProxy(value)
      || value.byteLength === 0 || value.byteLength > MAX_CHECK_RECEIPT_BYTES) {
      return null;
    }
    const bytes = Buffer.from(value);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const parsed = parseB3OwnerPolicyFreezeJson(text, "JIT_AUTOMATED_SECURITY_CHECK_RECEIPT");
    const receipt = snapshotDataRecord(parsed, CHECK_RECEIPT_KEYS);
    if (receipt === null
      || text !== `${JSON.stringify(receipt, null, 2)}\n`) {
      return null;
    }
    return Object.freeze({
      bytes,
      receipt,
      sha256: sha256(bytes),
    });
  } catch {
    return null;
  }
}

function exactCurrentSourceEnvelope(directEvidence, checkReceipt, binding) {
  const checkReceipts = [checkReceipt.receipt];
  if (directEvidence.schema !== "iat-v2-current-source-direct-evidence/v1"
    || directEvidence.predicate !== INDEPENDENT_SECURITY_PREDICATE
    || directEvidence.observationMode !== "AUTOMATED_SOURCE_BOUND_DIRECT_OBSERVATION"
    || directEvidence.sourceCommit !== binding.commit
    || directEvidence.sourceTree !== binding.tree
    || directEvidence.programArtifactSha256 !== binding.programArtifactSha256
    || directEvidence.network !== "source"
    || !canonicalUtc(directEvidence.observedAtUtc)
    || directEvidence.receipts.length === 0
    || new Set(directEvidence.receipts).size !== directEvidence.receipts.length
    || !directEvidence.receipts.every(publicReceiptUrl)
    || directEvidence.transactionSignatures.length !== 0
    || directEvidence.checks.length !== 1
    || checkReceipts.length !== 1
    || directEvidence.checks[0].id !== CURRENT_SOURCE_PREDICATE_CHECK_IDS.automatedSecurityClosure
    || checkReceipts[0].checkId !== CURRENT_SOURCE_PREDICATE_CHECK_IDS.automatedSecurityClosure
    || directEvidence.checks[0].evidenceSha256 !== checkReceipt.sha256) {
    return false;
  }
  for (const check of directEvidence.checks) {
    if (!/^[A-Z][A-Z0-9_]{2,63}$/u.test(check.id ?? "")
      || check.result !== "PASS"
      || typeof check.evidencePath !== "string"
      || !CHECK_EVIDENCE_PATH.test(check.evidencePath)
      || check.evidencePath.includes("..")
      || !HEX_64.test(check.evidenceSha256 ?? "")) {
      return false;
    }
    const matches = checkReceipts.filter((receipt) => receipt.checkId === check.id);
    if (matches.length !== 1) return false;
  }
  return checkReceipts.every((receipt) => receipt.schema === "iat-v2-current-source-check-receipt/v1"
    && receipt.predicate === INDEPENDENT_SECURITY_PREDICATE
    && receipt.result === "PASS"
    && receipt.sourceCommit === binding.commit
    && receipt.programArtifactSha256 === binding.programArtifactSha256
    && receipt.observedAtUtc === directEvidence.observedAtUtc
    && HEX_64.test(receipt.detailsSha256 ?? ""));
}

function hold(blocker, violations = []) {
  return Object.freeze({
    schema: "iat-v2-jit-automated-security-predicate-observation/v1",
    status: JIT_AUTOMATED_SECURITY_HOLD_STATUS,
    observed: false,
    authenticated: false,
    hostedStateAuthenticated: false,
    predicate: INDEPENDENT_SECURITY_PREDICATE,
    structuralEvidenceBound: false,
    directEvidenceBound: false,
    checkEvidenceBound: false,
    zeroUnacceptedCriticalOrHigh: false,
    clearanceValid: false,
    authorizesMainnet: false,
    authorizesRelease: false,
    mainnetStatus: "HOLD",
    blocker,
    violations: Object.freeze([...violations]),
  });
}

function exactStructuralResult(result, binding) {
  return result?.status === CURRENT_SOURCE_PREDICATE_HOLD_STATUS
    && result.valid === false
    && result.structurallyValid === true
    && result.authenticated === false
    && result.clearanceValid === false
    && result.predicate === INDEPENDENT_SECURITY_PREDICATE
    && result.sourceBound === true
    && result.ciReceiptStructureBound === true
    && result.artifactBytesBound === true
    && result.allRequiredChecksPassed === true
    && result.zeroUnacceptedCriticalOrHigh === true
    && HEX_64.test(result.evidenceSha256 ?? "")
    && result.sourceCommit === binding.commit
    && result.sourceTree === binding.tree
    && result.programArtifactSha256 === binding.programArtifactSha256
    && typeof result.runUrl === "string"
    && typeof result.jobUrl === "string"
    && result.mainnetStatus === "HOLD"
    && result.blocker === "LIVE_GITHUB_RUN_JOB_ARTIFACT_ARCHIVE_AUTHENTICATION_REQUIRED"
    && Array.isArray(result.violations)
    && result.violations.length === 0;
}

function exactWiredResult(result) {
  return result?.status === CURRENT_SOURCE_PREDICATE_HOLD_STATUS
    && result.valid === false
    && result.structurallyValid === true
    && result.authenticated === false
    && result.clearanceValid === false
    && result.predicate === INDEPENDENT_SECURITY_PREDICATE
    && result.mainnetStatus === "HOLD"
    && result.blocker === "LIVE_GITHUB_RUN_JOB_ARTIFACT_ARCHIVE_AUTHENTICATION_REQUIRED"
    && Array.isArray(result.violations)
    && result.violations.length === 0;
}

function exactHostedClaims(claims, expected) {
  return claims?.status === "LIVE_GITHUB_HOSTED_STATE_AUTHENTICATED_HOLD"
    && claims.authenticated === true
    && claims.hostedStateAuthenticated === true
    && claims.clearanceValid === false
    && claims.authorizesMainnet === false
    && claims.mainnetStatus === "HOLD"
    && claims.runId === expected.runId
    && claims.runAttempt === expected.runAttempt
    && claims.sourceHeadSha === expected.sourceHeadSha
    && claims.sourceTree === expected.sourceTree
    && claims.programArtifactSha256 === expected.programArtifactSha256
    && claims.archiveSha256 === expected.archiveSha256
    && claims.evidenceSha256 === expected.evidenceSha256
    && typeof claims.runUrl === "string"
    && typeof claims.jobUrl === "string"
    && canonicalUtc(claims.providerTimeUtc);
}

export function observeJitAutomatedSecurityPredicate(options = {}) {
  const input = snapshotDataRecord(options, INPUT_KEYS);
  if (input === null) return hold("JIT_AUTOMATED_SECURITY_INPUT_CONTRACT_REJECTED");
  const binding = snapshotDataRecord(input.binding, BINDING_KEYS);
  if (binding === null || !HEX_40.test(binding.commit ?? "")
    || !HEX_40.test(binding.tree ?? "")
    || !HEX_64.test(binding.programArtifactSha256 ?? "")) {
    return hold("JIT_AUTOMATED_SECURITY_SOURCE_BINDING_REJECTED");
  }
  const directEvidence = snapshotDirectEvidence(input.directEvidence);
  const checkReceipt = parseExactCheckReceiptBytes(input.checkReceiptBytes);
  if (directEvidence === null || checkReceipt === null
    || !exactCurrentSourceEnvelope(directEvidence, checkReceipt, binding)) {
    return hold("JIT_AUTOMATED_SECURITY_NESTED_EVIDENCE_CONTRACT_REJECTED");
  }

  let manifest;
  try {
    manifest = JSON.parse(Buffer.from(input.evidenceBytes).toString("utf8"));
  } catch {
    return hold("AUTOMATED_SECURITY_MANIFEST_UNREADABLE");
  }
  const runId = manifest?.ciProvenance?.runId;
  const runAttempt = manifest?.ciProvenance?.runAttempt;
  const observedAtUtc = manifest?.observedAtUtc;
  if (!Number.isSafeInteger(runId) || runId <= 0
    || !Number.isSafeInteger(runAttempt) || runAttempt <= 0
    || !canonicalUtc(observedAtUtc)) {
    return hold("AUTOMATED_SECURITY_MANIFEST_BINDING_INVALID");
  }
  let expectedCapabilityBinding;
  try {
    expectedCapabilityBinding = Object.freeze({
      runId,
      runAttempt,
      sourceHeadSha: binding.commit,
      sourceTree: binding.tree,
      programArtifactSha256: binding.programArtifactSha256,
      archiveSha256: sha256(Buffer.from(input.artifactArchiveBytes)),
      evidenceSha256: sha256(Buffer.from(input.evidenceBytes)),
    });
  } catch {
    return hold("AUTOMATED_SECURITY_CAPABILITY_BINDING_INVALID");
  }
  const claims = consumeGitHubHostedStateAuthenticationCapability(
    input.capability,
    expectedCapabilityBinding,
  );
  if (!exactHostedClaims(claims, expectedCapabilityBinding)) {
    return hold("FRESH_OPAQUE_GITHUB_HOSTED_STATE_CAPABILITY_REQUIRED");
  }
  const evaluationUnixSeconds = String(Date.parse(claims.providerTimeUtc) / 1_000);

  let structural;
  let wired;
  try {
    const structuralInput = {
      evidenceBytes: input.evidenceBytes,
      githubRunBytes: input.githubRunBytes,
      githubJobsBytes: input.githubJobsBytes,
      githubArtifactBytes: input.githubArtifactBytes,
      artifactArchiveBytes: input.artifactArchiveBytes,
      sourceFiles: input.sourceFiles,
      expectedSourceCommit: binding.commit,
      expectedSourceTree: binding.tree,
      expectedProgramArtifactSha256: binding.programArtifactSha256,
      evaluationUnixSeconds,
    };
    structural = validateIndependentSecurityEvidence(structuralInput);
    if (!exactStructuralResult(structural, binding)) {
      return hold(
        "STRUCTURAL_AUTOMATED_SECURITY_EVIDENCE_INVALID",
        Array.isArray(structural?.violations) ? structural.violations : [],
      );
    }
    const exactReceiptUrls = new Set([structural.runUrl, structural.jobUrl]);
    if (exactReceiptUrls.size !== 2 || directEvidence.receipts.length !== 2
      || !directEvidence.receipts.every((url) => exactReceiptUrls.has(url))) {
      return hold("CURRENT_SOURCE_AUTOMATED_SECURITY_RECEIPT_INVENTORY_INVALID");
    }
    wired = validateIndependentSecurityClearancePredicate({
      directEvidence,
      checkReceipts: [checkReceipt.receipt],
      predicateBytes: input.evidenceBytes,
      githubRunBytes: input.githubRunBytes,
      githubJobsBytes: input.githubJobsBytes,
      githubArtifactBytes: input.githubArtifactBytes,
      artifactArchiveBytes: input.artifactArchiveBytes,
      sourceFiles: input.sourceFiles,
      binding,
      evaluationUnixSeconds,
    });
  } catch (error) {
    return hold("STRUCTURAL_AUTOMATED_SECURITY_EVIDENCE_INVALID", [
      error instanceof Error ? error.message : "structural validator threw a non-Error value",
    ]);
  }
  if (!exactWiredResult(wired)) {
    return hold(
      "CURRENT_SOURCE_AUTOMATED_SECURITY_BINDING_INVALID",
      Array.isArray(wired?.violations) ? wired.violations : [],
    );
  }
  if (claims.runUrl !== structural.runUrl || claims.jobUrl !== structural.jobUrl) {
    return hold("AUTHENTICATED_GITHUB_RECEIPT_BINDING_MISMATCH");
  }

  return Object.freeze({
    schema: "iat-v2-jit-automated-security-predicate-observation/v1",
    status: JIT_AUTOMATED_SECURITY_OBSERVED_STATUS,
    observed: true,
    authenticated: true,
    hostedStateAuthenticated: true,
    predicate: INDEPENDENT_SECURITY_PREDICATE,
    structuralEvidenceBound: true,
    directEvidenceBound: true,
    checkEvidenceBound: true,
    zeroUnacceptedCriticalOrHigh: true,
    sourceCommit: binding.commit,
    sourceTree: binding.tree,
    programArtifactSha256: binding.programArtifactSha256,
    runId,
    runAttempt,
    archiveSha256: expectedCapabilityBinding.archiveSha256,
    evidenceSha256: structural.evidenceSha256,
    checkId: CURRENT_SOURCE_PREDICATE_CHECK_IDS.automatedSecurityClosure,
    checkReceiptSha256: checkReceipt.sha256,
    observedAtUtc,
    providerTimeUtc: claims.providerTimeUtc,
    runUrl: structural.runUrl,
    jobUrl: structural.jobUrl,
    clearanceValid: false,
    authorizesMainnet: false,
    authorizesRelease: false,
    mainnetStatus: "HOLD",
    blocker: "CANONICAL_CURRENT_SOURCE_AGGREGATION_STILL_REQUIRED",
    violations: Object.freeze([]),
  });
}
