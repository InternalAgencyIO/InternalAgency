#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  IAT_B3_NATIVE_CONTAINMENT_AUTHORITY_SOURCE,
  assessNativeContainmentPreflight,
  observeNativeContainmentAuthoritySource,
  observeNativeContainmentBuildContractClosure,
  observeNativeContainmentSourceClosure,
  parseJsonRejectingDuplicateKeys,
  sha256,
} from "./lib/iat-b3-mandatory-ci-containment-contract.mjs";

export const IAT_B3_NATIVE_CONTAINMENT_BUILD_RUNNER_SCHEMA =
  "iat-b3-mandatory-ci-containment-build-runner/v2";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SITE_ROOT = resolve(dirname(SCRIPT_PATH), "..");
const REPOSITORY_ROOT = resolve(SITE_ROOT, "../../..");
const POLICY_PATH = resolve(
  SITE_ROOT,
  "docs/b3/iat-b3-mandatory-ci-containment-toolchains.v1.json",
);

function hold(blockers, extra = {}) {
  return Object.freeze({
    schema: IAT_B3_NATIVE_CONTAINMENT_BUILD_RUNNER_SCHEMA,
    status: "HOLD",
    ready: false,
    complete: false,
    buildAuthorized: false,
    buildProvenanceObserved: false,
    executionProvenanceObserved: false,
    runtimeEvidenceObserved: false,
    buildExecuted: false,
    compilerObserved: false,
    outputRootTouched: false,
    blockers: Object.freeze([...new Set(blockers)]),
    ...extra,
  });
}

export function parseNativeContainmentBuildArguments(arguments_) {
  if (!Array.isArray(arguments_)) throw new Error("NATIVE_BUILD_ARGUMENTS_ARRAY_REQUIRED_HOLD");
  if (arguments_.length === 0) return Object.freeze({ mode: "PREFLIGHT" });
  throw new Error("NATIVE_BUILD_EXECUTION_API_ABSENT_HOLD");
}

function loadPolicy(policyPath = POLICY_PATH) {
  const bytes = readFileSync(policyPath);
  return Object.freeze({
    bytes,
    sha256: sha256(bytes),
    value: parseJsonRejectingDuplicateKeys(bytes.toString("utf8")),
  });
}

export function assessNativeContainmentBuildAuthorization({
  explicitExecuteRequest = false,
  checkedInPolicyAuthorization = false,
  authoritySource = IAT_B3_NATIVE_CONTAINMENT_AUTHORITY_SOURCE,
} = {}) {
  const blockers = [];
  if (explicitExecuteRequest !== true) blockers.push("EXPLICIT_OFFLINE_BUILD_REQUEST_ABSENT");
  if (checkedInPolicyAuthorization !== true) blockers.push("CHECKED_IN_BUILD_AUTHORIZATION_FALSE");
  if (authoritySource.sha256 !== IAT_B3_NATIVE_CONTAINMENT_AUTHORITY_SOURCE.sha256
    || authoritySource.compileOrExecuteAuthorized !== false
    || authoritySource.status !== "HOLD") {
    blockers.push("DIRECT_AUTHORITY_SOURCE_MISMATCH");
  }
  blockers.push(
    "DIRECT_BUILD_AUTHORITY_FALSE",
    "CANONICAL_EXTERNAL_PREIMAGE_BUNDLE_UNAVAILABLE",
    "CANONICAL_BUILD_PLAN_AND_CAUSATION_UNAVAILABLE",
    "OBSERVER_GROUNDED_RESOURCE_AND_CLEANUP_UNAVAILABLE",
    "OBSERVER_OWNED_TOOLCHAIN_CLOSURE_UNAVAILABLE",
    "OBSERVER_OWNED_TWO_BUILD_RECEIPT_UNAVAILABLE",
    "PHASE_B_NATIVE_BUILD_HARD_DISABLED",
  );
  return Object.freeze({
    authorized: false,
    conjunctionObserved: explicitExecuteRequest === true
      && checkedInPolicyAuthorization === true,
    blockers: Object.freeze(blockers),
  });
}

export async function runNativeContainmentBuildPreflight({
  repositoryRoot = REPOSITORY_ROOT,
  policyPath = POLICY_PATH,
  exactSourceObservation = undefined,
} = {}) {
  const policy = loadPolicy(policyPath);
  const sourceClosure = observeNativeContainmentSourceClosure(repositoryRoot);
  const buildContractClosure =
    observeNativeContainmentBuildContractClosure(repositoryRoot);
  const authoritySourceObservation =
    observeNativeContainmentAuthoritySource(repositoryRoot);
  const assessment = assessNativeContainmentPreflight({
    policy: policy.value,
    sourceClosure,
    buildContractClosure,
    authoritySourceObservation,
    headSha: exactSourceObservation?.headSha ?? null,
    treeSha: exactSourceObservation?.treeSha ?? null,
  });
  return hold([
    "PHASE_B_NATIVE_BUILD_HARD_DISABLED",
    ...assessment.blockers,
  ], {
    policySha256: policy.sha256,
    sourceClosureSha256: sourceClosure.closureSha256,
    buildContractClosureSha256: buildContractClosure.closureSha256,
    authoritySourceSha256: authoritySourceObservation.sha256,
    preflight: assessment,
  });
}

export async function runNativeContainmentReproducibleBuild(_ignored = undefined) {
  const authorization = assessNativeContainmentBuildAuthorization();
  /* BP06 is a structural contract only.  No callback, executable, output
     path, compiler, helper, or caller receipt is consulted in this function. */
  return hold([
    ...authorization.blockers,
    "NO_EXECUTION_IMPLEMENTATION_IN_BP06",
    "CALLER_OPTIONS_ARE_NONAUTHORITATIVE",
    "OBSERVER_OWNED_TWO_BUILD_RECEIPT_UNAVAILABLE",
    "SAME_OBJECT_EXECUTION_BINDING_UNPROVEN",
  ], {
    authorizationConjunctionObserved: authorization.conjunctionObserved,
  });
}

async function main() {
  parseNativeContainmentBuildArguments(process.argv.slice(2));
  const report = await runNativeContainmentBuildPreflight();
  process.stdout.write(`${JSON.stringify(report)}\n`);
  process.exitCode = 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({
      schema: IAT_B3_NATIVE_CONTAINMENT_BUILD_RUNNER_SCHEMA,
      status: "ASSESSMENT_ERROR",
      ready: false,
      complete: false,
      executionProvenanceObserved: false,
      code: typeof error?.code === "string" ? error.code : error?.message ?? "UNCLASSIFIED_BUILD_ERROR",
    })}\n`);
    process.exitCode = 1;
  });
}
