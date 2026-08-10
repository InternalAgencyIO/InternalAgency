import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateBenchmarkRecord } from "./lib/benchmark-validation.mjs";
import {
  DEFAULT_CACHE_ROOT,
  resolveSecureReportTarget,
  writeExclusiveAtomicReport,
} from "./lib/secure-report-path.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const result = { input: null, outputDir: null, reportName: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--input" && argv[index + 1]) result.input = path.resolve(argv[++index]);
    else if (argv[index] === "--output-dir" && argv[index + 1]) result.outputDir = path.resolve(argv[++index]);
    else if (argv[index] === "--report-name" && argv[index + 1]) result.reportName = argv[++index];
    else throw new Error(`unknown or incomplete argument: ${argv[index]}`);
  }
  if (!result.input || !result.outputDir || !result.reportName) {
    throw new Error("--input, --output-dir, and basename-only --report-name are required");
  }
  return result;
}

function assertCanonicalCacheChild(root, target, label) {
  const relative = path.relative(root, target);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`${label} must remain under canonical cache root ${root}`);
}

const args = parseArgs(process.argv.slice(2));
const canonicalRoot = await realpath(DEFAULT_CACHE_ROOT);
const input = await realpath(args.input);
assertCanonicalCacheChild(canonicalRoot, input, "benchmark input");
const outputSecurity = await resolveSecureReportTarget({
  outputDir: args.outputDir,
  reportName: args.reportName,
  cacheRoot: canonicalRoot,
});

const [record, fixtureBytes, localeMapBytes, provenanceBytes, promptBytes] = await Promise.all([
  readFile(input, "utf8").then(JSON.parse),
  readFile(path.join(here, "fixtures", "tiny-benchmark-cases.json")),
  readFile(path.join(here, "locale-map.json")),
  readFile(path.join(here, "model-provenance.json")),
  readFile(path.join(here, "prompt-template.txt")),
]);
const report = validateBenchmarkRecord({ record, fixtureBytes, localeMapBytes, provenanceBytes, promptBytes });
const reportPath = await writeExclusiveAtomicReport(outputSecurity, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  status: report.status,
  report: reportPath,
  technicalGatePassed: report.technicalGatePassed,
  heuristicSamplePassed: report.cases.every((entry) => entry.pass),
  throughputPass: report.throughput.pass,
  projectedHours: report.throughput.projectedHoursAtMeasuredUnbatchedRate,
  languageProof: false,
  nativeReviewRequired: true,
  activationAllowed: false,
  bulkGenerationAllowed: false,
}));
if (!report.technicalGatePassed) process.exitCode = 2;
