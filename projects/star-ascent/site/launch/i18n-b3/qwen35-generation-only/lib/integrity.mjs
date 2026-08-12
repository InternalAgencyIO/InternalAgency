import { createHash } from "node:crypto";

export const FROZEN_SOURCE_COUNT = 1491;
export const FROZEN_SOURCE_SHA256 = "5baff9a147d6390100a976e2d77b860ec0225db92f05ebb0d6361ac2c8981004";
export const TARGET_LOCALE_COUNT = 48;
export const TARGET_CELL_COUNT = FROZEN_SOURCE_COUNT * TARGET_LOCALE_COUNT;
export const MODEL_REVISION = "2fc06364715b967f1860aea9cf38778875588b17";
export const ACTIVATION_ALLOWED = false;

export const PROTECTED_BRANDS = Object.freeze([
  "Internal Agency Token",
  "Internal Agency",
  "X Premium",
  "Solana",
  "IAT",
  "CCC",
  "B3",
  "X",
]);

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function allMatches(text, regex, group = 0) {
  return [...text.matchAll(regex)].map((match) => match[group]).filter(Boolean);
}

function extractBalancedBraces(text) {
  const results = [];
  let depth = 0;
  let start = -1;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "{") {
      if (depth === 0) start = index;
      depth += 1;
    } else if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        results.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }
  return results;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function brandMatches(text, brands) {
  const matches = [];
  for (const brand of [...brands].sort((a, b) => b.length - a.length || a.localeCompare(b, "en"))) {
    const regex = new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegex(brand)}(?![\\p{L}\\p{N}_])`, "gu");
    matches.push(...allMatches(text, regex));
  }
  return matches;
}

export function protectedInventory(text, { brands = PROTECTED_BRANDS } = {}) {
  if (typeof text !== "string") throw new TypeError("protectedInventory requires a string");

  const urls = allMatches(text, /(?:https?:\/\/|mailto:)[^\s<>"'`]+/gu).map((value) => value.replace(/[),.;!?]+$/u, ""));
  const codeTokens = [
    ...allMatches(text, /(?<![\p{L}\p{N}_])[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]+(?![\p{L}\p{N}_])/gu),
    ...allMatches(text, /(?<![\p{L}\p{N}_])[a-z]+(?:[A-Z][A-Za-z0-9]*)+(?![\p{L}\p{N}_])/gu),
    ...allMatches(text, /(?<![\p{L}\p{N}_])(?:[A-Za-z0-9_.-]+[\\/]){1,}[A-Za-z0-9_.-]+(?![\p{L}\p{N}_])/gu),
  ].filter((token) => !urls.some((url) => url.includes(token)));

  const categories = {
    braces: extractBalancedBraces(text),
    dollarPlaceholders: allMatches(text, /\$\{[^{}]+\}/gu),
    mustachePlaceholders: allMatches(text, /\{\{[^{}]+\}\}/gu),
    printfPlaceholders: allMatches(text, /%(?:\d+\$)?[-+#0 ]*(?:\d+|\*)?(?:\.\d+)?[a-zA-Z%]/gu),
    urls,
    inlineCode: allMatches(text, /`[^`\r\n]+`/gu),
    htmlTags: allMatches(text, /<\/?[A-Za-z][^>]*>/gu),
    commandFlags: allMatches(text, /(?<![\p{L}\p{N}_])--?[A-Za-z][A-Za-z0-9-]*/gu),
    codeTokens,
    acronyms: allMatches(text, /(?<![\p{L}\p{N}_])[A-Z][A-Z0-9_]{1,}(?![\p{L}\p{N}_])/gu),
    brands: brandMatches(text, brands),
    numbers: allMatches(text, /(?<![\p{L}\p{N}_])\d+(?:[.,:]\d+)*(?:%|x)?(?![\p{L}\p{N}_])/gu),
  };

  const tokens = [...new Set(Object.values(categories).flat())].sort((a, b) => a.localeCompare(b, "en"));
  const tokenCounts = tokens.map((token) => {
    let count = 0;
    let offset = 0;
    while ((offset = text.indexOf(token, offset)) >= 0) {
      count += 1;
      offset += token.length;
    }
    return { token, count };
  });
  return { categories, tokens, tokenCounts };
}

function multisetDelta(expected, actual) {
  const counts = (values) => values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map());
  const expectedCounts = counts(expected);
  const actualCounts = counts(actual);
  const missing = [];
  const added = [];
  for (const token of new Set([...expectedCounts.keys(), ...actualCounts.keys()])) {
    const difference = (expectedCounts.get(token) ?? 0) - (actualCounts.get(token) ?? 0);
    if (difference > 0) missing.push({ token, count: difference });
    if (difference < 0) added.push({ token, count: -difference });
  }
  return { missing, added };
}

export function compareProtectedInventory(source, translation, options) {
  const expected = protectedInventory(source, options);
  const actual = protectedInventory(translation, options);
  const categories = {};
  let pass = true;
  for (const name of Object.keys(expected.categories)) {
    const delta = multisetDelta(expected.categories[name], actual.categories[name]);
    const categoryPass = delta.missing.length === 0 && delta.added.length === 0;
    categories[name] = { pass: categoryPass, ...delta };
    pass &&= categoryPass;
  }
  return { pass, categories, expectedTokens: expected.tokens, actualTokens: actual.tokens };
}

export function parseTranslationEnvelope(raw) {
  if (typeof raw !== "string") throw new TypeError("model output must be a string");
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) throw new Error("output is not one JSON object");
  let value;
  try {
    value = JSON.parse(trimmed);
  } catch (error) {
    throw new Error(`invalid JSON: ${error.message}`);
  }
  if (!value || Array.isArray(value) || typeof value !== "object") throw new Error("JSON output must be an object");
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== "translation") throw new Error("JSON object must contain exactly the translation key");
  if (typeof value.translation !== "string") throw new Error("translation must be a JSON string");
  return value.translation;
}

function stripProtected(text, tokens) {
  let result = text;
  for (const token of [...new Set(tokens)].sort((a, b) => b.length - a.length)) {
    result = result.split(token).join(" ");
  }
  return result;
}

function latinWords(text) {
  return allMatches(text.toLocaleLowerCase("en"), /\p{Script=Latin}[\p{Script=Latin}\p{M}'’_-]{2,}/gu);
}

export function sourceEchoScore(source, translation, protectedTokens = []) {
  const sourceWords = latinWords(stripProtected(source, protectedTokens));
  const outputWords = new Set(latinWords(stripProtected(translation, protectedTokens)));
  if (sourceWords.length === 0) return { eligibleWords: 0, matchingWords: 0, ratio: 0 };
  const matchingWords = sourceWords.filter((word) => outputWords.has(word)).length;
  return { eligibleWords: sourceWords.length, matchingWords, ratio: matchingWords / sourceWords.length };
}

export function nonProtectedContentEvidence(source, translation, protectedTokens = []) {
  const sourceText = stripProtected(source, protectedTokens);
  const translationText = stripProtected(translation, protectedTokens);
  const sourceLetterCount = allMatches(sourceText, /\p{L}/gu).length;
  const translationLetterCount = allMatches(translationText, /\p{L}/gu).length;
  const requiredTranslationLetters = Math.max(1, Math.ceil(Math.min(sourceLetterCount, 50) * 0.08));
  return {
    pass: translationLetterCount >= requiredTranslationLetters,
    sourceLetterCount,
    translationLetterCount,
    requiredTranslationLetters,
    policy: "AT_LEAST_ONE_NONPROTECTED_LETTER_AND_EIGHT_PERCENT_OF_FIRST_FIFTY_SOURCE_LETTERS",
  };
}

const SCRIPT_PATTERNS = Object.freeze({
  Hans: /\p{Script=Han}/gu,
  Jpan: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu,
  Arab: /\p{Script=Arabic}/gu,
  Cyrl: /\p{Script=Cyrillic}/gu,
  Deva: /\p{Script=Devanagari}/gu,
  Beng: /\p{Script=Bengali}/gu,
  Grek: /\p{Script=Greek}/gu,
  Armn: /\p{Script=Armenian}/gu,
  Geor: /\p{Script=Georgian}/gu,
  Latn: /\p{Script=Latin}/gu,
});

export function targetScriptEvidence(translation, script, protectedTokens = []) {
  const unprotected = stripProtected(translation, protectedTokens);
  const letters = allMatches(unprotected, /\p{L}/gu);
  const pattern = SCRIPT_PATTERNS[script];
  if (!pattern) return { pass: false, script, reason: "UNSUPPORTED_SCRIPT_GATE", letterCount: letters.length, matchingCount: 0, ratio: 0 };
  const matchingCount = allMatches(unprotected, pattern).length;
  const ratio = letters.length === 0 ? 0 : matchingCount / letters.length;
  const minimumRatio = script === "Jpan" || script === "Hans" ? 0.45 : 0.65;
  return {
    pass: letters.length < 3 ? true : matchingCount >= 2 && ratio >= minimumRatio,
    script,
    reason: letters.length < 3 ? "INSUFFICIENT_TRANSLATABLE_LETTERS_SKIP" : "MEASURED",
    letterCount: letters.length,
    matchingCount,
    ratio,
    minimumRatio,
  };
}

const TAIL_LANGUAGE_PATTERNS = Object.freeze({
  es: /\b(?:gato|aqui|aquí|nodo|agentes?|activo|activos|abra|abre)\b/iu,
  mt: /\b(?:qattus|hawn|qieghed|qiegħed|ghandu|għandu|nodu|agenti|attiv)\b/iu,
  gn: /(?:\bmbarakaja\b|\bko['’]ape\b|\boĩ\b|\boime\b|\btenda\b|\bpe\b)/iu,
  qu: /\b(?:misi|kaypi|kachkan|kashan|kichay|nodo|ruraq)\b/iu,
});

export function benchmarkLanguageEvidence(locale, translation, protectedTokens = []) {
  const unprotected = stripProtected(translation, protectedTokens);
  if (locale === "zh") {
    const count = allMatches(unprotected, /\p{Script=Han}/gu).length;
    return { method: "COMMITTED_HEURISTIC_SCRIPT_AND_MINIMUM_CHARACTERS", proofLevel: "HEURISTIC_ONLY", expectedLocale: locale, pass: count >= 3, matches: count };
  }
  if (locale === "ar") {
    const count = allMatches(unprotected, /\p{Script=Arabic}/gu).length;
    return { method: "COMMITTED_HEURISTIC_SCRIPT_AND_MINIMUM_CHARACTERS", proofLevel: "HEURISTIC_ONLY", expectedLocale: locale, pass: count >= 5, matches: count };
  }
  if (locale === "ja") {
    const count = allMatches(unprotected, /[\p{Script=Hiragana}\p{Script=Katakana}]/gu).length;
    return { method: "COMMITTED_HEURISTIC_KANA_AND_MINIMUM_CHARACTERS", proofLevel: "HEURISTIC_ONLY", expectedLocale: locale, pass: count >= 3, matches: count };
  }
  const pattern = TAIL_LANGUAGE_PATTERNS[locale];
  if (!pattern) return { method: "UNAVAILABLE", proofLevel: "NONE", expectedLocale: locale, pass: false, matches: 0 };
  const match = unprotected.match(pattern)?.[0] ?? null;
  return { method: "COMMITTED_HEURISTIC_LEXICAL_SENTINEL", proofLevel: "HEURISTIC_ONLY", expectedLocale: locale, pass: Boolean(match), match };
}

export function validateTranslation({ source, outputJson, localeEntry, languagePolicy = "none" }) {
  if (!new Set(["none", "candidate", "benchmark-gate"]).has(languagePolicy)) throw new Error(`unsupported language policy: ${languagePolicy}`);
  const errors = [];
  let translation = "";
  try {
    translation = parseTranslationEnvelope(outputJson);
  } catch (error) {
    errors.push(`JSON_ENVELOPE:${error.message}`);
    return { pass: false, errors, translation: null };
  }

  if (translation.trim().length === 0) errors.push("EMPTY_TRANSLATION");
  if (/\u0000|[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u.test(translation)) errors.push("FORBIDDEN_CONTROL_CHARACTER");
  if (/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/u.test(translation)) errors.push("FORBIDDEN_BIDI_CONTROL");
  const normalizedSource = source.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase("en");
  const normalizedTranslation = translation.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase("en");
  if (normalizedSource === normalizedTranslation) errors.push("SOURCE_EQUIVALENT");

  const protectedCheck = compareProtectedInventory(source, translation);
  if (!protectedCheck.pass) errors.push("PROTECTED_TOKEN_MISMATCH");

  const echo = sourceEchoScore(source, translation, protectedCheck.expectedTokens);
  if (echo.eligibleWords >= 4 && echo.ratio > 0.6) errors.push("PROBABLE_SOURCE_ECHO");

  const nonProtectedContent = nonProtectedContentEvidence(source, translation, protectedCheck.expectedTokens);
  if (!nonProtectedContent.pass) errors.push("NONPROTECTED_CONTENT_TOO_THIN");

  const script = targetScriptEvidence(translation, localeEntry.script, protectedCheck.expectedTokens);
  if (!script.pass) errors.push("TARGET_SCRIPT_MISMATCH");

  const structuralPass = errors.length === 0;
  const languageEvidence = benchmarkLanguageEvidence(localeEntry.locale, translation, protectedCheck.expectedTokens);
  const heuristicAvailable = languageEvidence.method !== "UNAVAILABLE";
  if (languagePolicy === "benchmark-gate" && (!heuristicAvailable || !languageEvidence.pass)) {
    errors.push("TARGET_LANGUAGE_HEURISTIC_FAILED");
  } else if (languagePolicy === "candidate" && heuristicAvailable && !languageEvidence.pass) {
    errors.push("TARGET_LANGUAGE_HEURISTIC_FAILED");
  }

  const candidateTier = !structuralPass
    ? "REJECTED_STRUCTURAL"
    : heuristicAvailable && languageEvidence.pass
      ? "HEURISTIC_LANGUAGE_CANDIDATE_NATIVE_REVIEW_REQUIRED"
      : "STRUCTURAL_CANDIDATE_LANGUAGE_AND_NATIVE_REVIEW_REQUIRED";

  return {
    pass: errors.length === 0,
    errors,
    translation,
    translationSha256: sha256(Buffer.from(translation, "utf8")),
    protectedCheck,
    echo,
    nonProtectedContent,
    script,
    languageEvidence,
    languageProof: false,
    nativeReviewRequired: true,
    candidateTier,
    structuralPass,
  };
}

export function assertFrozenSourceEvidence(evidence) {
  if (!evidence || evidence.schema !== "iat-pcm-source-freeze-evidence/v1") throw new Error("unexpected source-freeze schema");
  if (evidence.activationReady !== false) throw new Error("source evidence unexpectedly claims activation readiness");
  const sources = evidence.sourceFreeze?.sources;
  if (!Array.isArray(sources) || sources.length !== FROZEN_SOURCE_COUNT) throw new Error(`source roster must contain exactly ${FROZEN_SOURCE_COUNT} strings`);
  if (new Set(sources).size !== sources.length || sources.some((source) => typeof source !== "string" || source.length === 0)) {
    throw new Error("source roster contains duplicates, empty values, or non-strings");
  }
  const digest = sha256(JSON.stringify(sources));
  if (digest !== FROZEN_SOURCE_SHA256 || evidence.sourceFreeze.sourceKeysSha256 !== FROZEN_SOURCE_SHA256) {
    throw new Error(`source roster digest mismatch: ${digest}`);
  }
  return sources;
}

export function renderPrompt(template, localeEntry, source) {
  const inventory = protectedInventory(source);
  const protectedTokens = inventory.tokens;
  return {
    protectedTokens,
    prompt: template
      .replace("{{TARGET_LOCALE}}", localeEntry.locale)
      .replace("{{TARGET_LANGUAGE}}", localeEntry.targetLanguage)
      .replace("{{TARGET_SCRIPT}}", localeEntry.script)
      .replace("{{PROTECTED_TOKENS_JSON}}", JSON.stringify(inventory.tokenCounts))
      .replace("{{SOURCE_JSON}}", JSON.stringify(source)),
  };
}
