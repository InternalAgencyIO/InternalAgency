import { readFile } from "node:fs/promises";

const catalogUrl = new URL("../app/i18n/messages.json", import.meta.url);
const metadataUrl = new URL("../app/i18n/metadata.generated.json", import.meta.url);
const pendingUrl = new URL("../app/i18n/pending-visible-source.json", import.meta.url);
const reviewedPolicyUrl = new URL("../app/i18n/reviewed-localization-policy.json", import.meta.url);

// Exceptions must be narrow, source-bound, and reviewed in this file. Broad locale
// or rule suppression is intentionally unsupported.
const allowlist = Object.freeze({
  cssSelectorSourceKeys: new Set(),
  collapseTranslations: new Set(),
  noLetterTranslations: new Set(),
  exactEnglishCatalogFallbacks: new Set(),
  exactEnglishMetadataFallbacks: new Set(),
});

const localizedKey = (locale, source) => `${locale}\u0000${source}`;
const metadataKey = (locale, path, source) => `${locale}\u0000${path}\u0000${source}`;
const normalize = (value) => value.normalize("NFC").trim().replace(/\s+/gu, " ");

function looksLikeCssSelector(value) {
  if (value.length > 300 || !/[\[:]/u.test(value)) return false;
  const parts = value.split(/\s*,\s*/u);
  if (parts.length === 0) return false;
  return parts.every((part) => (
    /^(?:[a-z][\w-]*|[.#][\w-]+)(?:(?:\[[^\]]+\])|(?::(?:not|is|where|has)\([^)]*\)))+$/iu.test(part)
  ));
}

function hasRepeatedNonWordRun(value, minimum = 12) {
  const codePoints = Array.from(value);
  let previous = "";
  let run = 0;
  for (const codePoint of codePoints) {
    if (/^[\p{L}\p{N}\s]$/u.test(codePoint)) {
      previous = "";
      run = 0;
      continue;
    }
    run = codePoint === previous ? run + 1 : 1;
    previous = codePoint;
    if (run >= minimum) return true;
  }
  return false;
}

function hasRepeatedWordRun(value, minimum = 8) {
  const words = value.toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? [];
  let previous = "";
  let run = 0;
  for (const word of words) {
    run = word === previous ? run + 1 : 1;
    previous = word;
    if (run >= minimum) return true;
  }
  return false;
}

function hasRepeatedSubstringRun(value, repetitions = 10) {
  const codePoints = Array.from(value.normalize("NFC"));
  for (let width = 2; width <= 8; width += 1) {
    const runLength = width * repetitions;
    for (let start = 0; start + runLength <= codePoints.length; start += 1) {
      const pattern = codePoints.slice(start, start + width);
      if (!pattern.join("").trim()) continue;
      let matches = true;
      for (let offset = width; offset < runLength && matches; offset += width) {
        for (let index = 0; index < width; index += 1) {
          if (codePoints[start + offset + index] !== pattern[index]) {
            matches = false;
            break;
          }
        }
      }
      if (matches) return true;
    }
  }
  return false;
}

function collapseReasons(value) {
  const reasons = [];
  if (hasRepeatedNonWordRun(value)) reasons.push("repeated-nonword-run");
  if (hasRepeatedWordRun(value)) reasons.push("repeated-word-run");
  if (hasRepeatedSubstringRun(value)) reasons.push("repeated-substring-run");
  return reasons;
}

function hasMeaningfulLetterSource(value) {
  return (value.match(/\p{L}+/gu) ?? []).length >= 2;
}

const englishFunctionWords = new Set([
  "a", "an", "and", "any", "are", "as", "at", "be", "before", "but", "by", "does", "do", "every",
  "for", "from", "has", "if", "in", "into", "is", "it", "must", "no", "not", "of", "on", "only",
  "or", "should", "that", "the", "their", "this", "to", "until", "was", "were", "will", "with", "without",
  "you", "your",
]);

function looksLikeEnglishSentence(value) {
  const trimmed = value.trim();
  if (!/[.!?]["')\]]*$/u.test(trimmed)) return false;
  if (/[çğıöşüÇĞİÖŞÜ]/u.test(trimmed)) return false;
  const words = trimmed.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) ?? [];
  if (words.length < 5) return false;
  const allLetterWords = trimmed.match(/\p{L}+(?:['’-]\p{L}+)*/gu) ?? [];
  if (words.length / Math.max(1, allLetterWords.length) < 0.8) return false;
  const functionWordCount = words.reduce(
    (count, word) => count + Number(englishFunctionWords.has(word.toLocaleLowerCase("en"))),
    0,
  );
  return functionWordCount >= 2;
}

function collectStringLeaves(value, path = "") {
  if (typeof value === "string") return [{ path, value }];
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => (
    collectStringLeaves(child, path ? `${path}.${key}` : key)
  ));
}

function truncate(value, length = 150) {
  const compact = normalize(value);
  return compact.length > length ? `${compact.slice(0, length - 1)}…` : compact;
}

const [catalog, metadata, pending, reviewedPolicy] = await Promise.all([
  readFile(catalogUrl, "utf8").then(JSON.parse),
  readFile(metadataUrl, "utf8").then(JSON.parse),
  readFile(pendingUrl, "utf8").then(JSON.parse),
  readFile(reviewedPolicyUrl, "utf8").then(JSON.parse),
]);
if (
  reviewedPolicy.schema !== "iat-reviewed-localization-policy/v1"
  || reviewedPolicy.mode !== "GLOBAL_FAIL_CLOSED"
  || reviewedPolicy.fallback !== "canonical-english"
  || reviewedPolicy.machineDraftRuntimeAllowed !== false
  || reviewedPolicy.unreviewedTargetLanguageBundleAllowed !== false
  || reviewedPolicy.unreviewedLocaleAutonymsAllowed !== false
  || reviewedPolicy.directComponentReviewBundleComplete !== false
) throw new Error("Linguistic-integrity validation requires the complete GLOBAL_FAIL_CLOSED policy");

const locales = Object.keys(catalog.messages ?? {});
const sourceMessages = catalog.messages?.en ?? {};
const sources = Object.keys(sourceMessages);
const englishSentenceSources = new Set(sources.filter(looksLikeEnglishSentence));
const englishMetadataByPath = new Map(
  collectStringLeaves(metadata.en ?? {})
    .filter(({ value }) => looksLikeEnglishSentence(value))
    .map(({ path, value }) => [path, normalize(value)]),
);
const selectorSources = sources.filter((source) => (
  looksLikeCssSelector(source) && !allowlist.cssSelectorSourceKeys.has(source)
));
const findings = [];
const counts = Object.fromEntries(locales.map((locale) => [locale, {
  cssSelectorCells: selectorSources.length,
  collapse: 0,
  noLetter: 0,
  exactEnglishCatalog: 0,
  exactEnglishMetadata: 0,
  unreviewedRuntime: 0,
}]));

for (const source of selectorSources) {
  findings.push({ rule: "css-selector-source-key", scope: "catalog", locale: "*", source });
}

for (const locale of locales) {
  if (locale === "en") continue;
  const messages = catalog.messages[locale] ?? {};
  for (const source of sources) {
    const translation = messages[source];
    if (typeof translation !== "string") continue;
    const key = localizedKey(locale, source);
    const reviewedTranslation = reviewedPolicy.translations?.[locale]?.[source];
    const expectedRuntimeTranslation = reviewedTranslation ?? source;
    if (translation !== expectedRuntimeTranslation) {
      counts[locale].unreviewedRuntime += 1;
      findings.push({ rule: "unreviewed-runtime-translation", scope: "catalog", locale, source, translation });
    }
    const reasons = collapseReasons(translation);
    if (reasons.length > 0 && !allowlist.collapseTranslations.has(key)) {
      counts[locale].collapse += 1;
      findings.push({ rule: "translation-collapse", scope: "catalog", locale, source, translation, reasons });
    }
    if (
      hasMeaningfulLetterSource(source)
      && !/\p{L}/u.test(translation)
      && !allowlist.noLetterTranslations.has(key)
    ) {
      counts[locale].noLetter += 1;
      findings.push({ rule: "translation-has-no-letters", scope: "catalog", locale, source, translation });
    }
    if (
      englishSentenceSources.has(source)
      && reviewedTranslation !== undefined
      && normalize(translation) === normalize(source)
      && !allowlist.exactEnglishCatalogFallbacks.has(key)
    ) {
      counts[locale].exactEnglishCatalog += 1;
      findings.push({ rule: "exact-english-catalog-fallback", scope: "catalog", locale, source, translation });
    }
  }

  for (const leaf of collectStringLeaves(metadata[locale] ?? {})) {
    const normalizedValue = normalize(leaf.value);
    const englishValue = englishMetadataByPath.get(leaf.path);
    if (
      englishValue !== undefined
      && reviewedPolicy.localeStatus?.[locale] === "REVIEWED"
      && normalizedValue === englishValue
      && !allowlist.exactEnglishMetadataFallbacks.has(metadataKey(locale, leaf.path, englishValue))
    ) {
      counts[locale].exactEnglishMetadata += 1;
      findings.push({
        rule: "exact-english-metadata-fallback",
        scope: "metadata",
        locale,
        path: leaf.path,
        source: englishValue,
        translation: leaf.value,
      });
    }
  }
}

const pendingSourceCount = Array.isArray(pending.sources) ? pending.sources.length : 0;
const pendingRuntimeUnsafe = pendingSourceCount > 0 && (
  pending.runtime?.active === true || pending.runtime?.automaticEnglishFallbackApproved === true
);
if (pendingRuntimeUnsafe) {
  findings.push({
    rule: "pending-source-runtime-active",
    scope: "pending",
    locale: "*",
    source: `${pendingSourceCount} pending source strings`,
  });
}

console.log("I18N linguistic-integrity heuristic (not semantic or native-language certification)");
console.log(`catalog=${sources.length} sources x ${locales.length} locales; pending=${pendingSourceCount}; selectorSources=${selectorSources.length}`);
for (const locale of locales) {
  const entry = counts[locale];
  const triggerCount = Object.values(entry).reduce((sum, count) => sum + count, 0);
  console.log([
    `locale=${locale}`,
    `cssSelectorCells=${entry.cssSelectorCells}`,
    `collapse=${entry.collapse}`,
    `noLetter=${entry.noLetter}`,
    `exactEnglishCatalog=${entry.exactEnglishCatalog}`,
    `exactEnglishMetadata=${entry.exactEnglishMetadata}`,
    `unreviewedRuntime=${entry.unreviewedRuntime}`,
    `triggers=${triggerCount}`,
  ].join(" "));
}

if (findings.length > 0) {
  const byRule = Object.groupBy
    ? Object.groupBy(findings, ({ rule }) => rule)
    : findings.reduce((groups, finding) => {
      (groups[finding.rule] ??= []).push(finding);
      return groups;
    }, {});
  console.error("\nFAIL: deterministic linguistic-integrity heuristics found blocking candidates.");
  for (const [rule, entries] of Object.entries(byRule)) {
    console.error(`\n${rule}: ${entries.length}`);
    for (const finding of entries.slice(0, 5)) {
      const location = finding.path ? `${finding.locale}:${finding.path}` : finding.locale;
      const reason = finding.reasons ? ` [${finding.reasons.join(",")}]` : "";
      console.error(`- ${location}${reason} source=${JSON.stringify(truncate(finding.source))}`);
      if (finding.translation !== undefined) {
        console.error(`  output=${JSON.stringify(truncate(finding.translation))}`);
      }
    }
    if (entries.length > 5) console.error(`  ... ${entries.length - 5} more`);
  }
  console.error("\nHOLD: fix or narrowly allowlist every candidate after human review. Passing this script still does not certify meaning, cadence, slang, cultural fit, or native-speaker quality.");
  process.exitCode = 1;
} else {
  console.log("PASS: no deterministic candidates found. Native-speaker review and semantic QA remain required.");
}
