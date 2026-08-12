import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  MODEL_REVISION,
  TARGET_CELL_COUNT,
  canonicalJson,
  sha256,
} from "./lib/integrity.mjs";
import { assertReplayArtifactBindings, evaluateUnreviewedCandidate } from "./lib/checkpoint-bindings.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const cacheRoot = path.resolve("E:\\CodexCache");

function parseArgs(argv) {
  if (argv.length !== 2 || argv[0] !== "--output-dir") throw new Error("usage: node replay-checkpoint.mjs --output-dir E:\\CodexCache\\...");
  return path.resolve(argv[1]);
}

function assertCacheChild(target) {
  const relative = path.relative(cacheRoot, target);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`path must be a child of ${cacheRoot}`);
}

function jsonLines(text, label) {
  if (text.length === 0) return [];
  if (!text.endsWith("\n")) throw new Error(`${label} must end with a newline; possible partial write`);
  return text.slice(0, -1).split("\n").map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`${label} line ${index + 1} is invalid JSON: ${error.message}`);
    }
  });
}

const requested = parseArgs(process.argv.slice(2));
assertCacheChild(requested);
const outputDir = await realpath(requested);
assertCacheChild(outputDir);

const [manifestText, workloadText, resultsText, checkpoint, localeMapBytes, modelProvenanceBytes, promptBytes] = await Promise.all([
  readFile(path.join(outputDir, "manifest.json"), "utf8"),
  readFile(path.join(outputDir, "workload.jsonl"), "utf8"),
  readFile(path.join(outputDir, "results.jsonl"), "utf8"),
  readFile(path.join(outputDir, "checkpoint.json"), "utf8").then(JSON.parse),
  readFile(path.join(here, "locale-map.json")),
  readFile(path.join(here, "model-provenance.json")),
  readFile(path.join(here, "prompt-template.txt")),
]);
const manifest = JSON.parse(manifestText);
const localeMap = JSON.parse(localeMapBytes.toString("utf8"));
if (manifest.activationAllowed !== false || manifest.bulkGenerationAllowed !== false) throw new Error("manifest activation invariant failed");
const { manifestCanonicalSha256, ...manifestCore } = manifest;
if (sha256(canonicalJson(manifestCore)) !== manifestCanonicalSha256) throw new Error("manifest canonical digest mismatch");
if (sha256(Buffer.from(workloadText, "utf8")) !== manifest.workload.sha256) throw new Error("workload digest mismatch");
assertReplayArtifactBindings({ manifest, localeMapBytes, modelProvenanceBytes, promptBytes });

const workload = jsonLines(workloadText, "workload");
if (workload.length !== TARGET_CELL_COUNT) throw new Error(`workload must contain ${TARGET_CELL_COUNT} complete cells`);
const cells = new Map();
for (const [expectedOrdinal, cell] of workload.entries()) {
  if (cell.ordinal !== expectedOrdinal || cell.activationAllowed !== false || cell.modelRevision !== MODEL_REVISION) {
    throw new Error(`workload cell invariant failed at ordinal ${expectedOrdinal}`);
  }
  if (cells.has(cell.cellId)) throw new Error(`duplicate workload cell ID ${cell.cellId}`);
  cells.set(cell.cellId, cell);
}

const localeByCode = new Map(localeMap.locales.map((entry) => [entry.locale, entry]));
const results = jsonLines(resultsText, "results journal");
const candidates = new Map();
let rejectedAttemptCount = 0;
for (const [journalIndex, result] of results.entries()) {
  const cell = cells.get(result.cellId);
  if (!cell) throw new Error(`result references unknown cell ${result.cellId}`);
  let evaluation;
  try {
    evaluation = evaluateUnreviewedCandidate({ result, cell, localeEntry: localeByCode.get(cell.locale) });
  } catch (error) {
    throw new Error(`result journal line ${journalIndex + 1}: ${error.message}`);
  }
  if (!evaluation.candidate) {
    rejectedAttemptCount += 1;
    continue;
  }
  if (candidates.has(cell.cellId)) throw new Error(`duplicate candidate result for cell ${cell.cellId}`);
  candidates.set(cell.cellId, evaluation.resultIdentity);
}

let nextPendingOrdinal = null;
for (const cell of workload) {
  if (!candidates.has(cell.cellId)) {
    nextPendingOrdinal = cell.ordinal;
    break;
  }
}
const candidateCellDigests = Object.fromEntries(
  [...candidates.entries()]
    .sort(([left], [right]) => cells.get(left).ordinal - cells.get(right).ordinal),
);
const replayed = {
  schema: "iat-b3-qwen35-checkpoint/v2",
  status: candidates.size === TARGET_CELL_COUNT ? "DRAFT_CANDIDATES_COMPLETE_LANGUAGE_NATIVE_REVIEW_HOLD" : "READY_FOR_TINY_BENCHMARK_ONLY",
  activationAllowed: false,
  bulkGenerationAllowed: false,
  manifestCanonicalSha256,
  workloadSha256: manifest.workload.sha256,
  totalCellCount: TARGET_CELL_COUNT,
  candidateCellCount: candidates.size,
  acceptedCellCount: 0,
  languageProofCount: 0,
  rejectedAttemptCount,
  nextPendingOrdinal,
  candidateCellDigests,
  resultJournalSha256: createHash("sha256").update(Buffer.from(resultsText, "utf8")).digest("hex"),
};
if (canonicalJson(checkpoint) !== canonicalJson(replayed)) {
  throw new Error(`checkpoint does not equal deterministic journal replay; expected digest ${sha256(canonicalJson(replayed))}`);
}

console.log(JSON.stringify({
  status: "CHECKPOINT_REPLAY_VERIFIED",
  outputDir,
  candidateCellCount: candidates.size,
  acceptedCellCount: 0,
  languageProofCount: 0,
  rejectedAttemptCount,
  nextPendingOrdinal,
  workloadSha256: manifest.workload.sha256,
  checkpointCanonicalSha256: sha256(canonicalJson(replayed)),
  activationAllowed: false,
  bulkGenerationAllowed: false,
}));
