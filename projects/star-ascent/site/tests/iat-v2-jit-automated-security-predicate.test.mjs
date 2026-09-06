import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  observeJitAutomatedSecurityPredicate as observeProductionPredicate,
} from "../scripts/lib/iat-v2-jit-automated-security-predicate.mjs";

const SOURCE_COMMIT = "a".repeat(40);
const SOURCE_TREE = "b".repeat(40);
const PROGRAM_ARTIFACT = "c".repeat(64);
const RUN_ID = 33_015_279_532;
const RUN_ATTEMPT = 1;
const RUN_URL = `https://github.com/InternalAgencyIO/InternalAgency/actions/runs/${RUN_ID}`;
const JOB_URL = `${RUN_URL}/job/98331771223`;
const OBSERVED_AT = "2026-08-26T21:29:07Z";
const PROVIDER_TIME = "2026-08-26T21:31:55Z";
const PROVIDER_UNIX_SECONDS = String(Date.parse(PROVIDER_TIME) / 1_000);
const MODULE_PATH = new URL(
  "../scripts/lib/iat-v2-jit-automated-security-predicate.mjs",
  import.meta.url,
);
const STRICT_JSON_MODULE_URL = new URL(
  "../scripts/validate-iat-b3-owner-policy-freeze.mjs",
  import.meta.url,
).href;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function manifestBytes(overrides = {}) {
  return Buffer.from(`${JSON.stringify({
    ciProvenance: { runId: RUN_ID, runAttempt: RUN_ATTEMPT },
    observedAtUtc: OBSERVED_AT,
    ...overrides,
  })}\n`);
}

function baseInput(overrides = {}) {
  const evidenceBytes = manifestBytes();
  const archive = Buffer.from("exact independent-security archive fixture", "utf8");
  const evidenceSha256 = sha256(evidenceBytes);
  const checkId = "INDEPENDENT_SECURITY_STRUCTURE_CHECKED_HOLD";
  const checkReceipt = {
    schema: "iat-v2-current-source-check-receipt/v1",
    predicate: "AUTOMATED_SECURITY_CLOSURE",
    checkId,
    result: "PASS",
    sourceCommit: SOURCE_COMMIT,
    programArtifactSha256: PROGRAM_ARTIFACT,
    observedAtUtc: OBSERVED_AT,
    detailsSha256: evidenceSha256,
  };
  const checkReceiptBytes = Buffer.from(`${JSON.stringify(checkReceipt, null, 2)}\n`);
  return {
    capability: null,
    directEvidence: {
      schema: "iat-v2-current-source-direct-evidence/v1",
      predicate: "AUTOMATED_SECURITY_CLOSURE",
      observationMode: "AUTOMATED_SOURCE_BOUND_DIRECT_OBSERVATION",
      sourceCommit: SOURCE_COMMIT,
      sourceTree: SOURCE_TREE,
      programArtifactSha256: PROGRAM_ARTIFACT,
      network: "source",
      observedAtUtc: OBSERVED_AT,
      receipts: [RUN_URL, JOB_URL],
      transactionSignatures: [],
      checks: [{
        id: checkId,
        result: "PASS",
        evidencePath: "public/evidence/iat-v2/current-source/checks/automatedSecurityClosure.json",
        evidenceSha256: sha256(checkReceiptBytes),
      }],
    },
    checkReceiptBytes,
    evidenceBytes,
    githubRunBytes: Buffer.from("{}\n"),
    githubJobsBytes: Buffer.from("{}\n"),
    githubArtifactBytes: Buffer.from("{}\n"),
    artifactArchiveBytes: archive,
    sourceFiles: new Map(),
    binding: {
      commit: SOURCE_COMMIT,
      tree: SOURCE_TREE,
      programArtifactSha256: PROGRAM_ARTIFACT,
    },
    ...overrides,
  };
}

function replaceCheckReceipt(input, mutate) {
  const receipt = JSON.parse(input.checkReceiptBytes);
  mutate(receipt);
  input.checkReceiptBytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
  input.directEvidence.checks[0].evidenceSha256 = sha256(input.checkReceiptBytes);
}

function expectedBinding(input) {
  const manifest = JSON.parse(input.evidenceBytes);
  return {
    runId: manifest.ciProvenance.runId,
    runAttempt: manifest.ciProvenance.runAttempt,
    sourceHeadSha: input.binding.commit,
    sourceTree: input.binding.tree,
    programArtifactSha256: input.binding.programArtifactSha256,
    archiveSha256: sha256(input.artifactArchiveBytes),
    evidenceSha256: sha256(input.evidenceBytes),
  };
}

function claimsFor(input, overrides = {}) {
  return Object.freeze({
    status: "LIVE_GITHUB_HOSTED_STATE_AUTHENTICATED_HOLD",
    authenticated: true,
    hostedStateAuthenticated: true,
    clearanceValid: false,
    authorizesMainnet: false,
    mainnetStatus: "HOLD",
    ...expectedBinding(input),
    providerTimeUtc: PROVIDER_TIME,
    runUrl: RUN_URL,
    jobUrl: JOB_URL,
    ...overrides,
  });
}

async function fixtureModule(t) {
  const directory = mkdtempSync(join(tmpdir(), "iat-v2-jit-security-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const independentPath = join(directory, "fixture-independent.mjs");
  const wiringPath = join(directory, "fixture-wiring.mjs");
  const authenticatorPath = join(directory, "fixture-authenticator.mjs");
  const subjectPath = join(directory, "subject.mjs");
  writeFileSync(independentPath, `
import { createHash } from "node:crypto";
export const INDEPENDENT_SECURITY_PREDICATE = "AUTOMATED_SECURITY_CLOSURE";
let enabled = true;
let throwNonError = false;
export const setStructuralValidity = (value) => { enabled = value; };
export const setThrowNonError = (value) => { throwNonError = value; };
export function validateIndependentSecurityEvidence(input) {
  if (throwNonError) throw "fixture non-Error";
  const evidenceSha256 = createHash("sha256").update(input.evidenceBytes).digest("hex");
  const valid = enabled === true
    && input.evaluationUnixSeconds === ${JSON.stringify(PROVIDER_UNIX_SECONDS)};
  return Object.freeze({
    status: "LIVE_AUTH_REQUIRED_HOLD", valid: false, structurallyValid: valid,
    authenticated: false, clearanceValid: false, predicate: "AUTOMATED_SECURITY_CLOSURE",
    sourceBound: valid, ciReceiptStructureBound: valid, artifactBytesBound: valid,
    allRequiredChecksPassed: valid, zeroUnacceptedCriticalOrHigh: valid,
    evidenceSha256: valid ? evidenceSha256 : null,
    sourceCommit: input.expectedSourceCommit, sourceTree: input.expectedSourceTree,
    programArtifactSha256: input.expectedProgramArtifactSha256,
    runUrl: valid ? ${JSON.stringify(RUN_URL)} : null,
    jobUrl: valid ? ${JSON.stringify(JOB_URL)} : null,
    mainnetStatus: "HOLD",
    blocker: "LIVE_GITHUB_RUN_JOB_ARTIFACT_ARCHIVE_AUTHENTICATION_REQUIRED",
    violations: Object.freeze(valid ? [] : ["fixture structural failure"]),
  });
}
`);
  writeFileSync(wiringPath, `
import { createHash } from "node:crypto";
export const CURRENT_SOURCE_PREDICATE_CHECK_IDS = Object.freeze({
  automatedSecurityClosure: "INDEPENDENT_SECURITY_STRUCTURE_CHECKED_HOLD",
});
export const CURRENT_SOURCE_PREDICATE_HOLD_STATUS = "LIVE_AUTH_REQUIRED_HOLD";
let enabled = true;
export const setWiringValidity = (value) => { enabled = value; };
export function validateIndependentSecurityClearancePredicate(input) {
  const digest = createHash("sha256").update(input.predicateBytes).digest("hex");
  const matches = input.directEvidence?.observedAtUtc === ${JSON.stringify(OBSERVED_AT)}
    && input.directEvidence?.receipts?.includes(${JSON.stringify(RUN_URL)})
    && input.directEvidence?.receipts?.includes(${JSON.stringify(JOB_URL)})
    && input.checkReceipts?.filter((item) =>
      item?.checkId === "INDEPENDENT_SECURITY_STRUCTURE_CHECKED_HOLD"
      && item?.detailsSha256 === digest).length === 1;
  const valid = enabled === true && matches
    && input.evaluationUnixSeconds === ${JSON.stringify(PROVIDER_UNIX_SECONDS)};
  return Object.freeze({
    status: "LIVE_AUTH_REQUIRED_HOLD", valid: false, structurallyValid: valid,
    authenticated: false, clearanceValid: false, predicate: "AUTOMATED_SECURITY_CLOSURE",
    mainnetStatus: "HOLD",
    blocker: "LIVE_GITHUB_RUN_JOB_ARTIFACT_ARCHIVE_AUTHENTICATION_REQUIRED",
    violations: Object.freeze(valid ? [] : ["fixture direct/check binding failure"]),
  });
}
`);
  writeFileSync(authenticatorPath, `
const claimsByCapability = new WeakMap();
let lastExpected = null;
export function mintCapability(claims) {
  const capability = Object.freeze({});
  claimsByCapability.set(capability, claims);
  return capability;
}
export const hasCapability = (capability) => claimsByCapability.has(capability);
export const getLastExpected = () => lastExpected;
export function consumeGitHubHostedStateAuthenticationCapability(capability, expected) {
  const claims = claimsByCapability.get(capability);
  if (claims === undefined) return null;
  claimsByCapability.delete(capability);
  lastExpected = structuredClone(expected);
  const keys = ["runId", "runAttempt", "sourceHeadSha", "sourceTree",
    "programArtifactSha256", "archiveSha256", "evidenceSha256"];
  return keys.every((key) => claims[key] === expected[key]) ? claims : null;
}
`);
  let source = readFileSync(MODULE_PATH, "utf8");
  source = source
    .replace("../validate-iat-b3-owner-policy-freeze.mjs", STRICT_JSON_MODULE_URL)
    .replace("./iat-v2-independent-security-evidence.mjs", "./fixture-independent.mjs")
    .replace("./iat-v2-current-source-predicate-wiring.mjs", "./fixture-wiring.mjs")
    .replace("./iat-v2-github-hosted-state-authenticator.mjs", "./fixture-authenticator.mjs");
  writeFileSync(subjectPath, source);
  const [subject, independent, wiring, authenticator] = await Promise.all([
    import(new URL(`file:///${subjectPath.replaceAll("\\", "/")}`).href),
    import(new URL(`file:///${independentPath.replaceAll("\\", "/")}`).href),
    import(new URL(`file:///${wiringPath.replaceAll("\\", "/")}`).href),
    import(new URL(`file:///${authenticatorPath.replaceAll("\\", "/")}`).href),
  ]);
  return { subject, independent, wiring, authenticator };
}

test("JIT automated-security predicate aggregation is exact, one-use, and nonauthorizing", async (t) => {
  await t.test("production default and caller JSON paths remain HOLD", () => {
    const baseline = observeProductionPredicate();
    assert.equal(baseline.status, "LIVE_AUTH_REQUIRED_HOLD");
    assert.equal(baseline.observed, false);
    assert.equal(baseline.authenticated, false);
    assert.equal(baseline.clearanceValid, false);
    assert.equal(baseline.authorizesMainnet, false);
    assert.equal(baseline.authorizesRelease, false);
    assert.equal(baseline.mainnetStatus, "HOLD");

    const callerJson = baseInput({ capability: JSON.parse("{}") });
    const callerResult = observeProductionPredicate(callerJson);
    assert.equal(callerResult.status, "LIVE_AUTH_REQUIRED_HOLD");
    assert.equal(callerResult.observed, false);
  });

  const { subject, independent, wiring, authenticator } = await fixtureModule(t);

  await t.test("exact structural, direct/check, and opaque hosted-state bindings yield observation only", () => {
    const input = baseInput();
    input.capability = authenticator.mintCapability(claimsFor(input));
    const result = subject.observeJitAutomatedSecurityPredicate(input);
    assert.equal(result.status, "AUTOMATED_SECURITY_PREDICATE_LIVE_OBSERVED_HOLD");
    assert.equal(result.observed, true);
    assert.equal(result.authenticated, true);
    assert.equal(result.hostedStateAuthenticated, true);
    assert.equal(result.predicate, "AUTOMATED_SECURITY_CLOSURE");
    assert.equal(result.structuralEvidenceBound, true);
    assert.equal(result.directEvidenceBound, true);
    assert.equal(result.checkEvidenceBound, true);
    assert.equal(result.zeroUnacceptedCriticalOrHigh, true);
    assert.equal(result.clearanceValid, false);
    assert.equal(result.authorizesMainnet, false);
    assert.equal(result.authorizesRelease, false);
    assert.equal(result.mainnetStatus, "HOLD");
    assert.equal(result.blocker, "CANONICAL_CURRENT_SOURCE_AGGREGATION_STILL_REQUIRED");
    assert.deepEqual(authenticator.getLastExpected(), expectedBinding(input));
    assert.equal(authenticator.hasCapability(input.capability), false);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.violations), true);

    const replay = subject.observeJitAutomatedSecurityPredicate(input);
    assert.equal(replay.status, "LIVE_AUTH_REQUIRED_HOLD");
    assert.equal(replay.blocker, "FRESH_OPAQUE_GITHUB_HOSTED_STATE_CAPABILITY_REQUIRED");
  });

  await t.test("capability mismatches burn before comparison and never observe", () => {
    const input = baseInput();
    input.capability = authenticator.mintCapability(claimsFor(input, {
      archiveSha256: "d".repeat(64),
    }));
    const result = subject.observeJitAutomatedSecurityPredicate(input);
    assert.equal(result.observed, false);
    assert.equal(result.blocker, "FRESH_OPAQUE_GITHUB_HOSTED_STATE_CAPABILITY_REQUIRED");
    assert.equal(authenticator.hasCapability(input.capability), false);
  });

  await t.test("every exact capability attempt burns once, including later structural/check failure", () => {
    const structuralInput = baseInput();
    structuralInput.capability = authenticator.mintCapability(claimsFor(structuralInput));
    independent.setStructuralValidity(false);
    const structuralHold = subject.observeJitAutomatedSecurityPredicate(structuralInput);
    assert.equal(structuralHold.blocker, "STRUCTURAL_AUTOMATED_SECURITY_EVIDENCE_INVALID");
    assert.equal(authenticator.hasCapability(structuralInput.capability), false);
    independent.setStructuralValidity(true);

    const checkInput = baseInput();
    replaceCheckReceipt(checkInput, (receipt) => {
      receipt.detailsSha256 = "e".repeat(64);
    });
    checkInput.capability = authenticator.mintCapability(claimsFor(checkInput));
    const checkHold = subject.observeJitAutomatedSecurityPredicate(checkInput);
    assert.equal(checkHold.blocker, "CURRENT_SOURCE_AUTOMATED_SECURITY_BINDING_INVALID");
    assert.equal(authenticator.hasCapability(checkInput.capability), false);

    wiring.setWiringValidity(false);
    const wiringInput = baseInput();
    wiringInput.capability = authenticator.mintCapability(claimsFor(wiringInput));
    const wiringHold = subject.observeJitAutomatedSecurityPredicate(wiringInput);
    assert.equal(wiringHold.blocker, "CURRENT_SOURCE_AUTOMATED_SECURITY_BINDING_INVALID");
    assert.equal(authenticator.hasCapability(wiringInput.capability), false);
    wiring.setWiringValidity(true);

    const thrownInput = baseInput();
    thrownInput.capability = authenticator.mintCapability(claimsFor(thrownInput));
    independent.setThrowNonError(true);
    const thrownHold = subject.observeJitAutomatedSecurityPredicate(thrownInput);
    assert.equal(thrownHold.blocker, "STRUCTURAL_AUTOMATED_SECURITY_EVIDENCE_INVALID");
    assert.deepEqual(thrownHold.violations, ["structural validator threw a non-Error value"]);
    assert.equal(authenticator.hasCapability(thrownInput.capability), false);
    independent.setThrowNonError(false);
  });

  await t.test("extra, symbol, proxy, revoked, and malformed bindings fail closed", () => {
    const extra = baseInput({ cachedGithubReceipt: {} });
    assert.equal(
      subject.observeJitAutomatedSecurityPredicate(extra).blocker,
      "JIT_AUTOMATED_SECURITY_INPUT_CONTRACT_REJECTED",
    );
    const symbol = baseInput();
    symbol[Symbol("caller state")] = "forged";
    assert.equal(
      subject.observeJitAutomatedSecurityPredicate(symbol).blocker,
      "JIT_AUTOMATED_SECURITY_INPUT_CONTRACT_REJECTED",
    );
    assert.equal(
      subject.observeJitAutomatedSecurityPredicate(new Proxy(baseInput(), {})).blocker,
      "JIT_AUTOMATED_SECURITY_INPUT_CONTRACT_REJECTED",
    );
    const revoked = Proxy.revocable(baseInput(), {});
    revoked.revoke();
    assert.equal(
      subject.observeJitAutomatedSecurityPredicate(revoked.proxy).blocker,
      "JIT_AUTOMATED_SECURITY_INPUT_CONTRACT_REJECTED",
    );
    const malformedBinding = baseInput();
    malformedBinding.binding.commit = "HEAD";
    assert.equal(
      subject.observeJitAutomatedSecurityPredicate(malformedBinding).blocker,
      "JIT_AUTOMATED_SECURITY_SOURCE_BINDING_REJECTED",
    );

    const traversal = baseInput();
    traversal.directEvidence.checks[0].evidencePath =
      "public/evidence/iat-v2/current-source/checks/../forged.json";
    assert.equal(
      subject.observeJitAutomatedSecurityPredicate(traversal).blocker,
      "JIT_AUTOMATED_SECURITY_NESTED_EVIDENCE_CONTRACT_REJECTED",
    );

    const extraCheck = baseInput();
    extraCheck.directEvidence.checks.push({
      ...extraCheck.directEvidence.checks[0],
      id: "EXTRA_STRUCTURE_CHECKED_HOLD",
      evidencePath: "public/evidence/iat-v2/current-source/checks/extra.json",
    });
    assert.equal(
      subject.observeJitAutomatedSecurityPredicate(extraCheck).blocker,
      "JIT_AUTOMATED_SECURITY_NESTED_EVIDENCE_CONTRACT_REJECTED",
    );

    const extraReceipt = baseInput();
    extraReceipt.directEvidence.receipts.push("https://github.com/InternalAgencyIO/InternalAgency/actions");
    extraReceipt.capability = authenticator.mintCapability(claimsFor(extraReceipt));
    assert.equal(
      subject.observeJitAutomatedSecurityPredicate(extraReceipt).blocker,
      "CURRENT_SOURCE_AUTOMATED_SECURITY_RECEIPT_INVENTORY_INVALID",
    );
    assert.equal(authenticator.hasCapability(extraReceipt.capability), false);

    const wrongCheckDigest = baseInput();
    wrongCheckDigest.directEvidence.checks[0].evidenceSha256 = "e".repeat(64);
    assert.equal(
      subject.observeJitAutomatedSecurityPredicate(wrongCheckDigest).blocker,
      "JIT_AUTOMATED_SECURITY_NESTED_EVIDENCE_CONTRACT_REJECTED",
    );

    const wrongCheckBytes = baseInput();
    wrongCheckBytes.checkReceiptBytes = Buffer.from("{}\n");
    wrongCheckBytes.directEvidence.checks[0].evidenceSha256 = sha256(wrongCheckBytes.checkReceiptBytes);
    assert.equal(
      subject.observeJitAutomatedSecurityPredicate(wrongCheckBytes).blocker,
      "JIT_AUTOMATED_SECURITY_NESTED_EVIDENCE_CONTRACT_REJECTED",
    );

    const noncanonicalCheck = baseInput();
    noncanonicalCheck.checkReceiptBytes = Buffer.from(JSON.stringify(
      JSON.parse(noncanonicalCheck.checkReceiptBytes),
    ));
    noncanonicalCheck.directEvidence.checks[0].evidenceSha256 = sha256(
      noncanonicalCheck.checkReceiptBytes,
    );
    assert.equal(
      subject.observeJitAutomatedSecurityPredicate(noncanonicalCheck).blocker,
      "JIT_AUTOMATED_SECURITY_NESTED_EVIDENCE_CONTRACT_REJECTED",
    );

    const duplicateCheck = baseInput();
    duplicateCheck.checkReceiptBytes = Buffer.from(
      duplicateCheck.checkReceiptBytes.toString("utf8").replace(
        "{\n",
        "{\n  \"schema\": \"iat-v2-current-source-check-receipt/v1\",\n",
      ),
    );
    duplicateCheck.directEvidence.checks[0].evidenceSha256 = sha256(
      duplicateCheck.checkReceiptBytes,
    );
    assert.equal(
      subject.observeJitAutomatedSecurityPredicate(duplicateCheck).blocker,
      "JIT_AUTOMATED_SECURITY_NESTED_EVIDENCE_CONTRACT_REJECTED",
    );

    const hostileArchive = baseInput({
      artifactArchiveBytes: new Proxy({}, {
        get() {
          throw new Error("caller conversion must not escape");
        },
      }),
    });
    assert.equal(
      subject.observeJitAutomatedSecurityPredicate(hostileArchive).blocker,
      "AUTOMATED_SECURITY_CAPABILITY_BINDING_INVALID",
    );

    for (const nested of [
      (() => {
        const input = baseInput();
        input.directEvidence = new Proxy(input.directEvidence, {});
        return input;
      })(),
      (() => {
        const input = baseInput();
        input.directEvidence.receipts = new Proxy(input.directEvidence.receipts, {});
        return input;
      })(),
      (() => {
        const input = baseInput();
        Object.defineProperty(input.directEvidence, "observedAtUtc", {
          enumerable: true,
          get: () => OBSERVED_AT,
        });
        return input;
      })(),
      (() => {
        const input = baseInput();
        input.checkReceiptBytes = new Proxy(input.checkReceiptBytes, {});
        return input;
      })(),
    ]) {
      assert.equal(
        subject.observeJitAutomatedSecurityPredicate(nested).blocker,
        "JIT_AUTOMATED_SECURITY_NESTED_EVIDENCE_CONTRACT_REJECTED",
      );
    }
  });
});
