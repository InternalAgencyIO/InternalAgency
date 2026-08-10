import { MODEL_REVISION, canonicalJson, sha256, validateTranslation } from "./integrity.mjs";

export function assertReplayArtifactBindings({ manifest, localeMapBytes, modelProvenanceBytes, promptBytes }) {
  const localeMapSha256 = sha256(localeMapBytes);
  if (manifest.locales?.localeMapSha256 !== localeMapSha256) {
    throw new Error(`locale-map digest mismatch: ${localeMapSha256}`);
  }
  const modelProvenanceSha256 = sha256(modelProvenanceBytes);
  if (manifest.modelProvenanceSha256 !== modelProvenanceSha256) {
    throw new Error(`model-provenance digest mismatch: ${modelProvenanceSha256}`);
  }
  const promptSha256 = sha256(promptBytes);
  if (manifest.generation?.promptSha256 !== promptSha256) {
    throw new Error(`prompt-template digest mismatch: ${promptSha256}`);
  }
  if (manifest.generation?.modelRevision !== MODEL_REVISION) throw new Error("manifest model revision is not pinned revision");
  return { localeMapSha256, modelProvenanceSha256, promptSha256 };
}

export function assertResultCellBinding(result, cell) {
  if (result.modelRevision !== MODEL_REVISION) throw new Error(`result model revision is not pinned for cell ${cell.cellId}`);
  if (result.ordinal !== cell.ordinal || result.locale !== cell.locale || result.sourceSha256 !== cell.sourceSha256) {
    throw new Error(`result binding failed for cell ${cell.cellId}`);
  }
}

export function evaluateUnreviewedCandidate({ result, cell, localeEntry }) {
  if (result.schema !== "iat-b3-qwen35-result-candidate/v1" || result.activationAllowed !== false) throw new Error("candidate result invariant failed");
  if (Object.hasOwn(result, "languageEvidence") || Object.hasOwn(result, "pass")) throw new Error("caller language evidence/pass is prohibited");
  if (result.candidate !== true || result.accepted !== false || result.languageProof !== false || result.nativeReviewRequired !== true) {
    throw new Error("result must be explicitly unaccepted and native-review-required");
  }
  assertResultCellBinding(result, cell);
  const resultIdentity = sha256(canonicalJson({
    cellId: result.cellId,
    modelRevision: result.modelRevision,
    outputJson: result.outputJson,
  }));
  if (result.resultCanonicalSha256 !== resultIdentity) throw new Error(`result digest mismatch for cell ${cell.cellId}`);
  const validation = validateTranslation({
    source: cell.source,
    outputJson: result.outputJson,
    localeEntry,
    languagePolicy: "candidate",
  });
  return {
    candidate: validation.pass,
    resultIdentity,
    validation,
    accepted: false,
    languageProof: false,
    nativeReviewRequired: true,
  };
}
