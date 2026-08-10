import assert from "node:assert/strict";
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
  assert.equal(ledger.runtimeSnapshot.publicPayloads.bundleCount, 50);
  assert.equal(ledger.runtimeSnapshot.publicPayloads.targetTranslatedCells, 0);
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

test("committed ledger matches all current source and output bindings", async () => {
  const ledger = JSON.parse(await (await import("node:fs/promises")).readFile(
    new URL("../scripts/data/all-locale-launch-gap-ledger-5baff9.json", import.meta.url),
    "utf8",
  ));
  const expected = buildAllLocaleLaunchGapLedger(await inputs());
  assert.equal(validateAllLocaleLaunchGapLedger(ledger, expected), ledger);
});
