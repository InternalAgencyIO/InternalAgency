import { readFile, rename, writeFile } from "node:fs/promises";
import {
  buildAllLocaleLaunchGapLedger,
  loadAllLocaleLaunchGapInputs,
  serializeAllLocaleLaunchGapLedger,
} from "./lib/all-locale-launch-gap-ledger.mjs";

const outputUrl = new URL("./data/all-locale-launch-gap-ledger-5baff9.json", import.meta.url);
const checkOnly = process.argv.includes("--check");
const replace = process.argv.includes("--replace");
const inputs = await loadAllLocaleLaunchGapInputs();
const ledger = buildAllLocaleLaunchGapLedger(inputs);
const serialized = serializeAllLocaleLaunchGapLedger(ledger);

if (checkOnly) {
  const current = await readFile(outputUrl, "utf8");
  if (current !== serialized) throw new Error("Committed all-locale launch-gap ledger is stale");
  console.log(
    `PASS: immutable all-locale HOLD ledger matches current inputs; remainingCells=${ledger.totals.translationCellsRemaining}; remainingReviews=${ledger.totals.nativeReviewLocaleAcceptancesRemaining}; remainingProviders=${ledger.totals.providerDecisionsRemaining}.`,
  );
} else {
  if (!replace) {
    try {
      await readFile(outputUrl);
      throw new Error("Output already exists; use --check or explicit --replace");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  const temporaryUrl = new URL(`${outputUrl.href}.tmp-${process.pid}`);
  await writeFile(temporaryUrl, serialized, "utf8");
  await rename(temporaryUrl, outputUrl);
  console.log(
    `Wrote non-activating all-locale HOLD ledger: remainingCells=${ledger.totals.translationCellsRemaining}; remainingReviews=${ledger.totals.nativeReviewLocaleAcceptancesRemaining}; remainingProviders=${ledger.totals.providerDecisionsRemaining}.`,
  );
}
