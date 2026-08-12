import {
  FROZEN_SOURCE_COUNT,
  MODEL_REVISION,
  TARGET_CELL_COUNT,
  canonicalJson,
  protectedInventory,
  renderPrompt,
  sha256,
  validateTranslation,
} from "./integrity.mjs";

export const MAX_PROJECTED_HOURS = 12;

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

export function validateBenchmarkRecord({ record, fixtureBytes, localeMapBytes, provenanceBytes, promptBytes }) {
  const fixture = JSON.parse(Buffer.from(fixtureBytes).toString("utf8"));
  const localeMap = JSON.parse(Buffer.from(localeMapBytes).toString("utf8"));
  const provenance = JSON.parse(Buffer.from(provenanceBytes).toString("utf8"));
  const promptTemplate = Buffer.from(promptBytes).toString("utf8");
  const fixtureFileSha256 = sha256(fixtureBytes);
  const promptTemplateSha256 = sha256(promptBytes);
  const globalErrors = [];

  if (record.schema !== "iat-b3-qwen35-tiny-benchmark-record/v1") globalErrors.push("RECORD_SCHEMA");
  if (record.activationAllowed !== false || record.bulkGenerationAllowed !== false) globalErrors.push("RECORD_ACTIVATION_INVARIANT");
  if (record.networkUsedForInference !== false) globalErrors.push("NETWORK_INFERENCE_PROHIBITED");
  if (record.fixtureFileSha256 !== fixtureFileSha256) globalErrors.push("COMMITTED_FIXTURE_BYTE_DIGEST_MISMATCH");
  if (!same(record.fixture, fixture)) globalErrors.push("EMBEDDED_FIXTURE_NOT_EXACT_COMMITTED_FIXTURE");
  if (fixture.activationAllowed !== false || fixture.syntheticPublicFixture !== true) globalErrors.push("COMMITTED_FIXTURE_INVARIANT");
  if (!same(fixture.model, { repository: provenance.model.repository, revision: MODEL_REVISION })) globalErrors.push("COMMITTED_FIXTURE_MODEL_MISMATCH");
  if (fixture.promptTemplateSha256 !== promptTemplateSha256) globalErrors.push("COMMITTED_FIXTURE_PROMPT_MISMATCH");

  if (record.model?.repository !== fixture.model.repository || record.model?.revision !== fixture.model.revision) globalErrors.push("MODEL_IDENTITY_MISMATCH");
  if (!Array.isArray(record.model?.verifiedFiles) || record.model.verifiedFiles.length !== provenance.files.length) globalErrors.push("MODEL_FILE_VERIFICATION_INCOMPLETE");
  else {
    for (const expected of provenance.files) {
      const actual = record.model.verifiedFiles.find((file) => file.path === expected.path);
      if (!actual || actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256) globalErrors.push(`MODEL_FILE_MISMATCH:${expected.path}`);
    }
  }

  const expectedGeneration = { ...fixture.generation, promptTemplateSha256 };
  if (!same(record.generation, expectedGeneration)) globalErrors.push("GENERATION_CONTRACT_MISMATCH");

  const expectedProtected = protectedInventory(fixture.source).tokenCounts;
  if (!same(expectedProtected, fixture.protectedTokenCounts)) globalErrors.push("FIXTURE_PROTECTED_INVENTORY_MISMATCH");
  const localeByCode = new Map(localeMap.locales.map((entry) => [entry.locale, entry]));
  const expectedIds = fixture.cases.map(({ id }) => id);
  const actualIds = Array.isArray(record.results) ? record.results.map(({ id }) => id) : [];
  if (!same(actualIds, expectedIds)) globalErrors.push("CASE_ID_ORDER_COUNT_MISMATCH");

  const cases = [];
  let derivedGenerationSeconds = 0;
  let validTimingCount = 0;
  for (let index = 0; index < fixture.cases.length; index += 1) {
    const expected = fixture.cases[index];
    const raw = Array.isArray(record.results) ? record.results[index] : null;
    const localeEntry = localeByCode.get(expected.locale);
    const caseErrors = [];
    if (!raw) {
      cases.push({ id: expected.id, locale: expected.locale, pass: false, errors: ["MISSING_CASE"] });
      continue;
    }
    if (raw.id !== expected.id || raw.locale !== expected.locale || raw.class !== expected.class) caseErrors.push("CASE_IDENTITY_MISMATCH");
    if (raw.modelRevision !== MODEL_REVISION) caseErrors.push("CASE_MODEL_REVISION_MISMATCH");
    if (raw.sourceSha256 !== sha256(Buffer.from(fixture.source, "utf8"))) caseErrors.push("SOURCE_BINDING_MISMATCH");
    const rendered = renderPrompt(promptTemplate, localeEntry, fixture.source);
    if (raw.promptSha256 !== sha256(Buffer.from(rendered.prompt, "utf8"))) caseErrors.push("CASE_PROMPT_BINDING_MISMATCH");
    if (!Number.isFinite(raw.elapsedSeconds) || raw.elapsedSeconds <= 0 || raw.elapsedSeconds > fixture.generation.maxTotalSeconds) {
      caseErrors.push("INVALID_PER_CASE_TIMING");
    } else {
      derivedGenerationSeconds += raw.elapsedSeconds;
      validTimingCount += 1;
    }
    if (!Number.isInteger(raw.outputTokens) || raw.outputTokens < 0 || raw.outputTokens > fixture.generation.maxNewTokens) caseErrors.push("INVALID_OUTPUT_TOKEN_COUNT");

    const validation = validateTranslation({
      source: fixture.source,
      outputJson: raw.outputJson,
      localeEntry,
      languagePolicy: "benchmark-gate",
    });
    caseErrors.push(...validation.errors);
    cases.push({
      id: expected.id,
      locale: expected.locale,
      class: expected.class,
      mustPass: expected.mustPass,
      pass: caseErrors.length === 0,
      errors: [...new Set(caseErrors)],
      outputJson: raw.outputJson,
      outputTokens: raw.outputTokens,
      elapsedSeconds: raw.elapsedSeconds,
      tokensPerSecond: Number.isFinite(raw.elapsedSeconds) && raw.elapsedSeconds > 0 ? raw.outputTokens / raw.elapsedSeconds : null,
      validation,
      languageProof: false,
      nativeReviewRequired: true,
    });
  }

  if (validTimingCount !== fixture.cases.length) globalErrors.push("PER_CASE_TIMING_SET_INCOMPLETE");
  const measuredCells = validTimingCount;
  const cellsPerSecond = derivedGenerationSeconds > 0 ? measuredCells / derivedGenerationSeconds : 0;
  const projectedHours = cellsPerSecond > 0 ? TARGET_CELL_COUNT / cellsPerSecond / 3600 : Number.POSITIVE_INFINITY;
  const integrityAndHeuristicPass = globalErrors.length === 0 && cases.length === fixture.cases.length && cases.every((entry) => entry.pass);
  const throughputPass = projectedHours <= MAX_PROJECTED_HOURS;
  const technicalGatePassed = integrityAndHeuristicPass && throughputPass;
  const reportCore = {
    schema: "iat-b3-qwen35-tiny-benchmark-validation/v2",
    status: technicalGatePassed ? "TECHNICAL_HEURISTIC_SAMPLE_PASS_LEGAL_NATIVE_REVIEW_HOLD" : "NO_GO_BULK_GENERATION",
    activationAllowed: false,
    bulkGenerationAllowed: false,
    languageProof: false,
    nativeReviewRequired: true,
    technicalGatePassed,
    legalReview: "UNRESOLVED",
    nativeReview: "UNRESOLVED",
    modelRevision: MODEL_REVISION,
    fixtureFileSha256,
    globalErrors: [...new Set(globalErrors)],
    cases,
    throughput: {
      measuredCells,
      generationSecondsDerivedOnlyFromPerCaseData: derivedGenerationSeconds,
      embeddedAggregateTimingIgnored: true,
      cellsPerSecond,
      frozenSourceCount: FROZEN_SOURCE_COUNT,
      targetCellCount: TARGET_CELL_COUNT,
      projectedHoursAtMeasuredUnbatchedRate: Number.isFinite(projectedHours) ? projectedHours : null,
      maximumPermittedProjectedHours: MAX_PROJECTED_HOURS,
      pass: throughputPass,
      caveat: "Tiny-fixture unbatched projection; passing requires a separate bounded batching benchmark before bulk generation.",
    },
    stopReasons: [
      ...(integrityAndHeuristicPass ? [] : ["INTEGRITY_OR_COMMITTED_LANGUAGE_HEURISTIC_SAMPLE_FAILED"]),
      ...(throughputPass ? [] : ["MEASURED_RATE_IMPRACTICAL_FOR_TODAY"]),
      "LANGUAGE_PROOF_NOT_ESTABLISHED",
      "LEGAL_REVIEW_UNRESOLVED",
      "NATIVE_REVIEW_UNRESOLVED",
      "ACTIVATION_SEPARATELY_PROHIBITED",
    ],
  };
  return { ...reportCore, reportCanonicalSha256: sha256(canonicalJson(reportCore)) };
}
