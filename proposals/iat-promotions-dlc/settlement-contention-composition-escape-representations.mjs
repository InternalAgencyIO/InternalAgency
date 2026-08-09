/**
 * Strict JSON escape-transport audit for compact composition diagnostics.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { createHash } from "node:crypto";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { evaluateCompositionSchemaMutation } from "./settlement-contention-composition-schema-mutations.mjs";

const TRANSPORT_MARKER = "DRAFT/INACTIVE";
const sha256Hex = (value) => createHash("sha256").update(value, "utf8").digest("hex");

function reverseKeys(value) {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reverseKeys(item)]));
}

function replaceRequired(value, search, replacement, representationId) {
  if (!value.includes(search)) throw new Error(`REPRESENTATION_BUILD_FAILED:${representationId}`);
  return value.replace(search, replacement);
}

function assertUnicodeScalars(value, path = "$") {
  if (typeof value === "string") {
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = value.charCodeAt(index + 1);
        if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error("UNPAIRED_UNICODE_SURROGATE");
        index += 1;
      } else if (code >= 0xdc00 && code <= 0xdfff) {
        throw new Error("UNPAIRED_UNICODE_SURROGATE");
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertUnicodeScalars(item, `${path}/${index}`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      assertUnicodeScalars(key, `${path}/<key>`);
      assertUnicodeScalars(item, `${path}/${key}`);
    }
  }
}

export function parseEscapeRepresentation(serialized) {
  let envelope;
  try {
    envelope = JSON.parse(serialized);
  } catch {
    throw new Error("MALFORMED_JSON_ESCAPE");
  }
  assertUnicodeScalars(envelope);
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope) ||
      JSON.stringify(Object.keys(envelope).sort()) !== JSON.stringify(["candidate", "transportMarker"])) {
    throw new Error("INVALID_TRANSPORT_ENVELOPE");
  }
  if (envelope.transportMarker !== TRANSPORT_MARKER) throw new Error("TRANSPORT_MARKER_DRIFT");
  return envelope.candidate;
}

export function buildValidEscapeRepresentations(baseArtifact) {
  const envelope = { transportMarker: TRANSPORT_MARKER, candidate: baseArtifact };
  const baseLf = `${JSON.stringify(envelope, null, 2)}\n`;
  const reversedLf = `${JSON.stringify(reverseKeys(envelope), null, 2)}\n`;
  const unicodeKeyLf = replaceRequired(
    replaceRequired(baseLf, '"candidate"', '"c\\u0061ndidate"', "UNICODE_KEY_ESCAPE_LF"),
    '"vectorVersion"', '"vector\\u0056ersion"', "UNICODE_KEY_ESCAPE_LF",
  );
  const escapedSolidusLf = replaceRequired(
    baseLf, '"DRAFT/INACTIVE"', '"DRAFT\\/INACTIVE"', "ESCAPED_SOLIDUS_LF",
  );
  const unicodeAndSolidusLf = replaceRequired(
    replaceRequired(baseLf, '"candidate"', '"c\\u0061ndidate"', "UNICODE_AND_SOLIDUS_LF"),
    '"DRAFT/INACTIVE"', '"\\u0044RAFT\\u002fINACTIVE"', "UNICODE_AND_SOLIDUS_LF",
  );
  return [
    { representationId: "BASE_ENVELOPE_LF", serialized: baseLf },
    { representationId: "REVERSED_ENVELOPE_LF", serialized: reversedLf },
    { representationId: "BASE_ENVELOPE_CRLF", serialized: baseLf.replace(/\n/g, "\r\n") },
    { representationId: "UNICODE_KEY_ESCAPE_LF", serialized: unicodeKeyLf },
    { representationId: "ESCAPED_SOLIDUS_LF", serialized: escapedSolidusLf },
    { representationId: "UNICODE_AND_SOLIDUS_LF", serialized: unicodeAndSolidusLf },
  ];
}

export function buildMalformedEscapeRepresentations(baseArtifact) {
  const baseLf = `${JSON.stringify({ transportMarker: TRANSPORT_MARKER, candidate: baseArtifact }, null, 2)}\n`;
  const replaceMarker = (replacement, id) => replaceRequired(baseLf, '"DRAFT/INACTIVE"', replacement, id);
  return [
    { representationId: "TRUNCATED_UNICODE_ESCAPE", serialized: replaceMarker('"DRAFT\\u002"', "TRUNCATED_UNICODE_ESCAPE"), expectedError: "MALFORMED_JSON_ESCAPE" },
    { representationId: "NON_HEX_UNICODE_ESCAPE", serialized: replaceMarker('"DRAFT\\u00G0INACTIVE"', "NON_HEX_UNICODE_ESCAPE"), expectedError: "MALFORMED_JSON_ESCAPE" },
    { representationId: "INVALID_JSON_ESCAPE", serialized: replaceMarker('"DRAFT\\x2fINACTIVE"', "INVALID_JSON_ESCAPE"), expectedError: "MALFORMED_JSON_ESCAPE" },
    { representationId: "LONE_HIGH_SURROGATE", serialized: replaceMarker('"DRAFT\\ud800INACTIVE"', "LONE_HIGH_SURROGATE"), expectedError: "UNPAIRED_UNICODE_SURROGATE" },
    { representationId: "LONE_LOW_SURROGATE", serialized: replaceMarker('"DRAFT\\udc00INACTIVE"', "LONE_LOW_SURROGATE"), expectedError: "UNPAIRED_UNICODE_SURROGATE" },
    { representationId: "BROKEN_SURROGATE_PAIR", serialized: replaceMarker('"DRAFT\\ud800\\u0041INACTIVE"', "BROKEN_SURROGATE_PAIR"), expectedError: "UNPAIRED_UNICODE_SURROGATE" },
  ];
}

export function evaluateEscapeRepresentationCase(baseArtifact, schema, definition, baselineCase) {
  const trials = buildValidEscapeRepresentations(baseArtifact).map(({ representationId, serialized }) => {
    const representedBase = parseEscapeRepresentation(serialized);
    const result = evaluateCompositionSchemaMutation(representedBase, schema, definition);
    if (result.commonReplayRecord.candidateCommitmentSha256 !== baselineCase.candidateCommitmentSha256 ||
        result.commonReplayRecord.diagnosticCommitmentSha256 !== baselineCase.diagnosticCommitmentSha256) {
      throw new Error(`BASELINE_DIAGNOSTIC_DRIFT:${definition.caseId}`);
    }
    return {
      representationId,
      representationSha256: sha256Hex(serialized),
      candidateCommitmentSha256: result.commonReplayRecord.candidateCommitmentSha256,
      diagnosticCommitmentSha256: result.commonReplayRecord.diagnosticCommitmentSha256,
      accepted: false,
    };
  });
  if (new Set(trials.map((trial) => trial.representationSha256)).size !== trials.length) {
    throw new Error(`REPRESENTATION_DIGEST_COLLISION:${definition.caseId}`);
  }
  return {
    trials,
    representationSetCommitmentSha256: canonicalSha256(trials.map(({ representationId, representationSha256 }) => ({
      representationId, representationSha256,
    }))),
  };
}

export function evaluateMalformedEscapeCorpus(baseArtifact) {
  return buildMalformedEscapeRepresentations(baseArtifact).map(({ representationId, serialized, expectedError }) => {
    let observedError = null;
    try {
      parseEscapeRepresentation(serialized);
    } catch (error) {
      observedError = error instanceof Error ? error.message : String(error);
    }
    if (observedError !== expectedError) throw new Error(`MALFORMED_REPRESENTATION_DRIFT:${representationId}`);
    return {
      representationId,
      representationSha256: sha256Hex(serialized),
      expectedError,
      observedError,
      rejectedBeforeMutation: true,
      candidateProduced: false,
    };
  });
}
