/**
 * Bounded duplicate-aware JSON transport parser for proposal evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { createHash } from "node:crypto";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";

export const TRANSPORT_LIMITS = Object.freeze({
  maxUtf8Bytes: 65_536,
  maxDepth: 16,
  maxObjectMembers: 32,
  maxArrayLength: 32,
  maxTotalNodes: 2_048,
});

export const NUMERIC_TOKEN_RULES = Object.freeze({
  representation: "CANONICAL_SAFE_INTEGER",
  canonicalPattern: "0|-?[1-9][0-9]*",
  minimumSafeInteger: "-9007199254740991",
  maximumSafeInteger: "9007199254740991",
  fractionsAllowed: false,
  exponentAllowed: false,
  negativeZeroAllowed: false,
  nonFiniteAllowed: false,
});

export const DELIMITER_WHITESPACE_RULES = Object.freeze({
  allowedWhitespaceCodePoints: ["U+0020", "U+0009", "U+000A", "U+000D"],
  bomAllowed: false,
  unicodeWhitespaceAllowed: false,
  trailingValuesAllowed: false,
  concatenatedDocumentsAllowed: false,
  singleDocumentOnly: true,
});

export const STRING_TOKEN_RULES = Object.freeze({
  requiredEnvelopeKeys: ["candidate", "transportMarker"],
  keyComparison: "EXACT_DECODED_UNICODE_SCALAR_SEQUENCE",
  rawControlCodePointsAllowedInStrings: false,
  escapedControlCodePointsAllowedInRequiredKeys: false,
  escapedCanonicalKeySpellingsAllowed: true,
  unicodeNormalizationAppliedToRequiredKeys: false,
  unicodeCompatibilityLookalikesAllowed: false,
});

export const KEY_COLLISION_RULES = Object.freeze({
  duplicateComparison: "EXACT_DECODED_UNICODE_SCALAR_SEQUENCE",
  escapedCanonicalSpellingsCollide: true,
  unicodeNormalizationAppliedBeforeDuplicateCheck: false,
  normalizationLookalikesRemainDistinct: true,
  distinctUnexpectedKeysRejected: true,
});

export const TRANSPORT_MARKER_VALUE_RULES = Object.freeze({
  canonicalValue: "DRAFT/INACTIVE",
  comparison: "EXACT_DECODED_UNICODE_SCALAR_SEQUENCE",
  escapedCanonicalValueSpellingsAllowed: true,
  rawControlCodePointsAllowed: false,
  escapedControlCodePointsAllowed: false,
  caseFoldApplied: false,
  unicodeNormalizationApplied: false,
  confusableMappingApplied: false,
});

const NORMALIZATION_KEY_DEFINITIONS = Object.freeze([
  ["FULLWIDTH_C_PREFIX", "ｃandidate", "candidate"],
  ["FULLWIDTH_CANDIDATE", "ｃａｎｄｉｄａｔｅ", "candidate"],
  ["CIRCLED_C_PREFIX", "ⓒandidate", "candidate"],
  ["MATHEMATICAL_BOLD_C_PREFIX", "𝐜andidate", "candidate"],
  ["FULLWIDTH_T_PREFIX", "ｔransportMarker", "transportMarker"],
  ["FULLWIDTH_CAPITAL_M", "transportＭarker", "transportMarker"],
]);

const TRANSPORT_MARKER = "DRAFT/INACTIVE";
const sha256Hex = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const fail = (code) => { throw new Error(code); };

function assertUnicodeScalars(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) fail("UNPAIRED_UNICODE_SURROGATE");
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      fail("UNPAIRED_UNICODE_SURROGATE");
    }
  }
}

export function parseBoundedJson(serialized, limits = TRANSPORT_LIMITS) {
  if (typeof serialized !== "string") fail("MALFORMED_JSON");
  const utf8Bytes = Buffer.byteLength(serialized, "utf8");
  if (utf8Bytes > limits.maxUtf8Bytes) fail("TRANSPORT_BYTE_LIMIT");
  let index = 0;
  let totalNodes = 0;
  let maxDepthObserved = 0;
  let maxObjectMembersObserved = 0;
  let maxArrayLengthObserved = 0;

  const skipWhitespace = () => {
    while (index < serialized.length && /[\x20\t\r\n]/.test(serialized[index])) index += 1;
  };

  const parseString = () => {
    if (serialized[index] !== '"') fail("MALFORMED_JSON");
    const start = index;
    index += 1;
    while (index < serialized.length) {
      const code = serialized.charCodeAt(index);
      if (serialized[index] === '"') {
        index += 1;
        let decoded;
        try {
          decoded = JSON.parse(serialized.slice(start, index));
        } catch {
          fail("MALFORMED_JSON");
        }
        assertUnicodeScalars(decoded);
        return decoded;
      }
      if (code < 0x20) fail("MALFORMED_JSON");
      if (serialized[index] === "\\") {
        index += 1;
        if (index >= serialized.length) fail("MALFORMED_JSON");
      }
      index += 1;
    }
    fail("MALFORMED_JSON");
  };

  const countNode = (depth) => {
    if (depth > limits.maxDepth) fail("TRANSPORT_DEPTH_LIMIT");
    totalNodes += 1;
    if (totalNodes > limits.maxTotalNodes) fail("TRANSPORT_NODE_LIMIT");
    maxDepthObserved = Math.max(maxDepthObserved, depth);
  };

  const parseValue = (depth) => {
    skipWhitespace();
    countNode(depth);
    const current = serialized[index];
    if (current === '"') return parseString();
    if (current === "{") {
      index += 1;
      skipWhitespace();
      const keys = new Set();
      const entries = [];
      if (serialized[index] === "}") {
        index += 1;
        return Object.fromEntries(entries);
      }
      while (index < serialized.length) {
        skipWhitespace();
        const key = parseString();
        if (keys.has(key)) fail("DUPLICATE_JSON_KEY");
        keys.add(key);
        if (keys.size > limits.maxObjectMembers) fail("TRANSPORT_OBJECT_MEMBER_LIMIT");
        maxObjectMembersObserved = Math.max(maxObjectMembersObserved, keys.size);
        skipWhitespace();
        if (serialized[index] !== ":") fail("MALFORMED_JSON");
        index += 1;
        entries.push([key, parseValue(depth + 1)]);
        skipWhitespace();
        if (serialized[index] === "}") {
          index += 1;
          return Object.fromEntries(entries);
        }
        if (serialized[index] !== ",") fail("MALFORMED_JSON");
        index += 1;
      }
      fail("MALFORMED_JSON");
    }
    if (current === "[") {
      index += 1;
      skipWhitespace();
      const values = [];
      if (serialized[index] === "]") {
        index += 1;
        return values;
      }
      while (index < serialized.length) {
        values.push(parseValue(depth + 1));
        if (values.length > limits.maxArrayLength) fail("TRANSPORT_ARRAY_LENGTH_LIMIT");
        maxArrayLengthObserved = Math.max(maxArrayLengthObserved, values.length);
        skipWhitespace();
        if (serialized[index] === "]") {
          index += 1;
          return values;
        }
        if (serialized[index] !== ",") fail("MALFORMED_JSON");
        index += 1;
      }
      fail("MALFORMED_JSON");
    }
    for (const [literal, value] of [["true", true], ["false", false], ["null", null]]) {
      if (serialized.startsWith(literal, index)) {
        index += literal.length;
        return value;
      }
    }
    const numberMatch = serialized.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (numberMatch) {
      const token = numberMatch[0];
      index += token.length;
      const value = Number(token);
      if (!Number.isFinite(value)) fail("NONFINITE_JSON_NUMBER");
      if (value === 0 && token.startsWith("-")) fail("NEGATIVE_ZERO_JSON_NUMBER");
      if (!/^(?:0|-?[1-9]\d*)$/.test(token)) fail("NONCANONICAL_JSON_NUMBER");
      if (!Number.isSafeInteger(value)) fail("UNSAFE_JSON_INTEGER");
      return value;
    }
    fail("MALFORMED_JSON");
  };

  const value = parseValue(1);
  skipWhitespace();
  if (index !== serialized.length) fail("MALFORMED_JSON");
  return {
    value,
    metrics: {
      utf8Bytes,
      totalNodes,
      maxDepthObserved,
      maxObjectMembersObserved,
      maxArrayLengthObserved,
    },
  };
}

export function parseBoundedTransportEnvelope(serialized) {
  const parsed = parseBoundedJson(serialized);
  const envelope = parsed.value;
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope) ||
      JSON.stringify(Object.keys(envelope).sort()) !== JSON.stringify(["candidate", "transportMarker"])) {
    fail("INVALID_TRANSPORT_ENVELOPE");
  }
  if (envelope.transportMarker !== TRANSPORT_MARKER || !envelope.candidate ||
      typeof envelope.candidate !== "object" || Array.isArray(envelope.candidate)) {
    fail("INVALID_TRANSPORT_ENVELOPE");
  }
  return { candidate: envelope.candidate, metrics: parsed.metrics };
}

function replaceRequired(value, search, replacement, caseId) {
  if (!value.includes(search)) fail(`TRANSPORT_CORPUS_BUILD_FAILED:${caseId}`);
  return value.replace(search, replacement);
}

function nestedArray(depth) {
  let value = 0;
  for (let index = 0; index < depth; index += 1) value = [value];
  return value;
}

function nodeLimitTree() {
  return Object.fromEntries(Array.from({ length: 32 }, (_, objectIndex) => [
    `p${objectIndex}`,
    Array.from({ length: 32 }, () => [0, 0]),
  ]));
}

export function buildTransportLimitCorpus(baseArtifact) {
  const baseLf = `${JSON.stringify({ transportMarker: TRANSPORT_MARKER, candidate: baseArtifact }, null, 2)}\n`;
  const exactPadding = TRANSPORT_LIMITS.maxUtf8Bytes - Buffer.byteLength(baseLf, "utf8");
  if (exactPadding < 0) fail("BASELINE_EXCEEDS_TRANSPORT_LIMIT");
  const controls = [
    { caseId: "BASELINE_WITHIN_LIMITS", serialized: baseLf },
    { caseId: "BYTE_LIMIT_EXACT", serialized: `${baseLf}${" ".repeat(exactPadding)}` },
  ];
  const duplicateTop = replaceRequired(
    baseLf,
    '"transportMarker": "DRAFT/INACTIVE",',
    '"transportMarker": "DRAFT/INACTIVE",\n  "transportMarker": "DRAFT/INACTIVE",',
    "DUPLICATE_TOP_LEVEL_KEY",
  );
  const duplicateCandidate = replaceRequired(
    baseLf,
    '"vectorVersion": 1,',
    '"vectorVersion": 1,\n    "vectorVersion": 1,',
    "DUPLICATE_CANDIDATE_KEY",
  );
  const duplicateDeep = replaceRequired(
    baseLf,
    '"caseId": "STRUCTURE__STATUS",',
    '"caseId": "STRUCTURE__STATUS",\n        "caseId": "STRUCTURE__STATUS",',
    "DUPLICATE_DEEP_KEY",
  );
  const compactEnvelope = (candidate) => JSON.stringify({ transportMarker: TRANSPORT_MARKER, candidate });
  const rejections = [
    { caseId: "DUPLICATE_TOP_LEVEL_KEY", family: "DUPLICATE_KEY", serialized: duplicateTop, expectedError: "DUPLICATE_JSON_KEY" },
    { caseId: "DUPLICATE_CANDIDATE_KEY", family: "DUPLICATE_KEY", serialized: duplicateCandidate, expectedError: "DUPLICATE_JSON_KEY" },
    { caseId: "DUPLICATE_DEEP_KEY", family: "DUPLICATE_KEY", serialized: duplicateDeep, expectedError: "DUPLICATE_JSON_KEY" },
    { caseId: "BYTE_LIMIT_PLUS_ONE", family: "BYTE_LIMIT", serialized: `${baseLf}${" ".repeat(exactPadding + 1)}`, expectedError: "TRANSPORT_BYTE_LIMIT" },
    { caseId: "DEPTH_LIMIT_PLUS_ONE", family: "DEPTH_LIMIT", serialized: compactEnvelope(nestedArray(15)), expectedError: "TRANSPORT_DEPTH_LIMIT" },
    { caseId: "OBJECT_MEMBER_LIMIT_PLUS_ONE", family: "OBJECT_MEMBER_LIMIT", serialized: compactEnvelope(Object.fromEntries(Array.from({ length: 33 }, (_, index) => [`p${index}`, index]))), expectedError: "TRANSPORT_OBJECT_MEMBER_LIMIT" },
    { caseId: "ARRAY_LENGTH_LIMIT_PLUS_ONE", family: "ARRAY_LENGTH_LIMIT", serialized: compactEnvelope(Array.from({ length: 33 }, (_, index) => index)), expectedError: "TRANSPORT_ARRAY_LENGTH_LIMIT" },
    { caseId: "TOTAL_NODE_LIMIT_PLUS_ONE", family: "NODE_LIMIT", serialized: compactEnvelope(nodeLimitTree()), expectedError: "TRANSPORT_NODE_LIMIT" },
  ];
  return { controls, rejections };
}

export function evaluateTransportLimitCorpus(baseArtifact) {
  const corpus = buildTransportLimitCorpus(baseArtifact);
  const controls = corpus.controls.map(({ caseId, serialized }) => {
    const parsed = parseBoundedTransportEnvelope(serialized);
    const candidateCommitmentSha256 = canonicalSha256(parsed.candidate);
    if (candidateCommitmentSha256 !== canonicalSha256(baseArtifact)) fail(`TRANSPORT_CONTROL_DRIFT:${caseId}`);
    return {
      caseId,
      representationSha256: sha256Hex(serialized),
      metrics: parsed.metrics,
      candidateCommitmentSha256,
      acceptedAtParser: true,
      candidateStored: false,
      mutationEvaluated: false,
    };
  });
  const rejections = corpus.rejections.map(({ caseId, family, serialized, expectedError }) => {
    let observedError = null;
    try {
      parseBoundedTransportEnvelope(serialized);
    } catch (error) {
      observedError = error instanceof Error ? error.message : String(error);
    }
    if (observedError !== expectedError) fail(`TRANSPORT_REJECTION_DRIFT:${caseId}:${observedError}`);
    return {
      caseId,
      family,
      representationSha256: sha256Hex(serialized),
      utf8Bytes: Buffer.byteLength(serialized, "utf8"),
      expectedError,
      observedError,
      rejectedBeforeMutation: true,
      candidateProduced: false,
    };
  });
  return { controls, rejections };
}

function numericEnvelope(token) {
  return `{"transportMarker":"${TRANSPORT_MARKER}","candidate":{"numericProbe":${token}}}`;
}

function numericFieldMutation(baseLf, token, caseId) {
  return replaceRequired(baseLf, '"vectorVersion": 1,', `"vectorVersion": ${token},`, caseId);
}

export function buildNumericTokenCorpus(baseArtifact) {
  const baseLf = `${JSON.stringify({ transportMarker: TRANSPORT_MARKER, candidate: baseArtifact }, null, 2)}\n`;
  const controls = [
    {
      caseId: "BASELINE_CANONICAL_FIELDS",
      family: "CANONICAL_FIELD_SET",
      tokens: ["1", "28", "2"],
      serialized: baseLf,
      expectedCandidate: baseArtifact,
    },
    {
      caseId: "ZERO_CANONICAL",
      family: "SAFE_INTEGER_BOUNDARY",
      tokens: ["0"],
      serialized: numericEnvelope("0"),
      expectedCandidate: { numericProbe: 0 },
    },
    {
      caseId: "MAX_SAFE_INTEGER_CANONICAL",
      family: "SAFE_INTEGER_BOUNDARY",
      tokens: [NUMERIC_TOKEN_RULES.maximumSafeInteger],
      serialized: numericEnvelope(NUMERIC_TOKEN_RULES.maximumSafeInteger),
      expectedCandidate: { numericProbe: Number.MAX_SAFE_INTEGER },
    },
    {
      caseId: "MIN_SAFE_INTEGER_CANONICAL",
      family: "SAFE_INTEGER_BOUNDARY",
      tokens: [NUMERIC_TOKEN_RULES.minimumSafeInteger],
      serialized: numericEnvelope(NUMERIC_TOKEN_RULES.minimumSafeInteger),
      expectedCandidate: { numericProbe: Number.MIN_SAFE_INTEGER },
    },
  ];
  const definitions = [
    ["VECTOR_VERSION_DECIMAL_EQUIVALENT", "EQUIVALENT_NONCANONICAL", "1.0", "NONCANONICAL_JSON_NUMBER"],
    ["VECTOR_VERSION_EXPONENT_LOWER", "EQUIVALENT_NONCANONICAL", "1e0", "NONCANONICAL_JSON_NUMBER"],
    ["VECTOR_VERSION_EXPONENT_UPPER_PLUS", "EQUIVALENT_NONCANONICAL", "1E+0", "NONCANONICAL_JSON_NUMBER"],
    ["NEGATIVE_ZERO_INTEGER", "NEGATIVE_ZERO", "-0", "NEGATIVE_ZERO_JSON_NUMBER"],
    ["NEGATIVE_ZERO_DECIMAL", "NEGATIVE_ZERO", "-0.0", "NEGATIVE_ZERO_JSON_NUMBER"],
    ["NEGATIVE_ZERO_EXPONENT", "NEGATIVE_ZERO", "-0e0", "NEGATIVE_ZERO_JSON_NUMBER"],
    ["POSITIVE_SAFE_INTEGER_PLUS_ONE", "UNSAFE_INTEGER", "9007199254740992", "UNSAFE_JSON_INTEGER"],
    ["NEGATIVE_SAFE_INTEGER_MINUS_ONE", "UNSAFE_INTEGER", "-9007199254740992", "UNSAFE_JSON_INTEGER"],
    ["PRECISION_COLLISION_INTEGER", "UNSAFE_INTEGER", "9007199254740993", "UNSAFE_JSON_INTEGER"],
    ["POSITIVE_EXPONENT_OVERFLOW", "NONFINITE_EQUIVALENT", "1e309", "NONFINITE_JSON_NUMBER"],
    ["NEGATIVE_EXPONENT_OVERFLOW", "NONFINITE_EQUIVALENT", "-1e309", "NONFINITE_JSON_NUMBER"],
    ["NAN_CONSTANT", "NON_JSON_NUMBER", "NaN", "MALFORMED_JSON"],
    ["POSITIVE_INFINITY_CONSTANT", "NON_JSON_NUMBER", "Infinity", "MALFORMED_JSON"],
    ["NEGATIVE_INFINITY_CONSTANT", "NON_JSON_NUMBER", "-Infinity", "MALFORMED_JSON"],
    ["LEADING_PLUS_INTEGER", "NON_JSON_NUMBER", "+1", "MALFORMED_JSON"],
    ["LEADING_ZERO_INTEGER", "NON_JSON_NUMBER", "01", "MALFORMED_JSON"],
  ];
  const rejections = definitions.map(([caseId, family, token, expectedError]) => ({
    caseId,
    family,
    token,
    targetPath: "/candidate/vectorVersion",
    serialized: numericFieldMutation(baseLf, token, caseId),
    expectedError,
  }));
  return { controls, rejections };
}

export function evaluateNumericTokenCorpus(baseArtifact) {
  const corpus = buildNumericTokenCorpus(baseArtifact);
  const controls = corpus.controls.map(({ caseId, family, tokens, serialized, expectedCandidate }) => {
    const parsed = parseBoundedTransportEnvelope(serialized);
    if (canonicalSha256(parsed.candidate) !== canonicalSha256(expectedCandidate)) {
      fail(`NUMERIC_CONTROL_DRIFT:${caseId}`);
    }
    return {
      caseId,
      family,
      tokens,
      representationSha256: sha256Hex(serialized),
      utf8Bytes: Buffer.byteLength(serialized, "utf8"),
      candidateCommitmentSha256: canonicalSha256(parsed.candidate),
      acceptedAtParser: true,
      candidateStored: false,
      mutationEvaluated: false,
    };
  });
  const rejections = corpus.rejections.map(({ caseId, family, token, targetPath, serialized, expectedError }) => {
    let observedError = null;
    try {
      parseBoundedTransportEnvelope(serialized);
    } catch (error) {
      observedError = error instanceof Error ? error.message : String(error);
    }
    if (observedError !== expectedError) fail(`NUMERIC_REJECTION_DRIFT:${caseId}:${observedError}`);
    return {
      caseId,
      family,
      token,
      targetPath,
      representationSha256: sha256Hex(serialized),
      utf8Bytes: Buffer.byteLength(serialized, "utf8"),
      expectedError,
      observedError,
      rejectedBeforeCandidate: true,
      candidateProduced: false,
      mutationEvaluated: false,
    };
  });
  return { controls, rejections };
}

function standardWhitespaceProbe() {
  return ' \n\t{ \r\n"transportMarker"\t:\t"DRAFT/INACTIVE"\r,\n"candidate"\t:\t{\n"whitespaceProbe"\r:\n0\t}\n}\r\n';
}

function placeCharacter(serialized, character, placement, caseId) {
  if (placement === "PREFIX") return `${character}${serialized}`;
  if (placement === "SUFFIX") return `${serialized}${character}`;
  if (placement === "AFTER_FIRST_COLON") return replaceRequired(serialized, ':"DRAFT/INACTIVE"', `:${character}"DRAFT/INACTIVE"`, caseId);
  if (placement === "AFTER_FIRST_COMMA") return replaceRequired(serialized, ',"candidate"', `,${character}"candidate"`, caseId);
  if (placement === "BEFORE_FINAL_BRACE") return `${serialized.slice(0, -1)}${character}}`;
  fail(`DELIMITER_CORPUS_BUILD_FAILED:${caseId}`);
}

export function buildDelimiterWhitespaceCorpus(baseArtifact) {
  const baseLf = `${JSON.stringify({ transportMarker: TRANSPORT_MARKER, candidate: baseArtifact }, null, 2)}\n`;
  const baseCompact = JSON.stringify({ transportMarker: TRANSPORT_MARKER, candidate: baseArtifact });
  const baseCrlf = baseLf.replace(/\n/g, "\r\n");
  const compactProbe = numericEnvelope("0");
  const controls = [
    { caseId: "BASELINE_PRETTY_LF", representation: "PRETTY_LF", serialized: baseLf, expectedCandidate: baseArtifact },
    { caseId: "COMPACT_SINGLE_DOCUMENT", representation: "COMPACT", serialized: baseCompact, expectedCandidate: baseArtifact },
    { caseId: "BASELINE_PRETTY_CRLF", representation: "PRETTY_CRLF", serialized: baseCrlf, expectedCandidate: baseArtifact },
    { caseId: "STANDARD_WHITESPACE_MIX", representation: "SPACE_TAB_LF_CR", serialized: standardWhitespaceProbe(), expectedCandidate: { whitespaceProbe: 0 } },
  ];
  const definitions = [
    ["BOM_PREFIX", "BOM", "U+FEFF_PREFIX", "\uFEFF", "PREFIX"],
    ["BOM_SUFFIX", "BOM", "U+FEFF_SUFFIX", "\uFEFF", "SUFFIX"],
    ["BOM_AFTER_COLON", "BOM", "U+FEFF_AFTER_FIRST_COLON", "\uFEFF", "AFTER_FIRST_COLON"],
    ["NBSP_PREFIX", "UNICODE_WHITESPACE", "U+00A0_PREFIX", "\u00A0", "PREFIX"],
    ["OGHAM_SUFFIX", "UNICODE_WHITESPACE", "U+1680_SUFFIX", "\u1680", "SUFFIX"],
    ["EN_SPACE_AFTER_COLON", "UNICODE_WHITESPACE", "U+2002_AFTER_FIRST_COLON", "\u2002", "AFTER_FIRST_COLON"],
    ["LINE_SEPARATOR_AFTER_COMMA", "UNICODE_WHITESPACE", "U+2028_AFTER_FIRST_COMMA", "\u2028", "AFTER_FIRST_COMMA"],
    ["PARAGRAPH_SEPARATOR_PREFIX", "UNICODE_WHITESPACE", "U+2029_PREFIX", "\u2029", "PREFIX"],
    ["NARROW_NBSP_BEFORE_CLOSE", "UNICODE_WHITESPACE", "U+202F_BEFORE_FINAL_BRACE", "\u202F", "BEFORE_FINAL_BRACE"],
    ["IDEOGRAPHIC_SPACE_AFTER_COLON", "UNICODE_WHITESPACE", "U+3000_AFTER_FIRST_COLON", "\u3000", "AFTER_FIRST_COLON"],
  ];
  const characterRejections = definitions.map(([caseId, family, descriptor, character, placement]) => ({
    caseId,
    family,
    descriptor,
    serialized: placeCharacter(baseCompact, character, placement, caseId),
    expectedError: "MALFORMED_JSON",
  }));
  const rejections = [
    ...characterRejections,
    { caseId: "TRAILING_SCALAR", family: "TRAILING_VALUE", descriptor: "TRAILING_TRUE", serialized: `${baseCompact} true`, expectedError: "MALFORMED_JSON" },
    { caseId: "TRAILING_OBJECT", family: "TRAILING_VALUE", descriptor: "TRAILING_EMPTY_OBJECT", serialized: `${baseCompact} {}`, expectedError: "MALFORMED_JSON" },
    { caseId: "TRAILING_ARRAY", family: "TRAILING_VALUE", descriptor: "TRAILING_EMPTY_ARRAY", serialized: `${baseCompact} []`, expectedError: "MALFORMED_JSON" },
    { caseId: "CONCATENATED_COMPACT", family: "CONCATENATED_DOCUMENT", descriptor: "COMPACT_NO_SEPARATOR", serialized: `${compactProbe}${compactProbe}`, expectedError: "MALFORMED_JSON" },
    { caseId: "CONCATENATED_SPACE", family: "CONCATENATED_DOCUMENT", descriptor: "COMPACT_SPACE_COMPACT", serialized: `${compactProbe} ${compactProbe}`, expectedError: "MALFORMED_JSON" },
    { caseId: "CONCATENATED_NEWLINE", family: "CONCATENATED_DOCUMENT", descriptor: "COMPACT_LF_COMPACT", serialized: `${compactProbe}\n${compactProbe}`, expectedError: "MALFORMED_JSON" },
  ];
  return { controls, rejections };
}

export function evaluateDelimiterWhitespaceCorpus(baseArtifact) {
  const corpus = buildDelimiterWhitespaceCorpus(baseArtifact);
  const controls = corpus.controls.map(({ caseId, representation, serialized, expectedCandidate }) => {
    const parsed = parseBoundedTransportEnvelope(serialized);
    if (canonicalSha256(parsed.candidate) !== canonicalSha256(expectedCandidate)) {
      fail(`DELIMITER_CONTROL_DRIFT:${caseId}`);
    }
    return {
      caseId,
      representation,
      representationSha256: sha256Hex(serialized),
      utf8Bytes: Buffer.byteLength(serialized, "utf8"),
      candidateCommitmentSha256: canonicalSha256(parsed.candidate),
      acceptedAtParser: true,
      candidateStored: false,
      mutationEvaluated: false,
    };
  });
  const rejections = corpus.rejections.map(({ caseId, family, descriptor, serialized, expectedError }) => {
    let observedError = null;
    try {
      parseBoundedTransportEnvelope(serialized);
    } catch (error) {
      observedError = error instanceof Error ? error.message : String(error);
    }
    if (observedError !== expectedError) fail(`DELIMITER_REJECTION_DRIFT:${caseId}:${observedError}`);
    return {
      caseId,
      family,
      descriptor,
      representationSha256: sha256Hex(serialized),
      utf8Bytes: Buffer.byteLength(serialized, "utf8"),
      expectedError,
      observedError,
      rejectedBeforeCandidate: true,
      candidateProduced: false,
      mutationEvaluated: false,
    };
  });
  return { controls, rejections };
}

function stringProbeEnvelope(candidateKeyToken = '"candidate"', markerKeyToken = '"transportMarker"') {
  return `{${markerKeyToken}:"${TRANSPORT_MARKER}",${candidateKeyToken}:{"stringProbe":0}}`;
}

function stringKeyEnvelope(decodedKey, targetRequiredKey) {
  const markerKey = targetRequiredKey === "transportMarker" ? decodedKey : "transportMarker";
  const candidateKey = targetRequiredKey === "candidate" ? decodedKey : "candidate";
  return JSON.stringify({
    [markerKey]: TRANSPORT_MARKER,
    [candidateKey]: { stringProbe: 0 },
  });
}

export function buildStringTokenCorpus(baseArtifact) {
  const baseCompact = JSON.stringify({ transportMarker: TRANSPORT_MARKER, candidate: baseArtifact });
  const controls = [
    { caseId: "BASELINE_COMPACT", representation: "CANONICAL_LITERAL_KEYS", serialized: baseCompact, expectedCandidate: baseArtifact },
    { caseId: "ESCAPED_CANONICAL_CANDIDATE_KEY", representation: "ESCAPED_ASCII_CANDIDATE_KEY", serialized: stringProbeEnvelope('"\\u0063andidate"'), expectedCandidate: { stringProbe: 0 } },
    { caseId: "ESCAPED_CANONICAL_MARKER_KEY", representation: "ESCAPED_ASCII_MARKER_KEY", serialized: stringProbeEnvelope('"candidate"', '"transport\\u004darker"'), expectedCandidate: { stringProbe: 0 } },
  ];
  const controlDefinitions = [
    ["U+0000", "\u0000"],
    ["U+0008", "\b"],
    ["U+0009", "\t"],
    ["U+000A", "\n"],
    ["U+000C", "\f"],
    ["U+000D", "\r"],
    ["U+001F", "\u001f"],
  ];
  const rawControls = controlDefinitions.map(([descriptor, character]) => ({
    caseId: `RAW_CONTROL_${descriptor.slice(2)}`,
    family: "RAW_CONTROL_IN_STRING",
    descriptor,
    targetRequiredKey: "candidate",
    serialized: stringProbeEnvelope(`"cand${character}idate"`),
    expectedError: "MALFORMED_JSON",
    nfkcMatchesRequiredKey: false,
  }));
  const escapedDefinitions = [
    ["U+0000", "\\u0000"],
    ["U+0008", "\\b"],
    ["U+0009", "\\t"],
    ["U+000A", "\\n"],
    ["U+000C", "\\f"],
    ["U+000D", "\\r"],
    ["U+001F", "\\u001f"],
  ];
  const escapedControls = escapedDefinitions.map(([descriptor, token]) => ({
    caseId: `ESCAPED_CONTROL_${descriptor.slice(2)}`,
    family: "ESCAPED_CONTROL_IN_REQUIRED_KEY",
    descriptor,
    targetRequiredKey: "candidate",
    serialized: stringProbeEnvelope(`"cand${token}idate"`),
    expectedError: "INVALID_TRANSPORT_ENVELOPE",
    nfkcMatchesRequiredKey: false,
  }));
  const normalizationLookalikes = NORMALIZATION_KEY_DEFINITIONS.map(([descriptor, variantKey, targetRequiredKey]) => {
    if (variantKey === targetRequiredKey || variantKey.normalize("NFKC") !== targetRequiredKey) {
      fail(`STRING_NORMALIZATION_CORPUS_BUILD_FAILED:${descriptor}`);
    }
    return {
      caseId: `NORMALIZATION_${descriptor}`,
      family: "UNICODE_NORMALIZATION_LOOKALIKE",
      descriptor,
      targetRequiredKey,
      serialized: stringKeyEnvelope(variantKey, targetRequiredKey),
      expectedError: "INVALID_TRANSPORT_ENVELOPE",
      nfkcMatchesRequiredKey: true,
    };
  });
  return { controls, rejections: [...rawControls, ...escapedControls, ...normalizationLookalikes] };
}

export function evaluateStringTokenCorpus(baseArtifact) {
  const corpus = buildStringTokenCorpus(baseArtifact);
  const controls = corpus.controls.map(({ caseId, representation, serialized, expectedCandidate }) => {
    const parsed = parseBoundedTransportEnvelope(serialized);
    if (canonicalSha256(parsed.candidate) !== canonicalSha256(expectedCandidate)) {
      fail(`STRING_CONTROL_DRIFT:${caseId}`);
    }
    return {
      caseId,
      representation,
      representationSha256: sha256Hex(serialized),
      utf8Bytes: Buffer.byteLength(serialized, "utf8"),
      candidateCommitmentSha256: canonicalSha256(parsed.candidate),
      acceptedAtParser: true,
      candidateStored: false,
      mutationEvaluated: false,
    };
  });
  const rejections = corpus.rejections.map(({ caseId, family, descriptor, targetRequiredKey, serialized, expectedError, nfkcMatchesRequiredKey }) => {
    let observedError = null;
    try {
      parseBoundedTransportEnvelope(serialized);
    } catch (error) {
      observedError = error instanceof Error ? error.message : String(error);
    }
    if (observedError !== expectedError) fail(`STRING_REJECTION_DRIFT:${caseId}:${observedError}`);
    return {
      caseId,
      family,
      descriptor,
      targetRequiredKey,
      representationSha256: sha256Hex(serialized),
      utf8Bytes: Buffer.byteLength(serialized, "utf8"),
      expectedError,
      observedError,
      nfkcMatchesRequiredKey,
      rejectedBeforeCandidate: true,
      candidateProduced: false,
      mutationEvaluated: false,
    };
  });
  return { controls, rejections };
}

function duplicateRequiredKeyEnvelope(targetRequiredKey, firstKeyToken, secondKeyToken) {
  const candidate = '{"collisionProbe":0}';
  if (targetRequiredKey === "candidate") {
    return `{"transportMarker":"${TRANSPORT_MARKER}",${firstKeyToken}:${candidate},${secondKeyToken}:${candidate}}`;
  }
  if (targetRequiredKey === "transportMarker") {
    return `{${firstKeyToken}:"${TRANSPORT_MARKER}",${secondKeyToken}:"${TRANSPORT_MARKER}","candidate":${candidate}}`;
  }
  fail(`KEY_COLLISION_CORPUS_BUILD_FAILED:${targetRequiredKey}`);
}

function normalizationDistinctEnvelope(variantKey, targetRequiredKey) {
  const candidate = { collisionProbe: 0 };
  if (targetRequiredKey === "candidate") {
    return JSON.stringify({ transportMarker: TRANSPORT_MARKER, candidate, [variantKey]: candidate });
  }
  if (targetRequiredKey === "transportMarker") {
    return JSON.stringify({ transportMarker: TRANSPORT_MARKER, [variantKey]: TRANSPORT_MARKER, candidate });
  }
  fail(`KEY_COLLISION_CORPUS_BUILD_FAILED:${targetRequiredKey}`);
}

export function buildKeyCollisionCorpus(baseArtifact) {
  const controls = [
    { caseId: "BASELINE_COMPACT", representation: "CANONICAL_LITERAL_KEYS", serialized: JSON.stringify({ transportMarker: TRANSPORT_MARKER, candidate: baseArtifact }), expectedCandidate: baseArtifact },
    { caseId: "ESCAPED_CANONICAL_CANDIDATE_KEY", representation: "ESCAPED_ASCII_CANDIDATE_KEY", serialized: stringProbeEnvelope('"\\u0063andidate"').replaceAll("stringProbe", "collisionProbe"), expectedCandidate: { collisionProbe: 0 } },
    { caseId: "ESCAPED_CANONICAL_MARKER_KEY", representation: "ESCAPED_ASCII_MARKER_KEY", serialized: stringProbeEnvelope('"candidate"', '"transport\\u004darker"').replaceAll("stringProbe", "collisionProbe"), expectedCandidate: { collisionProbe: 0 } },
  ];
  const duplicateDefinitions = [
    ["CANDIDATE_LITERAL_THEN_ESCAPE", "candidate", '"candidate"', '"\\u0063andidate"'],
    ["CANDIDATE_ESCAPE_THEN_LITERAL", "candidate", '"\\u0063andidate"', '"candidate"'],
    ["CANDIDATE_TWO_ESCAPE_SPELLINGS", "candidate", '"\\u0063andidate"', '"c\\u0061ndidate"'],
    ["MARKER_LITERAL_THEN_ESCAPE", "transportMarker", '"transportMarker"', '"transport\\u004darker"'],
    ["MARKER_ESCAPE_THEN_LITERAL", "transportMarker", '"transport\\u004darker"', '"transportMarker"'],
    ["MARKER_TWO_ESCAPE_SPELLINGS", "transportMarker", '"\\u0074ransportMarker"', '"transport\\u004darker"'],
  ];
  const decodedDuplicates = duplicateDefinitions.map(([descriptor, targetRequiredKey, firstKeyToken, secondKeyToken]) => ({
    caseId: `DUPLICATE_${descriptor}`,
    family: "DECODED_KEY_DUPLICATE",
    descriptor,
    targetRequiredKey,
    serialized: duplicateRequiredKeyEnvelope(targetRequiredKey, firstKeyToken, secondKeyToken),
    expectedError: "DUPLICATE_JSON_KEY",
    decodedKeysCollide: true,
    nfkcMatchesRequiredKey: false,
    distinctDecodedKey: false,
  }));
  const normalizationDistinct = NORMALIZATION_KEY_DEFINITIONS.map(([descriptor, variantKey, targetRequiredKey]) => {
    if (variantKey === targetRequiredKey || variantKey.normalize("NFKC") !== targetRequiredKey) {
      fail(`KEY_COLLISION_NORMALIZATION_CORPUS_BUILD_FAILED:${descriptor}`);
    }
    return {
      caseId: `DISTINCT_${descriptor}`,
      family: "NORMALIZATION_LOOKALIKE_DISTINCT_KEY",
      descriptor,
      targetRequiredKey,
      serialized: normalizationDistinctEnvelope(variantKey, targetRequiredKey),
      expectedError: "INVALID_TRANSPORT_ENVELOPE",
      decodedKeysCollide: false,
      nfkcMatchesRequiredKey: true,
      distinctDecodedKey: true,
    };
  });
  return { controls, rejections: [...decodedDuplicates, ...normalizationDistinct] };
}

export function evaluateKeyCollisionCorpus(baseArtifact) {
  const corpus = buildKeyCollisionCorpus(baseArtifact);
  const controls = corpus.controls.map(({ caseId, representation, serialized, expectedCandidate }) => {
    const parsed = parseBoundedTransportEnvelope(serialized);
    if (canonicalSha256(parsed.candidate) !== canonicalSha256(expectedCandidate)) {
      fail(`KEY_COLLISION_CONTROL_DRIFT:${caseId}`);
    }
    return {
      caseId,
      representation,
      representationSha256: sha256Hex(serialized),
      utf8Bytes: Buffer.byteLength(serialized, "utf8"),
      candidateCommitmentSha256: canonicalSha256(parsed.candidate),
      acceptedAtParser: true,
      candidateStored: false,
      mutationEvaluated: false,
    };
  });
  const rejections = corpus.rejections.map(({ caseId, family, descriptor, targetRequiredKey, serialized, expectedError, decodedKeysCollide, nfkcMatchesRequiredKey, distinctDecodedKey }) => {
    let observedError = null;
    try {
      parseBoundedTransportEnvelope(serialized);
    } catch (error) {
      observedError = error instanceof Error ? error.message : String(error);
    }
    if (observedError !== expectedError) fail(`KEY_COLLISION_REJECTION_DRIFT:${caseId}:${observedError}`);
    return {
      caseId,
      family,
      descriptor,
      targetRequiredKey,
      representationSha256: sha256Hex(serialized),
      utf8Bytes: Buffer.byteLength(serialized, "utf8"),
      expectedError,
      observedError,
      decodedKeysCollide,
      nfkcMatchesRequiredKey,
      distinctDecodedKey,
      rejectedBeforeCandidate: true,
      candidateProduced: false,
      mutationEvaluated: false,
    };
  });
  return { controls, rejections };
}

function markerTokenEnvelope(markerToken) {
  return `{"transportMarker":${markerToken},"candidate":{"markerProbe":0}}`;
}

function markerValueEnvelope(markerValue) {
  return JSON.stringify({ transportMarker: markerValue, candidate: { markerProbe: 0 } });
}

export function buildTransportMarkerValueCorpus(baseArtifact) {
  const controls = [
    { caseId: "BASELINE_COMPACT", representation: "CANONICAL_LITERAL_MARKER", serialized: JSON.stringify({ transportMarker: TRANSPORT_MARKER, candidate: baseArtifact }), expectedCandidate: baseArtifact },
    { caseId: "ESCAPED_CANONICAL_D", representation: "ESCAPED_ASCII_D", serialized: markerTokenEnvelope('"\\u0044RAFT/INACTIVE"'), expectedCandidate: { markerProbe: 0 } },
    { caseId: "ESCAPED_CANONICAL_SOLIDUS", representation: "ESCAPED_SOLIDUS", serialized: markerTokenEnvelope('"DRAFT\\/INACTIVE"'), expectedCandidate: { markerProbe: 0 } },
    { caseId: "FULLY_ESCAPED_CANONICAL", representation: "ESCAPED_ALL_ASCII", serialized: markerTokenEnvelope('"\\u0044\\u0052\\u0041\\u0046\\u0054\\u002f\\u0049\\u004e\\u0041\\u0043\\u0054\\u0049\\u0056\\u0045"'), expectedCandidate: { markerProbe: 0 } },
  ];
  const rawDefinitions = [
    ["U+0000", "\u0000"],
    ["U+000A", "\n"],
    ["U+000D", "\r"],
  ];
  const rawControls = rawDefinitions.map(([descriptor, character]) => ({
    caseId: `RAW_MARKER_CONTROL_${descriptor.slice(2)}`,
    family: "RAW_CONTROL_IN_MARKER_VALUE",
    descriptor,
    serialized: markerTokenEnvelope(`"DRAFT${character}/INACTIVE"`),
    expectedError: "MALFORMED_JSON",
    nfkcMatchesCanonical: false,
    caseInsensitiveMatchesCanonical: false,
    confusableCrossScript: false,
  }));
  const escapedDefinitions = [
    ["U+0000", "\\u0000"],
    ["U+0009", "\\t"],
    ["U+000A", "\\n"],
    ["U+000D", "\\r"],
  ];
  const escapedControls = escapedDefinitions.map(([descriptor, token]) => ({
    caseId: `ESCAPED_MARKER_CONTROL_${descriptor.slice(2)}`,
    family: "ESCAPED_CONTROL_IN_MARKER_VALUE",
    descriptor,
    serialized: markerTokenEnvelope(`"DRAFT${token}/INACTIVE"`),
    expectedError: "INVALID_TRANSPORT_ENVELOPE",
    nfkcMatchesCanonical: false,
    caseInsensitiveMatchesCanonical: false,
    confusableCrossScript: false,
  }));
  const caseDefinitions = [
    ["LOWERCASE_DRAFT", "draft/INACTIVE"],
    ["LOWERCASE_INACTIVE", "DRAFT/inactive"],
    ["TITLE_CASE_BOTH", "Draft/Inactive"],
  ];
  const caseVariants = caseDefinitions.map(([descriptor, markerValue]) => {
    if (markerValue === TRANSPORT_MARKER || markerValue.toLowerCase() !== TRANSPORT_MARKER.toLowerCase()) {
      fail(`MARKER_CASE_CORPUS_BUILD_FAILED:${descriptor}`);
    }
    return {
      caseId: `CASE_${descriptor}`,
      family: "CASE_VARIANT",
      descriptor,
      serialized: markerValueEnvelope(markerValue),
      expectedError: "INVALID_TRANSPORT_ENVELOPE",
      nfkcMatchesCanonical: false,
      caseInsensitiveMatchesCanonical: true,
      confusableCrossScript: false,
    };
  });
  const normalizationDefinitions = [
    ["FULLWIDTH_D_PREFIX", "ＤRAFT/INACTIVE"],
    ["FULLWIDTH_SOLIDUS", "DRAFT／INACTIVE"],
    ["FULLWIDTH_COMPLETE", "ＤＲＡＦＴ／ＩＮＡＣＴＩＶＥ"],
    ["MATHEMATICAL_BOLD_D_PREFIX", "𝐃RAFT/INACTIVE"],
  ];
  const normalizationVariants = normalizationDefinitions.map(([descriptor, markerValue]) => {
    if (markerValue === TRANSPORT_MARKER || markerValue.normalize("NFKC") !== TRANSPORT_MARKER) {
      fail(`MARKER_NORMALIZATION_CORPUS_BUILD_FAILED:${descriptor}`);
    }
    return {
      caseId: `NORMALIZATION_${descriptor}`,
      family: "NORMALIZATION_VARIANT",
      descriptor,
      serialized: markerValueEnvelope(markerValue),
      expectedError: "INVALID_TRANSPORT_ENVELOPE",
      nfkcMatchesCanonical: true,
      caseInsensitiveMatchesCanonical: false,
      confusableCrossScript: false,
    };
  });
  const confusableDefinitions = [
    ["GREEK_CAPITAL_ALPHA", "DRΑFT/INACTIVE"],
    ["CYRILLIC_CAPITAL_A", "DRАFT/INACTIVE"],
  ];
  const confusableVariants = confusableDefinitions.map(([descriptor, markerValue]) => ({
    caseId: `CONFUSABLE_${descriptor}`,
    family: "CROSS_SCRIPT_CONFUSABLE",
    descriptor,
    serialized: markerValueEnvelope(markerValue),
    expectedError: "INVALID_TRANSPORT_ENVELOPE",
    nfkcMatchesCanonical: false,
    caseInsensitiveMatchesCanonical: false,
    confusableCrossScript: true,
  }));
  return { controls, rejections: [...rawControls, ...escapedControls, ...caseVariants, ...normalizationVariants, ...confusableVariants] };
}

export function evaluateTransportMarkerValueCorpus(baseArtifact) {
  const corpus = buildTransportMarkerValueCorpus(baseArtifact);
  const controls = corpus.controls.map(({ caseId, representation, serialized, expectedCandidate }) => {
    const parsed = parseBoundedTransportEnvelope(serialized);
    if (canonicalSha256(parsed.candidate) !== canonicalSha256(expectedCandidate)) {
      fail(`MARKER_VALUE_CONTROL_DRIFT:${caseId}`);
    }
    return {
      caseId,
      representation,
      representationSha256: sha256Hex(serialized),
      utf8Bytes: Buffer.byteLength(serialized, "utf8"),
      candidateCommitmentSha256: canonicalSha256(parsed.candidate),
      acceptedAtParser: true,
      candidateStored: false,
      mutationEvaluated: false,
    };
  });
  const rejections = corpus.rejections.map(({ caseId, family, descriptor, serialized, expectedError, nfkcMatchesCanonical, caseInsensitiveMatchesCanonical, confusableCrossScript }) => {
    let observedError = null;
    try {
      parseBoundedTransportEnvelope(serialized);
    } catch (error) {
      observedError = error instanceof Error ? error.message : String(error);
    }
    if (observedError !== expectedError) fail(`MARKER_VALUE_REJECTION_DRIFT:${caseId}:${observedError}`);
    return {
      caseId,
      family,
      descriptor,
      representationSha256: sha256Hex(serialized),
      utf8Bytes: Buffer.byteLength(serialized, "utf8"),
      expectedError,
      observedError,
      nfkcMatchesCanonical,
      caseInsensitiveMatchesCanonical,
      confusableCrossScript,
      rejectedBeforeCandidate: true,
      candidateProduced: false,
      mutationEvaluated: false,
    };
  });
  return { controls, rejections };
}
