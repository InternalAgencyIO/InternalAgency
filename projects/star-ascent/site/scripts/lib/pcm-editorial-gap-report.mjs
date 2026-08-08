import { createHash } from "node:crypto";
import {
  hasSubstantialEnglishSourceRetention,
  hasTrivialLeadingSourceWrapper,
  hasUnprotectedAlphabeticToken,
  isSourceEquivalentMachineDraft,
  protectedIntegrityFindings,
  sourceWordRetention,
} from "./i18n-protected-integrity.mjs";
import { pcmKnownSemanticCorruptionFindings } from "./pcm-machine-draft-quality.mjs";

export const PCM_SOURCE_FREEZE = Object.freeze({
  sourceCount: 1_491,
  sourceKeysSha256: "5baff9a147d6390100a976e2d77b860ec0225db92f05ebb0d6361ac2c8981004",
});

export const PCM_SOURCE_FREEZE_EVIDENCE_BINDING = Object.freeze({
  schema: "iat-pcm-source-freeze-evidence/v1",
  evidenceCanonicalSha256: "991dbd6670f96d8e39e8ffbc0ff155e10e7790b90bc38e263253074550b46f3f",
  evidenceFileSha256: "ed8b33a06e77245db7497752f02db4938ded1a3e498b37fdebe0acb55ae2c5c3",
  provenanceCanonicalSha256: "e2cb96f2e95123ef2ff58598e4ddd9b365eb30f2f924f7c920a7eeef3c1c8c47",
});

const retiredSourceHashList = Object.freeze([
  "6c28e0631206e66e9cb841991e733d03d06bda7e4585e1913e71a3815b19af40",
  "9aebb4e72d305023eed37286d474bcc9c8f4df0bdfec418e93018061c73fbee0",
]);
const retiredSourceHashes = new Set(retiredSourceHashList);
const sourceFreezeEvidenceFields = [
  "activationReady",
  "locale",
  "policy",
  "provenance",
  "provenanceCanonicalSha256",
  "schema",
  "sourceFreeze",
  "status",
];
const sourceFreezeFields = ["ordering", "sourceCount", "sourceKeysSha256", "sources"];
const sourceFreezePolicyFields = [
  "canonicalEnglishControls",
  "directApplicationPermitted",
  "reviewClaim",
  "runtimeCatalogDependency",
  "translationClaim",
];
const sourceFreezeProvenanceFields = [
  "componentOrder",
  "components",
  "derivation",
  "preRetirementUnion",
  "retiredSourceHashes",
  "retiredSourceHashesSha256",
  "schema",
];
const sourceFreezeComponentFields = [
  "id",
  "ordering",
  "selector",
  "sourceCount",
  "sourceFileSha256",
  "sourceKeysSha256",
  "sourcePath",
  "sources",
];
const sourceFreezeUnionFields = ["sourceCount", "sourceKeysSha256"];
const sourceFreezeComponentSpecs = Object.freeze([
  Object.freeze({
    id: "CANONICAL_ENGLISH_CATALOG_KEYS",
    ordering: "UNIQUE_EN_LOCALE_COMPARE",
    selector: "Object.keys(messages.en)",
    sourcePath: "app/i18n/messages.json",
  }),
  Object.freeze({
    id: "PENDING_VISIBLE_SOURCE_VALUES",
    ordering: "UNIQUE_EN_LOCALE_COMPARE",
    selector: "pending.sources[].source",
    sourcePath: "app/i18n/pending-visible-source.json",
  }),
  Object.freeze({
    id: "CRITICAL_UI_PRIORITY_VALUES",
    ordering: "UNIQUE_OBJECT_VALUE_INSERTION_ORDER",
    selector: "Object.values(criticalUiSource)",
    sourcePath: "app/i18n/critical-ui-source.json",
  }),
]);
const forbiddenControls = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/u;
const unexpectedNonLatinScript = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Devanagari}\p{Script=Arabic}\p{Script=Bengali}\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Armenian}\p{Script=Georgian}]/u;

const topLevelFields = [
  "acceptedCurrent",
  "basedOn",
  "counts",
  "integrityPolicy",
  "legitimateIdentical",
  "locale",
  "method",
  "proposalReasons",
  "proposals",
  "qualityClaim",
  "reviewClaim",
  "schema",
  "status",
  "supersessionNote",
];
const basedOnFields = ["model", "modelRevision", "schema", "sha256", "sourceCount", "sourceKeysSha256"];
const integrityPolicyFields = ["protectedAndExactTokens", "sourceEquivalentIdentities", "unicodeSymbols"];
const countFields = [
  "acceptedCurrentWithoutChange",
  "exactDiWrappers",
  "highEnglishRetentionReviewed",
  "legitimateIdenticalClassifications",
  "legitimateLoanwordIdentitiesProposed",
  "protectedOrIdentifierIdentitiesAccepted",
  "proposals",
  "sourceMessagesReviewed",
  "suspiciousSemanticOutputsReviewed",
  "translatedOrRewrittenProposals",
];

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const sortedKeys = (value) => Object.keys(value).sort((left, right) => left.localeCompare(right, "en"));

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(sortedKeys(value).map((key) => [key, canonicalize(value[key])]));
}

export function canonicalJsonSha256(value) {
  return sha256(JSON.stringify(canonicalize(value)));
}

function assertExactFields(value, expected, label) {
  if (!isRecord(value)
    || JSON.stringify(sortedKeys(value)) !== JSON.stringify([...expected].sort((left, right) => left.localeCompare(right, "en")))) {
    throw new Error(`${label} has missing or unexpected fields`);
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
}

function assertSha256(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) throw new Error(`${label} must be a lowercase SHA-256 digest`);
}

function assertFrozenSourceArray(sources, label, { sorted }) {
  if (!Array.isArray(sources) || sources.some((source) => (
    typeof source !== "string"
    || !source
    || source !== source.trim()
    || source !== source.normalize("NFC")
  ))) {
    throw new Error(`${label} must contain only non-empty, trimmed NFC source strings`);
  }
  if (new Set(sources).size !== sources.length) throw new Error(`${label} contains duplicate sources`);
  if (sorted) {
    const expected = [...sources].sort((left, right) => left.localeCompare(right, "en"));
    if (JSON.stringify(sources) !== JSON.stringify(expected)) {
      throw new Error(`${label} is not in canonical en localeCompare order`);
    }
  }
}

export function validatePcmSourceFreezeEvidence({
  evidence,
  evidenceBytes,
}) {
  assertExactFields(evidence, sourceFreezeEvidenceFields, "PCM source-freeze evidence");
  assertExactFields(evidence.sourceFreeze, sourceFreezeFields, "PCM source-freeze inventory");
  assertExactFields(evidence.policy, sourceFreezePolicyFields, "PCM source-freeze policy");
  assertExactFields(evidence.provenance, sourceFreezeProvenanceFields, "PCM source-freeze provenance");
  assertExactFields(
    evidence.provenance.preRetirementUnion,
    sourceFreezeUnionFields,
    "PCM source-freeze pre-retirement union",
  );
  assertExactFields(PCM_SOURCE_FREEZE_EVIDENCE_BINDING, [
    "evidenceCanonicalSha256",
    "evidenceFileSha256",
    "provenanceCanonicalSha256",
    "schema",
  ], "Expected PCM source-freeze evidence binding");

  if (evidence.schema !== "iat-pcm-source-freeze-evidence/v1" || evidence.locale !== "pcm") {
    throw new Error("PCM source-freeze evidence schema or locale is invalid");
  }
  if (evidence.status !== "FROZEN_NON_ACTIVATING_SOURCE_EVIDENCE" || evidence.activationReady !== false) {
    throw new Error("PCM source-freeze evidence must remain frozen and non-activating");
  }
  if (evidence.policy.canonicalEnglishControls !== true
    || evidence.policy.directApplicationPermitted !== false
    || evidence.policy.runtimeCatalogDependency !== false
    || evidence.policy.reviewClaim !== "SOURCE_MEMBERSHIP_EVIDENCE_ONLY"
    || evidence.policy.translationClaim !== "NONE") {
    throw new Error("PCM source-freeze evidence policy is invalid");
  }
  if (evidence.sourceFreeze.ordering !== "UNIQUE_EN_LOCALE_COMPARE") {
    throw new Error("PCM source-freeze ordering policy is invalid");
  }
  assertFrozenSourceArray(evidence.sourceFreeze.sources, "PCM source-freeze inventory", { sorted: true });
  if (!Number.isSafeInteger(evidence.sourceFreeze.sourceCount) || evidence.sourceFreeze.sourceCount < 1) {
    throw new Error("PCM source-freeze source count is invalid");
  }
  assertSha256(evidence.sourceFreeze.sourceKeysSha256, "PCM source-freeze source-key digest");
  const actualSourceFreeze = {
    sourceCount: evidence.sourceFreeze.sources.length,
    sourceKeysSha256: sha256(JSON.stringify(evidence.sourceFreeze.sources)),
  };
  if (evidence.sourceFreeze.sourceCount !== actualSourceFreeze.sourceCount
    || evidence.sourceFreeze.sourceKeysSha256 !== actualSourceFreeze.sourceKeysSha256) {
    throw new Error("PCM source-freeze declared count or digest does not match its source preimage");
  }
  assertSourceFreeze(actualSourceFreeze, PCM_SOURCE_FREEZE);

  const provenance = evidence.provenance;
  if (provenance.schema !== "iat-pcm-source-freeze-provenance/v1"
    || provenance.derivation !== "UNIQUE_UNION_FILTER_RETIRED_SHA256_THEN_EN_LOCALE_COMPARE") {
    throw new Error("PCM source-freeze provenance schema or derivation is invalid");
  }
  const expectedComponentOrder = sourceFreezeComponentSpecs.map(({ id }) => id);
  if (JSON.stringify(provenance.componentOrder) !== JSON.stringify(expectedComponentOrder)
    || !Array.isArray(provenance.components)
    || provenance.components.length !== sourceFreezeComponentSpecs.length) {
    throw new Error("PCM source-freeze provenance component order is invalid");
  }
  const componentSources = {};
  for (let index = 0; index < sourceFreezeComponentSpecs.length; index += 1) {
    const component = provenance.components[index];
    const expected = sourceFreezeComponentSpecs[index];
    assertExactFields(component, sourceFreezeComponentFields, `PCM source-freeze component ${expected.id}`);
    if (component.id !== expected.id
      || component.ordering !== expected.ordering
      || component.selector !== expected.selector
      || component.sourcePath !== expected.sourcePath) {
      throw new Error(`PCM source-freeze component metadata is invalid: ${expected.id}`);
    }
    assertFrozenSourceArray(
      component.sources,
      `PCM source-freeze component ${expected.id}`,
      { sorted: expected.ordering === "UNIQUE_EN_LOCALE_COMPARE" },
    );
    if (!Number.isSafeInteger(component.sourceCount) || component.sourceCount < 1) {
      throw new Error(`PCM source-freeze component count is invalid: ${expected.id}`);
    }
    assertSha256(component.sourceFileSha256, `PCM source-freeze component file digest ${expected.id}`);
    assertSha256(component.sourceKeysSha256, `PCM source-freeze component source-key digest ${expected.id}`);
    if (component.sourceCount !== component.sources.length
      || component.sourceKeysSha256 !== sha256(JSON.stringify(component.sources))) {
      throw new Error(`PCM source-freeze component count or digest mismatch: ${expected.id}`);
    }
    componentSources[component.id] = [...component.sources];
  }

  if (JSON.stringify(provenance.retiredSourceHashes) !== JSON.stringify(retiredSourceHashList)) {
    throw new Error("PCM source-freeze retired-source policy is invalid");
  }
  assertSha256(provenance.retiredSourceHashesSha256, "PCM source-freeze retired-source digest");
  if (provenance.retiredSourceHashesSha256 !== sha256(JSON.stringify(provenance.retiredSourceHashes))) {
    throw new Error("PCM source-freeze retired-source digest mismatch");
  }
  const preRetirementSources = [...new Set(provenance.components.flatMap(({ sources }) => sources))]
    .sort((left, right) => left.localeCompare(right, "en"));
  const preRetirementUnion = {
    sourceCount: preRetirementSources.length,
    sourceKeysSha256: sha256(JSON.stringify(preRetirementSources)),
  };
  if (provenance.preRetirementUnion.sourceCount !== preRetirementUnion.sourceCount
    || provenance.preRetirementUnion.sourceKeysSha256 !== preRetirementUnion.sourceKeysSha256) {
    throw new Error("PCM source-freeze pre-retirement union mismatch");
  }
  const derivedSources = preRetirementSources.filter((source) => !retiredSourceHashes.has(sha256(source)));
  if (JSON.stringify(derivedSources) !== JSON.stringify(evidence.sourceFreeze.sources)) {
    throw new Error("PCM source-freeze sources do not match their provenance components");
  }

  assertSha256(evidence.provenanceCanonicalSha256, "PCM source-freeze provenance canonical digest");
  const provenanceCanonicalSha256 = canonicalJsonSha256(provenance);
  if (evidence.provenanceCanonicalSha256 !== provenanceCanonicalSha256) {
    throw new Error("PCM source-freeze provenance canonical digest mismatch");
  }
  if (!(evidenceBytes instanceof Uint8Array)) {
    throw new Error("PCM source-freeze evidence bytes are required for immutable validation");
  }
  const binding = {
    schema: evidence.schema,
    evidenceCanonicalSha256: canonicalJsonSha256(evidence),
    evidenceFileSha256: sha256(evidenceBytes),
    provenanceCanonicalSha256,
  };
  for (const [field, expected] of Object.entries(PCM_SOURCE_FREEZE_EVIDENCE_BINDING)) {
    if (binding[field] !== expected) throw new Error(`PCM source-freeze evidence binding mismatch: ${field}`);
  }

  return {
    inventory: {
      sources: [...evidence.sourceFreeze.sources],
      ...actualSourceFreeze,
    },
    componentSources,
    binding,
    policy: structuredClone(evidence.policy),
  };
}

export function sourceInventoryFromInputs({ catalog, pending, criticalUi }) {
  if (!isRecord(catalog?.messages?.en)) throw new Error("English catalog source inventory is missing");
  if (!Array.isArray(pending?.sources)) throw new Error("Pending visible source inventory is missing");
  if (!isRecord(criticalUi)) throw new Error("Critical UI source inventory is missing");
  const catalogSources = Object.keys(catalog.messages.en);
  const pendingSources = pending.sources.map((entry, index) => {
    if (!isRecord(entry) || typeof entry.source !== "string" || !entry.source) {
      throw new Error(`Pending visible source ${index} is malformed`);
    }
    return entry.source;
  });
  const criticalSources = Object.values(criticalUi);
  if (criticalSources.some((source) => typeof source !== "string" || !source)) {
    throw new Error("Critical UI source inventory contains a malformed value");
  }
  const sources = [...new Set([...catalogSources, ...pendingSources, ...criticalSources])]
    .filter((source) => !retiredSourceHashes.has(sha256(source)))
    .sort((left, right) => left.localeCompare(right, "en"));
  return {
    sources,
    sourceCount: sources.length,
    sourceKeysSha256: sha256(JSON.stringify(sources)),
  };
}

export function assertSourceFreeze(inventory, expected = PCM_SOURCE_FREEZE) {
  if (inventory.sourceCount !== expected.sourceCount || inventory.sourceKeysSha256 !== expected.sourceKeysSha256) {
    throw new Error(
      `PCM source freeze mismatch: expected ${expected.sourceCount}/${expected.sourceKeysSha256}; `
      + `received ${inventory.sourceCount}/${inventory.sourceKeysSha256}`,
    );
  }
}

export function validateStaleEditorialProposalArtifact(artifact) {
  assertExactFields(artifact, topLevelFields, "Editorial proposal artifact");
  assertExactFields(artifact.basedOn, basedOnFields, "Editorial proposal basedOn binding");
  assertExactFields(artifact.integrityPolicy, integrityPolicyFields, "Editorial proposal integrity policy");
  assertExactFields(artifact.counts, countFields, "Editorial proposal counts");
  if (artifact.schema !== "iat-pcm-editorial-proposals/v1" || artifact.locale !== "pcm") {
    throw new Error("Editorial proposal artifact schema or locale is invalid");
  }
  if (artifact.status !== "STALE_SOURCE_BOUND_NOT_FOR_DIRECT_APPLICATION") {
    throw new Error("Editorial proposal artifact must be explicitly stale and barred from direct application");
  }
  if (artifact.qualityClaim !== "UNVERIFIED_MACHINE_DRAFT_BEST_EFFORT"
    || artifact.reviewClaim !== "AI_GENERATED_UNVERIFIED_CANONICAL_ENGLISH_CONTROLS") {
    throw new Error("Editorial proposal artifact disclosure contract is invalid");
  }
  for (const [value, label] of [
    [artifact.method, "Editorial proposal method"],
    [artifact.supersessionNote, "Editorial proposal supersession note"],
    ...Object.entries(artifact.integrityPolicy).map(([key, value]) => [value, `Editorial proposal integrity policy ${key}`]),
  ]) assertNonEmptyString(value, label);
  if (artifact.basedOn.schema !== "iat-pcm-machine-draft/v1"
    || artifact.basedOn.model !== "NITHUB-AI/marian-mt-bbc-en-pcm"
    || artifact.basedOn.modelRevision !== "99c6ff5290bad2b2cd4ada9fe52151e67adf6058") {
    throw new Error("Editorial proposal artifact is not bound to the rejected pinned PCM draft");
  }
  assertSha256(artifact.basedOn.sha256, "Editorial proposal basedOn sha256");
  assertSha256(artifact.basedOn.sourceKeysSha256, "Editorial proposal basedOn sourceKeysSha256");
  if (!Number.isSafeInteger(artifact.basedOn.sourceCount) || artifact.basedOn.sourceCount < 1) {
    throw new Error("Editorial proposal basedOn sourceCount is invalid");
  }
  for (const field of countFields) {
    if (!Number.isSafeInteger(artifact.counts[field]) || artifact.counts[field] < 0) {
      throw new Error(`Editorial proposal count ${field} is invalid`);
    }
  }
  for (const [value, label] of [
    [artifact.proposals, "proposals"],
    [artifact.proposalReasons, "proposalReasons"],
    [artifact.legitimateIdentical, "legitimateIdentical"],
    [artifact.acceptedCurrent, "acceptedCurrent"],
  ]) {
    if (!isRecord(value)) throw new Error(`Editorial proposal ${label} must be an object`);
  }
  const proposalKeys = sortedKeys(artifact.proposals);
  const reasonKeys = sortedKeys(artifact.proposalReasons);
  const acceptedKeys = sortedKeys(artifact.acceptedCurrent);
  const legitimateKeys = sortedKeys(artifact.legitimateIdentical);
  if (JSON.stringify(proposalKeys) !== JSON.stringify(reasonKeys)) {
    throw new Error("Every editorial proposal must have one source-keyed reason list");
  }
  if (proposalKeys.some((source) => Object.hasOwn(artifact.acceptedCurrent, source))) {
    throw new Error("Editorial proposal and accepted-current source sets overlap");
  }
  if (legitimateKeys.some((source) => (
    !Object.hasOwn(artifact.proposals, source) && !Object.hasOwn(artifact.acceptedCurrent, source)
  ))) {
    throw new Error("Legitimate-identity classifications must be bound to a proposal or accepted-current decision");
  }
  for (const source of proposalKeys) {
    assertNonEmptyString(source, "Editorial proposal source key");
    assertNonEmptyString(artifact.proposals[source], `Editorial proposal for ${JSON.stringify(source)}`);
    const reasons = artifact.proposalReasons[source];
    if (!Array.isArray(reasons) || reasons.length < 1 || reasons.some((reason) => typeof reason !== "string" || !reason.trim())) {
      throw new Error(`Editorial proposal reasons are malformed for ${JSON.stringify(source)}`);
    }
  }
  for (const source of acceptedKeys) {
    assertExactFields(artifact.acceptedCurrent[source], ["classification", "current"], `Accepted-current record for ${JSON.stringify(source)}`);
    assertNonEmptyString(artifact.acceptedCurrent[source].current, `Accepted-current translation for ${JSON.stringify(source)}`);
    assertNonEmptyString(artifact.acceptedCurrent[source].classification, `Accepted-current classification for ${JSON.stringify(source)}`);
  }
  let scopedIdentities = 0;
  let fixedIdentities = 0;
  for (const source of legitimateKeys) {
    const record = artifact.legitimateIdentical[source];
    assertExactFields(
      record,
      ["classification", "current", "proposed", "requiresScopedSourceEquivalentException"],
      `Legitimate-identity record for ${JSON.stringify(source)}`,
    );
    assertNonEmptyString(record.current, `Legitimate-identity current translation for ${JSON.stringify(source)}`);
    assertNonEmptyString(record.classification, `Legitimate-identity classification for ${JSON.stringify(source)}`);
    if (record.proposed !== source || typeof record.requiresScopedSourceEquivalentException !== "boolean") {
      throw new Error(`Legitimate-identity binding is invalid for ${JSON.stringify(source)}`);
    }
    if (record.requiresScopedSourceEquivalentException) {
      if (artifact.proposals[source] !== source) {
        throw new Error(`Scoped legitimate identity is not an exact-source proposal for ${JSON.stringify(source)}`);
      }
      scopedIdentities += 1;
    } else {
      if (artifact.acceptedCurrent[source]?.current !== record.current) {
        throw new Error(`Fixed legitimate identity is not bound to accepted-current for ${JSON.stringify(source)}`);
      }
      fixedIdentities += 1;
    }
  }
  const expectedCounts = {
    acceptedCurrentWithoutChange: acceptedKeys.length,
    legitimateIdenticalClassifications: legitimateKeys.length,
    legitimateLoanwordIdentitiesProposed: scopedIdentities,
    protectedOrIdentifierIdentitiesAccepted: fixedIdentities,
    proposals: proposalKeys.length,
    sourceMessagesReviewed: proposalKeys.length + acceptedKeys.length,
    translatedOrRewrittenProposals: proposalKeys.filter((source) => artifact.proposals[source] !== source).length,
  };
  for (const [field, expected] of Object.entries(expectedCounts)) {
    if (artifact.counts[field] !== expected) {
      throw new Error(`Editorial proposal count ${field}=${artifact.counts[field]} does not match payload=${expected}`);
    }
  }
  if (artifact.basedOn.sourceCount !== artifact.counts.sourceMessagesReviewed) {
    throw new Error("Editorial proposal basedOn count does not cover every source decision");
  }
}

function symbolMultiset(value) {
  return [...value.matchAll(/\p{S}/gu)].map((match) => match[0]).sort((left, right) => left.localeCompare(right, "en"));
}

function hasRepeatedRun(value) {
  if (/([^\p{L}\p{N}\s])\1{8,}/u.test(value) || /([\p{L}\p{N}])\1{11,}/u.test(value)) return true;
  const words = value.toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? [];
  let repeatedWords = 1;
  for (let index = 1; index < words.length; index += 1) {
    repeatedWords = words[index] === words[index - 1] ? repeatedWords + 1 : 1;
    if (repeatedWords >= 6) return true;
  }
  const codePoints = Array.from(value.normalize("NFC"));
  for (let width = 2; width <= 8; width += 1) {
    for (let start = 0; start + width * 8 <= codePoints.length; start += 1) {
      const unit = codePoints.slice(start, start + width).join("");
      if (unit.trim() && codePoints.slice(start, start + width * 8).join("") === unit.repeat(8)) return true;
    }
  }
  return false;
}

export function pcmEditorialCandidateFindings(source, translation) {
  if (typeof translation !== "string" || !translation.trim()) return [{ rule: "missing-translation" }];
  const findings = [];
  if (translation !== translation.normalize("NFC").trim()) findings.push({ rule: "non-normalized-or-untrimmed" });
  if (forbiddenControls.test(translation) || /\uFFFD/u.test(translation)) findings.push({ rule: "unsafe-unicode" });
  if (/<script\b|javascript:/iu.test(translation)) findings.push({ rule: "executable-markup" });
  if (!/[\u27E8\u27E9]/u.test(source) && /[\u27E8\u27E9]/u.test(translation)) findings.push({ rule: "introduced-token-tail" });
  if ((translation.match(/\p{Extended_Pictographic}/gu) ?? []).length > (source.match(/\p{Extended_Pictographic}/gu) ?? []).length) {
    findings.push({ rule: "introduced-emoji" });
  }
  if (hasRepeatedRun(translation)) findings.push({ rule: "translation-collapse" });
  if (translation.length > 800 || (source.length > 40 && translation.length / source.length > 4)) {
    findings.push({ rule: "translation-expansion", sourceLength: source.length, translationLength: translation.length });
  }
  const sourceSymbols = symbolMultiset(source);
  const translationSymbols = symbolMultiset(translation);
  if (JSON.stringify(sourceSymbols) !== JSON.stringify(translationSymbols)) {
    findings.push({ rule: "unicode-symbol-multiset", sourceSymbols, translationSymbols });
  }
  findings.push(...protectedIntegrityFindings(source, translation));
  findings.push(...pcmKnownSemanticCorruptionFindings(source, translation));
  if (hasTrivialLeadingSourceWrapper(source, translation, ["di"])) findings.push({ rule: "trivial-source-wrapper" });
  if (isSourceEquivalentMachineDraft(source, translation)) findings.push({ rule: "source-equivalent-machine-draft" });
  if (hasSubstantialEnglishSourceRetention(source, translation)) {
    const retention = sourceWordRetention(source, translation);
    findings.push({
      rule: "english-source-retention",
      sourceWords: retention.sourceWords,
      retainedWords: retention.retainedWords,
      retainedRatioPpm: Math.round(retention.ratio * 1_000_000),
    });
  }
  if (hasUnprotectedAlphabeticToken(source) && !/\p{L}/u.test(translation)) findings.push({ rule: "target-script-absent" });
  if (hasUnprotectedAlphabeticToken(source) && unexpectedNonLatinScript.test(translation)) findings.push({ rule: "unexpected-script" });
  return findings;
}

export function buildPcmEditorialGapReport({
  inventory,
  proposalArtifact,
  gateBinding,
  expectedSourceFreeze = PCM_SOURCE_FREEZE,
}) {
  assertSourceFreeze(inventory, expectedSourceFreeze);
  validateStaleEditorialProposalArtifact(proposalArtifact);
  assertExactFields(
    gateBinding,
    ["pcmQualityModuleSha256", "protectedIntegrityModuleSha256", "salvageModuleSha256"],
    "PCM salvage gate binding",
  );
  for (const [field, digest] of Object.entries(gateBinding)) assertSha256(digest, `PCM salvage gate binding ${field}`);
  const sourceSet = new Set(inventory.sources);
  const reusableProposals = {};
  const gaps = [];
  const ignoredStaleProposalKeys = sortedKeys(proposalArtifact.proposals).filter((source) => !sourceSet.has(source));
  let exactKeyCandidateCount = 0;
  let rejectedExactKeyProposalCount = 0;
  let missingExactKeyProposalCount = 0;
  for (const source of inventory.sources) {
    if (!Object.hasOwn(proposalArtifact.proposals, source)) {
      missingExactKeyProposalCount += 1;
      gaps.push({ source, status: "NO_EXACT_SOURCE_KEY_PROPOSAL" });
      continue;
    }
    exactKeyCandidateCount += 1;
    const translation = proposalArtifact.proposals[source];
    const findings = pcmEditorialCandidateFindings(source, translation);
    if (findings.length > 0) {
      rejectedExactKeyProposalCount += 1;
      gaps.push({
        source,
        status: "EXACT_KEY_PROPOSAL_REJECTED_BY_CURRENT_GATES",
        proposal: translation,
        proposalReasons: [...proposalArtifact.proposalReasons[source]],
        findings,
      });
      continue;
    }
    reusableProposals[source] = {
      translation,
      proposalReasons: [...proposalArtifact.proposalReasons[source]],
    };
  }
  const reusableProposalCount = Object.keys(reusableProposals).length;
  if (exactKeyCandidateCount !== reusableProposalCount + rejectedExactKeyProposalCount
    || inventory.sourceCount !== reusableProposalCount + gaps.length) {
    throw new Error("PCM salvage report accounting invariant failed");
  }
  return {
    schema: "iat-pcm-editorial-gap-report/v1",
    locale: "pcm",
    status: gaps.length === 0 ? "COMPLETE_CURRENT_GATES_PASS" : "INCOMPLETE_FAIL_CLOSED",
    activationReady: false,
    sourceFreeze: {
      sourceCount: inventory.sourceCount,
      sourceKeysSha256: inventory.sourceKeysSha256,
      ordering: "UNIQUE_EN_LOCALE_COMPARE",
    },
    proposalArtifact: {
      schema: proposalArtifact.schema,
      canonicalSha256: canonicalJsonSha256(proposalArtifact),
      staleSourceCount: proposalArtifact.basedOn.sourceCount,
      staleSourceKeysSha256: proposalArtifact.basedOn.sourceKeysSha256,
      directApplicationPermitted: false,
    },
    gateBinding: canonicalize(gateBinding),
    policy: {
      match: "EXACT_CANONICAL_SOURCE_STRING_ONLY",
      sourceEquivalentExceptionsApplied: false,
      englishRetentionExceptionsApplied: false,
      canonicalEnglishControls: true,
      qualityClaim: "UNVERIFIED_MACHINE_DRAFT_BEST_EFFORT",
    },
    counts: {
      sourceCount: inventory.sourceCount,
      staleProposalCount: Object.keys(proposalArtifact.proposals).length,
      exactKeyCandidateCount,
      reusableProposalCount,
      rejectedExactKeyProposalCount,
      missingExactKeyProposalCount,
      ignoredStaleProposalKeyCount: ignoredStaleProposalKeys.length,
      gapCount: gaps.length,
    },
    reusableProposals,
    gaps,
    ignoredStaleProposalKeys,
  };
}

export function serializePcmEditorialGapReport(report) {
  return `${JSON.stringify(report, null, 2)}\n`;
}
