import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  deriveSolanaLockdownDraw,
  measureFinalizerInfluence,
  selectLaggedEntropy,
} from "../scripts/measure-iat-b3-daily-law-finalizer-influence.mjs";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(
  testDirectory,
  "../scripts/measure-iat-b3-daily-law-finalizer-influence.mjs",
);

test("the JavaScript derivation matches the pinned Rust cross-language vector", () => {
  assert.deepEqual(
    deriveSolanaLockdownDraw({
      ancestorSlotHash: "33".repeat(32),
      localDay: 20_672,
      entropySlot: 42_424_242,
      networkGenesisHash: "11".repeat(32),
      mint: "22".repeat(32),
    }),
    {
      counter: 0,
      bucket: 151,
      lockedNumerator: 6_667,
      denominator: 10_000,
      locked: true,
    },
  );
});

test("invocation-relative lag selection follows newest eligible retained slot", () => {
  const entries = [
    { slot: 850, hash: "aa".repeat(32) },
    { slot: 848, hash: "bb".repeat(32) },
    { slot: 847, hash: "cc".repeat(32) },
  ];
  assert.deepEqual(selectLaggedEntropy(1_000, entries, 150), {
    targetSlot: 850,
    entropySlot: 850,
    hash: "aa".repeat(32),
  });
  assert.deepEqual(selectLaggedEntropy(999, entries, 150), {
    targetSlot: 849,
    entropySlot: 848,
    hash: "bb".repeat(32),
  });
});

test("synthetic traces expose exact waiting, skipped-slot, congestion, and fork influence", () => {
  const report = measureFinalizerInfluence();
  assert.equal(report.inputs.isFriday, true);
  assert.equal(report.inputs.lagSlots, 150);
  assert.equal(report.scenarios.consecutiveInvocationSlots.invocationCount, 64);
  assert.equal(report.scenarios.consecutiveInvocationSlots.firstLockedInvocationIndex, 0);
  assert.equal(report.scenarios.consecutiveInvocationSlots.firstOpenInvocationIndex, 4);
  assert.equal(
    report.findings.openOutcomeSelectableByWaitingInConsecutiveSyntheticTrace,
    true,
  );
  assert.equal(report.findings.skippedSlotsReduceDistinctCandidateCount, true);
  assert.ok(report.scenarios.modeledForkAlternatives.divergentOutcomePairCount > 0);
  assert.equal(report.findings.permissionlessCompetitionEliminatesTimingInfluence, false);
  assert.equal(report.findings.empiricalMainnetOrDevnetMeasurementComplete, false);
});

test("CLI output is source-bound, offline, nonauthorizing, and exits HOLD", () => {
  const result = spawnSync(process.execPath, [scriptPath, "--candidate-count", "12"], {
    cwd: resolve(testDirectory, ".."),
    encoding: "utf8",
  });
  assert.equal(result.status, 2, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.match(report.sourceBinding.head, /^[0-9a-f]{40}$/u);
  assert.equal(typeof report.sourceBinding.consensusSourceSha256, "string");
  assert.equal(typeof report.sourceBinding.lawSourceSha256, "string");
  assert.equal(report.truth.entropyRiskAcceptance, null);
  assert.equal(report.truth.finalEntropyLagFrozen, false);
  assert.equal(report.truth.fullFeatureDevnetRehearsalComplete, false);
  assert.equal(report.truth.mainnetExecutionAuthorized, false);
  assert.equal(report.truth.mainnetStatus, "HOLD");

  const source = readFileSync(scriptPath, "utf8");
  for (const forbidden of [
    /\bfetch\s*\(/u,
    /@solana\/web3\.js/u,
    /\bKeypair\b/u,
    /\bTransactionInstruction\b/u,
    /sendAndConfirm/u,
  ]) {
    assert.doesNotMatch(source, forbidden);
  }
});
