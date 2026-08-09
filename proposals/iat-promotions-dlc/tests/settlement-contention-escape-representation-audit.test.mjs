/** DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { generateEscapeRepresentationAudit } from "../generate-settlement-contention-composition-escape-representation-audit.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import {
  buildMalformedEscapeRepresentations,
  buildValidEscapeRepresentations,
  parseEscapeRepresentation,
} from "../settlement-contention-composition-escape-representations.mjs";
import {
  loadEscapeRepresentationAudit,
  validateEscapeRepresentationAudit,
} from "../validate-settlement-contention-composition-escape-representation-audit.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const VERIFIER = fileURLToPath(new URL("../verify-settlement-contention-escape-representations.py", import.meta.url));
const BASE = JSON.parse(readFileSync(join(ROOT, "settlement-contention-composition-vectors.v1.json"), "utf8"));
const candidates = [process.env.PYTHON, "python3", "python"].filter(Boolean);
const PYTHON = candidates.find((candidate) => spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0);
const artifact = loadEscapeRepresentationAudit();
const VALID_IDS = [
  "BASE_ENVELOPE_LF", "REVERSED_ENVELOPE_LF", "BASE_ENVELOPE_CRLF",
  "UNICODE_KEY_ESCAPE_LF", "ESCAPED_SOLIDUS_LF", "UNICODE_AND_SOLIDUS_LF",
];

test("escape representation audit deterministically regenerates", () => {
  assert.deepEqual(validateEscapeRepresentationAudit(artifact), []);
  assert.deepEqual(generateEscapeRepresentationAudit(), artifact);
  assert.equal(artifact.summary.replayCommitmentSha256,
    "441bf740f2d2329b4ccfd8cc78d117db4238081e9dc7e1a1095941b026ef51b0");
  assert.equal(artifact.summary.malformedSetCommitmentSha256,
    "51e96f7b21417e1e84569f8adb0c80079ed96ecaddf3ae5ebf7895c7221a98e9");
});

test("audit covers 72 valid trials and six malformed representations", () => {
  assert.equal(artifact.cases.length, 12);
  assert.equal(artifact.cases.flatMap((entry) => entry.representations).length, 72);
  assert.equal(artifact.malformedRepresentations.length, 6);
  assert.equal(artifact.summary.validTrialCount, "72");
  assert.equal(artifact.summary.malformedRepresentationCount, "6");
  for (const entry of artifact.cases) assert.deepEqual(entry.representations.map((trial) => trial.representationId), VALID_IDS);
});

test("all six valid raw encodings remain distinct within every mutation case", () => {
  for (const entry of artifact.cases) {
    assert.equal(new Set(entry.representations.map((trial) => trial.representationSha256)).size, 6, entry.caseId);
  }
  assert.equal(artifact.summary.allValidRepresentationsDistinctWithinCase, true);
});

test("canonical candidates and baseline diagnostics remain stable across valid encodings", () => {
  for (const entry of artifact.cases) {
    for (const trial of entry.representations) {
      assert.equal(trial.candidateCommitmentSha256, entry.baselineCandidateCommitmentSha256, entry.caseId);
      assert.equal(trial.diagnosticCommitmentSha256, entry.baselineDiagnosticCommitmentSha256, entry.caseId);
      assert.equal(trial.accepted, false);
    }
  }
});

test("LF and CRLF envelopes differ without changing parsed candidate semantics", () => {
  const representations = buildValidEscapeRepresentations(BASE);
  assert.notEqual(representations[0].serialized, representations[2].serialized);
  assert.deepEqual(parseEscapeRepresentation(representations[0].serialized), BASE);
  assert.deepEqual(parseEscapeRepresentation(representations[2].serialized), BASE);
});

test("escaped Unicode keys decode to the exact original candidate", () => {
  const representations = buildValidEscapeRepresentations(BASE);
  const unicode = representations.find((item) => item.representationId === "UNICODE_KEY_ESCAPE_LF");
  const combined = representations.find((item) => item.representationId === "UNICODE_AND_SOLIDUS_LF");
  assert.match(unicode.serialized, /c\\u0061ndidate/);
  assert.match(unicode.serialized, /vector\\u0056ersion/);
  assert.match(combined.serialized, /\\u0044RAFT\\u002fINACTIVE/);
  assert.deepEqual(parseEscapeRepresentation(unicode.serialized), BASE);
  assert.deepEqual(parseEscapeRepresentation(combined.serialized), BASE);
});

test("escaped solidus decodes without altering candidate semantics", () => {
  const representation = buildValidEscapeRepresentations(BASE)
    .find((item) => item.representationId === "ESCAPED_SOLIDUS_LF");
  assert.match(representation.serialized, /DRAFT\\\/INACTIVE/);
  assert.deepEqual(parseEscapeRepresentation(representation.serialized), BASE);
});

test("malformed escapes and unpaired surrogates reject before mutation", () => {
  const malformed = buildMalformedEscapeRepresentations(BASE);
  for (const item of malformed) {
    assert.throws(() => parseEscapeRepresentation(item.serialized), new RegExp(item.expectedError), item.representationId);
  }
  assert.deepEqual(artifact.malformedRepresentations.map((item) => item.expectedError), [
    "MALFORMED_JSON_ESCAPE", "MALFORMED_JSON_ESCAPE", "MALFORMED_JSON_ESCAPE",
    "UNPAIRED_UNICODE_SURROGATE", "UNPAIRED_UNICODE_SURROGATE", "UNPAIRED_UNICODE_SURROGATE",
  ]);
  assert.ok(artifact.malformedRepresentations.every((item) => item.rejectedBeforeMutation && !item.candidateProduced));
  assert.equal(parseEscapeRepresentation('{"transportMarker":"DRAFT/INACTIVE","candidate":{"scalar":"\\ud83d\\ude00"}}').scalar, "😀");
});

test("independent Python reproduces all valid and malformed escape trials", () => {
  assert.ok(PYTHON, "Python 3 is required for escape representation parity");
  const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--json"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, true);
  assert.equal(report.validTrialCount, 72);
  assert.equal(report.malformedRepresentationCount, 6);
  assert.equal(report.replayCommitmentSha256, artifact.summary.replayCommitmentSha256);
  assert.equal(report.malformedSetCommitmentSha256, artifact.summary.malformedSetCommitmentSha256);
});

test("independent Python rejects changed valid representation evidence with exit 2", () => {
  const directory = mkdtempSync(join(tmpdir(), "iat-escape-representations-valid-"));
  try {
    const changed = structuredClone(artifact);
    changed.cases[0].representations[3].representationSha256 = "f".repeat(64);
    const path = join(directory, "changed.json");
    writeFileSync(path, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
    const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--artifact", path, "--json"], { encoding: "utf8" });
    assert.equal(result.status, 2, result.stderr || result.stdout);
    assert.ok(JSON.parse(result.stdout).errors.some((error) => error.includes("representation trial drift")));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("independent Python rejects changed malformed evidence with exit 2", () => {
  const directory = mkdtempSync(join(tmpdir(), "iat-escape-representations-malformed-"));
  try {
    const changed = structuredClone(artifact);
    changed.malformedRepresentations[0].expectedError = "UNPAIRED_UNICODE_SURROGATE";
    const path = join(directory, "changed.json");
    writeFileSync(path, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
    const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--artifact", path, "--json"], { encoding: "utf8" });
    assert.equal(result.status, 2, result.stderr || result.stdout);
    assert.ok(JSON.parse(result.stdout).errors.some((error) => error.includes("malformed escape corpus drift")));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("escape representation tooling is compact, offline, powerless, and manifest-covered", () => {
  const expected = {
    "generate-settlement-contention-composition-escape-representation-audit.mjs": "GENERATOR",
    "settlement-contention-composition-escape-representation-audit.v1.json": "ARTIFACT",
    "settlement-contention-composition-escape-representations.mjs": "SUPPORTING_SOURCE",
    "tests/settlement-contention-escape-representation-audit.test.mjs": "TEST",
    "validate-settlement-contention-composition-escape-representation-audit.mjs": "VALIDATOR",
    "verify-settlement-contention-escape-representations.py": "VALIDATOR",
  };
  const actual = Object.fromEntries(loadReviewManifest().entries
    .filter((entry) => Object.hasOwn(expected, entry.path))
    .map((entry) => [entry.path, entry.role]));
  assert.deepEqual(actual, expected);
  assert.equal(artifact.contract.serializedRepresentationsStored, false);
  assert.equal(artifact.contract.runtimeCandidatesStored, false);
  const sources = Object.keys(expected).filter((path) => /\.(mjs|py)$/.test(path) && !path.startsWith("tests/"))
    .map((path) => readFileSync(join(ROOT, path), "utf8")).join("\n");
  assert.doesNotMatch(sources, /\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/);
  assert.doesNotMatch(sources, /solana-test-validator|api\.devnet\.solana\.com|api\.mainnet-beta\.solana\.com/);
});
