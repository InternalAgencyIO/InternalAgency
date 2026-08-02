import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const catalog = JSON.parse(await readFile(new URL("../app/i18n/messages.json", import.meta.url), "utf8"));
const expectedLocales = [
  "en", "zh", "es", "hi", "fr", "ar", "bn", "pt", "id", "ur", "ru", "de", "ja", "pcm", "tr",
  "sq", "ca", "be", "nl", "bs", "bg", "hr", "el", "cs", "da", "et", "fi", "hu", "is", "ga", "it",
  "lv", "lt", "lb", "mk", "mt", "no", "pl", "ro", "sr", "sk", "sl", "sv", "uk", "ht", "gn", "qu",
  "hy", "az", "ka",
];
const sourceKeys = Object.keys(catalog.messages.en);
const protectedTerms = [
  "Internal Agency", "STAR ASCENT", "$IAT", "$SOL", "IAT", "SOLANA", "Solana", "Model T", "Genesis",
  "APY", "CCC-Agent", "Radiance", "Ellie", "Alia", "UTC", "İSTANBUL",
];
const approvedEquivalents = {
  tr: { "Internal Agency": "İleri Akıl", Genesis: "Başlangıç" },
};
const exactTokenPattern = /https?:\/\/[^\s]+|@[A-Za-z0-9_]+|\$[A-Z][A-Z0-9_-]*|\bT\+\d+(?:[.,:]\d+)*\b/g;

assert.ok(sourceKeys.length >= 250, `Expected a whole-site catalog, found only ${sourceKeys.length} source strings`);
assert.equal(catalog.meta.sourceCount, sourceKeys.length, "Catalog source count must match English keys");
assert.deepEqual(Object.keys(catalog.messages), expectedLocales, "Catalog locale order changed unexpectedly");

for (const locale of expectedLocales) {
  const keys = Object.keys(catalog.messages[locale]);
  assert.deepEqual(keys, sourceKeys, `${locale} must cover every canonical source string`);
  for (const source of sourceKeys) {
    assert.equal(typeof catalog.messages[locale][source], "string", `${locale} missing ${source}`);
    assert.ok(catalog.messages[locale][source].trim(), `${locale} has an empty translation for ${source}`);
    for (const protectedTerm of protectedTerms) {
      const approved = approvedEquivalents[locale]?.[protectedTerm];
      if (source.includes(protectedTerm)) assert.ok(
        catalog.messages[locale][source].includes(protectedTerm) || Boolean(approved && catalog.messages[locale][source].includes(approved)),
        `${locale} changed protected term ${protectedTerm}`,
      );
    }
    assert.doesNotMatch(catalog.messages[locale][source], /ZXQTERM\d+QXZ/i, `${locale} leaked a translation placeholder for ${source}`);
    for (const number of source.match(/(?<![\p{L}\p{N}_])\d+(?:[.,:]\d+)*(?:[A-Za-z]+|%)?(?![\p{L}\p{N}_])/gu) ?? []) {
      assert.ok(catalog.messages[locale][source].includes(number), `${locale} changed numeric/unit token ${number} in ${source}`);
    }
    for (const token of source.match(exactTokenPattern) ?? []) {
      assert.ok(catalog.messages[locale][source].includes(token), `${locale} changed exact token ${token} in ${source}`);
    }
    assert.doesNotMatch(catalog.messages[locale][source], /<script\b|javascript:/i, `${locale} introduced executable markup in ${source}`);
    const expansionRatio = catalog.messages[locale][source].length / Math.max(1, source.length);
    assert.ok(
      catalog.messages[locale][source].length <= 800 && (source.length <= 40 || expansionRatio <= 4),
      `${locale} produced a suspiciously expanded translation for ${source}`,
    );
  }
  const promptSource = catalog.prompts.en.english;
  assert.ok(catalog.prompts[locale]?.english || catalog.messages[locale][promptSource], `${locale} is missing the local-language English-return prompt`);
}

assert.equal(catalog.messages.en["This closes on its own in 15 seconds."], "This closes on its own in 15 seconds.");
assert.match(catalog.meta.translationMode ?? "", /static committed output/i, "Catalog must disclose static translation mode");

const metadata = JSON.parse(await readFile(new URL("../app/i18n/metadata.generated.json", import.meta.url), "utf8"));
const routeSeo = JSON.parse(await readFile(new URL("../app/i18n/route-seo.json", import.meta.url), "utf8"));
const routeSeoSources = [...new Set(Object.values(routeSeo).flatMap(({ title, description }) => [title, description]))];
for (const source of routeSeoSources) {
  assert.ok(sourceKeys.includes(source), `Route SEO source is not part of the canonical translation catalog: ${source}`);
}
assert.deepEqual(Object.keys(metadata), expectedLocales, "Localized metadata must cover every locale");
for (const locale of expectedLocales) {
  const payload = JSON.parse(await readFile(new URL(`../public/i18n/${locale}.json`, import.meta.url), "utf8"));
  assert.equal(payload.locale, locale, `${locale} static payload is mislabeled`);
  assert.equal(Object.keys(payload.messages).length, sourceKeys.length, `${locale} static payload is incomplete`);
  assert.equal(metadata[locale].prompt.timeout.includes("15"), true, `${locale} prompt must retain the 15-second timeout`);
  assert.ok(metadata[locale].title.length <= 140, `${locale} root title is unreasonably long`);
  assert.ok(metadata[locale].description.length <= 400, `${locale} root description is unreasonably long`);
  for (const source of routeSeoSources) {
    assert.ok(metadata[locale].seo[source]?.trim(), `${locale} is missing route SEO copy for ${source}`);
  }
}

console.log(`i18n catalog valid: ${sourceKeys.length} strings × ${expectedLocales.length} locales`);
