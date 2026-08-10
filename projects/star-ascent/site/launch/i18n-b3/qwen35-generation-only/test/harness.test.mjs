import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, realpath, rm, symlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FROZEN_SOURCE_COUNT,
  FROZEN_SOURCE_SHA256,
  MODEL_REVISION,
  TARGET_CELL_COUNT,
  TARGET_LOCALE_COUNT,
  assertFrozenSourceEvidence,
  benchmarkLanguageEvidence,
  canonicalJson,
  compareProtectedInventory,
  parseTranslationEnvelope,
  protectedInventory,
  renderPrompt,
  sha256,
  validateTranslation,
} from "../lib/integrity.mjs";
import { validateBenchmarkRecord } from "../lib/benchmark-validation.mjs";
import { assertReplayArtifactBindings, assertResultCellBinding, evaluateUnreviewedCandidate } from "../lib/checkpoint-bindings.mjs";
import { DEFAULT_CACHE_ROOT, resolveSecureReportTarget, writeExclusiveAtomicReport } from "../lib/secure-report-path.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const sourceFreezePath = path.resolve(root, "../../../scripts/data/pcm-source-freeze-evidence-5baff9.json");

async function json(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

test("frozen 1,491-string roster is exact and hash-bound", async () => {
  const evidence = JSON.parse(await readFile(sourceFreezePath, "utf8"));
  const sources = assertFrozenSourceEvidence(evidence);
  assert.equal(sources.length, FROZEN_SOURCE_COUNT);
  assert.equal(sha256(JSON.stringify(sources)), FROZEN_SOURCE_SHA256);
  assert.equal(TARGET_CELL_COUNT, 71568);
});

test("locale map contains the exact 48 unresolved codes once", async () => {
  const map = await json("locale-map.json");
  const expected = "zh es hi fr ar bn pt id ur ru de ja tr sq ca be nl bs bg hr el cs da et fi hu is ga it lv lt lb mk mt no pl ro sr sk sl sv uk ht gn qu hy az ka".split(" ");
  assert.deepEqual(map.locales.map(({ locale }) => locale), expected);
  assert.equal(new Set(expected).size, TARGET_LOCALE_COUNT);
  assert.equal(map.activationAllowed, false);
  assert.equal(map.locales.find(({ locale }) => locale === "qu").mapping, "POLICY_REVIEW_GENERIC_TO_AYACUCHO");
  assert.equal(map.locales.find(({ locale }) => locale === "no").mapping, "POLICY_REVIEW_GENERIC_TO_BOKMAL");
  assert.equal(map.locales.find(({ locale }) => locale === "sr").script, "Cyrl");
});

test("official model identity, license, shard, tokenizer, and config are pinned", async () => {
  const provenance = await json("model-provenance.json");
  assert.equal(provenance.activationAllowed, false);
  assert.equal(provenance.bulkGenerationAllowed, false);
  assert.equal(provenance.model.repository, "Qwen/Qwen3.5-0.8B");
  assert.equal(provenance.model.revision, MODEL_REVISION);
  assert.equal(provenance.model.declaredLicense, "Apache-2.0");
  assert.match(provenance.model.officialWeightOriginEvidence, new RegExp(MODEL_REVISION));
  assert.equal(provenance.model.officialFamilyReleaseEvidence, "https://qwen.ai/blog?id=qwen3.5");
  const byPath = new Map(provenance.files.map((file) => [file.path, file]));
  assert.equal(byPath.get("LICENSE").sha256, "bbedc3fda3305820b977265f01b8619d87570a6739de3a5582c3464840f1e57a");
  assert.equal(byPath.get("model.safetensors-00001-of-00001.safetensors").sha256, "04b1c301231dd422b8860db31311ab2721511346a32cb1e079c4c4e5f1fe4696");
  assert.equal(byPath.get("tokenizer.json").sha256, "5f9e4d4901a92b997e463c1f46055088b6cca5ca61a6522d1b9f64c4bb81cb42");
  assert.equal(byPath.get("config.json").sha256, "b90b86f35c8e6925ef74ee04d0e758f0a845c83a42089ad82bbaa948de9b4204");
  assert.equal(provenance.legalReview.trainingDataReview, "UNRESOLVED");
  assert.equal(provenance.frozenSource.targetCellCount, TARGET_CELL_COUNT);
});

test("CPU benchmark timeout is recorded as a fail-closed NO-GO", async () => {
  const evidence = await json("benchmark-timeout-evidence.json");
  assert.equal(evidence.status, "NO_GO_BULK_GENERATION_TIMEOUT");
  assert.equal(evidence.activationAllowed, false);
  assert.equal(evidence.bulkGenerationAllowed, false);
  assert.equal(evidence.qualityGatePassed, false);
  assert.equal(evidence.throughputGatePassed, false);
  assert.equal(evidence.benchmark.rawOutputExistsAfterTermination, false);
  assert.ok(evidence.benchmark.throughput.optimisticProjectedUnbatchedDaysLowerBound > 73);
  assert.equal(evidence.model.revision, MODEL_REVISION);
});

test("protected inventory binds placeholders, ICU, URLs, code, brands, acronyms, and numbers", () => {
  const source = "IAT opens {count, plural, one {# node} other {# nodes}} at https://example.invalid/a; run `iat --lane TOKEN_2022` for ${wallet} and 10%.";
  const inventory = protectedInventory(source);
  assert.ok(inventory.tokens.includes("{count, plural, one {# node} other {# nodes}}"));
  assert.ok(inventory.tokens.includes("{wallet}"));
  assert.ok(inventory.tokens.includes("${wallet}"));
  assert.ok(inventory.tokens.includes("https://example.invalid/a"));
  assert.ok(inventory.tokens.includes("`iat --lane TOKEN_2022`"));
  assert.ok(inventory.tokens.includes("IAT"));
  assert.ok(inventory.tokens.includes("10%"));
  assert.equal(compareProtectedInventory(source, source.replace("TOKEN_2022", "TOKEN_2023")).pass, false);
});

test("one-string JSON response contract rejects wrappers and extra keys", () => {
  assert.equal(parseTranslationEnvelope('{"translation":"hola"}'), "hola");
  assert.throws(() => parseTranslationEnvelope('```json\n{"translation":"hola"}\n```'));
  assert.throws(() => parseTranslationEnvelope('{"translation":"hola","locale":"es"}'));
  assert.throws(() => parseTranslationEnvelope('{"translation":1}'));
});

test("translation validation rejects source echo and protected-token corruption", async () => {
  const localeEntry = (await json("locale-map.json")).locales.find(({ locale }) => locale === "es");
  const source = "The IAT node has {count} agents at https://example.invalid/status.";
  const echoed = validateTranslation({ source, outputJson: JSON.stringify({ translation: source }), localeEntry });
  assert.equal(echoed.pass, false);
  assert.ok(echoed.errors.includes("SOURCE_EQUIVALENT"));
  const corrupt = validateTranslation({
    source,
    outputJson: JSON.stringify({ translation: "El nodo IAT tiene {cuenta} agentes en https://example.invalid/status." }),
    localeEntry,
  });
  assert.equal(corrupt.pass, false);
  assert.ok(corrupt.errors.includes("PROTECTED_TOKEN_MISMATCH"));
});

test("caller language claims cannot turn French into an accepted Spanish candidate", async () => {
  const localeEntry = (await json("locale-map.json")).locales.find(({ locale }) => locale === "es");
  const validation = validateTranslation({
    source: "The cat is here.",
    outputJson: JSON.stringify({ translation: "Le chat est ici." }),
    localeEntry,
    languagePolicy: "candidate",
    languageEvidence: { expectedLocale: "es", pass: true, method: "CALLER_ASSERTION" },
  });
  assert.equal(validation.pass, false);
  assert.ok(validation.errors.includes("TARGET_LANGUAGE_HEURISTIC_FAILED"));
  assert.equal(validation.languageProof, false);
  assert.equal(validation.nativeReviewRequired, true);
});

test("protected-token-only output fails the nonprotected content floor", async () => {
  const localeEntry = (await json("locale-map.json")).locales.find(({ locale }) => locale === "es");
  const validation = validateTranslation({
    source: "The IAT network is ready for all users.",
    outputJson: JSON.stringify({ translation: "IAT." }),
    localeEntry,
  });
  assert.equal(validation.pass, false);
  assert.ok(validation.errors.includes("NONPROTECTED_CONTENT_TOO_THIN"));
  assert.equal(validation.nonProtectedContent.translationLetterCount, 0);
});

test("transparent benchmark language checks distinguish control and tail fixtures", () => {
  assert.equal(benchmarkLanguageEvidence("es", "El gato esta aqui.").pass, true);
  assert.equal(benchmarkLanguageEvidence("gn", "Mbarakaja oĩ ko'ápe.").pass, true);
  assert.equal(benchmarkLanguageEvidence("qu", "Misi kaypi kachkan.").pass, true);
  assert.equal(benchmarkLanguageEvidence("mt", "Il-qattus qiegħed hawn.").pass, true);
  assert.equal(benchmarkLanguageEvidence("gn", "The cat is here.").pass, false);
  assert.equal(benchmarkLanguageEvidence("qu", "El gato esta aqui.").pass, false);
});

test("prompt rendering is deterministic and includes exact protection counts", async () => {
  const template = await readFile(path.join(root, "prompt-template.txt"), "utf8");
  const localeEntry = (await json("locale-map.json")).locales.find(({ locale }) => locale === "ar");
  const source = "Open {count} IAT nodes at https://example.invalid/status.";
  const first = renderPrompt(template, localeEntry, source);
  const second = renderPrompt(template, localeEntry, source);
  assert.deepEqual(first, second);
  assert.match(first.prompt, /Modern Standard Arabic/u);
  assert.match(first.prompt, /https:\/\/example\.invalid\/status/u);
  assert.ok(first.protectedTokens.includes("{count}"));
  assert.ok(first.protectedTokens.includes("IAT"));
});

test("checkpoint bindings cover current locale bytes and pinned result model revision", async () => {
  const [localeMapBytes, modelProvenanceBytes, promptBytes] = await Promise.all([
    readFile(path.join(root, "locale-map.json")),
    readFile(path.join(root, "model-provenance.json")),
    readFile(path.join(root, "prompt-template.txt")),
  ]);
  const manifest = {
    locales: { localeMapSha256: sha256(localeMapBytes) },
    modelProvenanceSha256: sha256(modelProvenanceBytes),
    generation: { promptSha256: sha256(promptBytes), modelRevision: MODEL_REVISION },
  };
  assert.doesNotThrow(() => assertReplayArtifactBindings({ manifest, localeMapBytes, modelProvenanceBytes, promptBytes }));
  assert.throws(() => assertReplayArtifactBindings({ manifest, localeMapBytes: Buffer.concat([localeMapBytes, Buffer.from(" ")]), modelProvenanceBytes, promptBytes }), /locale-map digest mismatch/u);
  const cell = { cellId: "cell", ordinal: 1, locale: "es", sourceSha256: "a".repeat(64) };
  assert.throws(() => assertResultCellBinding({ ...cell, modelRevision: "0".repeat(40) }, cell), /not pinned/u);
});

test("checkpoint candidate replay rejects caller pass/evidence and French Spanish probe", async () => {
  const localeEntry = (await json("locale-map.json")).locales.find(({ locale }) => locale === "es");
  const cell = {
    cellId: "b".repeat(64),
    ordinal: 4,
    locale: "es",
    source: "The cat is here.",
    sourceSha256: sha256(Buffer.from("The cat is here.", "utf8")),
  };
  const result = {
    schema: "iat-b3-qwen35-result-candidate/v1",
    activationAllowed: false,
    candidate: true,
    accepted: false,
    languageProof: false,
    nativeReviewRequired: true,
    cellId: cell.cellId,
    ordinal: cell.ordinal,
    locale: cell.locale,
    sourceSha256: cell.sourceSha256,
    modelRevision: MODEL_REVISION,
    outputJson: JSON.stringify({ translation: "Le chat est ici." }),
  };
  result.resultCanonicalSha256 = sha256(canonicalJson({ cellId: result.cellId, modelRevision: result.modelRevision, outputJson: result.outputJson }));
  assert.equal(evaluateUnreviewedCandidate({ result, cell, localeEntry }).candidate, false);
  assert.throws(() => evaluateUnreviewedCandidate({ result: { ...result, languageEvidence: { pass: true } }, cell, localeEntry }), /prohibited/u);
  assert.throws(() => evaluateUnreviewedCandidate({ result: { ...result, pass: true }, cell, localeEntry }), /prohibited/u);
});

test("benchmark validation binds committed fixture order, prompts, model, and per-case timing", async () => {
  const [fixtureBytes, localeMapBytes, provenanceBytes, promptBytes] = await Promise.all([
    readFile(path.join(root, "fixtures", "tiny-benchmark-cases.json")),
    readFile(path.join(root, "locale-map.json")),
    readFile(path.join(root, "model-provenance.json")),
    readFile(path.join(root, "prompt-template.txt")),
  ]);
  const fixture = JSON.parse(fixtureBytes.toString("utf8"));
  const localeMap = JSON.parse(localeMapBytes.toString("utf8"));
  const provenance = JSON.parse(provenanceBytes.toString("utf8"));
  const localeByCode = new Map(localeMap.locales.map((entry) => [entry.locale, entry]));
  const record = {
    schema: "iat-b3-qwen35-tiny-benchmark-record/v1",
    activationAllowed: false,
    bulkGenerationAllowed: false,
    networkUsedForInference: false,
    fixtureFileSha256: sha256(fixtureBytes),
    fixture,
    model: {
      repository: fixture.model.repository,
      revision: fixture.model.revision,
      verifiedFiles: provenance.files.map(({ path: filePath, bytes, sha256: fileSha256 }) => ({ path: filePath, bytes, sha256: fileSha256 })),
    },
    generation: { ...fixture.generation, promptTemplateSha256: fixture.promptTemplateSha256 },
    timing: { generationSeconds: 999999 },
    results: fixture.cases.map((benchmarkCase, index) => {
      const rendered = renderPrompt(promptBytes.toString("utf8"), localeByCode.get(benchmarkCase.locale), fixture.source);
      return {
        ...benchmarkCase,
        modelRevision: MODEL_REVISION,
        sourceSha256: sha256(Buffer.from(fixture.source, "utf8")),
        promptSha256: sha256(Buffer.from(rendered.prompt, "utf8")),
        elapsedSeconds: index + 1,
        outputTokens: 10,
        outputJson: JSON.stringify({ translation: fixture.source }),
      };
    }),
  };
  const report = validateBenchmarkRecord({ record, fixtureBytes, localeMapBytes, provenanceBytes, promptBytes });
  assert.equal(report.throughput.generationSecondsDerivedOnlyFromPerCaseData, 28);
  assert.equal(report.throughput.embeddedAggregateTimingIgnored, true);
  assert.equal(report.languageProof, false);

  const swapped = structuredClone(record);
  [swapped.results[0], swapped.results[1]] = [swapped.results[1], swapped.results[0]];
  assert.ok(validateBenchmarkRecord({ record: swapped, fixtureBytes, localeMapBytes, provenanceBytes, promptBytes }).globalErrors.includes("CASE_ID_ORDER_COUNT_MISMATCH"));
  const fixtureDigestTamper = { ...record, fixtureFileSha256: "0".repeat(64) };
  assert.ok(validateBenchmarkRecord({ record: fixtureDigestTamper, fixtureBytes, localeMapBytes, provenanceBytes, promptBytes }).globalErrors.includes("COMMITTED_FIXTURE_BYTE_DIGEST_MISMATCH"));
  const promptTamper = structuredClone(record);
  promptTamper.results[0].promptSha256 = "0".repeat(64);
  assert.ok(validateBenchmarkRecord({ record: promptTamper, fixtureBytes, localeMapBytes, provenanceBytes, promptBytes }).cases[0].errors.includes("CASE_PROMPT_BINDING_MISMATCH"));
});

test("report target is basename-only, no-overwrite, and junction escape safe", async (t) => {
  const cacheRoot = await realpath(DEFAULT_CACHE_ROOT);
  const testDir = await mkdtemp(path.join(cacheRoot, "iat-qwen35-report-path-test-"));
  t.after(async () => {
    const lexical = path.resolve(testDir);
    const relative = path.relative(cacheRoot, lexical);
    assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
    await rm(lexical, { recursive: true, force: true });
  });

  await assert.rejects(() => resolveSecureReportTarget({ outputDir: testDir, reportName: "..\\escape.json", cacheRoot }), /basename/u);
  const secured = await resolveSecureReportTarget({ outputDir: testDir, reportName: "report.json", cacheRoot });
  await writeExclusiveAtomicReport(secured, "{}\n");
  await assert.rejects(() => resolveSecureReportTarget({ outputDir: testDir, reportName: "report.json", cacheRoot }), /overwrite/u);

  const junction = path.join(testDir, "outside-junction");
  try {
    await symlink(path.parse(cacheRoot).root === "E:\\" ? "C:\\Windows\\Temp" : path.parse(cacheRoot).root, junction, "junction");
  } catch (error) {
    if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) {
      t.diagnostic(`junction regression skipped by platform: ${error.code}`);
      return;
    }
    throw error;
  }
  await assert.rejects(() => resolveSecureReportTarget({ outputDir: junction, reportName: "escaped.json", cacheRoot }), /canonical output directory/u);
});
