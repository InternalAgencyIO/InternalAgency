const protectedTermSource = [
  "Internal Agency", "INTERNAL AGENCY", "STAR ASCENT", "$IAT", "$SOL", "IAT", "SOLANA", "Solana",
  "Model T", "Genesis", "GENESIS", "Token-2022", "TOKEN-2022", "Switchboard On-Demand", "Switchboard", "Trezor",
  "GitHub", "GITHUB", "IA-PET", "IA", "SPL", "APY", "CCC", "CCC-Agent", "RPC", "SBF", "NFT", "DLC",
  "DAO", "JSON", "D1", "PKCE", "OAuth", "SHA-256",
  "Radiance", "Ellie", "Alia", "AI ECE", "PAWS",
  "Samira Cole", "Jules Carter", "Nora Vale", "Maya Rook", "Arin Moss", "Luca Vale",
  "Eli Mercer", "Theo Park", "Lena Ortiz", "Priya Shaw",
  "R-01", "E-02", "A-03", "EC-04",
  "UTC", "ISTANBUL", "Devnet", "CC0", "FDF Guard",
  "mainnet", "Mainnet", "MAINNET", "DEVNET", "HOLD", "B3", "V2", "V1", "Privacy Vault",
  "Nightflight", "NIGHTFLIGHT",
];

export const PROTECTED_TERMS = Object.freeze(
  [...protectedTermSource].sort((left, right) => right.length - left.length || left.localeCompare(right, "en")),
);

// Order matters: a complete URL or SHA-256 digest must win before a base58-like
// substring within it. Solana public keys are normally 32-44 base58 characters;
// transaction signatures extend to 87-88, so the source-bound range is 32-88.
export const EXACT_TOKEN_PATTERN = /[Hh][Tt][Tt][Pp][Ss]?:\/\/[^\s]+|@[A-Za-z0-9_]+|\$[A-Z][A-Z0-9_-]*|\b[0-9A-Fa-f]{64}\b|(?<![1-9A-HJ-NP-Za-km-z])[1-9A-HJ-NP-Za-km-z]{32,88}(?![1-9A-HJ-NP-Za-km-z])|\/[A-Za-z][A-Za-z0-9_.-]*(?:\/[A-Za-z][A-Za-z0-9_.-]*)*|\bT[+\u2212-]\d+(?:[.,:]\d+)*\b/gu;
export const NUMERIC_TOKEN_PATTERN = /(?<![\p{L}\p{N}_])\d+(?:[.,:]\d+)*(?:[A-Za-z]+|%)?(?![\p{L}\p{N}_])/gu;
export const UNRESOLVED_MACHINE_PLACEHOLDER_PATTERN = /(?:ZXQTERM|__IA_)/iu;

export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

const protectedTermPatterns = new Map();
function protectedTermPattern(term, global = false) {
  const key = `${global ? "global" : "single"}:${term}`;
  if (!protectedTermPatterns.has(key)) {
    protectedTermPatterns.set(key, new RegExp(
      `(?<![\\p{L}\\p{N}])${escapeRegex(term)}(?![\\p{L}\\p{N}])`,
      global ? "gu" : "u",
    ));
  }
  return protectedTermPatterns.get(key);
}

export function containsProtectedTerm(value, term) {
  return protectedTermPattern(term).test(value);
}

export function replaceProtectedTerm(value, term, replacement = " ") {
  return value.replace(protectedTermPattern(term, true), replacement);
}

export function protectedTermCount(value, term) {
  return [...value.matchAll(protectedTermPattern(term, true))].length;
}

export function protectedTermsIn(value) {
  return PROTECTED_TERMS.filter((term) => containsProtectedTerm(value, term));
}

export function tokenMultiset(value, pattern) {
  return [...(value.match(pattern) ?? [])].sort((left, right) => left.localeCompare(right, "en"));
}

export function exactTokenMultiset(value) {
  return [
    ...tokenMultiset(value, EXACT_TOKEN_PATTERN),
    ...tokenMultiset(value, NUMERIC_TOKEN_PATTERN),
  ].sort((left, right) => left.localeCompare(right, "en"));
}

export function exactTokensIn(value) {
  return [...new Set([
    ...(value.match(EXACT_TOKEN_PATTERN) ?? []),
    ...(value.match(NUMERIC_TOKEN_PATTERN) ?? []),
  ])].sort((left, right) => right.length - left.length || left.localeCompare(right, "en"));
}

// One boundary-aware span inventory is shared by masking and segmented repair.
// Longest-at-position selection prevents nested literals such as `IAT` inside
// `$IAT` or `Switchboard` inside `Switchboard On-Demand` from being split.
export function protectedLiteralSpans(value) {
  const candidates = [];
  for (const pattern of [EXACT_TOKEN_PATTERN, NUMERIC_TOKEN_PATTERN]) {
    for (const match of value.matchAll(pattern)) {
      candidates.push({ start: match.index, end: match.index + match[0].length, value: match[0] });
    }
  }
  for (const term of PROTECTED_TERMS) {
    for (const match of value.matchAll(protectedTermPattern(term, true))) {
      candidates.push({ start: match.index, end: match.index + match[0].length, value: match[0] });
    }
  }
  candidates.sort((left, right) => left.start - right.start || right.end - left.end);
  const selected = [];
  for (const candidate of candidates) {
    if (selected.some((span) => candidate.start < span.end && candidate.end > span.start)) continue;
    selected.push(candidate);
  }
  return selected;
}

export function unprotectedText(value) {
  let output = value;
  for (const term of PROTECTED_TERMS) {
    output = replaceProtectedTerm(output, term);
  }
  return output.replace(EXACT_TOKEN_PATTERN, " ").replace(NUMERIC_TOKEN_PATTERN, " ");
}

export function hasUnprotectedAlphabeticToken(value) {
  return /\p{L}+/u.test(unprotectedText(value));
}

function normalizeBoundSource(value) {
  return value.normalize("NFC").replace(/\s+/gu, " ").trim();
}

// Sources made only from protocol terms and exact/numeric identifiers are
// canonical labels, not prose to translate. A machine draft may not decorate
// them with filler words (for example, `DI R-01`) or alter their presentation.
export function hasProtectedOnlySourceDrift(source, translation) {
  const hasBoundToken = protectedTermsIn(source).length > 0 || exactTokenMultiset(source).length > 0;
  return hasBoundToken
    && !hasUnprotectedAlphabeticToken(source)
    && normalizeBoundSource(source) !== normalizeBoundSource(translation);
}

// A machine draft must contain more than a case, width, whitespace, control,
// punctuation, or symbol-only mutation of the English source. Exact token and
// protected-term integrity is checked separately, so comparing the remaining
// letters/numbers catches cosmetic bypasses without weakening those bindings.
export function normalizeForSourceEquivalence(value) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[\p{P}\p{S}\p{Z}\p{C}]+/gu, "");
}

export function isSourceEquivalentMachineDraft(source, translation) {
  return hasUnprotectedAlphabeticToken(source)
    && normalizeForSourceEquivalence(source) === normalizeForSourceEquivalence(translation);
}

// A determiner or other one-word prefix is not a translation. Callers provide
// locale-specific wrapper words so this remains useful without assuming that
// every target language shares Nigerian Pidgin grammar.
export function hasTrivialLeadingSourceWrapper(source, translation, wrappers) {
  if (!Array.isArray(wrappers) || wrappers.length === 0) return false;
  return wrappers.some((wrapper) => {
    const match = translation.match(new RegExp(`^${escapeRegex(wrapper)}\\s+(.+)$`, "iu"));
    return match && normalizeForSourceEquivalence(source) === normalizeForSourceEquivalence(match[1]);
  });
}

function unprotectedAsciiWords(value) {
  return unprotectedText(value)
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .match(/[a-z]{2,}/gu) ?? [];
}

export function sourceWordRetention(source, translation) {
  const sourceWords = unprotectedAsciiWords(source);
  const remaining = new Map();
  for (const word of unprotectedAsciiWords(translation)) {
    remaining.set(word, (remaining.get(word) ?? 0) + 1);
  }
  let retainedWords = 0;
  for (const word of sourceWords) {
    const count = remaining.get(word) ?? 0;
    if (count === 0) continue;
    retainedWords += 1;
    remaining.set(word, count - 1);
  }
  return {
    sourceWords: sourceWords.length,
    retainedWords,
    ratio: retainedWords / Math.max(1, sourceWords.length),
  };
}

export function hasSubstantialEnglishSourceRetention(source, translation, {
  minimumSourceWords = 8,
  minimumRetainedWords = 6,
  minimumRatio = 0.75,
} = {}) {
  const retention = sourceWordRetention(source, translation);
  return retention.sourceWords >= minimumSourceWords
    && retention.retainedWords >= minimumRetainedWords
    && retention.ratio >= minimumRatio;
}

export function targetScriptRatio(translation, targetScript) {
  const letters = Array.from(unprotectedText(translation)).filter((character) => /\p{L}/u.test(character));
  const matcher = new RegExp(targetScript.source, targetScript.flags.replace(/g/gu, ""));
  const targetLetters = letters.reduce((count, character) => count + Number(matcher.test(character)), 0);
  return {
    alphabeticLetters: letters.length,
    targetLetters,
    ratio: targetLetters / Math.max(1, letters.length),
  };
}

export function unresolvedMachinePlaceholder(value) {
  return UNRESOLVED_MACHINE_PLACEHOLDER_PATTERN.test(value);
}

export function protectedIntegrityFindings(source, translation) {
  const findings = [];
  const sourceNumericTokens = tokenMultiset(source, NUMERIC_TOKEN_PATTERN);
  const translationNumericTokens = tokenMultiset(translation, NUMERIC_TOKEN_PATTERN);
  if (JSON.stringify(sourceNumericTokens) !== JSON.stringify(translationNumericTokens)) {
    findings.push({
      rule: "numeric-token-multiset",
      sourceTokens: sourceNumericTokens,
      translationTokens: translationNumericTokens,
    });
  }
  const sourceExactTokens = tokenMultiset(source, EXACT_TOKEN_PATTERN);
  const translationExactTokens = tokenMultiset(translation, EXACT_TOKEN_PATTERN);
  if (JSON.stringify(sourceExactTokens) !== JSON.stringify(translationExactTokens)) {
    findings.push({
      rule: "exact-token-multiset",
      sourceTokens: sourceExactTokens,
      translationTokens: translationExactTokens,
    });
  }
  for (const term of PROTECTED_TERMS) {
    const sourceCount = protectedTermCount(source, term);
    const translationCount = protectedTermCount(translation, term);
    if (sourceCount !== translationCount) {
      findings.push({ rule: "protected-term-multiset", term, sourceCount, translationCount });
      if (sourceCount > 0 && translationCount === 0) findings.push({ rule: "protected-term-boundary", term });
    }
  }
  if (hasProtectedOnlySourceDrift(source, translation)) findings.push({ rule: "protected-only-source-drift" });
  if (unresolvedMachinePlaceholder(translation)) findings.push({ rule: "unresolved-machine-placeholder" });
  return findings;
}

export function assertProtectedIntegrity(source, translation) {
  const findings = protectedIntegrityFindings(source, translation);
  if (findings.length === 0) return;
  const detail = findings.map((finding) => (
    finding.term ? `${finding.rule}:${finding.term}` : finding.rule
  )).join(", ");
  throw new Error(`Machine translation failed protected integrity (${detail}): ${source}`);
}
