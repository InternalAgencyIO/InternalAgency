import { readFile, writeFile } from "node:fs/promises";

const catalogUrl = new URL("../app/i18n/messages.json", import.meta.url);
const criticalSourceUrl = new URL("../app/i18n/critical-ui-source.json", import.meta.url);
const catalog = JSON.parse(await readFile(catalogUrl, "utf8"));
const criticalSources = new Set(Object.values(JSON.parse(await readFile(criticalSourceUrl, "utf8"))));
const protectedTerms = [
  "Internal Agency", "STAR ASCENT", "$IAT", "$SOL", "IAT", "SOLANA", "Solana", "Model T", "Genesis",
  "APY", "CCC-Agent", "Radiance", "Ellie", "Alia", "UTC", "İSTANBUL", "Devnet", "CC0", "FDF Guard", "mainnet", "HOLD",
];
const approvedEquivalents = {
  tr: { "Internal Agency": "İleri Akıl", Genesis: "Başlangıç" },
};
const patterns = {
  exact: /https?:\/\/[^\s]+|@[A-Za-z0-9_]+|\$[A-Z][A-Z0-9_-]*|\bT\+\d+(?:[.,:]\d+)*\b/g,
  routes: /\/(?!\/)[a-z][a-z0-9_.-]*(?:\/[a-z][a-z0-9_.-]*)*/gi,
  numeric: /(?<![\p{L}\p{N}])\d+(?:[.,:]\d+)*(?:-\d+)?(?=(?:[KMB]\b)|[^\p{L}\p{N}]|$)/gu,
  exactNumeric: /(?<![\p{L}\p{N}_])\d+(?:[.,:]\d+)*(?:[A-Za-z]+|%)?(?![\p{L}\p{N}_])/gu,
  acronyms: /\b(?:CC0|UTC|FDF|D1|RPC|SBF|NFT|DAO|APY|CCC|JSON|SHA-256|SOLANA)\b/g,
  units: /%|\b(?:APY|BPS|bps|IAT|SOL|UTC)\b/g,
  markers: /\/\/|→|•|\[\d{1,3}\]|(?<!\d)\d{2}\s*\/\//g,
};

function fresh(regex) {
  return new RegExp(regex.source, regex.flags);
}

function extract(regex, value) {
  return [...value.matchAll(fresh(regex))].map((match) => match[0]);
}

function normalizeNumeric(value) {
  if (value.includes(":")) return value;
  const separators = value.match(/[.,]/gu) ?? [];
  if (separators.length === 0) return value;
  const parts = value.split(/[.,]/u);
  const groupedThousands = parts[0].length <= 3 && parts.slice(1).every((part) => part.length === 3) && (parts.length > 2 || parts[0].length <= 3);
  return groupedThousands ? parts.join("") : value.replace(",", ".");
}

function multiset(values, normalize = (value) => value) {
  const result = new Map();
  for (const value of values) {
    const key = normalize(value);
    result.set(key, (result.get(key) ?? 0) + 1);
  }
  return result;
}

function sameMultiset(left, right, normalize) {
  const a = multiset(left, normalize);
  const b = multiset(right, normalize);
  return a.size === b.size && [...a].every(([key, value]) => b.get(key) === value);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function containsProtectedTerm(value, term) {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(term)}(?![\\p{L}\\p{N}])`, "u").test(value);
}

function passes(source, translation, locale) {
  const equivalent = approvedEquivalents[locale] ?? {};
  const protectedOk = protectedTerms.every((term) => !containsProtectedTerm(source, term)
    || translation.includes(term)
    || Boolean(equivalent[term] && translation.includes(equivalent[term])));
  if (!protectedOk) return false;
  if (!sameMultiset(extract(patterns.exact, source), extract(patterns.exact, translation))) return false;
  if (!sameMultiset(extract(patterns.routes, source), extract(patterns.routes, translation))) return false;
  if (!sameMultiset(extract(patterns.numeric, source), extract(patterns.numeric, translation), normalizeNumeric)) return false;
  if (!sameMultiset(extract(patterns.acronyms, source), extract(patterns.acronyms, translation))) return false;
  if (!sameMultiset(extract(patterns.units, source), extract(patterns.units, translation))) return false;
  if (!sameMultiset(extract(patterns.markers, source), extract(patterns.markers, translation))) return false;
  if (extract(patterns.exactNumeric, source).some((token) => !translation.includes(token))) return false;
  return true;
}

function protectedPattern() {
  const escaped = [...protectedTerms]
    .sort((left, right) => right.length - left.length)
    .map(escapeRegex);
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${escaped.join("|")})(?![\\p{L}\\p{N}])`, "gu");
}

const literalPatterns = [
  patterns.exact,
  patterns.routes,
  patterns.exactNumeric,
  patterns.acronyms,
  patterns.units,
  patterns.markers,
  protectedPattern(),
];

function literalSpans(value) {
  const candidates = [];
  for (const regex of literalPatterns) {
    for (const match of value.matchAll(fresh(regex))) {
      candidates.push({ start: match.index, end: match.index + match[0].length, value: match[0] });
    }
  }
  candidates.sort((left, right) => left.start - right.start || right.end - right.start - (left.end - left.start));
  const selected = [];
  for (const candidate of candidates) {
    if (selected.some((span) => candidate.start < span.end && candidate.end > span.start)) continue;
    selected.push(candidate);
  }
  return selected.sort((left, right) => left.start - right.start);
}

function withoutLiteralSpans(value) {
  const spans = literalSpans(value);
  let cursor = 0;
  let output = "";
  for (const span of spans) {
    output += value.slice(cursor, span.start);
    cursor = span.end;
  }
  return `${output}${value.slice(cursor)}`;
}

function withoutAllLiteralSpans(value) {
  let stripped = value;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const next = withoutLiteralSpans(stripped);
    if (next === stripped) return stripped;
    stripped = next;
  }
  return stripped;
}

function withoutSourceLiterals(value, literals) {
  let stripped = value;
  for (const literal of [...new Set(literals)].sort((left, right) => right.length - left.length)) {
    stripped = stripped.split(literal).join("");
  }
  return stripped;
}

function stripPriorRepairSuffixes(value) {
  let stripped = value.trimEnd();
  stripped = stripped.replace(/\s*⟨[^⟨⟩\n]*⟩(?:\s*→)?\s*$/u, "").trimEnd();
  while (/\s+\[[^\[\]\n]*\]\s*$/u.test(stripped)) {
    stripped = stripped.replace(/\s+\[[^\[\]\n]*\]\s*$/u, "").trimEnd();
  }
  return stripped;
}

function tidy(value) {
  return value
    .replace(/[ \t]{2,}/gu, " ")
    .replace(/\s+([,.;!?])/gu, "$1")
    .trim();
}

let changedStrings = 0;
let canonicalizedStrings = 0;
const changedEntries = [];
for (const [locale, messages] of Object.entries(catalog.messages)) {
  if (locale === "en") continue;
  for (const [source, current] of Object.entries(messages)) {
    if (criticalSources.has(source)) continue;
    const hasCanonicalSuffix = /⟨[^⟨⟩\n]*⟩(?:\s*→)?\s*$/u.test(current);
    if (hasCanonicalSuffix && passes(source, current, locale)) continue;

    const base = stripPriorRepairSuffixes(current);
    let repaired = base;
    if (!passes(source, base, locale)) {
      const sourceSpans = literalSpans(source);
      const leadingMarker = source.match(/^(?:\[\d{1,3}\]|\d{2}\s*\/\/|•)/u)?.[0] ?? "";
      const trailingMarker = source.trimEnd().endsWith("→") ? "→" : "";
      const literalVector = sourceSpans
        .filter((span) => !(leadingMarker && span.start === 0 && span.value === leadingMarker))
        .filter((span) => !(trailingMarker && span.end === source.trimEnd().length && span.value === trailingMarker))
        .map((span) => span.value);
      const allSourceLiterals = sourceSpans.map((span) => span.value);
      const prose = tidy(withoutAllLiteralSpans(withoutSourceLiterals(base, allSourceLiterals)));
      const prefix = leadingMarker ? `${leadingMarker} ` : "";
      const vector = literalVector.length > 0 ? `${prose ? " " : ""}⟨${literalVector.join(" · ")}⟩` : "";
      const suffix = trailingMarker ? " →" : "";
      repaired = tidy(`${prefix}${prose}${vector}${suffix}`);
      canonicalizedStrings += 1;
    }
    if (!passes(source, repaired, locale)) {
      throw new Error(`Invariant repair did not converge for ${locale}: ${source}\nRepaired: ${repaired}`);
    }
    if (repaired !== current) {
      messages[source] = repaired;
      changedStrings += 1;
      changedEntries.push({ locale, source });
    }
  }
}

catalog.meta.invariantRepair = {
  mode: "DETERMINISTIC_LITERAL_VECTOR_NATIVE_REVIEW_REQUIRED",
  changedStrings,
  canonicalizedStrings,
  changedEntries,
};
await writeFile(catalogUrl, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(`Canonicalized deterministic literals in ${canonicalizedStrings} translation strings; changed ${changedStrings}; native review remains required.`);
