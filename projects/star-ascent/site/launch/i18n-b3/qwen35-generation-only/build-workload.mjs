import { readFile, mkdir, realpath, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACTIVATION_ALLOWED,
  FROZEN_SOURCE_COUNT,
  FROZEN_SOURCE_SHA256,
  MODEL_REVISION,
  TARGET_CELL_COUNT,
  TARGET_LOCALE_COUNT,
  assertFrozenSourceEvidence,
  canonicalJson,
  protectedInventory,
  sha256,
} from "./lib/integrity.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultSourceFreeze = path.resolve(here, "../../../scripts/data/pcm-source-freeze-evidence-5baff9.json");
const eCacheRoot = path.resolve("E:\\CodexCache");

function parseArgs(argv) {
  const result = { sourceFreeze: defaultSourceFreeze, outputDir: null };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--source-freeze" && value) {
      result.sourceFreeze = path.resolve(value);
      index += 1;
    } else if (flag === "--output-dir" && value) {
      result.outputDir = path.resolve(value);
      index += 1;
    } else {
      throw new Error(`unknown or incomplete argument: ${flag}`);
    }
  }
  if (!result.outputDir) throw new Error("--output-dir under E:\\CodexCache is required");
  return result;
}

function assertExternalOutputPath(outputDir) {
  const relative = path.relative(eCacheRoot, outputDir);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`output directory must be a child of ${eCacheRoot}`);
  }
}

async function writeAtomicNew(filePath, bytes) {
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  await writeFile(temporaryPath, bytes, { flag: "wx" });
  try {
    await rename(temporaryPath, filePath);
  } catch (error) {
    try {
      const existing = await readFile(filePath);
      if (Buffer.compare(existing, Buffer.from(bytes)) === 0) {
        await unlink(temporaryPath);
        return "UNCHANGED";
      }
    } catch {
      // Preserve the original atomic rename error below.
    }
    await unlink(temporaryPath).catch(() => {});
    throw new Error(`refusing to replace existing non-identical artifact ${filePath}: ${error.message}`);
  }
  return "CREATED";
}

async function readJsonWithBytes(filePath) {
  const bytes = await readFile(filePath);
  return { bytes, value: JSON.parse(bytes.toString("utf8")) };
}

const args = parseArgs(process.argv.slice(2));
assertExternalOutputPath(args.outputDir);
await mkdir(args.outputDir, { recursive: true });
const resolvedOutput = await realpath(args.outputDir);
assertExternalOutputPath(resolvedOutput);
if (!(await stat(resolvedOutput)).isDirectory()) throw new Error("output path is not a directory");

const [sourceArtifact, localeArtifact, provenanceArtifact, promptBytes] = await Promise.all([
  readJsonWithBytes(args.sourceFreeze),
  readJsonWithBytes(path.join(here, "locale-map.json")),
  readJsonWithBytes(path.join(here, "model-provenance.json")),
  readFile(path.join(here, "prompt-template.txt")),
]);

const sources = assertFrozenSourceEvidence(sourceArtifact.value);
const localeMap = localeArtifact.value;
const provenance = provenanceArtifact.value;
if (ACTIVATION_ALLOWED !== false || localeMap.activationAllowed !== false || provenance.activationAllowed !== false) {
  throw new Error("activation invariant failed");
}
if (!Array.isArray(localeMap.locales) || localeMap.locales.length !== TARGET_LOCALE_COUNT) {
  throw new Error(`locale map must contain exactly ${TARGET_LOCALE_COUNT} locales`);
}
if (new Set(localeMap.locales.map(({ locale }) => locale)).size !== TARGET_LOCALE_COUNT) {
  throw new Error("locale map contains duplicate locale codes");
}
if (provenance.model?.revision !== MODEL_REVISION) throw new Error("model revision drifted");
if (provenance.frozenSource?.count !== FROZEN_SOURCE_COUNT || provenance.frozenSource?.targetCellCount !== TARGET_CELL_COUNT) {
  throw new Error("model provenance is not bound to the frozen workload");
}

const promptSha256 = sha256(promptBytes);
const localeMapSha256 = sha256(localeArtifact.bytes);
const modelProvenanceSha256 = sha256(provenanceArtifact.bytes);
const generation = Object.freeze({
  engine: "transformers-local",
  modelRepository: provenance.model.repository,
  modelRevision: MODEL_REVISION,
  promptSha256,
  doSample: false,
  numBeams: 1,
  temperature: null,
  topP: null,
  topK: null,
  seed: 0,
  maxNewTokens: 512,
  thinking: false,
  responseContract: "ONE_JSON_OBJECT_ONE_STRING_TRANSLATION_KEY",
});

const workloadLines = [];
let ordinal = 0;
let sourcesWithProtectedTokens = 0;
let totalDistinctProtectedTokens = 0;
const sourceRows = sources.map((source, sourceIndex) => {
  const sourceSha256 = sha256(Buffer.from(source, "utf8"));
  const inventory = protectedInventory(source);
  if (inventory.tokens.length > 0) sourcesWithProtectedTokens += 1;
  totalDistinctProtectedTokens += inventory.tokens.length;
  return { source, sourceIndex, sourceSha256, protectedTokenCounts: inventory.tokenCounts };
});

for (const localeEntry of localeMap.locales) {
  for (const sourceRow of sourceRows) {
    const identity = [
      "iat-b3-qwen35-cell/v1",
      FROZEN_SOURCE_SHA256,
      localeEntry.locale,
      sourceRow.sourceSha256,
      MODEL_REVISION,
      promptSha256,
    ].join("\0");
    const cell = {
      schema: "iat-b3-qwen35-workload-cell/v1",
      ordinal,
      cellId: sha256(identity),
      sourceIndex: sourceRow.sourceIndex,
      sourceSha256: sourceRow.sourceSha256,
      source: sourceRow.source,
      protectedTokenCounts: sourceRow.protectedTokenCounts,
      locale: localeEntry.locale,
      targetLanguage: localeEntry.targetLanguage,
      officialLanguageName: localeEntry.officialName,
      targetScript: localeEntry.script,
      localeMapping: localeEntry.mapping,
      promptSha256,
      modelRevision: MODEL_REVISION,
      activationAllowed: false,
      status: "PENDING_LOCAL_GENERATION",
    };
    workloadLines.push(JSON.stringify(cell));
    ordinal += 1;
  }
}
if (ordinal !== TARGET_CELL_COUNT) throw new Error(`workload size ${ordinal} != ${TARGET_CELL_COUNT}`);

const workloadBytes = Buffer.from(`${workloadLines.join("\n")}\n`, "utf8");
const workloadSha256 = sha256(workloadBytes);
const manifestCore = {
  schema: "iat-b3-qwen35-generation-workload/v1",
  status: "GENERATION_ONLY_HOLD",
  activationAllowed: false,
  bulkGenerationAllowed: false,
  nativeReviewRequired: true,
  legalReview: "UNRESOLVED",
  sourceFreeze: {
    evidencePath: args.sourceFreeze,
    evidenceFileSha256: sha256(sourceArtifact.bytes),
    sourceCount: FROZEN_SOURCE_COUNT,
    sourceKeysSha256: FROZEN_SOURCE_SHA256,
    sourceOrdering: sourceArtifact.value.sourceFreeze.ordering,
  },
  locales: {
    count: TARGET_LOCALE_COUNT,
    codes: localeMap.locales.map(({ locale }) => locale),
    localeMapSha256,
  },
  workload: {
    cellCount: TARGET_CELL_COUNT,
    ordering: "LOCALE_MAP_ORDER_THEN_FROZEN_SOURCE_ORDER",
    file: "workload.jsonl",
    sha256: workloadSha256,
    containsFrozenSourceText: true,
    networkTransmissionAllowed: false,
  },
  protectedInventory: {
    sourcesWithProtectedTokens,
    totalDistinctProtectedTokens,
    exactMultisetPreservationRequired: true,
  },
  modelProvenanceSha256,
  generation,
  resume: {
    checkpointFile: "checkpoint.json",
    resultJournal: "results.jsonl",
    strategy: "REPLAY_HASH_BOUND_APPEND_ONLY_UNREVIEWED_CANDIDATES_AND_SELECT_LOWEST_UNGENERATED_ORDINAL",
    partialCellAcceptance: false,
  },
  prohibitedDestinations: ["app/i18n", "public", "scripts", "package.json", "runtime"],
};
const manifestCanonicalSha256 = sha256(canonicalJson(manifestCore));
const manifest = { ...manifestCore, manifestCanonicalSha256 };
const checkpoint = {
  schema: "iat-b3-qwen35-checkpoint/v2",
  status: "READY_FOR_TINY_BENCHMARK_ONLY",
  activationAllowed: false,
  bulkGenerationAllowed: false,
  manifestCanonicalSha256,
  workloadSha256,
  totalCellCount: TARGET_CELL_COUNT,
  candidateCellCount: 0,
  acceptedCellCount: 0,
  languageProofCount: 0,
  rejectedAttemptCount: 0,
  nextPendingOrdinal: 0,
  candidateCellDigests: {},
  resultJournalSha256: sha256(Buffer.alloc(0)),
};

const writes = {};
writes.workload = await writeAtomicNew(path.join(resolvedOutput, "workload.jsonl"), workloadBytes);
writes.manifest = await writeAtomicNew(path.join(resolvedOutput, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
writes.checkpoint = await writeAtomicNew(path.join(resolvedOutput, "checkpoint.json"), `${JSON.stringify(checkpoint, null, 2)}\n`);
writes.results = await writeAtomicNew(path.join(resolvedOutput, "results.jsonl"), Buffer.alloc(0));

console.log(JSON.stringify({
  status: "WORKLOAD_READY_GENERATION_NOT_AUTHORIZED",
  outputDir: resolvedOutput,
  sourceCount: FROZEN_SOURCE_COUNT,
  localeCount: TARGET_LOCALE_COUNT,
  cellCount: TARGET_CELL_COUNT,
  sourceKeysSha256: FROZEN_SOURCE_SHA256,
  workloadSha256,
  manifestCanonicalSha256,
  activationAllowed: false,
  bulkGenerationAllowed: false,
  writes,
}));
