import assert from "node:assert/strict";
import test from "node:test";
import {
  EXACT_TOKEN_PATTERN,
  PROTECTED_TERMS,
  assertProtectedIntegrity,
  exactTokenMultiset,
  exactTokensIn,
  hasProtectedOnlySourceDrift,
  hasTrivialLeadingSourceWrapper,
  hasUnprotectedAlphabeticToken,
  hasSubstantialEnglishSourceRetention,
  isSourceEquivalentMachineDraft,
  normalizeForSourceEquivalence,
  protectedLiteralSpans,
  protectedTermCount,
  protectedIntegrityFindings,
  replaceProtectedTerm,
  sourceWordRetention,
  targetScriptRatio,
  tokenMultiset,
} from "../scripts/lib/i18n-protected-integrity.mjs";

const publicKey = "62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj";
const signature = "5".repeat(88);

test("the shared roster contains every protocol, product, character, and evidence term", () => {
  for (const term of [
    "Internal Agency", "INTERNAL AGENCY", "STAR ASCENT", "$IAT", "$SOL", "IAT", "SOLANA", "Solana",
    "Model T", "Genesis", "GENESIS", "Token-2022", "TOKEN-2022", "Switchboard On-Demand", "Switchboard", "Trezor",
    "GitHub", "GITHUB", "IA-PET", "IA", "SPL", "APY", "CCC", "CCC-Agent", "RPC", "SBF", "NFT", "DLC",
    "DAO", "JSON", "D1", "PKCE", "OAuth", "SHA-256", "Radiance", "Ellie", "Alia", "AI ECE",
    "PAWS", "Samira Cole", "Jules Carter", "Nora Vale", "Maya Rook", "Arin Moss", "Luca Vale",
    "Eli Mercer", "Theo Park", "Lena Ortiz", "Priya Shaw", "R-01", "E-02", "A-03", "EC-04",
    "UTC", "ISTANBUL", "Devnet", "DEVNET", "CC0", "FDF Guard", "mainnet", "Mainnet",
    "MAINNET", "HOLD", "B3", "V2", "V1", "Privacy Vault", "Nightflight", "NIGHTFLIGHT",
  ]) assert.ok(PROTECTED_TERMS.includes(term), `missing protected term ${term}`);
  assert.equal(new Set(PROTECTED_TERMS).size, PROTECTED_TERMS.length);
});

test("canonical protected-only sources reject filler words and presentation drift", () => {
  for (const [source, translation] of [
    ["R-01", "DI R-01"],
    ["MAINNET", "Mainnet"],
    ["$IAT", "token $IAT"],
    ["24", "about 24"],
  ]) {
    assert.equal(hasProtectedOnlySourceDrift(source, translation), true, `${source} => ${translation}`);
    assert.throws(() => assertProtectedIntegrity(source, translation), /protected-only-source-drift/u);
  }
  for (const source of ["R-01", "MAINNET", "$IAT", "24"]) {
    assert.doesNotThrow(() => assertProtectedIntegrity(source, source));
  }
  assert.equal(hasProtectedOnlySourceDrift("//", "label //"), false, "unbound punctuation is not a protected source");
});

test("locale-specific trivial wrappers do not count as machine translation", () => {
  for (const [source, translation] of [
    ["One vessel.", "Di One vessel."],
    ["CURRENT STATUS", "DI CURRENT STATUS"],
    ["A signal.", "Di A signal."],
  ]) assert.equal(hasTrivialLeadingSourceWrapper(source, translation, ["di"]), true);
  assert.equal(hasTrivialLeadingSourceWrapper("The signal is open.", "Di signal dey open.", ["di"]), false);
  assert.equal(hasTrivialLeadingSourceWrapper("One vessel.", "One ship.", ["di"]), false);
});

test("source-equivalence gating starts at one unprotected alphabetic token", () => {
  for (const source of ["OPEN", "Read", "IAT status", "Open /tokenomics", "24 hours"]) {
    assert.equal(hasUnprotectedAlphabeticToken(source), true, source);
  }
  for (const source of ["IAT", "$IAT", "IA", "MAINNET", "Token-2022", publicKey, "24", "//"] ) {
    assert.equal(hasUnprotectedAlphabeticToken(source), false, source);
  }
});

test("source equivalence rejects cosmetic case, width, punctuation, and invisible-character bypasses", () => {
  for (const [source, translation] of [
    ["STATUS", "Status."],
    ["Open", "ＯＰＥＮ"],
    ["IAT status", "IAT—STATUS"],
    ["Network", "Net\u200Bwork"],
  ]) {
    assert.equal(isSourceEquivalentMachineDraft(source, translation), true, `${source} => ${translation}`);
  }
  assert.equal(isSourceEquivalentMachineDraft("STATUS", "Current state"), false);
  assert.equal(isSourceEquivalentMachineDraft("Open", "Abrir"), false);
  assert.equal(isSourceEquivalentMachineDraft("IAT", "IAT"), false, "protected-only source does not require a draft");
  assert.equal(normalizeForSourceEquivalence("Status..."), "status");
});

test("long mostly-English leakage is detected after protected terms and exact tokens are removed", () => {
  const source = "Internal Agency publishes a complete public record so every operator can verify the current network state.";
  const wrappedLeak = "Internal Agency publishes a complete public record so every operator can verify the current network state. Estado actual.";
  const translated = "Internal Agency publica un registro pÃºblico completo para que cada operador pueda verificar el estado actual de la red.";
  assert.deepEqual(sourceWordRetention(source, wrappedLeak), { sourceWords: 13, retainedWords: 13, ratio: 1 });
  assert.equal(hasSubstantialEnglishSourceRetention(source, wrappedLeak), true);
  assert.equal(hasSubstantialEnglishSourceRetention(source, translated), false);
  assert.equal(hasSubstantialEnglishSourceRetention("Open this page", "Open this page"), false, "short-label equivalence has its own stricter gate");
});

test("target-script ratio ignores protected and exact Latin tokens", () => {
  const ratio = targetScriptRatio("IAT Solana \u72B6\u614B\u3092\u78BA\u8A8D", /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u);
  assert.deepEqual(ratio, { alphabeticLetters: 5, targetLetters: 5, ratio: 1 });
  const wrapped = targetScriptRatio("This remains mostly English \u72B6\u614B", /\p{Script=Han}/u);
  assert.ok(wrapped.ratio < 0.25);
});

test("exact token extraction covers Solana IDs and signatures without slicing SHA-256 hashes", () => {
  const hash = "a".repeat(64);
  const source = `Program ${publicKey}; signature ${signature}; SHA ${hash}`;
  assert.deepEqual(tokenMultiset(source, EXACT_TOKEN_PATTERN), [publicKey, signature, hash].sort((a, b) => a.localeCompare(b, "en")));
  assert.deepEqual(exactTokensIn(hash), [hash]);
  assert.deepEqual(tokenMultiset("O".repeat(44), EXACT_TOKEN_PATTERN), [], "base58 must exclude the ambiguous O glyph");
});

test("unchanged protected literals, numeric units, paths, offsets, and Solana IDs pass", () => {
  const source = `B3 uses ${publicKey} at /tokenomics for $IAT, T−15, 24 hours, and 66.67%.`;
  const translation = `B3 usa ${publicKey} en /tokenomics para $IAT, T−15, 24 horas y 66.67%.`;
  assert.doesNotThrow(() => assertProtectedIntegrity(source, translation));
  assert.deepEqual(exactTokenMultiset(translation), exactTokenMultiset(source));
});

test("introduced or changed numeric, path, currency, offset, hash, and base58 tokens fail", () => {
  const cases = [
    ["Open the dossier.", "Open dossier 347, 15, 2001, 1.", /numeric-token-multiset/u],
    ["02 // VERIFIER", "02 //VERIFIER", /exact-token-multiset/u],
    ["Read /tokenomics.", "Lee /tokenomics..", /exact-token-multiset/u],
    ["Lock $IAT at T+15.", "Bloquea $SOL a T+15.", /exact-token-multiset/u],
    [`Program ${publicKey}.`, `Program ${publicKey.slice(0, -1)}k.`, /exact-token-multiset/u],
    ["No identifier is published.", `Identifier ${publicKey}.`, /exact-token-multiset/u],
  ];
  for (const [source, translation, expectedRule] of cases) {
    assert.throws(() => assertProtectedIntegrity(source, translation), expectedRule);
  }
});

test("protected terms use exact source-bound multiplicity and reject introductions", () => {
  assert.equal(protectedTermCount("IAT and IAT", "IAT"), 2);
  for (const [source, translation] of [
    ["IAT network", "IAT IAT network"],
    ["Network status", "Solana network status"],
  ]) assert.throws(() => assertProtectedIntegrity(source, translation), /protected-term-multiset/u);
  assert.doesNotThrow(() => assertProtectedIntegrity("IAT on Solana", "IAT en Solana"));
});

test("protected literal spans honor boundaries and select the longest overlap", () => {
  assert.deepEqual(protectedLiteralSpans("IAT and FIAT"), [{ start: 0, end: 3, value: "IAT" }]);
  assert.deepEqual(
    protectedLiteralSpans("Use $IAT via /tokenomics at T+15"),
    [
      { start: 4, end: 8, value: "$IAT" },
      { start: 13, end: 24, value: "/tokenomics" },
      { start: 28, end: 32, value: "T+15" },
    ],
  );
});

test("protected terms must remain whole tokens rather than matching glued substrings", () => {
  const source = "Mainnet remains on HOLD. Follow the official signal.";
  assert.throws(
    () => assertProtectedIntegrity(source, "Mainnet remains on HOLDMake una follow di official signal."),
    /protected-term-boundary:HOLD/u,
  );
  assert.deepEqual(
    protectedIntegrityFindings(source, "Mainnet remains on HOLD.")
      .filter(({ rule }) => rule === "protected-term-boundary"),
    [],
  );
  assert.equal(replaceProtectedTerm("XHOLDX HOLD HOLDMake", "HOLD", "__TERM__"), "XHOLDX __TERM__ HOLDMake");
});

test("translated and partial machine placeholders fail closed", () => {
  for (const translation of [
    "CCC राउंड 7 और __IA_सटीक_AAAB__।",
    "unclosed __IA_TERM_AAAB",
    "translated ZXQTERM001QXZ marker",
  ]) {
    assert.throws(
      () => assertProtectedIntegrity("CCC rounds 7 and 8.", translation),
      /unresolved-machine-placeholder/u,
    );
  }
});
