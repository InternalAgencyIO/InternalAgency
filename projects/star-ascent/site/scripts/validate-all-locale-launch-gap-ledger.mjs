import { readFile } from "node:fs/promises";
import {
  buildAllLocaleLaunchGapLedger,
  loadAllLocaleLaunchGapInputs,
  validateAllLocaleLaunchGapLedger,
} from "./lib/all-locale-launch-gap-ledger.mjs";

const ledgerUrl = new URL("./data/all-locale-launch-gap-ledger-5baff9.json", import.meta.url);
const [ledgerBytes, inputs] = await Promise.all([
  readFile(ledgerUrl),
  loadAllLocaleLaunchGapInputs(),
]);
const ledger = JSON.parse(ledgerBytes.toString("utf8"));
const expected = buildAllLocaleLaunchGapLedger(inputs);
validateAllLocaleLaunchGapLedger(ledger, expected);

console.log("All-locale launch-gap ledger (immutable, fail-closed, non-activating)");
console.log(`status=${ledger.status}`);
console.log(`sourceCount=${ledger.sourceFreeze.sourceCount}`);
console.log(`runtimeTargetTranslatedCells=${ledger.runtimeSnapshot.activeCatalog.targetTranslatedCells}`);
console.log(`pcmSourceBoundDraftCells=${ledger.perLocale.pcm.sourceBoundDraftCells}`);
console.log(`remainingTranslationCells=${ledger.totals.translationCellsRemaining}`);
console.log(`remainingProviderDecisions=${ledger.totals.providerDecisionsRemaining}`);
console.log(`remainingNativeReviewAcceptances=${ledger.totals.nativeReviewLocaleAcceptancesRemaining}`);
console.log(`remainingNativeReviewChecks=${ledger.totals.nativeReviewChecksRemaining}`);
console.log("PASS: ledger matches current inputs and preserves HOLD; this is gap evidence, not translation or launch approval.");
