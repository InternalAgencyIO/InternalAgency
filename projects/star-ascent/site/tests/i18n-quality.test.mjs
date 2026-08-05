import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readJson = (path) => readFile(new URL(path, import.meta.url), "utf8").then(JSON.parse);
const [catalog, overrides, reviewedPolicy, report, scorecard] = await Promise.all([
  readJson("../app/i18n/messages.json"),
  readJson("../app/i18n/critical-ui-overrides.json"),
  readJson("../app/i18n/reviewed-localization-policy.json"),
  readJson("../public/audits/localization-qa-20260803/report.json"),
  readJson("../public/audits/localization-qa-20260803/language-qa-scorecard.json"),
]);

test("every unreviewed runtime cell fails closed to canonical English", () => {
  assert.equal(Object.keys(catalog.messages).length, 50);
  assert.deepEqual(overrides.translations, {});
  assert.equal(reviewedPolicy.mode, "GLOBAL_FAIL_CLOSED");
  assert.equal(reviewedPolicy.machineDraftRuntimeAllowed, false);
  assert.equal(reviewedPolicy.unreviewedTargetLanguageBundleAllowed, false);
  assert.equal(reviewedPolicy.unreviewedLocaleAutonymsAllowed, false);
  assert.equal(reviewedPolicy.directComponentReviewBundleComplete, false);
  assert.equal(reviewedPolicy.reviewRequirements.cryptographicContentBinding, true);
  assert.equal(reviewedPolicy.reviewRequirements.trackedEvidenceArtifact, true);
  assert.deepEqual(reviewedPolicy.translations, {});
  assert.deepEqual(reviewedPolicy.reviews, []);
  for (const locale of Object.keys(catalog.messages).slice(1)) {
    assert.equal(reviewedPolicy.localeStatus[locale], "HOLD");
    for (const source of Object.keys(catalog.messages.en)) {
      const translation = catalog.messages[locale][source];
      assert.equal(translation, source);
      assert.equal((translation.match(/\/\//g) ?? []).length, (source.match(/\/\//g) ?? []).length);
      if (source.includes("STAR ASCENT")) assert.match(translation, /STAR ASCENT/);
    }
  }
});

test("fallback routes expose honest English language, direction, indexing, and prompt policy", async () => {
  const [layout, runtime, worker, config, runtimePolicy, compiler] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n/LocaleRuntime.tsx", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n/config.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n/runtime-content-policy.js", import.meta.url), "utf8"),
    readFile(new URL("../scripts/apply-i18n-editorial-overrides.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /contentLocale = runtimeContentLocale\(locale\)/);
  assert.match(layout, /English fallback is active/);
  assert.match(layout, /unreviewed machine text is not shown/);
  assert.match(layout, /htmlLanguageTag\(contentLocale\)/);
  assert.match(layout, /localeDirection\(contentLocale\)/);
  assert.match(layout, /data-route-locale=\{locale\}/);
  assert.match(layout, /contentLocale === locale/);
  assert.match(runtime, /contentLocale: LocaleCode/);
  assert.match(runtime, /runtimeContentLocale\(entry\.code\) === entry\.code[\s\S]*entry\.nativeName[\s\S]*entry\.name/);
  assert.match(runtime, /lang=\{htmlLanguageTag\(runtimeContentLocale\(entry\.code\)\)\}/);
  assert.match(runtime, /document\.documentElement\.lang = htmlLanguageTag\(contentLocale\)/);
  assert.match(worker, /responseHeaders\.set\("Content-Language", contentLanguage\)/);
  assert.match(worker, /runtimeContentLocale\(preferred(?: as LocaleCode)?\) === preferred/);
  assert.match(config, /runtimeContentLocaleForPolicy\(reviewedLocalizationPolicy, locale\)/);
  assert.match(runtimePolicy, /directComponentReviewBundleComplete === true/);
  assert.match(runtimePolicy, /localeStatus\?\.\[locale\] === "REVIEWED"/);
  assert.match(compiler, /cannot enter REVIEWED without explicit translations and valid review evidence for every canonical runtime source/);
  assert.match(compiler, /cannot enter REVIEWED until direct-component copy has a complete source-bound review bundle/);

  const localeDefinitions = [...config.matchAll(
    /\{ code: "([^"]+)", name: "([^"]+)", nativeName: "([^"]+)", dir: "(?:ltr|rtl)", googleCode: "[^"]+" \}/g,
  )].map((match) => ({ code: match[1], name: match[2], nativeName: match[3] }));
  assert.equal(localeDefinitions.length, 50);
  for (const definition of localeDefinitions) {
    if (definition.code !== "en") {
      assert.equal(definition.nativeName, definition.name, `${definition.code} must not ship an unreviewed autonym`);
    }
  }
});

test("the complete direct-copy inventory excludes unreviewed target-language branches and scripts", async () => {
  const directCopyFiles = catalog.meta.quarantinedDirectComponentSourceFiles;
  assert.ok(Array.isArray(directCopyFiles));
  assert.equal(directCopyFiles.length, 19);
  assert.equal(new Set(directCopyFiles).size, directCopyFiles.length);
  const routeFiles = directCopyFiles.map((path) => `../${path}`);
  const routeSources = await Promise.all(routeFiles.map(async (path) => [
    path,
    await readFile(new URL(path, import.meta.url), "utf8"),
  ]));
  const nonEnglishLocales = Object.keys(catalog.messages).filter((locale) => locale !== "en");
  const localeAlternation = nonEnglishLocales
    .map((locale) => locale.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const targetLocaleObject = new RegExp(`(?:^|\\n)\\s*["']?(?:${localeAlternation})["']?\\s*:\\s*\\{`, "m");
  const targetLocaleCondition = new RegExp(`(?:language|locale)\\s*===?\\s*["'](?:${localeAlternation})["']`);
  const directLocaleResolver = /\b(?:sourceLanguageForClientPath|localeFromRequestHeaders)\b/;
  const unreviewedAutonymOrCopy = /[\u011e\u011f\u0130\u0131\u015e\u015f]|[\u0370-\u052f\u0530-\u058f\u0600-\u06ff\u0900-\u0d7f\u10a0-\u10ff\u3040-\u30ff\u3400-\u9fff]|\b(?:BEKLET|DOSYA|SİNYAL|Türkçe|lansman|cüzdan|kanıt|tören|hazırlık)\b/iu;
  const escapedTargetScript = /\\u(?:011e|011f|0130|0131|015e|015f|0[3-6][0-9a-f]{2}|09[0-9a-f]{2}|0[abc][0-9a-f]{2}|10[ab][0-9a-f]|3[04][0-9a-f]{2}|[4-9][0-9a-f]{3})/iu;

  assert.equal(reviewedPolicy.mode, "GLOBAL_FAIL_CLOSED");
  assert.equal(reviewedPolicy.unreviewedTargetLanguageBundleAllowed, false);
  assert.equal(reviewedPolicy.unreviewedLocaleAutonymsAllowed, false);
  assert.equal(reviewedPolicy.directComponentReviewBundleComplete, false);
  assert.deepEqual(reviewedPolicy.translations, {});
  assert.deepEqual(reviewedPolicy.reviews, []);
  for (const [path, source] of routeSources) {
    assert.doesNotMatch(source, targetLocaleObject, `${path} target-locale object branch`);
    assert.doesNotMatch(source, targetLocaleCondition, `${path} target-locale conditional`);
    assert.doesNotMatch(source, directLocaleResolver, `${path} direct locale resolver`);
    assert.doesNotMatch(source, /\b(?:TR|tailoredTR)\b/, `${path} Turkish draft identifier`);
    assert.doesNotMatch(source, /"en"\s*\|\s*"tr"/, `${path} bilingual state type`);
    assert.doesNotMatch(source, unreviewedAutonymOrCopy, `${path} unreviewed target-language literal`);
    assert.doesNotMatch(source, escapedTargetScript, `${path} escaped target-language literal`);
  }
});

test("catalogs reject replacement characters, bidi overrides, and executable translation payloads", () => {
  for (const [locale, messages] of Object.entries(catalog.messages)) {
    for (const [source, translation] of Object.entries(messages)) {
      assert.doesNotMatch(translation, /\uFFFD/, `${locale} replacement character in ${source}`);
      assert.doesNotMatch(translation, /[\u202A-\u202E\u2066-\u2069]/u, `${locale} bidi override/isolate in ${source}`);
      assert.doesNotMatch(translation, /__IA_(?:TERM|EXACT)_[A-Z]+__/u, `${locale} unresolved placeholder in ${source}`);
      assert.doesNotMatch(translation, /<script\b|javascript:/i, `${locale} executable text in ${source}`);
    }
  }
});

test("the public report is honest, source-bound, and remains non-authorizing", () => {
  assert.equal(report.scope.locales, 50);
  assert.equal(report.scope.canonicalStrings, Object.keys(catalog.messages.en).length);
  assert.equal(report.scope.languageQaResults, 5000);
  assert.equal(report.outcome.automatedCatalogCompleteness, "PASS");
  assert.equal(report.outcome.reviewedRuntimePolicyGate, "PASS");
  assert.equal(report.scope.reviewedRuntimeCells, 0);
  assert.equal(
    report.scope.canonicalFallbackCells,
    Object.keys(catalog.messages.en).length * (Object.keys(catalog.messages).length - 1),
  );
  assert.equal(report.outcome.sourceBoundLanguageScorecard, "HOLD");
  assert.equal(report.outcome.sourceBoundRenderEvidence, "PASS");
  assert.match(report.outcome.nativeLanguageSignoff, /^HOLD/);
  assert.match(report.mainnetDecision, /^HOLD/);
  assert.equal(report.deploymentPerformed, false);
  assert.equal(report.browserQa.allLocaleRootMatrix.localeCount, 50);
  assert.equal(report.browserQa.allLocaleRootMatrix.failures, 0);
  assert.equal(report.browserQa.responsiveMatrix.failures, 0);
  assert.deepEqual(report.scorecard.summary, scorecard.summary);
  assert.equal(scorecard.summary.FAIL, 0);
  assert.equal(scorecard.summary.NOT_RUN, 0);
  assert.ok(scorecard.summary.HOLD > 0, "native and independent review gates must remain HOLD");
  assert.equal(report.scorecard.assurance.nativeQualityClaimAllowed, false);
  assert.equal(report.scorecard.assurance.releaseApproved, false);
  assert.equal(report.renderEvidence.status, "PASS");
  assert.equal(report.renderEvidence.scope.localeCount * report.renderEvidence.scope.claimedChecksPerLocale, 1250);
  assert.match(report.historicalValidation.provenance, /does not claim these commands were rerun/u);
  for (const file of Object.values(report.files)) assert.match(file.sha256, /^[a-f0-9]{64}$/);
});

test("canonical pages leave document language ownership to the shared runtime and preserve touch targets", async () => {
  const [page, tokenomics, globalStyles, futureStyles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/tokenomics/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/future/future.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(page, /document\.documentElement\.(?:lang|dir)/);
  assert.doesNotMatch(tokenomics, /document\.documentElement\.(?:lang|dir)/);
  assert.doesNotMatch(page, /\b(?:sourceLanguageForClientPath|localeFromRequestHeaders)\b/);
  assert.doesNotMatch(tokenomics, /\b(?:sourceLanguageForClientPath|localeFromRequestHeaders)\b/);
  assert.match(globalStyles, /nav a,\.text-link,footer a\{display:inline-flex;min-height:24px/);
  assert.match(futureStyles, /\.future-nav div a\{display:inline-flex;min-height:32px/);
});

test("reviewed-or-English locale readiness waits for a mutation-quiet hydration window", async () => {
  const runtime = await readFile(new URL("../app/i18n/LocaleRuntime.tsx", import.meta.url), "utf8");
  const activate = runtime.slice(runtime.indexOf("const activate"), runtime.indexOf("if (locale ===", runtime.indexOf("const activate")));
  const localizeIndex = activate.indexOf("localizeTree(document.body");
  const observeIndex = activate.indexOf("observer.observe(document.body");
  const readinessIndex = activate.lastIndexOf("armReadiness()");
  assert.ok(observeIndex >= 0 && observeIndex < localizeIndex, "observation must cover the initial translation and any concurrent hydration rewrite");
  assert.ok(localizeIndex < readinessIndex, "readiness must begin only after initial localization completes");
  assert.match(runtime, /const localizedTextValues = new WeakMap<Text, string>\(\)/);
  assert.match(runtime, /if \(contentLocale === "en"\) activate\(\{\}\);/);
  assert.match(runtime, /else \{\s*fetch\(localePayloadPath\(locale\), \{ cache: "force-cache" \}\)/);
  assert.match(runtime, /node\.parentElement\?\.closest\("script, style, code, pre, \[data-no-translate\]"\)/);
  assert.match(runtime, /if \(localizedTextValues\.get\(node\) === value\) return;/);
  assert.match(runtime, /localizedTextValues\.set\(node, node\.nodeValue \?\? ""\);/);
  assert.match(activate, /new MutationObserver[\s\S]+armReadiness\(\)/);
  assert.match(runtime, /const hydrationQuietWindowMs = 100;/);
  assert.match(runtime, /if \(document\.documentElement\.dataset\.localeReady === "true"\) return;/);
  assert.match(runtime, /document\.documentElement\.dataset\.localeReady = "false";[\s\S]+clearTimeout[\s\S]+setTimeout/);
  assert.match(runtime, /if \(readinessTimer !== null\) window\.clearTimeout\(readinessTimer\);[\s\S]+observer\?\.disconnect\(\)/);
});

test("render evidence capture retries boundedly and exits red for a failed artifact", async () => {
  const harness = await readFile(new URL("../scripts/capture-language-render-evidence.mjs", import.meta.url), "utf8");
  assert.match(harness, /mapLimit\(tasks, 4,/);
  assert.match(harness, /attempt <= 3/);
  assert.match(harness, /retryable browser QA failure/);
  assert.match(harness, /if \(artifact\.status !== "PASS"\) process\.exitCode = 1;/);
  assert.doesNotMatch(harness, /mapLimit\(tasks, 10,/);
});
