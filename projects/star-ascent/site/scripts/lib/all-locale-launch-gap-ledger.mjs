import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { canonicalJsonSha256, validatePcmSourceFreezeEvidence } from "./pcm-editorial-gap-report.mjs";

export const ALL_LOCALE_CODES = Object.freeze([
  "en", "zh", "es", "hi", "fr", "ar", "bn", "pt", "id", "ur", "ru", "de", "ja",
  "pcm", "tr", "sq", "ca", "be", "nl", "bs", "bg", "hr", "el", "cs", "da", "et",
  "fi", "hu", "is", "ga", "it", "lv", "lt", "lb", "mk", "mt", "no", "pl", "ro",
  "sr", "sk", "sl", "sv", "uk", "ht", "gn", "qu", "hy", "az", "ka",
]);

export const ALL_LOCALE_LEDGER_BINDING = Object.freeze({
  schema: "iat-all-locale-launch-gap-ledger/v1",
  sourceCount: 1_491,
  sourceKeysSha256: "5baff9a147d6390100a976e2d77b860ec0225db92f05ebb0d6361ac2c8981004",
  pcmArtifactFileSha256: "b8db39ae2b58314d11be382658075bd7a58b0e5b3b412896775baa73773d8fdc",
  pcmArtifactCanonicalSha256: "85605497b0e2f5c2cf5167858a56878ba5578d7588cabb769dddbab76ceea2f6",
  pcmProofFileSha256: "78c01f4b00a3888d6d3a48a852c67d1b61a19199131dc9e605b31838d151030a",
  pcmProofCanonicalSha256: "eb5003579eac39973453b5ea4d683e857f85d9d1157658b340ff60775b815c2f",
  pcmMessageEntriesSha256: "6dcf8451a2dd9bbf3f578eb470ac78775752d66aaa9f5cb94463cd78b9c6d557",
});

const siteUrl = new URL("../../", import.meta.url);
const fileUrl = (path) => new URL(path, siteUrl);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertLocaleRoster(value, label) {
  check(
    sameJson(Object.keys(value ?? {}), ALL_LOCALE_CODES),
    `${label} must contain the exact ordered 50-locale roster`,
  );
}

function flattenedStringMap(value, prefix = "", output = {}) {
  if (typeof value === "string") {
    output[prefix] = value;
    return output;
  }
  if (!isRecord(value)) return output;
  for (const [key, child] of Object.entries(value)) {
    flattenedStringMap(child, prefix ? `${prefix}.${key}` : key, output);
  }
  return output;
}

function dictionaryStats(sourceDictionary, targetDictionary, label) {
  check(isRecord(sourceDictionary) && isRecord(targetDictionary), `${label} dictionary is missing`);
  const sourceKeys = Object.keys(sourceDictionary);
  check(sameJson(Object.keys(targetDictionary), sourceKeys), `${label} source-key parity failed`);
  let translatedCells = 0;
  let sourceEquivalentCells = 0;
  let emptyCells = 0;
  for (const source of sourceKeys) {
    const target = targetDictionary[source];
    if (typeof target !== "string" || !target.trim()) emptyCells += 1;
    else if (target === sourceDictionary[source]) sourceEquivalentCells += 1;
    else translatedCells += 1;
  }
  return { sourceCells: sourceKeys.length, translatedCells, sourceEquivalentCells, emptyCells };
}

function validatePcmArtifact({ artifact, artifactBytes, proof, proofBytes, frozen }) {
  check(isRecord(artifact) && isRecord(artifact.messages), "PCM artifact is malformed");
  check(artifact.schema === "iat-pcm-machine-draft/v2", "PCM artifact schema is invalid");
  check(artifact.locale === "pcm", "PCM artifact locale is invalid");
  check(artifact.engine === "LOCAL_MARIAN_MACHINE_DRAFT", "PCM artifact engine is invalid");
  check(artifact.model === "NITHUB-AI/marian-mt-bbc-en-pcm", "PCM artifact model is invalid");
  check(
    artifact.modelRevision === "99c6ff5290bad2b2cd4ada9fe52151e67adf6058",
    "PCM artifact model revision is invalid",
  );
  check(artifact.license === "CC-BY-4.0", "PCM artifact declared license is invalid");
  check(artifact.aiGenerated === true && artifact.verified === false, "PCM artifact review claim is invalid");
  check(artifact.canonicalEnglishControls === true, "PCM artifact must retain canonical English control");
  check(
    artifact.qualityClaim === "UNVERIFIED_MACHINE_DRAFT_BEST_EFFORT",
    "PCM artifact quality claim is invalid",
  );
  check(
    artifact.sourceCount === frozen.inventory.sourceCount
      && artifact.sourceKeysSha256 === frozen.inventory.sourceKeysSha256
      && sameJson(Object.keys(artifact.messages), frozen.inventory.sources),
    "PCM artifact does not match the immutable source freeze",
  );
  check(sha256(artifactBytes) === ALL_LOCALE_LEDGER_BINDING.pcmArtifactFileSha256, "PCM artifact file binding drifted");
  check(
    canonicalJsonSha256(artifact) === ALL_LOCALE_LEDGER_BINDING.pcmArtifactCanonicalSha256,
    "PCM artifact canonical binding drifted",
  );
  check(
    sha256(JSON.stringify(Object.entries(artifact.messages))) === ALL_LOCALE_LEDGER_BINDING.pcmMessageEntriesSha256,
    "PCM artifact message binding drifted",
  );

  check(isRecord(proof), "PCM assembly proof is malformed");
  check(proof.schema === "iat-pcm-machine-draft-assembly-proof/v1", "PCM assembly proof schema is invalid");
  check(proof.locale === "pcm", "PCM assembly proof locale is invalid");
  check(
    proof.status === "DETERMINISTIC_CURRENT_GATES_PASS_NON_ACTIVATING_ASSEMBLY"
      && proof.activationReady === false
      && proof.directApplicationPermitted === false
      && proof.runtimeCatalogDependency === false
      && proof.canonicalEnglishControls === true
      && proof.reviewClaim === "AI_GENERATED_UNVERIFIED",
    "PCM assembly proof must remain non-activating and unverified",
  );
  check(
    proof.sourceFreezeBinding?.sourceCount === frozen.inventory.sourceCount
      && proof.sourceFreezeBinding?.sourceKeysSha256 === frozen.inventory.sourceKeysSha256,
    "PCM proof source binding drifted",
  );
  check(
    proof.artifactBinding?.fileSha256 === ALL_LOCALE_LEDGER_BINDING.pcmArtifactFileSha256
      && proof.artifactBinding?.canonicalSha256 === ALL_LOCALE_LEDGER_BINDING.pcmArtifactCanonicalSha256
      && proof.artifactBinding?.messageEntriesSha256 === ALL_LOCALE_LEDGER_BINDING.pcmMessageEntriesSha256,
    "PCM proof artifact binding drifted",
  );
  check(sha256(proofBytes) === ALL_LOCALE_LEDGER_BINDING.pcmProofFileSha256, "PCM proof file binding drifted");
  check(
    canonicalJsonSha256(proof) === ALL_LOCALE_LEDGER_BINDING.pcmProofCanonicalSha256,
    "PCM proof canonical binding drifted",
  );

  let translatedCells = 0;
  let sourceEquivalentCells = 0;
  for (const source of frozen.inventory.sources) {
    const translation = artifact.messages[source];
    check(typeof translation === "string" && translation.trim(), `PCM artifact has an empty cell: ${source}`);
    if (translation === source) sourceEquivalentCells += 1;
    else translatedCells += 1;
  }
  return { translatedCells, sourceEquivalentCells };
}

function runtimeSnapshot(inputs, frozen) {
  const { catalog, catalogBytes, metadata, metadataBytes, pending, pendingBytes, criticalUi,
    criticalUiBytes, policy, policyBytes, payloadContract, payloadContractBytes, publicBundles } = inputs;
  assertLocaleRoster(catalog.messages, "Runtime catalog");
  assertLocaleRoster(metadata, "Runtime metadata");
  assertLocaleRoster(policy.localeStatus, "Runtime localization policy");
  assertLocaleRoster(payloadContract.localeContentSha256, "Payload contract");
  check(catalog.meta?.sourceCount === Object.keys(catalog.messages.en).length, "Runtime catalog source count drifted");
  check(Array.isArray(pending.sources), "Pending visible-source inventory is missing");
  check(isRecord(criticalUi), "Critical UI inventory is missing");
  check(publicBundles.length === ALL_LOCALE_CODES.length, "Public bundle roster is incomplete");

  const catalogStats = {};
  for (const locale of ALL_LOCALE_CODES) {
    catalogStats[locale] = dictionaryStats(catalog.messages.en, catalog.messages[locale], `Runtime catalog ${locale}`);
  }
  const targetCatalogStats = ALL_LOCALE_CODES.slice(1).map((locale) => catalogStats[locale]);

  const englishMetadata = flattenedStringMap(metadata.en);
  const metadataStats = {};
  for (const locale of ALL_LOCALE_CODES) {
    const targetMetadata = flattenedStringMap(metadata[locale]);
    metadataStats[locale] = dictionaryStats(englishMetadata, targetMetadata, `Runtime metadata ${locale}`);
  }

  const bundleStats = {};
  const bundleBindings = {};
  const expectedNamespace = `${payloadContract.assetNamespace}/${payloadContract.payloadNamespaceSha256.slice(0, 16)}`;
  const englishBundle = publicBundles.find(({ locale }) => locale === "en")?.artifact;
  check(isRecord(englishBundle?.messages), "English public bundle is missing");
  for (let index = 0; index < ALL_LOCALE_CODES.length; index += 1) {
    const locale = ALL_LOCALE_CODES[index];
    const bundle = publicBundles[index];
    check(bundle.locale === locale && bundle.artifact?.locale === locale, `Public bundle order or locale drifted: ${locale}`);
    check(bundle.artifact.schema === payloadContract.schema, `Public bundle schema drifted: ${locale}`);
    check(bundle.artifact.contentSha256 === payloadContract.localeContentSha256[locale], `Public bundle content binding drifted: ${locale}`);
    bundleStats[locale] = dictionaryStats(englishBundle.messages, bundle.artifact.messages, `Public bundle ${locale}`);
    bundleBindings[locale] = sha256(bundle.bytes);
  }
  const targetBundleStats = ALL_LOCALE_CODES.slice(1).map((locale) => bundleStats[locale]);

  const pendingRoutes = new Set(pending.sources.flatMap((entry) => (
    Array.isArray(entry.routes) ? entry.routes : []
  )));
  const runtimeUnion = new Set([
    ...Object.keys(catalog.messages.en),
    ...pending.sources.map(({ source }) => source),
    ...Object.values(criticalUi),
  ]);

  return {
    canonicalSourceMembership: {
      frozenSourceCount: frozen.inventory.sourceCount,
      runtimeInputUniqueSourceCountBeforeRetirementFiltering: runtimeUnion.size,
      activeCatalogSourceCount: Object.keys(catalog.messages.en).length,
      pendingVisibleSourceCount: pending.sources.length,
      pendingRouteCount: pendingRoutes.size,
      criticalUiEntryCount: Object.keys(criticalUi).length,
    },
    activeCatalog: {
      fileSha256: sha256(catalogBytes),
      sourceCount: catalog.meta.sourceCount,
      localeCount: ALL_LOCALE_CODES.length,
      targetLocaleCount: ALL_LOCALE_CODES.length - 1,
      targetCells: targetCatalogStats.reduce((sum, item) => sum + item.sourceCells, 0),
      targetTranslatedCells: targetCatalogStats.reduce((sum, item) => sum + item.translatedCells, 0),
      targetSourceEquivalentCells: targetCatalogStats.reduce((sum, item) => sum + item.sourceEquivalentCells, 0),
      targetEmptyCells: targetCatalogStats.reduce((sum, item) => sum + item.emptyCells, 0),
      byLocale: catalogStats,
    },
    activeMetadata: {
      fileSha256: sha256(metadataBytes),
      leavesPerLocale: Object.keys(englishMetadata).length,
      targetTranslatedLeaves: ALL_LOCALE_CODES.slice(1)
        .reduce((sum, locale) => sum + metadataStats[locale].translatedCells, 0),
      targetSourceEquivalentLeaves: ALL_LOCALE_CODES.slice(1)
        .reduce((sum, locale) => sum + metadataStats[locale].sourceEquivalentCells, 0),
    },
    pendingVisibleSource: {
      fileSha256: sha256(pendingBytes),
      status: pending.status,
      pendingSourceCount: pending.sources.length,
      pendingRouteCount: pendingRoutes.size,
      translationComplete: pending.localeWorkflow?.translationComplete === true,
      activeInRuntimeCatalog: pending.runtime?.freshCapturedSourceActive === true,
    },
    criticalUiSource: {
      fileSha256: sha256(criticalUiBytes),
      entryCount: Object.keys(criticalUi).length,
      uniqueValueCount: new Set(Object.values(criticalUi)).size,
    },
    runtimePolicy: {
      fileSha256: sha256(policyBytes),
      mode: policy.mode,
      machineDraftRuntimeAllowed: policy.machineDraftRuntimeAllowed === true,
      targetLocalesMarkedAiGeneratedUnverified: ALL_LOCALE_CODES.slice(1)
        .filter((locale) => policy.localeStatus[locale] === "AI_GENERATED_UNVERIFIED").length,
      note: "A policy label is not translation, source binding, or review evidence.",
    },
    publicPayloads: {
      contractFileSha256: sha256(payloadContractBytes),
      namespace: expectedNamespace,
      bundleCount: publicBundles.length,
      sourceCountPerBundle: englishBundle.sourceCount,
      targetCells: targetBundleStats.reduce((sum, item) => sum + item.sourceCells, 0),
      targetTranslatedCells: targetBundleStats.reduce((sum, item) => sum + item.translatedCells, 0),
      targetSourceEquivalentCells: targetBundleStats.reduce((sum, item) => sum + item.sourceEquivalentCells, 0),
      targetEmptyCells: targetBundleStats.reduce((sum, item) => sum + item.emptyCells, 0),
      bundleSetSha256: canonicalJsonSha256(bundleBindings),
    },
  };
}

export function buildAllLocaleLaunchGapLedger(inputs) {
  const frozen = validatePcmSourceFreezeEvidence({
    evidence: inputs.sourceFreezeEvidence,
    evidenceBytes: inputs.sourceFreezeEvidenceBytes,
  });
  check(
    frozen.inventory.sourceCount === ALL_LOCALE_LEDGER_BINDING.sourceCount
      && frozen.inventory.sourceKeysSha256 === ALL_LOCALE_LEDGER_BINDING.sourceKeysSha256,
    "Canonical all-locale source binding drifted",
  );
  check(inputs.committedCheckpointCount === 0, "A committed machine-draft checkpoint now exists; regenerate with explicit validation support");
  check(inputs.nativeReviewEvidenceBytes === null, "Native-review evidence now exists; regenerate with explicit evidence validation support");

  const pcm = validatePcmArtifact({
    artifact: inputs.pcmArtifact,
    artifactBytes: inputs.pcmArtifactBytes,
    proof: inputs.pcmProof,
    proofBytes: inputs.pcmProofBytes,
    frozen,
  });
  const runtime = runtimeSnapshot(inputs, frozen);
  const targetLocales = ALL_LOCALE_CODES.slice(1);
  const missingDraftLocales = targetLocales.filter((locale) => locale !== "pcm");
  const perLocale = {};
  for (const locale of ALL_LOCALE_CODES) {
    if (locale === "en") {
      perLocale[locale] = {
        role: "CANONICAL_SOURCE",
        frozenSourceCells: frozen.inventory.sourceCount,
        sourceBoundDraftCells: 0,
        translationCellsRemaining: 0,
        providerDecision: "NOT_APPLICABLE_SOURCE_LOCALE",
        checkpoint: "NOT_APPLICABLE_SOURCE_LOCALE",
        nativeReviewAcceptance: "MISSING",
        nativeReviewChecksRequired: 5,
        nativeReviewChecksPassed: 0,
        activationReady: false,
      };
    } else if (locale === "pcm") {
      perLocale[locale] = {
        role: "TARGET_LOCALE",
        frozenSourceCells: frozen.inventory.sourceCount,
        sourceBoundDraftCells: frozen.inventory.sourceCount,
        linguisticallyChangedCells: pcm.translatedCells,
        sourceEquivalentLabelCells: pcm.sourceEquivalentCells,
        translationCellsRemaining: 0,
        providerDecision: "SOURCE_BOUND_LOCAL_MODEL_ARTIFACT_PRESENT",
        provider: {
          engine: inputs.pcmArtifact.engine,
          model: inputs.pcmArtifact.model,
          modelRevision: inputs.pcmArtifact.modelRevision,
          declaredLicense: inputs.pcmArtifact.license,
          legalClearanceClaim: "NONE",
        },
        checkpoint: "IMMUTABLE_NON_ACTIVATING_ARTIFACT_AND_ASSEMBLY_PROOF_PRESENT",
        nativeReviewAcceptance: "MISSING",
        nativeReviewChecksRequired: 5,
        nativeReviewChecksPassed: 0,
        activationReady: false,
      };
    } else {
      perLocale[locale] = {
        role: "TARGET_LOCALE",
        frozenSourceCells: frozen.inventory.sourceCount,
        sourceBoundDraftCells: 0,
        linguisticallyChangedCells: 0,
        sourceEquivalentLabelCells: 0,
        translationCellsRemaining: frozen.inventory.sourceCount,
        providerDecision: "UNRESOLVED",
        checkpoint: "MISSING",
        nativeReviewAcceptance: "MISSING",
        nativeReviewChecksRequired: 5,
        nativeReviewChecksPassed: 0,
        activationReady: false,
      };
    }
  }

  const body = {
    schema: ALL_LOCALE_LEDGER_BINDING.schema,
    status: "HOLD",
    activationReady: false,
    launchReady: false,
    claims: {
      snapshotOnly: true,
      generationOnly: true,
      runtimeMutationPermitted: false,
      nativeReviewClaim: "NONE",
      providerApprovalClaim: "NONE",
      canonicalEnglishControls: true,
    },
    sourceFreeze: {
      sourceCount: frozen.inventory.sourceCount,
      sourceKeysSha256: frozen.inventory.sourceKeysSha256,
      evidenceFileSha256: frozen.binding.evidenceFileSha256,
      evidenceCanonicalSha256: frozen.binding.evidenceCanonicalSha256,
      provenanceCanonicalSha256: frozen.binding.provenanceCanonicalSha256,
    },
    pcmArtifact: {
      fileSha256: sha256(inputs.pcmArtifactBytes),
      canonicalSha256: canonicalJsonSha256(inputs.pcmArtifact),
      proofFileSha256: sha256(inputs.pcmProofBytes),
      proofCanonicalSha256: canonicalJsonSha256(inputs.pcmProof),
      messageEntriesSha256: sha256(JSON.stringify(Object.entries(inputs.pcmArtifact.messages))),
      sourceCount: frozen.inventory.sourceCount,
      linguisticallyChangedCells: pcm.translatedCells,
      sourceEquivalentLabelCells: pcm.sourceEquivalentCells,
      aiGenerated: true,
      verified: false,
      activationReady: false,
    },
    runtimeSnapshot: runtime,
    totals: {
      requiredLocales: ALL_LOCALE_CODES.length,
      targetLocales: targetLocales.length,
      canonicalSourceCellsPerLocale: frozen.inventory.sourceCount,
      targetTranslationCellsRequired: targetLocales.length * frozen.inventory.sourceCount,
      sourceBoundDraftCellsPresent: frozen.inventory.sourceCount,
      translationCellsRemaining: missingDraftLocales.length * frozen.inventory.sourceCount,
      targetLocaleDraftsComplete: 1,
      targetLocaleDraftsMissing: missingDraftLocales.length,
      committedMachineDraftCheckpoints: inputs.committedCheckpointCount,
      providerDecisionsPresent: 1,
      providerDecisionsRemaining: missingDraftLocales.length,
      nativeReviewLocaleAcceptancesRequired: ALL_LOCALE_CODES.length,
      nativeReviewLocaleAcceptancesPresent: 0,
      nativeReviewLocaleAcceptancesRemaining: ALL_LOCALE_CODES.length,
      nativeReviewChecksRequired: ALL_LOCALE_CODES.length * 5,
      nativeReviewChecksPassed: 0,
      nativeReviewChecksRemaining: ALL_LOCALE_CODES.length * 5,
      immutableAcceptanceRecordsPresent: 0,
    },
    blockers: [
      `${missingDraftLocales.length * frozen.inventory.sourceCount} source-bound target-language cells remain across ${missingDraftLocales.length} locales.`,
      `${missingDraftLocales.length} target locales have no approved provider decision or committed checkpoint.`,
      `${ALL_LOCALE_CODES.length} locale acceptances and ${ALL_LOCALE_CODES.length * 5} native-review checks remain.`,
      `${runtime.activeCatalog.targetTranslatedCells} translated target cells are present in the active ${runtime.activeCatalog.sourceCount}-source runtime catalog.`,
      `${runtime.pendingVisibleSource.pendingSourceCount} visible source strings across ${runtime.pendingVisibleSource.pendingRouteCount} routes remain pending.`,
      "The PCM artifact is source-bound and deterministic but remains non-activating, AI-generated, and unverified.",
    ],
    perLocale,
  };
  return { ...body, ledgerCanonicalSha256: canonicalJsonSha256(body) };
}

async function readJson(path) {
  const bytes = await readFile(fileUrl(path));
  return { bytes, value: JSON.parse(bytes.toString("utf8")) };
}

async function readOptional(path) {
  try {
    return await readFile(fileUrl(path));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function countCommittedCheckpoints(path = "scripts/data/") {
  const directory = fileUrl(path);
  let count = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      count += await countCommittedCheckpoints(`${path}${entry.name}/`);
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      const bytes = await readFile(new URL(entry.name, directory));
      try {
        if (JSON.parse(bytes.toString("utf8"))?.schema === "iat-machine-draft-checkpoint/v2") count += 1;
      } catch {
        // Other data files are validated by their owning gates.
      }
    }
  }
  return count;
}

export async function loadAllLocaleLaunchGapInputs() {
  const [freeze, pcmArtifact, pcmProof, catalog, metadata, pending, criticalUi, policy, payloadContract,
    nativeReviewEvidenceBytes, committedCheckpointCount] = await Promise.all([
    readJson("scripts/data/pcm-source-freeze-evidence-5baff9.json"),
    readJson("scripts/data/pcm-machine-draft-5baff9-v2.json"),
    readJson("scripts/data/pcm-machine-draft-assembly-proof-5baff9.json"),
    readJson("app/i18n/messages.json"),
    readJson("app/i18n/metadata.generated.json"),
    readJson("app/i18n/pending-visible-source.json"),
    readJson("app/i18n/critical-ui-source.json"),
    readJson("app/i18n/reviewed-localization-policy.json"),
    readJson("app/i18n/payload-contract.json"),
    readOptional("app/i18n/native-review-signoffs.v1.json"),
    countCommittedCheckpoints(),
  ]);
  const namespace = `${payloadContract.value.assetNamespace}/${payloadContract.value.payloadNamespaceSha256.slice(0, 16)}`;
  const publicBundles = await Promise.all(ALL_LOCALE_CODES.map(async (locale) => {
    const result = await readJson(`public/${namespace}/${locale}.json`);
    return { locale, artifact: result.value, bytes: result.bytes };
  }));
  return {
    sourceFreezeEvidence: freeze.value,
    sourceFreezeEvidenceBytes: freeze.bytes,
    pcmArtifact: pcmArtifact.value,
    pcmArtifactBytes: pcmArtifact.bytes,
    pcmProof: pcmProof.value,
    pcmProofBytes: pcmProof.bytes,
    catalog: catalog.value,
    catalogBytes: catalog.bytes,
    metadata: metadata.value,
    metadataBytes: metadata.bytes,
    pending: pending.value,
    pendingBytes: pending.bytes,
    criticalUi: criticalUi.value,
    criticalUiBytes: criticalUi.bytes,
    policy: policy.value,
    policyBytes: policy.bytes,
    payloadContract: payloadContract.value,
    payloadContractBytes: payloadContract.bytes,
    publicBundles,
    nativeReviewEvidenceBytes,
    committedCheckpointCount,
  };
}

export function validateAllLocaleLaunchGapLedger(ledger, expected) {
  check(isRecord(ledger), "All-locale launch-gap ledger is malformed");
  const { ledgerCanonicalSha256, ...body } = ledger;
  check(
    ledgerCanonicalSha256 === canonicalJsonSha256(body),
    "All-locale launch-gap ledger canonical digest mismatch",
  );
  check(sameJson(ledger, expected), "All-locale launch-gap ledger does not match current immutable inputs");
  check(ledger.status === "HOLD" && ledger.activationReady === false && ledger.launchReady === false, "All-locale ledger weakened HOLD");
  check(ledger.totals.translationCellsRemaining === 71_568, "All-locale remaining-cell count drifted");
  check(ledger.totals.nativeReviewLocaleAcceptancesRemaining === 50, "All-locale review ledger drifted");
  check(ledger.totals.providerDecisionsRemaining === 48, "All-locale provider ledger drifted");
  return ledger;
}

export function serializeAllLocaleLaunchGapLedger(ledger) {
  return serialize(ledger);
}
