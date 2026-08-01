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
      index += numberMatch[0].length;
      const value = Number(numberMatch[0]);
      if (!Number.isFinite(value)) fail("MALFORMED_JSON");
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
