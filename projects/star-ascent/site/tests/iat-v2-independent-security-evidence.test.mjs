import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  assembleIndependentSecurityEvidence,
} from "../scripts/build-iat-v2-independent-security-evidence.mjs";
import {
  CURRENT_SOURCE_PREDICATE_CHECK_IDS,
  CURRENT_SOURCE_PREDICATE_HOLD_STATUS,
  validateIndependentSecurityClearancePredicate,
} from "../scripts/lib/iat-v2-current-source-predicate-wiring.mjs";
import {
  INDEPENDENT_SECURITY_ARTIFACT_NAME,
  INDEPENDENT_SECURITY_CHECK_SPECS,
  INDEPENDENT_SECURITY_EVIDENCE_SCHEMA,
  INDEPENDENT_SECURITY_LOCKFILE_PATHS,
  INDEPENDENT_SECURITY_MANIFEST_PATH,
  INDEPENDENT_SECURITY_REQUIRED_JOB_STEPS,
  INDEPENDENT_SECURITY_SOURCE_PATHS,
  INDEPENDENT_SECURITY_TOOL_OUTPUT_PATHS,
  INDEPENDENT_SECURITY_WORKFLOW_JOB_KEY,
  INDEPENDENT_SECURITY_WORKFLOW_JOB_NAME,
  INDEPENDENT_SECURITY_WORKFLOW_PATH,
  independentSecurityCanonicalBytes,
  validateIndependentSecurityEvidence,
} from "../scripts/lib/iat-v2-independent-security-evidence.mjs";

const SOURCE_COMMIT = "a".repeat(40);
const SOURCE_TREE = "b".repeat(40);
const PROGRAM_ARTIFACT = "c".repeat(64);
const RUN_ID = 32_960_000_001;
const RUN_ATTEMPT = 1;
const JOB_ID = 98_200_000_001;
const ARTIFACT_ID = 5_300_000_001;
const OBSERVED_AT = "2026-08-26T07:04:00Z";
const EVALUATION = "1787727900";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const checkSpec = (id) => {
  const specification = INDEPENDENT_SECURITY_CHECK_SPECS.find((candidate) => candidate.id === id);
  assert(specification, `missing check specification ${id}`);
  return specification;
};

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
}

function npmAudit({ critical = 0, high = 0, moderate = 0, low = 0, info = 0 } = {}) {
  return jsonBytes({
    auditReportVersion: 2,
    vulnerabilities: {},
    metadata: {
      vulnerabilities: {
        info,
        low,
        moderate,
        high,
        critical,
        total: info + low + moderate + high + critical,
      },
    },
  });
}

function cargoAudit({ includeInformational = true, databaseCommit = "d".repeat(40) } = {}) {
  return jsonBytes({
    database: {
      "advisory-count": 1207,
      "last-commit": databaseCommit,
      "last-updated": "2026-08-26T06:55:00Z",
    },
    lockfile: { "dependency-count": 234 },
    vulnerabilities: { count: 0, list: [] },
    warnings: includeInformational ? {
      unmaintained: [{
        advisory: {
          id: "RUSTSEC-2025-0141",
          package: "bincode",
          title: "bincode is unmaintained",
        },
        versions: { patched: [], unaffected: [] },
      }],
    } : {},
  });
}

function tapResult() {
  return Buffer.from([
    "TAP version 13",
    "# Subtest: security one",
    "ok 1 - security one",
    "# Subtest: security two",
    "ok 2 - security two",
    "1..2",
    "# tests 2",
    "# suites 0",
    "# pass 2",
    "# fail 0",
    "# cancelled 0",
    "# skipped 0",
    "# todo 0",
    "# duration_ms 1",
    "",
  ].join("\n"), "utf8");
}

function rawOutputs(overrides = {}) {
  const values = new Map([
    [INDEPENDENT_SECURITY_TOOL_OUTPUT_PATHS[0], Buffer.from("v24.7.0\n")],
    [INDEPENDENT_SECURITY_TOOL_OUTPUT_PATHS[1], Buffer.from("11.6.0\n")],
    [INDEPENDENT_SECURITY_TOOL_OUTPUT_PATHS[2], Buffer.from("cargo-audit 0.22.2\n")],
    [checkSpec("NPM_SITE_AUDIT").rawPath, npmAudit({ low: 1 })],
    [checkSpec("CARGO_SITE_AUDIT").rawPath, cargoAudit()],
    [checkSpec("CARGO_ACCOUNT_LIFECYCLE_AUDIT").rawPath, cargoAudit()],
    [checkSpec("CARGO_STAKE_INGRESS_AUDIT").rawPath, cargoAudit()],
    [checkSpec("SECURITY_REGRESSION_SUITE").rawPath, tapResult()],
  ]);
  for (const { exitCodePath } of INDEPENDENT_SECURITY_CHECK_SPECS) {
    values.set(exitCodePath, Buffer.from("0\n"));
  }
  for (const [path, bytes] of Object.entries(overrides)) values.set(path, bytes);
  return values;
}

function sourceFiles() {
  return new Map(INDEPENDENT_SECURITY_SOURCE_PATHS.map((path, index) => [
    path,
    Buffer.from(`${index}:${path}\n`, "utf8"),
  ]));
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

function storeZip(entries) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  for (const [name, value] of [...entries].sort(([left], [right]) => left.localeCompare(right))) {
    const nameBytes = Buffer.from(name, "utf8");
    const bytes = Buffer.from(value);
    const crc = crc32(bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(bytes.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    localParts.push(local, nameBytes, bytes);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x031e, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(bytes.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(localOffset, 42);
    centralParts.push(central, nameBytes);
    localOffset += local.length + nameBytes.length + bytes.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const localDirectory = Buffer.concat(localParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.size, 8);
  end.writeUInt16LE(entries.size, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localDirectory.length, 16);
  return Buffer.concat([localDirectory, centralDirectory, end]);
}

function receipts(archive) {
  const runUrl = `https://github.com/InternalAgencyIO/InternalAgency/actions/runs/${RUN_ID}`;
  const jobUrl = `${runUrl}/job/${JOB_ID}`;
  return {
    run: jsonBytes({
      id: RUN_ID,
      run_attempt: RUN_ATTEMPT,
      event: "pull_request",
      status: "completed",
      conclusion: "success",
      head_sha: SOURCE_COMMIT,
      path: INDEPENDENT_SECURITY_WORKFLOW_PATH,
      repository: { id: 1_313_660_798, full_name: "InternalAgencyIO/InternalAgency" },
      html_url: runUrl,
      created_at: "2026-08-26T07:00:00Z",
      updated_at: "2026-08-26T07:06:00Z",
    }),
    jobs: jsonBytes({
      total_count: 1,
      jobs: [{
        id: JOB_ID,
        run_id: RUN_ID,
        run_attempt: RUN_ATTEMPT,
        head_sha: SOURCE_COMMIT,
        status: "completed",
        conclusion: "success",
        name: INDEPENDENT_SECURITY_WORKFLOW_JOB_NAME,
        labels: ["ubuntu-24.04"],
        html_url: jobUrl,
        started_at: "2026-08-26T07:00:00Z",
        completed_at: "2026-08-26T07:05:00Z",
        steps: INDEPENDENT_SECURITY_REQUIRED_JOB_STEPS.map((name, index) => ({
          name,
          status: "completed",
          conclusion: "success",
          number: index + 1,
        })),
      }],
    }),
    artifact: jsonBytes({
      id: ARTIFACT_ID,
      name: INDEPENDENT_SECURITY_ARTIFACT_NAME,
      size_in_bytes: archive.length,
      expired: false,
      digest: `sha256:${sha256(archive)}`,
      workflow_run: { id: RUN_ID, head_sha: SOURCE_COMMIT },
      archive_download_url: `https://api.github.com/repos/InternalAgencyIO/InternalAgency/actions/artifacts/${ARTIFACT_ID}/zip`,
      created_at: "2026-08-26T07:04:30Z",
      expires_at: "2026-09-25T07:04:30Z",
    }),
  };
}

function fixture() {
  const raw = rawOutputs();
  const sources = sourceFiles();
  const evidence = assembleIndependentSecurityEvidence({
    rawOutputs: raw,
    sourceFiles: sources,
    sourceBinding: {
      commit: SOURCE_COMMIT,
      tree: SOURCE_TREE,
      programArtifactSha256: PROGRAM_ARTIFACT,
    },
    ciContext: {
      serverUrl: "https://github.com",
      repository: "InternalAgencyIO/InternalAgency",
      repositoryId: 1_313_660_798,
      workflowRef: "InternalAgencyIO/InternalAgency/.github/workflows/iat-v2-independent-security-evidence.yml@refs/pull/14/merge",
      runId: RUN_ID,
      runAttempt: RUN_ATTEMPT,
      eventName: "pull_request",
      sourceHeadSha: SOURCE_COMMIT,
      checkoutSha: SOURCE_COMMIT,
      jobKey: INDEPENDENT_SECURITY_WORKFLOW_JOB_KEY,
      runnerOs: "Linux",
      runnerArch: "X64",
    },
    observedAtUtc: OBSERVED_AT,
  });
  return packageEvidence({ evidence, raw, sources });
}

function packageEvidence({ evidence, raw, sources }) {
  const evidenceBytes = independentSecurityCanonicalBytes(evidence);
  const archiveEntries = new Map([
    [INDEPENDENT_SECURITY_MANIFEST_PATH, evidenceBytes],
    ["raw/", Buffer.alloc(0)],
    ...raw,
  ]);
  const archive = storeZip(archiveEntries);
  return { evidence, evidenceBytes, raw, sources, archive, ...receipts(archive) };
}

function validate(value, overrides = {}) {
  return validateIndependentSecurityEvidence({
    evidenceBytes: value.evidenceBytes,
    githubRunBytes: value.run,
    githubJobsBytes: value.jobs,
    githubArtifactBytes: value.artifact,
    artifactArchiveBytes: value.archive,
    sourceFiles: value.sources,
    expectedSourceCommit: SOURCE_COMMIT,
    expectedSourceTree: SOURCE_TREE,
    expectedProgramArtifactSha256: PROGRAM_ARTIFACT,
    evaluationUnixSeconds: EVALUATION,
    ...overrides,
  });
}

function mutateJsonBytes(bytes, mutate) {
  const value = JSON.parse(bytes);
  mutate(value);
  return jsonBytes(value);
}

test("assembler derives zero Critical/High and preserves unresolved RUSTSEC-2025-0141", () => {
  const value = fixture();
  assert.equal(value.evidence.schema, INDEPENDENT_SECURITY_EVIDENCE_SCHEMA);
  assert.equal(INDEPENDENT_SECURITY_EVIDENCE_SCHEMA, "iat-v2-independent-security-evidence/v2");
  assert.deepEqual(INDEPENDENT_SECURITY_LOCKFILE_PATHS, [
    "projects/star-ascent/site/package-lock.json",
    "projects/star-ascent/site/Cargo.lock",
    "projects/star-ascent/site/tests/fixtures/iat-b3-account-lifecycle/Cargo.lock",
    "projects/star-ascent/site/tests/fixtures/iat-b3-stake-ingress/Cargo.lock",
  ]);
  assert.equal(INDEPENDENT_SECURITY_SOURCE_PATHS.includes("package-lock.json"), false);
  assert.equal(INDEPENDENT_SECURITY_CHECK_SPECS.some(({ id }) => id === "NPM_ROOT_AUDIT"), false);
  assert.equal(value.evidence.findingSummary.critical, 0);
  assert.equal(value.evidence.findingSummary.high, 0);
  assert.equal(value.evidence.findingSummary.zeroUnacceptedCriticalOrHigh, true);
  assert.deepEqual(value.evidence.findingSummary.unresolvedInformational, [{
    id: "RUSTSEC-2025-0141",
    package: "bincode",
    version: "1.3.3",
    classification: "UNMAINTAINED_NOT_KNOWN_VULNERABLE",
    accepted: false,
    disposition: "UNRESOLVED_INFORMATIONAL",
  }]);
  assert.equal(value.evidence.mainnetStatus, "HOLD");
});

test("caller GitHub JSON, ZIP, and evaluation time remain structural-only HOLD", () => {
  const value = fixture();
  const result = validate(value);
  assert.equal(result.status, CURRENT_SOURCE_PREDICATE_HOLD_STATUS);
  assert.equal(result.structurallyValid, true, result.violations.join("\n"));
  assert.equal(result.valid, false);
  assert.equal(result.authenticated, false);
  assert.equal(result.clearanceValid, false);
  assert.equal(result.sourceBound, true);
  assert.equal(result.ciReceiptStructureBound, true);
  assert.equal(result.artifactBytesBound, true);
  assert.equal(result.allRequiredChecksPassed, true);
  assert.equal(result.zeroUnacceptedCriticalOrHigh, true);
  assert.match(result.evidenceSha256, /^[0-9a-f]{64}$/u);
  assert.equal(result.mainnetStatus, "HOLD");

  const wired = validateIndependentSecurityClearancePredicate({
    directEvidence: {
      observedAtUtc: value.evidence.observedAtUtc,
      receipts: [result.runUrl, result.jobUrl],
    },
    checkReceipts: [{
      checkId: CURRENT_SOURCE_PREDICATE_CHECK_IDS.automatedSecurityClosure,
      detailsSha256: result.evidenceSha256,
    }],
    predicateBytes: value.evidenceBytes,
    githubRunBytes: value.run,
    githubJobsBytes: value.jobs,
    githubArtifactBytes: value.artifact,
    artifactArchiveBytes: value.archive,
    sourceFiles: value.sources,
    binding: {
      commit: SOURCE_COMMIT,
      tree: SOURCE_TREE,
      programArtifactSha256: PROGRAM_ARTIFACT,
    },
    evaluationUnixSeconds: EVALUATION,
  });
  assert.equal(wired.status, CURRENT_SOURCE_PREDICATE_HOLD_STATUS);
  assert.equal(wired.structurallyValid, true, wired.violations.join("\n"));
  assert.equal(wired.valid, false);
  assert.equal(wired.authenticated, false);
  assert.equal(wired.clearanceValid, false);
  assert.equal(wired.mainnetStatus, "HOLD");
  assert.equal(wired.blocker, "LIVE_GITHUB_RUN_JOB_ARTIFACT_ARCHIVE_AUTHENTICATION_REQUIRED");
  assert.equal(Object.hasOwn(wired, "result"), false, "caller-provided CI authentication claims must not escape");
});

test("assembler rejects observed Critical or High npm findings instead of accepting a PASS flag", () => {
  const baseline = fixture();
  const raw = rawOutputs({
    [checkSpec("NPM_SITE_AUDIT").rawPath]: npmAudit({ high: 1 }),
  });
  assert.throws(
    () => assembleIndependentSecurityEvidence({
      rawOutputs: raw,
      sourceFiles: baseline.sources,
      sourceBinding: { commit: SOURCE_COMMIT, tree: SOURCE_TREE, programArtifactSha256: PROGRAM_ARTIFACT },
      ciContext: baseline.evidence.ciProvenance && {
        serverUrl: "https://github.com",
        repository: "InternalAgencyIO/InternalAgency",
        repositoryId: 1_313_660_798,
        workflowRef: baseline.evidence.ciProvenance.workflowRef,
        runId: RUN_ID,
        runAttempt: RUN_ATTEMPT,
        eventName: "pull_request",
        sourceHeadSha: SOURCE_COMMIT,
        checkoutSha: SOURCE_COMMIT,
        jobKey: INDEPENDENT_SECURITY_WORKFLOW_JOB_KEY,
        runnerOs: "Linux",
        runnerArch: "X64",
      },
      observedAtUtc: OBSERVED_AT,
    }),
    /observed Critical or High/u,
  );
});

test("successor v2 rejects repository-root lock and audit bytes as out-of-scope extras", () => {
  const value = fixture();
  const raw = rawOutputs();
  raw.set("raw/npm-root-audit.json", npmAudit());
  raw.set("raw/npm-root-audit.exit-code.txt", Buffer.from("0\n"));
  assert.throws(
    () => assembleIndependentSecurityEvidence({
      rawOutputs: raw,
      sourceFiles: value.sources,
      sourceBinding: { commit: SOURCE_COMMIT, tree: SOURCE_TREE, programArtifactSha256: PROGRAM_ARTIFACT },
      ciContext: {
        serverUrl: "https://github.com",
        repository: "InternalAgencyIO/InternalAgency",
        repositoryId: 1_313_660_798,
        workflowRef: value.evidence.ciProvenance.workflowRef,
        runId: RUN_ID,
        runAttempt: RUN_ATTEMPT,
        eventName: "pull_request",
        sourceHeadSha: SOURCE_COMMIT,
        checkoutSha: SOURCE_COMMIT,
        jobKey: INDEPENDENT_SECURITY_WORKFLOW_JOB_KEY,
        runnerOs: "Linux",
        runnerArch: "X64",
      },
      observedAtUtc: OBSERVED_AT,
    }),
    /exact caller-supplied byte inventory/u,
  );

  const sources = new Map(value.sources);
  sources.set("package-lock.json", Buffer.from("{}\n"));
  assert.equal(validate(value, { sourceFiles: sources }).structurallyValid, false);
  assert.match(validate(value, { sourceFiles: sources }).violations.join("\n"), /exact committed byte map/u);
  assert.throws(
    () => assembleIndependentSecurityEvidence({
      rawOutputs: rawOutputs(),
      sourceFiles: sources,
      sourceBinding: { commit: SOURCE_COMMIT, tree: SOURCE_TREE, programArtifactSha256: PROGRAM_ARTIFACT },
      ciContext: {
        serverUrl: "https://github.com",
        repository: "InternalAgencyIO/InternalAgency",
        repositoryId: 1_313_660_798,
        workflowRef: value.evidence.ciProvenance.workflowRef,
        runId: RUN_ID,
        runAttempt: RUN_ATTEMPT,
        eventName: "pull_request",
        sourceHeadSha: SOURCE_COMMIT,
        checkoutSha: SOURCE_COMMIT,
        jobKey: INDEPENDENT_SECURITY_WORKFLOW_JOB_KEY,
        runnerOs: "Linux",
        runnerArch: "X64",
      },
      observedAtUtc: OBSERVED_AT,
    }),
    /exact caller-supplied byte inventory/u,
  );
});

test("assembler rejects omission of the unresolved informational finding", () => {
  const value = fixture();
  const raw = rawOutputs({
    [checkSpec("CARGO_SITE_AUDIT").rawPath]: cargoAudit({ includeInformational: false }),
  });
  assert.throws(
    () => assembleIndependentSecurityEvidence({
      rawOutputs: raw,
      sourceFiles: value.sources,
      sourceBinding: { commit: SOURCE_COMMIT, tree: SOURCE_TREE, programArtifactSha256: PROGRAM_ARTIFACT },
      ciContext: {
        serverUrl: "https://github.com",
        repository: "InternalAgencyIO/InternalAgency",
        repositoryId: 1_313_660_798,
        workflowRef: value.evidence.ciProvenance.workflowRef,
        runId: RUN_ID,
        runAttempt: RUN_ATTEMPT,
        eventName: "pull_request",
        sourceHeadSha: SOURCE_COMMIT,
        checkoutSha: SOURCE_COMMIT,
        jobKey: INDEPENDENT_SECURITY_WORKFLOW_JOB_KEY,
        runnerOs: "Linux",
        runnerArch: "X64",
      },
      observedAtUtc: OBSERVED_AT,
    }),
    /RUSTSEC-2025-0141 informational truth is missing/u,
  );
});

test("assembler and validator require exact zero tool exit-code receipt bytes", () => {
  const value = fixture();
  const raw = rawOutputs({
    [checkSpec("NPM_SITE_AUDIT").exitCodePath]: Buffer.from("1\n"),
  });
  assert.throws(
    () => assembleIndependentSecurityEvidence({
      rawOutputs: raw,
      sourceFiles: value.sources,
      sourceBinding: { commit: SOURCE_COMMIT, tree: SOURCE_TREE, programArtifactSha256: PROGRAM_ARTIFACT },
      ciContext: {
        serverUrl: "https://github.com",
        repository: "InternalAgencyIO/InternalAgency",
        repositoryId: 1_313_660_798,
        workflowRef: value.evidence.ciProvenance.workflowRef,
        runId: RUN_ID,
        runAttempt: RUN_ATTEMPT,
        eventName: "pull_request",
        sourceHeadSha: SOURCE_COMMIT,
        checkoutSha: SOURCE_COMMIT,
        jobKey: INDEPENDENT_SECURITY_WORKFLOW_JOB_KEY,
        runnerOs: "Linux",
        runnerArch: "X64",
      },
      observedAtUtc: OBSERVED_AT,
    }),
    /exact zero exit-code receipt required/u,
  );

  const drift = fixture();
  drift.raw = new Map(drift.raw);
  drift.raw.set(checkSpec("NPM_SITE_AUDIT").exitCodePath, Buffer.from("1\n"));
  const repackaged = packageEvidence({ evidence: drift.evidence, raw: drift.raw, sources: drift.sources });
  assert.equal(validate(repackaged).structurallyValid, false);
  assert.match(validate(repackaged).violations.join("\n"), /exit code|raw artifact bytes/iu);
});

test("run or job failure cannot authenticate independently completed CI", () => {
  const runFailure = fixture();
  runFailure.run = mutateJsonBytes(runFailure.run, (run) => { run.conclusion = "failure"; });
  assert.equal(validate(runFailure).structurallyValid, false);
  assert.match(validate(runFailure).violations.join("\n"), /GitHub run receipt/u);

  const jobFailure = fixture();
  jobFailure.jobs = mutateJsonBytes(jobFailure.jobs, (jobs) => {
    jobs.jobs[0].steps[3].conclusion = "failure";
  });
  assert.equal(validate(jobFailure).structurallyValid, false);
  assert.match(validate(jobFailure).violations.join("\n"), /GitHub jobs receipt/u);
});

test("malformed GitHub run, job, and artifact dates return invalid results without throwing", () => {
  for (const target of ["run", "jobs", "artifact"]) {
    const value = fixture();
    if (target === "run") {
      value.run = mutateJsonBytes(value.run, (run) => { run.created_at = "not-a-date"; });
    } else if (target === "jobs") {
      value.jobs = mutateJsonBytes(value.jobs, (jobs) => { jobs.jobs[0].started_at = "not-a-date"; });
    } else {
      value.artifact = mutateJsonBytes(value.artifact, (artifact) => { artifact.created_at = "not-a-date"; });
    }
    assert.doesNotThrow(() => validate(value));
    assert.equal(validate(value).structurallyValid, false);
  }
});

test("artifact digest, size, expiration, and exact archive bytes fail closed", () => {
  const digestDrift = fixture();
  digestDrift.artifact = mutateJsonBytes(digestDrift.artifact, (artifact) => {
    artifact.digest = `sha256:${"0".repeat(64)}`;
  });
  assert.equal(validate(digestDrift).structurallyValid, false);

  const expired = fixture();
  expired.artifact = mutateJsonBytes(expired.artifact, (artifact) => { artifact.expired = true; });
  assert.equal(validate(expired).structurallyValid, false);

  const archiveDrift = fixture();
  archiveDrift.archive = Buffer.from(archiveDrift.archive);
  archiveDrift.archive[40] ^= 1;
  assert.equal(validate(archiveDrift).structurallyValid, false);
});

test("source, program artifact, workflow bytes, and evidence header tampering fail closed", () => {
  const value = fixture();
  assert.equal(validate(value, { expectedSourceTree: "e".repeat(40) }).structurallyValid, false);
  assert.equal(validate(value, { expectedProgramArtifactSha256: "f".repeat(64) }).structurallyValid, false);

  const workflowDrift = fixture();
  workflowDrift.sources = new Map(workflowDrift.sources);
  workflowDrift.sources.set(INDEPENDENT_SECURITY_WORKFLOW_PATH, Buffer.from("changed workflow\n"));
  assert.equal(validate(workflowDrift).structurallyValid, false);

  const changed = structuredClone(value.evidence);
  changed.mainnetStatus = "GO";
  const repackaged = packageEvidence({ evidence: changed, raw: value.raw, sources: value.sources });
  assert.equal(validate(repackaged).structurallyValid, false);
  assert.match(validate(repackaged).violations.join("\n"), /Mainnet HOLD/u);
});

test("expired evidence and noncanonical evidence encoding fail closed", () => {
  const value = fixture();
  assert.equal(validate(value, { evaluationUnixSeconds: "1787728800" }).structurallyValid, false);

  const noncanonical = fixture();
  noncanonical.evidenceBytes = Buffer.from(`${JSON.stringify(noncanonical.evidence, null, 2)}\n`);
  const archiveEntries = new Map([
    [INDEPENDENT_SECURITY_MANIFEST_PATH, noncanonical.evidenceBytes],
    ["raw/", Buffer.alloc(0)],
    ...noncanonical.raw,
  ]);
  noncanonical.archive = storeZip(archiveEntries);
  Object.assign(noncanonical, receipts(noncanonical.archive));
  assert.equal(validate(noncanonical).structurallyValid, false);
  assert.match(validate(noncanonical).violations.join("\n"), /RFC8785 canonical JSON/u);
});

test("schema keeps the evidence and safety surfaces strict and Mainnet HOLD", () => {
  const historicalSchema = JSON.parse(readFileSync(
    new URL("../docs/b3/iat-v2-independent-security-evidence.v1.schema.json", import.meta.url),
    "utf8",
  ));
  const schema = JSON.parse(readFileSync(
    new URL("../docs/b3/iat-v2-independent-security-evidence.v2.schema.json", import.meta.url),
    "utf8",
  ));
  assert.equal(schema.additionalProperties, false);
  assert.equal(historicalSchema.properties.schema.const, "iat-v2-independent-security-evidence/v1");
  assert.equal(historicalSchema.properties.checks.minItems, 6);
  assert.equal(historicalSchema.$defs.check.properties.id.enum.includes("NPM_ROOT_AUDIT"), true);
  assert.equal(historicalSchema.$defs.artifactContract.properties.name.const, "iat-v2-independent-security-evidence");
  assert.equal(schema.properties.schema.const, INDEPENDENT_SECURITY_EVIDENCE_SCHEMA);
  assert.equal(schema.properties.inputBindings.minItems, INDEPENDENT_SECURITY_SOURCE_PATHS.length);
  assert.equal(schema.properties.checks.minItems, INDEPENDENT_SECURITY_CHECK_SPECS.length);
  assert.equal(schema.$defs.artifactContract.properties.name.const, INDEPENDENT_SECURITY_ARTIFACT_NAME);
  assert.equal(schema.$defs.artifactContract.properties.manifestPath.const, INDEPENDENT_SECURITY_MANIFEST_PATH);
  assert.equal(schema.$defs.check.properties.id.enum.includes("NPM_ROOT_AUDIT"), false);
  assert.equal(schema.properties.mainnetStatus.const, "HOLD");
  assert.equal(schema.properties.status.const, "SECURITY_SUITE_COMPLETE_HOLD");
  assert.equal(schema.$defs.findingSummary.properties.critical.const, 0);
  assert.equal(schema.$defs.findingSummary.properties.high.const, 0);
  assert.equal(schema.$defs.safety.properties.authorizesMainnet.const, false);
  assert.equal(schema.$defs.inputBinding.additionalProperties, false);
});
