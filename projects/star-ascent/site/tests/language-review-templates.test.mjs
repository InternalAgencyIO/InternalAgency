import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const siteRoot = fileURLToPath(new URL("../", import.meta.url));
const templateRoot = resolve(siteRoot, "public/audits/localization-qa-20260803/review-templates");
const nativePath = resolve(templateRoot, "native-review-signoffs.template.json");
const languageIdPath = resolve(templateRoot, "language-id-evidence.template.json");

function load(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function generateScorecard(output, nativeEvidence = nativePath, languageIdEvidence = languageIdPath) {
  execFileSync(process.execPath, [
    "scripts/generate-language-qa-scorecard.mjs",
    "--output", output,
    "--native-evidence", nativeEvidence,
    "--language-id-evidence", languageIdEvidence,
    "--render-evidence", `${output}.intentionally-missing-render-evidence`,
  ], { cwd: siteRoot, stdio: "pipe" });
  return load(output);
}

test("review templates cover all 50 locales without pre-authorizing evidence", () => {
  const native = load(nativePath);
  const languageId = load(languageIdPath);
  assert.equal(native.templateStatus, "UNREVIEWED_HOLD");
  assert.equal(languageId.templateStatus, "UNEXECUTED_HOLD");
  assert.equal(Object.keys(native.locales).length, 50);
  assert.equal(Object.keys(languageId.locales).length, 50);
  for (const [locale, record] of Object.entries(native.locales)) {
    assert.equal(Object.keys(record.checks).length, 5, `${locale} native check count`);
    for (const check of Object.values(record.checks)) {
      assert.equal(check.status, "HOLD");
      assert.equal(check.reviewer.reviewerId, "");
      assert.equal(check.evidence, "");
    }
  }
  for (const [locale, record] of Object.entries(languageId.locales)) {
    assert.equal(record.expectedLocale, locale);
    assert.equal(record.identifiedLocale, "");
    assert.equal(record.confidence, 0);
    assert.equal(record.engine, "");
  }
});

test("blank templates preserve all 456 HOLD results without inferring render evidence", () => {
  const temporary = mkdtempSync(resolve(tmpdir(), "iat-language-review-"));
  try {
    const scorecard = generateScorecard(resolve(temporary, "scorecard.json"));
    assert.deepEqual(scorecard.summary, { PASS: 3294, FAIL: 0, HOLD: 456, NOT_RUN: 1250 });
    assert.equal(scorecard.assurance.nativeQualityClaimAllowed, false);
    assert.equal(scorecard.assurance.releaseApproved, false);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("public scorecard evidence paths are portable and reveal no local workspace root", () => {
  const temporary = mkdtempSync(resolve(tmpdir(), "iat-language-review-"));
  try {
    const scorecard = generateScorecard(resolve(temporary, "scorecard.json"));
    assert.equal(scorecard.evidenceInputs.nativeReview.path, "public/audits/localization-qa-20260803/review-templates/native-review-signoffs.template.json");
    assert.equal(scorecard.evidenceInputs.languageId.path, "public/audits/localization-qa-20260803/review-templates/language-id-evidence.template.json");
    assert.match(scorecard.evidenceInputs.render.path, /^<external>\//u);
    for (const evidence of Object.values(scorecard.evidenceInputs)) {
      assert.equal(isAbsolute(evidence.path), false);
      assert.doesNotMatch(evidence.path, /(?:^[A-Za-z]:|\\)/u);
    }
    const canonicalDefinition = execFileSync("git", ["show", "HEAD:projects/star-ascent/site/app/i18n/language-qa-checks.v1.json"], { cwd: siteRoot });
    assert.equal(scorecard.sourceBinding.definitionSha256, createHash("sha256").update(canonicalDefinition).digest("hex"));
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("a native PASS with an incomplete reviewer envelope remains HOLD", () => {
  const temporary = mkdtempSync(resolve(tmpdir(), "iat-language-review-"));
  try {
    const tampered = load(nativePath);
    tampered.locales.en.checks["LQA-096"].status = "PASS";
    const tamperedPath = resolve(temporary, "native.json");
    writeFileSync(tamperedPath, `${JSON.stringify(tampered)}\n`, "utf8");
    const scorecard = generateScorecard(resolve(temporary, "scorecard.json"), tamperedPath);
    assert.deepEqual(scorecard.summary, { PASS: 3294, FAIL: 0, HOLD: 456, NOT_RUN: 1250 });
    const check = scorecard.locales.find(({ locale }) => locale === "en").checks.find(({ id }) => id === "LQA-096");
    assert.equal(check.status, "HOLD");
    assert.match(check.detail, /not source-bound or complete/i);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
