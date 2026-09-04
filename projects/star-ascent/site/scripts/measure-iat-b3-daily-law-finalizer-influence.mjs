import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DRAW_DENOMINATOR = 10_000;
export const NORMAL_LOCKED_NUMERATOR = 100;
export const FRIDAY_LOCKED_NUMERATOR = 6_667;
export const ENTROPY_LAG_SLOTS = 150;
export const SOLANA_DAILY_LAW_ID = Buffer.from("IAT_B3_SOLANA_DAILY_LAW_V1", "ascii");
export const SYNTHETIC_SLOT_HASH_DOMAIN = Buffer.from(
  "IAT_B3_DAILY_LAW_SYNTHETIC_SLOT_TRACE_V1",
  "ascii",
);

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SITE_ROOT = resolve(dirname(SCRIPT_PATH), "..");
const CONSENSUS_SOURCE = resolve(SITE_ROOT, "programs/iat_b3_consensus/src/lib.rs");
const LAW_SOURCE = resolve(SITE_ROOT, "programs/iat_b3_law/src/lib.rs");

function sha256Bytes(value) {
  return createHash("sha256").update(value).digest();
}

function sha256Hex(value) {
  return sha256Bytes(value).toString("hex");
}

function parseHex32(value, label) {
  if (!/^[0-9a-f]{64}$/iu.test(value)) {
    throw new TypeError(`${label} must be exactly 32 bytes of hexadecimal`);
  }
  return Buffer.from(value, "hex");
}

function u64be(value, label) {
  const integer = BigInt(value);
  if (integer < 0n || integer > 0xffff_ffff_ffff_ffffn) {
    throw new RangeError(`${label} is outside u64`);
  }
  const output = Buffer.alloc(8);
  output.writeBigUInt64BE(integer);
  return output;
}

export function isFridayLocalDay(localDay) {
  const remainder = ((BigInt(localDay) % 7n) + 7n) % 7n;
  return remainder === 1n;
}

export function deriveSolanaLockdownDraw({
  ancestorSlotHash,
  localDay,
  entropySlot,
  networkGenesisHash,
  mint,
}) {
  const ancestor = Buffer.isBuffer(ancestorSlotHash)
    ? ancestorSlotHash
    : parseHex32(ancestorSlotHash, "ancestorSlotHash");
  const network = Buffer.isBuffer(networkGenesisHash)
    ? networkGenesisHash
    : parseHex32(networkGenesisHash, "networkGenesisHash");
  const mintBytes = Buffer.isBuffer(mint) ? mint : parseHex32(mint, "mint");
  if (ancestor.length !== 32 || network.length !== 32 || mintBytes.length !== 32) {
    throw new TypeError("Daily Law identity and entropy inputs must each be 32 bytes");
  }
  const lockedNumerator = isFridayLocalDay(localDay)
    ? FRIDAY_LOCKED_NUMERATOR
    : NORMAL_LOCKED_NUMERATOR;
  const modulus = BigInt(DRAW_DENOMINATOR);
  const sampleSpace = 1n << 256n;
  const acceptedUpperBound = sampleSpace - (sampleSpace % modulus);

  for (let counter = 0n; counter <= 0xffff_ffff_ffff_ffffn; counter += 1n) {
    const sample = sha256Bytes(
      Buffer.concat([
        SOLANA_DAILY_LAW_ID,
        Buffer.from([0]),
        network,
        Buffer.from([0]),
        mintBytes,
        Buffer.from([0]),
        Buffer.from(String(localDay), "ascii"),
        Buffer.from([0]),
        u64be(entropySlot, "entropySlot"),
        Buffer.from([0]),
        ancestor,
        u64be(counter, "counter"),
      ]),
    );
    const sampleInteger = BigInt(`0x${sample.toString("hex")}`);
    if (sampleInteger >= acceptedUpperBound) continue;
    const bucket = Number(sampleInteger % modulus);
    return {
      counter: Number(counter),
      bucket,
      lockedNumerator,
      denominator: DRAW_DENOMINATOR,
      locked: bucket < lockedNumerator,
    };
  }
  throw new RangeError("Daily Law rejection counter exhausted u64");
}

export function selectLaggedEntropy(currentSlot, entries, lagSlots = ENTROPY_LAG_SLOTS) {
  if (!Number.isSafeInteger(currentSlot) || currentSlot < lagSlots) {
    throw new RangeError("currentSlot cannot satisfy the configured entropy lag");
  }
  const targetSlot = currentSlot - lagSlots;
  const eligible = [...entries]
    .filter(({ slot }) => Number.isSafeInteger(slot) && slot <= targetSlot)
    .sort((left, right) => right.slot - left.slot);
  if (eligible.length === 0) {
    throw new RangeError("no retained SlotHashes entry satisfies the entropy lag");
  }
  return { targetSlot, entropySlot: eligible[0].slot, hash: eligible[0].hash };
}

export function syntheticSlotHash(slot, branch = "canonical") {
  return sha256Hex(
    Buffer.concat([
      SYNTHETIC_SLOT_HASH_DOMAIN,
      Buffer.from([0]),
      Buffer.from(branch, "utf8"),
      Buffer.from([0]),
      u64be(slot, "synthetic slot"),
    ]),
  );
}

function retainedSyntheticSlots(firstSlot, lastSlot, branch, include) {
  const entries = [];
  for (let slot = firstSlot; slot <= lastSlot; slot += 1) {
    if (include(slot)) entries.push({ slot, hash: syntheticSlotHash(slot, branch) });
  }
  return entries.sort((left, right) => right.slot - left.slot);
}

function candidateForInvocation({
  invocationSlot,
  entries,
  lagSlots,
  localDay,
  networkGenesisHash,
  mint,
}) {
  const selected = selectLaggedEntropy(invocationSlot, entries, lagSlots);
  const draw = deriveSolanaLockdownDraw({
    ancestorSlotHash: selected.hash,
    localDay,
    entropySlot: selected.entropySlot,
    networkGenesisHash,
    mint,
  });
  return {
    invocationSlot,
    targetSlot: selected.targetSlot,
    entropySlot: selected.entropySlot,
    ancestorSlotHash: selected.hash,
    drawCounter: draw.counter,
    bucket: draw.bucket,
    locked: draw.locked,
  };
}

function summarizeCandidates(candidates) {
  const open = candidates.filter((candidate) => !candidate.locked);
  const locked = candidates.filter((candidate) => candidate.locked);
  const firstOpen = candidates.findIndex((candidate) => !candidate.locked);
  const firstLocked = candidates.findIndex((candidate) => candidate.locked);
  return {
    invocationCount: candidates.length,
    distinctEntropySlotCount: new Set(candidates.map(({ entropySlot }) => entropySlot)).size,
    openCount: open.length,
    lockedCount: locked.length,
    firstOpenInvocationIndex: firstOpen === -1 ? null : firstOpen,
    firstLockedInvocationIndex: firstLocked === -1 ? null : firstLocked,
    finalizerCanSelectOpenByWaitingWithinTrace: firstOpen > 0,
    finalizerCanSelectLockedByWaitingWithinTrace: firstLocked > 0,
    candidates,
  };
}

function analyticOpenModel(localDay, candidateCounts) {
  const lockedNumerator = isFridayLocalDay(localDay)
    ? FRIDAY_LOCKED_NUMERATOR
    : NORMAL_LOCKED_NUMERATOR;
  const openNumerator = DRAW_DENOMINATOR - lockedNumerator;
  return {
    suppliedHashUniformityAssumptionOnly: true,
    independenceAssumptionOnly: true,
    lockedNumerator,
    openNumerator,
    denominator: DRAW_DENOMINATOR,
    expectedCandidatesUntilOpenUnderAssumptions: DRAW_DENOMINATOR / openNumerator,
    probabilityAtLeastOneOpenUnderAssumptions: Object.fromEntries(
      candidateCounts.map((count) => [
        String(count),
        1 - (lockedNumerator / DRAW_DENOMINATOR) ** count,
      ]),
    ),
  };
}

function sourceBinding() {
  const git = (args) =>
    execFileSync("git", args, { cwd: SITE_ROOT, encoding: "utf8" }).trim();
  const status = git(["status", "--porcelain=v1"]);
  return {
    head: git(["rev-parse", "HEAD"]),
    clean: status.length === 0,
    dirtyPathCount: status.length === 0 ? 0 : status.split(/\r?\n/u).length,
    consensusSource: "programs/iat_b3_consensus/src/lib.rs",
    consensusSourceSha256: sha256Hex(readFileSync(CONSENSUS_SOURCE)),
    lawSource: "programs/iat_b3_law/src/lib.rs",
    lawSourceSha256: sha256Hex(readFileSync(LAW_SOURCE)),
    measurementSource: "scripts/measure-iat-b3-daily-law-finalizer-influence.mjs",
    measurementSourceSha256: sha256Hex(readFileSync(SCRIPT_PATH)),
  };
}

export function measureFinalizerInfluence({
  localDay = 20_672,
  networkGenesisHash = "11".repeat(32),
  mint = "22".repeat(32),
  lagSlots = ENTROPY_LAG_SLOTS,
  invocationStart = 1_000_001,
  candidateCount = 64,
  bindSources = false,
} = {}) {
  if (!Number.isSafeInteger(candidateCount) || candidateCount < 2 || candidateCount > 512) {
    throw new RangeError("candidateCount must be an integer in [2, 512]");
  }
  const finalInvocation = invocationStart + candidateCount - 1;
  const firstRetained = invocationStart - lagSlots - 32;
  const lastRetained = finalInvocation - lagSlots;
  const consecutiveEntries = retainedSyntheticSlots(
    firstRetained,
    lastRetained,
    "canonical",
    () => true,
  );
  const skippedEntries = retainedSyntheticSlots(
    firstRetained,
    lastRetained,
    "skipped",
    (slot) => slot % 5 !== 0 && slot % 17 !== 0,
  );
  const invocations = Array.from({ length: candidateCount }, (_, index) => invocationStart + index);
  const common = { lagSlots, localDay, networkGenesisHash, mint };
  const consecutive = invocations.map((invocationSlot) =>
    candidateForInvocation({ invocationSlot, entries: consecutiveEntries, ...common }),
  );
  const skipped = invocations.map((invocationSlot) =>
    candidateForInvocation({ invocationSlot, entries: skippedEntries, ...common }),
  );
  const congestionOffsets = [0, 1, 2, 5, 8, 13, 21, 34, 55].filter(
    (offset) => offset < candidateCount,
  );
  const congested = congestionOffsets.map((offset) =>
    candidateForInvocation({
      invocationSlot: invocationStart + offset,
      entries: consecutiveEntries,
      ...common,
    }),
  );

  const forkPairs = invocations.map((invocationSlot) => {
    const targetSlot = invocationSlot - lagSlots;
    const branchAHash = syntheticSlotHash(targetSlot, "fork-a");
    const branchBHash = syntheticSlotHash(targetSlot, "fork-b");
    const branchA = deriveSolanaLockdownDraw({
      ancestorSlotHash: branchAHash,
      localDay,
      entropySlot: targetSlot,
      networkGenesisHash,
      mint,
    });
    const branchB = deriveSolanaLockdownDraw({
      ancestorSlotHash: branchBHash,
      localDay,
      entropySlot: targetSlot,
      networkGenesisHash,
      mint,
    });
    return {
      invocationSlot,
      entropySlot: targetSlot,
      branchA: { ancestorSlotHash: branchAHash, bucket: branchA.bucket, locked: branchA.locked },
      branchB: { ancestorSlotHash: branchBHash, bucket: branchB.bucket, locked: branchB.locked },
      outcomeDivergesAcrossModeledForks: branchA.locked !== branchB.locked,
    };
  });

  const consecutiveSummary = summarizeCandidates(consecutive);
  const skippedSummary = summarizeCandidates(skipped);
  const congestionSummary = summarizeCandidates(congested);
  const divergentForks = forkPairs.filter(({ outcomeDivergesAcrossModeledForks }) =>
    outcomeDivergesAcrossModeledForks,
  );

  return {
    schema: "iat-b3-daily-law-finalizer-influence-measurement-v1",
    measurementKind: "OFFLINE_SOURCE_BOUND_SYNTHETIC_MODEL",
    sourceBinding: bindSources ? sourceBinding() : null,
    inputs: {
      localDay,
      isFriday: isFridayLocalDay(localDay),
      networkGenesisHash,
      mint,
      lagSlots,
      invocationStart,
      candidateCount,
      slotHashTraceKind: "deterministic synthetic; not observed Solana consensus history",
    },
    runtimeSemantics: {
      targetRule: "current_slot - 150",
      selectionRule: "newest retained SlotHashes entry with slot <= target",
      firstSuccessfulSameDayFinalizationWins: true,
      finalizationPermissionless: true,
      suppliedAncestorHashClaimedUnbiasedVrf: false,
    },
    analyticModel: analyticOpenModel(localDay, [1, 2, 3, 6, 12, candidateCount]),
    scenarios: {
      consecutiveInvocationSlots: consecutiveSummary,
      skippedSlotTrace: skippedSummary,
      congestedInvocationOpportunities: congestionSummary,
      modeledForkAlternatives: {
        pairCount: forkPairs.length,
        divergentOutcomePairCount: divergentForks.length,
        leaderOrForkOutcomeInfluenceExistsInSyntheticTrace: divergentForks.length > 0,
        pairs: forkPairs,
      },
    },
    findings: {
      invocationRelativeEntropyChangesAcrossConsecutiveSlots:
        consecutiveSummary.distinctEntropySlotCount > 1,
      delayedFinalizerCanObserveMultipleExactCandidateOutcomes: candidateCount > 1,
      openOutcomeSelectableByWaitingInConsecutiveSyntheticTrace:
        consecutiveSummary.finalizerCanSelectOpenByWaitingWithinTrace,
      lockedOutcomeSelectableByWaitingInConsecutiveSyntheticTrace:
        consecutiveSummary.finalizerCanSelectLockedByWaitingWithinTrace,
      skippedSlotsReduceDistinctCandidateCount:
        skippedSummary.distinctEntropySlotCount < consecutiveSummary.distinctEntropySlotCount,
      permissionlessCompetitionEliminatesTimingInfluence: false,
      empiricalMainnetOrDevnetMeasurementComplete: false,
    },
    truth: {
      entropyRiskAcceptance: null,
      finalEntropyLagFrozen: false,
      productionEntropyClaimUnbiased: false,
      fullFeatureDevnetRehearsalComplete: false,
      activationReady: false,
      mainnetExecutionAuthorized: false,
      mainnetStatus: "HOLD",
    },
  };
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new TypeError(`unexpected argument ${token}`);
    const key = token.slice(2);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new TypeError(`missing value for --${key}`);
    }
    values[key] = value;
    index += 1;
  }
  const numeric = (key, fallback) =>
    values[key] === undefined ? fallback : Number(values[key]);
  return {
    localDay: numeric("local-day", 20_672),
    networkGenesisHash: values["network-genesis-hash"] ?? "11".repeat(32),
    mint: values.mint ?? "22".repeat(32),
    lagSlots: numeric("lag-slots", ENTROPY_LAG_SLOTS),
    invocationStart: numeric("invocation-start", 1_000_001),
    candidateCount: numeric("candidate-count", 64),
    bindSources: true,
  };
}

function main() {
  const report = measureFinalizerInfluence(parseArguments(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.truth.mainnetStatus === "HOLD" ? 2 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
