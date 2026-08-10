import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  ALL_LOCALE_CODES,
  buildAllLocaleLaunchGapLedger,
  loadAllLocaleLaunchGapInputs,
  validateAllLocaleLaunchGapLedger,
} from "../scripts/lib/all-locale-launch-gap-ledger.mjs";

let cachedInputs;
async function inputs() {
  cachedInputs ??= await loadAllLocaleLaunchGapInputs();
  return cachedInputs;
}

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function compiledBundle(sourceInputs, locale) {
  const { catalog, payloadContract } = sourceInputs;
  const artifact = {
    schema: payloadContract.schema,
    catalogSha256: payloadContract.catalogSha256,
    sourceCount: payloadContract.sourceCount,
    locale,
    sourceKeysSha256: payloadContract.sourceKeysSha256,
    messages: structuredClone(catalog.messages[locale]),
  };
  artifact.contentSha256 = sha256(JSON.stringify(artifact));
  return { locale, artifact, bytes: Buffer.from(JSON.stringify(artifact)) };
}

test("all-locale ledger records the exact current cell, review, provider, and runtime gaps", async () => {
  const ledger = buildAllLocaleLaunchGapLedger(await inputs());
  assert.equal(ledger.status, "HOLD");
  assert.equal(ledger.activationReady, false);
  assert.equal(ledger.launchReady, false);
  assert.equal(ledger.sourceFreeze.sourceCount, 1_491);
  assert.deepEqual(Object.keys(ledger.perLocale), ALL_LOCALE_CODES);
  assert.deepEqual(ledger.totals, {
    requiredLocales: 50,
    targetLocales: 49,
    canonicalSourceCellsPerLocale: 1_491,
    targetTranslationCellsRequired: 73_059,
    sourceBoundDraftCellsPresent: 1_491,
    translationCellsRemaining: 71_568,
    targetLocaleDraftsComplete: 1,
    targetLocaleDraftsMissing: 48,
    committedMachineDraftCheckpoints: 0,
    providerDecisionsPresent: 1,
    providerDecisionsRemaining: 48,
    nativeReviewLocaleAcceptancesRequired: 50,
    nativeReviewLocaleAcceptancesPresent: 0,
    nativeReviewLocaleAcceptancesRemaining: 50,
    nativeReviewChecksRequired: 250,
    nativeReviewChecksPassed: 0,
    nativeReviewChecksRemaining: 250,
    immutableAcceptanceRecordsPresent: 0,
  });
  assert.equal(ledger.runtimeSnapshot.activeCatalog.targetCells, 48_265);
  assert.equal(ledger.runtimeSnapshot.activeCatalog.targetTranslatedCells, 0);
  assert.equal(ledger.runtimeSnapshot.activeCatalog.targetSourceEquivalentCells, 48_265);
  assert.equal(ledger.runtimeSnapshot.pendingVisibleSource.pendingSourceCount, 48);
  assert.equal(ledger.runtimeSnapshot.pendingVisibleSource.pendingRouteCount, 13);
  assert.equal(ledger.claims.generatedPublicPayloadClaim, "OBSERVED_IF_PRESENT_NOT_REQUIRED_BUILD_OUTPUT");
  assert.equal(ledger.runtimeSnapshot.publicPayloads.bundleCount, 0);
  assert.equal(ledger.runtimeSnapshot.publicPayloads.missingBundleCount, 50);
  assert.deepEqual(ledger.runtimeSnapshot.publicPayloads.missingBundleLocales, ALL_LOCALE_CODES);
  assert.equal(ledger.runtimeSnapshot.publicPayloads.sourceCountPerBundle, null);
  assert.equal(ledger.runtimeSnapshot.publicPayloads.targetCells, 0);
  assert.equal(ledger.runtimeSnapshot.publicPayloads.targetTranslatedCells, 0);
  assert.equal(ledger.runtimeSnapshot.publicPayloads.targetSourceEquivalentCells, 0);
  assert.equal(
    ledger.blockers.includes("50 generated public locale bundles are absent from the repository snapshot."),
    true,
  );
});

test("PCM is counted once as a complete non-activating draft, never as native acceptance", async () => {
  const ledger = buildAllLocaleLaunchGapLedger(await inputs());
  assert.equal(ledger.pcmArtifact.sourceCount, 1_491);
  assert.equal(ledger.pcmArtifact.linguisticallyChangedCells, 1_438);
  assert.equal(ledger.pcmArtifact.sourceEquivalentLabelCells, 53);
  assert.equal(ledger.pcmArtifact.aiGenerated, true);
  assert.equal(ledger.pcmArtifact.verified, false);
  assert.equal(ledger.pcmArtifact.activationReady, false);
  assert.equal(ledger.perLocale.pcm.translationCellsRemaining, 0);
  assert.equal(ledger.perLocale.pcm.nativeReviewAcceptance, "MISSING");
  assert.equal(ledger.perLocale.pcm.provider.legalClearanceClaim, "NONE");
});

test("all 48 remaining targets stay provider-unresolved and checkpoint-missing", async () => {
  const ledger = buildAllLocaleLaunchGapLedger(await inputs());
  const missing = ALL_LOCALE_CODES.filter((locale) => !["en", "pcm"].includes(locale));
  assert.equal(missing.length, 48);
  for (const locale of missing) {
    assert.equal(ledger.perLocale[locale].sourceBoundDraftCells, 0, locale);
    assert.equal(ledger.perLocale[locale].translationCellsRemaining, 1_491, locale);
    assert.equal(ledger.perLocale[locale].providerDecision, "UNRESOLVED", locale);
    assert.equal(ledger.perLocale[locale].checkpoint, "MISSING", locale);
    assert.equal(ledger.perLocale[locale].nativeReviewAcceptance, "MISSING", locale);
    assert.equal(ledger.perLocale[locale].activationReady, false, locale);
  }
});

test("ledger tampering and readiness promotion fail closed", async () => {
  const expected = buildAllLocaleLaunchGapLedger(await inputs());
  const probes = [];

  const cellDrift = structuredClone(expected);
  cellDrift.totals.translationCellsRemaining -= 1;
  probes.push(cellDrift);

  const providerFabrication = structuredClone(expected);
  providerFabrication.perLocale.zh.providerDecision = "APPROVED";
  probes.push(providerFabrication);

  const reviewFabrication = structuredClone(expected);
  reviewFabrication.perLocale.fr.nativeReviewAcceptance = "PASS";
  probes.push(reviewFabrication);

  const activationPromotion = structuredClone(expected);
  activationPromotion.activationReady = true;
  probes.push(activationPromotion);

  for (const probe of probes) {
    assert.throws(
      () => validateAllLocaleLaunchGapLedger(probe, expected),
      /canonical digest mismatch|does not match current immutable inputs|weakened HOLD/u,
    );
  }
});

test("present generated bundles are recomputed from exact bytes and cannot forge translated-cell observations", async () => {
  const sourceInputs = await inputs();
  const english = compiledBundle(sourceInputs, "en");
  const spanish = compiledBundle(sourceInputs, "es");
  const partialInputs = {
    ...sourceInputs,
    publicBundles: sourceInputs.publicBundles.map((bundle) => {
      if (bundle.locale === "en") return english;
      if (bundle.locale === "es") return spanish;
      return bundle;
    }),
  };
  const partial = buildAllLocaleLaunchGapLedger(partialInputs);
  assert.equal(partial.status, "HOLD");
  assert.equal(partial.runtimeSnapshot.publicPayloads.bundleCount, 2);
  assert.equal(partial.runtimeSnapshot.publicPayloads.missingBundleCount, 48);

  const forgedSpanish = structuredClone(spanish.artifact);
  const firstSource = Object.keys(forgedSpanish.messages)[0];
  forgedSpanish.messages[firstSource] = `${forgedSpanish.messages[firstSource]} forged`;
  const forgedInputs = {
    ...partialInputs,
    publicBundles: partialInputs.publicBundles.map((bundle) => (
      bundle.locale === "es"
        ? { locale: "es", artifact: forgedSpanish, bytes: Buffer.from(JSON.stringify(forgedSpanish)) }
        : bundle
    )),
  };
  assert.throws(
    () => buildAllLocaleLaunchGapLedger(forgedInputs),
    /Public bundle content binding drifted: es/u,
  );
});

test("committed ledger matches the configured repository snapshot and optional output observations", async () => {
  const ledger = JSON.parse(await (await import("node:fs/promises")).readFile(
    new URL("../scripts/data/all-locale-launch-gap-ledger-5baff9.json", import.meta.url),
    "utf8",
  ));
  const expected = buildAllLocaleLaunchGapLedger(await inputs());
  assert.equal(validateAllLocaleLaunchGapLedger(ledger, expected), ledger);
});
