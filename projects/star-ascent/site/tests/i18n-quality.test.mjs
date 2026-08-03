import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readJson = (path) => readFile(new URL(path, import.meta.url), "utf8").then(JSON.parse);
const [catalog, critical, overrides, report] = await Promise.all([
  readJson("../app/i18n/messages.json"),
  readJson("../app/i18n/critical-ui-source.json"),
  readJson("../app/i18n/critical-ui-overrides.json"),
  readJson("../public/audits/localization-qa-20260803/report.json"),
]);

test("critical client-only UI copy is explicitly localized in every non-English locale", () => {
  const criticalSources = Object.values(critical);
  assert.equal(Object.keys(catalog.messages).length, 50);
  assert.equal(Object.keys(overrides.translations).length, 49);
  for (const locale of Object.keys(catalog.messages).slice(1)) {
    assert.deepEqual(Object.keys(overrides.translations[locale]).sort(), [...criticalSources].sort());
    for (const source of criticalSources) {
      const translation = catalog.messages[locale][source];
      assert.equal(translation, overrides.translations[locale][source]);
      assert.notEqual(translation.trim().toLocaleLowerCase(), source.toLocaleLowerCase());
      assert.equal((translation.match(/\/\//g) ?? []).length, (source.match(/\/\//g) ?? []).length);
      if (source.includes("STAR ASCENT")) assert.match(translation, /STAR ASCENT/);
    }
  }
});

test("catalogs reject replacement characters, bidi overrides, and executable translation payloads", () => {
  for (const [locale, messages] of Object.entries(catalog.messages)) {
    for (const [source, translation] of Object.entries(messages)) {
      assert.doesNotMatch(translation, /\uFFFD/, `${locale} replacement character in ${source}`);
      assert.doesNotMatch(translation, /[\u202A-\u202E\u2066-\u2069]/u, `${locale} bidi override/isolate in ${source}`);
      assert.doesNotMatch(translation, /<script\b|javascript:/i, `${locale} executable text in ${source}`);
    }
  }
});

test("the public report is honest, source-bound, and remains non-authorizing", () => {
  assert.equal(report.scope.locales, 50);
  assert.equal(report.outcome.automatedCatalogCompleteness, "PASS");
  assert.equal(report.outcome.criticalEnglishFallbackGate, "PASS");
  assert.match(report.outcome.nativeLanguageSignoff, /^HOLD/);
  assert.match(report.mainnetDecision, /^HOLD/);
  assert.equal(report.deploymentPerformed, false);
  assert.equal(report.browserQa.allLocaleRootMatrix.localeCount, 50);
  assert.equal(report.browserQa.allLocaleRootMatrix.failures, 0);
  assert.equal(report.browserQa.responsiveMatrix.failures, 0);
  for (const file of Object.values(report.files)) assert.match(file.sha256, /^[a-f0-9]{64}$/);
});

test("localized routes keep document language ownership and touch targets after hydration", async () => {
  const [page, globalStyles, futureStyles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/future/future.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /if \(isLocaleCode\(routeLocale\)\) return;[\s\S]*document\.documentElement\.lang = language/);
  assert.match(globalStyles, /nav a,\.text-link,footer a\{display:inline-flex;min-height:24px/);
  assert.match(futureStyles, /\.future-nav div a\{display:inline-flex;min-height:32px/);
});
